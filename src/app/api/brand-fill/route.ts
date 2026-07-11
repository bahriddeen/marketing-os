import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { runStructuredGeneration } from "@/lib/ai/engine";
import { BrandFillSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  const { description } = await req.json();
  if (!description || String(description).trim().length < 30) {
    return NextResponse.json(
      { ok: false, error: "Kamida 30 belgi kiriting." },
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

  const result = await runStructuredGeneration({
    workspaceId: ws.id,
    userId: user.id,
    brandId: null,
    module: "brand_fill",
    brandContext: "",
    moduleInstructions:
      "Foydalanuvchi kompaniyasi haqida erkin matn yuboradi. Undan brend kartochkasi maydonlarini o‘zbek (lotin) tilida to‘ldiring. Ma'lumot yetishmasa, sohaga mos oqilona taxmin qiling.",
    userInput: String(description),
    inputRecord: { description },
    schema: BrandFillSchema,
    maxTokens: 2048,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
