'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface PriceHistoryEntry {
  date: string
  price: number
  priceChanged: boolean
  priceDelta: number
}

interface Props {
  product: any
  onClose: () => void
}

export default function PriceHistoryModal({ product, onClose }: Props) {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(`/api/products/history?brandId=${product.brandId}`)
        if (!res.ok) throw new Error('Failed to fetch history')
        const data = await res.json()
        
        // Find specific product's history
        const productData = data.find((p: any) => p.productId === product.id)
        setHistory(productData?.history || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    fetchHistory()
  }, [product.brandId, product.id])

  // Chart scaling calculations
  const width = 600
  const height = 200
  const padding = 20
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2

  // Only consider prices from history. If none, just use current price to draw a flat line
  const prices = history.length > 0 ? history.map(h => h.price) : [product.price]
  
  // Pad the min/max a bit so the line doesn't hit the very top/bottom edge
  const minPrice = Math.min(...prices) * 0.95
  const maxPrice = Math.max(...prices) * 1.05
  const priceRange = maxPrice - minPrice || 1

  // Function to map a data point to SVG coordinates
  const getCoordinates = (index: number, price: number) => {
    // If only 1 data point, put it in the middle or span it across
    const x = history.length > 1 
      ? padding + (index / (history.length - 1)) * innerWidth 
      : padding + innerWidth / 2
      
    const y = height - padding - ((price - minPrice) / priceRange) * innerHeight
    return { x, y }
  }

  // Generate SVG path strings
  let linePath = ''
  let areaPath = ''
  
  if (history.length > 0) {
    const points = history.map((h, i) => getCoordinates(i, h.price))
    
    // Draw the line path
    linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    
    // Draw the area path (line path + closing edges to the bottom)
    areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
  } else {
    // Fallback if no history yet: just draw a flat line of current price
    const y = getCoordinates(0, product.price).y
    linePath = `M ${padding} ${y} L ${width - padding} ${y}`
    areaPath = `M ${padding} ${y} L ${width - padding} ${y} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-white/[0.13] rounded-xl w-[700px] shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <div className="text-[15px] font-medium text-white">{product.name}</div>
            <div className="text-[12px] text-white/40 mt-0.5">Price History & Forecasting Foundation</div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-white/40">
              <Loader2 className="animate-spin mr-2" size={18} /> Loading history...
            </div>
          ) : error ? (
            <div className="text-center py-10 text-danger text-[13px]">{error}</div>
          ) : (
            <>
              {/* Chart Section */}
              <div className="relative w-full rounded-lg bg-surface2 border border-white/5 p-4 mb-6">
                {history.length < 2 && (
                  <div className="absolute top-4 right-4 bg-accent/20 text-accent text-[10px] px-2 py-1 rounded-full border border-accent/30 font-medium">
                    Tracking started
                  </div>
                )}
                
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[220px] overflow-visible">
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  
                  {/* Grid Lines */}
                  {[0, 0.5, 1].map(ratio => (
                    <line 
                      key={ratio}
                      x1={padding} 
                      y1={padding + ratio * innerHeight} 
                      x2={width - padding} 
                      y2={padding + ratio * innerHeight} 
                      stroke="rgba(255,255,255,0.05)" 
                      strokeWidth="1" 
                      strokeDasharray="4 4"
                    />
                  ))}
                  
                  {/* Data Area */}
                  <path d={areaPath} fill="url(#areaGradient)" />
                  
                  {/* Data Line */}
                  <path 
                    d={linePath} 
                    fill="none" 
                    stroke="#818cf8" 
                    strokeWidth="3" 
                    filter="url(#glow)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Data Points */}
                  {history.length > 0 ? history.map((h, i) => {
                    const pt = getCoordinates(i, h.price)
                    return (
                      <circle 
                        key={i} 
                        cx={pt.x} 
                        cy={pt.y} 
                        r="4" 
                        fill="#surface" 
                        stroke="#818cf8" 
                        strokeWidth="2" 
                        className="hover:r-[6px] transition-all cursor-pointer"
                      >
                        <title>{formatCurrency(h.price, product.currency)} on {new Date(h.date).toLocaleDateString()}</title>
                      </circle>
                    )
                  }) : (
                    // Flat line single point
                    <circle cx={getCoordinates(0, product.price).x} cy={getCoordinates(0, product.price).y} r="4" fill="#surface" stroke="#818cf8" strokeWidth="2">
                       <title>{formatCurrency(product.price, product.currency)} (Current)</title>
                    </circle>
                  )}
                </svg>
              </div>

              {/* Data Table */}
              <div className="border border-white/10 rounded-lg overflow-hidden bg-surface2">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-[11px] uppercase tracking-widest text-white/40">
                      <th className="py-3 px-4 font-medium">Date</th>
                      <th className="py-3 px-4 font-medium">Price</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-white/30 text-[12px]">
                          Historical tracking activated. Data will populate on next scrape.
                        </td>
                      </tr>
                    ) : (
                      // Reverse array to show newest at the top
                      [...history].reverse().map((h, i) => (
                        <tr key={i} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02]">
                          <td className="py-3 px-4 text-white/70">
                            {new Date(h.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </td>
                          <td className="py-3 px-4 font-medium text-white/90">
                            {formatCurrency(h.price, product.currency)}
                          </td>
                          <td className="py-3 px-4">
                            {!h.priceChanged ? (
                              <div className="flex items-center text-white/30 text-[12px]"><Minus size={12} className="mr-1"/> Unchanged</div>
                            ) : h.priceDelta < 0 ? (
                              <div className="flex items-center text-danger text-[12px]"><TrendingDown size={12} className="mr-1"/> Dropped</div>
                            ) : (
                              <div className="flex items-center text-success text-[12px]"><TrendingUp size={12} className="mr-1"/> Increased</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {h.priceDelta !== 0 ? (
                              <span className={h.priceDelta < 0 ? 'text-danger' : 'text-success'}>
                                {h.priceDelta > 0 ? '+' : ''}{h.priceDelta}
                              </span>
                            ) : (
                              <span className="text-white/20">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
