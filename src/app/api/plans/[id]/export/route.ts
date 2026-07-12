import { createClient } from "@/lib/supabase/server";
import { planToCsv, planToXlsx } from "@/lib/planExport";
import { planFilename } from "@/lib/plans";
import type { PlanPost } from "@/lib/ai/schemas";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("content_plans")
    .select("title, posts")
    .eq("id", id)
    .maybeSingle();
  if (!plan) {
    return new Response("Topilmadi", { status: 404 });
  }

  const posts = plan.posts as PlanPost[];

  if (format === "csv") {
    return new Response(planToCsv(posts), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${planFilename(plan.title, "csv")}"`,
      },
    });
  }

  const buf = await planToXlsx(plan.title, posts);
  return new Response(buf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${planFilename(plan.title, "xlsx")}"`,
    },
  });
}
