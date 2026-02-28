export const CRITERIA = [
  {
    key: 'location',
    emoji: '📍',
    label: 'Location & Commute',
    description: 'How convenient is the location for your daily commute and lifestyle?',
    levels: [
      { score: 1, label: 'Very inconvenient', desc: 'Long commute, poor transport links' },
      { score: 2, label: 'Below average', desc: 'Manageable but not ideal' },
      { score: 3, label: 'Decent', desc: 'Acceptable commute, some amenities nearby' },
      { score: 4, label: 'Good', desc: 'Great transport links, local amenities' },
      { score: 5, label: 'Excellent', desc: 'Perfect location, minimal commute' },
    ],
    keywords: [
      { pattern: /\b(terrible|awful|remote|far|long commute|no transport|isolated)\b/i, score: 1 },
      { pattern: /\b(bit far|slow|limited transport|inconvenient)\b/i, score: 2 },
      { pattern: /\b(ok|okay|fine|decent|alright|reasonable|manageable)\b/i, score: 3 },
      { pattern: /\b(good transport|good location|close to|near (tube|station|bus|shops))\b/i, score: 4 },
      { pattern: /\b(great transport|excellent location|central|perfect commute|walk to (work|tube|station))\b/i, score: 5 },
    ],
  },
  {
    key: 'view',
    emoji: '🪟',
    label: 'View',
    description: 'What do you see from the main windows?',
    levels: [
      { score: 1, label: 'Brick wall / none', desc: 'No view, faces a wall' },
      { score: 2, label: 'Street / neighbours', desc: 'Street-level or overlooked' },
      { score: 3, label: 'Trees / open sky', desc: 'Some greenery or open aspect' },
      { score: 4, label: 'Park / green space', desc: 'Nice park or green views' },
      { score: 5, label: 'Water / landmark', desc: 'River, canal, or landmark view' },
    ],
    keywords: [
      { pattern: /\b(no view|brick wall|facing wall|dark|no window)\b/i, score: 1 },
      { pattern: /\b(street view|overlook|neighbour|road)\b/i, score: 2 },
      { pattern: /\b(tree|trees|garden view|open|nice view)\b/i, score: 3 },
      { pattern: /\b(park view|green space|open space|green|facing park)\b/i, score: 4 },
      { pattern: /\b(river|canal|water view|landmark|skyline|amazing view|stunning view)\b/i, score: 5 },
    ],
  },
  {
    key: 'outdoorSpace',
    emoji: '🌿',
    label: 'Outdoor Space',
    description: 'What outdoor space does the property have?',
    levels: [
      { score: 1, label: 'None', desc: 'No outdoor space at all' },
      { score: 2, label: 'Juliet balcony', desc: 'French doors / Juliet balcony only' },
      { score: 3, label: 'Balcony', desc: 'Proper standing balcony' },
      { score: 4, label: 'Terrace', desc: 'Roof terrace or large outdoor area' },
      { score: 5, label: 'Garden', desc: 'Private garden access' },
    ],
    keywords: [
      { pattern: /\b(no outdoor|no garden|no balcony|no outside space|no terrace)\b/i, score: 1 },
      { pattern: /\b(juliet|french door|french window|small balcony|tiny balcony)\b/i, score: 2 },
      { pattern: /\b(balcony|outside area|small terrace)\b/i, score: 3 },
      { pattern: /\b(terrace|roof terrace|large balcony|rooftop)\b/i, score: 4 },
      { pattern: /\b(garden|private garden|outside space|courtyard|patio)\b/i, score: 5 },
    ],
  },
  {
    key: 'naturalLight',
    emoji: '☀️',
    label: 'Natural Light',
    description: 'How much natural light does the property get?',
    levels: [
      { score: 1, label: 'Very dark', desc: 'Little to no natural light' },
      { score: 2, label: 'Dim', desc: 'Some light but quite dark' },
      { score: 3, label: 'Average', desc: 'Reasonable light in main rooms' },
      { score: 4, label: 'Bright', desc: 'Good natural light throughout' },
      { score: 5, label: 'Sun-drenched', desc: 'Exceptional light, sunny aspect' },
    ],
    keywords: [
      { pattern: /\b(dark|gloomy|no light|very dark|dungeon|cave)\b/i, score: 1 },
      { pattern: /\b(dim|bit dark|not much light|low light|north facing)\b/i, score: 2 },
      { pattern: /\b(ok light|some light|average light|decent light)\b/i, score: 3 },
      { pattern: /\b(bright|good light|lots of light|light|well lit|sunny)\b/i, score: 4 },
      { pattern: /\b(amazing light|sun drenched|flooded with light|south facing|east facing|very bright|extremely bright)\b/i, score: 5 },
    ],
  },
  {
    key: 'sizeLayout',
    emoji: '📐',
    label: 'Size & Layout',
    description: 'How good is the overall size and flow of the space?',
    levels: [
      { score: 1, label: 'Very cramped', desc: 'Tiny rooms, poor layout' },
      { score: 2, label: 'Compact', desc: 'Small but functional' },
      { score: 3, label: 'Adequate', desc: 'Reasonable space and layout' },
      { score: 4, label: 'Spacious', desc: 'Good size, well laid out' },
      { score: 5, label: 'Excellent', desc: 'Very generous space, great flow' },
    ],
    keywords: [
      { pattern: /\b(tiny|cramped|very small|no space|poky|too small)\b/i, score: 1 },
      { pattern: /\b(small|compact|snug|limited space|cosy)\b/i, score: 2 },
      { pattern: /\b(decent size|ok size|reasonable|adequate|fine)\b/i, score: 3 },
      { pattern: /\b(spacious|good size|large|big room|generous|roomy)\b/i, score: 4 },
      { pattern: /\b(very spacious|huge|enormous|excellent layout|great flow|open plan)\b/i, score: 5 },
    ],
  },
  {
    key: 'condition',
    emoji: '🔨',
    label: 'Condition & Finish',
    description: 'What is the overall condition and quality of finishes?',
    levels: [
      { score: 1, label: 'Renovation needed', desc: 'Significant work required' },
      { score: 2, label: 'Tired', desc: 'Dated but liveable' },
      { score: 3, label: 'Good', desc: 'Solid condition, some wear' },
      { score: 4, label: 'Very good', desc: 'Well maintained, modern finishes' },
      { score: 5, label: 'Move-in ready', desc: 'Excellent condition, premium finish' },
    ],
    keywords: [
      { pattern: /\b(needs work|renovation|broken|falling apart|damp|mould|structural)\b/i, score: 1 },
      { pattern: /\b(dated|tired|old|worn|needs update|needs refresh)\b/i, score: 2 },
      { pattern: /\b(good condition|ok|fine|reasonable condition|solid)\b/i, score: 3 },
      { pattern: /\b(nice finish|well maintained|modern|recently renovated|good quality)\b/i, score: 4 },
      { pattern: /\b(excellent condition|pristine|perfect|brand new|high spec|luxury finish|move.?in ready)\b/i, score: 5 },
    ],
  },
  {
    key: 'value',
    emoji: '💰',
    label: 'Value for Money',
    description: 'How good is the price relative to what you get?',
    levels: [
      { score: 1, label: 'Very overpriced', desc: 'Significantly above market rate' },
      { score: 2, label: 'Pricey', desc: 'Above market, hard to justify' },
      { score: 3, label: 'Fair', desc: 'About right for the market' },
      { score: 4, label: 'Good value', desc: 'Slightly under market rate' },
      { score: 5, label: 'Excellent value', desc: 'Great deal for what you get' },
    ],
    keywords: [
      { pattern: /\b(overpriced|too expensive|way too much|rip off|ridiculous price)\b/i, score: 1 },
      { pattern: /\b(expensive|pricey|on the high side|above budget)\b/i, score: 2 },
      { pattern: /\b(fair|reasonable price|market rate|ok price|average price)\b/i, score: 3 },
      { pattern: /\b(good value|reasonable|affordable|good price|good for the price)\b/i, score: 4 },
      { pattern: /\b(great value|excellent value|bargain|steal|underpriced|cheap for what you get)\b/i, score: 5 },
    ],
  },
  {
    key: 'storage',
    emoji: '📦',
    label: 'Storage',
    description: 'How much storage space is available?',
    levels: [
      { score: 1, label: 'No storage', desc: 'Virtually no storage space' },
      { score: 2, label: 'Minimal', desc: 'Very limited storage' },
      { score: 3, label: 'Adequate', desc: 'Some storage, manageable' },
      { score: 4, label: 'Good', desc: 'Good cupboard and storage space' },
      { score: 5, label: 'Excellent', desc: 'Ample storage throughout' },
    ],
    keywords: [
      { pattern: /\b(no storage|no cupboards|nowhere to put|no space for stuff)\b/i, score: 1 },
      { pattern: /\b(limited storage|minimal storage|small cupboard|not much storage)\b/i, score: 2 },
      { pattern: /\b(some storage|ok storage|decent storage|reasonable storage)\b/i, score: 3 },
      { pattern: /\b(good storage|good cupboards|plenty of storage|good wardrobe)\b/i, score: 4 },
      { pattern: /\b(loads of storage|excellent storage|huge cupboard|loads of cupboards|amazing storage)\b/i, score: 5 },
    ],
  },
  {
    key: 'noise',
    emoji: '🔇',
    label: 'Noise & Privacy',
    description: 'How quiet and private is the property?',
    levels: [
      { score: 1, label: 'Very noisy', desc: 'Constant noise, no privacy' },
      { score: 2, label: 'Noisy', desc: 'Regular disturbance' },
      { score: 3, label: 'Average', desc: 'Some noise but acceptable' },
      { score: 4, label: 'Quiet', desc: 'Mostly quiet and private' },
      { score: 5, label: 'Very quiet', desc: 'Peaceful and very private' },
    ],
    keywords: [
      { pattern: /\b(very noisy|extremely loud|constant noise|traffic noise|terrible noise)\b/i, score: 1 },
      { pattern: /\b(noisy|loud|busy road|can hear neighbours|road noise)\b/i, score: 2 },
      { pattern: /\b(some noise|ok noise|average noise|bit of noise|manageable)\b/i, score: 3 },
      { pattern: /\b(quiet|peaceful|not much noise|private|good privacy)\b/i, score: 4 },
      { pattern: /\b(very quiet|silent|extremely quiet|totally private|no noise)\b/i, score: 5 },
    ],
  },
  {
    key: 'building',
    emoji: '🏢',
    label: 'Building & Management',
    description: 'How well maintained is the building and its management?',
    levels: [
      { score: 1, label: 'Poor', desc: 'Neglected building, issues' },
      { score: 2, label: 'Below average', desc: 'Some issues, limited maintenance' },
      { score: 3, label: 'Average', desc: 'Standard maintenance' },
      { score: 4, label: 'Good', desc: 'Well maintained building' },
      { score: 5, label: 'Excellent', desc: 'Premium managed building' },
    ],
    keywords: [
      { pattern: /\b(rundown|neglected|poor building|dirty communal|awful building)\b/i, score: 1 },
      { pattern: /\b(dated building|ok building|some issues|needs work on building)\b/i, score: 2 },
      { pattern: /\b(fine building|average building|standard building|ok communal)\b/i, score: 3 },
      { pattern: /\b(nice building|well maintained building|good communal|managed building)\b/i, score: 4 },
      { pattern: /\b(beautiful building|luxury building|concierge|porter|premium building|amazing building)\b/i, score: 5 },
    ],
  },
]

