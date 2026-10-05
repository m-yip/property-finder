import { useState, useEffect, useRef } from "react";
import { Icon } from '@iconify/react';

// ─── NARROW HOOK ────────────────────────────────────────────────────────────
function useNarrow(bp = 768) {
  const [n, setN] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const fn = () => setN(window.innerWidth < bp);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [bp]);
  return n;
}

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
  if (pct >= 70) return "#a3462b";
  if (pct >= 45) return "#b0813a";
  return "#8b7f72";
}

function verdictFor(total) {
  return total >= 75 ? "A home to love" : total >= 55 ? "Worth a second look" : total >= 40 ? "Mixed feelings" : "Not for us";
}

// ─── LIMEWASH SURFACES ─────────────────────────────────────────────────────
const PLASTER_BG = {
  background: "#ebe3d8",
  backgroundImage: `radial-gradient(ellipse at 90% -10%, #f7f0e6 0%, transparent 50%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.35 0 0 0 0 0.28 0 0 0 0 0.2 0 0 0 .07 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
};
const ARCH = "999px 999px 14px 14px";

// ─── SCORE ARCH ─────────────────────────────────────────────────────────────
// Signature score: an arch (doorway) that fills up to the score
let archId = 0;
function ScoreArch({ score, width = 44, height = 52, fontSize = 18 }) {
  const [id] = useState(() => `arch-${++archId}`);
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t); }, []);
  const r = width / 2;
  const d = `M0 ${height}V${r}a${r} ${r} 0 0 1 ${width} 0V${height}Z`;
  const fill = height * Math.min(100, score) / 100;
  return (
    <div style={{ position: "relative", width, height, flexShrink: 0, display: "grid", placeItems: "center" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs><clipPath id={id}><path d={d} /></clipPath></defs>
        <path d={d} fill="#e3d8c9" />
        <g clipPath={`url(#${id})`}>
          <rect x="0" y="0" width={width} height={height} fill={scoreColor(score)}
            style={{ transform: `translateY(${shown ? height - fill : height}px)`, transition: "transform 1.1s cubic-bezier(.2,.7,.2,1)" }} />
        </g>
      </svg>
      <span style={{ position: "relative", marginTop: height * 0.28, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600, fontSize, color: "#fbf5ee", lineHeight: 1 }}>{score}</span>
    </div>
  );
}

