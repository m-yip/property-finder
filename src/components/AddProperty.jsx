import { useState } from 'react'

const STEPS = [
  { title: 'Property Details', subtitle: 'URL & address' },
  { title: 'Property Specs', subtitle: 'Size & features' },
  { title: 'Financials', subtitle: 'Costs & lease' },
  { title: 'Agent & Viewing', subtitle: 'Contact & schedule' },
]

const OUTDOOR_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'juliet', label: 'Juliet Balcony' },
  { value: 'balcony', label: 'Balcony' },
  { value: 'terrace', label: 'Terrace' },
  { value: 'garden', label: 'Garden' },
]

const EPC_RATINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

function Input({ label, type = 'text', value, onChange, placeholder, required, prefix, suffix, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-600 mb-1.5">{hint}</p>}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-gray-500 text-sm pointer-events-none">{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors placeholder-gray-600
            ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-12' : 'pr-3'}`}
        />
        {suffix && (
          <span className="absolute right-3 text-gray-500 text-sm pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  )
}

function Select({ label, value, onChange, options, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-400">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-emerald-600' : 'bg-gray-700'}`}
      >
        <span
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
          style={{ transform: value ? 'translateX(20px)' : 'translateX(2px)' }}
        />
      </button>
    </div>
  )
}

const INITIAL = {
  url: '', address: '', estateAgent: '', agentContact: '',
  priceType: 'buy', price: '', serviceCharge: '', groundRent: '', sqft: '',
  bedrooms: '', bathrooms: '', floor: '',
  hasParking: false, outdoorSpaceType: 'none',
  leaseLength: '', epcRating: 'C', viewingDate: '',
  imageUrl: '',
}

export default function AddProperty({ onSave, onCancel }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [fetching, setFetching] = useState(false)
  const [fetchMsg, setFetchMsg] = useState(null) // { ok: bool, text: string }

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }))

  async function handleFetchUrl() {
    if (!form.url.trim()) return
    setFetching(true)
    setFetchMsg(null)
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(form.url.trim())}`)
      const json = await res.json()
      if (json.ok && json.data) {
        const d = json.data
        // Count truthy fields returned
        const filled = [
          d.address, d.price, d.priceType, d.bedrooms, d.bathrooms, d.sqft,
          d.floor, d.estateAgent, d.agentContact, d.epcRating, d.imageUrl,
          d.serviceCharge, d.groundRent, d.leaseLength, d.hasParking,
          d.outdoorSpaceType && d.outdoorSpaceType !== 'none',
        ].filter(Boolean).length

        // Always overwrite with scraped data (apply whatever was found)
        setForm(f => ({
          ...f,
          ...(d.address       && { address: d.address }),
          ...(d.price         && { price: String(d.price) }),
          ...(d.priceType     && { priceType: d.priceType }),
          ...(d.bedrooms      && { bedrooms: String(d.bedrooms) }),
          ...(d.bathrooms     && { bathrooms: String(d.bathrooms) }),
          ...(d.sqft          && { sqft: String(d.sqft) }),
          ...(d.floor         && { floor: d.floor }),
          ...(d.estateAgent   && { estateAgent: d.estateAgent }),
          ...(d.agentContact  && { agentContact: d.agentContact }),
          ...(d.epcRating     && { epcRating: d.epcRating }),
          ...(d.imageUrl      && { imageUrl: d.imageUrl }),
          ...(d.serviceCharge && { serviceCharge: String(d.serviceCharge) }),
          ...(d.groundRent    && { groundRent: String(d.groundRent) }),
          ...(d.leaseLength   && { leaseLength: d.leaseLength }),
          ...(d.hasParking    && { hasParking: true }),
          ...(d.outdoorSpaceType && d.outdoorSpaceType !== 'none' && { outdoorSpaceType: d.outdoorSpaceType }),
        }))
        setFetchMsg({
          ok: true,
          text: filled > 0 ? `Auto-filled ${filled} fields from listing` : 'Listing found — no structured data extracted',
        })
      } else {
        setFetchMsg({ ok: false, text: json.error || 'Could not extract details — fill in manually' })
      }
    } catch {
      setFetchMsg({ ok: false, text: 'Network error — check URL and try again' })
    } finally {
      setFetching(false)
    }
  }

  function validate(s) {
    const e = {}
    if (s === 0) {
      if (!form.address.trim()) e.address = 'Address is required'
    }
    if (s === 1) {
      if (!form.price) e.price = 'Price is required'
    }
    return e
  }

  function next() {
    const e = validate(step)
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({})
    if (step < 3) setStep(s => s + 1)
    else handleSave()
  }

  function handleSave() {
    onSave({
      url: form.url.trim(),
      address: form.address.trim(),
      estateAgent: form.estateAgent.trim(),
      agentContact: form.agentContact.trim(),
      priceType: form.priceType,
      price: Number(form.price) || 0,
      serviceCharge: Number(form.serviceCharge) || 0,
      groundRent: Number(form.groundRent) || 0,
      sqft: Number(form.sqft) || 0,
      bedrooms: Number(form.bedrooms) || 0,
      bathrooms: Number(form.bathrooms) || 0,
      floor: form.floor.trim(),
      hasParking: form.hasParking,
      outdoorSpaceType: form.outdoorSpaceType,
      leaseLength: form.leaseLength.trim(),
      epcRating: form.epcRating,
      viewingDate: form.viewingDate,
      imageUrl: form.imageUrl,
    })
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${i <= step ? 'bg-emerald-500' : 'bg-gray-800'}`} />
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="text-xl font-bold text-white mt-1">{STEPS[step].title}</h1>
          <p className="text-sm text-gray-500">{STEPS[step].subtitle}</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {/* Step 0: URL + Address */}
        {step === 0 && (
          <div>
            {/* Image preview */}
            {form.imageUrl && (
              <div className="w-full aspect-video bg-gray-800 overflow-hidden">
                <img
                  src={form.imageUrl}
                  alt="Property preview"
                  className="w-full h-full object-cover"
                  onError={e => { e.target.style.display = 'none' }}
                />
              </div>
            )}

            <div className="p-6 space-y-4">
              {/* URL + fetch button */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Listing URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.url}
                    onChange={e => { set('url')(e.target.value); setFetchMsg(null) }}
                    placeholder="https://rightmove.co.uk/properties/..."
                    className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 placeholder-gray-600 min-w-0"
                  />
                  <button
                    onClick={handleFetchUrl}
                    disabled={!form.url.trim() || fetching}
                    className="shrink-0 flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium px-3 py-2.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {fetching ? (
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : '✨'}
                    Auto-fill
                  </button>
                </div>

                {/* Status message */}
                {fetchMsg && (
                  <p className={`text-xs mt-2 flex items-center gap-1.5 ${fetchMsg.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                    <span>{fetchMsg.ok ? '✓' : '⚠'}</span>
                    {fetchMsg.text}
                  </p>
                )}
              </div>

              {/* Address */}
              <div>
                <Input
                  label="Address"
                  value={form.address}
                  onChange={set('address')}
                  placeholder="Flat 4, 12 Example Street, London, E1 1AA"
                  required
                />
                {errors.address && <p className="text-xs text-red-400 mt-1">{errors.address}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Specs */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Price type<span className="text-red-400 ml-1">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['rent', 'buy'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('priceType')(t)}
                      className={`py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                        form.priceType === t
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {t === 'rent' ? 'Rent' : 'Buy'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <Input
                  label={form.priceType === 'rent' ? 'Monthly rent (£)' : 'Purchase price (£)'}
                  type="number"
                  value={form.price}
                  onChange={set('price')}
                  placeholder={form.priceType === 'rent' ? '2500' : '450000'}
                  required
                  prefix="£"
                />
                {errors.price && <p className="text-xs text-red-400 mt-1">{errors.price}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Sq ft" type="number" value={form.sqft} onChange={set('sqft')} placeholder="650" />
              <Input label="Floor" value={form.floor} onChange={set('floor')} placeholder="3rd / Ground / Penthouse" />
              <Input label="Bedrooms" type="number" value={form.bedrooms} onChange={set('bedrooms')} placeholder="2" />
              <Input label="Bathrooms" type="number" value={form.bathrooms} onChange={set('bathrooms')} placeholder="1" />
            </div>
            <Toggle label="Parking included" value={form.hasParking} onChange={set('hasParking')} />
            <Select
              label="Outdoor space"
              value={form.outdoorSpaceType}
              onChange={set('outdoorSpaceType')}
              options={OUTDOOR_OPTIONS}
            />
          </div>
        )}

        {/* Step 2: Financials */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <Input
              label="Service charge (£/year)"
              type="number"
              value={form.serviceCharge}
              onChange={set('serviceCharge')}
              placeholder="3000"
              prefix="£"
              suffix="/yr"
            />
            <Input
              label="Ground rent (£/year)"
              type="number"
              value={form.groundRent}
              onChange={set('groundRent')}
              placeholder="500"
              prefix="£"
              suffix="/yr"
            />
            <Input
              label="Lease length"
              value={form.leaseLength}
              onChange={set('leaseLength')}
              placeholder="125 years remaining"
            />
            <Select
              label="EPC Rating"
              value={form.epcRating}
              onChange={set('epcRating')}
              options={EPC_RATINGS.map(r => ({ value: r, label: `${r} — ${epcLabel(r)}` }))}
            />
          </div>
        )}

        {/* Step 3: Agent */}
        {step === 3 && (
          <div className="p-6 space-y-5">
            <Input
              label="Estate agent / agency"
              value={form.estateAgent}
              onChange={set('estateAgent')}
              placeholder="Knight Frank"
            />
            <Input
              label="Agent contact"
              type="tel"
              value={form.agentContact}
              onChange={set('agentContact')}
              placeholder="+44 7700 000000"
            />
            <Input
              label="Viewing date & time"
              type="datetime-local"
              value={form.viewingDate}
              onChange={set('viewingDate')}
            />
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}
          className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-sm font-medium transition-colors"
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <button
          onClick={next}
          className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          {step < 3 ? 'Continue' : 'Save Property'}
        </button>
      </div>
    </div>
  )
}

function epcLabel(r) {
  const map = { A: 'Very efficient', B: 'Efficient', C: 'Good', D: 'Average', E: 'Below average', F: 'Poor', G: 'Very poor' }
  return map[r] || r
}
