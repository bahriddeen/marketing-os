# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unstyled create-next-app starter look with the approved design system (spec: `docs/superpowers/specs/2026-07-12-frontend-redesign-design.md`) across the landing page, auth pages, app shell, and every existing in-app page.

**Architecture:** A CSS-variable token system in `globals.css` (colors, swapped for dark mode via `prefers-color-scheme`) feeds Tailwind v4's `@theme inline` block, so every component uses plain utility classes (`bg-canvas`, `text-ink`, `bg-accent`, etc.) with zero per-component dark-mode logic. Three shared primitives (`Button`, `Input`/`Textarea`/`Select`/`Label`, `Card`) live under `src/components/ui/` and every page is restyled to consume them. One signature component (`CaptionDemo`) renders the live-typing Uzbek caption demo and is reused on the landing hero and the auth split panel.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (CSS-first `@theme`, no `tailwind.config.*` file in this repo), `next/font/google`, new dependency `lucide-react` for icons.

## Global Constraints

- UI copy stays Uzbek (Latin) only — no Russian, no English strings in shipped UI.
- No backend/data-model changes. No changes to Server Action signatures (`signIn`, `signUp`, `signOut`, `saveBrand`, `deleteBrand`) or their error-message strings.
- No new automated tests — this is a presentation-only change (spec §7). Verification is `npx tsc --noEmit`, `npm run lint`, `npm run build`, and manual dev-server click-through.
- Dark mode via `prefers-color-scheme` only — no manual toggle in this pass.
- Only one new dependency: `lucide-react`.
- Color tokens (exact hex, from spec §2.1):
  light → canvas `#FAFAF8`, surface `#FFFFFF`, ink `#14171B`, muted `#6B7280`, line `#E6E4DF`, accent `#146B4F`, accent-hover `#0F5A41`, accent-soft `#E3F3EA`, danger `#B3261E`.
  dark → canvas `#101214`, surface `#17191C`, ink `#F2F1ED`, muted `#9AA0A6`, line `#2A2D30`, accent `#2FA679`, accent-hover `#3DBF8C`, accent-soft `#173A2C`, danger `#F2867B`.
- Fonts (from spec §2.2): Instrument Sans (display/headings), Inter (body/UI), JetBrains Mono (credit numbers, mono labels).
- Card radius `0.75rem` (Tailwind `rounded-xl`), input/button radius `0.625rem`.

---

### Task 1: Design tokens, fonts, and the `lucide-react` dependency

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `package.json` / `package-lock.json` (via `npm install`)

**Interfaces:**
- Produces: CSS custom properties `--canvas`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`, `--accent-hover`, `--accent-soft`, `--danger` (swapped in `@media (prefers-color-scheme: dark)`), and Tailwind theme colors `bg-canvas`/`text-ink`/`bg-accent`/etc. via `@theme inline`. Tailwind font families `font-display`, `font-sans` (default), `font-mono`. `lucide-react` icons importable by later tasks.

- [ ] **Step 1: Install the icon dependency**

Run: `npm install lucide-react`
Expected: `package.json` gains a `lucide-react` entry under `dependencies`; command exits 0.

- [ ] **Step 2: Replace `src/app/globals.css` with the token system**

```css
@import "tailwindcss";

:root {
  --canvas: #FAFAF8;
  --surface: #FFFFFF;
  --ink: #14171B;
  --muted: #6B7280;
  --line: #E6E4DF;
  --accent: #146B4F;
  --accent-hover: #0F5A41;
  --accent-soft: #E3F3EA;
  --danger: #B3261E;
}

