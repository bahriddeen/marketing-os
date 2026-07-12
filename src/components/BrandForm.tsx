import type { ReactNode } from "react";
import { saveBrand } from "@/app/app/brands/actions";
import type { Brand } from "@/lib/types";
import { Input, Textarea, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type Initial = Partial<Omit<Brand, "id" | "workspace_id">>;

function Field({
  label,
  name,
  defaultValue,
  required,
  className,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
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
  className,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <Label>{label}</Label>
      {hint && <span className="mb-1.5 block text-xs text-muted">{hint}</span>}
      <Textarea name={name} defaultValue={defaultValue ?? ""} rows={3} />
    </label>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="space-y-4">
      <h3 className="border-b border-line pb-2 text-sm font-semibold text-ink">
        {title}
      </h3>
      <div className={`grid gap-4 md:grid-cols-2 ${className ?? ""}`}>
        {children}
      </div>
    </div>
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
    <Card className="max-w-4xl">
      <form action={saveBrand} className="space-y-8">
        {brand && <input type="hidden" name="id" value={brand.id} />}

        <Section title="Asosiy ma‘lumotlar" className="md:grid-cols-3">
          <Field label="Brend nomi *" name="name" defaultValue={v.name} required />
          <Field label="Soha" name="industry" defaultValue={v.industry ?? ""} />
          <Field
            label="Ohang"
            name="tone_of_voice"
            defaultValue={v.tone_of_voice ?? ""}
          />
        </Section>

        <Section title="Takliflar">
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
            label="Asosiy afzallik"
            name="usp"
            defaultValue={v.usp ?? ""}
            className="md:col-span-2"
          />
        </Section>

        <Section title="Auditoriya va raqobat">
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
        </Section>

        <Section title="Brend ohangi">
          <Area
            label="Brend qadriyatlari"
            name="brand_values"
            defaultValue={v.brand_values ?? ""}
            className="md:col-span-2"
          />
        </Section>

        <div className="flex justify-end border-t border-line pt-6">
          <Button type="submit">Saqlash</Button>
        </div>
      </form>
    </Card>
  );
}
