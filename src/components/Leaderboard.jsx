import { getTotalScoreColor } from '../data/criteria'

const MEDALS = ['🥇', '🥈', '🥉']

function ScoreBar({ score, max = 50 }) {
  const pct = Math.round((score / max) * 100)
  const color = getTotalScoreColor(score, max)
  return (
    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

function PodiumCard({ property, rank, onClick }) {
  const medal = MEDALS[rank - 1]
  const color = getTotalScoreColor(property.totalScore)
  const pct = Math.round((property.totalScore / 50) * 100)

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-2xl overflow-hidden transition-all group"
    >
      {/* Property image */}
      {property.imageUrl ? (
        <div className="w-full aspect-video bg-gray-800 overflow-hidden">
          <img
            src={property.imageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={e => { e.target.parentElement.style.display = 'none' }}
          />
        </div>
      ) : (
        <div className="w-full aspect-video bg-gray-800 flex items-center justify-center text-3xl text-gray-700">🏠</div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-2xl">{medal}</span>
          <span className="text-xl font-bold tabular-nums" style={{ color }}>
            {property.totalScore}<span className="text-xs text-gray-500 font-normal">/50</span>
          </span>
        </div>
        <p className="font-semibold text-white truncate mb-1 group-hover:text-emerald-400 transition-colors text-sm">
          {property.address}
        </p>
        <p className="text-xs text-gray-500 mb-3">
          {property.priceType === 'rent' ? 'Rent' : 'Buy'} · £{Number(property.price).toLocaleString()}
          {property.priceType === 'rent' ? '/mo' : ''}
        </p>
        <ScoreBar score={property.totalScore} />
        <p className="text-right text-xs mt-1" style={{ color }}>{pct}%</p>
      </div>
    </button>
  )
}

function PropertyRow({ property, rank, onClick }) {
  const color = getTotalScoreColor(property.totalScore)
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-xl p-3 transition-all group"
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-800">
        {property.imageUrl ? (
          <img
            src={property.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={e => { e.target.parentElement.innerHTML = '<span style="font-size:1.25rem;display:flex;align-items:center;justify-content:center;height:100%">🏠</span>' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl text-gray-700">🏠</div>
        )}
      </div>
      <span className="text-gray-500 font-mono text-xs w-5 shrink-0">#{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate group-hover:text-emerald-400 transition-colors text-sm">
          {property.address}
        </p>
        <div className="mt-1">
          <ScoreBar score={property.totalScore} />
        </div>
      </div>
      <span className="font-bold tabular-nums text-sm shrink-0" style={{ color }}>
        {property.totalScore}/50
      </span>
    </button>
  )
}

function UpcomingCard({ property, onClick }) {
  const viewingDate = property.viewingDate ? new Date(property.viewingDate) : null
  const now = new Date()
  let countdown = null
  if (viewingDate) {
    const diff = viewingDate - now
    if (diff > 0) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      countdown = days > 0 ? `in ${days}d ${hours}h` : `in ${hours}h`
    } else {
      countdown = 'today'
    }
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-xl p-3 transition-all group"
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-800">
        {property.imageUrl ? (
          <img
            src={property.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={e => { e.target.parentElement.innerHTML = '<span style="font-size:1.25rem;display:flex;align-items:center;justify-content:center;height:100%">🏠</span>' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl text-gray-700">🏠</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate group-hover:text-emerald-400 transition-colors text-sm">
          {property.address}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {property.estateAgent || 'No agent'} ·{' '}
          {viewingDate ? viewingDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Date TBD'}
        </p>
      </div>
      {countdown && (
        <span className="text-xs font-medium text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-full shrink-0">
          {countdown}
        </span>
      )}
    </button>
  )
}

export default function Leaderboard({ properties, onSelect }) {
  const scored = properties
    .filter(p => p.status === 'scored' && p.totalScore !== null)
    .sort((a, b) => b.totalScore - a.totalScore)

  const upcoming = properties
    .filter(p => p.status === 'upcoming')
    .sort((a, b) => {
      if (!a.viewingDate) return 1
      if (!b.viewingDate) return -1
      return new Date(a.viewingDate) - new Date(b.viewingDate)
    })

  const podium = scored.slice(0, 3)
  const rest = scored.slice(3)

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-6xl mb-4">🏠</div>
        <h2 className="text-2xl font-bold text-white mb-2">No properties yet</h2>
        <p className="text-gray-400 mb-8">Add your first property to start tracking viewings and scores.</p>
        <div className="text-sm text-gray-600">Press <span className="text-gray-400">+ Add Property</span> to begin</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Scored leaderboard */}
      {scored.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Leaderboard — {scored.length} scored
          </h2>

          {/* Podium */}
          {podium.length > 0 && (
            <div className={`grid gap-3 mb-3 ${podium.length === 1 ? 'grid-cols-1' : podium.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {podium.map((p, i) => (
                <PodiumCard
                  key={p.id}
                  property={p}
                  rank={i + 1}
                  onClick={() => onSelect(p.id)}
                />
              ))}
            </div>
          )}

          {/* Rest of ranked list */}
          {rest.length > 0 && (
            <div className="space-y-2">
              {rest.map((p, i) => (
                <PropertyRow
                  key={p.id}
                  property={p}
                  rank={i + 4}
                  onClick={() => onSelect(p.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Upcoming viewings */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Upcoming Viewings — {upcoming.length}
          </h2>
          <div className="space-y-2">
            {upcoming.map(p => (
              <UpcomingCard
                key={p.id}
                property={p}
                onClick={() => onSelect(p.id)}
              />
            ))}
          </div>
        </section>
      )}

      {scored.length === 0 && upcoming.length > 0 && (
        <div className="text-center py-8 text-gray-600 text-sm">
          Score a property after viewing to see the leaderboard
        </div>
      )}
    </div>
  )
}
