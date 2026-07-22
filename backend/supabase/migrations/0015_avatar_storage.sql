-- Public Storage bucket for profile photos, uploaded directly from the
-- client (web or mobile) via the Supabase JS SDK using the user's own
-- session — no custom upload endpoint needed. Objects are stored under
-- `<user id>/<filename>`, and the RLS policies below only ever let a user
-- write/replace/delete their own folder, mirroring how every other table in
-- this schema scopes rows by user_id. Reads are public so the resulting URL
-- can be stored on profiles.avatar and rendered with a plain <img>/<Image>,
-- same as every other avatar URL already flowing through this app.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
