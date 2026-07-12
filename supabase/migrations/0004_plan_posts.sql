create table plan_posts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references content_plans(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  date date not null,
  topic text not null,
  format text not null check (format in ('post','carousel','reels','story')),
  hook text not null default '',
  cta text not null default '',
  goal text not null default '',
  status text not null default 'qoralama'
    check (status in ('qoralama','jarayonda','tayyor','elon_qilingan')),
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table plan_posts enable row level security;
create policy plan_posts_all on plan_posts for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));

create index plan_posts_workspace_date_idx on plan_posts (workspace_id, date desc);
create index plan_posts_plan_idx on plan_posts (plan_id, position);

-- Backfill from the phase-3 jsonb, preserving order
insert into plan_posts (plan_id, workspace_id, brand_id, date, topic, format, hook, cta, goal, position)
select cp.id, cp.workspace_id, cp.brand_id,
       (p.value->>'date')::date, p.value->>'topic', p.value->>'format',
       coalesce(p.value->>'hook',''), coalesce(p.value->>'cta',''), coalesce(p.value->>'goal',''),
       p.ordinality
from content_plans cp, jsonb_array_elements(cp.posts) with ordinality p;

alter table content_plans drop column posts;
