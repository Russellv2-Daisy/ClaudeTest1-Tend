# Documents (file uploads) — one-time Supabase setup

The **Documents & Policies → Files** tab lets you drag-and-drop PDFs, Word docs,
statements, images, etc. Files are stored privately in **Supabase Storage**, scoped
so each user can only ever see their own files. This needs a one-time setup.

## 1. Create the bucket

Supabase dashboard → **Storage** → **New bucket**:

- **Name:** `documents`
- **Public bucket:** **OFF** (keep it private — the app fetches files via short-lived
  signed URLs)

## 2. Add the access policies

Supabase dashboard → **SQL Editor** → **New query**, paste this and **Run**:

```sql
-- Create the bucket if it doesn't already exist (private)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Each signed-in user can only touch files inside their own "<user-id>/" folder.
-- The app uploads to:  <auth.uid()>/<fileId>_<filename>
create policy "Users read own documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users upload own documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update own documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
```

If you created the bucket in step 1 already, the first statement is a harmless no-op.

## 3. Done

Reload TendOS → **Documents & Policies → Files** and drop a file in. It should upload,
appear in the list, open via a signed URL, and be editable/deletable.

### Notes
- File metadata (name, "what is it?", notes) lives in your normal TendOS state blob;
  the binary lives in the `documents` bucket. Deleting a file removes both.
- Signed URLs expire after 1 hour — the app generates a fresh one each time you open a file.
- Storage limits depend on your Supabase plan (free tier includes 1 GB).
