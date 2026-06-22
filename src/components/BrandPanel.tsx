'use client'

import { useState, useEffect } from 'react'
import { ScrapedProduct } from '@/lib/scraper'
import { Brand } from '@/lib/brands'
import { X, ExternalLink } from 'lucide-react'

interface Props {
  products: ScrapedProduct[]
  allBrands: Brand[]
  onClose: () => void
}

const IYS_RANGE: [number, number] = [399, 1799]

function threatBadge(t: string) {
  if (t === 'h') return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/20">Direct threat</span>
  if (t === 'm') return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warn/10 text-warn border border-warn/20">Adjacent</span>
  return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20">Low overlap</span>
}

export default function BrandPanel({ products, allBrands, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  // Persist notes in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('iys_brand_notes')
    if (saved) setNotes(JSON.parse(saved))
  }, [])

  const saveNote = (id: string, text: string) => {
    const updated = { ...notes, [id]: text }
    setNotes(updated)
    localStorage.setItem('iys_brand_notes', JSON.stringify(updated))
  }

  const selectedBrand = allBrands.find(b => b.id === selected)
  const brandProducts = selected ? products.filter(p => p.brandId === selected) : []
  const prices = brandProducts.map(p => p.price).filter(Boolean)
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const hasOverlap = selectedBrand
    ? selectedBrand.priceRange[0] <= IYS_RANGE[1] && selectedBrand.priceRange[1] >= IYS_RANGE[0]
    : false

  // Brands that actually have scraped products
  const activeBrandIds = new Set(products.map(p => p.brandId))
  const brandsWithData = allBrands.filter(b => activeBrandIds.has(b.id))
  const brandsWithoutData = allBrands.filter(b => !activeBrandIds.has(b.id))
  const displayBrands = [...brandsWithData, ...brandsWithoutData]

  return (
    <div className="w-[268px] min-w-[268px] flex flex-col bg-surface border-l border-white/[0.07] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.07] flex-shrink-0">
        <div>
          <div className="text-[11px] font-medium">Brand Health</div>
          <div className="text-[9px] text-white/30 mt-0.5">{products.length ? `${new Set(products.map(p=>p.brandId)).size} scraped` : 'Run first scrape'}</div>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X size={14} /></button>
      </div>

      {/* IYS profile card */}
      <div className="mx-2.5 mt-2.5 p-2.5 rounded-lg border border-success/20 bg-success/5 flex-shrink-0">
        <div className="text-[12px] font-medium text-success">In Your Shoe</div>
        <div className="text-[9px] text-success/60 mt-0.5">Your brand · mid-range · Cairo</div>
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {[
            { label: 'Range', value: '399–1,799' },
            { label: 'Sweet spot', value: '799–1,299' },
            { label: 'Branches', value: '10' },
            { label: 'Rating', value: '4.9 ★' },
          ].map(s => (
            <div key={s.label} className="bg-black/20 rounded-md p-1.5">
              <div className="text-[9px] text-white/30">{s.label}</div>
              <div className="text-[11px] font-medium text-white">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Brand list */}
      <div className="text-[9px] text-white/25 uppercase tracking-widest px-3 mt-3 mb-1.5 flex-shrink-0">
        {displayBrands.length} Competitors
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 pb-3">
        {displayBrands.map(b => {
          const count = products.filter(p => p.brandId === b.id).length
          return (
            <button
              key={b.id}
              onClick={() => setSelected(v => v === b.id ? null : b.id)}
              className={`w-full text-left px-2.5 py-2 rounded-md mb-1 transition-colors ${
                selected === b.id
                  ? 'border border-accent/40 bg-accent/10'
                  : 'border border-white/[0.05] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-medium text-white/80 truncate">{b.name}</div>
                <div className="text-[9px] text-white/25 ml-1 flex-shrink-0">{count > 0 ? `${count}` : '—'}</div>
              </div>
              <div className="text-[9px] text-white/30 mt-0.5">{b.tier} · {b.priceRange[0].toLocaleString()}–{b.priceRange[1].toLocaleString()} EGP</div>
              <div className="mt-1">{threatBadge(b.threat)}</div>
            </button>
          )
        })}

        {/* Brand detail panel */}
        {selected && selectedBrand && (
          <div className="mt-3 pt-3 border-t border-white/[0.07]">
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {[
                { label: 'Avg price', value: avgPrice ? `${avgPrice.toLocaleString()} EGP` : '—' },
                { label: 'Products', value: brandProducts.length.toString() },
                { label: 'Min', value: minPrice ? `${minPrice.toLocaleString()}` : '—' },
                { label: 'Max', value: maxPrice ? `${maxPrice.toLocaleString()}` : '—' },
              ].map(s => (
                <div key={s.label} className="bg-surface2 rounded-md p-1.5">
                  <div className="text-[9px] text-white/30">{s.label}</div>
                  <div className="text-[12px] font-medium text-white">{s.value}</div>
                </div>
              ))}
              <div className="col-span-2 bg-surface2 rounded-md p-1.5">
                <div className="text-[9px] text-white/30 mb-0.5">IYS price overlap</div>
                <div className={`text-[11px] font-medium ${hasOverlap ? 'text-danger' : 'text-success'}`}>
                  {hasOverlap ? 'Overlaps your range' : 'No price overlap'}
                </div>
              </div>
            </div>

            <div className="text-[9px] text-white/30 uppercase tracking-widest mb-1">Aesthetic</div>
            <p className="text-[11px] text-white/60 leading-relaxed mb-3">{selectedBrand.aesthetic}</p>

            <div className="text-[9px] text-white/30 uppercase tracking-widest mb-1">Seasonal drops</div>
            <div className="flex flex-wrap gap-1 mb-3">
              {selectedBrand.drops.map(d => (
                <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-warn/10 text-warn border border-warn/20">{d}</span>
              ))}
            </div>

            <div className="text-[9px] text-white/30 uppercase tracking-widest mb-1">Analyst notes</div>
            <textarea
              value={notes[selected] ?? ''}
              onChange={e => saveNote(selected, e.target.value)}
              placeholder={`Your observations on ${selectedBrand.name}…`}
              className="w-full min-h-[72px] p-2 text-[11px] bg-surface2 border border-white/[0.07] rounded-md text-white/80 placeholder-white/20 resize-y outline-none focus:border-white/20 transition-colors"
            />

            <a
              href={selectedBrand.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md border border-white/[0.13] text-white/40 hover:bg-accent/10 hover:text-info hover:border-accent/30 transition-colors mt-2"
            >
              <ExternalLink size={11} /> Open {selectedBrand.name}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
