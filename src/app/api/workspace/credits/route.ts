import { NextResponse } from "next/server";
import { getOrCreateWorkspace, getCreditBalance } from "@/lib/workspace";

export async function GET() {
  const ws = await getOrCreateWorkspace();
  const creditsLeft = await getCreditBalance(ws.id);
  return NextResponse.json({ creditsLeft });
}
