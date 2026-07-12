-- Denormalizes auth.users.email onto profiles so the admin User Management
-- grid (which needs to sort/filter/search by email) can run a plain SQL
-- query against `profiles` instead of paging through Supabase's listUsers()
-- admin API on every request — the open question flagged in the plan doc,
-- resolved here.

alter table public.profiles add column if not exists email text;

-- Backfill existing rows.
update public.profiles p set email = u.email from auth.users u where p.id = u.id and p.email is null;

create index if not exists profiles_email_idx on public.profiles(email);

-- Extend the existing new-user trigger to also set email at signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_avatar text;
  v_food_id uuid;
begin
  v_name := coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    'https://api.dicebear.com/7.x/initials/svg?seed=' || v_name || '&backgroundColor=6366f1'
  );

  insert into public.profiles (id, name, avatar, email)
  values (new.id, v_name, v_avatar, new.email)
  on conflict (id) do nothing;

  insert into public.categories (id, user_id, name, icon, color, parent_id) values
    (gen_random_uuid(), new.id, 'Salary', 'Banknote', '#22c55e', null),
    (gen_random_uuid(), new.id, 'Freelance', 'Laptop', '#16a34a', null),
    (gen_random_uuid(), new.id, 'Transport', 'Car', '#3b82f6', null),
    (gen_random_uuid(), new.id, 'Shopping', 'ShoppingBag', '#ec4899', null),
    (gen_random_uuid(), new.id, 'Entertainment', 'Film', '#a855f7', null),
    (gen_random_uuid(), new.id, 'Bills & Utilities', 'Receipt', '#ef4444', null),
    (gen_random_uuid(), new.id, 'Health & Fitness', 'HeartPulse', '#14b8a6', null),
    (gen_random_uuid(), new.id, 'Rent', 'Home', '#eab308', null),
    (gen_random_uuid(), new.id, 'Travel', 'Plane', '#06b6d4', null),
    (gen_random_uuid(), new.id, 'Education', 'GraduationCap', '#6366f1', null),
    (gen_random_uuid(), new.id, 'Subscriptions', 'Repeat', '#f59e0b', null),
    (gen_random_uuid(), new.id, 'Insurance', 'ShieldCheck', '#64748b', null),
    (gen_random_uuid(), new.id, 'Transfer', 'ArrowLeftRight', '#64748b', null);

  insert into public.categories (id, user_id, name, icon, color, parent_id)
  values (gen_random_uuid(), new.id, 'Food & Dining', 'UtensilsCrossed', '#f97316', null)
  returning id into v_food_id;

  insert into public.categories (id, user_id, name, icon, color, parent_id) values
    (gen_random_uuid(), new.id, 'Coffee & Cafes', 'Coffee', '#f97316', v_food_id),
    (gen_random_uuid(), new.id, 'Groceries', 'ShoppingCart', '#f97316', v_food_id);

  return new;
end;
$$;

-- Keeps profiles.email in sync if a user ever changes their email via
-- Supabase Auth (self-service or admin-issued change).
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_update();