export const CRITERIA_KEYS = CRITERIA.map(c => c.key)

export function extractSuggestedScores(transcript) {
  const suggestions = {}
  for (const criterion of CRITERIA) {
    let bestScore = null
    let bestPriority = -1
    for (const { pattern, score } of criterion.keywords) {
      if (pattern.test(transcript)) {
        // Higher score = higher priority (more specific positive matches win)
        const priority = score
        if (priority > bestPriority) {
          bestPriority = priority
          bestScore = score
        }
      }
    }
    if (bestScore !== null) {
      suggestions[criterion.key] = bestScore
    }
  }
  return suggestions
}

export function getScoreColor(score, max = 5) {
  const pct = score / max
  if (pct <= 0.2) return '#ef4444'   // red
  if (pct <= 0.4) return '#f97316'   // orange
  if (pct <= 0.6) return '#f59e0b'   // amber
  if (pct <= 0.8) return '#84cc16'   // lime
  return '#10b981'                    // emerald
}

export function getTotalScoreColor(total, max = 50) {
  const pct = total / max
  if (pct >= 0.9) return '#f59e0b'   // gold
  if (pct >= 0.7) return '#10b981'   // green
  if (pct >= 0.5) return '#f59e0b'   // amber
  return '#ef4444'                    // red
}
