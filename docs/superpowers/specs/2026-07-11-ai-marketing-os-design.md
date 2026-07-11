# AI Marketing OS — Technical Requirement (TZ v2) & Design

**Date:** 2026-07-11
**Status:** Draft — awaiting founder review
**Original TZ:** Uzbek-language product spec (10 modules). This document is the corrected, buildable version.

---

## 1. Context & Goal

AI platform for marketing/SMM specialists in the Uzbekistan market. Automates daily marketing work: content planning, reels scripts, copywriting, strategy, briefs — all generated from a persistent Brand Knowledge Base so the user never re-explains their company.

**Business goal:** save a marketer's weekly workload by ≥50%.
**Build context:** solo founder + Claude, ship MVP ASAP, validate with real agencies.

## 2. Corrections to the Original TZ

The original TZ was a good product vision but not yet a technical requirement. These changes were made:

| # | Original | Corrected | Why |
|---|----------|-----------|-----|
| 1 | One company per user (implied) | **Workspaces with multiple brands** + team seats | The agency use case ("Vetline uchun…", "Mega Star uchun…") requires it; it's the $149 tier |
| 2 | No language strategy | **Uzbek (Latin) + Russian** content generation, selectable per generation; UI in Uzbek | Real Uzbekistan SMM market posts in both |
| 3 | Unlimited generations (implied) | **Weighted credit system per tier** | Every generation costs LLM tokens; $29/mo unlimited loses money |
| 4 | No payment mechanism | **Manual activation first** (admin panel + Payme transfer), Payme/Click API post-launch | Stripe unavailable in UZ; don't block launch on merchant paperwork |
| 5 | Competitor Analyzer auto-scrapes IG/Telegram | **v1.1: paste-in analysis** (user pastes competitor posts/stats, AI analyzes) | Scraping violates ToS and breaks constantly; official APIs don't expose competitor data |
| 6 | Report Generator reads Instagram insights | **Deferred to v2**; v1.1 accepts manual CSV/screenshot input | Meta Graph API needs business verification + app review (months) |
| 7 | Google Sheets / Notion export | **Excel (.xlsx) + CSV only in MVP** | OAuth integrations add weeks for marginal value |
| 8 | "1000+ prompt library" | Deferred; it's content authoring, not engineering | Focus engineering time on the generation engine |
| 9 | "50% time saved" as the metric | **Measurable proxies** (§10) | Original metric is unmeasurable |
| 10 | No stack, data model, auth, NFRs | All specified below | Required to build |

**MVP module set (confirmed, unchanged from original):** Brand Knowledge Base, Content Planner, Reels Generator, Copywriting Generator, AI Marketing Assistant Chat.

**Post-MVP order:** v1.1 = Strategy Builder + Creative Brief Generator + Competitor Analyzer (paste-in) → v1.2 = Prompt Library + Report Generator (manual input) → v2 = Workflow Builder, Meta API integrations.

## 3. Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | **Next.js (App Router) + TypeScript** | One codebase, one language |
| DB / Auth / Storage | **Supabase** (Postgres, Row Level Security, Supabase Auth) | Free tier covers MVP; email+password and Google login |
| AI | **Anthropic API, `claude-opus-4-8`** via `@anthropic-ai/sdk` | Best Uzbek/Russian quality; adaptive thinking; streaming; structured outputs; prompt caching on brand context |
| UI | Tailwind CSS + shadcn/ui | Fast to build, looks professional |
| Excel export | `exceljs` | Server-side .xlsx generation |
| Hosting | Vercel | Zero-ops deploys |
| Payments (MVP) | Manual: admin activates plan after Payme transfer | Payme/Click Merchant API in v1.1 |

## 4. Data Model (Postgres)

```
workspaces        id, name, owner_id, plan (starter|professional|agency|trial),
                  plan_expires_at, created_at
workspace_members workspace_id, user_id, role (owner|member)
brands            id, workspace_id, name, industry, products (jsonb),
                  services (jsonb), usp, target_audience (jsonb),
                  competitors (jsonb), tone_of_voice, brand_values,
                  default_language (uz|ru), created_at, updated_at
generations       id, workspace_id, brand_id, user_id, module
                  (content_plan|reels|copy|chat), input (jsonb),
                  output (jsonb), model, input_tokens, output_tokens,
                  cache_read_tokens, credits_spent, created_at
chat_conversations id, workspace_id, brand_id, user_id, title, created_at
chat_messages     id, conversation_id, role (user|assistant), content,
                  created_at
credit_ledger     id, workspace_id, delta, reason
                  (generation|plan_grant|admin_adjust), generation_id,
                  created_at            -- balance = SUM(delta)
```

RLS: every table scoped to `workspace_id` via membership. All AI calls happen in server routes only (API key never reaches the client).

## 5. Generation Engine (the core)

One shared service used by all modules:

```
buildBrandContext(brand)  →  system prompt block (cached with cache_control)
  + module template (per-module instructions + output schema)
  + user input (topic, goal, platform, …)
  →  client.messages.stream() with output_config.format (structured JSON)
  →  parse → save to generations → decrement credits → return to UI
```

Key implementation rules:
- **Prompt caching:** brand context + module instructions form the stable prefix with `cache_control: {type: "ephemeral"}`; user input goes after. Cuts input cost ~90% for a user's repeated generations.
- **Structured outputs** (`output_config.format` with JSON schema) for Content Planner and Reels — guarantees parseable output for tables and Excel export.
- **Streaming** for chat and long generations (30-day plans) — UI shows progress.
- **Language:** every generation request carries `language: "uz" | "ru"`; the system prompt instructs native-quality output in that language (not translated-sounding).
- **Token logging:** store usage from every response — this is how we validate unit economics in week one.

