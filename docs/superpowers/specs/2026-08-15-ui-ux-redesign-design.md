# Donix Portal — UI/UX Redesign

**Date:** 2026-08-15
**Status:** Approved

## Context

Donix Portal: Next.js 16 App Router + NestJS, mock data. Two UI surfaces:
- Public site (dark `zinc-950`): Home, `/bots`, bot detail, `/community`, `/dashboard`, `/wallet`, blog (`/bai-ghim`, `/bai-moi`, `/category/*`, `/posts/*`).
- Admin `/admin`: basic post CRUD.

Current UI suffers "AI-default" disease: cyan→violet gradients everywhere, heavy glow/shadows, over-used "live ping" badges, mixed accents (cyan, violet, amber, emerald), inconsistent spacing/typography, admin not sharing the design system.

## Design Direction — "Premium dark, single accent"

1. **Palette** — deep black background, elevated surfaces, subtle 1px borders. Replace the cyan/violet mix with a **single signature accent: brand amber** (`--brand: 32 95% 48%`), already defined in tokens. Remove gradient decorations.
2. **Typography** — keep Space Grotesk for display/headings; body → Inter/Manrope for tight technical feel. Drop over-used uppercase `tracking-widest`.
3. **Components** — solid surfaces + 1px borders + light shadows + consistent radius. Static status dots instead of ping animations. Clear focus rings; respect `prefers-reduced-motion`.
4. **Layout** — compact sticky navbar, consistent grid, restrained hero. Admin → sidebar layout (shadcn sidebar already available).
5. **Accessibility** — WCAG 2.2: contrast ≥4.5:1, keyboard navigation, semantic landmarks.

## Scope

- Design tokens (`globals.css`)
- Shared layout: `Navbar`, `Footer`, admin sidebar
- Public pages: Home, Bots catalog, Bot detail, Community, Dashboard, Wallet, Blog (listing + post + category)
- Shared components + modals
- **No functional/logic changes** — presentation only. Keep `RoleContext`, data flow, API calls.

## Out of scope

- Backend/NestJS changes
- Data model / mock data changes
- New features
