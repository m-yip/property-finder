import { useState, useEffect, useRef } from "react";
import { Icon } from '@iconify/react';

// ─── DESCRIPTION MINING HELPERS ────────────────────────────────────────────
function mineAmount(desc, keywords) {
  if (!desc) return null;
  const kw = keywords.join('|');
  const m = desc.match(new RegExp(`(?:${kw})[^£\\d]{0,80}£\\s*([\\d,]+)`, 'i'));
  return m ? `£${m[1]}` : null;
}
function mineYears(desc) {
  if (!desc) return null;
  const m = desc.match(/(\d{2,4})\s+years?\s+(?:remaining|left|unexpired)/i)
    || desc.match(/(?:lease\s+(?:length|remaining))[^.]{0,30}(\d{2,4})\s+years?/i)
    || desc.match(/(\d{2,4})\s+year(?:s?)?\s+(?:leasehold|lease)/i);
  return m ? `${m[1]} years remaining` : null;
}
function mineSqft(desc) {
  if (!desc) return null;
  const ft = desc.match(/(\d[\d,]*)\s*sq\.?\s*ft\b/i);
  if (ft) return `${parseInt(ft[1].replace(/,/g,''))} sq ft`;
  const m = desc.match(/(\d[\d,.]*)\s*(?:sq\.?\s*m(?:etres?)?|sqm|m²)\b/i);
  if (m) return `~${Math.round(parseFloat(m[1].replace(/,/g,'')) * 10.764)} sq ft`;
  return null;
}

// ─── SCORING SECTIONS ──────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: "financials", icon: "solar:wallet-money-bold", title: "Financials", subtitle: "Let's talk numbers",
    questions: [
      {
        id: "price", label: "Asking Price Value", weight: 3,
        anchors: { 1: "Way overpriced for this area", 2: "Slightly high — priced to negotiate", 3: "Fair market value", 4: "Good value for money", 5: "Exceptional value — below market" },
        contextHint: (p) => p.price ? `Listed at ${p.price}` : null,
      },
      {
        id: "service_charge", label: "Service Charge", weight: 2,
        anchors: { 1: "Very high — £5,000+/yr", 2: "High — £3,000–5,000/yr", 3: "Average — £2,000–3,000/yr", 4: "Reasonable — £1,000–2,000/yr", 5: "Low or nil — under £1,000/yr" },
        contextHint: (p) => {
          if (p.serviceCharge != null) return `Service charge: £${Number(p.serviceCharge).toLocaleString()}/yr`;
          const found = mineAmount(p.description, ['service charge', 'management charge', 'maintenance charge', 'service levy']);
          if (found) return `From description: ${found}/yr`;
          return "Not extracted — check the listing or ask the agent";
        },
      },
      {
        id: "ground_rent", label: "Ground Rent", weight: 1,
        anchors: { 1: "High escalating — £500+/yr", 2: "Moderate — £250–500/yr", 3: "Low — £100–250/yr", 4: "Nominal — under £100/yr", 5: "Peppercorn or zero" },
        contextHint: (p) => {
          if (p.groundRent === 0 || p.groundRent === "0") return "Ground rent: peppercorn / zero";
          if (p.groundRent) return `Ground rent: £${Number(p.groundRent).toLocaleString()}/yr`;
          if (p.description && /peppercorn|nil ground|zero ground|no ground rent/i.test(p.description)) return "From description: peppercorn / zero ground rent";
          const found = mineAmount(p.description, ['ground rent', 'annual ground rent']);
          if (found) return `From description: ${found}/yr ground rent`;
          return "Not extracted — check the lease documents";
        },
      },
      {
        id: "lease_length", label: "Lease Length", weight: 2,
        anchors: { 1: "~80 years — urgent problem", 2: "~90–100 years — negotiate extension", 3: "~110 years — acceptable", 4: "150+ years — no concerns", 5: "999 years or freehold — ideal" },
        contextHint: (p) => {
          if (p.leaseLength) return `Lease: ${p.leaseLength}`;
          if (p.tenure) return `Tenure: ${p.tenure}`;
          const found = mineYears(p.description);
          if (found) return `From description: ${found}`;
          if (p.description && /freehold/i.test(p.description)) return "From description: freehold";
          return "Not extracted — confirm with the agent";
        },
      },
    ]
  },
  {
    id: "property", icon: "solar:home-2-bold", title: "The Property", subtitle: "Size, condition and specs",
    questions: [
      {
        id: "sqft", label: "Size", weight: 2,
        anchors: { 1: "Under 400 sq ft — too cramped", 2: "Around 420 sq ft — tight", 3: "Around 430 sq ft — just about workable", 4: "450+ sq ft — good for a 1-bed", 5: "500+ sq ft — spacious" },
        contextHint: (p) => {
          if (p.sqft) return `Floor area: ${p.sqft} sq ft`;
          const found = mineSqft(p.description);
          if (found) return `From description: ${found}`;
          return "Floor area not listed — ask the agent for a floor plan";
        },
      },
      {
        id: "bedrooms", label: "Bedrooms", weight: 1,
        anchors: { 1: "Far too few for my needs", 2: "One short of ideal", 3: "Just enough", 4: "Good fit for my needs", 5: "More rooms than I need" },
        contextHint: (p) => p.bedrooms ? `Listed as ${p.bedrooms} bedroom${p.bedrooms > 1 ? "s" : ""}` : null,
      },
      {
        id: "bathrooms", label: "Bathrooms", weight: 1,
        anchors: { 1: "Separate WC & bath — old building", 2: "One bathroom, no en-suite", 3: "One bathroom — standard", 4: "Bathroom + en-suite or separate WC", 5: "Two full bathrooms" },
        contextHint: (p) => p.bathrooms ? `Listed as ${p.bathrooms} bathroom${p.bathrooms > 1 ? "s" : ""}` : null,
      },
      {
        id: "storage", label: "Storage Space", weight: 1,
        anchors: { 1: "No storage whatsoever", 2: "Very limited — one small cupboard", 3: "Some storage, workable", 4: "Good storage throughout", 5: "Excellent built-in storage" },
        contextHint: () => "Think about built-in wardrobes, hallway cupboards, utility room, and any additional storage you noticed",
      },
      {
        id: "condition", label: "Condition / Work Needed", weight: 2,
        anchors: { 1: "Major structural works required", 2: "Significant renovation needed", 3: "Cosmetic updates only", 4: "Minor refresh — a lick of paint", 5: "Immaculate — move-in ready" },
        contextHint: () => "Consider the kitchen, bathrooms, flooring, windows, boiler age, and overall finish you observed",
      },
    ]
  },
  {
    id: "views", icon: "solar:sun-fog-bold", title: "Views & Light", subtitle: "What you see every day",
    questions: [
      {
        id: "view", label: "View Quality", weight: 2,
        anchors: { 1: "Facing a wall or car park", 2: "Busy road or overlooked by neighbours", 3: "Quiet street or rooftop outlook", 4: "Pleasant green or open aspect", 5: "Water, park, or open green view" },
        contextHint: () => "What could you see from the main windows and living areas?",
      },
      {
        id: "balcony", label: "Balcony / Outdoor Space", weight: 2,
        anchors: { 1: "No outdoor space at all", 2: "Window ledge only", 3: "Juliet balcony or shared terrace", 4: "Small private balcony", 5: "Private balcony, terrace or garden" },
        contextHint: () => "Did the property have any private outdoor space? Think about size, condition, and usability",
      },
      {
        id: "light", label: "Natural Light", weight: 2,
        anchors: { 1: "Dark in most rooms", 2: "Dim in key rooms — north-facing", 3: "Decent light in main rooms", 4: "Bright and airy throughout", 5: "Flooded with light — dual or triple aspect" },
        contextHint: () => "Think about aspect (north/south/east/west), window size, and how the light felt at the time of viewing",
      },
    ]
  },
  {
    id: "location", icon: "solar:map-point-bold", title: "Location", subtitle: "Where it sits in the city",
    questions: [
      {
        id: "commute", label: "Commute & Location", weight: 3,
        anchors: { 1: "Very inconvenient — over an hour", 2: "Long commute — 45–60 mins", 3: "Manageable — 30–45 mins", 4: "Good commute — under 30 mins", 5: "Ideal — short and stress-free" },
        contextHint: (p) => p.address ? `Located at: ${p.address}` : "How does this location work for your daily commute and lifestyle?",
      },
      {
        id: "transport", label: "Transport Links", weight: 2,
        anchors: { 1: "Car only — no public transport", 2: "Bus only, long walk to stops", 3: "Tube or rail within 15 mins walk", 4: "Good links — multiple options", 5: "Excellent — tube or rail under 5 mins" },
        contextHint: () => "Nearest tube, Overground, rail, or bus stops — and how long was the walk?",
      },
      {
        id: "amenities", label: "Local Amenities", weight: 1,
        anchors: { 1: "Nothing walkable — very isolated", 2: "Limited, need to travel for basics", 3: "Basic shops, cafes and essentials", 4: "Good range of restaurants and shops", 5: "Vibrant — everything walkable" },
        contextHint: () => "Supermarkets, gyms, restaurants, parks, pharmacies — what did the surrounding streets feel like?",
      },
      {
        id: "parking", label: "Parking", weight: 1,
        anchors: { 1: "No parking anywhere near", 2: "Very limited, restricted street parking", 3: "Permit zone with availability", 4: "Unrestricted easy street parking", 5: "Dedicated private parking included" },
        contextHint: () => "Did the property include parking? If not, how was the street parking situation?",
      },
    ]
  },
  {
    id: "liveability", icon: "solar:volume-loud-bold", title: "Liveability", subtitle: "Day-to-day living quality",
    questions: [
      {
        id: "noise", label: "Noise Level", weight: 2,
        anchors: { 1: "Extremely loud — constant traffic or noise", 2: "Frequently noisy — hard to ignore", 3: "Some noise but manageable", 4: "Mostly quiet — occasional sounds", 5: "Very peaceful and quiet inside" },
        contextHint: () => "How was it inside the flat — road noise through windows, neighbours above/below, building sounds?",
      },
      {
        id: "building", label: "Building Quality", weight: 2,
        anchors: { 1: "Poor condition, visible disrepair", 2: "Below average — some neglect", 3: "Average — functional and adequate", 4: "Well maintained throughout", 5: "Premium finish — immaculate communal areas" },
        contextHint: () => "Entrance, hallways, lifts, bin stores, communal areas — what was the overall upkeep like?",
      },
      {
        id: "safety", label: "Safety & Area Feel", weight: 2,
        anchors: { 1: "Felt unsafe or uncomfortable", 2: "Some unease in the area", 3: "Average — felt fine during the day", 4: "Generally safe, well-lit streets", 5: "Very safe and comfortable at all times" },
        contextHint: () => "How did the street and surrounding area feel? Think about lighting, foot traffic, and your gut instinct",
      },
    ]
  },
  {
    id: "xfactor", icon: "solar:stars-bold", title: "X-Factor", subtitle: "The intangibles",
    questions: [
      {
        id: "gut", label: "Gut Feeling", weight: 3,
        anchors: { 1: "Something felt off — clear no", 2: "Left feeling underwhelmed", 3: "Could see it working with time", 4: "Excited — this could genuinely work", 5: "Loved it — could move in tomorrow" },
        contextHint: () => "Set the numbers aside. Could you picture yourself living here — cooking, relaxing, having people over?",
      },
    ]
  },
];

