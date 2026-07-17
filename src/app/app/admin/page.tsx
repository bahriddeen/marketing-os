import { createClient } from "@/lib/supabase/server";
import GenerateCodeForm from "./GenerateCodeForm";
import CodesList, { type CodeRow } from "./CodesList";
import WorkspaceDirectory, { type WorkspaceRow } from "./WorkspaceDirectory";

export default async function AdminPage() {
  const supabase = await createClient();
  const [{ data: codes }, { data: workspaces }, { data: ledger }] = await Promise.all([
    supabase
      .from("redemption_codes")
      .select("id, code, type, plan, credits, status, created_at, workspaces(owner_email)")
      .order("created_at", { ascending: false }),
    supabase
      .from("workspaces")
      .select("id, owner_email, plan")
      .order("created_at", { ascending: false }),
    supabase.from("credit_ledger").select("workspace_id, delta"),
  ]);

  const balances = new Map<string, number>();
  for (const row of ledger ?? []) {
    balances.set(row.workspace_id, (balances.get(row.workspace_id) ?? 0) + row.delta);
  }

  const workspaceRows: WorkspaceRow[] = (workspaces ?? []).map((w) => ({
    id: w.id,
    owner_email: w.owner_email,
    plan: w.plan,
    balance: balances.get(w.id) ?? 0,
  }));

  // redeemed_by_workspace_id is a many-to-one FK (many codes -> one workspace),
  // so PostgREST embeds it as a single nested object (or null), not an array.
  const codeRows: CodeRow[] = (codes ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type,
    plan: c.plan,
    credits: c.credits,
    status: c.status,
    created_at: c.created_at,
    redeemed_by_email:
      (c.workspaces as unknown as { owner_email: string | null } | null)?.owner_email ?? null,
  }));

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Admin</h1>
      <GenerateCodeForm />
      <CodesList codes={codeRows} />
      <WorkspaceDirectory workspaces={workspaceRows} />
    </div>
  );
}
