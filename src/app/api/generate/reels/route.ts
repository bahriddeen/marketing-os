import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { runStructuredGeneration } from "@/lib/ai/engine";
import { ReelsSchema } from "@/lib/ai/schemas";
import { buildBrandContext } from "@/lib/ai/prompts";
import { reelsInstructions } from "@/lib/ai/modules/reels";
import { PLAN_GOALS, type PlanGoal } from "@/lib/ai/modules/contentPlan";
import type { Brand } from "@/lib/types";

export async function POST(req: Request) {
  const { brandId, topic, product, goal } = await req.json();

  if (!(goal in PLAN_GOALS)) {
    return NextResponse.json({ ok: false, error: "Noto‘g‘ri maqsad." }, { status: 400 });
  }
  if (!topic || String(topic).trim().length < 3) {
    return NextResponse.json({ ok: false, error: "Mavzuni kiriting." }, { status: 400 });
  }
  if (!product || String(product).trim().length < 3) {
    return NextResponse.json(
      { ok: false, error: "Mahsulot yoki xizmatni kiriting." },
      { status: 400 }
    );
  }

  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Avval tizimga kiring." }, { status: 401 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", String(brandId))
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ ok: false, error: "Brend topilmadi." }, { status: 404 });
  }

  const result = await runStructuredGeneration({
    workspaceId: ws.id,
    userId: user.id,
    brandId: brand.id,
    module: "reels",
    brandContext: buildBrandContext(brand as Brand),
    moduleInstructions: reelsInstructions(String(topic), String(product), goal as PlanGoal),
    userInput: "Mavzu: " + String(topic) + " | Mahsulot/xizmat: " + String(product),
    inputRecord: { brandId, topic, product, goal },
    schema: ReelsSchema,
    maxTokens: 4096,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
