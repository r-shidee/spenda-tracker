-- Spenda Database Schema
-- Run this in Supabase SQL Editor or as a migration

-- 1. Spaces
create table spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  statement_close_day integer check (statement_close_day between 1 and 31) default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Space Members
create table space_members (
  space_id uuid references spaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text check (role in ('owner', 'member')) default 'member' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (space_id, user_id)
);

-- 3. Categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id) on delete cascade not null,
  name text not null,
  icon text,
  sort_order integer default 0,
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(space_id, name)
);

-- 4. Payment Methods
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id) on delete cascade not null,
  name text not null,
  type text check (type in ('credit_card', 'ewallet', 'cash')) not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  amount numeric(10, 2) not null,
  currency text default 'RM' not null,
  merchant_name text not null,
  transaction_date date not null,
  transaction_time time,
  category_id uuid references categories(id) on delete set null,
  payment_method_id uuid references payment_methods(id) on delete set null,
  transaction_type text check (transaction_type in ('expense', 'transfer')) default 'expense' not null,
  expense_ownership text check (expense_ownership in ('self', 'shared', 'gift_spouse', 'paid_for_others')) default 'self' not null,
  is_reimbursed boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes
create index idx_transactions_date_space on transactions(transaction_date, space_id);
create index idx_transactions_payment_method on transactions(payment_method_id);
create index idx_transactions_category on transactions(category_id);
create index idx_space_members_user on space_members(user_id);

-- RLS Policies
alter table spaces enable row level security;
alter table space_members enable row level security;
alter table categories enable row level security;
alter table payment_methods enable row level security;
alter table transactions enable row level security;

-- spaces
create policy "Spaces: members can view" on spaces for select
  using (id in (select space_id from space_members where user_id = auth.uid()));

create policy "Spaces: owner can update" on spaces for update
  using (id in (select space_id from space_members where user_id = auth.uid() and role = 'owner'));

-- space_members
create policy "Space members: members can view" on space_members for select
  using (space_id in (select space_id from space_members where user_id = auth.uid()));

create policy "Space members: owner can insert" on space_members for insert
  with check (space_id in (select space_id from space_members where user_id = auth.uid() and role = 'owner'));

create policy "Space members: owner can delete" on space_members for delete
  using (space_id in (select space_id from space_members where user_id = auth.uid() and role = 'owner'));

-- categories
create policy "Categories: members can view" on categories for select
  using (space_id in (select space_id from space_members where user_id = auth.uid()));

create policy "Categories: members can insert" on categories for insert
  with check (space_id in (select space_id from space_members where user_id = auth.uid()));

create policy "Categories: members can update" on categories for update
  using (space_id in (select space_id from space_members where user_id = auth.uid()));

create policy "Categories: members can delete" on categories for delete
  using (space_id in (select space_id from space_members where user_id = auth.uid()));

-- payment_methods
create policy "Payment methods: members can view" on payment_methods for select
  using (space_id in (select space_id from space_members where user_id = auth.uid()));

create policy "Payment methods: members can insert" on payment_methods for insert
  with check (space_id in (select space_id from space_members where user_id = auth.uid()));

create policy "Payment methods: members can update" on payment_methods for update
  using (space_id in (select space_id from space_members where user_id = auth.uid()));

create policy "Payment methods: members can delete" on payment_methods for delete
  using (space_id in (select space_id from space_members where user_id = auth.uid()));

-- transactions
create policy "Transactions: members can view" on transactions for select
  using (space_id in (select space_id from space_members where user_id = auth.uid()));

create policy "Transactions: members can insert" on transactions for insert
  with check (space_id in (select space_id from space_members where user_id = auth.uid()));

create policy "Transactions: members can update" on transactions for update
  using (space_id in (select space_id from space_members where user_id = auth.uid()));

create policy "Transactions: members can delete" on transactions for delete
  using (space_id in (select space_id from space_members where user_id = auth.uid()));
