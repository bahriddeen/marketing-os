import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { runStructuredGeneration } from "@/lib/ai/engine";
import { ContentPlanSchema } from "@/lib/ai/schemas";
import { buildBrandContext } from "@/lib/ai/prompts";
import {
  PLAN_PLATFORMS,
  PLAN_GOALS,
  contentPlanInstructions,
  type PlanPlatform,
  type PlanGoal,
} from "@/lib/ai/modules/contentPlan";
import type { Brand } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { brandId, platform, goal, postCount, periodStart } = await req.json();

  if (!(platform in PLAN_PLATFORMS) || !(goal in PLAN_GOALS)) {
    return NextResponse.json(
      { ok: false, error: "Noto‘g‘ri platforma yoki maqsad." },
      { status: 400 }
    );
  }
  const count = Number(postCount);
  if (!Number.isInteger(count) || count < 1 || count > 30) {
    return NextResponse.json(
      { ok: false, error: "Postlar soni 1–30 oralig‘ida bo‘lsin." },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(periodStart))) {
    return NextResponse.json(
      { ok: false, error: "Davr sanasi noto‘g‘ri." },
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
    module: "content_plan",
    brandContext: buildBrandContext(brand as Brand),
    moduleInstructions: contentPlanInstructions(
      platform as PlanPlatform,
      goal as PlanGoal,
      count,
      String(periodStart)
    ),
    userInput: "Yuqoridagi parametrlar asosida kontent-plan tuzing.",
    inputRecord: { brandId, platform, goal, postCount: count, periodStart },
    schema: ContentPlanSchema,
    maxTokens: 12000,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  const { data: plan, error } = await supabase
    .from("content_plans")
    .insert({
      workspace_id: ws.id,
      brand_id: brand.id,
      user_id: user.id,
      title: result.data.title,
      platform,
      goal,
      period_start: String(periodStart),
      post_count: result.data.posts.length,
      generation_id: result.generationId,
    })
    .select("id")
    .single();

  if (error || !plan) {
    console.error("content plan insert failed", error);
    return NextResponse.json(
      { ok: false, error: "Planni saqlab bo‘lmadi. Qayta urinib ko‘ring." },
      { status: 500 }
    );
  }

  const rows = result.data.posts.map((p, i) => ({
    plan_id: plan.id,
    workspace_id: ws.id,
    brand_id: brand.id,
    date: p.date,
    topic: p.topic,
    format: p.format,
    hook: p.hook,
    cta: p.cta,
    goal: p.goal,
    position: i + 1,
  }));
  const { error: postsError } = await supabase.from("plan_posts").insert(rows);
  if (postsError) {
    console.error("plan posts insert failed", postsError);
    await supabase.from("content_plans").delete().eq("id", plan.id);
    return NextResponse.json(
      { ok: false, error: "Planni saqlab bo‘lmadi. Qayta urinib ko‘ring." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, planId: plan.id, creditsLeft: result.creditsLeft });
}
