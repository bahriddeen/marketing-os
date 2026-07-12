import ExcelJS from "exceljs";
import type { PlanPost } from "@/lib/ai/schemas";
import { PLAN_FORMAT_LABELS } from "@/lib/ai/modules/contentPlan";

export const PLAN_EXPORT_HEADERS = ["Sana", "Mavzu", "Format", "Hook", "CTA", "Maqsad"];

export function planRows(posts: PlanPost[]): string[][] {
  return posts.map((p) => [
    p.date,
    p.topic,
    PLAN_FORMAT_LABELS[p.format],
    p.hook,
    p.cta,
    p.goal,
  ]);
}

const csvCell = (v: string) =>
  /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

export function planToCsv(posts: PlanPost[]): string {
  const lines = [PLAN_EXPORT_HEADERS, ...planRows(posts)].map((row) =>
    row.map(csvCell).join(",")
  );
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export async function planToXlsx(
  title: string,
  posts: PlanPost[]
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.replace(/[\\/?*[\]]/g, " ").slice(0, 31) || "Kontent-plan");
  ws.columns = [
    { header: "Sana", width: 12 },
    { header: "Mavzu", width: 44 },
    { header: "Format", width: 12 },
    { header: "Hook", width: 44 },
    { header: "CTA", width: 32 },
    { header: "Maqsad", width: 32 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const row of planRows(posts)) ws.addRow(row);
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}
