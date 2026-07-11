import { saveBrand } from "@/app/app/brands/actions";
import type { Brand } from "@/lib/types";

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
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="w-full rounded border p-2"
      />
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
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {hint && <span className="mb-1 block text-xs text-gray-500">{hint}</span>}
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={3}
        className="w-full rounded border p-2"
      />
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
      <Area
        label="USP (asosiy afzallik)"
        name="usp"
        defaultValue={v.usp ?? ""}
      />
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
      <button className="rounded bg-black px-4 py-2 text-white">
        Saqlash
      </button>
    </form>
  );
}
