import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CREDIT_WEIGHTS, type ModuleId } from "./credits";
import { SYSTEM_BASE } from "./prompts";

const MODEL = "claude-opus-4-8";
const client = new Anthropic();

export type GenerationResult<T> =
  | { ok: true; data: T; creditsLeft: number }
  | { ok: false; error: string };

export async function runStructuredGeneration<T>(opts: {
  workspaceId: string;
  userId: string;
  brandId: string | null;
  module: ModuleId;
  brandContext: string;
  moduleInstructions: string;
  userInput: string;
  inputRecord: Record<string, unknown>;
  schema: ZodType<T>;
  maxTokens?: number;
}): Promise<GenerationResult<T>> {
  const supabase = await createClient();
  const weight = CREDIT_WEIGHTS[opts.module];

  const { data: ledger } = await supabase
    .from("credit_ledger")
    .select("delta")
    .eq("workspace_id", opts.workspaceId);
  const balance = (ledger ?? []).reduce((s, r) => s + r.delta, 0);
  if (balance < weight) {
    return { ok: false, error: "Kreditlar yetarli emas. Tarifni yangilang." };
  }

  let response;
  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 4096,
      thinking: { type: "adaptive" },
      system: [
        { type: "text", text: SYSTEM_BASE, cache_control: { type: "ephemeral" } },
        {
          type: "text",
          text: opts.brandContext + "\n\n" + opts.moduleInstructions,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: opts.userInput }],
      output_config: { format: zodOutputFormat(opts.schema) },
    });
  } catch (e) {
    console.error("generation failed", e);
    return { ok: false, error: "Generatsiya xatosi. Qayta urinib ko‘ring." };
  }

  const data = response.parsed_output;
  if (!data) {
    return { ok: false, error: "Natijani o‘qib bo‘lmadi. Qayta urinib ko‘ring." };
  }

  const { data: gen } = await supabase
    .from("generations")
    .insert({
      workspace_id: opts.workspaceId,
      brand_id: opts.brandId,
      user_id: opts.userId,
      module: opts.module,
      input: opts.inputRecord,
      output: data as object,
      model: MODEL,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
      credits_spent: weight,
    })
    .select("id")
    .single();

  if (weight > 0) {
    await supabase.from("credit_ledger").insert({
      workspace_id: opts.workspaceId,
      delta: -weight,
      reason: "generation",
      generation_id: gen?.id ?? null,
    });
  }

  return { ok: true, data, creditsLeft: balance - weight };
}