## 6. Module Specifications (MVP)

### 6.1 Brand Knowledge Base
- CRUD for brands within a workspace. Form sections: company, products/services, USP, target audience (segments), competitors, tone of voice, brand values, default language.
- Guided onboarding: user can paste free-form company description → AI pre-fills the structured fields (one cheap generation, big onboarding win).
- Brand limit by plan (§9).

### 6.2 Content Planner
- **Input:** brand, platform (Instagram/Telegram/both), goal (awareness/engagement/sales), post count (up to 30), month/period, language.
- **Output (structured):** table of posts — date, topic, format (post/carousel/reels/story), hook, CTA, goal of the post.
- **Export:** .xlsx and CSV. Plans are saved and re-openable.

### 6.3 Reels Scenario Generator
- **Input:** brand, topic, product/service, goal, language.
- **Output:** 3 variants (Expert / Emotional / Sales), each with: hook (first 3 seconds), shot-by-shot scenes, voiceover text, caption, CTA, suggested duration.

### 6.4 Copywriting Generator
- **Input:** brand, type (Instagram caption / Telegram post / ad copy / landing section / SMS / push), topic or offer, style (formal / sales / premium / friendly), language.
- **Output:** 2–3 alternatives per request; SMS/push respect length limits (SMS ≤ 160 chars per segment guidance).

### 6.5 AI Marketing Assistant Chat
- Brand-scoped chat ("Vetline uchun 30 ta reels g'oya ber") — brand context always in the (cached) system prompt.
- Streaming responses, conversation history persisted, multiple conversations per brand.
- Chat can reference the user's saved content plans ("shu oygi planimga mos 5 ta story g'oya ber") — include latest plan summary in context when present.

## 7. LLM Cost Model & Credits

Model: `claude-opus-4-8` — $5 / $25 per 1M input/output tokens. Estimated cost per generation (with warm cache):

| Generation | Est. tokens (in/out) | Est. cost |
|------------|---------------------|-----------|
| 30-day content plan | 3K / 8K | ~$0.21 |
| Reels (3 variants) | 2.5K / 3K | ~$0.09 |
| Copy piece | 2.5K / 0.8K | ~$0.03 |
| Chat message | 3K / 0.8K | ~$0.03 |

**Weighted credits:** content plan = 10, reels = 3, copy = 1, chat = 1.
Worst-case COGS stays under ~35% of subscription price at the limits below. Validate against real logged usage in the first two weeks; a cheaper model tier for low-stakes generations is a later cost lever if needed.

## 8. Non-Functional Requirements

- **Languages:** UI in Uzbek (Latin); generated content in Uzbek or Russian per request. (Russian UI: post-MVP.)
- **Security:** RLS on all tables; Anthropic key server-side only; no cross-workspace data leakage.
- **Rate limiting:** per-user request throttle on generation endpoints (protects both API bill and abuse).
- **Refusal/error handling:** generation failures never eat credits; user sees a retry option.
- **Data:** brand data is customer confidential — no sharing between workspaces, deletable on request.

## 9. Monetization

| Plan | Price | Credits/mo | Brands | Seats |
|------|-------|-----------|--------|-------|
| Trial | free, 7 days | 30 | 1 | 1 |
| Starter | $29 | 300 | 1 | 1 |
| Professional | $79 | 1,000 | 5 | 3 |
| Agency | $149 | 3,000 | unlimited | 10 |
| Enterprise | custom | custom | custom | custom |

MVP payment flow: user picks a plan → sees Payme transfer instructions → admin confirms payment in the admin panel → plan activated. Payme/Click Merchant API automation in v1.1.

## 10. Success Metrics (replacing "50% time saved")

- Activation: % of signups that create a brand **and** run ≥1 generation (target ≥60%).
- Time-to-first-content-plan < 10 minutes from signup.
- Weekly retention: % of workspaces with ≥5 generations/week.
- Conversion: trial → paid ≥10% at validation stage.
- Unit economics: LLM COGS ≤35% of MRR (from `generations` token logs).

## 11. Build Roadmap

| Phase | Deliverable | Est. |
|-------|-------------|------|
| 0. Foundation | Next.js + Supabase + auth + workspace shell, deployed on Vercel | 2–3 days |
| 1. Brand Knowledge Base | Brand CRUD + AI-assisted onboarding fill | 2–3 days |
| 2. Generation engine + Copywriting | Shared engine (caching, structured output, token logging) proven on the simplest module | 3–4 days |
| 3. Content Planner | Structured 30-day plan + xlsx/CSV export + saved plans | 3 days |
| 4. Reels Generator | 3-variant output UI | 2 days |
| 5. AI Chat | Streaming brand-scoped chat + history | 3 days |
| 6. Credits & plans | Credit ledger, limits, trial, admin activation panel | 2–3 days |
| 7. Polish & launch | Landing page (uz), onboarding, error states, beta with 3–5 real agencies | 3–4 days |

**Total: ~3–4 working weeks** to a beta in real agencies' hands. Each phase ends deployed and demoable.

## 12. Risks

1. **Uzbek output quality** — biggest product risk. Mitigate: evaluate real outputs with native marketers in phase 2; invest in prompt engineering per module; Russian as fallback.
2. **Unit economics** — mitigated by credits + token logging from day one.
3. **Competitor Analyzer expectations** — market the paste-in version honestly; never promise auto-scraping.
4. **Solo-founder scope creep** — the module cut-line above is the contract; nothing outside MVP until beta feedback.
