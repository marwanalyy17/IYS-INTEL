'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ExternalLink, ChevronDown, ChevronUp, LineChart } from 'lucide-react'
import { convertToEGP, formatCurrency } from '@/lib/currency'
import { getColorHex } from '@/lib/colors'
import { ScrapedProduct } from '@/lib/scraper'
import { BRANDS } from '@/lib/brands'
import PriceHistoryModal from './PriceHistoryModal'

interface Props { products: ScrapedProduct[]; showEGP?: boolean }

export const IYS_BENCHMARKS: Record<string, { price: number; label: string }> = {
  'cargo pants':  { price: 1499, label: 'IYS Pants' },
  'pants':        { price: 1399, label: 'IYS Pants' },
  't-shirt':      { price: 1099, label: 'IYS T-Shirts' },
  'jersey':       { price: 1099, label: 'IYS Jerseys' },
  'linen':        { price: 1699, label: 'IYS Linens' },
  'hoodie':       { price: 1199, label: 'IYS Hoodies' },
  'knitwear':     { price: 1799, label: 'IYS Knitwear' },
  'shorts':       { price: 699,  label: 'IYS Shorts' },
  'joggers':      { price: 999,  label: 'IYS Swants' },
  'sweatshirt':   { price: 1199, label: 'IYS Crewnecks' },
  'jacket':       { price: 1499, label: 'IYS Jackets' },
  'pjoys':        { price: 799,  label: 'IYS Pjoys' },
  'pshorts':      { price: 599,  label: 'IYS Pshorts' },
  'accessories':  { price: 299,  label: 'IYS Accessories' },
}

function getVsIYS(price: number, category: string) {
  const bench = IYS_BENCHMARKS[category]
  if (!bench || !price) return null
  const diff = price - bench.price
  const pct = Math.round(Math.abs(diff) / bench.price * 100)
  if (Math.abs(diff) <= 100) return { text: `Within EGP 100 of ${bench.label} (${bench.price.toLocaleString()} EGP)`, color: 'text-success' }
  if (diff < 0) return { text: `${pct}% below ${bench.label} — price pressure`, color: 'text-danger' }
  return { text: `${pct}% above ${bench.label} — premium stretch`, color: 'text-info' }
}

function priceTierClass(tier: string) {
  if (tier === 'budget') return 'text-success'
  if (tier === 'premium') return 'text-danger'
  return 'text-info'
}

function threatBadge(threat: string) {
  if (threat === 'h') return <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/20">Direct threat</span>
  if (threat === 'm') return <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-warn/10 text-warn border border-warn/20">Adjacent</span>
  return <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20">Low overlap</span>
}

