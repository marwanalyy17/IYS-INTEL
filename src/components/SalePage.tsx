'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ScrapedProduct } from '@/lib/scraper'
import { BRANDS } from '@/lib/brands'
import { convertToEGP, formatCurrency } from '@/lib/currency'
import { getColorHex } from '@/lib/colors'
import PriceHistoryModal from './PriceHistoryModal'
import {
  Tag, Building2, ChevronDown, X, Search, ArrowLeft,
  ExternalLink, LineChart, SlidersHorizontal, Percent
} from 'lucide-react'

type SortKey = 'discount-desc' | 'discount-asc' | 'price-asc' | 'price-desc' | 'brand'

interface SaleProduct extends ScrapedProduct {
  discountPercent: number
  savingsEGP: number
}

export default function SalePage() {
  const [products, setProducts] = useState<ScrapedProduct[]>([])
  const [saleProducts, setSaleProducts] = useState<SaleProduct[]>([])
  const [filtered, setFiltered] = useState<SaleProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('discount-desc')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false)
  const [brandSearch, setBrandSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(60)
  const [historyProduct, setHistoryProduct] = useState<ScrapedProduct | null>(null)
  const brandDropdownRef = useRef<HTMLDivElement>(null)

  // ── Load products ──────────────────────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data.products ?? [])
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  // ── Extract sale products ──────────────────────────────────────────────────
  useEffect(() => {
    const sales: SaleProduct[] = []
    for (const p of products) {
      if (p.compareAtPrice && p.compareAtPrice > p.price && p.price > 0) {
        const brandConfig = BRANDS.find(b => b.id === p.brandId)
        const brandCurrency = brandConfig?.currency || p.currency || 'EGP'

        // Only include local market brands (EGP currency)
        if (brandCurrency !== 'EGP') continue

        const currentEGP = convertToEGP(p.price, brandCurrency)
        const originalEGP = convertToEGP(p.compareAtPrice, brandCurrency)
        const discountPercent = Math.round(((originalEGP - currentEGP) / originalEGP) * 100)
        const savingsEGP = Math.round(originalEGP - currentEGP)
        sales.push({ ...p, discountPercent, savingsEGP })
      }
    }
    setSaleProducts(sales)
  }, [products])

  // ── Filter & sort ──────────────────────────────────────────────────────────
  useEffect(() => {
    let result = [...saleProducts]

    if (brandFilter) result = result.filter(p => p.brandId === brandFilter)
    if (categoryFilter) result = result.filter(p => p.category.toLowerCase() === categoryFilter.toLowerCase())
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      )
    }

    if (sort === 'discount-desc') result.sort((a, b) => b.discountPercent - a.discountPercent)
    else if (sort === 'discount-asc') result.sort((a, b) => a.discountPercent - b.discountPercent)
    else if (sort === 'price-asc') {
      result.sort((a, b) => {
        const ca = BRANDS.find(br => br.id === a.brandId)?.currency || a.currency || 'EGP'
        const cb = BRANDS.find(br => br.id === b.brandId)?.currency || b.currency || 'EGP'
        return convertToEGP(a.price, ca) - convertToEGP(b.price, cb)
      })
    } else if (sort === 'price-desc') {
      result.sort((a, b) => {
        const ca = BRANDS.find(br => br.id === a.brandId)?.currency || a.currency || 'EGP'
        const cb = BRANDS.find(br => br.id === b.brandId)?.currency || b.currency || 'EGP'
        return convertToEGP(b.price, cb) - convertToEGP(a.price, ca)
      })
    } else if (sort === 'brand') result.sort((a, b) => a.brandName.localeCompare(b.brandName))

    setFiltered(result)
    setVisibleCount(60)
  }, [saleProducts, sort, brandFilter, categoryFilter, searchQuery])

  // ── Build dropdown data ────────────────────────────────────────────────────
  const availableBrands = Array.from(
    new Map(saleProducts.map(p => [p.brandId, p.brandName])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const filteredBrandList = brandSearch
    ? availableBrands.filter(([, name]) => name.toLowerCase().includes(brandSearch.toLowerCase()))
    : availableBrands

  const activeBrandName = availableBrands.find(([id]) => id === brandFilter)?.[1] ?? ''

  const categories = Array.from(
    new Set(saleProducts.filter(p => !brandFilter || p.brandId === brandFilter).map(p => p.category.toLowerCase()))
  ).filter(Boolean).sort()

  // Close brand dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target as Node)) {
        setBrandDropdownOpen(false)
        setBrandSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Infinite scroll
  useEffect(() => {
    const handler = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
        setVisibleCount(v => v + 40)
      }
    }
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const displayedProducts = filtered.slice(0, visibleCount)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalSaleItems = filtered.length
  const brandsOnSale = new Set(filtered.map(p => p.brandId)).size
  const avgDiscount = totalSaleItems > 0
    ? Math.round(filtered.reduce((sum, p) => sum + p.discountPercent, 0) / totalSaleItems)
    : 0
  const deepestDiscount = totalSaleItems > 0
    ? Math.max(...filtered.map(p => p.discountPercent))
    : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <span className="text-white/40 text-sm">Loading sale products…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-white">
      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-white/[0.07]">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <a
              href="/"
              className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white transition-colors"
            >
              <ArrowLeft size={13} /> Dashboard
            </a>
            <div className="flex-1" />
            <div className="flex items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5 text-white/40">
                <Tag size={11} className="text-danger" />
                <span className="text-white/70 font-medium">{totalSaleItems}</span> items on sale
              </div>
              <div className="flex items-center gap-1.5 text-white/40">
                <Building2 size={11} className="text-info" />
                <span className="text-white/70 font-medium">{brandsOnSale}</span> brands
              </div>
              <div className="flex items-center gap-1.5 text-white/40">
                <Percent size={11} className="text-success" />
                Avg <span className="text-white/70 font-medium">{avgDiscount}%</span> off
              </div>
              {deepestDiscount > 0 && (
                <div className="flex items-center gap-1.5 text-white/40">
                  🔥 Up to <span className="text-danger font-medium">{deepestDiscount}%</span> off
                </div>
              )}
            </div>
          </div>

          {/* ── Filters bar ── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" size={13} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search sale items…"
                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-surface2 border border-white/[0.13] rounded-md text-white placeholder-white/30 outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Brand Filter */}
            <div ref={brandDropdownRef} className="relative">
              <button
                onClick={() => { setBrandDropdownOpen(v => !v); setBrandSearch('') }}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md border transition-colors ${
                  brandFilter
                    ? 'bg-accent/10 text-info border-accent/40'
                    : 'border-white/[0.13] text-white/70 hover:bg-white/[0.07]'
                }`}
              >
                <Building2 size={11} />
                {brandFilter ? activeBrandName : 'All Brands'}
                {brandFilter ? (
                  <X size={11} className="ml-1 hover:text-white" onClick={e => { e.stopPropagation(); setBrandFilter(''); setBrandDropdownOpen(false) }} />
                ) : (
                  <ChevronDown size={11} />
                )}
              </button>

              {brandDropdownOpen && (
                <div className="absolute top-full mt-1 left-0 w-52 bg-surface border border-white/[0.13] rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-1.5 border-b border-white/[0.07]">
                    <input
                      type="text"
                      value={brandSearch}
                      onChange={e => setBrandSearch(e.target.value)}
                      placeholder="Search brands…"
                      autoFocus
                      className="w-full px-2 py-1 text-[11px] bg-surface2 border border-white/[0.13] rounded-md text-white placeholder-white/30 outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {!brandSearch && (
                      <button
                        onClick={() => { setBrandFilter(''); setBrandDropdownOpen(false); setBrandSearch('') }}
                        className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                          !brandFilter ? 'bg-accent/10 text-info' : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
                        }`}
                      >
                        All Brands
                      </button>
                    )}
                    {filteredBrandList.map(([id, name]) => (
                      <button
                        key={id}
                        onClick={() => { setBrandFilter(id); setBrandDropdownOpen(false); setBrandSearch('') }}
                        className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                          brandFilter === id ? 'bg-accent/10 text-info' : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                    {filteredBrandList.length === 0 && (
                      <div className="px-3 py-2 text-[10px] text-white/30">No brands found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal size={11} className="text-white/30" />
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="text-[11px] bg-surface2 border border-white/[0.13] rounded-md px-2 py-1.5 text-white/70 outline-none cursor-pointer hover:border-white/25"
              >
                <option value="discount-desc">Biggest Discount</option>
                <option value="discount-asc">Smallest Discount</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
                <option value="brand">Brand A–Z</option>
              </select>
            </div>
          </div>

          {/* ── Category pills ── */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setCategoryFilter('')}
                className={`whitespace-nowrap text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                  !categoryFilter
                    ? 'bg-accent/15 text-info border-accent/30'
                    : 'border-white/[0.1] text-white/40 hover:bg-white/[0.05] hover:text-white/70'
                }`}
              >
                All Categories
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
                  className={`whitespace-nowrap text-[10px] px-2.5 py-1 rounded-full border transition-colors capitalize ${
                    categoryFilter === cat
                      ? 'bg-accent/15 text-info border-accent/30'
                      : 'border-white/[0.1] text-white/40 hover:bg-white/[0.05] hover:text-white/70'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Product Grid ── */}
      <div className="max-w-[1600px] mx-auto px-4 py-4">
        {displayedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/30">
            <Tag size={32} className="mb-3 opacity-30" />
            <div className="text-sm">No sale items found</div>
            <div className="text-[11px] mt-1">Try adjusting your filters</div>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))' }}>
            {displayedProducts.map(p => {
              const brandCurrency = BRANDS.find(b => b.id === p.brandId)?.currency || p.currency || 'EGP'
              const displayPrice = p.price
              const displayCompare = p.compareAtPrice ?? 0
              const curr = brandCurrency

              return (
                <div
                  key={p.id}
                  className="bg-surface border border-white/[0.07] rounded-xl overflow-hidden hover:border-white/[0.15] transition-all group relative"
                >
                  {/* Discount badge */}
                  <div className="absolute top-2 left-2 z-10 bg-danger/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-lg backdrop-blur-sm">
                    -{p.discountPercent}%
                  </div>

                  {/* Product image */}
                  <div className="aspect-[3/4] bg-surface2 flex items-center justify-center overflow-hidden">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                      <div className="flex items-center gap-1 mb-1.5 overflow-x-auto no-scrollbar">
                        {p.colors.map((colorName, idx) => (
                          <div
                            key={idx}
                            title={colorName}
                            className="w-2.5 h-2.5 rounded-full border border-white/20 shadow-sm flex-shrink-0"
                            style={{ backgroundColor: getColorHex(colorName) }}
                          />
                        ))}
                      </div>
                    )}

                    {p.category && (
                      <div className="text-[10px] text-white/25 border border-white/[0.07] px-1.5 py-0.5 rounded-full inline-block mb-2">{p.category}</div>
                    )}

                    {/* Pricing */}
                    <div className="flex items-baseline gap-2 mb-1">
                      <div className="text-[14px] font-semibold text-danger">
                        {formatCurrency(displayPrice, curr)}
                      </div>
                      <div className="text-[10px] text-white/40 line-through">
                        {formatCurrency(displayCompare, curr)}
                      </div>
                    </div>
                    <div className="text-[10px] text-success/80 mb-2">
                      Save {formatCurrency(displayCompare - displayPrice, curr)}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <a
                        href={p.productUrl || p.brandUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-white/[0.13] text-white/40 hover:bg-accent/10 hover:text-info hover:border-accent/30 transition-colors flex-1 justify-center"
                      >
                        <ExternalLink size={10} /> View
                      </a>
                      <button
                        onClick={() => setHistoryProduct(p)}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-white/[0.13] bg-white/[0.03] text-white/60 hover:bg-accent/20 hover:text-accent hover:border-accent/50 transition-colors flex-1 justify-center"
                      >
                        <LineChart size={10} /> History
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {visibleCount < filtered.length && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => setVisibleCount(v => v + 40)}
              className="text-[11px] text-white/40 border border-white/[0.13] px-4 py-1.5 rounded-md hover:bg-white/[0.05] hover:text-white/70 transition-colors"
            >
              Load more ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>

      {/* Price History Modal */}
      {historyProduct && (
        <PriceHistoryModal
          product={historyProduct}
          onClose={() => setHistoryProduct(null)}
        />
      )}
    </div>
  )
}
