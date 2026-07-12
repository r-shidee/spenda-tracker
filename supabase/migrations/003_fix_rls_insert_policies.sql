-- Fix: Allow authenticated users to create their first space and add themselves as owner

-- Spaces: allow authenticated users to create a space
create policy "Spaces: authenticated can create" on spaces for insert
  with check (auth.uid() is not null);

-- Space members: allow authenticated users to insert themselves as owner of a new space
create policy "Space members: self-insert as owner" on space_members for insert
  with check (user_id = auth.uid() and role = 'owner');
