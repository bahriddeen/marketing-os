create table content_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  title text not null,
  platform text not null check (platform in ('instagram','telegram','both')),
  goal text not null check (goal in ('awareness','engagement','sales')),
  period_start date not null,
  post_count int not null check (post_count between 1 and 30),
  posts jsonb not null,
  generation_id uuid references generations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table content_plans enable row level security;
create policy content_plans_all on content_plans for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));

create index content_plans_workspace_idx on content_plans (workspace_id, created_at desc);
