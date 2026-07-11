import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/types";
import { redirect } from "next/navigation";

export async function getOrCreateWorkspace(): Promise<Workspace> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", membership.workspace_id)
      .single();
    return ws as Workspace;
  }

  const { data: ws, error } = await supabase
    .from("workspaces")
    .insert({ name: "Mening jamoam", owner_id: user.id, plan: "trial" })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from("workspace_members")
    .insert({ workspace_id: ws.id, user_id: user.id, role: "owner" });
  await supabase
    .from("credit_ledger")
    .insert({ workspace_id: ws.id, delta: 30, reason: "plan_grant" });

  return ws as Workspace;
}

export async function getCreditBalance(workspaceId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_ledger")
    .select("delta")
    .eq("workspace_id", workspaceId);
  return (data ?? []).reduce((sum, r) => sum + r.delta, 0);
}
