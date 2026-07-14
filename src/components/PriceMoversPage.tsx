'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { BRANDS } from '@/lib/brands'
import { formatCurrency } from '@/lib/currency'
import {
  ArrowLeft, TrendingUp, TrendingDown, Building2, ChevronDown, X,
  Search, SlidersHorizontal, ArrowUpRight, ArrowDownRight, ExternalLink,
  Activity
} from 'lucide-react'

interface PriceMover {
  productId: string
  brandId: string
  brandName: string
  productName: string
  category: string
  imageUrl: string
  productUrl: string
  currency: string
  currentPrice: number
  previousPrice: number
  priceDelta: number
  changePercent: number
  direction: 'up' | 'down'
  changedAt: string
}

type SortKey = 'recent' | 'biggest-increase' | 'biggest-decrease' | 'price-high' | 'price-low'
type DirectionFilter = 'all' | 'up' | 'down'

export default function PriceMoversPage() {
  const [movers, setMovers] = useState<PriceMover[]>([])
  const [filtered, setFiltered] = useState<PriceMover[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('recent')
  const [direction, setDirection] = useState<DirectionFilter>('all')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false)
  const [brandSearch, setBrandSearch] = useState('')
  const brandDropdownRef = useRef<HTMLDivElement>(null)

  const loadMovers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/price-moves')
      const data = await res.json()
      setMovers(data.movers ?? [])
    } catch {
      setMovers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMovers() }, [loadMovers])

  // ── Filter & sort ──────────────────────────────────────────────────────────
  useEffect(() => {
    let result = [...movers]

    if (direction !== 'all') result = result.filter(m => m.direction === direction)
    if (brandFilter) result = result.filter(m => m.brandId === brandFilter)
    if (categoryFilter) result = result.filter(m => m.category.toLowerCase() === categoryFilter.toLowerCase())
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(m =>
        m.productName.toLowerCase().includes(q) ||
        m.brandName.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      )
    }

    if (sort === 'recent') result.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
    else if (sort === 'biggest-increase') result.sort((a, b) => b.priceDelta - a.priceDelta)
    else if (sort === 'biggest-decrease') result.sort((a, b) => a.priceDelta - b.priceDelta)
    else if (sort === 'price-high') result.sort((a, b) => b.currentPrice - a.currentPrice)
    else if (sort === 'price-low') result.sort((a, b) => a.currentPrice - b.currentPrice)

    setFiltered(result)
  }, [movers, sort, direction, brandFilter, categoryFilter, searchQuery])

  // ── Brand dropdown data ────────────────────────────────────────────────────
  const availableBrands = Array.from(
    new Map(movers.map(m => [m.brandId, m.brandName])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const filteredBrandList = brandSearch
    ? availableBrands.filter(([, name]) => name.toLowerCase().includes(brandSearch.toLowerCase()))
    : availableBrands

  const activeBrandName = availableBrands.find(([id]) => id === brandFilter)?.[1] ?? ''

  const categories = Array.from(
    new Set(movers.filter(m => !brandFilter || m.brandId === brandFilter).map(m => m.category.toLowerCase()))
  ).filter(Boolean).sort()

  // Close dropdown on outside click
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

  // ── Stats ──────────────────────────────────────────────────────────────────
  const increases = filtered.filter(m => m.direction === 'up')
  const decreases = filtered.filter(m => m.direction === 'down')

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-EG', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch { return iso }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <span className="text-white/40 text-sm">Loading price movements…</span>
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
            <a href="/" className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white transition-colors">
              <ArrowLeft size={13} /> Dashboard
            </a>
            <div className="flex-1" />
            <div className="flex items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5 text-white/40">
                <Activity size={11} className="text-info" />
                <span className="text-white/70 font-medium">{filtered.length}</span> price moves
              </div>
              <div className="flex items-center gap-1.5 text-white/40">
                <TrendingUp size={11} className="text-success" />
                <span className="text-success font-medium">{increases.length}</span> increases
              </div>
              <div className="flex items-center gap-1.5 text-white/40">
                <TrendingDown size={11} className="text-danger" />
                <span className="text-danger font-medium">{decreases.length}</span> drops
              </div>
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
                placeholder="Search products…"
                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-surface2 border border-white/[0.13] rounded-md text-white placeholder-white/30 outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Direction filter */}
            <div className="flex items-center rounded-md border border-white/[0.13] overflow-hidden">
              {(['all', 'up', 'down'] as DirectionFilter[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`text-[11px] px-2.5 py-1.5 transition-colors ${
                    direction === d
                      ? d === 'up' ? 'bg-success/15 text-success' : d === 'down' ? 'bg-danger/15 text-danger' : 'bg-accent/10 text-info'
                      : 'text-white/50 hover:bg-white/[0.05]'
                  }`}
                >
                  {d === 'all' ? 'All' : d === 'up' ? '↑ Increases' : '↓ Drops'}
                </button>
              ))}
            </div>

            {/* Brand Filter */}
            <div ref={brandDropdownRef} className="relative">
              <button
                onClick={() => { setBrandDropdownOpen(v => !v); setBrandSearch('') }}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md border transition-colors ${
                  brandFilter ? 'bg-accent/10 text-info border-accent/40' : 'border-white/[0.13] text-white/70 hover:bg-white/[0.07]'
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
                        onClick={() => { setBrandFilter(''); setBrandDropdownOpen(false) }}
                        className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${!brandFilter ? 'bg-accent/10 text-info' : 'text-white/60 hover:bg-white/[0.05]'}`}
                      >
                        All Brands
                      </button>
                    )}
                    {filteredBrandList.map(([id, name]) => (
                      <button
                        key={id}
                        onClick={() => { setBrandFilter(id); setBrandDropdownOpen(false) }}
                        className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${brandFilter === id ? 'bg-accent/10 text-info' : 'text-white/60 hover:bg-white/[0.05]'}`}
                      >
                        {name}
                      </button>
                    ))}
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
                <option value="recent">Most Recent</option>
                <option value="biggest-increase">Biggest Increase</option>
                <option value="biggest-decrease">Biggest Drop</option>
                <option value="price-high">Price: High → Low</option>
                <option value="price-low">Price: Low → High</option>
              </select>
            </div>
          </div>

          {/* ── Category pills ── */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setCategoryFilter('')}
                className={`whitespace-nowrap text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                  !categoryFilter ? 'bg-accent/15 text-info border-accent/30' : 'border-white/[0.1] text-white/40 hover:bg-white/[0.05]'
                }`}
              >
                All Categories
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
                  className={`whitespace-nowrap text-[10px] px-2.5 py-1 rounded-full border transition-colors capitalize ${
                    categoryFilter === cat ? 'bg-accent/15 text-info border-accent/30' : 'border-white/[0.1] text-white/40 hover:bg-white/[0.05]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="max-w-[1600px] mx-auto px-4 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/30">
            <Activity size={32} className="mb-3 opacity-30" />
            <div className="text-sm">No price movements detected</div>
            <div className="text-[11px] mt-1">Price changes will appear here after the next scrape cycle</div>
          </div>
        ) : (
          <div className="bg-surface border border-white/[0.07] rounded-xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.07] text-white/40 text-[10px] uppercase tracking-widest">
                  <th className="text-left py-2.5 px-3 font-medium">Product</th>
                  <th className="text-left py-2.5 px-3 font-medium">Brand</th>
                  <th className="text-left py-2.5 px-3 font-medium">Category</th>
                  <th className="text-right py-2.5 px-3 font-medium">Previous</th>
                  <th className="text-right py-2.5 px-3 font-medium">Current</th>
                  <th className="text-right py-2.5 px-3 font-medium">Change</th>
                  <th className="text-right py-2.5 px-3 font-medium">%</th>
                  <th className="text-left py-2.5 px-3 font-medium">Date</th>
                  <th className="text-center py-2.5 px-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => (
                  <tr
                    key={`${m.productId}-${idx}`}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group"
                  >
                    {/* Product */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2.5">
                        {m.imageUrl ? (
                          <div className="w-9 h-9 rounded-md overflow-hidden bg-surface2 flex-shrink-0">
                            <img
                              src={m.imageUrl}
                              alt={m.productName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-md bg-surface2 flex-shrink-0" />
                        )}
                        <span className="text-white/80 truncate max-w-[220px]" title={m.productName}>
                          {m.productName}
                        </span>
                      </div>
                    </td>

                    {/* Brand */}
                    <td className="py-2 px-3 text-white/50">{m.brandName}</td>

                    {/* Category */}
                    <td className="py-2 px-3">
                      <span className="text-[10px] text-white/30 border border-white/[0.07] px-1.5 py-0.5 rounded-full capitalize">
                        {m.category}
                      </span>
                    </td>

                    {/* Previous price */}
                    <td className="py-2 px-3 text-right text-white/40 line-through">
                      {formatCurrency(m.previousPrice, m.currency)}
                    </td>

                    {/* Current price */}
                    <td className="py-2 px-3 text-right font-medium text-white/80">
                      {formatCurrency(m.currentPrice, m.currency)}
                    </td>

                    {/* Change */}
                    <td className="py-2 px-3 text-right">
                      <span className={`inline-flex items-center gap-0.5 font-medium ${m.direction === 'up' ? 'text-success' : 'text-danger'}`}>
                        {m.direction === 'up' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        {m.direction === 'up' ? '+' : ''}{formatCurrency(m.priceDelta, m.currency)}
                      </span>
                    </td>

                    {/* Percent */}
                    <td className="py-2 px-3 text-right">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        m.direction === 'up'
                          ? 'bg-success/15 text-success'
                          : 'bg-danger/15 text-danger'
                      }`}>
                        {m.direction === 'up' ? '+' : '-'}{m.changePercent}%
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-2 px-3 text-white/30 text-[10px]">
                      {formatDate(m.changedAt)}
                    </td>

                    {/* Link */}
                    <td className="py-2 px-3 text-center">
                      <a
                        href={m.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/20 hover:text-info transition-colors opacity-0 group-hover:opacity-100"
                        title="View product"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
