-- Fix: the admin workspace directory (/app/admin) aggregates credit_ledger
-- balances across all workspaces, but credit_ledger's only select policy
-- (ledger_select, from 0001_init.sql) is `using (is_member(workspace_id))`.
-- Unlike workspaces (which got ws_admin_select in 0005), credit_ledger never
-- got an admin-visibility policy, so every workspace except the admin's own
-- silently aggregated to a balance of 0. This adds the missing policy,
-- mirroring ws_admin_select.

create policy ledger_admin_select on credit_ledger for select using (is_admin());
