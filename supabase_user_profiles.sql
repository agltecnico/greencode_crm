create schema if not exists private;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  role text not null default 'user' check (role in ('superadmin', 'admin', 'user')),
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create or replace function private.is_superadmin()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.user_profiles
    where id = (select auth.uid()) and role = 'superadmin' and active
  );
$$;

revoke all on function private.is_superadmin() from public;
grant execute on function private.is_superadmin() to authenticated;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.user_profiles(id, email, display_name, role, permissions, active)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case when lower(new.email) = 'administracion@mygreencode.es' then 'superadmin' else 'user' end,
    case when lower(new.email) = 'administracion@mygreencode.es'
      then '{"administration":true,"stock":true,"tasks":true,"crops":true,"harvest":true,"planner":true,"traceability":true,"tv":true,"delivery":true,"users":true}'::jsonb
      else '{}'::jsonb
    end,
    true
  ) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create or replace trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create policy user_profiles_select_own_or_superadmin
on public.user_profiles for select to authenticated
using ((select auth.uid()) = id or (select private.is_superadmin()));

create policy user_profiles_update_superadmin
on public.user_profiles for update to authenticated
using ((select private.is_superadmin()))
with check ((select private.is_superadmin()));

grant select, update on public.user_profiles to authenticated;
