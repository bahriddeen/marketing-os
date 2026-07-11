-- Fix for the workspace-bootstrap race: layout and page rendering in
-- parallel could each create a workspace for the same new user.

-- 1. Clean up duplicates created before the fix (keeps each user's
--    earliest workspace; only smoke-test data existed at this point).
with ranked as (
  select wm.workspace_id, wm.user_id,
         row_number() over (partition by wm.user_id order by w.created_at, w.id) as rn
  from workspace_members wm
  join workspaces w on w.id = wm.workspace_id
)
delete from workspace_members
where (workspace_id, user_id) in (
  select workspace_id, user_id from ranked where rn > 1
);

delete from workspaces w
where not exists (
  select 1 from workspace_members m where m.workspace_id = w.id
);

-- 2. Enforce one workspace per user at the DB level (MVP invariant;
--    drop this index when team invites / multi-workspace arrive).
create unique index workspace_members_one_per_user on workspace_members (user_id);

-- 3. Owner may delete their own workspace (needed by the race-recovery
--    path in getOrCreateWorkspace).
create policy ws_delete on workspaces for delete using (owner_id = auth.uid());
