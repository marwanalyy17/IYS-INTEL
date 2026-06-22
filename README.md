# IYS Intelligence — Deployment Guide
> Competitive Pricing & Product Dashboard for In Your Shoe

---

## Stack
- **Next.js 14** (App Router)
- **Vercel KV** (Redis) — product storage
- **Vercel Cron** — hourly scraping
- **Cheerio + Axios** — lightweight scraping (no Playwright needed on Vercel)
- **Tailwind CSS** — styling

---

## Deploy in 5 steps

### 1. Push to GitHub
```bash
cd iys-intel
git init
git add .
git commit -m "initial: IYS Intelligence dashboard"
git remote add origin https://github.com/YOUR_USERNAME/iys-intel.git
git push -u origin main
```

### 2. Import on Vercel
- Go to https://vercel.com/new
- Click **Import Git Repository** → select `iys-intel`
- Framework: **Next.js** (auto-detected)
- Click **Deploy** (it will fail the first time — that's fine, env vars needed next)

### 3. Add Vercel KV (Redis)
- In your Vercel project → **Storage** tab → **Create Database** → **KV**
- Name it `iys-products`
- Click **Connect** → select your project
- Vercel auto-injects `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`

### 4. Set environment variables
In Vercel project → **Settings** → **Environment Variables**, add:

| Variable | Value |
|---|---|
| `CRON_SECRET` | Any random string (e.g. `openssl rand -hex 32`) |
| `NEXT_PUBLIC_CRON_SECRET` | Same value as above |

The KV variables are already set automatically after Step 3.

### 5. Redeploy
```bash
# Trigger a new deployment after env vars are set
vercel --prod
# or just push a commit:
git commit --allow-empty -m "trigger redeploy" && git push
```

---

## First scrape

After deploy, visit:
```
https://your-project.vercel.app/api/cron/scrape
```
Or click **Rescrape** in the dashboard top bar.

This populates the KV database. After that, the cron runs automatically every hour.

---

## Cron schedule

Defined in `vercel.json`:
```json
{
  "crons": [{ "path": "/api/cron/scrape", "schedule": "0 * * * *" }]
}
```
`0 * * * *` = top of every hour. To change to every 6 hours: `0 */6 * * *`

---

## Adding a new brand

1. Click **+ Add Brand** in the dashboard
2. Paste the brand's URL
3. Set tier and threat level
4. Click **Add & Scrape**

The system auto-detects Shopify vs custom HTML. Products appear immediately.

---

## Synonym engine

The search engine uses `src/lib/synonyms.ts` to expand queries. Searches for:
- `swants` → also finds: sweatpants, joggers, track pants, sweats
- `pjoys` → also finds: pajamas, pyjamas, loungewear, sleep set
- `pshorts` → also finds: sleep shorts, lounge shorts, pajama shorts
- `swimmies` → also finds: swim shorts, board shorts, swim trunks

To add new synonyms, edit `SYNONYM_GROUPS` in `src/lib/synonyms.ts`.

---

## Project structure

```
src/
  app/
    page.tsx                    ← Dashboard entry
    layout.tsx
    globals.css
    api/
      products/route.ts         ← GET all products
      cron/scrape/route.ts      ← Hourly scraper (+ manual trigger)
      scrape-brand/route.ts     ← Add new brand on demand
      brands/route.ts           ← List / delete custom brands
  components/
    Dashboard.tsx               ← Main layout + search
    ProductTable.tsx            ← Expandable table view
    ProductGrid.tsx             ← Card grid view
    BrandPanel.tsx              ← Brand health side panel
    AddBrandModal.tsx           ← Add brand UI
    ExportButton.tsx            ← CSV + Excel export
  lib/
    brands.ts                   ← All 43 brand configs
    synonyms.ts                 ← IYS keyword synonym engine
    scraper.ts                  ← Shopify + HTML scrapers
    storage.ts                  ← Vercel KV read/write
```

---

## Local development

```bash
npm install
cp .env.example .env.local
# Fill in KV vars from your Vercel project settings
npm run dev
```

Then open http://localhost:3000

To test scraping locally:
```bash
curl http://localhost:3000/api/cron/scrape
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Products not loading | Check KV env vars in Vercel dashboard |
| Brand returns 0 products | May have bot protection; try adding their `/collections/all` URL |
| Cron not running | Vercel Cron requires Pro plan or check Vercel Cron logs |
| Build fails | Run `npm run build` locally to see TypeScript errors |
