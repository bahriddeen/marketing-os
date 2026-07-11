# AI Marketing OS

O'zbekiston bozori uchun AI marketing platformasi — brend ma'lumotlari asosida
kontent-plan, reels ssenariy, kopiraiting va marketing chat.

## Setup

1. **Supabase**: create a project at supabase.com, then run
   `supabase/migrations/0001_init.sql` in the SQL editor.
   In Authentication → Providers → Email, disable "Confirm email" (MVP).
2. **Env**: copy `.env.example` to `.env.local` and fill:
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase → Settings → API
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same page
   - `ANTHROPIC_API_KEY` — console.anthropic.com
3. **Run**: `npm install && npm run dev` → http://localhost:3000
4. **Tests**: `npm test` (vitest unit tests)

## Deploy (Vercel)

Import the GitHub repo in Vercel and set the same three env vars.

## Docs

- Technical requirement (TZ): `docs/superpowers/specs/2026-07-11-ai-marketing-os-design.md`
- Implementation plan: `docs/superpowers/plans/2026-07-11-mvp-core-phases-0-2.md`
