'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ScrapedProduct } from '@/lib/scraper'
import { expandQuery, scoreProduct, IYS_QUICK_TAGS } from '@/lib/synonyms'
import { BRANDS } from '@/lib/brands'
import { convertToEGP } from '@/lib/currency'
import { IYS_BENCHMARKS } from '@/lib/benchmarks'
import ProductTable from './ProductTable'
import ProductGrid from './ProductGrid'
import AddBrandModal from './AddBrandModal'
import ExportButton from './ExportButton'
import {
  Search, LayoutGrid, Table2, Building2, Plus,
  RefreshCw, Wifi, WifiOff, ChevronDown, X, Trash2, Tag
} from 'lucide-react'

interface Meta {
  lastScraped: string | null
  totalProducts: number
  brandCount: number
}

type SortKey = 'relevance' | 'price-asc' | 'price-desc' | 'brand' | 'threat'
type ViewMode = 'table' | 'grid'

export default function Dashboard() {
  const [products, setProducts] = useState<ScrapedProduct[]>([])
  const [meta, setMeta] = useState<Meta>({ lastScraped: null, totalProducts: 0, brandCount: 0 })
  const [filtered, setFiltered] = useState<ScrapedProduct[]>([])
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [sort, setSort] = useState<SortKey>('relevance')
  const [view, setView] = useState<ViewMode>('table')
  const [showEGP, setShowEGP] = useState(false)
  const [visibleCount, setVisibleCount] = useState(100)
  const [addBrandOpen, setAddBrandOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [error, setError] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false)
  const [brandSearch, setBrandSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const brandDropdownRef = useRef<HTMLDivElement>(null)

  // ── Load products ──────────────────────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/products', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const { products: prods, meta: m } = await res.json()
      setProducts(prods ?? [])
      setMeta(m ?? { lastScraped: null, totalProducts: 0, brandCount: 0 })
    } catch {
      setError('Could not load products. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  // ── Debounce search query ──────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(t)
  }, [query])

  // ── Trigger manual scrape ──────────────────────────────────────────────────
  const triggerScrape = async () => {
    setScraping(true)
    try {
      await fetch('/api/cron/scrape', {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
      })
      await loadProducts()
    } finally {
      setScraping(false)
    }
  }

  // ── Search + filter ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!products.length) { setFiltered([]); return }

    const q = debouncedQuery.trim()
    let result: (ScrapedProduct & { _score?: number })[] = []

    if (!q) {
      result = [...products]
    } else {
      const terms = expandQuery(q)
      result = products
        .map(p => ({
          ...p,
          _score: scoreProduct(p.name, p.category, p.tags, terms),
        }))
        .filter(p => (p._score ?? 0) > 0)
        .sort((a, b) => (b._score ?? 0) - (a._score ?? 0))
    }

    // Apply brand filter
    if (brandFilter) {
      result = result.filter(p => p.brandId === brandFilter)
    }

    // Apply sort (after relevance)
    const getEgpPrice = (p: ScrapedProduct) => {
      const cur = BRANDS.find(b => b.id === p.brandId)?.currency || p.currency || 'EGP'
      return convertToEGP(p.price ?? 0, cur)
    }
    if (sort === 'price-asc') result.sort((a, b) => getEgpPrice(a) - getEgpPrice(b))
    else if (sort === 'price-desc') result.sort((a, b) => getEgpPrice(b) - getEgpPrice(a))
    else if (sort === 'brand') result.sort((a, b) => a.brandName.localeCompare(b.brandName))
    else if (sort === 'threat') {
      const o: Record<string, number> = { h: 0, m: 1, l: 2 }
      result.sort((a, b) => (o[a.threat] ?? 1) - (o[b.threat] ?? 1))
    }

    setFiltered(result)
    setVisibleCount(100) // Reset visible count on new search/sort
  }, [products, debouncedQuery, sort, brandFilter])

  const displayedProducts = filtered.slice(0, visibleCount)

  const handleTag = (q: string, label: string) => {
    if (activeTag === label) {
      setActiveTag('')
      setQuery('')
    } else {
      setActiveTag(label)
      setQuery(q)
      searchRef.current?.focus()
    }
  }

  const brandCount = new Set(filtered.map(p => p.brandId)).size

  // Build unique brand list from loaded products for the dropdown
  const availableBrands = Array.from(
    new Map(products.map(p => [p.brandId, p.brandName])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const filteredBrandList = brandSearch
    ? availableBrands.filter(([, name]) => name.toLowerCase().includes(brandSearch.toLowerCase()))
    : availableBrands

  const activeBrandName = availableBrands.find(([id]) => id === brandFilter)?.[1] ?? ''

  // Close brand dropdown when clicking outside
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
  const lastScrapedLabel = meta.lastScraped
    ? new Date(meta.lastScraped).toLocaleString('en-EG', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Never'

  // Dynamic Average Calculations
  let iysAvgText = "N/A"
  let compAvgText = "N/A"

  if (filtered.length > 0) {
    let totalComp = 0
    let validComp = 0
    let totalIys = 0
    let validIys = 0

    filtered.forEach(p => {
      const brandCurrency = BRANDS.find(b => b.id === p.brandId)?.currency || p.currency || 'EGP'
      if (brandCurrency === 'EGP') {
        const egpPrice = p.price ?? 0
        if (egpPrice > 0) {
          totalComp += egpPrice
          validComp++
        }
      }
    })

    if (validComp > 0) compAvgText = Math.round(totalComp / validComp).toLocaleString() + " EGP"

    // IYS Average Logic
    const activeTagObj = activeTag ? IYS_QUICK_TAGS.find(t => t.label === activeTag) : undefined

    if (activeTagObj && (activeTagObj as any).benchKey && IYS_BENCHMARKS[(activeTagObj as any).benchKey]) {
      // Direct match from the selected Quick Tag
      iysAvgText = IYS_BENCHMARKS[(activeTagObj as any).benchKey].price.toLocaleString() + " EGP"
    } else if (!activeTag && query) {
      // Try to match search query to a quick tag query or benchmark key
      const queryLower = query.toLowerCase()
      const matchedTag = IYS_QUICK_TAGS.find(t => t.query === queryLower || t.label.toLowerCase() === queryLower)
      if (matchedTag && (matchedTag as any).benchKey && IYS_BENCHMARKS[(matchedTag as any).benchKey]) {
        iysAvgText = IYS_BENCHMARKS[(matchedTag as any).benchKey].price.toLocaleString() + " EGP"
      } else {
        const matchedBenchKey = Object.keys(IYS_BENCHMARKS).find(k => k === queryLower || k.includes(queryLower))
        if (matchedBenchKey && IYS_BENCHMARKS[matchedBenchKey]) {
          iysAvgText = IYS_BENCHMARKS[matchedBenchKey].price.toLocaleString() + " EGP"
        }
      }
    }

    if (iysAvgText === "N/A") {
      // Fallback: average the benchmarks of the matching competitor products using the synonym scoring engine
      filtered.forEach(p => {
        let bestTag = null
        let bestScore = 0
        
        // Find which IYS category best matches this competitor product
        for (const tag of IYS_QUICK_TAGS) {
          if (!(tag as any).benchKey) continue
          const score = scoreProduct(p.name, p.category, p.tags, expandQuery(tag.query))
          if (score > bestScore) {
            bestScore = score
            bestTag = tag
          }
        }

        if (bestTag && (bestTag as any).benchKey) {
          const bench = IYS_BENCHMARKS[(bestTag as any).benchKey]
          if (bench && bench.price > 0) {
            totalIys += bench.price
            validIys++
          }
        }
      })
      if (validIys > 0) iysAvgText = Math.round(totalIys / validIys).toLocaleString() + " EGP"
    }
  }

  return (
    <div className="flex flex-col h-screen bg-bg text-white overflow-hidden">

      {/* ── Topbar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-surface border-b border-white/[0.07] flex-shrink-0">
        <div className="flex flex-col leading-tight whitespace-nowrap">
          <span className="text-[13px] font-semibold tracking-wide">IYS Radar</span>
          <span className="text-[10px] text-white/40 tracking-wider uppercase">Market Research Dashboard</span>
        </div>

        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" size={14} />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveTag('') }}
            placeholder='Search across all brands — "swants", "linen shirt", "cargo", "pjoys"...'
            className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-surface2 border border-white/[0.13] rounded-md text-white placeholder-white/30 outline-none focus:border-accent transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border border-success/40 bg-success/15 text-success whitespace-nowrap shadow-sm">
          <span className="font-semibold uppercase tracking-wider">{activeTag || (query ? `"${query}"` : 'All Categories')}</span>
          <span className="w-px h-3 bg-success/30 mx-1"></span>
          <span className="font-medium">IYS: {iysAvgText}</span>
          <span className="text-success/60 mx-0.5">vs</span>
          <span className="font-bold">Local Market: {compAvgText}</span>
        </div>

        <button
          onClick={() => setAddBrandOpen(true)}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md border border-white/[0.13] text-white/60 hover:bg-white/[0.07] hover:text-white transition-colors"
        >
          <Plus size={12} /> Add Brand
        </button>

        <a
          href="/sale"
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 hover:border-danger/50 transition-colors"
        >
          <Tag size={12} /> Sale
        </a>

        <ExportButton products={filtered} />

        <button
          onClick={triggerScrape}
          disabled={scraping}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md border border-white/[0.13] text-white/60 hover:bg-white/[0.07] disabled:opacity-40 transition-colors"
          title="Manually trigger a full rescrape (auto runs hourly)"
        >
          <RefreshCw size={12} className={scraping ? 'animate-spin' : ''} />
          {scraping ? 'Scraping…' : 'Rescrape'}
        </button>


        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md border border-white/[0.13] text-red-400/80 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors ml-2"
        >
          Logout
        </button>

        <span className="text-[9px] text-white/25 uppercase tracking-widest whitespace-nowrap ml-auto">Powered by Marwan Aly</span>
      </div>

      {/* ── Quick tags ── */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-surface2 border-b border-white/[0.07] overflow-x-auto flex-shrink-0">
        <span className="text-[9px] text-white/30 uppercase tracking-widest whitespace-nowrap">IYS cats</span>
        {IYS_QUICK_TAGS.map(t => (
          <button
            key={t.label}
            onClick={() => handleTag(t.query, t.label)}
            className={`text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors ${
              activeTag === t.label
                ? 'bg-accent/10 text-info border-accent/40'
                : 'border-white/[0.07] text-white/40 hover:text-white/70 hover:border-white/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Weekly Insights ── */}
      {(meta as any).insights && (meta as any).insights.length > 0 && (
        <div className="px-4 py-2 bg-surface flex items-center gap-3 border-b border-white/[0.07] flex-shrink-0 overflow-x-auto no-scrollbar">
          <span className="text-[9px] text-accent uppercase tracking-widest whitespace-nowrap font-semibold">Weekly Insights</span>
          <div className="flex gap-4">
            {(meta as any).insights.map((insight: string, idx: number) => (
              <div key={idx} className="flex items-center gap-1.5 text-[11px] text-white/70 whitespace-nowrap bg-white/[0.03] px-2.5 py-1 rounded-md border border-white/[0.05]">
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60"></span>
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Workspace ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Main area ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 bg-surface border-b border-white/[0.07] flex-shrink-0">
            <span className="text-[11px] text-white/50 flex-1">
              {loading ? 'Loading…' : error ? (
                <span className="text-danger flex items-center gap-1"><WifiOff size={11} /> {error}</span>
              ) : (
                <><strong className="text-white">{filtered.length.toLocaleString()}</strong> products across <strong className="text-white">{brandCount}</strong> brands
                {query && <> for &quot;<em className="text-info">{query}</em>&quot;</>}
                </>
              )}
            </span>

            {meta.lastScraped && (
              <span className="text-[10px] text-white/25 flex items-center gap-1 whitespace-nowrap">
                <Wifi size={10} /> Last scraped: {lastScrapedLabel}
              </span>
            )}

            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="text-[11px] px-2 py-1 rounded-md border border-white/[0.13] bg-surface2 text-white/70 outline-none cursor-pointer"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="price-asc">Price: Low → High</option>
              <option value="price-desc">Price: High → Low</option>
              <option value="brand">Brand A–Z</option>
              <option value="threat">Threat level</option>
            </select>

            {/* Brand Filter Dropdown */}
            <div ref={brandDropdownRef} className="relative">
              <button
                onClick={() => { setBrandDropdownOpen(v => !v); setBrandSearch('') }}
                className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border transition-colors ${
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
                      placeholder="Search brands..."
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
                      <div
                        key={id}
                        className={`flex items-center group w-full px-3 py-1.5 text-[11px] transition-colors ${
                          brandFilter === id ? 'bg-accent/10 text-info' : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
                        }`}
                      >
                        <button
                          onClick={() => { setBrandFilter(id); setBrandDropdownOpen(false); setBrandSearch('') }}
                          className="flex-1 text-left truncate"
                        >
                          {name}
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (!confirm(`Remove "${name}" and all its products from the dashboard?`)) return
                            try {
                              await fetch('/api/brands', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id }),
                              })
                              if (brandFilter === id) setBrandFilter('')
                              loadProducts()
                            } catch {}
                          }}
                          className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title={`Remove ${name}`}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                    {filteredBrandList.length === 0 && (
                      <div className="px-3 py-2 text-[10px] text-white/30">No brands found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-1">
              <label className="flex items-center gap-1.5 mr-2 text-[11px] text-white/60 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={showEGP} 
                  onChange={e => setShowEGP(e.target.checked)}
                  className="accent-accent"
                />
                View in EGP
              </label>
              <button onClick={() => setView('table')} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors ${view === 'table' ? 'bg-accent/10 text-info border-accent/40' : 'border-white/[0.13] text-white/40 hover:text-white/70'}`}>
                <Table2 size={12} /> Table
              </button>
              <button onClick={() => setView('grid')} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors ${view === 'grid' ? 'bg-accent/10 text-info border-accent/40' : 'border-white/[0.13] text-white/40 hover:text-white/70'}`}>
                <LayoutGrid size={12} /> Grid
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full text-white/30 text-sm gap-2">
                <RefreshCw size={16} className="animate-spin" /> Loading products…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/20 gap-3">
                <Search size={32} strokeWidth={1} />
                <p className="text-sm">{query ? `No results for "${query}"` : 'Search above to find products'}</p>
                {!meta.lastScraped && (
                  <button onClick={triggerScrape} className="text-[12px] text-accent border border-accent/30 px-3 py-1.5 rounded-md hover:bg-accent/10 mt-2">
                    Run first scrape
                  </button>
                )}
              </div>
            ) : (
              <>
                {view === 'table' ? (
                  <ProductTable products={displayedProducts} showEGP={showEGP} />
                ) : (
                  <ProductGrid products={displayedProducts} showEGP={showEGP} />
                )}

                {visibleCount < filtered.length && (
                  <div className="flex justify-center py-6 border-t border-white/[0.05]">
                    <button
                      onClick={() => setVisibleCount(v => v + 100)}
                      className="px-4 py-2 text-[11px] bg-surface2 border border-white/[0.13] rounded-md text-white/70 hover:text-white hover:bg-white/[0.07] transition-colors"
                    >
                      Load more products ({filtered.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      {addBrandOpen && (
        <AddBrandModal
          onClose={() => setAddBrandOpen(false)}
          onAdded={loadProducts}
        />
      )}
    </div>
  )
}
