# PRD Update Plan for Spenda

## Status: APPROVED — Ready for Implementation

The updated PRD content below resolves all identified gaps. Once implementation begins, this content should replace `prd.md`.

---

# Product Requirements Document (PRD)
## Project Name: Spenda (Personal Expense & Behavioral Tracker)

### 1. Project Overview
A lightweight, mobile-first web application designed strictly for active personal expense and behavioral tracking (no income tracking). The primary objective is to gain high-level visibility over monthly cash outflows — specifically capturing credit card spending and electronic wallet expenditures — while preventing double-counting.

#### Tech Stack
*   **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Shadcn UI
*   **Backend/Database:** Supabase (PostgreSQL)
*   **Authentication:** Supabase Auth (Google Sign-In)
*   **Deployment:** Vercel (Free Tier)

---

### 2. Authentication & Access Control (3-Layer Security)

*   **Layer 1: Global Access Protection (Vercel Deployment Protection)**
    *   Deploy with Vercel's built-in **Password Protection** enabled.
    *   Anyone accessing the production URL must enter a global password before the login screen is rendered.
*   **Layer 2: Application Level Whitelist (Next.js Middleware)**
    *   Environment variable `WHITELISTED_EMAILS` containing comma-separated allowed emails: `suami@gmail.com,isteri@gmail.com`.
    *   Next.js Middleware checks the Supabase auth session on every request. If the authenticated email is NOT in the whitelist, the session is destroyed and the user is redirected to `/unauthorized`.
*   **Layer 3: Database Level Enforcement (Supabase RLS)**
    *   RLS is enabled on ALL tables.
    *   Data access is granted only if the authenticated user's email (`auth.jwt() ->> 'email'`) matches one of the whitelisted emails AND the user is a member of the space.
    *   See Section 5 for full RLS policies.

---

### 3. UI/UX & Design Guidelines
*   **Aesthetic:** Clean, modern, high-contrast, minimalist (Wise/Airbnb style). Generous white space, crisp typography, subtle borders.
*   **Device First:** Mobile-first responsive design. Primary use case is smartphones.
*   **Navigation:** Bottom navigation bar with 3 items: **Home** (`/`), **Import** (`/import`), **Settings** (`/settings`).
*   **Floating Action Button (FAB):** A `+` button on the Dashboard for quick expense entry.

---

### 4. Features & Screen Requirements

#### 4.1 Dashboard (`/`)
*   **Monthly Spending Total:** Large, clean typography showing the **Total Spending of the Current Period** (e.g., `RM 4,250.00`).
*   **Period Toggle:** A switch to toggle between:
    1.  *Standard Calendar Month* (1st – 30th/31st).
    2.  *Custom Statement Cycle* — configurable in Settings (e.g., 25th of last month to 24th of current month). This is a **global** setting applied to all payment methods.
*   **Category Breakdown:** A simple horizontal bar chart or visual breakdown showing spending per category for the current period.
*   **Recent Transactions:** List of the **5 latest transactions**. Each row shows: Merchant, Category, Amount, Date, Payment Method. A "View All" link navigates to the full transaction list.
*   **FAB (`+`):** Opens the Add Expense flow.

#### 4.2 Add Expense Flow (`/add`)
A full-screen page with the following inputs:
1.  **Amount Input (Numeric Keypad):**
    *   Initial state: `RM 0.00`
    *   Fills right-to-left as user types (typing `5`, `0`, `0`, `0` → `RM 50.00`).
2.  **Date & Time:** Auto-populated with current timestamp. Editable via minimal date picker.
3.  **Merchant Name:** Text input.
4.  **Category:** Single-select pill buttons, loaded from the `categories` table for the user's space. Default seeded categories: `Eating Out`, `Groceries`, `Petrol`, `Shopping`, `Utilities`, `Transport`, `Entertainment`, `Health`, `Education`, `Household`, `Clothing`, `Personal Care`, `Bank Fees`, `Transfer`, `Gift`.
5.  **Payment Method:** Dropdown/pills loaded from `payment_methods` table (only active ones).
6.  **Expense Ownership:** Radio pills:
    *   `Self` — Paid by me, for me.
    *   `Shared` — Family/household expense.
    *   `Gift / Treat Spouse` — Voluntarily paid for spouse. Counted as spending, categorized as gift.
    *   `Paid for Others (Reimbursable)` — Loan/advance. Has an `is_reimbursed` toggle. When `true`, the amount is excluded from the dashboard total.

