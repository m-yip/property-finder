import { useState, useRef, useEffect } from 'react'
import { CRITERIA, extractSuggestedScores, getTotalScoreColor } from '../data/criteria'

const SCORE_COLORS = {
  1: '#ef4444',
  2: '#f97316',
  3: '#f59e0b',
  4: '#84cc16',
  5: '#10b981',
}

// Check for Web Speech API support
const hasSpeechRecognition = typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition)

function VoiceStep({ onComplete }) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [notes, setNotes] = useState('')
  const [suggestions, setSuggestions] = useState(null)
  const [speechError, setSpeechError] = useState(null)
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')

  function startRecording() {
    if (!hasSpeechRecognition) {
      setSpeechError('Speech recognition not available in this browser. Please type your notes below.')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-GB'

    recognition.onresult = (e) => {
      let full = ''
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript + ' '
      }
      transcriptRef.current = full.trim()
      setTranscript(full.trim())
    }

    recognition.onerror = (e) => {
      setSpeechError(`Microphone error: ${e.error}. Use the text box below.`)
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    setSpeechError(null)
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsRecording(false)
    // Extract suggestions from current transcript
    const combined = (transcriptRef.current + ' ' + notes).trim()
    if (combined) {
      setSuggestions(extractSuggestedScores(combined))
    }
  }

  function handleAnalyse() {
    const combined = (transcript + ' ' + notes).trim()
    setSuggestions(extractSuggestedScores(combined))
  }

  function handleContinue() {
    const combined = (transcript + ' ' + notes).trim()
    onComplete(combined, suggestions || {})
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-3">🎙️</div>
        <h2 className="text-xl font-bold text-white">Describe the property</h2>
        <p className="text-sm text-gray-500 mt-1">
          Record a voice note or type your impressions — we'll suggest scores automatically
        </p>
      </div>

      {/* Mic button */}
      {hasSpeechRecognition && (
        <div className="flex justify-center">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isRecording
                ? 'bg-red-600 hover:bg-red-500 shadow-red-900/50 animate-pulse'
                : 'bg-emerald-700 hover:bg-emerald-600 shadow-emerald-900/50'
            }`}
          >
            <span className="text-4xl">{isRecording ? '⏹️' : '🎙️'}</span>
          </button>
        </div>
      )}

      {isRecording && (
        <p className="text-center text-sm text-red-400 animate-pulse">Recording... speak now</p>
      )}

      {speechError && (
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-3">
          <p className="text-xs text-yellow-400">{speechError}</p>
        </div>
      )}

      {/* Transcript display */}
      {transcript && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-2">Transcript</p>
          <p className="text-sm text-gray-300 leading-relaxed">{transcript}</p>
        </div>
      )}

      {/* Text fallback */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1.5">
          {hasSpeechRecognition ? 'Additional notes (optional)' : 'Your notes'}
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Good transport links, bright south-facing flat, balcony, bit noisy from road..."
          rows={4}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 resize-none placeholder-gray-600"
        />
      </div>

      {/* Suggestions preview */}
      {suggestions && Object.keys(suggestions).length > 0 && (
        <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-4">
          <p className="text-xs font-semibold text-emerald-400 mb-3">
            Suggested scores from your description:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CRITERIA.filter(c => suggestions[c.key]).map(c => (
              <div key={c.key} className="flex items-center gap-2">
                <span className="text-base">{c.emoji}</span>
                <span className="text-xs text-gray-400 flex-1 truncate">{c.label}</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: SCORE_COLORS[suggestions[c.key]] }}
                >
                  {suggestions[c.key]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        {(transcript || notes) && !suggestions && (
          <button
            onClick={handleAnalyse}
            className="flex-1 py-3 rounded-xl border border-emerald-700 text-emerald-400 hover:bg-emerald-900/30 text-sm font-medium transition-colors"
          >
            Analyse keywords
          </button>
        )}
        <button
          onClick={handleContinue}
          className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          Start Scoring →
        </button>
      </div>
    </div>
  )
}

function CriterionStep({ criterion, initialScore, onScore, stepIndex }) {
  const [selected, setSelected] = useState(initialScore || null)

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-3">{criterion.emoji}</div>
        <h2 className="text-xl font-bold text-white">{criterion.label}</h2>
        <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">{criterion.description}</p>
      </div>

      <div className="space-y-2">
        {criterion.levels.map(level => {
          const isSelected = selected === level.score
          const color = SCORE_COLORS[level.score]
          return (
            <button
              key={level.score}
              onClick={() => setSelected(level.score)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                isSelected
                  ? 'border-transparent'
                  : 'border-gray-800 bg-gray-900 hover:border-gray-600'
              }`}
              style={isSelected ? {
                backgroundColor: `${color}18`,
                borderColor: `${color}60`,
              } : {}}
            >
              {/* Score dot */}
              <div className="flex gap-1 shrink-0">
                {[1, 2, 3, 4, 5].map(s => (
                  <div
                    key={s}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: s <= level.score ? color : '#374151' }}
                  />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="font-semibold text-sm"
                  style={isSelected ? { color } : { color: '#fff' }}
                >
                  {level.score} — {level.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{level.desc}</p>
              </div>
              {isSelected && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
                  style={{ backgroundColor: color }}
                >
                  ✓
                </div>
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={() => selected && onScore(selected)}
        disabled={!selected}
        className={`w-full py-4 rounded-xl font-semibold text-base transition-all ${
          selected
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
        }`}
      >
        {selected ? 'Next →' : 'Select a score to continue'}
      </button>
    </div>
  )
}

function ScoreReveal({ scores, allProperties, property }) {
  const total = Object.values(scores).reduce((a, b) => a + b, 0)
  const pct = Math.round((total / 50) * 100)
  const color = getTotalScoreColor(total)

  // Rank calculation
  const scoredOthers = allProperties
    .filter(p => p.id !== property.id && p.status === 'scored' && p.totalScore !== null)
    .sort((a, b) => b.totalScore - a.totalScore)

  let rank = 1
  for (const p of scoredOthers) {
    if (p.totalScore > total) rank++
  }
  const totalRanked = scoredOthers.length + 1

  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

  return (
    <div className="space-y-6 text-center">
      <div>
        <p className="text-sm text-gray-500 uppercase tracking-wider font-medium mb-6">Score Reveal</p>
        <div
          className="inline-flex flex-col items-center justify-center w-40 h-40 rounded-full mx-auto mb-4"
          style={{
            background: `conic-gradient(${color} ${pct * 3.6}deg, #1f2937 0deg)`,
            boxShadow: `0 0 40px ${color}40`,
          }}
        >
          <div className="w-32 h-32 bg-gray-950 rounded-full flex flex-col items-center justify-center">
            <span className="text-4xl font-bold" style={{ color }}>{total}</span>
            <span className="text-sm text-gray-500 font-medium">/50</span>
          </div>
        </div>
        <p className="text-2xl font-bold" style={{ color }}>{pct}%</p>
      </div>

      {/* Rank */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <p className="text-xs text-gray-500 mb-2">Leaderboard position</p>
        <div className="flex items-center justify-center gap-3">
          {medal && <span className="text-3xl">{medal}</span>}
          <span className="text-2xl font-bold text-white">#{rank}</span>
          <span className="text-gray-500 text-sm">of {totalRanked}</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-left">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Breakdown</p>
        <div className="space-y-3">
          {CRITERIA.map(c => {
            const s = scores[c.key] || 0
            const sc = SCORE_COLORS[s]
            return (
              <div key={c.key} className="flex items-center gap-3">
                <span className="text-lg w-7 text-center">{c.emoji}</span>
                <span className="text-sm text-gray-400 flex-1">{c.label}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: i <= s ? sc : '#374151' }}
                    />
                  ))}
                </div>
                <span className="text-sm font-bold w-4 text-right" style={{ color: sc }}>{s}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function PostViewing({ property, allProperties, onComplete, onBack }) {
  // step: 0 = voice, 1..10 = criteria, 11 = reveal
  const [step, setStep] = useState(0)
  const [scores, setScores] = useState({ ...property.scores })
  const [transcript, setTranscript] = useState(property.voiceTranscript || '')
  const [suggestions, setSuggestions] = useState({})
  const [notes, setNotes] = useState(property.overallNotes || '')

  const totalSteps = CRITERIA.length + 2 // voice + 10 criteria + reveal
  const progressPct = step === 0 ? 0 : step <= CRITERIA.length ? (step / (CRITERIA.length + 1)) * 100 : 100

  function handleVoiceComplete(combinedText, suggestedScores) {
    setTranscript(combinedText)
    setSuggestions(suggestedScores)
    setStep(1)
  }

  function handleCriterionScore(criterionKey, score) {
    const newScores = { ...scores, [criterionKey]: score }
    setScores(newScores)

    if (step < CRITERIA.length) {
      setStep(s => s + 1)
    } else {
      // Last criterion → reveal
      setStep(CRITERIA.length + 1)
    }
  }

  function handleDone() {
    onComplete(scores, transcript, notes)
  }

  const currentCriterion = step >= 1 && step <= CRITERIA.length ? CRITERIA[step - 1] : null

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={step === 0 ? onBack : () => setStep(s => Math.max(0, s - 1))}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors"
      >
        ← {step === 0 ? 'Back' : 'Previous'}
      </button>

      {/* Progress bar */}
      {step > 0 && step <= CRITERIA.length && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Criterion {step} of {CRITERIA.length}</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Step 0: Voice/Text */}
      {step === 0 && (
        <VoiceStep onComplete={handleVoiceComplete} />
      )}

      {/* Steps 1–10: Criteria */}
      {currentCriterion && (
        <CriterionStep
          key={currentCriterion.key}
          criterion={currentCriterion}
          initialScore={suggestions[currentCriterion.key] || scores[currentCriterion.key] || null}
          onScore={(score) => handleCriterionScore(currentCriterion.key, score)}
          stepIndex={step}
        />
      )}

      {/* Final: Score reveal */}
      {step === CRITERIA.length + 1 && (
        <>
          <ScoreReveal
            scores={scores}
            allProperties={allProperties}
            property={property}
          />

          {/* Notes input */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Final notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any final thoughts on this property..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 resize-none placeholder-gray-600"
            />
          </div>

          <button
            onClick={handleDone}
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base transition-colors"
          >
            Done — Save Scores
          </button>
        </>
      )}
    </div>
  )
}
