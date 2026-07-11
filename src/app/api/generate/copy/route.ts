import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { runStructuredGeneration } from "@/lib/ai/engine";
import { CopyVariantsSchema } from "@/lib/ai/schemas";
import { buildBrandContext } from "@/lib/ai/prompts";
import {
  COPY_TYPES,
  COPY_STYLES,
  copyInstructions,
  type CopyType,
  type CopyStyle,
} from "@/lib/ai/modules/copy";
import type { Brand } from "@/lib/types";

export async function POST(req: Request) {
  const { brandId, type, style, topic } = await req.json();

  if (!(type in COPY_TYPES) || !(style in COPY_STYLES)) {
    return NextResponse.json(
      { ok: false, error: "Noto‘g‘ri format yoki uslub." },
      { status: 400 }
    );
  }
  if (!topic || String(topic).trim().length < 3) {
    return NextResponse.json(
      { ok: false, error: "Mavzu yoki ofertani kiriting." },
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
    module: "copy",
    brandContext: buildBrandContext(brand as Brand),
    moduleInstructions: copyInstructions(type as CopyType, style as CopyStyle),
    userInput: "Mavzu/oferta: " + String(topic),
    inputRecord: { brandId, type, style, topic },
    schema: CopyVariantsSchema,
    maxTokens: 2048,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