#### 4.3 Transaction Detail & Edit (`/transactions/[id]`)
*   Displays all fields of a single transaction in a clean, read-only view.
*   **Edit Button:** Opens the same form as Add Expense, pre-filled with the transaction's data. All fields are editable.
*   **Delete Button:** Permanent hard delete with a confirmation dialog ("Are you sure? This cannot be undone.").

#### 4.4 Data Import (`/import`)
PDF statement parser for catching missed manual entries at month-end. Client-side processing only (100% free).

*   **PDF Upload:**
    *   Supports bank/credit card statement PDFs.
    *   If encrypted, prompts for PDF password.
    *   Parsed client-side using `pdfjs-dist`.
*   **Auto-Reload Separation Logic:**
    *   If the parser detects line items matching e-wallet funding patterns (e.g., `AUTO RELOAD TNG`, `TNG E-WALLET TOP UP`), the entire line item is classified as `transaction_type = 'transfer'` (excluded from spending).
    *   If a separate fee line exists (e.g., `RELOAD FEE`), it is categorized as `Bank Fees` and included in spending.
    *   If no separate fee line exists, no fee is created.
*   **Review & Deduplication Screen:**
    *   Extracted rows are displayed in a staging table with columns: Date, Merchant, Amount, Payment Method, Category (editable), Status.
    *   **Exact Deduplication:** Each row is cross-checked against existing transactions matching the same `transaction_date`, `amount`, and `payment_method_id`. Matches are marked **"Duplicate"** and unchecked by default. Non-matches are marked **"New"** and checked.
    *   Users can edit merchant names (e.g., `ZW*MCDONALD SUBANG` → `McDonalds`), change categories, and toggle checkboxes.
    *   **"Confirm & Save"** bulk-inserts all checked rows into the `transactions` table.

#### 4.5 Settings (`/settings`)
A page with the following sections:

*   **Space Name:** Edit the household/space name.
*   **Statement Cycle:** Set the global statement close day (1–31) used for the Dashboard period toggle.
*   **Payment Methods:**
    *   List all payment methods with name, type, and active status.
    *   Add new payment method (name, type: credit_card/ewallet/cash).
    *   Toggle `is_active` to hide old methods without deleting them.
    *   Delete payment method (with confirmation; existing transactions are set to `payment_method_id = NULL`).
*   **Categories:**
    *   List all categories with name and sort order.
    *   Add new category.
    *   Rename existing category.
    *   Delete category (only if no transactions use it; otherwise show warning).

---

### 5. Database Schema (Supabase / PostgreSQL)

```sql
-- 1. Spaces
create table spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  statement_close_day integer check (statement_close_day between 1 and 31) default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Space Members (join table for users ↔ spaces)
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
```

#### RLS Policies

```sql
-- Enable RLS on all tables
alter table spaces enable row level security;
alter table space_members enable row level security;
alter table categories enable row level security;
alter table payment_methods enable row level security;
alter table transactions enable row level security;

-- spaces: select if member, update if owner
create policy "Spaces: members can view" on spaces for select
  using (
    id in (select space_id from space_members where user_id = auth.uid())
  );

create policy "Spaces: owner can update" on spaces for update
  using (
    id in (select space_id from space_members where user_id = auth.uid() and role = 'owner')
  );

-- space_members: owner can manage, members can view
create policy "Space members: owner can insert" on space_members for insert
  with check (
    space_id in (select space_id from space_members where user_id = auth.uid() and role = 'owner')
  );

create policy "Space members: members can view" on space_members for select
  using (
    space_id in (select space_id from space_members where user_id = auth.uid())
  );

create policy "Space members: owner can delete" on space_members for delete
  using (
    space_id in (select space_id from space_members where user_id = auth.uid() and role = 'owner')
  );

-- categories: full CRUD for space members
create policy "Categories: members can view" on categories for select
  using (
    space_id in (select space_id from space_members where user_id = auth.uid())
  );

create policy "Categories: members can insert" on categories for insert
  with check (
    space_id in (select space_id from space_members where user_id = auth.uid())
  );

create policy "Categories: members can update" on categories for update
  using (
    space_id in (select space_id from space_members where user_id = auth.uid())
  );

create policy "Categories: members can delete" on categories for delete
  using (
    space_id in (select space_id from space_members where user_id = auth.uid())
  );

-- payment_methods: full CRUD for space members
create policy "Payment methods: members can view" on payment_methods for select
  using (
    space_id in (select space_id from space_members where user_id = auth.uid())
  );

create policy "Payment methods: members can insert" on payment_methods for insert
  with check (
    space_id in (select space_id from space_members where user_id = auth.uid())
  );

create policy "Payment methods: members can update" on payment_methods for update
  using (
    space_id in (select space_id from space_members where user_id = auth.uid())
  );

create policy "Payment methods: members can delete" on payment_methods for delete
  using (
    space_id in (select space_id from space_members where user_id = auth.uid())
  );

-- transactions: full CRUD for space members
create policy "Transactions: members can view" on transactions for select
  using (
    space_id in (select space_id from space_members where user_id = auth.uid())
  );

create policy "Transactions: members can insert" on transactions for insert
  with check (
    space_id in (select space_id from space_members where user_id = auth.uid())
  );

create policy "Transactions: members can update" on transactions for update
  using (
    space_id in (select space_id from space_members where user_id = auth.uid())
  );

create policy "Transactions: members can delete" on transactions for delete
  using (
    space_id in (select space_id from space_members where user_id = auth.uid())
  );
```

