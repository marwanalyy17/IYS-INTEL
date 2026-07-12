import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IYS Radar — Market Research Dashboard',
  description: 'Real-time competitive pricing and product intelligence for In Your Shoe',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
