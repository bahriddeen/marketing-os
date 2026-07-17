-- Billing & activation workflow: redemption codes, admin identity, and the
-- atomic security-definer functions that apply their effects. See
-- docs/superpowers/specs/2026-07-14-billing-activation-design.md.

alter table workspaces add column owner_email text;

update workspaces w
set owner_email = u.email
from workspace_members wm
join auth.users u on u.id = wm.user_id
where wm.workspace_id = w.id and wm.role = 'owner' and w.owner_email is null;

alter table credit_ledger add column note text;

alter table credit_ledger drop constraint credit_ledger_reason_check;
alter table credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('generation','plan_grant','admin_adjust','code_redeem'));

create table redemption_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('subscription','topup')),
  plan text check (plan in ('starter','professional','agency')),
  credits int not null check (credits > 0),
  status text not null default 'active' check (status in ('active','redeemed','void')),
  redeemed_by_workspace_id uuid references workspaces(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table redemption_codes enable row level security;

-- Single source of truth for "who is admin". Both RLS below and the
-- Next.js /app/admin layout guard call this via supabase.rpc('is_admin')
-- rather than keeping a second allowlist in an env var.
create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select auth.jwt() ->> 'email' = any(array['bahriddin.me@gmail.com'])
$$;

create policy redemption_codes_admin on redemption_codes for all
  using (is_admin()) with check (is_admin());

-- Existing ws_select policy only covers owner_id/is_member; this adds
-- admin visibility for the workspace directory in /app/admin.
create policy ws_admin_select on workspaces for select using (is_admin());

-- Callable by any member of p_workspace_id (not admin-only). Row-locks the
-- code so two concurrent redemptions of the same code can't both succeed.
create or replace function public.redeem_code(p_code text, p_workspace_id uuid)
returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  v_code redemption_codes%rowtype;
begin
  if not is_member(p_workspace_id) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_code from redemption_codes where code = p_code for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_code.status = 'redeemed' then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed');
  end if;
  if v_code.status = 'void' then
    return jsonb_build_object('ok', false, 'error', 'void');
  end if;

  if v_code.type = 'subscription' then
    update workspaces
    set plan = v_code.plan, plan_expires_at = now() + interval '30 days'
    where id = p_workspace_id;
  end if;

  insert into credit_ledger (workspace_id, delta, reason)
  values (p_workspace_id, v_code.credits, 'code_redeem');

  update redemption_codes
  set status = 'redeemed', redeemed_by_workspace_id = p_workspace_id, redeemed_at = now()
  where id = v_code.id;

  return jsonb_build_object(
    'ok', true, 'type', v_code.type, 'plan', v_code.plan, 'credits', v_code.credits
  );
end;
$$;

-- Admin-only. p_credits is passed in by the caller (looked up from the TS
-- PLAN_CREDITS map for subscription codes) rather than re-derived here, so
-- the plan->credits mapping has exactly one source of truth (src/lib/billing.ts).
create or replace function public.admin_generate_code(p_type text, p_plan text, p_credits int)
returns redemption_codes language plpgsql security definer
set search_path = public as $$
declare
  v_row redemption_codes%rowtype;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  if p_type not in ('subscription','topup') then
    raise exception 'invalid type';
  end if;
  if p_type = 'subscription' and p_plan is null then
    raise exception 'plan required for subscription codes';
  end if;
  if p_type = 'topup' and p_plan is not null then
    raise exception 'topup codes must not have a plan';
  end if;
  if p_credits is null or p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;

  insert into redemption_codes (code, type, plan, credits)
  values (
    upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
    p_type, p_plan, p_credits
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_void_code(p_code_id uuid)
returns boolean language plpgsql security definer
set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  update redemption_codes set status = 'void' where id = p_code_id and status = 'active';
  return found;
end;
$$;

create or replace function public.admin_add_credit(p_workspace_id uuid, p_amount int, p_note text)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  if p_amount = 0 then
    raise exception 'amount must be non-zero';
  end if;
  insert into credit_ledger (workspace_id, delta, reason, note)
  values (p_workspace_id, p_amount, 'admin_adjust', p_note);
end;
$$;
