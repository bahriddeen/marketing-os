"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { buildPlansQuery, type PlansParams } from "@/lib/plansTable";
import { PLAN_PLATFORMS } from "@/lib/ai/modules/contentPlan";
import { Input, Select } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type BrandOption = { id: string; name: string };

export default function PlansToolbar({
  brands,
  params,
}: {
  brands: BrandOption[];
  params: PlansParams;
}) {
  const router = useRouter();
  const [q, setQ] = useState(params.q);
  const [prevQ, setPrevQ] = useState(params.q);
  if (params.q !== prevQ) {
    setPrevQ(params.q);
    if (params.q === "") setQ("");
  }
  const [open, setOpen] = useState(!!(params.brand || params.platform));
  const [, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    []
  );

  function apply(overrides: Partial<PlansParams>) {
    startTransition(() => {
      router.replace(`/app/plan${buildPlansQuery(params, { ...overrides, page: 1 })}`);
    });
  }

  function onSearch(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q: value }), 300);
  }

  const activeCount = (params.brand ? 1 : 0) + (params.platform ? 1 : 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Plan nomi bo‘yicha qidirish…"
            className="pl-9"
            aria-label="Qidirish"
          />
        </div>
        <div className="relative">
          <Button
            variant="secondary"
            onClick={() => setOpen((o) => !o)}
            aria-label="Filtrlar"
            aria-expanded={open}
            className="px-3"
          >
            <SlidersHorizontal size={16} />
          </Button>
          {activeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-medium text-white">
              {activeCount}
            </span>
          )}
        </div>
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-2 rounded-[0.625rem] border border-line bg-surface p-3">
          <Select
            value={params.brand}
            onChange={(e) => apply({ brand: e.target.value })}
            className="w-auto!"
            aria-label="Brend"
          >
            <option value="">Barcha brendlar</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select
            value={params.platform}
            onChange={(e) =>
              apply({ platform: e.target.value as PlansParams["platform"] })
            }
            className="w-auto!"
            aria-label="Platforma"
          >
            <option value="">Barcha platformalar</option>
            {Object.entries(PLAN_PLATFORMS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
          {(activeCount > 0 || params.q) && (
            <Button
              variant="ghost"
              onClick={() => {
                if (debounce.current) clearTimeout(debounce.current);
                setQ("");
                router.replace("/app/plan");
              }}
            >
              Tozalash
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
