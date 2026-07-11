export const COPY_TYPES = {
  instagram_caption:
    "Instagram post uchun caption (emoji va hashtag bilan, 100–200 so‘z)",
  telegram_post: "Telegram kanal posti (aniq struktura, CTA bilan)",
  ad_copy: "Reklama matni (target reklama uchun qisqa va kuchli)",
  landing: "Landing sahifa bo‘limi (sarlavha + matn + CTA)",
  sms: "SMS xabar (maksimum 160 belgi)",
  push: "Push-bildirishnoma (sarlavha maksimum 40 belgi, matn maksimum 120 belgi)",
} as const;
export type CopyType = keyof typeof COPY_TYPES;

export const COPY_STYLES = {
  formal: "rasmiy",
  sales: "sotuvga yo‘naltirilgan",
  premium: "premium",
  friendly: "do‘stona",
} as const;
export type CopyStyle = keyof typeof COPY_STYLES;

export const COPY_TYPE_LABELS: Record<CopyType, string> = {
  instagram_caption: "Instagram caption",
  telegram_post: "Telegram post",
  ad_copy: "Reklama matni",
  landing: "Landing sahifa",
  sms: "SMS",
  push: "Push-bildirishnoma",
};

export const COPY_STYLE_LABELS: Record<CopyStyle, string> = {
  formal: "Rasmiy",
  sales: "Sotuvga yo‘naltirilgan",
  premium: "Premium",
  friendly: "Do‘stona",
};

export function copyInstructions(type: CopyType, style: CopyStyle): string {
  return `# Vazifa: Kopiraiting
Format: ${COPY_TYPES[type]}
Uslub: ${COPY_STYLES[style]}
3 ta turli variant yozing. Har biri brend ohangiga mos, o‘zbek (lotin) tilida.`;
}
