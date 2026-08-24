-- 1. Ensure 'fonts' bucket exists and is public
insert into storage.buckets (id, name, public) 
values ('fonts', 'fonts', true)
on conflict (id) do update set public = true;

-- 2. Drop existing policy if any and create open full access policy for 'fonts' bucket
drop policy if exists "Fonts Bucket Access" on storage.objects;
create policy "Fonts Bucket Access" 
on storage.objects 
for all 
using (bucket_id = 'fonts') 
with check (bucket_id = 'fonts');
