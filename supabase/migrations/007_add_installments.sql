-- 007: Add installments table for tracking recurring CC charges

create table installments (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id) on delete cascade not null,
  name text not null,
  total_months integer not null check (total_months > 0),
  months_elapsed integer not null default 0,
  amount_per_month numeric(10,2) not null,
  billing_day integer not null check (billing_day between 1 and 31),
  payment_method_id uuid references payment_methods(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  is_completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table installments enable row level security;

create policy "Installments: members can view" on installments for select
  using (space_id in (select space_id from space_members where user_id = auth.uid()));

create policy "Installments: members can insert" on installments for insert
  with check (space_id in (select space_id from space_members where user_id = auth.uid()));

create policy "Installments: members can update" on installments for update
  using (space_id in (select space_id from space_members where user_id = auth.uid()));

create policy "Installments: members can delete" on installments for delete
  using (space_id in (select space_id from space_members where user_id = auth.uid()));
