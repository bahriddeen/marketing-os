import type { Brand } from "@/lib/types";

const list = (items: string[]) =>
  items.length ? items.map((i) => `- ${i}`).join("\n") : "- (kiritilmagan)";

export function buildBrandContext(brand: Brand): string {
  return `# Brend ma'lumotlari

Kompaniya: ${brand.name}
Soha: ${brand.industry || "(kiritilmagan)"}

Mahsulotlar:
${list(brand.products)}

Xizmatlar:
${list(brand.services)}

USP (asosiy afzallik): ${brand.usp || "(kiritilmagan)"}

Maqsadli auditoriya:
${list(brand.target_audience)}

Raqobatchilar:
${list(brand.competitors)}

Ohang (tone of voice): ${brand.tone_of_voice || "(kiritilmagan)"}
Brend qadriyatlari: ${brand.brand_values || "(kiritilmagan)"}`;
}

export const SYSTEM_BASE = `Siz O‘zbekiston bozori uchun ishlaydigan professional marketing va SMM mutaxassisisiz.
Barcha javoblar tabiiy, ona tilidek o‘zbek (lotin) tilida bo‘lsin — tarjima qilingan matnga o‘xshamasin.
O‘zbek SMM'da real ishlatiladigan marketing uslubidan foydalaning.
Har doim berilgan brend ma'lumotlariga (ohang, auditoriya, USP) tayangan holda yozing.`;