export default function ProductTable({ products, showEGP }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [historyProduct, setHistoryProduct] = useState<ScrapedProduct | null>(null)

  const toggle = (id: string) => setExpanded(v => v === id ? null : id)

  return (
    <>
    <table className="w-full border-collapse text-[12px]" style={{ tableLayout: 'fixed' }}>
      <thead>
        <tr className="sticky top-0 z-10 bg-surface">
          <th className="text-left px-3 py-2 text-[10px] font-medium text-white/30 uppercase tracking-widest border-b border-white/[0.07]" style={{ width: 48 }}>Photo</th>
          <th className="text-left px-3 py-2 text-[10px] font-medium text-white/30 uppercase tracking-widest border-b border-white/[0.07]" style={{ width: 120 }}>Brand</th>
          <th className="text-left px-3 py-2 text-[10px] font-medium text-white/30 uppercase tracking-widest border-b border-white/[0.07]">Product</th>
          <th className="text-left px-3 py-2 text-[10px] font-medium text-white/30 uppercase tracking-widest border-b border-white/[0.07]" style={{ width: 140 }}>{showEGP ? 'Price (EGP)' : 'Price'}</th>
          <th className="text-left px-3 py-2 text-[10px] font-medium text-white/30 uppercase tracking-widest border-b border-white/[0.07]" style={{ width: 110 }}>vs IYS</th>
          <th className="text-left px-3 py-2 text-[10px] font-medium text-white/30 uppercase tracking-widest border-b border-white/[0.07]" style={{ width: 90 }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {products.map(p => {
          const isExp = expanded === p.id
          
          // Always use the brand config currency as source of truth.
          // Old scraped data in Redis incorrectly stores 'EGP' for all brands.
          const brandCurrency = BRANDS.find(b => b.id === p.brandId)?.currency || p.currency || 'EGP'

          const egpPrice = convertToEGP(p.price, brandCurrency)
          const vs = getVsIYS(egpPrice, p.category)
          
          const displayPrice = showEGP ? egpPrice : p.price
          const displayCompare = p.compareAtPrice ? (showEGP ? convertToEGP(p.compareAtPrice, brandCurrency) : p.compareAtPrice) : undefined
          const curr = showEGP ? 'EGP' : brandCurrency

          return (
            <>
              <tr
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`border-b border-white/[0.05] cursor-pointer transition-colors ${isExp ? 'bg-surface2' : 'hover:bg-surface2/60'}`}
              >
                <td className="px-3 py-2">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      loading="lazy"
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-md object-cover border border-white/[0.07]"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-md border border-white/[0.07] bg-surface2 flex items-center justify-center text-white/10 text-[10px]">—</div>
                  )}
                </td>
                <td className="px-3 py-2 overflow-hidden">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.07] text-white/50 whitespace-nowrap block truncate">
                    {p.brandName}
                  </span>
                </td>
                <td className="px-3 py-2 overflow-hidden">
                  <span className="text-white/90 truncate block">{p.name}</span>
                  {p.category && (
                    <span className="text-[10px] text-white/25 border border-white/[0.07] px-1.5 py-0.5 rounded-full ml-0 mt-0.5 inline-block">{p.category}</span>
                  )}
                  {p.colors && p.colors.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 overflow-x-auto no-scrollbar">
                      {p.colors.map((colorName, idx) => (
                        <div 
                          key={idx} 
                          title={colorName}
                          className="w-2.5 h-2.5 rounded-full border border-white/20 shadow-sm flex-shrink-0"
                          style={{ backgroundColor: getColorHex(colorName) }}
                        />
                      ))}
                      {p.colors.length > 5 && (
                        <span className="text-[9px] text-white/30 ml-0.5">+{p.colors.length - 5}</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className={`font-semibold ${priceTierClass(p.tier)} flex items-center gap-1.5`}>
                    {p.price ? formatCurrency(displayPrice, curr) : 'N/A'}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setHistoryProduct(p) }}
                      className="text-white/30 hover:text-accent transition-colors flex-shrink-0"
                      title="View Price History"
                    >
                      <LineChart size={12} />
                    </button>
                  </div>
                  {displayCompare && (
                    <div className="text-[10px] text-white/30 line-through">
                      {formatCurrency(displayCompare, curr)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {threatBadge(p.threat)}
                </td>
                <td className="px-3 py-2">
                  <a
                    href={p.productUrl || p.brandUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-white/[0.13] text-white/40 hover:bg-accent/10 hover:text-info hover:border-accent/30 transition-colors"
                  >
                    <ExternalLink size={10} /> Inspect
                  </a>
                </td>
              </tr>

              {/* Expanded row */}
              {isExp && (
                <tr key={`${p.id}-exp`} className="bg-surface2">
                  <td colSpan={6} className="px-4 py-3 border-b border-white/[0.07]">
                    <div className="flex gap-4">
                      {/* Large product image */}
                      <div className="flex-shrink-0">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            loading="lazy"
                            className="w-28 h-36 object-cover rounded-lg border border-white/[0.07]"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        ) : (
                          <div className="w-28 h-36 rounded-lg border border-white/[0.07] bg-surface flex items-center justify-center text-white/10 text-[11px]">No image</div>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="flex flex-col gap-2.5 min-w-0">
                        <div>
                          <div className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">Brand</div>
                          <div className="text-[13px] text-white/80">{p.brandName}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">Product</div>
                          <div className="text-[13px] text-white">{p.name}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">Price</div>
                          <div className="flex items-baseline gap-2">
                            <div className={`text-[20px] font-semibold ${priceTierClass(p.tier)}`}>
                              {p.price ? formatCurrency(displayPrice, curr) : 'N/A'}
                            </div>
                            {displayCompare && (
                              <div className="text-[12px] text-white/40 line-through">
                                {formatCurrency(displayCompare, curr)}
                              </div>
                            )}
                          </div>
                        </div>
                        {p.category && (
                          <div>
                            <div className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">Category</div>
                            <div className="text-[12px] text-white/60">{p.category}</div>
                          </div>
                        )}
                        {p.colors && p.colors.length > 0 && (
                          <div>
                            <div className="text-[9px] text-white/30 uppercase tracking-widest mb-1.5">Colors Available</div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {p.colors.map((colorName, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.07] rounded-full pl-1.5 pr-2.5 py-0.5">
                                  <div 
                                    className="w-2.5 h-2.5 rounded-full border border-white/20 shadow-sm"
                                    style={{ backgroundColor: getColorHex(colorName) }}
                                  />
                                  <span className="text-[10px] text-white/60">{colorName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {vs && (
                          <div className="bg-white/[0.03] border border-white/[0.07] rounded-md px-3 py-2">
                            <div className="text-[9px] text-white/30 uppercase tracking-widest mb-1">IYS benchmark</div>
                            <div className={`text-[11px] ${vs.color}`}>{vs.text}</div>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <a
                            href={p.productUrl || p.brandUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-white/[0.13] text-white/50 hover:bg-accent/10 hover:text-info hover:border-accent/30 transition-colors self-start"
                          >
                            <ExternalLink size={11} /> Open product page
                          </a>
                          <button
                            onClick={() => setHistoryProduct(p)}
                            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-white/[0.13] bg-white/[0.03] text-white/70 hover:bg-accent/20 hover:text-accent hover:border-accent/50 transition-colors self-start"
                          >
                            <LineChart size={11} /> View History
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          )
        })}
      </tbody>
    </table>
    
    {historyProduct && (
      <PriceHistoryModal
        product={historyProduct}
        onClose={() => setHistoryProduct(null)}
      />
    )}
    </>
  )
}