const ALL_QUESTIONS = SECTIONS.flatMap(s => s.questions);
const MAX_WEIGHTED = ALL_QUESTIONS.reduce((sum, q) => sum + 5 * q.weight, 0);

function getTotal(scores) {
  if (!scores || !Object.keys(scores).length) return 0;
  let w = 0;
  ALL_QUESTIONS.forEach(q => { w += (scores[q.id] ?? 0) * q.weight; });
  return Math.round((w / MAX_WEIGHTED) * 100);
}

function scoreColor(pct) {
  if (pct >= 70) return "#059669";
  if (pct >= 45) return "#D97706";
  return "#DC2626";
}

const COLUMNS = [
  { id: "listing",  label: "Listing",        icon: "solar:bookmark-bold",  color: "#6B7280", accent: "#F3F4F6" },
  { id: "enquired", label: "Enquired",        icon: "solar:letter-bold",    color: "#7c73e6", accent: "#ffe9e3" },
  { id: "booked",   label: "Viewing Booked",  icon: "solar:calendar-bold",  color: "#2563EB", accent: "#DBEAFE" },
  { id: "viewed",   label: "Viewed",          icon: "solar:eye-bold",       color: "#D97706", accent: "#FEF3C7" },
];

// ─── BONUS PREFERENCES ────────────────────────────────────────────────────
const BONUSES = [
  { id: "low_charge",  label: "Low service charge",  icon: "solar:wallet-money-bold",  points: 3 },
  { id: "condition",   label: "Good condition",       icon: "solar:star-shine-bold",    points: 2 },
  { id: "furnished",   label: "Modern furnishings",   icon: "solar:palette-bold",       points: 2 },
  { id: "balcony",     label: "Balcony",              icon: "solar:city-bold",          points: 3 },
  { id: "water_view",  label: "Water views",          icon: "mdi:waves",                 points: 4 },
  { id: "light",       label: "Lots of light",        icon: "solar:sun-bold",           points: 2 },
];

function getBonusTotal(bonuses) {
  if (!bonuses) return 0;
  return BONUSES.filter(b => bonuses[b.id]).reduce((sum, b) => sum + b.points, 0);
}

