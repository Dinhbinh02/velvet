-- 1. Ensure 'books' bucket exists and is public
insert into storage.buckets (id, name, public) 
values ('books', 'books', true)
on conflict (id) do update set public = true;

-- 2. Drop existing policy if any and create open full access policy for 'books' bucket
drop policy if exists "Books Bucket Access" on storage.objects;
create policy "Books Bucket Access" 
on storage.objects 
for all 
using (bucket_id = 'books') 
with check (bucket_id = 'books');
