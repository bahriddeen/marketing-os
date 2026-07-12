"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { buildTableQuery, type TableParams } from "@/lib/planTable";
import { PLAN_STATUS_LABELS } from "@/lib/plans";
import { PLAN_FORMAT_LABELS, PLAN_PLATFORMS } from "@/lib/ai/modules/contentPlan";
import { Input, Select } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type BrandOption = { id: string; name: string };

export default function PostsToolbar({
  brands,
  params,
}: {
  brands: BrandOption[];
  params: TableParams;
}) {
  const router = useRouter();
  const [q, setQ] = useState(params.q);
  const [, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    []
  );

  function apply(overrides: Partial<TableParams>) {
    startTransition(() => {
      router.replace(`/app/plan${buildTableQuery(params, { ...overrides, page: 1 })}`);
    });
  }

  function onSearch(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q: value }), 300);
  }

  const hasFilters =
    !!params.q || !!params.brand || !!params.status || !!params.format || !!params.platform;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <Input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Mavzu yoki hook bo‘yicha qidirish…"
          className="pl-9"
          aria-label="Qidirish"
        />
      </div>
      <Select
        value={params.brand}
        onChange={(e) => apply({ brand: e.target.value })}
        className="w-auto"
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
        value={params.status}
        onChange={(e) => apply({ status: e.target.value as TableParams["status"] })}
        className="w-auto"
        aria-label="Holat"
      >
        <option value="">Barcha holatlar</option>
        {Object.entries(PLAN_STATUS_LABELS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        value={params.format}
        onChange={(e) => apply({ format: e.target.value as TableParams["format"] })}
        className="w-auto"
        aria-label="Format"
      >
        <option value="">Barcha formatlar</option>
        {Object.entries(PLAN_FORMAT_LABELS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        value={params.platform}
        onChange={(e) => apply({ platform: e.target.value as TableParams["platform"] })}
        className="w-auto"
        aria-label="Platforma"
      >
        <option value="">Barcha platformalar</option>
        {Object.entries(PLAN_PLATFORMS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </Select>
      {hasFilters && (
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
  );
}