function mergeProperties(local, remote) {
  const localMap = new Map(local.map(p => [p.id, p]));
  const remoteMap = new Map(remote.map(p => [p.id, p]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
  return [...allIds].map(id => {
    const l = localMap.get(id);
    const r = remoteMap.get(id);
    if (!l) return r;
    if (!r) return l;
    return (l.updatedAt || 0) >= (r.updatedAt || 0) ? l : r;
  });
}

// ─── SCORE DOTS ────────────────────────────────────────────────────────────
function ScoreDots({ value, onChange, anchors = {} }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
      {[1,2,3,4,5].map(n => {
        const selected = value === n;
        const filled = value >= n;
        const alwaysVisible = n === 1 || n === 3 || n === 5;
        const showLabel = alwaysVisible || hovered === n;
        return (
          <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
            <button
              onClick={() => onChange(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(null)}
              style={{
                width: 46, height: 46, borderRadius: "50%",
                border: selected ? "3px solid #7c73e6" : filled ? "2px solid #c4c1e0" : "2px solid #e0dff0",
                background: selected ? "#f0eff9" : filled ? "#f5f4fc" : "#FFFFFF",
                color: selected ? "#7c73e6" : filled ? "#9b95eb" : "#C4C1E0",
                fontSize: 18, fontWeight: 800, cursor: "pointer",
                transition: "all 0.15s ease",
                transform: selected ? "scale(1.15)" : hovered === n ? "scale(1.08)" : "scale(1)",
                boxShadow: selected ? "0 0 14px rgba(124,115,230,0.28)" : "none",
                fontFamily: "'Fraunces', serif",
                flexShrink: 0,
              }}>
              {n}
            </button>
            <div style={{
              fontSize: 10, color: "#A89DB0", textAlign: "center",
              marginTop: 7, lineHeight: 1.4,
              opacity: showLabel ? 1 : 0,
              transition: "opacity 0.15s",
              maxWidth: 80, minHeight: 32, paddingBottom: 4,
            }}>
              {anchors[n]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Bar({ value, max = 5 }) {
  const pct = (value / max) * 100;
  return (
    <div style={{ height: 4, borderRadius: 2, background: "#e0dff0", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: scoreColor(pct), borderRadius: 2, transition: "width 0.4s" }} />
    </div>
  );
}

function ProgressBar({ sectionIdx, total, completedSections, onJump }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {Array.from({ length: total }, (_, i) => {
        const done = completedSections[i];
        const active = i === sectionIdx;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < total - 1 ? 1 : "none" }}>
            <button
              onClick={() => onJump(i)}
              title={`Section ${i + 1}`}
              style={{
                width: active ? 10 : 8, height: active ? 10 : 8,
                borderRadius: "50%", flexShrink: 0, padding: 0, cursor: "pointer", border: "none",
                background: done ? "#7c73e6" : active ? "#9b95eb" : "#c4c1e0",
                boxShadow: active ? "0 0 0 2px #fff, 0 0 0 3px #7c73e6" : "none",
                transition: "all 0.2s",
              }}
            />
            {i < total - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? "#7c73e6" : "#e0dff0", transition: "background 0.3s", marginLeft: 2, marginRight: 2 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MAP EMBED ─────────────────────────────────────────────────────────────
function MapEmbed({ address }) {
  if (!address) return null;
  const encoded = encodeURIComponent(address);
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #e0dff0", height: 200, position: "relative", background: "#f5f3fc" }}>
      <iframe
        title="Property location"
        width="100%"
        height="100%"
        style={{ border: "none", display: "block" }}
        src={`https://maps.google.com/maps?q=${encoded}&output=embed&z=15`}
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}

// ─── PROPERTY OVERVIEW ─────────────────────────────────────────────────────
function PropertyOverview({ property, onStartScoring, onClose, onDelete, onMove, onEdit }) {
  const hasScore = property.scores && Object.keys(property.scores).length > 0;
  const total = getTotal(property.scores) + getBonusTotal(property.bonuses);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);

  function openPicker(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    setPickerPos({ top: rect.bottom + 6, left: rect.left });
    setPickerOpen(true);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 120,
      background: "#fafafa",
      backgroundImage: "radial-gradient(ellipse at 20% 0%, rgba(124,115,230,0.07) 0%, transparent 60%)",
      overflowY: "auto",
      animation: "fadeUp 0.25s ease"
    }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px 80px" }}>
        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 16px" }}>
          <button onClick={onClose} style={ghostBtnSt}>← Back to Board</button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {hasScore && (
              <div style={{ fontSize: 14, fontWeight: 800, color: scoreColor(total), fontFamily: "'Fraunces', serif" }}>
                Score: {total}/100
              </div>
            )}
            <button onClick={() => { setEditForm({ address: property.address || property.name || "", price: property.price || "", bedrooms: property.bedrooms || "", bathrooms: property.bathrooms || "", sqft: property.sqft || "", agent: property.agent || "", agentPhone: property.agentPhone || "", leaseLength: property.leaseLength || "", tenure: property.tenure || "", serviceCharge: property.serviceCharge ?? "", groundRent: property.groundRent ?? "", image: property.image || "", notes: property.notes || "" }); setEditing(true); }}
              style={{ background: "none", border: "1px solid #e0dff0", borderRadius: 8, color: "#7c73e6", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
              <Icon icon="solar:pen-bold" width={14} /> Edit
            </button>

            {onDelete && (
              <button onClick={() => { if (window.confirm("Delete this property?")) onDelete(property.id); }}
                style={{ background: "none", border: "1px solid #FECACA", borderRadius: 8, color: "#DC2626", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}
                title="Delete property"><Icon icon="solar:trash-bin-2-bold" width={16} /></button>
            )}
          </div>
        </div>

        {/* Hero image */}
        <div style={{ position: "relative", height: 260, borderRadius: 20, overflow: "hidden", marginBottom: 24, boxShadow: "0 12px 40px rgba(124,115,230,0.15)" }}>
          {property.image ? (
            <img src={property.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ height: "100%", background: "linear-gradient(135deg,#ffe9e3,#c4c1e0)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c4c1e0" }}><Icon icon="solar:home-2-bold" width={64} /></div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(28,20,39,0.9) 0%, rgba(28,20,39,0.2) 50%, transparent 100%)" }} />

          <div style={{ position: "absolute", top: 16, left: 16 }}>
            {(() => {
              const currentCol = COLUMNS.find(c => c.id === property.status);
              return (
                <button onClick={openPicker} style={{ background: "rgba(20,15,30,0.65)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#ffffff", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  <Icon icon={currentCol?.icon || "solar:bookmark-bold"} width={13} />
                  {currentCol?.label}
                  <Icon icon="solar:alt-arrow-down-bold" width={11} style={{ opacity: 0.7, marginLeft: 2 }} />
                </button>
              );
            })()}
          </div>

          {hasScore && (
            <div style={{ position: "absolute", top: 16, right: 16, width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: `2px solid ${scoreColor(total)}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: scoreColor(total), fontFamily: "'Fraunces', serif" }}>
              {total}
            </div>
          )}

          <div style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 800, lineHeight: 1.3, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
              {property.name}
            </div>
          </div>
        </div>

        {/* Column picker dropdown (fixed-position, rendered via portal-like pattern) */}
        {pickerOpen && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setPickerOpen(false)} />
            <div style={{ position: "fixed", top: pickerPos.top, left: pickerPos.left, zIndex: 999, background: "#FFFFFF", border: "1px solid #e0dff0", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", overflow: "hidden", minWidth: 200 }}>
              {COLUMNS.map((col, i) => {
                const active = property.status === col.id;
                return (
                  <button key={col.id} onClick={() => { onMove?.(property.id, col.id); setPickerOpen(false); }} style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "10px 14px",
                    background: active ? col.accent : "transparent",
                    border: "none",
                    borderBottom: "1px solid #f5f5f5",
                    color: active ? col.color : "#1C1427",
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    cursor: active ? "default" : "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    textAlign: "left"
                  }}>
                    <Icon icon={col.icon} width={16} style={{ color: col.color, flexShrink: 0 }} />
                    {col.label}
                    {active && <Icon icon="solar:check-circle-bold" width={14} style={{ marginLeft: "auto", color: col.color }} />}
                  </button>
                );
              })}
              <button onClick={() => { onMove?.(property.id, "archived"); setPickerOpen(false); }} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "10px 14px",
                background: property.status === "archived" ? "#f5f5f5" : "transparent",
                border: "none",
                color: "#A89DB0",
                fontSize: 13, fontWeight: 500,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                textAlign: "left"
              }}>
                <Icon icon="solar:archive-bold" width={16} style={{ color: "#C4BAC8", flexShrink: 0 }} />
                Archive
              </button>
            </div>
          </>
        )}

        {/* Price block — Rightmove-style: big number, qualifier below */}
        {property.price && (
          <div style={{ marginBottom: 20, padding: "20px 22px", background: "#FFFFFF", border: "1px solid #e0dff0", borderRadius: 14, boxShadow: "0 2px 8px rgba(124,115,230,0.06)" }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 38, fontWeight: 800, color: "#1C1427", lineHeight: 1, marginBottom: 6, letterSpacing: "-0.5px" }}>
              {property.price}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#A89DB0", textTransform: "uppercase", letterSpacing: 1.4 }}>
              {/pcm|pw|per month|per week/i.test(property.price) ? 'Monthly rent' : 'Asking price'}
            </div>
          </div>
        )}

        {/* Score CTA — only when viewed */}
        {property.status === "viewed" && (
          <div style={{ background: "#f5f3fc", border: "1px solid #c4c1e0", borderRadius: 18, padding: "20px 22px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ color: "#7c73e6", flexShrink: 0 }}><Icon icon="solar:pen-bold" width={28} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 700, color: "#1C1427", marginBottom: 3 }}>
                {hasScore ? "Update your scorecard" : "Ready to score this property?"}
              </div>
              <div style={{ fontSize: 13, color: "#6D6077", lineHeight: 1.4 }}>
                {hasScore ? `Current score: ${total}` : "Rate 6 categories + bonus points to compare properties"}
              </div>
            </div>
            <button onClick={onStartScoring} style={{
              flexShrink: 0, padding: "10px 18px",
              background: "linear-gradient(135deg,#9b95eb,#7c73e6)",
              border: "none", borderRadius: 11, color: "#FFFFFF",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: "0 4px 16px rgba(124,115,230,0.3)",
              whiteSpace: "nowrap"
            }}>
              {hasScore ? "Edit →" : "Start →"}
            </button>
          </div>
        )}

        {/* Key stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Bedrooms", value: property.bedrooms ? `${property.bedrooms} bed` : "—", icon: "solar:bed-bold" },
            { label: "Bathrooms", value: property.bathrooms ? `${property.bathrooms} bath` : "—", icon: "solar:bath-bold" },
            { label: "Size", value: property.sqft ? `${property.sqft} sq ft` : "—", icon: "solar:ruler-bold" },
          ].map(s => (
            <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #e0dff0", borderRadius: 12, padding: "14px 12px", textAlign: "center", boxShadow: "0 2px 8px rgba(124,115,230,0.06)" }}>
              <div style={{ marginBottom: 6, color: "#7c73e6", display: "flex", justifyContent: "center" }}><Icon icon={s.icon} width={22} /></div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 700, color: "#1C1427" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#A89DB0", marginTop: 2, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Description */}
        {property.description && (
          <div style={{ background: "#FFFFFF", border: "1px solid #e0dff0", borderRadius: 14, padding: "18px 18px", marginBottom: 16, boxShadow: "0 2px 8px rgba(124,115,230,0.06)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#A89DB0", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
              <Icon icon="solar:chat-round-dots-bold" width={13} /> About this property
            </div>
            <p style={{ fontSize: 13, color: "#6D6077", lineHeight: 1.7, margin: 0, whiteSpace: "pre-line" }}>{property.description}</p>
          </div>
        )}

        {/* Listing details */}
        {(property.url || property.agent || property.agentPhone || property.tenure || property.leaseLength || (property.serviceCharge != null && property.serviceCharge !== '') || property.groundRent === 0 || property.groundRent || property.dateListed) && (
          <div style={{ background: "#FFFFFF", border: "1px solid #e0dff0", borderRadius: 14, padding: "16px 18px", marginBottom: 20, boxShadow: "0 2px 8px rgba(124,115,230,0.06)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#A89DB0", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Listing Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {property.agent && <DetailRow icon="solar:buildings-bold" label="Agent" value={property.agent} />}
              {property.agentPhone && <DetailRow icon="solar:phone-bold" label="Phone" value={property.agentPhone} />}
              {property.tenure && <DetailRow icon="solar:document-text-bold" label="Tenure" value={property.tenure} />}
              {property.leaseLength && <DetailRow icon="solar:document-bold" label="Lease" value={property.leaseLength} />}
              {(property.serviceCharge != null && property.serviceCharge !== '') && (
                <DetailRow icon="solar:banknote-bold" label="Service charge"
                  value={typeof property.serviceCharge === 'number' ? `£${property.serviceCharge.toLocaleString()}/yr` : String(property.serviceCharge)} />
              )}
              {(property.groundRent === 0 || property.groundRent) && (
                <DetailRow icon="solar:banknote-bold" label="Ground rent"
                  value={property.groundRent === 0 ? 'Peppercorn' : typeof property.groundRent === 'number' ? `£${property.groundRent.toLocaleString()}/yr` : String(property.groundRent)} />
              )}
              {property.dateListed && <DetailRow icon="solar:calendar-bold" label="Listed" value={property.dateListed} />}
              {property.url && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: property.dateListed || property.groundRent !== undefined || property.serviceCharge !== null ? 4 : 0, borderTop: (property.agent || property.tenure || property.leaseLength || property.dateListed) ? "1px solid #f0eef8" : "none", marginTop: (property.agent || property.tenure || property.leaseLength || property.dateListed) ? 4 : 0 }}>
                  <span style={{ display: "flex", alignItems: "center", color: "#7c73e6", flexShrink: 0 }}><Icon icon="solar:link-bold" width={14} /></span>
                  <span style={{ fontSize: 12, color: "#A89DB0", width: 90, flexShrink: 0 }}>Original listing</span>
                  <a href={property.url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 13, color: "#7c73e6", fontWeight: 600, textDecoration: "none", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    View on {(() => { try { return new URL(property.url).hostname.replace(/^www\./, '') } catch { return 'listing site' } })()} ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes — always shown, inline editable */}
        {(() => {
          const [notesEditing, setNotesEditing] = useState(false);
          const [notesVal, setNotesVal] = useState(property.notes || "");
          return (
            <div style={{ background: "#FFFDF5", border: "1px solid #F5E6B0", borderRadius: 14, padding: "14px 16px", marginBottom: 16, boxShadow: "0 2px 8px rgba(200,170,0,0.06)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#B8960A", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <Icon icon="solar:notes-bold" width={13} /> My Notes
              </div>
              {notesEditing ? (
                <textarea
                  autoFocus
                  value={notesVal}
                  onChange={e => setNotesVal(e.target.value)}
                  onBlur={() => { onEdit?.({ notes: notesVal }); setNotesEditing(false); }}
                  rows={4}
                  placeholder="Add your notes here…"
                  style={{ width: "100%", fontSize: 13, color: "#5C4D00", lineHeight: 1.7, border: "none", background: "transparent", resize: "vertical", outline: "none", fontFamily: "'DM Sans', sans-serif" }}
                />
              ) : (
                <div onClick={() => setNotesEditing(true)} style={{ fontSize: 13, color: notesVal ? "#5C4D00" : "#C8A80A", lineHeight: 1.7, cursor: "text", minHeight: 24, whiteSpace: "pre-line" }}>
                  {notesVal || "Click to add notes…"}
                </div>
              )}
            </div>
          );
        })()}

        {/* Map */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#A89DB0", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><Icon icon="solar:map-point-bold" width={13} /> Location</div>
          <MapEmbed address={property.name || property.address} />
          {property.name && (
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(property.name)}`}
              target="_blank" rel="noreferrer"
              style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 12, color: "#7c73e6", textDecoration: "none" }}
            >
              Open in Google Maps ↗
            </a>
          )}
        </div>

      </div>

      {/* Edit overlay */}
      {editing && editForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(124,115,230,0.18)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeUp 0.2s ease" }}
          onClick={e => e.target === e.currentTarget && setEditing(false)}>
          <div style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", background: "#FFFFFF", border: "1px solid #c4c1e0", borderRadius: 20, padding: 28, boxShadow: "0 24px 60px rgba(124,115,230,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 800, color: "#1C1427" }}>Edit Details</h2>
              <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: "#A89DB0", cursor: "pointer", display: "flex" }}><Icon icon="solar:close-circle-bold" width={24} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={labelSt}>Address</label><input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} style={inputSt} /></div>
              <div><label style={labelSt}>Price</label><input value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} style={inputSt} placeholder="e.g. £450,000 or £2,500 pcm" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div><label style={labelSt}>Bedrooms</label><input value={editForm.bedrooms} onChange={e => setEditForm(f => ({ ...f, bedrooms: e.target.value }))} style={inputSt} /></div>
                <div><label style={labelSt}>Bathrooms</label><input value={editForm.bathrooms} onChange={e => setEditForm(f => ({ ...f, bathrooms: e.target.value }))} style={inputSt} /></div>
                <div><label style={labelSt}>Sq ft</label><input value={editForm.sqft} onChange={e => setEditForm(f => ({ ...f, sqft: e.target.value }))} style={inputSt} /></div>
              </div>
              <div><label style={labelSt}>Estate Agent</label><input value={editForm.agent} onChange={e => setEditForm(f => ({ ...f, agent: e.target.value }))} style={inputSt} /></div>
              <div><label style={labelSt}>Agent Phone</label><input value={editForm.agentPhone} onChange={e => setEditForm(f => ({ ...f, agentPhone: e.target.value }))} style={inputSt} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={labelSt}>Tenure</label><input value={editForm.tenure} onChange={e => setEditForm(f => ({ ...f, tenure: e.target.value }))} style={inputSt} placeholder="Leasehold / Freehold" /></div>
                <div><label style={labelSt}>Lease Length</label><input value={editForm.leaseLength} onChange={e => setEditForm(f => ({ ...f, leaseLength: e.target.value }))} style={inputSt} placeholder="e.g. 125 years" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={labelSt}>Service Charge /yr</label><input type="number" value={editForm.serviceCharge} onChange={e => setEditForm(f => ({ ...f, serviceCharge: e.target.value === "" ? null : Number(e.target.value) }))} style={inputSt} placeholder="e.g. 2400" /></div>
                <div><label style={labelSt}>Ground Rent /yr</label><input type="number" value={editForm.groundRent} onChange={e => setEditForm(f => ({ ...f, groundRent: e.target.value === "" ? null : Number(e.target.value) }))} style={inputSt} placeholder="0 = Peppercorn" /></div>
              </div>
              <div><label style={labelSt}>Image URL</label><input value={editForm.image} onChange={e => setEditForm(f => ({ ...f, image: e.target.value }))} style={inputSt} placeholder="https://..." /></div>
              <div><label style={labelSt}>Notes</label><textarea value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={4} placeholder="Add your notes here…" style={{ ...inputSt, resize: "vertical", height: "auto" }} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: "12px", background: "#f5f3fc", border: "1px solid #c4c1e0", borderRadius: 11, color: "#6D6077", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              <button onClick={() => { onEdit?.({ ...editForm, name: editForm.address || property.name }); setEditing(false); }} style={{ flex: 2, padding: "12px", background: "linear-gradient(135deg,#9b95eb,#7c73e6)", border: "none", borderRadius: 11, color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 16px rgba(124,115,230,0.3)" }}>
                Save Changes ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, marginTop: 2, color: "#A89DB0", display: "flex" }}>
        <Icon icon={icon} width={16} />
      </span>
      <span style={{ fontSize: 12, color: "#A89DB0", width: 90, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#6D6077", flex: 1 }}>{value}</span>
    </div>
  );
}

// ─── CONTEXT HINT ──────────────────────────────────────────────────────────
function ContextPill({ hint }) {
  if (!hint) return null;
  return (
    <p style={{ fontSize: 12, color: "#A89DB0", lineHeight: 1.55, margin: "0 0 14px", fontStyle: "normal" }}>{hint}</p>
  );
}

// ─── SCORING WIZARD ─────────────────────────────────────────────────────────
function ScoringWizard({ property, onClose, onSave }) {
  const [sectionIdx, setSectionIdx] = useState(0);
  const [scores, setScores] = useState(property.scores || {});
  const [bonuses, setBonuses] = useState(property.bonuses || {});
  const scrollRef = useRef(null);
  const section = SECTIONS[sectionIdx];
  const isLastSection = sectionIdx === SECTIONS.length - 1;
  const answeredInSection = section.questions.filter(q => scores[q.id] !== undefined).length;
  const sectionComplete = answeredInSection === section.questions.length;
  const runningTotal = getTotal(scores);
  const bonusTotal = getBonusTotal(bonuses);
  const combinedTotal = Math.min(runningTotal + bonusTotal, 110);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [sectionIdx]);

  function next() {
    if (sectionIdx < SECTIONS.length - 1) setSectionIdx(s => s + 1);
  }

  function save() {
    onSave({ ...property, scores, bonuses });
    onClose();
  }

  function goBack() {
    if (sectionIdx > 0) setSectionIdx(s => s - 1);
    else onClose();
  }

  const completedSections = SECTIONS.map(s => s.questions.every(q => scores[q.id] !== undefined));

  return (
    <div ref={scrollRef} style={{
      position: "fixed", inset: 0, zIndex: 130,
      background: "#fafafa",
      backgroundImage: "radial-gradient(ellipse at 80% 100%, rgba(124,115,230,0.06) 0%, transparent 55%)",
      overflowY: "auto",
      animation: "slideIn 0.28s ease"
    }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: "0 20px 80px" }}>
        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 12px", position: "sticky", top: 0, background: "rgba(250,250,250,0.95)", backdropFilter: "blur(10px)", zIndex: 10, marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20, borderBottom: "1px solid #e0dff0" }}>
          <button onClick={goBack} style={ghostBtnSt}>
            ← {sectionIdx === 0 ? "Overview" : "Back"}
          </button>
          <div style={{ flex: 1, padding: "0 16px" }}>
            <ProgressBar sectionIdx={sectionIdx} total={SECTIONS.length} completedSections={completedSections} onJump={setSectionIdx} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: Object.keys(scores).length > 0 ? scoreColor(runningTotal) : "#B0A8BC", fontFamily: "'Fraunces', serif", minWidth: 40, textAlign: "right" }}>
            {Object.keys(scores).length > 0 ? `${runningTotal}/100` : "—"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#C4C1E0", display: "flex", alignItems: "center", paddingLeft: 12 }} title="Exit scoring">
            <Icon icon="solar:close-square-bold" width={20} />
          </button>
        </div>

        {/* Property mini-header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0 20px" }}>
          {property.image && (
            <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: "1px solid #e0dff0" }}>
              <img src={property.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1C1427" }}>{property.name}</div>
            {property.price && <div style={{ fontSize: 12, color: "#7c73e6", fontWeight: 600, marginTop: 1 }}>{property.price}</div>}
          </div>
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#A89DB0", flexShrink: 0 }}>
            {sectionIdx + 1}/{SECTIONS.length}
          </div>
        </div>

        {/* Section header */}
        <div style={{ marginBottom: 22, animation: "fadeUp 0.25s ease" }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 800, lineHeight: 1.2, color: "#1C1427", display: "flex", alignItems: "center", gap: 10 }}>
            <Icon icon={section.icon} width={28} style={{ color: "#7c73e6", flexShrink: 0 }} />
            {section.title}
          </h2>
          <p style={{ color: "#6D6077", fontSize: 14, marginTop: 5 }}>{section.subtitle}</p>
        </div>

        {/* Questions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {section.questions.map((q, qi) => {
            const val = scores[q.id] ?? 0;
            const answered = scores[q.id] !== undefined;
            const hint = q.contextHint ? q.contextHint(property) : null;
            const isFirst = qi === 0;
            const locked = qi > 0 && scores[section.questions[qi - 1].id] === undefined;
            return (
              <div key={q.id} style={{
                background: answered ? "#FFFFFF" : locked ? "#fafafa" : "#fcfcfe",
                border: `1px solid ${answered ? "#c4c1e0" : "#e0dff0"}`,
                borderRadius: 18,
                padding: isFirst ? "24px 24px 28px" : "18px 18px 22px",
                animation: `fadeUp 0.3s ease ${qi * 0.07}s both`,
                transition: "border-color 0.2s, background 0.2s, opacity 0.25s",
                boxShadow: answered ? "0 4px 16px rgba(124,115,230,0.08)" : "none",
                opacity: locked ? 0.42 : 1,
                pointerEvents: locked ? "none" : "auto",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: isFirst ? 18 : 15, lineHeight: 1.3, flex: 1, color: "#1C1427" }}>{q.label}</div>
                  {answered && (
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#7c73e6", marginLeft: 12, whiteSpace: "nowrap", fontFamily: "'Fraunces', serif" }}>
                      {val}/5
                    </div>
                  )}
                </div>
                <ContextPill hint={hint} />
                <ScoreDots value={val} onChange={v => setScores(prev => ({ ...prev, [q.id]: v }))} anchors={q.anchors} />
              </div>
            );
          })}
        </div>

        {/* Inline bonus toggles — last section only */}
        {isLastSection && (
          <div style={{ marginTop: 28, animation: "fadeUp 0.3s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: "#e0dff0" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#A89DB0", textTransform: "uppercase", letterSpacing: 1.5, whiteSpace: "nowrap" }}>Deal-makers</span>
              <div style={{ flex: 1, height: 1, background: "#e0dff0" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {BONUSES.map(b => {
                const active = !!bonuses[b.id];
                return (
                  <button key={b.id} onClick={() => setBonuses(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      width: "100%", padding: "13px 16px",
                      background: active ? "#f0eff9" : "#FFFFFF",
                      border: `1px solid ${active ? "#7c73e6" : "#e0dff0"}`,
                      borderRadius: 12, cursor: "pointer",
                      transition: "all 0.15s",
                      boxShadow: active ? "0 2px 10px rgba(124,115,230,0.12)" : "none",
                      fontFamily: "'DM Sans', sans-serif", textAlign: "left",
                    }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: active ? "#7c73e6" : "#f5f3fc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                      <Icon icon={b.icon} width={16} style={{ color: active ? "#FFFFFF" : "#9b95eb" }} />
                    </div>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: active ? "#1C1427" : "#6D6077" }}>{b.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: active ? "#7c73e6" : "#C4C1E0", fontFamily: "'Fraunces', serif", flexShrink: 0 }}>+{b.points}</div>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${active ? "#7c73e6" : "#e0dff0"}`, background: active ? "#7c73e6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                      {active && <Icon icon="solar:check-bold" width={10} style={{ color: "#FFFFFF" }} />}
                    </div>
                  </button>
                );
              })}
            </div>
            {bonusTotal > 0 && (
              <div style={{ marginTop: 12, padding: "12px 16px", background: "#f0eff9", border: "1px solid #c4c1e0", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", animation: "fadeUp 0.2s ease" }}>
                <span style={{ fontSize: 13, color: "#6b62d5", fontWeight: 600 }}>Base {runningTotal} + {bonusTotal} bonus</span>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 800, color: scoreColor(combinedTotal) }}>{combinedTotal}</span>
              </div>
            )}
          </div>
        )}

        {/* Section complete (non-last sections) */}
        {sectionComplete && !isLastSection && (
          <div style={{ marginTop: 16, padding: "14px 16px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, animation: "fadeUp 0.2s ease" }}>
            <Icon icon="solar:check-circle-bold" width={20} style={{ color: "#059669", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>Section complete</div>
              <div style={{ fontSize: 12, color: "#6D6077" }}>Up next: {SECTIONS[sectionIdx + 1].title}</div>
            </div>
          </div>
        )}

        {/* Next / Save button */}
        <div style={{ marginTop: 20 }}>
          <button
            onClick={isLastSection ? save : next}
            disabled={!sectionComplete}
            style={{
              width: "100%", padding: "16px",
              background: sectionComplete ? "linear-gradient(135deg,#9b95eb,#7c73e6)" : "#f0eff9",
              color: sectionComplete ? "#FFFFFF" : "#B0A8BC",
              border: "none", borderRadius: 13, fontSize: 15, fontWeight: 700,
              cursor: sectionComplete ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: sectionComplete ? "0 4px 20px rgba(124,115,230,0.3)" : "none",
              transition: "all 0.2s"
            }}
          >
            {isLastSection ? "Save Scorecard →" : `Next: ${SECTIONS[sectionIdx + 1].title} →`}
          </button>
          {!sectionComplete && (
            <div style={{ textAlign: "center", fontSize: 12, color: "#A89DB0", marginTop: 8 }}>
              Answer all {section.questions.length} questions to continue
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PROPERTY CARD (kanban tile) ────────────────────────────────────────────
function PropertyCard({ property, onOpen, onDelete, onMove, onUpdate }) {
  const total = getTotal(property.scores) + getBonusTotal(property.bonuses);
  const hasScore = property.scores && Object.keys(property.scores).length > 0;
  const col = COLUMNS.find(c => c.id === property.status);
  const [editingDate, setEditingDate] = useState(false);
  const [dateVal, setDateVal] = useState('');
  const [timeVal, setTimeVal] = useState('');

  function startEditDate(e) {
    e.stopPropagation();
    const [d, t] = (property.viewingDate || 'T').split('T');
    setDateVal(d || '');
    setTimeVal(t || '');
    setEditingDate(true);
  }

  function saveDate(e) {
    e.stopPropagation();
    onUpdate(property.id, { viewingDate: dateVal ? `${dateVal}T${timeVal || '00:00'}` : null, updatedAt: Date.now() });
    setEditingDate(false);
  }

  return (
    <div
      onClick={() => onOpen(property)}
      style={{
        background: "#FFFFFF",
        border: "1px solid #e0dff0",
        borderRadius: 14, overflow: "hidden",
        cursor: "pointer", transition: "transform 0.18s, box-shadow 0.18s",
        animation: "fadeUp 0.3s ease both",
        boxShadow: "0 2px 8px rgba(124,115,230,0.06)"
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 28px rgba(124,115,230,0.14)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 8px rgba(124,115,230,0.06)"; }}
    >
      {/* Image */}
      <div style={{ position: "relative", height: 140, background: "#ffe9e3", overflow: "hidden" }}>
        {property.image ? (
          <img src={property.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#a8a5d8" }}><Icon icon="solar:home-2-bold" width={44} /></div>
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(28,20,39,0.75) 0%, transparent 55%)" }} />

        {hasScore && (
          <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.92)", border: `2px solid ${scoreColor(total)}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 800, color: scoreColor(total),
              fontFamily: "'Fraunces', serif"
            }}>{total}</div>
            {(() => {
              const activeBonuses = BONUSES.filter(b => property.bonuses?.[b.id]).sort((a, b) => b.points - a.points).slice(0, 3);
              return activeBonuses.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {activeBonuses.map(b => (
                    <div key={b.id} style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.88)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon icon={b.icon} width={12} style={{ color: "#7c73e6" }} />
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
          </div>
        )}

        {property.status === "booked" && property.viewingDate && (
          <div style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(219,234,254,0.92)", border: "1px solid rgba(37,99,235,0.4)",
            borderRadius: 7, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#2563EB",
            display: "flex", alignItems: "center", gap: 4
          }}>
            <Icon icon="solar:calendar-bold" width={12} /> {new Date(property.viewingDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </div>
        )}

        {property.status === "viewed" && !hasScore && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "rgba(124,115,230,0.88)", backdropFilter: "blur(4px)",
            padding: "6px 12px", fontSize: 11, fontWeight: 700, color: "#FFFFFF",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5, letterSpacing: 0.5
          }}>
            <Icon icon="solar:pen-bold" width={13} /> Tap to score
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "11px 13px 13px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: "#1C1427", minWidth: 0 }}>
            {property.name}
          </div>
          {onDelete && (
            <button onClick={e => { e.stopPropagation(); if (window.confirm("Delete this property?")) onDelete(property.id); }}
              style={{ background: "none", border: "none", color: "#C4BCCC", cursor: "pointer", padding: "0 2px", flexShrink: 0, display: "flex", alignItems: "center" }}
              title="Delete"><Icon icon="solar:trash-bin-2-bold" width={15} /></button>
          )}
        </div>
        {property.price && (
          <div style={{ fontSize: 12, color: "#7c73e6", fontWeight: 600, marginBottom: 5 }}>{property.price}</div>
        )}
        {(property.bedrooms || property.sqft) && (
          <div style={{ fontSize: 11, color: "#A89DB0" }}>
            {property.bedrooms && `${property.bedrooms} bed`}
            {property.bathrooms && ` · ${property.bathrooms} bath`}
            {property.sqft && ` · ${property.sqft} sqft`}
          </div>
        )}
        {/* Move to column */}
        <div style={{ display: "flex", gap: 4, marginTop: 9, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
          <span style={{ fontSize: 10, fontWeight: 700, color: col?.color, background: col?.accent, border: `1px solid ${col?.color}44`, borderRadius: 5, padding: "2px 7px", letterSpacing: 0.8, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon icon={col?.icon || "solar:bookmark-bold"} width={11} /> {col?.label}
          </span>
          {COLUMNS.filter(c => c.id !== property.status).map(c => (
            <button key={c.id} onClick={e => { e.stopPropagation(); onMove?.(property.id, c.id); }}
              style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "none", border: `1px solid #e0dff0`, color: "#A89DB0", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              → {c.label}
            </button>
          ))}
          <button onClick={e => { e.stopPropagation(); onMove?.(property.id, "archived"); }}
            style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "none", border: `1px solid #e0dff0`, color: "#C4BAC8", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            Archive
          </button>
        </div>

        {/* Viewing date entry — booked column only */}
        {property.status === "booked" && (
          <div style={{ borderTop: "1px solid #f0eef8", padding: "8px 13px" }} onClick={e => e.stopPropagation()}>
            {editingDate ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)}
                  style={{ flex: 1, fontSize: 11, padding: "4px 7px", borderRadius: 6, border: "1px solid #c4c1e0", outline: "none", fontFamily: "'DM Sans', sans-serif" }} />
                <input type="time" value={timeVal} onChange={e => setTimeVal(e.target.value)}
                  style={{ width: 72, fontSize: 11, padding: "4px 7px", borderRadius: 6, border: "1px solid #c4c1e0", outline: "none", fontFamily: "'DM Sans', sans-serif" }} />
                <button onClick={saveDate}
                  style={{ background: "#7c73e6", border: "none", borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 8px", cursor: "pointer" }}>✓</button>
                <button onClick={e => { e.stopPropagation(); setEditingDate(false); }}
                  style={{ background: "none", border: "1px solid #e0dff0", borderRadius: 6, color: "#A89DB0", fontSize: 11, padding: "4px 8px", cursor: "pointer" }}>✕</button>
              </div>
            ) : (
              <button onClick={startEditDate} style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 600,
                color: property.viewingDate ? "#2563EB" : "#A89DB0",
              }}>
                <Icon icon="solar:calendar-bold" width={13} />
                {property.viewingDate
                  ? new Date(property.viewingDate).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                  : "Set viewing date"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ADD PROPERTY MODAL ─────────────────────────────────────────────────────
function AddModal({ onClose, onAdd }) {
  const [step, setStep] = useState("url");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("listing");
  const [viewingDate, setViewingDate] = useState("");
  const [viewingTime, setViewingTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [error, setError] = useState("");

  async function extractUrl() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      // Strategy 1: server-side scraper — no CORS, handles all major portals
      try {
        const scrapeRes = await fetch(`/api/scrape?url=${encodeURIComponent(url.trim())}`);
        if (scrapeRes.ok) {
          const resp = await scrapeRes.json();
          if (resp.ok && resp.data) {
            const d = resp.data;
            const num = d.price || 0;
            const priceStr = num ? `£${num.toLocaleString()}${d.priceType === 'rent' ? ' pcm' : ''}` : '';
            // For portals (Rightmove, Zoopla, OTM) address+price is enough — parsers are comprehensive.
            // For direct agency sites, also require bedrooms+description to avoid showing a half-empty card.
            const isPortal = /rightmove\.co\.uk|zoopla\.co\.uk|onthemarket\.com/i.test(url.trim())
            const scrapeIsComplete = d.address && priceStr && (isPortal || (d.bedrooms && d.description))
            if (scrapeIsComplete) {
              const ext = {
                address: d.address,
                name: d.address,
                price: priceStr,
                bedrooms: d.bedrooms || '',
                bathrooms: d.bathrooms || '',
                sqft: d.sqft || '',
                image: d.imageUrl || '',
                agent: d.estateAgent || '',
                agentPhone: d.agentContact || '',
                serviceCharge: d.serviceCharge ?? null,
                groundRent: d.groundRent ?? null,
                leaseLength: d.leaseLength || '',
                tenure: d.tenure || '',
                description: d.description || '',
                epcRating: d.epcRating || '',
                dateListed: '',
              };
              setExtracted(ext);
              setStep("confirm");
              return;
            }
          }
        }
      } catch {}

      // Strategy 2: allorigins.win proxy + AI fallback
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url.trim())}`;
      const pageRes = await fetch(proxyUrl);
      if (!pageRes.ok) throw new Error("Failed to fetch listing page");
      const html = await pageRes.text();

      const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
        .map(m => m[1].replace(/<[^>]+>/g, "").trim()).filter(t => t.length > 4 && t.length < 200);
      const ogTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i))?.[1] || "";
      const titleHints = [...new Set([ogTitle, ...h1Matches])].filter(Boolean).slice(0, 4).join(" | ");

      // Strip scripts/styles, then take start (meta tags) + end (property content lives there for CSR sites)
      const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
      const trimmed = stripped.length > 22000
        ? stripped.slice(0, 4000) + "\n[...]\n" + stripped.slice(-16000)
        : stripped;

      const aiRes = await fetch("https://models.inference.ai.azure.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_GITHUB_TOKEN}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 1200,
          messages: [{
            role: "user",
            content: `Extract property listing details from this HTML. Page title/H1 hints: "${titleHints}". Use these to find the property address. Return ONLY a raw JSON object — no markdown, no backticks, no explanation. Use this exact structure:
{
  "name": "short display name from the H1/title: street name + area + postcode district ONLY e.g. 'Millennium Drive, London, E14' — NO house number, NO full postcode, NO agent name",
  "address": "full street address including house number e.g. '42 Brunswick Court, Shoreditch, London, E1 6RF'",
  "price": "asking price as shown e.g. '£450,000' or '£2,500 pcm'",
  "bedrooms": "number only e.g. '2'",
  "bathrooms": "number only e.g. '1'",
  "sqft": "square footage number only if listed e.g. '750'",
  "image": "the direct URL of the main hero/first photo of the property",
  "agent": "the specific estate agency or branch marketing this property (e.g. 'Hurford Salvi Carr', 'Knight Frank Chelsea') — NOT the property portal or website name, so never 'Rightmove', 'Zoopla', 'OnTheMarket' etc.",
  "agentPhone": "the estate agent's contact phone number if shown",
  "serviceCharge": "annual service charge amount if listed e.g. '£2,400'",
  "groundRent": "ground rent amount if listed e.g. '£250/yr' or 'Peppercorn'",
  "leaseLength": "lease length remaining if listed e.g. '125 years'",
  "tenure": "property tenure type if shown e.g. 'Leasehold' or 'Freehold'",
  "dateListed": "date the property was first listed or added e.g. 'Added 12 Mar 2024'",
  "description": "the full property description text as shown in the listing — copy it verbatim, do not summarise"
}

HTML:
${trimmed}`
          }]
        })
      });
      const data = await aiRes.json();
      const text = data.choices?.[0]?.message?.content || "";
      let ext = {};
      try {
        const cleaned = text.replace(/```json|```/g, "").trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) ext = JSON.parse(match[0]);
      } catch (e) {}

      if (!ext.image) {
        const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (ogImage?.[1]) ext.image = ogImage[1];
      }

      // ── Direct pattern extraction from visible page text ──────────────────
      // Works for CSR/SSR sites (Chestertons, Homeflow, etc.) that render
      // structured "Key : Value" property details in the HTML body.
      const visibleText = stripped.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ");

      // Structured "Key : Value" fields — regex beats AI for these (authoritative from the page)
      const tenureM = visibleText.match(/\bTenure\s*:\s*(Leasehold|Freehold|Share\s+of\s+Freehold)\b/i);
      if (tenureM) ext.tenure = tenureM[1].charAt(0).toUpperCase() + tenureM[1].slice(1).toLowerCase();

      const leaseM = visibleText.match(/Length\s+of\s+Lease\s*:\s*(\d+)\s*years?/i)
        || visibleText.match(/Lease\s+(?:Length|Remaining)\s*:\s*(\d+)\s*years?/i)
        || visibleText.match(/(\d{2,4})\s+years?\s+(?:remaining|left|unexpired)/i);
      if (leaseM) ext.leaseLength = `${leaseM[1]} years remaining`;

      const scM = visibleText.match(/(?:Annual\s+)?Service\s+Charge\s*[:|]\s*£([\d,.]+)/i)
        || visibleText.match(/Maintenance\s+(?:Charge|Fee)\s*[:|]\s*£([\d,.]+)/i);
      if (scM) ext.serviceCharge = parseInt(scM[1].replace(/,/g, ""));

      const grM = visibleText.match(/Ground\s+Rent\s*[:|]\s*£([\d,.]+)/i);
      if (grM) ext.groundRent = parseInt(grM[1].replace(/,/g, ""));
      else if (/Ground\s+Rent\s*[:|]\s*(?:Peppercorn|Nil|None|£\s*0\b)/i.test(visibleText)) ext.groundRent = 0;
      if (!ext.sqft) {
        const m = visibleText.match(/(\d[\d,]{1,5})\s*(?:sq\.?\s*ft|sqft|square\s*feet)/i)
          || visibleText.match(/(\d[\d,]{1,5})\s*sq\.?\s*m(?:etres?)?\b/i);
        if (m) {
          const val = parseInt(m[1].replace(/,/g, ""));
          ext.sqft = /sq\.?\s*m|sqm/i.test(m[0]) ? String(Math.round(val * 10.764)) : String(val);
        }
      }
      if (!ext.agentPhone) {
        const m = visibleText.match(/(?:0\d{4}\s?\d{6}|0\d{3}\s?\d{3}\s?\d{4}|\+44\s?\d[\d\s]{9,12})/);
        if (m) ext.agentPhone = m[0].replace(/\s+/g, " ").trim();
      }
      // Description — try multiple patterns in priority order
      if (!ext.description) {
        // Pattern 1: Homeflow/Chestertons — full description sits between "EPC" tab and "Contact Us"
        const descHomeflow = visibleText.match(/\bEPC\b(.{80,}?)(?:Contact\s+Us\b|Send\s+an\s+enquiry\b|Book\s+a\s+viewing\b|Arrange\s+a\s+viewing\b)/i);
        if (descHomeflow) {
          ext.description = descHomeflow[1].trim();
        } else {
          // Pattern 2: intro block before structured property details (e.g. "Back to results ... Property Details")
          const descIntro = visibleText.match(/Back\s+to\s+results(.{50,}?)(?:Property\s+Details\b|Floorplan\b|Council\s+Tax\b)/i);
          if (descIntro) {
            ext.description = descIntro[1].trim();
          } else {
            // Pattern 3: any large prose block starting with a capital sentence (generic fallback)
            const descGeneric = visibleText.match(/(?:^|(?<=\.\s))([A-Z][^.]{40,}(?:\.[^.]{20,}){3,}\.)/);
            if (descGeneric && descGeneric[1].length > 150) ext.description = descGeneric[1].trim();
          }
        }
      }
      // OG title as address/price fallback for CSR sites (e.g. "2 bed flat, SE1 – £450,000 | Agent")
      if (!ext.address && ogTitle) {
        const stripped_title = ogTitle.replace(/\s*\|\s*.+$/, "").replace(/\s*[-–]\s*£[\d,]+\s*(?:pcm|pw)?/i, "").trim();
        if (stripped_title.length > 4) ext.address = stripped_title;
      }
      if (!ext.price && ogTitle) {
        const pm = ogTitle.match(/£([\d,]+)(?:\s*(pcm|pw|per\s*month|per\s*week))?/i);
        if (pm) ext.price = `£${pm[1]}${pm[2] ? " pcm" : ""}`;
      }
      if (!ext.bedrooms && ogTitle) {
        const bm = ogTitle.match(/(\d+)\s*bed/i);
        if (bm) ext.bedrooms = bm[1];
      }

      if (!ext.name || ext.name.length < 4) {
        ext.name = ext.address || h1Matches[0] || ogTitle || "";
      }

      // Rightmove: override with reliable data from embedded PAGE_MODEL JSON
      if (url.includes('rightmove.co.uk')) {
        const rmScope = html.slice(Math.max(0, html.indexOf('window.PAGE_MODEL')));
        const brand = rmScope.match(/"brandTradingName":"([^"]+)"/);
        if (brand) ext.agent = brand[1];
        const phone = rmScope.match(/"telephone":"([^"]+)"/);
        if (phone) ext.agentPhone = phone[1];
        const beds = rmScope.match(/"bedrooms":(\d+)/);
        if (beds) ext.bedrooms = beds[1];
        const baths = rmScope.match(/"bathrooms":(\d+)/);
        if (baths) ext.bathrooms = baths[1];
        // Floor area: try sq ft first, then convert sq m (handle either key order)
        const sqftM = rmScope.match(/"value"\s*:\s*(\d+(?:\.\d+)?)\s*,\s*"unit"\s*:\s*"sqFeet"/)
                   || rmScope.match(/"unit"\s*:\s*"sqFeet"\s*,\s*"value"\s*:\s*(\d+(?:\.\d+)?)/);
        const sqmM  = rmScope.match(/"value"\s*:\s*(\d+(?:\.\d+)?)\s*,\s*"unit"\s*:\s*"sqMetres"/)
                   || rmScope.match(/"unit"\s*:\s*"sqMetres"\s*,\s*"value"\s*:\s*(\d+(?:\.\d+)?)/);
        if (sqftM) ext.sqft = String(Math.round(parseFloat(sqftM[1])));
        else if (sqmM) ext.sqft = String(Math.round(parseFloat(sqmM[1]) * 10.764));
        const priceM = rmScope.match(/"primaryPrice":"([^"]+)"/);
        if (priceM) ext.price = priceM[1];
        const tenureM = rmScope.match(/"tenureType":"([^"]+)"/);
        if (tenureM) ext.tenure = tenureM[1].charAt(0).toUpperCase() + tenureM[1].slice(1).toLowerCase();
        const dateM = rmScope.match(/"firstVisibleDate":"([^"]+)"/) || rmScope.match(/"addedOrReduced":"([^"]+)"/);
        if (dateM) ext.dateListed = dateM[1];
        // Full description from propertyData.text.description
        const textIdx = rmScope.indexOf('"text":{');
        if (textIdx > -1) {
          const textSlice = rmScope.slice(textIdx, textIdx + 12000);
          const descM = textSlice.match(/"description":"((?:[^"\\]|\\.)*)"/);
          if (descM) ext.description = descM[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'").trim();
        }
        // First Rightmove media image
        if (!ext.image) {
          const imgM = rmScope.match(/"url":"(https:\/\/media\.rightmove\.co\.uk[^"]+)"/);
          if (imgM) ext.image = imgM[1].replace(/_\d+x\d+/, '_max_800x600');
        }
      }

      setExtracted(ext);
      setStep("confirm");
    } catch (e) {
      setError("Couldn't extract property details. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    const viewingDateTime = (status === "booked" && viewingDate && viewingTime) ? `${viewingDate}T${viewingTime}` : null;
    onAdd({ id: Date.now(), url: url.trim(), status, viewingDate: viewingDateTime, scores: {}, ...extracted });
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(124,115,230,0.18)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeUp 0.2s ease" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", background: "#FFFFFF", border: "1px solid #c4c1e0", borderRadius: 20, padding: 28, boxShadow: "0 24px 60px rgba(124,115,230,0.2)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 800, color: "#1C1427" }}>
            {step === "url" ? "Add a Property" : "Confirm Details"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#A89DB0", cursor: "pointer", display: "flex" }}><Icon icon="solar:close-circle-bold" width={24} /></button>
        </div>

        {step === "url" && (
          <>
            <label style={labelSt}>Listing URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && extractUrl()}
              placeholder="https://www.rightmove.co.uk/properties/..."
              style={inputSt} disabled={loading} autoFocus />
            {error && <div style={{ color: "#DC2626", fontSize: 13, marginTop: 8 }}>{error}</div>}
            <button onClick={extractUrl} disabled={loading || !url.trim()} style={{
              width: "100%", marginTop: 16, padding: "14px",
              background: loading || !url.trim() ? "#f0eff9" : "linear-gradient(135deg,#9b95eb,#7c73e6)",
              color: loading || !url.trim() ? "#B0A8BC" : "#FFFFFF",
              border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
              cursor: loading || !url.trim() ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif",
              boxShadow: loading || !url.trim() ? "none" : "0 4px 16px rgba(124,115,230,0.3)"
            }}>
              {loading ? "⏳ Extracting details..." : "Extract Details →"}
            </button>
            <button onClick={() => { setExtracted({ address: "", name: "", price: "", bedrooms: "", bathrooms: "", sqft: "", image: "", agent: "", agentPhone: "", serviceCharge: null, groundRent: null, leaseLength: "", tenure: "", description: "", epcRating: "", dateListed: "" }); setStep("confirm"); }}
              style={{ width: "100%", marginTop: 10, padding: "11px", background: "none", border: "1px solid #e0dff0", borderRadius: 12, color: "#A89DB0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Enter details manually →
            </button>
          </>
        )}

        {step === "confirm" && extracted && (
          <>
            {extracted.image && (
              <div style={{ position: "relative", height: 140, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                <img src={extracted.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(28,20,39,0.7) 0%, transparent 55%)" }} />
              </div>
            )}

            {/* Editable fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={labelSt}>Address</label>
                <input value={extracted.address || extracted.name || ""} onChange={e => setExtracted(x => ({ ...x, address: e.target.value, name: e.target.value }))} style={inputSt} placeholder="e.g. 12 Elm Street, London, E1 4AB" />
              </div>
              <div>
                <label style={labelSt}>Price</label>
                <input value={extracted.price || ""} onChange={e => setExtracted(x => ({ ...x, price: e.target.value }))} style={inputSt} placeholder="e.g. £450,000 or £2,500 pcm" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div><label style={labelSt}>Bedrooms</label><input value={extracted.bedrooms || ""} onChange={e => setExtracted(x => ({ ...x, bedrooms: e.target.value }))} style={inputSt} placeholder="e.g. 2" /></div>
                <div><label style={labelSt}>Bathrooms</label><input value={extracted.bathrooms || ""} onChange={e => setExtracted(x => ({ ...x, bathrooms: e.target.value }))} style={inputSt} placeholder="e.g. 1" /></div>
                <div><label style={labelSt}>Sq ft</label><input value={extracted.sqft || ""} onChange={e => setExtracted(x => ({ ...x, sqft: e.target.value }))} style={inputSt} placeholder="e.g. 750" /></div>
              </div>
              <div>
                <label style={labelSt}>Estate Agent</label>
                <input value={extracted.agent || ""} onChange={e => setExtracted(x => ({ ...x, agent: e.target.value }))} style={inputSt} placeholder="e.g. Knight Frank" />
              </div>
            </div>

            <label style={labelSt}>Where does this sit?</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {COLUMNS.map(col => (
                <label key={col.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 11, cursor: "pointer",
                  background: status === col.id ? col.accent : "#fafafa",
                  border: `1px solid ${status === col.id ? col.color + "55" : "#e0dff0"}`,
                  transition: "all 0.15s"
                }}>
                  <input type="radio" name="status" value={col.id} checked={status === col.id} onChange={() => setStatus(col.id)}
                    style={{ accentColor: col.color, width: 16, height: 16 }} />
                  <Icon icon={col.icon} width={18} style={{ color: status === col.id ? col.color : "#A89DB0" }} />
                  <span style={{ fontWeight: 600, fontSize: 14, color: status === col.id ? col.color : "#6D6077" }}>{col.label}</span>
                </label>
              ))}
            </div>

            {status === "booked" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div><label style={labelSt}>Date</label><input type="date" value={viewingDate} onChange={e => setViewingDate(e.target.value)} style={inputSt} /></div>
                <div><label style={labelSt}>Time</label><input type="time" value={viewingTime} onChange={e => setViewingTime(e.target.value)} style={inputSt} /></div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep("url")} style={{ flex: 1, padding: "12px", background: "#f5f3fc", border: "1px solid #c4c1e0", borderRadius: 11, color: "#6D6077", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
              <button onClick={handleAdd} style={{ flex: 2, padding: "12px", background: "linear-gradient(135deg,#9b95eb,#7c73e6)", border: "none", borderRadius: 11, color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 16px rgba(124,115,230,0.3)" }}>
                Add to Board ✓
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── LEADERBOARD ────────────────────────────────────────────────────────────
function Leaderboard({ properties, onClose, onRescore }) {
  const scored = [...properties]
    .filter(p => p.scores && Object.keys(p.scores).length > 0)
    .sort((a, b) => (getTotal(b.scores) + getBonusTotal(b.bonuses)) - (getTotal(a.scores) + getBonusTotal(a.bonuses)));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(124,115,230,0.2)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeUp 0.2s ease" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", background: "#FFFFFF", border: "1px solid #c4c1e0", borderRadius: 22, padding: "28px 24px", boxShadow: "0 24px 60px rgba(124,115,230,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 800, color: "#1C1427", display: "flex", alignItems: "center", gap: 10 }}>
            <Icon icon="solar:cup-star-bold" width={26} style={{ color: "#7c73e6" }} /> Leaderboard
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#A89DB0", cursor: "pointer", display: "flex" }}><Icon icon="solar:close-circle-bold" width={24} /></button>
        </div>

        {scored.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#A89DB0" }}>
            <div style={{ marginBottom: 16, color: "#c4c1e0", display: "flex", justifyContent: "center" }}><Icon icon="solar:chart-2-bold" width={48} /></div>
            <p>No scored properties yet — move a property to Viewed and score it.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {scored.map((p, i) => {
              const total = getTotal(p.scores) + getBonusTotal(p.bonuses);
              const col = scoreColor(total);
              const isFirst = i === 0;
              const sectionAvgs = SECTIONS.map(s => ({ title: s.title, avg: s.questions.reduce((sum, q) => sum + (p.scores[q.id] ?? 0), 0) / s.questions.length }));
              const best = [...sectionAvgs].sort((a, b) => b.avg - a.avg)[0];
              const worst = [...sectionAvgs].sort((a, b) => a.avg - b.avg)[0];

              return (
                <div key={p.id} style={{ borderRadius: 16, overflow: "hidden", border: isFirst ? "1px solid #a8a5d8" : "1px solid #e0dff0", background: isFirst ? "#f5f3fc" : "#FFFFFF", boxShadow: isFirst ? "0 4px 20px rgba(124,115,230,0.1)" : "0 2px 8px rgba(124,115,230,0.05)" }}>
                  {isFirst && <div style={{ height: 3, background: "linear-gradient(90deg,#7c73e6,#9b95eb,#7c73e6)" }} />}
                  <div style={{ display: "flex" }}>
                    {p.image && (
                      <div style={{ width: 110, flexShrink: 0 }}>
                        <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                    <div style={{ flex: 1, padding: "16px 18px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: isFirst ? "#7c73e6" : "#A89DB0", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 3 }}>
                            {i === 0 ? "🥇 Top Pick" : i === 1 ? "🥈 Runner Up" : i === 2 ? "🥉 Third" : `#${i+1}`}
                          </div>
                          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: "#1C1427" }}>{p.name}</div>
                          {p.price && <div style={{ fontSize: 12, color: "#7c73e6", marginTop: 2, fontWeight: 600 }}>{p.price}</div>}
                        </div>
                        <div style={{ width: 50, height: 50, borderRadius: "50%", flexShrink: 0, background: `${col}12`, border: `2px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: col, fontFamily: "'Fraunces', serif" }}>{total}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <div style={{ flex: 1, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "6px 10px" }}>
                          <div style={{ fontSize: 10, color: "#059669", fontWeight: 700, marginBottom: 2 }}>BEST</div>
                          <div style={{ fontSize: 12, color: "#1C1427" }}>{best.title} · {best.avg.toFixed(1)}/5</div>
                        </div>
                        <div style={{ flex: 1, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "6px 10px" }}>
                          <div style={{ fontSize: 10, color: "#DC2626", fontWeight: 700, marginBottom: 2 }}>WEAK</div>
                          <div style={{ fontSize: 12, color: "#1C1427" }}>{worst.title} · {worst.avg.toFixed(1)}/5</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10 }}><Bar value={total} max={100} /></div>
                      <button onClick={() => { onRescore(p); onClose(); }} style={{ marginTop: 10, width: "100%", padding: "8px", background: "#f5f3fc", border: "1px solid #c4c1e0", borderRadius: 8, color: "#7c73e6", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                        View / Edit Scores
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ARCHIVE ────────────────────────────────────────────────────────────────
function Archive({ properties, onClose, onUnarchive, onOpen }) {
  const archived = properties.filter(p => p.status === "archived");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(28,20,39,0.25)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeUp 0.2s ease" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", background: "#FFFFFF", border: "1px solid #e0dff0", borderRadius: 22, padding: "28px 24px", boxShadow: "0 24px 60px rgba(28,20,39,0.12)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 800, color: "#1C1427", display: "flex", alignItems: "center", gap: 10 }}>
            <Icon icon="solar:archive-bold" width={26} style={{ color: "#A89DB0" }} /> Archived
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#A89DB0", cursor: "pointer", display: "flex" }}><Icon icon="solar:close-circle-bold" width={24} /></button>
        </div>

        {archived.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#A89DB0" }}>
            <div style={{ marginBottom: 16, color: "#e0dff0", display: "flex", justifyContent: "center" }}><Icon icon="solar:archive-bold" width={48} /></div>
            <p>No archived properties yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {archived.map(p => {
              const hasScore = p.scores && Object.keys(p.scores).length > 0;
              const total = hasScore ? getTotal(p.scores) + getBonusTotal(p.bonuses) : null;
              const col = total !== null ? scoreColor(total) : "#A89DB0";
              return (
                <div key={p.id} style={{ borderRadius: 14, border: "1px solid #e0dff0", background: "#FAFAFA", overflow: "hidden", display: "flex", gap: 0 }}>
                  {p.image && (
                    <div style={{ width: 80, flexShrink: 0 }}>
                      <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.75 }} />
                    </div>
                  )}
                  <div style={{ flex: 1, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 700, color: "#6B6B7A", lineHeight: 1.3 }}>{p.name}</div>
                      {p.price && <div style={{ fontSize: 12, color: "#A89DB0", marginTop: 2 }}>{p.price}</div>}
                      <div style={{ fontSize: 11, color: "#C4BAC8", marginTop: 4 }}>
                        {[p.bedrooms && `${p.bedrooms} bed`, p.bathrooms && `${p.bathrooms} bath`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {total !== null && (
                      <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: `${col}12`, border: `2px solid ${col}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: `${col}99`, fontFamily: "'Fraunces', serif" }}>{total}</div>
                    )}
                    <button onClick={() => { onUnarchive(p.id); }} title="Restore to Listing"
                      style={{ background: "none", border: "1px solid #e0dff0", borderRadius: 8, padding: "5px 10px", color: "#A89DB0", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                      Restore
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────
export default function NestWell() {
  const [properties, setProperties] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [overviewProp, setOverviewProp] = useState(null);
  const [scoringProp, setScoringProp] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const isRemoteUpdate = useRef(false);

  // Load from API on mount, fall back to localStorage
  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(res => {
        if (res.ok && Array.isArray(res.data)) setProperties(res.data);
        else throw new Error('no data');
      })
      .catch(() => {
        const saved = localStorage.getItem('nest-well-properties');
        if (saved) try { setProperties(JSON.parse(saved)); } catch {}
      })
      .finally(() => setDataLoaded(true));
  }, []);

  // Auto-save on every local change (skip when update came from server poll)
  useEffect(() => {
    if (!dataLoaded) return;
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    localStorage.setItem('nest-well-properties', JSON.stringify(properties));
    fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: properties }),
    }).catch(() => {});
  }, [properties, dataLoaded]);

  // Poll every 30s to pick up changes from other devices
  useEffect(() => {
    if (!dataLoaded) return;
    const interval = setInterval(() => {
      fetch('/api/data')
        .then(r => r.json())
        .then(res => {
          if (res.ok && Array.isArray(res.data)) {
            isRemoteUpdate.current = true;
            setProperties(prev => mergeProperties(prev, res.data));
          }
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [dataLoaded]);

  function addProperty(prop) {
    setProperties(prev => [...prev, { ...prop, updatedAt: Date.now() }]);
    if (prop.status === "viewed") setOverviewProp(prop);
  }

  function moveProperty(id, newStatus) {
    setProperties(prev => prev.map(p => p.id === id ? { ...p, status: newStatus, updatedAt: Date.now() } : p));
    if (newStatus === "viewed") {
      const prop = properties.find(p => p.id === id);
      if (prop) setOverviewProp({ ...prop, status: "viewed" });
    }
    if (newStatus === "archived") {
      if (overviewProp?.id === id) setOverviewProp(null);
    }
  }

  async function saveScores(updated) {
    const ts = Date.now();
    // Optimistic local update
    setProperties(prev => prev.map(p => p.id === updated.id
      ? { ...p, scores: updated.scores, bonuses: updated.bonuses, status: "viewed", updatedAt: ts }
      : p
    ));
    // Explicit merge-save: fetch latest server state, apply update, write back
    // This prevents another device's stale auto-save from overwriting bonuses
    try {
      const res = await fetch('/api/data').then(r => r.json());
      if (res.ok && Array.isArray(res.data)) {
        const exists = res.data.some(p => p.id === updated.id);
        const merged = exists
          ? res.data.map(p => p.id === updated.id
              ? { ...p, scores: updated.scores, bonuses: updated.bonuses, status: "viewed", updatedAt: ts }
              : p)
          : [...res.data, { ...updated, updatedAt: ts }];
        await fetch('/api/data', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: merged }),
        });
      }
    } catch { /* auto-save fallback will handle it */ }
  }

  function updateProperty(id, fields) {
    setProperties(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p));
  }

  function deleteProperty(id) {
    setProperties(prev => prev.filter(p => p.id !== id));
    if (overviewProp?.id === id) setOverviewProp(null);
  }

  function handleCardOpen(property) {
    setOverviewProp(property);
  }

  const scoredCount = properties.filter(p => p.scores && Object.keys(p.scores).length > 0 && p.status !== "archived").length;
  const archivedCount = properties.filter(p => p.status === "archived").length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#fafafa",
      backgroundImage: "radial-gradient(ellipse at 10% 0%, rgba(124,115,230,0.07) 0%, transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(124,115,230,0.04) 0%, transparent 55%)",
      fontFamily: "'DM Sans', sans-serif",
      color: "#1C1427",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700;9..144,800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(124,115,230,0.18); border-radius: 3px; }
        button:focus, input:focus, select:focus { outline: none; }
        input[type="date"], input[type="time"] { color-scheme: light; }
      `}</style>

      {/* HEADER */}
      <div style={{
        borderBottom: "1px solid #e0dff0", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 62, position: "sticky", top: 0, zIndex: 50,
        background: "rgba(250,250,250,0.95)", backdropFilter: "blur(14px)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", color: "#1C1427" }}>
            Nest<span style={{ color: "#7c73e6" }}> Well</span>
          </h1>
          <span style={{ fontSize: 11, color: "#A89DB0", fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", borderLeft: "1px solid #e0dff0", paddingLeft: 14 }}>
            {properties.filter(p => p.status !== "archived").length} {properties.filter(p => p.status !== "archived").length === 1 ? "property" : "properties"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {archivedCount > 0 && (
            <button onClick={() => setShowArchive(true)} style={{ background: "none", border: "none", color: "#A89DB0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: "4px 8px", display: "flex", alignItems: "center", gap: 5 }}>
              <Icon icon="solar:archive-bold" width={14} /> Archive ({archivedCount})
            </button>
          )}
          {scoredCount > 0 && (
            <button onClick={() => setShowLeaderboard(true)} style={{ ...ghostBtnSt, borderColor: "#a8a5d8", color: "#7c73e6", background: "#f0eff9", padding: "11px 22px", fontSize: 15, display: "flex", alignItems: "center", gap: 7 }}>
              <Icon icon="solar:cup-star-bold" width={16} /> Leaderboard ({scoredCount})
            </button>
          )}
          <button onClick={() => setShowAdd(true)} style={{
            padding: "11px 22px", background: "linear-gradient(135deg,#9b95eb,#7c73e6)",
            border: "none", borderRadius: 10, color: "#FFFFFF", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            boxShadow: "0 3px 12px rgba(124,115,230,0.3)"
          }}>
            + Add Property
          </button>
        </div>
      </div>

      {/* KANBAN */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, minmax(250px, 1fr))",
        minHeight: "calc(100vh - 62px)", overflowX: "auto",
      }}>
        {COLUMNS.map((col, ci) => {
          const colProps = properties.filter(p => p.status === col.id && p.status !== "archived");
          if (col.id === "booked") {
            colProps.sort((a, b) => {
              if (!a.viewingDate && !b.viewingDate) return 0;
              if (!a.viewingDate) return 1;
              if (!b.viewingDate) return -1;
              return new Date(a.viewingDate) - new Date(b.viewingDate);
            });
          }
          if (col.id === "viewed") {
            colProps.sort((a, b) =>
              (getTotal(b.scores) + getBonusTotal(b.bonuses)) - (getTotal(a.scores) + getBonusTotal(a.bonuses))
            );
          }
          return (
            <div key={col.id} style={{
              borderRight: ci < 3 ? "1px solid #e0dff0" : "none",
              padding: "22px 16px", minHeight: "calc(100vh - 62px)",
              background: ci % 2 === 0 ? "#fafafa" : "#fffaf8",
            }}>
              <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Icon icon={col.icon} width={15} style={{ color: col.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: col.color, letterSpacing: 0.3 }}>{col.label}</span>
                </div>
                <span style={{ background: col.accent, border: `1px solid ${col.color}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: col.color }}>
                  {colProps.length}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {colProps.map(p => (
                  <PropertyCard key={p.id} property={p} onOpen={handleCardOpen} onDelete={deleteProperty} onMove={moveProperty} onUpdate={updateProperty} />
                ))}
                {colProps.length === 0 && (
                  <div style={{ height: 90, borderRadius: 12, border: `1px dashed ${col.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#C4BCCC" }}>
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALS & OVERLAYS */}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={addProperty} />}

      {overviewProp && !scoringProp && (
        <PropertyOverview
          property={(() => properties.find(p => p.id === overviewProp.id) || overviewProp)()}
          onClose={() => setOverviewProp(null)}
          onDelete={deleteProperty}
          onStartScoring={() => setScoringProp(properties.find(p => p.id === overviewProp.id) || overviewProp)}
          onEdit={fields => updateProperty(overviewProp.id, fields)}
          onMove={(id, newStatus) => {
            moveProperty(id, newStatus);
            if (newStatus !== "viewed") setOverviewProp(null);
          }}
        />
      )}

      {scoringProp && (
        <ScoringWizard
          property={scoringProp}
          onClose={() => { setScoringProp(null); }}
          onSave={updated => {
            saveScores(updated);
            setScoringProp(null);
            setOverviewProp(updated);
          }}
        />
      )}

      {showLeaderboard && (
        <Leaderboard
          properties={properties}
          onClose={() => setShowLeaderboard(false)}
          onRescore={prop => { setOverviewProp(prop); }}
        />
      )}

      {showArchive && (
        <Archive
          properties={properties}
          onClose={() => setShowArchive(false)}
          onUnarchive={id => moveProperty(id, "listing")}
        />
      )}
    </div>
  );
}

function PropertyOverviewWithMove({ property, onClose, onStartScoring, onMove }) {
  return <PropertyOverview property={property} onClose={onClose} onStartScoring={onStartScoring} />;
}

const labelSt = {
  display: "block", fontSize: 11, fontWeight: 700, color: "#6D6077",
  textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8
};

const inputSt = {
  width: "100%", padding: "12px 14px",
  background: "#f5f3fc", border: "1px solid #c4c1e0",
  borderRadius: 11, color: "#1C1427", fontSize: 14,
  fontFamily: "'DM Sans', sans-serif"
};

const ghostBtnSt = {
  padding: "8px 16px", background: "#f5f3fc",
  border: "1px solid #c4c1e0", borderRadius: 9,
  color: "#6D6077", fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: "'DM Sans', sans-serif"
};
