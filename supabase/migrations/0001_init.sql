create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id),
  plan text not null default 'trial' check (plan in ('trial','starter','professional','agency')),
  plan_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null default 'owner' check (role in ('owner','member')),
  primary key (workspace_id, user_id)
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  industry text,
  products jsonb not null default '[]',
  services jsonb not null default '[]',
  usp text,
  target_audience jsonb not null default '[]',
  competitors jsonb not null default '[]',
  tone_of_voice text,
  brand_values text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  user_id uuid not null references auth.users(id),
  module text not null check (module in ('content_plan','reels','copy','chat','brand_fill')),
  input jsonb not null default '{}',
  output jsonb,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  credits_spent int not null default 0,
  created_at timestamptz not null default now()
);

create table chat_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  title text,
  created_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('generation','plan_grant','admin_adjust')),
  generation_id uuid references generations(id),
  created_at timestamptz not null default now()
);

-- Membership helper (security definer avoids RLS recursion)
create or replace function public.is_member(w uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = w and user_id = auth.uid()
  );
$$;

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table brands enable row level security;
alter table generations enable row level security;
alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;
alter table credit_ledger enable row level security;

create policy ws_select on workspaces for select using (owner_id = auth.uid() or is_member(id));
create policy ws_insert on workspaces for insert with check (owner_id = auth.uid());
create policy ws_update on workspaces for update using (owner_id = auth.uid());

create policy wm_select on workspace_members for select using (user_id = auth.uid() or is_member(workspace_id));
create policy wm_insert on workspace_members for insert with check (
  user_id = auth.uid()
  and exists (select 1 from workspaces where id = workspace_id and owner_id = auth.uid())
);

create policy brands_all on brands for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy gen_all on generations for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy conv_all on chat_conversations for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy msg_all on chat_messages for all
  using (exists (select 1 from chat_conversations c where c.id = conversation_id and is_member(c.workspace_id)))
  with check (exists (select 1 from chat_conversations c where c.id = conversation_id and is_member(c.workspace_id)));
create policy ledger_select on credit_ledger for select using (is_member(workspace_id));
create policy ledger_insert on credit_ledger for insert with check (is_member(workspace_id));
