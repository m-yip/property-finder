import { useState } from 'react'
import { CRITERIA, getTotalScoreColor, getScoreColor } from '../data/criteria'

const OUTDOOR_LABELS = {
  none: 'None',
  juliet: 'Juliet Balcony',
  balcony: 'Balcony',
  terrace: 'Terrace',
  garden: 'Garden',
}

function InfoPill({ icon, label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex flex-col items-center bg-gray-800 rounded-xl px-4 py-3 text-center min-w-[80px]">
      <span className="text-xl mb-1">{icon}</span>
      <span className="text-xs text-gray-500 mb-0.5">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  )
}

function ScoreCriterionRow({ criterion, score }) {
  const color = getScoreColor(score)
  const level = criterion.levels.find(l => l.score === score)
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl w-8 text-center">{criterion.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{criterion.label}</p>
        {level && <p className="text-xs text-gray-500">{level.label}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {[1, 2, 3, 4, 5].map(s => (
          <div
            key={s}
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: s <= score ? color : '#374151' }}
          />
        ))}
        <span className="text-sm font-bold ml-1" style={{ color }}>{score}</span>
      </div>
    </div>
  )
}

export default function PropertyDetail({ property, rank, onStartScoring, onDelete, onBack }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const isScored = property.status === 'scored'

  const viewingDate = property.viewingDate ? new Date(property.viewingDate) : null
  const now = new Date()
  const isPast = viewingDate && viewingDate < now

  // Countdown
  let countdown = null
  if (viewingDate && !isPast) {
    const diff = viewingDate - now
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    countdown = days > 0 ? `${days}d ${hours}h` : `${hours}h`
  }

  const totalColor = isScored ? getTotalScoreColor(property.totalScore) : null
  const totalPct = isScored ? Math.round((property.totalScore / 50) * 100) : null

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors"
      >
        ← Back to leaderboard
      </button>

      {/* Header card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {/* Hero image */}
        {property.imageUrl && (
          <div className="w-full h-52 bg-gray-800 overflow-hidden">
            <img
              src={property.imageUrl}
              alt={property.address}
              className="w-full h-full object-cover"
              onError={e => { e.target.parentElement.style.display = 'none' }}
            />
          </div>
        )}
        <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white leading-tight">{property.address}</h1>
            {property.url && (
              <a
                href={property.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-500 hover:text-emerald-400 mt-1 inline-flex items-center gap-1 transition-colors"
              >
                View listing ↗
              </a>
            )}
          </div>
          {/* Status badge */}
          {isScored ? (
            <div
              className="flex flex-col items-center shrink-0 rounded-xl px-4 py-2 text-center"
              style={{ backgroundColor: `${totalColor}15`, border: `1px solid ${totalColor}40` }}
            >
              {rank && <span className="text-xs font-medium" style={{ color: totalColor }}>#{rank}</span>}
              <span className="text-2xl font-bold" style={{ color: totalColor }}>{property.totalScore}</span>
              <span className="text-xs text-gray-500">/50 · {totalPct}%</span>
            </div>
          ) : (
            <span className="text-xs font-medium bg-blue-400/10 text-blue-400 px-3 py-1.5 rounded-full border border-blue-400/20">
              {countdown ? `Viewing in ${countdown}` : viewingDate ? 'Past viewing' : 'Upcoming'}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-5">
          <span className="text-2xl font-bold text-white">
            £{Number(property.price).toLocaleString()}
          </span>
          <span className="text-gray-500">
            {property.priceType === 'rent' ? '/month' : 'purchase'}
          </span>
        </div>

        {/* Spec pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hidden pb-1">
          <InfoPill icon="🛏️" label="Beds" value={property.bedrooms || '—'} />
          <InfoPill icon="🚿" label="Baths" value={property.bathrooms || '—'} />
          {property.sqft > 0 && <InfoPill icon="📐" label="Sq ft" value={property.sqft.toLocaleString()} />}
          {property.floor && <InfoPill icon="🏢" label="Floor" value={property.floor} />}
          {property.hasParking && <InfoPill icon="🚗" label="Parking" value="Yes" />}
          {property.outdoorSpaceType !== 'none' && (
            <InfoPill icon="🌿" label="Outdoor" value={OUTDOOR_LABELS[property.outdoorSpaceType]} />
          )}
          {property.epcRating && <InfoPill icon="⚡" label="EPC" value={property.epcRating} />}
        </div>
        </div>{/* end p-6 */}
      </div>

      {/* Financial details */}
      {(property.serviceCharge > 0 || property.groundRent > 0 || property.leaseLength) && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Financials</h3>
          <div className="space-y-2">
            {property.serviceCharge > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Service charge</span>
                <span className="text-white font-medium">£{Number(property.serviceCharge).toLocaleString()}/yr</span>
              </div>
            )}
            {property.groundRent > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Ground rent</span>
                <span className="text-white font-medium">£{Number(property.groundRent).toLocaleString()}/yr</span>
              </div>
            )}
            {property.leaseLength && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Lease</span>
                <span className="text-white font-medium">{property.leaseLength}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Agent */}
      {(property.estateAgent || property.agentContact || viewingDate) && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Agent & Viewing</h3>
          <div className="space-y-2">
            {property.estateAgent && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Agency</span>
                <span className="text-white font-medium">{property.estateAgent}</span>
              </div>
            )}
            {property.agentContact && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Contact</span>
                <a href={`tel:${property.agentContact}`} className="text-emerald-500 font-medium hover:text-emerald-400 transition-colors">
                  {property.agentContact}
                </a>
              </div>
            )}
            {viewingDate && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Viewing</span>
                <span className="text-white font-medium">
                  {viewingDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  {' at '}
                  {viewingDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scores (if scored) */}
      {isScored && property.scores && Object.keys(property.scores).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Scorecard</h3>
          <div className="space-y-4">
            {CRITERIA.map(c => {
              const score = property.scores[c.key]
              if (!score) return null
              return <ScoreCriterionRow key={c.key} criterion={c} score={score} />
            })}
          </div>
          {property.overallNotes && (
            <div className="mt-5 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-2">Notes</p>
              <p className="text-sm text-gray-300">{property.overallNotes}</p>
            </div>
          )}
          {property.voiceTranscript && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-2">Voice transcript</p>
              <p className="text-xs text-gray-500 italic leading-relaxed">{property.voiceTranscript}</p>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        {!isScored && (
          <button
            onClick={onStartScoring}
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base transition-colors"
          >
            Start Post-Viewing Score
          </button>
        )}
        {isScored && (
          <button
            onClick={onStartScoring}
            className="w-full py-3.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 font-medium text-sm transition-colors"
          >
            Re-score this property
          </button>
        )}

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3 rounded-xl text-red-500 hover:text-red-400 text-sm font-medium transition-colors"
          >
            Delete property
          </button>
        ) : (
          <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-4">
            <p className="text-sm text-red-300 text-center mb-3">Delete this property and all its data?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-400 text-sm hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