@theme inline {
  --color-canvas: var(--canvas);
  --color-surface: var(--surface);
  --color-ink: var(--ink);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-soft: var(--accent-soft);
  --color-danger: var(--danger);
  --font-display: var(--font-instrument-sans);
  --font-sans: var(--font-inter);
  --font-mono: var(--font-jetbrains-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --canvas: #101214;
    --surface: #17191C;
    --ink: #F2F1ED;
    --muted: #9AA0A6;
    --line: #2A2D30;
    --accent: #2FA679;
    --accent-hover: #3DBF8C;
    --accent-soft: #173A2C;
    --danger: #F2867B;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Replace `src/app/layout.tsx` with the new fonts and metadata**

```tsx
import type { Metadata } from "next";
import { Instrument_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Marketing OS",
  description: "Brendingiz uchun tayyor kontent — bir necha soniyada.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uz"
      className={`${instrumentSans.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-ink font-sans">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0 with no errors (existing pages still compile against the old class names since Tailwind utility classes like `bg-white`/`text-gray-500` are untouched core Tailwind utilities, unaffected by the new tokens).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/globals.css src/app/layout.tsx
git commit -m "feat: design token system, brand fonts, lucide-react dependency"
```

---

### Task 2: UI primitives — Button, Input/Textarea/Select/Label, Card

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/Card.tsx`

**Interfaces:**
- Consumes: Tailwind color tokens from Task 1 (`bg-accent`, `text-ink`, `border-line`, etc.).
- Produces:
  - `Button` — default export, props `variant?: "primary" | "secondary" | "ghost" | "danger"` plus all native `ButtonHTMLAttributes<HTMLButtonElement>`.
  - `Input`, `Textarea`, `Select` — named exports from `src/components/ui/Input.tsx`, forwardRef components wrapping native `<input>`/`<textarea>`/`<select>`, accept their native HTML attributes.
  - `Label`, `FieldError` — named exports from `src/components/ui/Input.tsx`, `{ children: React.ReactNode }`.
  - `Card` — default export from `src/components/ui/Card.tsx`, wraps native `HTMLAttributes<HTMLDivElement>`.

- [ ] **Step 1: Create `src/components/ui/Button.tsx`**

```tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-[0.625rem] px-4 py-2.5 text-sm font-medium transition-[transform,background-color,color,opacity] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "border border-line bg-surface text-ink hover:bg-accent-soft",
  ghost: "text-muted hover:text-ink",
  danger: "text-danger hover:underline",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export default Button;
```

- [ ] **Step 2: Create `src/components/ui/Input.tsx`**

```tsx
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const fieldBase =
  "w-full rounded-[0.625rem] border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => (
  <input ref={ref} className={`${fieldBase} ${className}`} {...props} />
));
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = "", ...props }, ref) => (
  <textarea
    ref={ref}
    className={`${fieldBase} resize-none ${className}`}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className = "", ...props }, ref) => (
  <select ref={ref} className={`${fieldBase} ${className}`} {...props} />
));
Select.displayName = "Select";

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-ink">
      {children}
    </span>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-sm text-danger">{children}</p>;
}
```

- [ ] **Step 3: Create `src/components/ui/Card.tsx`**

```tsx
import type { HTMLAttributes } from "react";

export default function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0. These files aren't imported anywhere yet, so this only checks they compile standalone.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Input.tsx src/components/ui/Card.tsx
git commit -m "feat: Button, Input/Textarea/Select/Label, Card UI primitives"
```

---

### Task 3: Signature component — `CaptionDemo`

**Files:**
- Create: `src/components/marketing/CaptionDemo.tsx`

**Interfaces:**
- Consumes: `lucide-react`'s `Check` icon (Task 1), color tokens (Task 1).
- Produces: `CaptionDemo` default export, props `{ variant?: "full" | "quiet" }` (defaults to `"full"`). `"full"` renders a light `Card`-style panel for the landing hero; `"quiet"` renders a translucent panel meant to sit on the always-dark auth side-panel background.

- [ ] **Step 1: Create `src/components/marketing/CaptionDemo.tsx`**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

const CAPTION =
  "Yangi mavsum boshlandi 🌿\n\nVetline'da endi uy hayvonlaringiz uchun bepul birinchi konsultatsiya. Joy soni cheklangan — hoziroq yozing!\n\n#vetline #toshkent #uyhayvonlari";

export default function CaptionDemo({
  variant = "full",
}: {
  variant?: "full" | "quiet";
}) {
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      setTyped(CAPTION);
      setDone(true);
      return;
    }
    if (started.current) return;
    started.current = true;

    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(CAPTION.slice(0, i));
      if (i >= CAPTION.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 18);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={
        variant === "full"
          ? "rounded-xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]"
          : "rounded-xl border border-white/10 bg-white/5 p-6"
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wide text-muted">
          Kopiraiting · Instagram
        </span>
        {done && (
          <span className="flex items-center gap-1 text-xs font-medium text-accent">
            <Check size={14} strokeWidth={2.5} />
            Tayyor
          </span>
        )}
      </div>
      <p
        className={`min-h-[7.5rem] whitespace-pre-wrap text-sm leading-relaxed ${
          variant === "full" ? "text-ink" : "text-white"
        }`}
      >
        {typed}
        {!done && <span className="animate-pulse">▍</span>}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/CaptionDemo.tsx
git commit -m "feat: live-typing caption demo signature component"
```

---

### Task 4: Auth split layout, login and signup pages

**Files:**
- Create: `src/components/auth/AuthSplitLayout.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/signup/page.tsx`

**Interfaces:**
- Consumes: `CaptionDemo` (Task 3), `Button`/`Input`/`Label` (Task 2), existing `signIn`/`signUp` server actions from `src/app/auth/actions.ts` (unchanged signatures).
- Produces: `AuthSplitLayout` default export, props `{ children: React.ReactNode }`.

- [ ] **Step 1: Create `src/components/auth/AuthSplitLayout.tsx`**

```tsx
import Link from "next/link";
import CaptionDemo from "@/components/marketing/CaptionDemo";

export default function AuthSplitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-[#14171B] p-12 md:flex">
        <Link
          href="/"
          className="font-display text-lg font-semibold text-white"
        >
          AI Marketing OS
        </Link>
        <div className="max-w-sm">
          <p className="mb-6 font-display text-2xl font-semibold leading-snug text-white">
            Brendingiz haqida yozing — qolganini AI bajaradi.
          </p>
          <CaptionDemo variant="quiet" />
        </div>
        <p className="text-sm text-white/40">
          O‘zbekiston SMM va marketing mutaxassislari uchun
        </p>
      </div>
      <div className="flex w-full flex-col items-center justify-center bg-canvas px-6 py-12 md:w-1/2">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/login/page.tsx`**

```tsx
import { signIn } from "@/app/auth/actions";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthSplitLayout>
      <form action={signIn} className="w-full max-w-sm space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Kirish
          </h1>
          <p className="mt-1 text-sm text-muted">
            Akkauntingizga kiring va ishni davom ettiring.
          </p>
        </div>
        {error && (
          <p className="rounded-[0.625rem] border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <label className="block">
          <Label>Email</Label>
          <Input name="email" type="email" required placeholder="siz@email.com" />
        </label>
        <label className="block">
          <Label>Parol</Label>
          <Input name="password" type="password" required placeholder="••••••••" />
        </label>
        <Button type="submit" className="w-full">
          Kirish
        </Button>
        <p className="text-center text-sm text-muted">
          Akkauntingiz yo‘qmi?{" "}
          <Link className="font-medium text-accent hover:underline" href="/signup">
            Ro‘yxatdan o‘tish
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}
```

- [ ] **Step 3: Replace `src/app/signup/page.tsx`**

```tsx
import { signUp } from "@/app/auth/actions";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import Link from "next/link";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthSplitLayout>
      <form action={signUp} className="w-full max-w-sm space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Ro‘yxatdan o‘tish
          </h1>
          <p className="mt-1 text-sm text-muted">
            Bir necha soniyada boshlang — kredit karta shart emas.
          </p>
        </div>
        {error && (
          <p className="rounded-[0.625rem] border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <label className="block">
          <Label>Email</Label>
          <Input name="email" type="email" required placeholder="siz@email.com" />
        </label>
        <label className="block">
          <Label>Parol</Label>
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Kamida 8 belgi"
          />
        </label>
        <Button type="submit" className="w-full">
          Ro‘yxatdan o‘tish
        </Button>
        <p className="text-center text-sm text-muted">
          Akkauntingiz bormi?{" "}
          <Link className="font-medium text-accent hover:underline" href="/login">
            Kirish
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Manual check**

Run: `npm run dev` (background), then `curl -s http://localhost:3000/login | grep -o 'Kirish' | head -1` and `curl -s http://localhost:3000/signup | grep -o 'Ro.yxatdan' | head -1`
Expected: both curls print a match (page renders server-side without a 500). Stop the dev server after.

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/AuthSplitLayout.tsx src/app/login/page.tsx src/app/signup/page.tsx
git commit -m "feat: restyle login/signup with split-screen auth layout"
```

---

### Task 5: Landing page (`/`)

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `CaptionDemo` (Task 3), `Button` (Task 2), `createClient` from `@/lib/supabase/server` (existing).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CaptionDemo from "@/components/marketing/CaptionDemo";
import Button from "@/components/ui/Button";

const MODULES = [
  {
    title: "Brend bilimlar bazasi",
    body: "Kompaniyangiz haqida bir marta yozing — mahsulotlar, auditoriya, ohang. AI keyingi barcha generatsiyalarda shu ma'lumotni ishlatadi, qayta tushuntirishga hojat yo'q.",
  },
  {
    title: "Kontent reja",
    body: "Instagram va Telegram uchun oylik kontent rejasini bir necha daqiqada oling — maqsad va formatga mos, tayyor sarlavhalar bilan.",
  },
  {
    title: "Reels generatori",
    body: "Ssenariy, hook va ovoz ohangi — reels uchun tayyor g'oyalar, brendingiz uslubida.",
  },
  {
    title: "Kopiraiting",
    body: "Post, reklama matni yoki SMS — formatga mos, sotuvga yo'naltirilgan matnlarni soniyalarda yarating.",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-semibold text-ink">
          AI Marketing OS
        </span>
        <nav className="flex items-center gap-6">
          <Link
            href="/login"
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Kirish
          </Link>
          <Link href="/signup">
            <Button>Bepul boshlash</Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6">
        <section className="grid gap-12 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <h1 className="font-display text-[2.5rem] font-bold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[3.5rem]">
              Brendingiz haqida yozing. Tayyor kontentni AI yozadi.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              O'zbek marketing va SMM mutaxassislari uchun — brend
              ma'lumotidan Instagram va Telegram'ga tayyor post, reels
              ssenariysi va reklama matni.
            </p>
            <div className="mt-8">
              <Link href="/signup">
                <Button className="px-6 py-3 text-base">
                  Bepul boshlash
                </Button>
              </Link>
            </div>
          </div>
          <CaptionDemo />
        </section>

        <section className="grid gap-8 border-t border-line py-16 sm:grid-cols-2">
          {MODULES.map((m) => (
            <div key={m.title}>
              <h2 className="font-display text-xl font-semibold text-ink">
                {m.title}
              </h2>
              <p className="mt-2 leading-relaxed text-muted">{m.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-line py-8">
        <p className="mx-auto max-w-5xl px-6 text-sm text-muted">
          © {new Date().getFullYear()} AI Marketing OS
        </p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Manual check**

Run: `npm run dev` (background), then `curl -s http://localhost:3000/ | grep -o 'Bepul boshlash' | head -1`
Expected: a match (landing page renders for a logged-out request; no redirect loop, since there's no session cookie in a plain curl). Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: public landing page with live caption demo hero"
```

---

### Task 6: App shell — Sidebar and layout

**Files:**
- Create: `src/components/app/Sidebar.tsx`
- Modify: `src/app/app/layout.tsx`

**Interfaces:**
- Consumes: `Button` (Task 2), `lucide-react` icons (Task 1), existing `signOut` action from `@/app/auth/actions`, existing `getOrCreateWorkspace`/`getCreditBalance` from `@/lib/workspace`.
- Produces: `Sidebar` default export, props `{ credits: number }`.

- [ ] **Step 1: Create `src/components/app/Sidebar.tsx`**

At `md:` and up this is a vertical sidebar with labels. Below `md:` it collapses to a horizontal top bar with icon-only nav (labels hidden visually but kept for screen readers via `aria-label`), per spec §5's 360px requirement.

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Briefcase, PenLine, LogOut } from "lucide-react";
import Button from "@/components/ui/Button";
import { signOut } from "@/app/auth/actions";

const NAV = [
  { href: "/app", label: "Bosh sahifa", icon: Home, exact: true },
  { href: "/app/brands", label: "Brendlar", icon: Briefcase, exact: false },
  { href: "/app/copy", label: "Kopiraiting", icon: PenLine, exact: false },
];

export default function Sidebar({ credits }: { credits: number }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-full items-center justify-between gap-2 border-b border-line bg-surface p-3 md:w-60 md:flex-col md:items-stretch md:justify-start md:gap-1 md:border-b-0 md:border-r md:p-4">
      <Link
        href="/app"
        className="hidden px-2 font-display text-lg font-semibold text-ink md:mb-6 md:block"
      >
        AI Marketing OS
      </Link>
      <nav className="flex items-center gap-1 md:flex-col md:items-stretch md:gap-1">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`flex items-center gap-2.5 rounded-[0.625rem] px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-3 md:mt-auto md:flex-col md:items-stretch md:gap-3 md:pt-4">
        <div className="hidden rounded-[0.625rem] bg-canvas px-3 py-2.5 md:block">
          <p className="text-xs text-muted">Kreditlar</p>
          <p className="font-mono text-lg tabular-nums text-ink">{credits}</p>
        </div>
        <span className="font-mono text-sm tabular-nums text-muted md:hidden">
          {credits}
        </span>
        <form action={signOut}>
          <Button type="submit" variant="ghost" aria-label="Chiqish" className="gap-2 px-3">
            <LogOut size={18} strokeWidth={1.75} />
            <span className="hidden md:inline">Chiqish</span>
          </Button>
        </form>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Replace `src/app/app/layout.tsx`**

```tsx
import { getOrCreateWorkspace, getCreditBalance } from "@/lib/workspace";
import Sidebar from "@/components/app/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ws = await getOrCreateWorkspace();
  const credits = await getCreditBalance(ws.id);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar credits={credits} />
      <main className="flex-1 bg-canvas p-4 md:p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/app/Sidebar.tsx src/app/app/layout.tsx
git commit -m "feat: restyle app shell with icon sidebar and active nav state"
```

---

### Task 7: Dashboard home, brands list, edit brand page

**Files:**
- Modify: `src/app/app/page.tsx`
- Modify: `src/app/app/brands/page.tsx`
- Modify: `src/app/app/brands/[id]/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Card` (Task 2). No new exports produced.

- [ ] **Step 1: Replace `src/app/app/page.tsx`**

```tsx
import { getOrCreateWorkspace } from "@/lib/workspace";
import Link from "next/link";
import Button from "@/components/ui/Button";

export default async function HomePage() {
  const ws = await getOrCreateWorkspace();
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="font-display text-3xl font-semibold text-ink">
        {ws.name}
      </h1>
      <p className="leading-relaxed text-muted">
        Brend yarating va kontent generatsiya qiling. AI barcha natijalarni
        brendingiz ma&apos;lumotlari asosida tayyorlaydi.
      </p>
      <div className="flex gap-3">
        <Link href="/app/brands/new">
          <Button>Yangi brend qo‘shish</Button>
        </Link>
        <Link href="/app/copy">
          <Button variant="secondary">Kopiraiting generatsiya qilish</Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/app/brands/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { deleteBrand } from "./actions";
import type { Brand } from "@/lib/types";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default async function BrandsPage() {
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: false });
  const brands = (data ?? []) as Brand[];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Brendlar
        </h1>
        <Link href="/app/brands/new">
          <Button>Yangi brend</Button>
        </Link>
      </div>
      {brands.length === 0 && (
        <Card className="text-center">
          <p className="text-muted">
            Hali brendingiz yo‘q. Birinchi brendni qo‘shing — AI shu
            ma&apos;lumotlar asosida barcha kontentni tayyorlaydi.
          </p>
          <Link href="/app/brands/new" className="mt-4 inline-block">
            <Button>Birinchi brendni qo‘shish</Button>
          </Link>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {brands.map((b) => (
          <Card key={b.id}>
            <h2 className="font-semibold text-ink">{b.name}</h2>
            <p className="text-sm text-muted">{b.industry || "—"}</p>
            <div className="mt-3 flex gap-4 text-sm">
              <Link
                className="font-medium text-accent hover:underline"
                href={`/app/brands/${b.id}`}
              >
                Tahrirlash
              </Link>
              <form action={deleteBrand}>
                <input type="hidden" name="id" value={b.id} />
                <button className="font-medium text-danger hover:underline">
                  O‘chirish
                </button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/app/app/brands/[id]/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import BrandForm from "@/components/BrandForm";
import type { Brand } from "@/lib/types";
import { notFound } from "next/navigation";

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-ink">
        Brendni tahrirlash
      </h1>
      <BrandForm brand={data as Brand} />
    </div>
  );
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0 (Task 8 restyles `BrandForm` itself; this task only changes its caller pages, which still import the not-yet-restyled `BrandForm` — that's fine since its props/exports haven't changed).

- [ ] **Step 5: Commit**

```bash
git add src/app/app/page.tsx src/app/app/brands/page.tsx "src/app/app/brands/[id]/page.tsx"
git commit -m "feat: restyle dashboard home and brands list with Card/Button primitives"
```

---

### Task 8: Brand form and AI brand-fill client

**Files:**
- Modify: `src/components/BrandForm.tsx`
- Modify: `src/app/app/brands/new/NewBrandClient.tsx`

**Interfaces:**
- Consumes: `Input`, `Textarea`, `Label` (Task 2), `Button` (Task 2), `Card` (Task 2). `BrandForm`'s exported props shape (`{ brand?: Brand; initial?: Initial }`) is unchanged, so Task 7's callers keep working.

- [ ] **Step 1: Replace `src/components/BrandForm.tsx`**

```tsx
import { saveBrand } from "@/app/app/brands/actions";
import type { Brand } from "@/lib/types";
import { Input, Textarea, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type Initial = Partial<Omit<Brand, "id" | "workspace_id">>;

function Field({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <Input name={name} defaultValue={defaultValue ?? ""} required={required} />
    </label>
  );
}

function Area({
  label,
  name,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {hint && <span className="mb-1.5 block text-xs text-muted">{hint}</span>}
      <Textarea name={name} defaultValue={defaultValue ?? ""} rows={3} />
    </label>
  );
}

export default function BrandForm({
  brand,
  initial,
}: {
  brand?: Brand;
  initial?: Initial;
}) {
  const v = { ...initial, ...brand };
  const joined = (arr?: string[]) => (arr ?? []).join("\n");
  return (
    <form action={saveBrand} className="max-w-xl space-y-4">
      {brand && <input type="hidden" name="id" value={brand.id} />}
      <Field label="Brend nomi *" name="name" defaultValue={v.name} required />
      <Field label="Soha" name="industry" defaultValue={v.industry ?? ""} />
      <Area
        label="Mahsulotlar"
        name="products"
        hint="Har qatorda bittadan yozing"
        defaultValue={joined(v.products)}
      />
      <Area
        label="Xizmatlar"
        name="services"
        hint="Har qatorda bittadan yozing"
        defaultValue={joined(v.services)}
      />
      <Area label="USP (asosiy afzallik)" name="usp" defaultValue={v.usp ?? ""} />
      <Area
        label="Maqsadli auditoriya"
        name="target_audience"
        hint="Har qatorda bitta segment"
        defaultValue={joined(v.target_audience)}
      />
      <Area
        label="Raqobatchilar"
        name="competitors"
        hint="Har qatorda bittadan yozing"
        defaultValue={joined(v.competitors)}
      />
      <Field
        label="Ohang (Tone of Voice)"
        name="tone_of_voice"
        defaultValue={v.tone_of_voice ?? ""}
      />
      <Area
        label="Brend qadriyatlari"
        name="brand_values"
        defaultValue={v.brand_values ?? ""}
      />
      <Button type="submit">Saqlash</Button>
    </form>
  );
}
```

- [ ] **Step 2: Replace `src/app/app/brands/new/NewBrandClient.tsx`**

```tsx
"use client";
import { useState } from "react";
import BrandForm from "@/components/BrandForm";
import type { BrandFill } from "@/lib/ai/schemas";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";

export default function NewBrandClient() {
  const [description, setDescription] = useState("");
  const [fill, setFill] = useState<BrandFill | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFill() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brand-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const json = await res.json();
      if (json.ok) setFill(json.data);
      else setError(json.error ?? "Xatolik yuz berdi.");
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko‘ring.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="max-w-xl space-y-3">
        <h2 className="font-semibold text-ink">AI bilan to‘ldirish</h2>
        <p className="text-sm text-muted">
          Kompaniyangiz haqida erkin yozing — AI formani o‘zi to‘ldiradi.
        </p>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Masalan: Vetline — Toshkentdagi veterinariya klinikasi. Uy hayvonlari uchun 24/7 xizmat..."
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          onClick={handleFill}
          disabled={loading || description.trim().length < 30}
        >
          {loading ? "To‘ldirilmoqda…" : "AI bilan to‘ldirish"}
        </Button>
      </Card>
      <BrandForm
        key={fill ? JSON.stringify(fill) : "empty"}
        initial={fill ?? undefined}
      />
    </div>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/BrandForm.tsx src/app/app/brands/new/NewBrandClient.tsx
git commit -m "feat: restyle brand form and AI brand-fill client"
```

---

### Task 9: Copywriting generator form

**Files:**
- Modify: `src/app/app/copy/CopyForm.tsx`

**Interfaces:**
- Consumes: `Card`, `Button`, `Select`, `Textarea`, `Label` (Task 2). No exports produced for later tasks.

- [ ] **Step 1: Replace `src/app/app/copy/CopyForm.tsx`**

```tsx
"use client";
import { useState } from "react";
import {
  COPY_TYPE_LABELS,
  COPY_STYLE_LABELS,
  type CopyType,
  type CopyStyle,
} from "@/lib/ai/modules/copy";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Select, Textarea, Label } from "@/components/ui/Input";

type BrandOption = { id: string; name: string };
type Variant = { text: string };

export default function CopyForm({ brands }: { brands: BrandOption[] }) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [type, setType] = useState<CopyType>("instagram_caption");
  const [style, setStyle] = useState<CopyStyle>("friendly");
  const [topic, setTopic] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setVariants([]);
    try {
      const res = await fetch("/api/generate/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, type, style, topic }),
      });
      const json = await res.json();
      if (json.ok) {
        setVariants(json.data.variants);
        setCreditsLeft(json.creditsLeft);
      } else {
        setError(json.error ?? "Xatolik yuz berdi.");
      }
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko‘ring.");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string, i: number) {
    await navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="space-y-4">
        <label className="block">
          <Label>Brend</Label>
          <Select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <Label>Format</Label>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as CopyType)}
            >
              {Object.entries(COPY_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <Label>Uslub</Label>
            <Select
              value={style}
              onChange={(e) => setStyle(e.target.value as CopyStyle)}
            >
              {Object.entries(COPY_STYLE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <label className="block">
          <Label>Mavzu / oferta</Label>
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="Masalan: Yangi mijozlar uchun birinchi konsultatsiya bepul"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          onClick={handleGenerate}
          disabled={loading || !brandId || topic.trim().length < 3}
        >
          {loading ? "Generatsiya qilinmoqda…" : "Generatsiya qilish (1 kredit)"}
        </Button>
        {creditsLeft !== null && (
          <p className="text-sm text-muted">Qolgan kreditlar: {creditsLeft}</p>
        )}
      </Card>

      {variants.map((v, i) => (
        <Card key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">
              Variant {i + 1}
            </span>
            <button
              onClick={() => copyText(v.text, i)}
              className="text-sm font-medium text-accent hover:underline"
            >
              {copied === i ? "Nusxalandi ✓" : "Nusxalash"}
            </button>
          </div>
          <p className="whitespace-pre-wrap text-ink">{v.text}</p>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/copy/CopyForm.tsx
git commit -m "feat: restyle copywriting generator form"
```

---

### Task 10: Full build and manual verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the existing test suite**

Run: `npm test`
Expected: exits 0 (existing `src/lib/ai/engine.test.ts` etc. are unaffected by presentation-only changes).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: exits 0. This statically analyzes/compiles every route including the new landing page, catching any server/client component boundary mistakes.

- [ ] **Step 3: Manual click-through**

Run: `npm run dev` (background)
Then, in a browser (or via the `run` skill if available), visit and check:
- `/` — landing hero renders, caption types out once then stops, "Bepul boshlash" goes to `/signup`, "Kirish" goes to `/login`.
- `/signup` → create a test account → lands on `/app`.
- `/app` — sidebar shows 3 nav items with icons, active item highlighted, credit count visible.
- `/app/brands` → `/app/brands/new` — AI-fill card and form render with new inputs.
- `/app/copy` — generator form renders (uses the brand created above).
- `/login` — sign out from the sidebar, confirm redirect to `/login`, sign back in.
- Resize to a 360px-wide viewport: landing single-column, auth form-only (no decorative panel), sidebar still usable.
- Toggle OS dark mode (System Settings): canvas/surface/ink/accent all swap per the dark-mode tokens, text stays readable.

Expected: no visual regressions, no console errors, all flows above complete. Stop the dev server after.

- [ ] **Step 4: Fix anything found, then this plan is complete.**

No commit for this task — it's verification only. If Step 3 finds an issue, fix it in the relevant task's files and commit as a follow-up `fix:` commit.
