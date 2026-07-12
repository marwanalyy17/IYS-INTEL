'use client'

import { useState } from 'react'
import { X, Loader2, Plus, Globe } from 'lucide-react'

interface Props {
  onClose: () => void
  onAdded: () => void
}

export default function AddBrandModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [currency, setCurrency] = useState('EGP')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async () => {
    if (!name.trim() || !url.trim()) { setError('Name and URL are required'); return }
    
    let formattedUrl = url.trim()
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`
    }

    // Strip query params (UTM tags, etc.) and hash fragments — keep only origin + pathname
    try {
      const parsed = new URL(formattedUrl)
      formattedUrl = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
    } catch {
      setError('Invalid URL format'); return
    }
    
    setLoading(true); setError(''); setSuccess('')

    try {
      const res = await fetch('/api/scrape-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), url: formattedUrl, currency }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setSuccess(`Added ${name} — found ${data.productCount} products (${data.brand.strategy} store)`)
      onAdded()
      setTimeout(onClose, 1800)
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-white/[0.13] rounded-xl p-5 w-[440px] shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[14px] font-medium">Add new brand</div>
            <div className="text-[11px] text-white/30 mt-0.5">Paste any brand URL — Shopify and custom sites supported</div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Brand name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. New Brand"
              className="w-full px-3 py-2 text-[13px] bg-surface2 border border-white/[0.13] rounded-md text-white placeholder-white/25 outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Website URL</label>
            <div className="relative">
              <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" size={13} />
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full pl-8 pr-3 py-2 text-[13px] bg-surface2 border border-white/[0.13] rounded-md text-white placeholder-white/25 outline-none focus:border-accent transition-colors"
              />
            </div>
            <p className="text-[10px] text-white/25 mt-1">For Shopify stores, paste the base URL. For non-Shopify, paste the collection/catalog page URL.</p>
          </div>

          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full px-3 py-2 text-[12px] bg-surface2 border border-white/[0.13] rounded-md text-white outline-none cursor-pointer"
            >
              <option value="EGP">EGP (£)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="AED">AED</option>
              <option value="SAR">SAR</option>
            </select>
          </div>
        </div>

        {error && <p className="text-[11px] text-danger mt-3">{error}</p>}
        {success && <p className="text-[11px] text-success mt-3">{success}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-[12px] px-3 py-1.5 rounded-md border border-white/[0.13] text-white/50 hover:text-white hover:border-white/25 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex items-center gap-1.5 text-[12px] px-4 py-1.5 rounded-md bg-accent/90 text-white hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {loading ? <><Loader2 size={12} className="animate-spin" /> Scraping…</> : <><Plus size={12} /> Add & Scrape</>}
          </button>
        </div>
      </div>
    </div>
  )
}
