'use client'

import { ScrapedProduct } from '@/lib/scraper'
import { ExternalLink } from 'lucide-react'
import { convertToEGP, formatCurrency } from '@/lib/currency'
import { BRANDS } from '@/lib/brands'

interface Props { products: ScrapedProduct[]; showEGP?: boolean }

function priceTierClass(tier: string) {
  if (tier === 'budget') return 'text-success'
  if (tier === 'premium') return 'text-danger'
  return 'text-info'
}

export default function ProductGrid({ products, showEGP }: Props) {
  return (
    <div className="p-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
      {products.map(p => {
        // Always use the brand config currency as source of truth.
        // Old scraped data in Redis incorrectly stores 'EGP' for all brands.
        const brandCurrency = BRANDS.find(b => b.id === p.brandId)?.currency || p.currency || 'EGP'

        const displayPrice = showEGP ? convertToEGP(p.price, brandCurrency) : p.price
        const displayCompare = p.compareAtPrice ? (showEGP ? convertToEGP(p.compareAtPrice, brandCurrency) : p.compareAtPrice) : undefined
        const curr = showEGP ? 'EGP' : brandCurrency

        return (
        <div
          key={p.id}
          className="bg-surface border border-white/[0.07] rounded-xl overflow-hidden hover:border-white/[0.15] transition-colors group"
        >
          {/* Product image */}
          <div className="aspect-[3/4] bg-surface2 flex items-center justify-center overflow-hidden">
            {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                onError={e => {
                  const el = e.target as HTMLImageElement
                  el.style.display = 'none'
                  el.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-white/10 text-xs">No image</div>'
                }}
              />
            ) : (
              <div className="text-white/10 text-[11px]">No image</div>
            )}
          </div>

          {/* Card body */}
          <div className="p-2.5">
            <div className="text-[10px] text-white/30 font-medium uppercase tracking-widest mb-1 truncate">{p.brandName}</div>
            <div className="text-[12px] text-white/80 leading-tight mb-1.5 line-clamp-2">{p.name}</div>
            {p.colors && p.colors.length > 0 && (
              <div className="text-[10px] text-white/50 mb-1.5 truncate">Colors: {p.colors.join(', ')}</div>
            )}
            {p.category && (
              <div className="text-[10px] text-white/25 border border-white/[0.07] px-1.5 py-0.5 rounded-full inline-block mb-2">{p.category}</div>
            )}
            <div className="flex items-baseline gap-2 mb-2">
              <div className={`text-[14px] font-semibold ${priceTierClass(p.tier)}`}>
                {p.price ? formatCurrency(displayPrice, curr) : 'N/A'}
              </div>
              {displayCompare && (
                <div className="text-[10px] text-white/40 line-through">
                  {formatCurrency(displayCompare, curr)}
                </div>
              )}
            </div>
            <a
              href={p.productUrl || p.brandUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-white/[0.13] text-white/40 hover:bg-accent/10 hover:text-info hover:border-accent/30 transition-colors"
            >
              <ExternalLink size={10} /> Inspect
            </a>
          </div>
        </div>
        )
      })}
    </div>
  )
}
