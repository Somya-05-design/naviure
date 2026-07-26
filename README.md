# NAVIURE — Luxury Photography Portfolio

A production-ready, premium luxury photography portfolio built with Next.js, featuring cinematic animations, scroll-driven storytelling, and a full admin dashboard.

## Tech Stack

- **Framework:** Next.js 15+ App Router, React 19, TypeScript
- **Styling:** TailwindCSS 4
- **Animation:** GSAP, ScrollTrigger, Framer Motion, Lenis Smooth Scroll
- **Storage:** Local filesystem (dev) / Cloudflare R2 (production)
- **Deployment:** Vercel Hobby

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the cinematic intro experience.

## Project Structure

```
app/                    # Next.js App Router pages
  about/                # About page
  portfolio/            # Photos & Videos
  contact/              # Contact page
  admin/                # Admin dashboard
  actions/              # Server Actions
components/
  animations/           # Page transitions & GSAP effects
  features/             # Page-specific components
  layout/               # Navbar, Footer
  ui/                   # Reusable UI components
  admin/                # Admin components
hooks/                  # Custom React hooks
lib/
  storage/              # Storage adapter (local/R2)
  services/             # Content services
  db/                   # JSON data-access layer
data/                   # JSON content store
public/
  images/               # Brand assets (logo, favicon, hero)
  manifest.json         # PWA manifest
types/                  # TypeScript definitions
scripts/                # Ops scripts (audit, R2 upload, derivatives)
```

All gallery media lives in Cloudflare R2 and is served from `https://media.naviure.in`. The repository contains no gallery photos or videos — only brand assets.

## Gallery Management

Gallery media is managed entirely through the admin dashboard and stored in Cloudflare R2. Upload photos and videos via **Admin → Library**, organized by the Category → Project → Album → Media hierarchy. Only metadata is kept in `data/*.json`.

Available ops scripts:

```bash
npm run audit:production      # Repository / production readiness audit
npm run assets:upload         # Upload brand assets to R2
npm run media:derivatives     # Generate thumbnail/web derivatives on R2
```

## Admin Dashboard

Access at `/admin/login`

Default credentials (change in production):
- Email: `admin@naviure.in`
- Password: `naviure2024`

Admin features:
- Upload photos & videos
- Manage categories
- Edit About, Contact, Homepage content
- SEO settings
- Backup & restore
- Storage management

## Storage Configuration

### Local (Development)
```env
STORAGE_PROVIDER=local
```

### Cloudflare R2 (Production / Local with R2)
```env
STORAGE_PROVIDER=r2
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=naviure-media
R2_PUBLIC_URL=https://pub-9d9fd744fcf14adba99469b156800a2c.r2.dev
```

Gallery media is stored as `{category}/{album}/photos|videos/{unique-file}`.
Only metadata is kept in `data/*.json`. Public URLs always use `R2_PUBLIC_URL` — never the S3 API endpoint.

**Rename note:** Editing a category or album name/slug updates JSON metadata only. Existing R2 objects are **not** moved. Media keep their original `storageKey` and public URL.

## Deployment

### Vercel

1. Install the Vercel CLI: `npm i -g vercel`
2. Run `vercel` from the project root to deploy
3. Set environment variables from `.env.example`
4. Deploy to production with `vercel --prod`

Domain: `naviure.in`

## Performance

Target Lighthouse scores: 95+ across all categories.

Optimizations included:
- AVIF/WebP image formats
- Lazy loading with blur placeholders
- Dynamic imports for heavy components
- Package import optimization
- Video autoplay only when visible

## License

Private — NAVIURE Studio
