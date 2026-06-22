'use client'

import { useState } from 'react'
import { Download, ChevronDown } from 'lucide-react'
import { ScrapedProduct } from '@/lib/scraper'
import * as XLSX from 'xlsx'

interface Props { products: ScrapedProduct[] }

export default function ExportButton({ products }: Props) {
  const [open, setOpen] = useState(false)

  const rows = () => products.map(p => ({
    Brand: p.brandName,
    Product: p.name,
    Category: p.category,
    'Price (EGP)': p.price || '',
    Tier: p.tier,
    'Threat vs IYS': p.threat === 'h' ? 'Direct threat' : p.threat === 'm' ? 'Adjacent' : 'Low overlap',
    'Product URL': p.productUrl || p.brandUrl,
    'Image URL': p.imageUrl,
    'Scraped At': p.scrapedAt,
  }))

  const exportCSV = () => {
    const data = rows()
    const headers = Object.keys(data[0]).join(',')
    const csvRows = data.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const csv = [headers, ...csvRows].join('\n')
    download(new Blob([csv], { type: 'text/csv' }), `iys_intel_${dateStr()}.csv`)
    setOpen(false)
  }

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rows())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Products')
    XLSX.writeFile(wb, `iys_intel_${dateStr()}.xlsx`)
    setOpen(false)
  }

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const dateStr = () => new Date().toISOString().slice(0, 10)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={!products.length}
        className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md border border-white/[0.13] text-white/60 hover:bg-white/[0.07] hover:text-white disabled:opacity-30 transition-colors"
      >
        <Download size={12} />
        Export
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-white/[0.13] rounded-lg overflow-hidden shadow-xl w-36">
            <button
              onClick={exportCSV}
              className="w-full text-left px-3 py-2 text-[12px] text-white/70 hover:bg-white/[0.07] transition-colors flex items-center gap-2"
            >
              <Download size={11} /> Export CSV
            </button>
            <button
              onClick={exportExcel}
              className="w-full text-left px-3 py-2 text-[12px] text-white/70 hover:bg-white/[0.07] transition-colors flex items-center gap-2"
            >
              <Download size={11} /> Export Excel
            </button>
            <div className="px-3 py-1.5 text-[10px] text-white/20 border-t border-white/[0.07]">
              {products.length.toLocaleString()} products
            </div>
          </div>
        </>
      )}
    </div>
  )
}
