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
      <Area label="Asosiy afzallik" name="usp" defaultValue={v.usp ?? ""} />
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
        label="Ohang"
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