const COLUMNS = [
  { id: "listing",  label: "Saved",     sub: "Paste any listing link", icon: "solar:bookmark-bold",  color: "#8b7f72", accent: "#ece4d9" },
  { id: "enquired", label: "Enquired",  sub: "Waiting on agents",      icon: "solar:letter-bold",    color: "#5b4c3f", accent: "#e3d8c9" },
  { id: "booked",   label: "Visiting",  sub: "Viewings booked",        icon: "solar:calendar-bold",  color: "#5f6b3a", accent: "#e3e4d0" },
  { id: "viewed",   label: "Seen",      sub: "Ranked by score",        icon: "solar:eye-bold",       color: "#a3462b", accent: "#f1ddd2" },
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

// ─── SCORING SUMMARY GENERATOR ──────────────────────────────────────────────
function generateScoringSummary(property, scores, bonuses) {
  const total = getTotal(scores) + getBonusTotal(bonuses);
  const verdict = total >= 75 ? "strong contender" : total >= 55 ? "decent option" : total >= 40 ? "mixed bag" : "weak fit";

  // Per-section sentences
  const lines = [];
  SECTIONS.forEach(s => {
    const answered = s.questions.filter(q => scores[q.id] !== undefined);
    if (!answered.length) return;
    const avg = answered.reduce((sum, q) => sum + scores[q.id], 0) / answered.length;

    // Pick standout questions (score 1 or 5, or highest/lowest in section)
    const sorted = [...answered].sort((a, b) => scores[b.id] - scores[a.id]);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    const parts = [];
    if (scores[best.id] >= 4) parts.push(best.anchors[scores[best.id]].toLowerCase());
    if (scores[worst.id] <= 2 && worst.id !== best.id) parts.push(`${worst.label.toLowerCase()}: ${worst.anchors[scores[worst.id]].toLowerCase()}`);

    if (parts.length) {
      lines.push(`**${s.title}**: ${parts.join('; ')}.`);
    } else {
      const mid = answered.find(q => scores[q.id] === 3);
      if (mid) lines.push(`**${s.title}**: ${mid.anchors[3].toLowerCase()}.`);
    }
  });

  // Bonuses
  const activeBonus = BONUSES.filter(b => bonuses?.[b.id]);
  const bonusLine = activeBonus.length
    ? `Deal-makers: ${activeBonus.map(b => b.label.toLowerCase()).join(', ')} (+${getBonusTotal(bonuses)} pts).`
    : '';

  const header = `Scored ${total}/100 — ${verdict}.`;
  return [header, ...lines, bonusLine].filter(Boolean).join('\n');
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
                width: 48, height: 56, borderRadius: "99px 99px 12px 12px",
                border: selected ? "1px solid #a3462b" : filled ? "1px solid #d6c8b6" : "1px solid rgba(43,37,33,0.16)",
                background: selected ? "#a3462b" : filled ? "#efe4d6" : "#f6f1ea",
                color: selected ? "#fbf5ee" : filled ? "#a3462b" : "#8b7f72",
                fontSize: 22, fontWeight: 500, cursor: "pointer",
                transition: "all 0.18s ease",
                transform: selected ? "translateY(-4px)" : hovered === n ? "translateY(-2px)" : "none",
                boxShadow: selected ? "0 10px 18px -10px rgba(163,70,43,0.9)" : "none",
                fontFamily: "'Cormorant Garamond', serif",
                flexShrink: 0,
              }}>
              {n}
            </button>
            <div style={{
              fontSize: 10, color: "#8b7f72", textAlign: "center",
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
    <div style={{ height: 4, borderRadius: 2, background: "#e3d9cc", overflow: "hidden" }}>
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
                background: done ? "#a3462b" : active ? "#c0603f" : "#d6c8b6",
                boxShadow: active ? "0 0 0 2px #fff, 0 0 0 3px #a3462b" : "none",
                transition: "all 0.2s",
              }}
            />
            {i < total - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? "#a3462b" : "#e3d9cc", transition: "background 0.3s", marginLeft: 2, marginRight: 2 }} />
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
    <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(43,37,33,0.10)", height: 200, position: "relative", background: "#f6f1ea" }}>
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

  const currentCol = COLUMNS.find(c => c.id === property.status);
  const isRent = /pcm|pw|per month|per week/i.test(property.price || "");
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 120,
      ...PLASTER_BG,
      overflowY: "auto",
      animation: "fadeUp 0.25s ease"
    }}>
      <div style={{ maxWidth: 580, margin: "0 auto", padding: "0 20px 80px" }}>
        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 18px" }}>
          <button onClick={onClose} style={ghostBtnSt}>← Back to board</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => { setEditForm({ address: property.address || property.name || "", price: property.price || "", bedrooms: property.bedrooms || "", bathrooms: property.bathrooms || "", sqft: property.sqft || "", agent: property.agent || "", agentPhone: property.agentPhone || "", leaseLength: property.leaseLength || "", tenure: property.tenure || "", serviceCharge: property.serviceCharge ?? "", groundRent: property.groundRent ?? "", image: property.image || "", notes: property.notes || "" }); setEditing(true); }}
              style={{ ...ghostBtnSt, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon icon="solar:pen-bold" width={14} /> Edit
            </button>
            {onDelete && (
              <button onClick={() => { if (window.confirm("Delete this property?")) onDelete(property.id); }}
                style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(251,248,243,0.6)", border: "1px solid #ecc9bf", color: "#9b3b2a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Delete property"><Icon icon="solar:trash-bin-2-bold" width={16} /></button>
            )}
          </div>
        </div>

        {/* Arched hero */}
        <div style={{ position: "relative", height: 300, borderRadius: "300px 300px 22px 22px", overflow: "hidden", boxShadow: "0 30px 60px -34px rgba(91,76,63,0.6)" }}>
          {property.image ? (
            <img src={property.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ height: "100%", background: "linear-gradient(135deg,#f1ddd2,#e3d8c9)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c9b8a4" }}><Icon icon="solar:home-2-bold" width={64} /></div>
          )}
          <div style={{ position: "absolute", left: "50%", bottom: 16, transform: "translateX(-50%)" }}>
            <button onClick={openPicker} style={{ background: "rgba(251,248,243,0.9)", border: "none", borderRadius: 99, padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "#2b2521", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "'Manrope', sans-serif", whiteSpace: "nowrap" }}>
              <Icon icon={currentCol?.icon || "solar:bookmark-bold"} width={13} style={{ color: currentCol?.color }} />
              {currentCol?.label || "Archived"}
              <Icon icon="solar:alt-arrow-down-bold" width={11} style={{ opacity: 0.6, marginLeft: 2 }} />
            </button>
          </div>
        </div>

        {/* Title */}
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 500, lineHeight: 1.05, letterSpacing: "-0.01em", color: "#2b2521", margin: "22px 0 6px" }}>
          {property.name}
        </h1>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 10px", fontSize: 13, color: "#8b7f72", marginBottom: 6 }}>
          {property.price && <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "#a3462b" }}>{property.price}</span>}
          {property.price && <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>{isRent ? "Monthly rent" : "Asking price"}</span>}
        </div>
        {property.agent && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#5b4c3f", marginBottom: 22 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5f6b3a" }} /> {property.agent}
            {property.agentPhone && <a href={`tel:${property.agentPhone.replace(/\s+/g, "")}`} style={{ color: "#8b7f72", textDecoration: "none" }}>· {property.agentPhone}</a>}
          </div>
        )}
        {!property.agent && <div style={{ height: 16 }} />}

        {/* Column picker dropdown (fixed-position, rendered via portal-like pattern) */}
        {pickerOpen && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setPickerOpen(false)} />
            <div style={{ position: "fixed", top: pickerPos.top, left: pickerPos.left, zIndex: 999, background: "#fbf8f3", border: "1px solid rgba(43,37,33,0.10)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", overflow: "hidden", minWidth: 200 }}>
              {COLUMNS.map((col, i) => {
                const active = property.status === col.id;
                return (
                  <button key={col.id} onClick={() => { onMove?.(property.id, col.id); setPickerOpen(false); }} style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "10px 14px",
                    background: active ? col.accent : "transparent",
                    border: "none",
                    borderBottom: "1px solid #f1ece4",
                    color: active ? col.color : "#2b2521",
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    cursor: active ? "default" : "pointer",
                    fontFamily: "'Manrope', sans-serif",
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
                background: property.status === "archived" ? "#f1ece4" : "transparent",
                border: "none",
                color: "#8b7f72",
                fontSize: 13, fontWeight: 500,
                cursor: "pointer",
                fontFamily: "'Manrope', sans-serif",
                textAlign: "left"
              }}>
                <Icon icon="solar:archive-bold" width={16} style={{ color: "#b8ab9c", flexShrink: 0 }} />
                Archive
              </button>
            </div>
          </>
        )}

        {/* Score — arch gauge, verdict and category bars */}
        {hasScore && (
          <div style={{ marginBottom: 20, background: "#fbf8f3", border: "1px solid rgba(43,37,33,0.10)", borderRadius: 24, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid rgba(43,37,33,0.10)" }}>
              <ScoreArch score={total} width={104} height={124} fontSize={46} />
              <div style={{ minWidth: 0 }}>
                <div style={labelSt}>Your score · out of 100</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 30, fontWeight: 500, color: scoreColor(total), lineHeight: 1.05, marginTop: -2 }}>
                  {verdictFor(total)}
                </div>
                {getBonusTotal(property.bonuses) > 0 && (
                  <div style={{ fontSize: 12.5, color: "#5b4c3f", marginTop: 8, lineHeight: 1.5 }}>
                    Includes +{getBonusTotal(property.bonuses)} for {BONUSES.filter(b => property.bonuses?.[b.id]).map(b => b.label.toLowerCase()).join(", ")}.
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {(() => {
                const rows = SECTIONS.map(s => {
                  const answered = s.questions.filter(q => property.scores[q.id] !== undefined);
                  if (!answered.length) return null;
                  const weighted = answered.reduce((sum, q) => sum + property.scores[q.id] * q.weight, 0);
                  const maxW = answered.reduce((sum, q) => sum + 5 * q.weight, 0);
                  const sorted = [...answered].sort((a, b) => property.scores[b.id] - property.scores[a.id]);
                  return { s, pct: Math.round((weighted / maxW) * 100), highlight: sorted[0], lowlight: sorted[sorted.length - 1] };
                }).filter(Boolean);
                const best = Math.max(...rows.map(r => r.pct));
                return rows.map(({ s, pct, highlight, lowlight }) => (
                  <div key={s.id}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
                      <Icon icon={s.icon} width={13} style={{ color: "#8b7f72", flexShrink: 0, alignSelf: "center" }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#2b2521" }}>{s.title}</span>
                      <span style={{ fontSize: 11.5, color: "#8b7f72", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {property.scores[highlight.id] >= 4
                          ? highlight.anchors[property.scores[highlight.id]]
                          : property.scores[lowlight.id] <= 2
                            ? lowlight.anchors[property.scores[lowlight.id]]
                            : highlight.anchors[property.scores[highlight.id]]}
                      </span>
                      <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 600, color: "#2b2521" }}>{pct}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 5, background: "#e3d8c9", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: pct === best ? "#5f6b3a" : scoreColor(pct), borderRadius: 5 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Score CTA — only when viewed */}
        {property.status === "viewed" && (
          <div style={{ background: hasScore ? "#fbf8f3" : "#f1ddd2", border: `1px solid ${hasScore ? "rgba(43,37,33,0.10)" : "transparent"}`, borderRadius: 22, padding: "18px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, fontWeight: 500, color: "#2b2521", marginBottom: 2 }}>
                {hasScore ? "Update your scorecard" : "How did the viewing go?"}
              </div>
              <div style={{ fontSize: 13, color: "#5b4c3f", lineHeight: 1.4 }}>
                {hasScore ? `Current score: ${total}` : "Score it while it’s fresh: six categories, about two minutes."}
              </div>
            </div>
            <button onClick={onStartScoring} style={{ ...primaryBtnSt, flexShrink: 0, whiteSpace: "nowrap" }}>
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
            <div key={s.label} style={{ background: "#fbf8f3", border: "1px solid rgba(43,37,33,0.10)", borderRadius: 18, padding: "14px 12px", textAlign: "center", boxShadow: "0 10px 24px -20px rgba(91,76,63,0.5)" }}>
              <div style={{ marginBottom: 6, color: "#a3462b", display: "flex", justifyContent: "center" }}><Icon icon={s.icon} width={22} /></div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 700, color: "#2b2521" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#8b7f72", marginTop: 2, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Scoring summary */}
        {property.scoringSummary && (
          <div style={{ background: "#fbf8f3", border: "1px solid #d6c8b6", borderRadius: 20, padding: "16px 18px", marginBottom: 16, boxShadow: "0 2px 8px rgba(91,76,63,0.08)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#a3462b", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
              <Icon icon="solar:clipboard-list-bold" width={13} /> Scoring Notes
            </div>
            <p style={{ fontSize: 13, color: "#2b2521", lineHeight: 1.75, margin: 0, whiteSpace: "pre-line" }}>{property.scoringSummary}</p>
          </div>
        )}

        {/* Description */}
        {property.description && (
          <div style={{ background: "#fbf8f3", border: "1px solid rgba(43,37,33,0.10)", borderRadius: 20, padding: "18px 18px", marginBottom: 16, boxShadow: "0 10px 24px -20px rgba(91,76,63,0.5)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#8b7f72", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
              <Icon icon="solar:chat-round-dots-bold" width={13} /> About this property
            </div>
            <p style={{ fontSize: 13, color: "#5b4c3f", lineHeight: 1.7, margin: 0, whiteSpace: "pre-line" }}>{property.description}</p>
          </div>
        )}

        {/* Listing details */}
        {(property.url || property.agent || property.agentPhone || property.tenure || property.leaseLength || (property.serviceCharge != null && property.serviceCharge !== '') || property.groundRent === 0 || property.groundRent || property.dateListed) && (
          <div style={{ background: "#fbf8f3", border: "1px solid rgba(43,37,33,0.10)", borderRadius: 20, padding: "16px 18px", marginBottom: 20, boxShadow: "0 10px 24px -20px rgba(91,76,63,0.5)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#8b7f72", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Listing Details</div>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: property.dateListed || property.groundRent !== undefined || property.serviceCharge !== null ? 4 : 0, borderTop: (property.agent || property.tenure || property.leaseLength || property.dateListed) ? "1px solid #ece4d9" : "none", marginTop: (property.agent || property.tenure || property.leaseLength || property.dateListed) ? 4 : 0 }}>
                  <span style={{ display: "flex", alignItems: "center", color: "#a3462b", flexShrink: 0 }}><Icon icon="solar:link-bold" width={14} /></span>
                  <span style={{ fontSize: 12, color: "#8b7f72", width: 90, flexShrink: 0 }}>Original listing</span>
                  <a href={property.url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 13, color: "#a3462b", fontWeight: 600, textDecoration: "none", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
            <div style={{ background: "#fffaf0", border: "1px solid #ecdcb8", borderRadius: 20, padding: "14px 16px", marginBottom: 16, boxShadow: "0 2px 8px rgba(154,123,60,0.08)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9a7b3c", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
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
                  style={{ width: "100%", fontSize: 13, color: "#5b4c3f", lineHeight: 1.7, border: "none", background: "transparent", resize: "vertical", outline: "none", fontFamily: "'Manrope', sans-serif" }}
                />
              ) : (
                <div onClick={() => setNotesEditing(true)} style={{ fontSize: 13, color: notesVal ? "#5b4c3f" : "#b59a62", lineHeight: 1.7, cursor: "text", minHeight: 24, whiteSpace: "pre-line" }}>
                  {notesVal || "Click to add notes…"}
                </div>
              )}
            </div>
          );
        })()}

        {/* Score breakdown by section — detailed, at bottom */}
        {hasScore && (
          <div style={{ background: "#fbf8f3", border: "1px solid rgba(43,37,33,0.10)", borderRadius: 16, padding: "18px 20px", marginBottom: 20, boxShadow: "0 10px 24px -20px rgba(91,76,63,0.5)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#8b7f72", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14, display: "flex", alignItems: "center", gap: 5 }}>
              <Icon icon="solar:chart-2-bold" width={13} /> Score Breakdown
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {SECTIONS.map(s => {
                const answered = s.questions.filter(q => property.scores[q.id] !== undefined);
                if (!answered.length) return null;
                const weighted = answered.reduce((sum, q) => sum + property.scores[q.id] * q.weight, 0);
                const maxW = answered.reduce((sum, q) => sum + 5 * q.weight, 0);
                const pct = Math.round((weighted / maxW) * 100);
                const col = scoreColor(pct);
                return (
                  <div key={s.id}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon icon={s.icon} width={13} style={{ color: "#8b7f72" }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#2b2521" }}>{s.title}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: col, fontFamily: "'Cormorant Garamond', serif" }}>{pct}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "#ece4d9", overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 3 }} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
                      {answered.map(q => (
                        <span key={q.id} style={{ fontSize: 11, color: "#8b7f72" }}>
                          {q.label}: <span style={{ fontWeight: 700, color: property.scores[q.id] >= 4 ? "#5f6b3a" : property.scores[q.id] <= 2 ? "#9b3b2a" : "#5b4c3f" }}>{property.scores[q.id]}/5</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {getBonusTotal(property.bonuses) > 0 && (
                <>
                  <div style={{ borderTop: "1px solid #ece4d9", paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon icon="solar:stars-bold" width={13} style={{ color: "#8b7f72" }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#2b2521" }}>Deal-makers</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#a3462b", fontFamily: "'Cormorant Garamond', serif" }}>+{getBonusTotal(property.bonuses)} pts</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
                    {BONUSES.filter(b => property.bonuses?.[b.id]).map(b => (
                      <span key={b.id} style={{ fontSize: 11, color: "#a3462b", fontWeight: 600 }}>
                        <Icon icon={b.icon} width={11} style={{ verticalAlign: "middle", marginRight: 3 }} />{b.label} +{b.points}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Map */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8b7f72", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><Icon icon="solar:map-point-bold" width={13} /> Location</div>
          <MapEmbed address={property.name || property.address} />
          {property.name && (
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(property.name)}`}
              target="_blank" rel="noreferrer"
              style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 12, color: "#a3462b", textDecoration: "none" }}
            >
              Open in Google Maps ↗
            </a>
          )}
        </div>

      </div>

      {/* Edit overlay */}
      {editing && editForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(91,76,63,0.18)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeUp 0.2s ease" }}
          onClick={e => e.target === e.currentTarget && setEditing(false)}>
          <div style={{ width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", background: "#f6f1ea", borderRadius: 30, padding: 30, boxShadow: "0 40px 80px -30px rgba(43,37,33,0.55)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 32, fontWeight: 500, color: "#2b2521", lineHeight: 1 }}>Edit details</h2>
              <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: "#8b7f72", cursor: "pointer", display: "flex" }}><Icon icon="solar:close-circle-bold" width={24} /></button>
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
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: "12px", background: "#f6f1ea", border: "1px solid #d6c8b6", borderRadius: 11, color: "#5b4c3f", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Manrope', sans-serif" }}>Cancel</button>
              <button onClick={() => { onEdit?.({ ...editForm, name: editForm.address || property.name }); setEditing(false); }} style={{ flex: 2, padding: "12px", background: "#a3462b", border: "none", borderRadius: 11, color: "#fbf8f3", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Manrope', sans-serif", boxShadow: "0 4px 16px rgba(91,76,63,0.3)" }}>
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
      <span style={{ flexShrink: 0, marginTop: 2, color: "#8b7f72", display: "flex" }}>
        <Icon icon={icon} width={16} />
      </span>
      <span style={{ fontSize: 12, color: "#8b7f72", width: 90, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#5b4c3f", flex: 1 }}>{value}</span>
    </div>
  );
}

// ─── CONTEXT HINT ──────────────────────────────────────────────────────────
function ContextPill({ hint }) {
  if (!hint) return null;
  return (
    <p style={{ fontSize: 12, color: "#8b7f72", lineHeight: 1.55, margin: "0 0 14px", fontStyle: "normal" }}>{hint}</p>
  );
}

// ─── SCORING WIZARD ─────────────────────────────────────────────────────────
function ScoringWizard({ property, onClose, onSave }) {
  const [sectionIdx, setSectionIdx] = useState(0);
  const [scores, setScores] = useState(property.scores || {});
  const [bonuses, setBonuses] = useState(property.bonuses || {});
  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState("");
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
  }, [sectionIdx, showSummary]);

  function next() {
    if (sectionIdx < SECTIONS.length - 1) setSectionIdx(s => s + 1);
  }

  function openSummary() {
    setSummaryText(generateScoringSummary(property, scores, bonuses));
    setShowSummary(true);
  }

  function save() {
    onSave({ ...property, scores, bonuses, scoringSummary: summaryText });
    onClose();
  }

  function goBack() {
    if (showSummary) { setShowSummary(false); return; }
    if (sectionIdx > 0) setSectionIdx(s => s - 1);
    else onClose();
  }

  const completedSections = SECTIONS.map(s => s.questions.every(q => scores[q.id] !== undefined));

  return (
    <div ref={scrollRef} style={{
      position: "fixed", inset: 0, zIndex: 130,
      ...PLASTER_BG,
      overflowY: "auto",
      animation: "slideIn 0.28s ease"
    }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: "0 20px 80px" }}>
        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 12px", position: "sticky", top: 0, background: "rgba(243,236,226,0.92)", backdropFilter: "blur(10px)", zIndex: 10, marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20, borderBottom: "1px solid rgba(43,37,33,0.10)" }}>
          <button onClick={goBack} style={ghostBtnSt}>
            ← {sectionIdx === 0 ? "Overview" : "Back"}
          </button>
          <div style={{ flex: 1, padding: "0 16px" }}>
            <ProgressBar sectionIdx={sectionIdx} total={SECTIONS.length} completedSections={completedSections} onJump={setSectionIdx} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: Object.keys(scores).length > 0 ? scoreColor(runningTotal) : "#a89a8a", fontFamily: "'Cormorant Garamond', serif", minWidth: 40, textAlign: "right" }}>
            {Object.keys(scores).length > 0 ? `${runningTotal}/100` : "—"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#d6c8b6", display: "flex", alignItems: "center", paddingLeft: 12 }} title="Exit scoring">
            <Icon icon="solar:close-square-bold" width={20} />
          </button>
        </div>

        {/* Property mini-header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0 20px" }}>
          {property.image && (
            <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(43,37,33,0.10)" }}>
              <img src={property.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#2b2521" }}>{property.name}</div>
            {property.price && <div style={{ fontSize: 12, color: "#a3462b", fontWeight: 600, marginTop: 1 }}>{property.price}</div>}
          </div>
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#8b7f72", flexShrink: 0 }}>
            {sectionIdx + 1}/{SECTIONS.length}
          </div>
        </div>

        {/* Section header */}
        <div style={{ marginBottom: 22, animation: "fadeUp 0.25s ease" }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 38, fontWeight: 500, lineHeight: 1.05, color: "#2b2521", display: "flex", alignItems: "center", gap: 12 }}>
            <Icon icon={section.icon} width={28} style={{ color: "#a3462b", flexShrink: 0 }} />
            {section.title}
          </h2>
          <p style={{ color: "#5b4c3f", fontSize: 14, marginTop: 5 }}>{section.subtitle}</p>
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
                background: answered ? "#fbf8f3" : locked ? "#f3ece2" : "#fbf8f3",
                border: `1px solid ${answered ? "#d6c8b6" : "#e3d9cc"}`,
                borderRadius: 22,
                padding: isFirst ? "24px 24px 28px" : "18px 18px 22px",
                animation: `fadeUp 0.3s ease ${qi * 0.07}s both`,
                transition: "border-color 0.2s, background 0.2s, opacity 0.25s",
                boxShadow: answered ? "0 4px 16px rgba(91,76,63,0.08)" : "none",
                opacity: locked ? 0.42 : 1,
                pointerEvents: locked ? "none" : "auto",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: isFirst ? 25 : 21, lineHeight: 1.15, flex: 1, color: "#2b2521" }}>{q.label}</div>
                  {answered && (
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#a3462b", marginLeft: 12, whiteSpace: "nowrap", fontFamily: "'Cormorant Garamond', serif" }}>
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
              <div style={{ flex: 1, height: 1, background: "#e3d9cc" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#8b7f72", textTransform: "uppercase", letterSpacing: 1.5, whiteSpace: "nowrap" }}>Deal-makers</span>
              <div style={{ flex: 1, height: 1, background: "#e3d9cc" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {BONUSES.map(b => {
                const active = !!bonuses[b.id];
                return (
                  <button key={b.id} onClick={() => setBonuses(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      width: "100%", padding: "13px 16px",
                      background: active ? "#f1e9df" : "#fbf8f3",
                      border: `1px solid ${active ? "#a3462b" : "#e3d9cc"}`,
                      borderRadius: 12, cursor: "pointer",
                      transition: "all 0.15s",
                      boxShadow: active ? "0 2px 10px rgba(91,76,63,0.12)" : "none",
                      fontFamily: "'Manrope', sans-serif", textAlign: "left",
                    }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: active ? "#a3462b" : "#f6f1ea", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                      <Icon icon={b.icon} width={16} style={{ color: active ? "#fbf8f3" : "#c0603f" }} />
                    </div>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: active ? "#2b2521" : "#5b4c3f" }}>{b.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: active ? "#a3462b" : "#d6c8b6", fontFamily: "'Cormorant Garamond', serif", flexShrink: 0 }}>+{b.points}</div>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${active ? "#a3462b" : "#e3d9cc"}`, background: active ? "#a3462b" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                      {active && <Icon icon="solar:check-bold" width={10} style={{ color: "#fbf8f3" }} />}
                    </div>
                  </button>
                );
              })}
            </div>
            {bonusTotal > 0 && (
              <div style={{ marginTop: 12, padding: "12px 16px", background: "#f1e9df", border: "1px solid #d6c8b6", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", animation: "fadeUp 0.2s ease" }}>
                <span style={{ fontSize: 13, color: "#a3462b", fontWeight: 600 }}>Base {runningTotal} + {bonusTotal} bonus</span>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 800, color: scoreColor(combinedTotal) }}>{combinedTotal}</span>
              </div>
            )}
          </div>
        )}

        {/* Section complete (non-last sections) */}
        {sectionComplete && !isLastSection && (
          <div style={{ marginTop: 16, padding: "14px 16px", background: "#eef0e2", border: "1px solid #cfd3b4", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, animation: "fadeUp 0.2s ease" }}>
            <Icon icon="solar:check-circle-bold" width={20} style={{ color: "#5f6b3a", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#5f6b3a" }}>Section complete</div>
              <div style={{ fontSize: 12, color: "#5b4c3f" }}>Up next: {SECTIONS[sectionIdx + 1].title}</div>
            </div>
          </div>
        )}

        {/* Next / Save button */}
        <div style={{ marginTop: 20 }}>
          <button
            onClick={isLastSection ? openSummary : next}
            disabled={!sectionComplete}
            style={{
              width: "100%", padding: "16px",
              background: sectionComplete ? "#a3462b" : "#f1e9df",
              color: sectionComplete ? "#fbf8f3" : "#a89a8a",
              border: "none", borderRadius: 99, fontSize: 15, fontWeight: 600,
              cursor: sectionComplete ? "pointer" : "not-allowed",
              fontFamily: "'Manrope', sans-serif",
              boxShadow: sectionComplete ? "0 12px 24px -12px rgba(163,70,43,0.9)" : "none",
              transition: "all 0.2s"
            }}
          >
            {isLastSection ? "Review & Save →" : `Next: ${SECTIONS[sectionIdx + 1].title} →`}
          </button>
          {!sectionComplete && (
            <div style={{ textAlign: "center", fontSize: 12, color: "#8b7f72", marginTop: 8 }}>
              Answer all {section.questions.length} questions to continue
            </div>
          )}
        </div>
      </div>

      {/* Summary screen */}
      {showSummary && (
        <div style={{ position: "absolute", inset: 0, ...PLASTER_BG, overflowY: "auto", zIndex: 10, animation: "slideIn 0.25s ease" }}>
          <div style={{ maxWidth: 540, margin: "0 auto", padding: "0 20px 80px" }}>
            {/* Nav */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 12px", position: "sticky", top: 0, background: "rgba(243,236,226,0.92)", backdropFilter: "blur(10px)", zIndex: 10, marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20, borderBottom: "1px solid rgba(43,37,33,0.10)" }}>
              <button onClick={() => setShowSummary(false)} style={ghostBtnSt}>← Back</button>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 700, color: scoreColor(combinedTotal) }}>{combinedTotal}/100</div>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#d6c8b6", display: "flex", alignItems: "center" }}>
                <Icon icon="solar:close-square-bold" width={20} />
              </button>
            </div>

            <div style={{ padding: "24px 0 20px" }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 38, fontWeight: 500, color: "#2b2521", marginBottom: 6 }}>Scoring summary</h2>
              <p style={{ fontSize: 13, color: "#8b7f72", marginBottom: 20 }}>Edit this summary to add your own notes before saving.</p>

              <textarea
                value={summaryText}
                onChange={e => setSummaryText(e.target.value)}
                rows={14}
                style={{ width: "100%", fontSize: 14, color: "#2b2521", lineHeight: 1.75, border: "1px solid #d6c8b6", borderRadius: 20, padding: "16px", background: "#fbf8f3", resize: "vertical", outline: "none", fontFamily: "'Manrope', sans-serif", boxShadow: "0 10px 24px -20px rgba(91,76,63,0.5)", boxSizing: "border-box" }}
              />
            </div>

            <button onClick={save} style={{ width: "100%", padding: "16px", background: "#a3462b", border: "none", borderRadius: 99, color: "#fbf8f3", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'Manrope', sans-serif", boxShadow: "0 4px 20px rgba(91,76,63,0.3)" }}>
              Save Scorecard ✓
            </button>
          </div>
        </div>
      )}
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

  const viewingLabel = property.viewingDate
    ? (() => { const d = new Date(property.viewingDate), h = d.getHours(), m = d.getMinutes(); return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })} · ${h % 12 || 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`; })()
    : null;
  const activeBonuses = BONUSES.filter(b => property.bonuses?.[b.id]).sort((a, b) => b.points - a.points).slice(0, 3);
  const pillSt = { position: "absolute", left: "50%", bottom: 10, transform: "translateX(-50%)", fontSize: 11, fontWeight: 600, padding: "6px 11px", borderRadius: 99, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 };
  const chipBtn = { fontSize: 10.5, padding: "4px 9px", borderRadius: 99, background: "transparent", border: "1px solid rgba(43,37,33,0.14)", color: "#8b7f72", fontWeight: 600, cursor: "pointer", fontFamily: "'Manrope', sans-serif" };

  return (
    <div
      onClick={() => onOpen(property)}
      style={{
        background: "#fbf8f3",
        border: "1px solid rgba(43,37,33,0.10)",
        borderRadius: 20, padding: "8px 8px 12px", position: "relative",
        cursor: "pointer", transition: "transform 0.25s cubic-bezier(.2,.7,.2,1), box-shadow 0.25s",
        animation: "fadeUp 0.4s ease both",
        boxShadow: "0 10px 24px -20px rgba(91,76,63,0.5)"
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 30px 60px -34px rgba(91,76,63,0.55)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 10px 24px -20px rgba(91,76,63,0.5)"; }}
    >
      {/* Arched photo */}
      <div style={{ position: "relative", height: 150, background: "#f1ddd2", overflow: "hidden", borderRadius: ARCH }}>
        {property.image ? (
          <img src={property.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#d6c8b6" }}><Icon icon="solar:home-2-bold" width={44} /></div>
        )}

        {property.status === "booked" && viewingLabel && (
          <div style={{ ...pillSt, background: "#a3462b", color: "#fbf5ee" }}>
            <Icon icon="solar:calendar-bold" width={12} /> {viewingLabel}
          </div>
        )}

        {property.status === "viewed" && !hasScore && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "linear-gradient(transparent, rgba(163,70,43,0.92))",
            padding: "18px 12px 9px", fontSize: 11, fontWeight: 700, color: "#fbf5ee",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5, letterSpacing: 0.6
          }}>
            <Icon icon="solar:pen-bold" width={13} /> Tap to score
          </div>
        )}
      </div>

      {onDelete && (
        <button onClick={e => { e.stopPropagation(); if (window.confirm("Delete this property?")) onDelete(property.id); }}
          style={{ position: "absolute", top: 16, right: 16, width: 28, height: 28, borderRadius: "50%", background: "rgba(251,248,243,0.88)", backdropFilter: "blur(6px)", border: "none", color: "#8b7f72", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          title="Delete"><Icon icon="solar:trash-bin-2-bold" width={14} /></button>
      )}

      {/* Content */}
      <div style={{ padding: "12px 6px 0", position: "relative" }}>
        {hasScore && (
          <div style={{ position: "absolute", top: 12, right: 6 }}><ScoreArch score={total} width={40} height={48} fontSize={17} /></div>
        )}
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 600, lineHeight: 1.15, color: "#2b2521", paddingRight: hasScore ? 48 : 0 }}>
          {property.name}
        </div>
        {property.price && (
          <div style={{ fontSize: 13, color: "#a3462b", fontWeight: 600, marginTop: 4 }}>{property.price}</div>
        )}
        {(property.bedrooms || property.sqft) && (
          <div style={{ fontSize: 12, color: "#8b7f72", marginTop: 3 }}>
            {property.bedrooms && `${property.bedrooms} bed`}
            {property.bathrooms && ` · ${property.bathrooms} bath`}
            {property.sqft && ` · ${property.sqft} sq ft`}
          </div>
        )}

        {/* Estate agent — visible straight from the board */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(43,37,33,0.10)", fontSize: 11.5, color: "#8b7f72", minHeight: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: property.agent ? "#5f6b3a" : "#d6c8b6", flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {property.agent || "Agent not added yet"}
          </span>
          {property.agentPhone && (
            <a href={`tel:${property.agentPhone.replace(/\s+/g, "")}`} onClick={e => e.stopPropagation()} title={`Call ${property.agentPhone}`}
              style={{ color: "#5b4c3f", display: "flex", alignItems: "center" }}><Icon icon="solar:phone-bold" width={13} /></a>
          )}
          {activeBonuses.map(b => (
            <Icon key={b.id} icon={b.icon} width={13} style={{ color: "#a3462b" }} title={b.label} />
          ))}
        </div>

        {/* Move to column */}
        <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: col?.color, background: col?.accent, borderRadius: 99, padding: "4px 9px", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon icon={col?.icon || "solar:bookmark-bold"} width={11} /> {col?.label}
          </span>
          {COLUMNS.filter(c => c.id !== property.status).map(c => (
            <button key={c.id} onClick={e => { e.stopPropagation(); onMove?.(property.id, c.id); }} style={chipBtn}>
              → {c.label}
            </button>
          ))}
          <button onClick={e => { e.stopPropagation(); onMove?.(property.id, "archived"); }} style={{ ...chipBtn, color: "#b8ab9c" }}>
            Archive
          </button>
        </div>

        {/* Viewing date entry — Visiting column only */}
        {property.status === "booked" && (
          <div style={{ borderTop: "1px solid rgba(43,37,33,0.10)", marginTop: 10, paddingTop: 9 }} onClick={e => e.stopPropagation()}>
            {editingDate ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)}
                  style={{ flex: 1, minWidth: 0, fontSize: 11, padding: "5px 8px", borderRadius: 8, border: "1px solid #d6c8b6", background: "#f6f1ea", outline: "none", fontFamily: "'Manrope', sans-serif" }} />
                <input type="time" value={timeVal} onChange={e => setTimeVal(e.target.value)}
                  style={{ width: 76, fontSize: 11, padding: "5px 8px", borderRadius: 8, border: "1px solid #d6c8b6", background: "#f6f1ea", outline: "none", fontFamily: "'Manrope', sans-serif" }} />
                <button onClick={saveDate}
                  style={{ background: "#a3462b", border: "none", borderRadius: 99, color: "#fbf5ee", fontSize: 11, fontWeight: 700, padding: "5px 10px", cursor: "pointer" }}>✓</button>
                <button onClick={e => { e.stopPropagation(); setEditingDate(false); }}
                  style={{ background: "none", border: "1px solid #d6c8b6", borderRadius: 99, color: "#8b7f72", fontSize: 11, padding: "5px 9px", cursor: "pointer" }}>✕</button>
              </div>
            ) : (
              <button onClick={startEditDate} style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 11.5, fontWeight: 600, fontFamily: "'Manrope', sans-serif",
                color: property.viewingDate ? "#5f6b3a" : "#8b7f72",
              }}>
                <Icon icon="solar:calendar-bold" width={13} />
                {property.viewingDate
                  ? new Date(property.viewingDate).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
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

  const narrow = useNarrow();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(43,37,33,0.25)", backdropFilter: "blur(8px)", display: "flex", alignItems: narrow ? "flex-end" : "center", justifyContent: "center", padding: narrow ? 0 : 20, animation: narrow ? "slideUp 0.28s ease" : "fadeUp 0.2s ease" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: narrow ? "100%" : 500, maxHeight: "92vh", overflowY: "auto", background: "#f6f1ea", borderRadius: narrow ? "28px 28px 0 0" : 30, padding: 30, boxShadow: "0 40px 80px -30px rgba(43,37,33,0.55)" }}>
        {narrow && <div style={{ width: 36, height: 4, background: "#e3d9cc", borderRadius: 2, margin: "-8px auto 20px" }} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 34, fontWeight: 500, color: "#2b2521", lineHeight: 1 }}>
            {step === "url" ? "Add a home" : "Does this look right?"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8b7f72", cursor: "pointer", display: "flex" }}><Icon icon="solar:close-circle-bold" width={24} /></button>
        </div>

        {step === "url" && (
          <>
            <p style={{ fontSize: 13.5, color: "#5b4c3f", lineHeight: 1.5, marginBottom: 16, marginTop: -10 }}>Paste a link from Rightmove, Zoopla, OnTheMarket or an agent’s site. We’ll fill in the price, size, photos and agent for you.</p>
            <label style={labelSt}>Listing link</label>
            <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && extractUrl()}
              placeholder="https://www.rightmove.co.uk/properties/..."
              style={inputSt} disabled={loading} autoFocus />
            {error && <div style={{ color: "#9b3b2a", fontSize: 13, marginTop: 8 }}>{error}</div>}
            <button onClick={extractUrl} disabled={loading || !url.trim()} style={{
              width: "100%", marginTop: 16, padding: "14px",
              background: loading || !url.trim() ? "#f1e9df" : "#a3462b",
              color: loading || !url.trim() ? "#a89a8a" : "#fbf8f3",
              border: "none", borderRadius: 99, fontSize: 15, fontWeight: 600,
              cursor: loading || !url.trim() ? "not-allowed" : "pointer", fontFamily: "'Manrope', sans-serif",
              boxShadow: loading || !url.trim() ? "none" : "0 4px 16px rgba(91,76,63,0.3)"
            }}>
              {loading ? "Fetching the details…" : "Extract Details →"}
            </button>
            <button onClick={() => { setExtracted({ address: "", name: "", price: "", bedrooms: "", bathrooms: "", sqft: "", image: "", agent: "", agentPhone: "", serviceCharge: null, groundRent: null, leaseLength: "", tenure: "", description: "", epcRating: "", dateListed: "" }); setStep("confirm"); }}
              style={{ width: "100%", marginTop: 10, padding: "11px", background: "none", border: "1px solid rgba(43,37,33,0.10)", borderRadius: 99, color: "#8b7f72", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Manrope', sans-serif" }}>
              Enter details manually →
            </button>
          </>
        )}

        {step === "confirm" && extracted && (
          <>
            {extracted.image && (
              <div style={{ position: "relative", height: 170, borderRadius: "999px 999px 16px 16px", overflow: "hidden", marginBottom: 18 }}>
                <img src={extracted.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(43,37,33,0.7) 0%, transparent 55%)" }} />
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
                  padding: "12px 16px", borderRadius: 16, cursor: "pointer",
                  background: status === col.id ? col.accent : "#f3ece2",
                  border: `1px solid ${status === col.id ? col.color + "55" : "#e3d9cc"}`,
                  transition: "all 0.15s"
                }}>
                  <input type="radio" name="status" value={col.id} checked={status === col.id} onChange={() => setStatus(col.id)}
                    style={{ accentColor: col.color, width: 16, height: 16 }} />
                  <Icon icon={col.icon} width={18} style={{ color: status === col.id ? col.color : "#8b7f72" }} />
                  <span style={{ fontWeight: 600, fontSize: 14, color: status === col.id ? col.color : "#5b4c3f" }}>{col.label}</span>
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
              <button onClick={() => setStep("url")} style={{ flex: 1, padding: "12px", background: "#f6f1ea", border: "1px solid #d6c8b6", borderRadius: 99, color: "#5b4c3f", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Manrope', sans-serif" }}>← Back</button>
              <button onClick={handleAdd} style={{ flex: 2, padding: "12px", background: "#a3462b", border: "none", borderRadius: 99, color: "#fbf8f3", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Manrope', sans-serif", boxShadow: "0 4px 16px rgba(91,76,63,0.3)" }}>
                Add to board ✓
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
  const narrow = useNarrow();
  const scored = [...properties]
    .filter(p => p.scores && Object.keys(p.scores).length > 0)
    .sort((a, b) => (getTotal(b.scores) + getBonusTotal(b.bonuses)) - (getTotal(a.scores) + getBonusTotal(a.bonuses)));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(43,37,33,0.25)", backdropFilter: "blur(10px)", display: "flex", alignItems: narrow ? "flex-end" : "center", justifyContent: "center", padding: narrow ? 0 : 20, animation: narrow ? "slideUp 0.28s ease" : "fadeUp 0.2s ease" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: narrow ? "100%" : 780, maxHeight: "92vh", overflowY: "auto", background: "#f6f1ea", borderRadius: narrow ? "28px 28px 0 0" : 30, padding: narrow ? "24px 18px 30px" : "34px 34px 30px", boxShadow: "0 40px 80px -30px rgba(43,37,33,0.55)" }}>
        {narrow && <div style={{ width: 36, height: 4, background: "#d6c8b6", borderRadius: 2, margin: "-8px auto 20px" }} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: narrow ? 36 : 46, fontWeight: 500, color: "#2b2521", lineHeight: 1 }}>Your favourites</h2>
            <p style={{ fontSize: 13, color: "#8b7f72", marginTop: 6 }}>Every home you’ve scored, ranked. Tap one to see why.</p>
          </div>
          <button onClick={onClose} style={ghostBtnSt}>Close</button>
        </div>

        {scored.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#8b7f72" }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 24, color: "#2b2521", marginBottom: 6 }}>Nothing scored yet</div>
            <p style={{ fontSize: 13 }}>Move a home to Seen after your viewing and score it.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {scored.map((p, i) => {
              const total = getTotal(p.scores) + getBonusTotal(p.bonuses);
              const isFirst = i === 0;
              const sectionAvgs = SECTIONS.map(s => ({ title: s.title, avg: s.questions.reduce((sum, q) => sum + (p.scores[q.id] ?? 0), 0) / s.questions.length }));
              const best = [...sectionAvgs].sort((a, b) => b.avg - a.avg)[0];
              const worst = [...sectionAvgs].sort((a, b) => a.avg - b.avg)[0];
              return (
                <div key={p.id} onClick={() => { onRescore(p); onClose(); }}
                  style={{ display: "grid", gridTemplateColumns: narrow ? "auto 72px 1fr auto" : "34px 100px 1fr auto auto", gap: narrow ? 12 : 18, alignItems: "center", padding: narrow ? 10 : 14, borderRadius: 22, cursor: "pointer", background: isFirst ? "#fbf8f3" : "transparent", boxShadow: isFirst ? "0 10px 24px -16px rgba(91,76,63,0.55)" : "none", transition: "background 0.2s" }}
                  onMouseEnter={e => { if (!isFirst) e.currentTarget.style.background = "rgba(251,248,243,0.6)"; }}
                  onMouseLeave={e => { if (!isFirst) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 32, fontWeight: 500, color: isFirst ? "#a3462b" : "#c9b8a4", lineHeight: 1 }}>{i + 1}</div>
                  <div style={{ height: narrow ? 72 : 84, borderRadius: "99px 99px 10px 10px", overflow: "hidden", background: "#f1ddd2" }}>
                    {p.image && <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: narrow ? 18 : 22, fontWeight: 600, lineHeight: 1.1, color: "#2b2521" }}>
                      {p.name}
                      {isFirst && <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#5f6b3a", background: "#e3e4d0", padding: "4px 8px", borderRadius: 99, marginLeft: 8, verticalAlign: "middle" }}>Top pick</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "#8b7f72", marginTop: 4 }}>{p.price}{p.price && " · "}<em style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: scoreColor(total) }}>{verdictFor(total)}</em></div>
                    {narrow && <div style={{ fontSize: 11, color: "#8b7f72", marginTop: 4 }}>Best: {best.title} · Weakest: {worst.title}</div>}
                  </div>
                  {!narrow && (
                    <div style={{ fontSize: 11.5, color: "#5b4c3f", lineHeight: 1.7, minWidth: 170 }}>
                      <div><span style={{ color: "#5f6b3a", fontWeight: 700 }}>Best</span> · {best.title} {best.avg.toFixed(1)}/5</div>
                      <div><span style={{ color: "#a3462b", fontWeight: 700 }}>Weakest</span> · {worst.title} {worst.avg.toFixed(1)}/5</div>
                      <div style={{ color: "#a3462b", fontWeight: 600 }}>View / edit scores →</div>
                    </div>
                  )}
                  <ScoreArch score={total} width={narrow ? 52 : 70} height={narrow ? 62 : 84} fontSize={narrow ? 22 : 30} />
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
  const narrow = useNarrow();
  const archived = properties.filter(p => p.status === "archived");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(43,37,33,0.25)", backdropFilter: "blur(10px)", display: "flex", alignItems: narrow ? "flex-end" : "center", justifyContent: "center", padding: narrow ? 0 : 20, animation: narrow ? "slideUp 0.28s ease" : "fadeUp 0.2s ease" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: narrow ? "100%" : 620, maxHeight: "92vh", overflowY: "auto", background: "#f6f1ea", borderRadius: narrow ? "28px 28px 0 0" : 30, padding: "30px 28px", boxShadow: "0 40px 80px -30px rgba(43,37,33,0.55)" }}>
        {narrow && <div style={{ width: 36, height: 4, background: "#e3d9cc", borderRadius: 2, margin: "-8px auto 20px" }} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 40, fontWeight: 500, color: "#2b2521", display: "flex", alignItems: "center", gap: 10, lineHeight: 1 }}>
            Archived
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8b7f72", cursor: "pointer", display: "flex" }}><Icon icon="solar:close-circle-bold" width={24} /></button>
        </div>

        {archived.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#8b7f72" }}>
            <div style={{ marginBottom: 16, color: "#e3d9cc", display: "flex", justifyContent: "center" }}><Icon icon="solar:archive-bold" width={48} /></div>
            <p>No archived properties yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {archived.map(p => {
              const hasScore = p.scores && Object.keys(p.scores).length > 0;
              const total = hasScore ? getTotal(p.scores) + getBonusTotal(p.bonuses) : null;
              const col = total !== null ? scoreColor(total) : "#8b7f72";
              return (
                <div key={p.id} style={{ borderRadius: 14, border: "1px solid rgba(43,37,33,0.10)", background: "#f3ece2", overflow: "hidden", display: "flex", gap: 0 }}>
                  {p.image && (
                    <div style={{ width: 80, flexShrink: 0 }}>
                      <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.75 }} />
                    </div>
                  )}
                  <div style={{ flex: 1, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 14, fontWeight: 700, color: "#5b4c3f", lineHeight: 1.3 }}>{p.name}</div>
                      {p.price && <div style={{ fontSize: 12, color: "#8b7f72", marginTop: 2 }}>{p.price}</div>}
                      <div style={{ fontSize: 11, color: "#b8ab9c", marginTop: 4 }}>
                        {[p.bedrooms && `${p.bedrooms} bed`, p.bathrooms && `${p.bathrooms} bath`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {total !== null && (
                      <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: `${col}12`, border: `2px solid ${col}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: `${col}99`, fontFamily: "'Cormorant Garamond', serif" }}>{total}</div>
                    )}
                    <button onClick={() => { onUnarchive(p.id); }} title="Restore to Listing"
                      style={{ background: "none", border: "1px solid rgba(43,37,33,0.10)", borderRadius: 8, padding: "5px 10px", color: "#8b7f72", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Manrope', sans-serif", flexShrink: 0 }}>
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

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function generateClientCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// ─── ACCOUNT, TRACKING & PLANS ───────────────────────────────────────────────
const USER_KEY = "nestwell-user", ANON_KEY = "nestwell-anon", ATTR_KEY = "nestwell-attribution";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PLAN_INFO = {
  free:      { name: "Free" },
  ten:       { name: "Search", price: "£8", homes: 10 },
  unlimited: { name: "Unlimited", price: "£15" },
};
const FREE_ENTITLEMENT = { plan: "free", homes: 10, freeScoreAfter: 3, demo: true };

function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)) || null; } catch { return null; } }
function saveUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }
function getAnonId() {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) { id = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2)); localStorage.setItem(ANON_KEY, id); }
  return id;
}
function getAttribution() { try { return JSON.parse(localStorage.getItem(ATTR_KEY)) || null; } catch { return null; } }

// First-touch attribution from the landing page (?ref=landing&cta=hero&aid=…&utm_*)
function captureAttribution() {
  const params = new URLSearchParams(window.location.search);
  const aid = params.get("aid");
  if (aid && /^[\w-]{8,64}$/.test(aid) && !localStorage.getItem(ANON_KEY)) localStorage.setItem(ANON_KEY, aid);
  const keys = ["ref", "cta", "utm_source", "utm_medium", "utm_campaign", "utm_content"];
  const found = Object.fromEntries(keys.map(k => [k, params.get(k)]).filter(([, v]) => v));
  if (Object.keys(found).length && !getAttribution()) {
    localStorage.setItem(ATTR_KEY, JSON.stringify({ ...found, referrer: document.referrer || undefined, firstSeen: new Date().toISOString() }));
  }
  // Keep the address bar clean once captured
  if (aid || Object.keys(found).length) {
    keys.concat("aid").forEach(k => params.delete(k));
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }
}

function track(event, props = {}, board) {
  const body = JSON.stringify({ event, anonId: getAnonId(), email: getUser()?.email, board, props: { ...props, ref: getAttribution()?.ref } });
  fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

// ─── EMAIL CAPTURE (onboarding) ─────────────────────────────────────────────
function EmailCapture({ title, subtitle, cta, context, onDone, onBack }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { track("onboarding_view", { context }); }, [context]);

  async function submit(e) {
    e?.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) { setError("Please enter a valid email address"); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: value, name: name.trim(), marketing, attribution: getAttribution() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      const user = { email: value, name: name.trim() };
      saveUser(user);
      track("email_submitted", { context, marketing });
      onDone(user);
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "We couldn’t reach Nest Well. Check your connection and try again." : err.message);
    } finally { setBusy(false); }
  }

  const field = { width: "100%", padding: "13px 18px", border: "1px solid rgba(43,37,33,0.14)", borderRadius: 99, fontSize: 14, fontFamily: "'Manrope', sans-serif", color: "#2b2521", outline: "none", background: "#fbf8f3" };
  return (
    <form onSubmit={submit} style={{ background: "#fbf8f3", border: "1px solid rgba(43,37,33,0.10)", borderRadius: 26, padding: 24, textAlign: "left", animation: "fadeUp 0.3s ease", boxShadow: "0 30px 60px -36px rgba(91,76,63,0.55)" }}>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 28, fontWeight: 500, lineHeight: 1.1, color: "#2b2521" }}>{title}</div>
      <p style={{ fontSize: 13.5, color: "#5b4c3f", lineHeight: 1.55, margin: "8px 0 18px" }}>{subtitle}</p>
      <label style={labelSt}>Email</label>
      <input type="email" autoFocus value={email} onChange={e => { setEmail(e.target.value); setError(""); }} placeholder="you@example.com" autoComplete="email" style={{ ...field, marginBottom: 12 }} />
      <label style={labelSt}>First name <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>(optional)</span></label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="So your partner knows who’s who" autoComplete="given-name" style={{ ...field, marginBottom: 14 }} />
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, color: "#5b4c3f", lineHeight: 1.45, cursor: "pointer", marginBottom: 16 }}>
        <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} style={{ marginTop: 2, accentColor: "#a3462b", width: 15, height: 15, flexShrink: 0 }} />
        Send me occasional house-hunting tips and product news. Unsubscribe anytime.
      </label>
      {error && <div style={{ fontSize: 12.5, color: "#9b3b2a", marginBottom: 12 }}>{error}</div>}
      <button type="submit" disabled={busy} style={{ ...primaryBtnSt, width: "100%", padding: "15px", fontSize: 15, opacity: busy ? 0.7 : 1 }}>{busy ? "One moment…" : cta}</button>
      <p style={{ fontSize: 11.5, color: "#8b7f72", lineHeight: 1.5, marginTop: 12, textAlign: "center" }}>
        We use your email to keep your boards safe and send receipts. We never share it.
      </p>
      {onBack && <button type="button" onClick={onBack} style={{ display: "block", margin: "10px auto 0", background: "none", border: "none", color: "#8b7f72", fontSize: 12.5, cursor: "pointer", fontFamily: "'Manrope', sans-serif", textDecoration: "underline" }}>← Back</button>}
    </form>
  );
}

// ─── PAYWALL ────────────────────────────────────────────────────────────────
function Paywall({ reason, homesCount, scoredCount, entitlement, boardCode, user, onClose, onUnlocked }) {
  const narrow = useNarrow();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const upgradeOnly = entitlement.plan === "ten";
  useEffect(() => { track("paywall_shown", { reason, homes: homesCount, scored: scoredCount, plan: entitlement.plan }, boardCode); }, []);

  async function choose(plan) {
    setBusy(plan); setError("");
    track("plan_selected", { plan, reason }, boardCode);
    try {
      track("checkout_started", { plan }, boardCode);
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ board: boardCode, email: user?.email, plan, returnUrl: window.location.origin + window.location.pathname }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Checkout didn’t start. Please try again.");
      if (data.url) { window.location.href = data.url; return; }
      onUnlocked(data);
    } catch (err) { setError(err.message); setBusy(null); }
  }

  const heading = reason === "homes" ? "Room for more homes" : reason === "upgrade" ? "Unlock your board" : "Keep scoring every viewing";
  const sub = reason === "homes"
    ? `You’ve reached ${homesCount} homes on this board. Unlock it to keep adding.`
    : `You’ve added ${homesCount} home${homesCount === 1 ? "" : "s"} and scored ${scoredCount}. Unlock this board to score every viewing and compare them all.`;
  const plans = [
    !upgradeOnly && { id: "ten", name: "Search", price: "£8", tag: "For a short search", features: ["Up to 10 homes", "Unlimited scorecards", "One board", "Everyone on the board included"] },
    { id: "unlimited", name: "Unlimited", price: "£15", tag: "Best value", features: ["Unlimited homes", "Unlimited boards", "Unlimited scorecards", "Everyone on your boards included"] },
  ].filter(Boolean);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(43,37,33,0.32)", backdropFilter: "blur(10px)", display: "flex", alignItems: narrow ? "flex-end" : "center", justifyContent: "center", padding: narrow ? 0 : 20, animation: narrow ? "slideUp 0.28s ease" : "fadeUp 0.2s ease" }}
      onClick={e => { if (e.target === e.currentTarget) { track("paywall_dismissed", { reason }, boardCode); onClose(); } }}>
      <div style={{ width: "100%", maxWidth: narrow ? "100%" : 720, maxHeight: "94vh", overflowY: "auto", background: "#f6f1ea", borderRadius: narrow ? "28px 28px 0 0" : 30, padding: narrow ? "26px 18px 24px" : "36px 36px 28px", boxShadow: "0 40px 80px -30px rgba(43,37,33,0.6)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ ...labelSt, marginBottom: 10 }}>{boardCode} · {homesCount} homes · {scoredCount} scored</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: narrow ? 34 : 44, fontWeight: 500, lineHeight: 1, color: "#2b2521" }}>{heading}</h2>
          <p style={{ fontSize: 14, color: "#5b4c3f", lineHeight: 1.55, marginTop: 10, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>{sub}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: !narrow && plans.length > 1 ? "1fr 1fr" : "1fr", gap: 14 }}>
          {plans.map(pl => {
            const best = pl.id === "unlimited";
            return (
              <div key={pl.id} style={{ position: "relative", background: best ? "#fbf8f3" : "rgba(251,248,243,0.55)", border: best ? "1.5px solid #a3462b" : "1px solid rgba(43,37,33,0.12)", borderRadius: 22, padding: "22px 22px 20px", boxShadow: best ? "0 24px 44px -30px rgba(163,70,43,0.7)" : "none", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600 }}>{pl.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 9px", borderRadius: 99, background: best ? "#a3462b" : "#e3d8c9", color: best ? "#fbf5ee" : "#5b4c3f" }}>{pl.tag}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 4px" }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 500, lineHeight: 1, color: best ? "#a3462b" : "#2b2521" }}>{pl.price}</span>
                  <span style={{ fontSize: 12.5, color: "#8b7f72" }}>one payment</span>
                </div>
                <div style={{ fontSize: 12.5, color: "#5b4c3f", marginBottom: 14 }}>{best ? "Unlimited homes, forever." : "Everything you need for one search."}</div>
                <ul style={{ listStyle: "none", display: "grid", gap: 8, marginBottom: 18, flex: 1 }}>
                  {pl.features.map(f => (
                    <li key={f} style={{ display: "flex", gap: 9, fontSize: 13.5, color: "#2b2521", alignItems: "center" }}>
                      <Icon icon="solar:check-circle-bold" width={16} style={{ color: best ? "#a3462b" : "#5f6b3a", flexShrink: 0 }} /> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => choose(pl.id)} disabled={!!busy}
                  style={best ? { ...primaryBtnSt, width: "100%", padding: 14, fontSize: 14, opacity: busy && busy !== pl.id ? 0.6 : 1 } : { ...ghostBtnSt, width: "100%", padding: 13, fontSize: 14, opacity: busy && busy !== pl.id ? 0.6 : 1 }}>
                  {busy === pl.id ? "Opening checkout…" : `Unlock with ${pl.name} · ${pl.price}`}
                </button>
              </div>
            );
          })}
        </div>

        {error && <div style={{ fontSize: 13, color: "#9b3b2a", textAlign: "center", marginTop: 14 }}>{error}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 18px", marginTop: 18, fontSize: 12, color: "#8b7f72" }}>
          <span>✓ One payment covers everyone on this board</span>
          <span>✓ No subscription</span>
          {entitlement.demo && <span style={{ color: "#a3462b" }}>Demo mode: no card needed</span>}
        </div>
        <button onClick={() => { track("paywall_dismissed", { reason }, boardCode); onClose(); }}
          style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: "#8b7f72", fontSize: 13, cursor: "pointer", fontFamily: "'Manrope', sans-serif", textDecoration: "underline" }}>
          Not now
        </button>
      </div>
    </div>
  );
}

// ─── LANDING PAGE ─────────────────────────────────────────────────────────────
function LandingPage({ onStart, onJoin, migrationCode, starting, user, onUser }) {
  const [showJoin, setShowJoin] = useState(false)
  const [pending, setPending] = useState(null) // { type: 'start', name } | { type: 'join', code } waiting on email
  const [codeInput, setCodeInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [error, setError] = useState('')

  function handleJoin() {
    const code = codeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (code.length < 4) { setError('Enter a valid board code'); return }
    if (!user) { setPending({ type: 'join', code }); return }
    onJoin(code)
  }

  function handleStart() {
    if (!user) { setPending({ type: 'start', name: nameInput.trim() }); return }
    onStart(nameInput.trim())
  }

  function emailDone(u) {
    onUser(u)
    if (pending.type === 'start') onStart(pending.name)
    else onJoin(pending.code)
  }

  const field = { width: '100%', padding: '13px 18px', border: '1px solid rgba(43,37,33,0.14)', borderRadius: 99, fontSize: 14, fontFamily: "'Manrope', sans-serif", color: '#2b2521', outline: 'none', background: '#fbf8f3' }
  return (
    <div style={{ minHeight: '100vh', ...PLASTER_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Manrope', sans-serif", color: '#2b2521', position: 'relative', overflow: 'hidden' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Manrope:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } input::placeholder { color: #a89a8a; }`}</style>
      {/* Soft limewashed arch behind the content */}
      <div style={{ position: 'absolute', top: '8vh', left: '50%', transform: 'translateX(-50%)', width: 'min(560px, 92vw)', height: '120vh', borderRadius: '999px 999px 0 0', background: 'linear-gradient(#f6efe5, rgba(246,239,229,0))', pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: 400, animation: 'fadeUp 0.4s ease', position: 'relative' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 38 }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 64, fontWeight: 500, color: '#2b2521', letterSpacing: '-0.02em', lineHeight: 1 }}>
            Nest <span style={{ color: '#a3462b' }}>Well</span>
          </h1>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#5b4c3f', marginTop: 14, lineHeight: 1.25 }}>
            House hunting, kept calm.
          </p>
          <p style={{ fontSize: 13.5, color: '#8b7f72', marginTop: 10, lineHeight: 1.6 }}>
            Every agent, viewing and gut feeling in one place.<br />Score each home and decide together.
          </p>
        </div>

        {/* Migration recovery — shown when existing data found */}
        {migrationCode && (
          <div style={{ background: '#fbf8f3', border: '1px solid rgba(43,37,33,0.10)', borderRadius: 22, padding: '18px 20px', marginBottom: 16, animation: 'fadeUp 0.3s ease' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Welcome back</div>
            <p style={{ fontSize: 13, color: '#5b4c3f', lineHeight: 1.5, marginBottom: 12 }}>We found your homes from before. Open your board to carry on where you left off.</p>
            <button onClick={() => onJoin(migrationCode)} style={{ ...primaryBtnSt, width: '100%', padding: '12px' }}>
              Open my board →
            </button>
          </div>
        )}

        {pending ? (
          <EmailCapture
            context={pending.type === 'start' ? 'start' : 'join'}
            title={pending.type === 'start' ? 'Where should we keep your board?' : 'Join the search'}
            subtitle={pending.type === 'start' ? 'Add your email and we’ll keep your homes, scores and notes safe, so you can come back from any device.' : `You’re joining board ${pending.code}. Add your email so everyone knows who’s scoring what.`}
            cta={pending.type === 'start' ? 'Start my home search →' : 'Join the board →'}
            onDone={emailDone}
            onBack={() => setPending(null)}
          />
        ) : (<>
        {/* Start new board */}
        <div style={{ marginBottom: 12 }}>
          <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Name your board (optional, e.g. London 2026)"
            style={{ ...field, marginBottom: 10 }} />
          <button onClick={handleStart} disabled={starting} style={{ ...primaryBtnSt, width: '100%', padding: '16px', fontSize: 15, background: starting ? '#e3d8c9' : '#a3462b', color: starting ? '#8b7f72' : '#fbf5ee', boxShadow: starting ? 'none' : primaryBtnSt.boxShadow, cursor: starting ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
            {starting ? 'Creating your board…' : 'Start my home search →'}
          </button>
        </div>

        {/* Join existing board */}
        {!showJoin ? (
          <button onClick={() => setShowJoin(true)} style={{ ...ghostBtnSt, width: '100%', padding: '13px', fontSize: 14 }}>
            I have a board code
          </button>
        ) : (
          <div style={{ border: '1px solid rgba(43,37,33,0.10)', borderRadius: 22, padding: 18, background: '#fbf8f3' }}>
            <label style={labelSt}>Enter board code</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={codeInput} onChange={e => { setCodeInput(e.target.value.toUpperCase()); setError('') }} onKeyDown={e => e.key === 'Enter' && handleJoin()} placeholder="e.g. NW4X7K" autoFocus
                style={{ ...field, flex: 1, minWidth: 0, background: '#f6f1ea', fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, letterSpacing: '0.18em', padding: '8px 18px' }} />
              <button onClick={handleJoin} style={{ ...primaryBtnSt, padding: '10px 20px' }}>Join</button>
            </div>
            {error && <div style={{ fontSize: 12, color: '#9b3b2a', marginTop: 8 }}>{error}</div>}
          </div>
        )}

        </>)}

        <p style={{ textAlign: 'center', fontSize: 12, color: '#8b7f72', marginTop: 22, lineHeight: 1.6 }}>
          Each board is private. Bookmark your link to come back anytime,<br />or share it with whoever you’re searching with.
        </p>
      </div>
    </div>
  )
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────
export default function NestWell() {
  const [boardCode, setBoardCode] = useState(null);
  const [boardName, setBoardName] = useState('');
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [boardMenuName, setBoardMenuName] = useState('');
  const [migrationCode, setMigrationCode] = useState(null);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const boardMenuRef = useRef(null);
  const [properties, setProperties] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [overviewProp, setOverviewProp] = useState(null);
  const [scoringProp, setScoringProp] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const narrow = useNarrow();       // < 768px — full mobile
  const medium = useNarrow(823);    // < 823px — icon-only header links
  const isRemoteUpdate = useRef(false);
  const [user, setUser] = useState(() => getUser());
  const [entitlement, setEntitlement] = useState(FREE_ENTITLEMENT);
  const [paywall, setPaywall] = useState(null); // { reason: 'score' | 'homes' | 'upgrade' }
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);
  function toast(msg) { setToastMsg(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToastMsg(""), 3200); }

  // On mount: read board code from URL, or check for migration
  useEffect(() => {
    captureAttribution();
    track("app_open", { path: window.location.pathname });
    const params = new URLSearchParams(window.location.search);
    const code = params.get('board');
    if (code) {
      setBoardCode(code.toUpperCase());
    } else {
      fetch('/api/migration').then(r => r.json())
        .then(res => { if (res.ok && res.code) setMigrationCode(res.code); })
        .catch(() => {});
    }
  }, []);

  // Plan for this board (free / Search / Unlimited)
  useEffect(() => {
    if (!boardCode || !user) return;
    fetch(`/api/entitlement?board=${boardCode}&email=${encodeURIComponent(user.email)}`).then(r => r.json())
      .then(res => { if (res.ok) setEntitlement(res); }).catch(() => {});
  }, [boardCode, user]);

  // Returning from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("checkout");
    if (!boardCode || !status) return;
    const sessionId = params.get("session_id");
    params.delete("checkout"); params.delete("session_id");
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    if (status === "success" && sessionId) {
      fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`).then(r => r.json())
        .then(res => { if (res.ok) { setEntitlement(res); toast(`Board unlocked: ${PLAN_INFO[res.plan]?.name || "Paid"} plan`); } else toast("Payment is still processing, refresh in a moment."); })
        .catch(() => {});
    } else if (status === "cancelled") toast("Checkout cancelled. Your board is just as you left it.");
  }, [boardCode]);

  function claimBoard(code) {
    const u = getUser();
    track("board_created", {}, code);
    if (!u) return;
    fetch("/api/entitlement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ board: code, email: u.email }) })
      .then(r => r.json()).then(res => { if (res.ok) setEntitlement(res); }).catch(() => {});
  }

  async function handleCreateBoard(name = '') {
    setStarting(true);
    try {
      const res = await fetch('/api/boards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) { window.history.pushState({}, '', `?board=${data.code}`); setBoardCode(data.code); setBoardName(name); setStarting(false); claimBoard(data.code); return; }
      }
    } catch {}
    // Fallback: generate locally (dev / no db)
    const code = generateClientCode();
    window.history.pushState({}, '', `?board=${code}`);
    setBoardCode(code);
    setBoardName(name);
    setStarting(false);
    claimBoard(code);
  }

  async function saveBoardName(name) {
    setBoardName(name);
    if (!boardCode) return;
    fetch(`/api/boards/${boardCode}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).catch(() => {});
  }

  function handleGoHome() {
    window.history.pushState({}, '', '/');
    setBoardCode(null);
    setBoardName('');
    setDataLoaded(false);
    setProperties([]);
  }

  function handleJoinBoard(code) {
    track("board_joined", {}, code);
    window.history.pushState({}, '', `?board=${code}`);
    setBoardCode(code);
  }

  // Close board menu on outside click
  useEffect(() => {
    if (!showBoardMenu) return;
    function handleClick(e) { if (boardMenuRef.current && !boardMenuRef.current.contains(e.target)) setShowBoardMenu(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showBoardMenu]);

  // Load data when board code is set
  useEffect(() => {
    if (!boardCode) return;
    fetch(`/api/boards/${boardCode}`)
      .then(r => r.json())
      .then(res => {
        if (res.ok && Array.isArray(res.data)) { setProperties(res.data); if (res.name) setBoardName(res.name); }
        else throw new Error('not found');
      })
      .catch(() => {
        const saved = localStorage.getItem(`nest-well-board-${boardCode}`);
        if (saved) try { setProperties(JSON.parse(saved)); } catch {}
      })
      .finally(() => setDataLoaded(true));
  }, [boardCode]);

  // Auto-save on every local change
  useEffect(() => {
    if (!dataLoaded || !boardCode) return;
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    localStorage.setItem(`nest-well-board-${boardCode}`, JSON.stringify(properties));
    fetch(`/api/boards/${boardCode}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: properties }),
    }).catch(() => {});
  }, [properties, dataLoaded, boardCode]);

  // Poll every 30s for changes from other devices
  useEffect(() => {
    if (!dataLoaded || !boardCode) return;
    const interval = setInterval(() => {
      fetch(`/api/boards/${boardCode}`).then(r => r.json()).then(res => {
        if (res.ok && Array.isArray(res.data)) { isRemoteUpdate.current = true; setProperties(prev => mergeProperties(prev, res.data)); }
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [dataLoaded, boardCode]);

  function addProperty(prop) {
    track("listing_added", { method: prop.url ? "link" : "manual", status: prop.status, count: activeCount + 1 }, boardCode);
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
    track("scorecard_saved", { total: getTotal(updated.scores) + getBonusTotal(updated.bonuses) }, boardCode);
    // Optimistic local update
    setProperties(prev => prev.map(p => p.id === updated.id
      ? { ...p, scores: updated.scores, bonuses: updated.bonuses, status: "viewed", updatedAt: ts }
      : p
    ));
    // Explicit merge-save: fetch latest server state, apply update, write back
    // This prevents another device's stale auto-save from overwriting bonuses
    try {
      const res = await fetch(`/api/boards/${boardCode}`).then(r => r.json());
      if (res.ok && Array.isArray(res.data)) {
        const exists = res.data.some(p => p.id === updated.id);
        const merged = exists
          ? res.data.map(p => p.id === updated.id
              ? { ...p, scores: updated.scores, bonuses: updated.bonuses, status: "viewed", updatedAt: ts }
              : p)
          : [...res.data, { ...updated, updatedAt: ts }];
        await fetch(`/api/boards/${boardCode}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: merged }),
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
  const activeCount = properties.filter(p => p.status !== "archived").length;

  // ── Free tier & paywall ──
  // Free: score one home, then the paywall appears when starting a 2nd scorecard on a board with 3+ homes.
  // Every plan except Unlimited caps the number of homes on the board.
  function requestAdd() {
    if (entitlement.homes != null && activeCount >= entitlement.homes) { setPaywall({ reason: "homes" }); return; }
    setShowAdd(true);
  }
  function requestScoring(prop) {
    const alreadyScored = prop.scores && Object.keys(prop.scores).length > 0;
    if (entitlement.plan === "free" && !alreadyScored && activeCount >= (entitlement.freeScoreAfter ?? 3) && scoredCount >= 1) {
      setPaywall({ reason: "score" });
      return;
    }
    track("scorecard_started", { rescore: !!alreadyScored }, boardCode);
    setScoringProp(prop);
  }
  function handleUnlocked(res) {
    setEntitlement(res);
    setPaywall(null);
    toast(`Board unlocked: ${PLAN_INFO[res.plan]?.name} plan. Happy hunting!`);
  }
  const archivedCount = properties.filter(p => p.status === "archived").length;

  // Show landing page until a board code is set
  if (!boardCode) {
    return <LandingPage onStart={handleCreateBoard} onJoin={handleJoinBoard} migrationCode={migrationCode} starting={starting} user={user} onUser={setUser} />;
  }

  // Opened a shared board link without an email yet
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", ...PLASTER_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Manrope', sans-serif", color: "#2b2521" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Manrope:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } input::placeholder { color: #a89a8a; }`}</style>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ textAlign: "center", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 44, fontWeight: 500, marginBottom: 22 }}>Nest <span style={{ color: "#a3462b" }}>Well</span></div>
          <EmailCapture context="shared-link" title={`You’ve been invited to ${boardName || `board ${boardCode}`}`}
            subtitle="Add your email to see the homes, viewings and scores, and add your own thoughts."
            cta="Open the board →"
            onDone={u => { setUser(u); track("board_joined", { via: "link" }, boardCode); }} />
        </div>
      </div>
    );
  }

  // Greeting strip — a calm summary of where the search is
  const active = properties.filter(p => p.status !== "archived");
  const booked = active.filter(p => p.status === "booked" && p.viewingDate).sort((a, b) => new Date(a.viewingDate) - new Date(b.viewingDate));
  const seenCount = active.filter(p => p.status === "viewed").length;
  const favourite = [...active].filter(p => p.scores && Object.keys(p.scores).length > 0)
    .sort((a, b) => (getTotal(b.scores) + getBonusTotal(b.bonuses)) - (getTotal(a.scores) + getBonusTotal(a.bonuses)))[0];
  const favTotal = favourite ? getTotal(favourite.scores) + getBonusTotal(favourite.bonuses) : null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening.";
  const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  const word = n => WORDS[n] || String(n);
  const shortName = p => (p.name || p.address || "").split(",")[0];
  const when = iso => {
    const d = new Date(iso), h = d.getHours(), m = d.getMinutes();
    const time = `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`;
    return `${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })} at ${time}`;
  };
  const headline = booked.length
    ? <>{greeting} <em style={{ color: "#a3462b" }}>{word(booked.length)} viewing{booked.length > 1 ? "s" : ""}</em> booked.</>
    : active.length
      ? <>{greeting} <em style={{ color: "#a3462b" }}>{word(active.length)} home{active.length > 1 ? "s" : ""}</em> on your board.</>
      : <>{greeting} <em style={{ color: "#a3462b" }}>Let’s find your home.</em></>;
  const subline = [
    booked.length ? booked.slice(0, 2).map(p => `${shortName(p)} on ${when(p.viewingDate)}`).join(", ") + "." : null,
    favourite ? `${shortName(favourite)} is your favourite so far.` : null,
    !active.length ? "Paste a link from Rightmove, Zoopla or any agent to add your first home." : null,
  ].filter(Boolean).join(" ");

  const navBtn = { background: "none", border: "none", color: "#8b7f72", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Manrope', sans-serif", padding: "9px 14px", borderRadius: 99, display: "flex", alignItems: "center", gap: 6 };
  const badge = (n, bg) => <span style={{ position: "absolute", top: 2, right: 2, background: bg, color: "#fbf5ee", fontSize: 9, fontWeight: 700, borderRadius: 99, minWidth: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1 }}>{n}</span>;

  return (
    <div style={{
      minHeight: "100vh",
      ...PLASTER_BG,
      fontFamily: "'Manrope', sans-serif",
      color: "#2b2521",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Manrope:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(43,37,33,0.14); border-radius: 6px; }
        button:focus, input:focus, select:focus, textarea:focus { outline: none; }
        input[type="date"], input[type="time"] { color-scheme: light; }
        ::selection { background: #f1ddd2; }
      `}</style>

      {/* HEADER */}
      <div style={{
        borderBottom: "1px solid rgba(43,37,33,0.10)", padding: narrow ? "0 16px" : "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: narrow ? 62 : 72, position: "sticky", top: 0, zIndex: 50,
        background: "rgba(243,236,226,0.85)", backdropFilter: "blur(14px)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: narrow ? 10 : 18, minWidth: 0 }}>
          <h1 onClick={handleGoHome} style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: narrow ? 25 : 30, fontWeight: 500, letterSpacing: "-0.01em", color: "#2b2521", cursor: "pointer", whiteSpace: "nowrap", lineHeight: 1 }} title="Back to home">
            Nest <span style={{ color: "#a3462b" }}>Well</span>
          </h1>
          {/* Board name dropdown trigger */}
          <div ref={boardMenuRef} style={{ position: "relative", borderLeft: "1px solid rgba(43,37,33,0.12)", paddingLeft: narrow ? 10 : 18 }}>
            <button onClick={() => { if (!showBoardMenu) setBoardMenuName(boardName); setShowBoardMenu(v => !v); }}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'Manrope', sans-serif", display: "flex", alignItems: "center", gap: 8 }}>
              {narrow ? (
                <Icon icon="solar:settings-bold" width={17} style={{ color: showBoardMenu ? "#a3462b" : "#8b7f72" }} />
              ) : (
                <>
                  <span style={{ fontSize: 13, color: boardName ? "#5b4c3f" : "#b8ab9c", fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{boardName ? (boardName.length > 25 ? boardName.slice(0, 25) + "…" : boardName) : "Unnamed board"}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", color: "#8b7f72", padding: "4px 8px", border: "1px solid rgba(43,37,33,0.2)", borderRadius: 99 }}>{boardCode}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 8px", borderRadius: 99, background: entitlement.plan === "free" ? "#e3d8c9" : entitlement.plan === "unlimited" ? "#a3462b" : "#5f6b3a", color: entitlement.plan === "free" ? "#5b4c3f" : "#fbf5ee" }}>{PLAN_INFO[entitlement.plan]?.name}</span>
                  <Icon icon="solar:alt-arrow-down-bold" width={12} style={{ color: "#b8ab9c", transition: "transform 0.15s", transform: showBoardMenu ? "rotate(180deg)" : "rotate(0deg)" }} />
                </>
              )}
            </button>
            {showBoardMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 14px)", left: 0, background: "#fbf8f3", border: "1px solid rgba(43,37,33,0.10)", borderRadius: 22, boxShadow: "0 30px 60px -30px rgba(91,76,63,0.55)", padding: 20, width: 300, zIndex: 200, animation: "fadeUp 0.15s ease" }}>
                <label style={labelSt}>Board name</label>
                <input autoFocus value={boardMenuName} onChange={e => setBoardMenuName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { saveBoardName(boardMenuName); setShowBoardMenu(false); } if (e.key === 'Escape') setShowBoardMenu(false); }}
                  placeholder="e.g. London 2026"
                  style={{ ...inputSt, padding: "10px 14px", marginBottom: 10 }} />
                <button onClick={() => { saveBoardName(boardMenuName); setShowBoardMenu(false); }}
                  style={{ ...primaryBtnSt, width: "100%", padding: "10px", marginBottom: 16 }}>
                  Save name
                </button>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderTop: "1px solid rgba(43,37,33,0.10)", padding: "14px 0" }}>
                  <div>
                    <div style={labelSt}>Your plan</div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, marginTop: -4 }}>
                      {PLAN_INFO[entitlement.plan]?.name}{entitlement.homes != null && <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 500, color: "#8b7f72" }}> · {activeCount}/{entitlement.homes} homes</span>}
                    </div>
                  </div>
                  {entitlement.plan !== "unlimited" && (
                    <button onClick={() => { setShowBoardMenu(false); setPaywall({ reason: "upgrade" }); }} style={{ ...primaryBtnSt, padding: "8px 14px", fontSize: 12 }}>Upgrade</button>
                  )}
                </div>
                <div style={{ borderTop: "1px solid rgba(43,37,33,0.10)", paddingTop: 16 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Search together</div>
                  <p style={{ fontSize: 12.5, color: "#8b7f72", lineHeight: 1.5, marginBottom: 12 }}>Anyone with this code sees the same board, with viewings, scores and notes.</p>
                  <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
                    {boardCode.split("").map((ch, i) => (
                      <span key={i} style={{ flex: 1, height: 42, display: "grid", placeItems: "center", fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500, background: "#f6f1ea", border: "1px solid rgba(43,37,33,0.10)", borderRadius: "12px 12px 6px 6px" }}>{ch}</span>
                    ))}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    style={{ width: "100%", padding: "10px", background: copied ? "#eef0e2" : "#f6f1ea", border: `1px solid ${copied ? "#cfd3b4" : "rgba(43,37,33,0.14)"}`, borderRadius: 99, color: copied ? "#5f6b3a" : "#5b4c3f", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Manrope', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s" }}>
                    <Icon icon={copied ? "solar:check-bold" : "solar:copy-bold"} width={13} />
                    {copied ? "Link copied!" : "Copy share link"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: narrow ? 4 : 8, alignItems: "center" }}>
          {archivedCount > 0 && (
            narrow || medium ? (
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowArchive(true)} style={{ ...navBtn, padding: 8 }} title={`Archive (${archivedCount})`}>
                  <Icon icon="solar:archive-bold" width={18} />
                </button>
                {narrow && badge(archivedCount, "#8b7f72")}
              </div>
            ) : (
              <button onClick={() => setShowArchive(true)} style={navBtn}>
                <Icon icon="solar:archive-bold" width={14} /> Archive ({archivedCount})
              </button>
            )
          )}
          {scoredCount > 0 && (
            narrow || medium ? (
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowLeaderboard(true)} style={{ ...navBtn, color: "#a3462b", padding: 8 }} title={`Favourites (${scoredCount})`}>
                  <Icon icon="solar:cup-star-bold" width={18} />
                </button>
                {narrow && badge(scoredCount, "#a3462b")}
              </div>
            ) : (
              <button onClick={() => setShowLeaderboard(true)} style={{ ...navBtn, color: "#2b2521", background: "#fbf8f3", boxShadow: "0 10px 24px -16px rgba(91,76,63,0.55)" }}>
                <Icon icon="solar:cup-star-bold" width={14} style={{ color: "#a3462b" }} /> Favourites ({scoredCount})
              </button>
            )
          )}
          {!narrow && (
            <button onClick={requestAdd} style={{ ...primaryBtnSt, padding: "12px 22px", marginLeft: 8 }}>
              ＋ Add a home
            </button>
          )}
        </div>
      </div>

      {/* GREETING */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 32, padding: narrow ? "22px 16px 6px" : "28px 32px 14px", animation: "fadeUp 0.4s ease" }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: narrow ? 30 : 44, lineHeight: 1.02, letterSpacing: "-0.015em" }}>{headline}</h2>
          {subline && <p style={{ fontSize: narrow ? 13 : 14, color: "#8b7f72", marginTop: 8, lineHeight: 1.5 }}>{subline}</p>}
        </div>
        {!narrow && active.length > 0 && (
          <div style={{ display: "flex", gap: 26, marginLeft: "auto", paddingBottom: 4 }}>
            {[[active.length, "Homes"], [seenCount, "Seen"], ...(favTotal != null ? [[favTotal, "Top score"]] : [])].map(([n, l]) => (
              <div key={l} style={{ borderLeft: "1px solid rgba(43,37,33,0.2)", paddingLeft: 16 }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 500, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8b7f72", marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KANBAN */}
      <div style={narrow ? {
        display: "flex", flexDirection: "column", gap: 8, padding: "8px 16px 110px",
      } : {
        display: "grid", gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", gap: 20,
        padding: "8px 32px 40px", overflowX: "auto", alignItems: "start",
      }}>
        {COLUMNS.map(col => {
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
            <div key={col.id} style={{ minWidth: 0, paddingTop: narrow ? 14 : 0 }}>
              <div style={{ marginBottom: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 4px 8px", borderBottom: "1px solid rgba(43,37,33,0.10)" }}>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 25, fontWeight: 500, lineHeight: 1, color: "#2b2521" }}>{col.label}</div>
                  <div style={{ fontSize: 11, color: "#8b7f72", marginTop: 4 }}>{col.sub}</div>
                </div>
                <span style={{ background: "#e3d8c9", borderRadius: 99, padding: "4px 9px", fontSize: 11, fontWeight: 600, color: "#5b4c3f" }}>
                  {colProps.length}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {colProps.map(p => (
                  <PropertyCard key={p.id} property={p} onOpen={handleCardOpen} onDelete={deleteProperty} onMove={moveProperty} onUpdate={updateProperty} />
                ))}
                {col.id === "listing" ? (
                  <button onClick={requestAdd} style={{ border: "1.5px dashed #d6c8b6", borderRadius: 20, padding: "18px 14px", background: "transparent", color: "#8b7f72", fontSize: 12.5, cursor: "pointer", fontFamily: "'Manrope', sans-serif", textAlign: "center" }}>
                    <span style={{ display: "block", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 20, fontWeight: 500, color: "#2b2521", marginBottom: 3 }}>{colProps.length ? "Found another?" : "Add your first home"}</span>
                    Paste a Rightmove, Zoopla or agent link
                  </button>
                ) : colProps.length === 0 && (
                  <div style={{ height: narrow ? 52 : 96, borderRadius: 20, border: "1.5px dashed rgba(43,37,33,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 17, color: "#b8ab9c" }}>
                    Nothing here yet
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CIRCULAR FAB — mobile only */}
      {narrow && (
        <button onClick={requestAdd} style={{
          position: "fixed", bottom: 24, right: 20, zIndex: 90,
          width: 56, height: 56, borderRadius: "50%",
          background: "#a3462b",
          border: "none", color: "#fff", cursor: "pointer",
          boxShadow: "0 12px 26px -10px rgba(163,70,43,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} title="Add a home">
          <Icon icon="solar:add-circle-bold" width={28} />
        </button>
      )}

      {/* MODALS & OVERLAYS */}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={addProperty} />}

      {overviewProp && !scoringProp && (
        <PropertyOverview
          property={(() => properties.find(p => p.id === overviewProp.id) || overviewProp)()}
          onClose={() => setOverviewProp(null)}
          onDelete={deleteProperty}
          onStartScoring={() => requestScoring(properties.find(p => p.id === overviewProp.id) || overviewProp)}
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

      {paywall && (
        <Paywall reason={paywall.reason} homesCount={activeCount} scoredCount={scoredCount} entitlement={entitlement}
          boardCode={boardCode} user={user} onClose={() => setPaywall(null)} onUnlocked={handleUnlocked} />
      )}

      {toastMsg && (
        <div style={{ position: "fixed", left: "50%", bottom: narrow ? 96 : 28, transform: "translateX(-50%)", zIndex: 400, background: "#2b2521", color: "#f6f1ea", fontSize: 13, fontWeight: 500, padding: "12px 18px", borderRadius: 99, boxShadow: "0 20px 40px -20px rgba(43,37,33,0.8)", animation: "fadeUp 0.25s ease", whiteSpace: "nowrap" }}>
          {toastMsg}
        </div>
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
  display: "block", fontSize: 10, fontWeight: 600, color: "#8b7f72",
  textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 8
};

const inputSt = {
  width: "100%", padding: "12px 16px",
  background: "#f6f1ea", border: "1px solid rgba(43,37,33,0.14)",
  borderRadius: 14, color: "#2b2521", fontSize: 14,
  fontFamily: "'Manrope', sans-serif"
};

const ghostBtnSt = {
  padding: "9px 16px", background: "rgba(251,248,243,0.6)",
  border: "1px solid rgba(43,37,33,0.18)", borderRadius: 99,
  color: "#5b4c3f", fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: "'Manrope', sans-serif"
};

const primaryBtnSt = {
  padding: "12px 20px", background: "#a3462b",
  border: "none", borderRadius: 99, color: "#fbf5ee", fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: "'Manrope', sans-serif",
  boxShadow: "0 10px 22px -12px rgba(163,70,43,0.9)"
};
