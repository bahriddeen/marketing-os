import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/types";
import { redirect } from "next/navigation";

// cache() memoizes per request: layout and page rendering in parallel share
// one bootstrap call instead of racing to create duplicate workspaces.
export const getOrCreateWorkspace = cache(async (): Promise<Workspace> => {
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

  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: ws.id, user_id: user.id, role: "owner" });

  if (memberError) {
    // Lost a concurrent bootstrap race (unique index on user_id):
    // discard our workspace and use the winner's.
    await supabase.from("workspaces").delete().eq("id", ws.id);
    const { data: existing } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing) throw memberError;
    const { data: winner } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", existing.workspace_id)
      .single();
    return winner as Workspace;
  }

  await supabase
    .from("credit_ledger")
    .insert({ workspace_id: ws.id, delta: 30, reason: "plan_grant" });

  return ws as Workspace;
});

export async function getCreditBalance(workspaceId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_ledger")
    .select("delta")
    .eq("workspace_id", workspaceId);
  return (data ?? []).reduce((sum, r) => sum + r.delta, 0);
}