#### Seed Data (Categories)

Default categories inserted when a new space is created:

| Name | Icon | Sort Order |
|------|------|------------|
| Eating Out | 🍽️ | 1 |
| Groceries | 🛒 | 2 |
| Petrol | ⛽ | 3 |
| Shopping | 🛍️ | 4 |
| Utilities | 💡 | 5 |
| Transport | 🚗 | 6 |
| Entertainment | 🎬 | 7 |
| Health | 🏥 | 8 |
| Education | 📚 | 9 |
| Household | 🏠 | 10 |
| Clothing | 👕 | 11 |
| Personal Care | 💆 | 12 |
| Bank Fees | 🏦 | 13 |
| Transfer | 🔄 | 14 |
| Gift | 🎁 | 15 |

---

### 6. Route Map

| Route | Page | Bottom Nav |
|-------|------|------------|
| `/` | Dashboard | Home |
| `/add` | Add Expense | - |
| `/transactions/[id]` | Transaction Detail & Edit | - |
| `/import` | PDF Import & Dedup Review | Import |
| `/settings` | Settings (categories, payment methods, space) | Settings |
| `/unauthorized` | Access Denied | - |

---

### 7. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Auth whitelist (comma-separated)
WHITELISTED_EMAILS=suami@gmail.com,isteri@gmail.com
```

---

### 8. Business Logic & Constraints

#### Auto Space Mapping
The first whitelisted user to register instantiates the primary space. The second whitelisted user is automatically mapped to that same space upon first login. Both users share the same `space_id` and can see/edit all transactions within it.

#### Single Source of Truth Rule
Actual spending is calculated from individual transactions. Transfers from Credit Card to e-Wallet are marked `transaction_type = 'transfer'` and are **excluded** from the Dashboard total spending sum to eliminate double-counting.

#### Dashboard Total Spending Calculation
```
Total Spending = SUM(transactions.amount)
  WHERE transaction_type = 'expense'
  AND is_reimbursed = false
  AND transaction_date >= period_start
  AND transaction_date <= period_end
```

#### Deduplication Logic
Exact match on three fields: `transaction_date`, `amount`, and `payment_method_id`. If all three match an existing transaction, the imported row is marked as a duplicate. No fuzzy matching is performed.

#### Reimbursement Toggle
- `is_reimbursed = false` (default): Transaction counts toward total spending.
- `is_reimbursed = true`: Transaction is excluded from total spending.
- The toggle can be switched both ways (e.g., if reimbursement falls through).
- The dashboard recalculates retroactively for the current period.

#### Auto-Reload Fee Parsing
- If a PDF line item matches e-wallet funding patterns (e.g., `AUTO RELOAD TNG`, `TNG E-WALLET TOP UP`): classify as `transaction_type = 'transfer'`, exclude from spending.
- If a separate fee line item exists in the PDF (e.g., `RELOAD FEE RM0.10`): create a transaction with `category = 'Bank Fees'`, `transaction_type = 'expense'`.
- If no separate fee line exists: no fee transaction is created.

---

### 9. Tech Notes

- **PDF Parsing:** Client-side using `pdfjs-dist`. No server-side processing.
- **Dedup:** Runs entirely in the browser. Fetches existing transactions for the date range and compares locally before bulk insert.
- **Amount Input:** Custom numeric input component that formats from right-to-left (digits enter from the cents position).
- **Category Breakdown on Dashboard:** Query transactions grouped by `category_id` for the current period. Display as horizontal bars or simple list with percentage.
