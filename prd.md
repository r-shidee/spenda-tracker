# Product Requirements Document (PRD)
## Project Name: Spenda (Personal Expense & Behavioral Tracker)

### 1. Project Overview
A lightweight, mobile-first web application designed strictly for active personal expense and behavioral tracking (no income tracking). The primary objective is to gain high-level visibility over monthly cash outflows, specifically capturing credit card statement balances and custom electronic wallet expenditures while preventing double-counting.

#### Tech Stack
*   **Frontend:** Next.js (App Router), Tailwind CSS, Shadcn UI
*   **Backend/Database:** Supabase (PostgreSQL)
*   **Authentication:** Supabase Auth (Google & Apple ID Sign-In)
*   **Deployment:** Vercel (Free Tier - 100% Free Lifecycle)

---

### 2. Authentication & Access Control (Strict Multi-Layered Security)
To completely eliminate unauthorized public access and mitigate Vercel/Supabase rate-limiting or pricing risks, a 3-layer security model must be implemented:

*   **Layer 1: Global Access Protection (Vercel Deployment Protection)**
    *   Deploy with Vercel's built-in **Password Protection** enabled. 
    *   Anyone accessing the production URL must enter a global password first before the web UI or login screen is rendered.
*   **Layer 2: Application Level Whitelist (Next.js Middleware)**
    *   Hardcode/Environment variable containing exactly two allowed emails: `WHITELISTED_EMAILS=["suami@gmail.com", "isteri@gmail.com"]`.
    *   Implement Next.js Middleware to check the Supabase auth session. If a user somehow passes Layer 1 but their authenticated email is NOT in the whitelist, immediately destroy the session and redirect them to a `/unauthorized` page at the Edge level.
*   **Layer 3: Database Level Enforcement (Supabase Row Level Security - RLS)**
    *   Enable RLS on all PostgreSQL tables.
    *   Data access is only granted if the authenticated user's email (`auth.jwt() ->> 'email'`) strictly matches one of the two whitelisted emails.

---

### 3. UI/UX & Design Guidelines
*   **Aesthetic:** Clean, modern, high-contrast, minimalist (Wise/Airbnb style). Generous white space, crisp typography, and subtle borders.
*   **Device First:** Mobile-first responsive design as the primary use case is on smartphones.
*   **Navigation:** Simple bottom navigation bar for mobile layout.

---

### 4. Features & Screen Requirements

#### 4.1 Home Page (Dashboard)
*   **Monthly Overview:** Large, clean typography showing the **Total Spending of the Current Period** (e.g., `RM 4,250.00`).
*   **Toggle Filter:** A clean switch allowing the user to toggle between:
    1.  *Standard Calendar Month* (1st – 30th/31st).
    2.  *Custom Credit Card Statement Cycle* (e.g., 25th of last month to 24th of current month).
*   **Floating Action Button (FAB):** A prominent `+` button at the bottom right to quickly log a manual transaction on-the-go.
*   **Recent Transactions:** A scannable list showing the **5 latest transactions**. Each item displays the Merchant, Category, Amount, Date, and Payment Method. Includes a "View All" link to see full history.

#### 4.2 Add Expense Flow (FAB Modal/Page)
When the FAB is clicked, a full-screen modal or a clean page opens with the following inputs:
1.  **Amount Input (Numeric/Tel Keypad):** 
    *   Initial State: `RM 0.00`
    *   Behavior: Fills from right to left as the user types (e.g., typing `5`, `0`, `0`, `0` formats dynamically into `RM 50.00`).
2.  **Date & Time Execution:** Automatically populated with the exact live timestamp when the form opens (modifiable via a minimal date picker).
3.  **Merchant Name:** Text input to capture where the money was spent.
4.  **Category Tagging:** Single-select pill buttons (e.g., `Eating Out`, `Groceries`, `Petrol`, `Shopping`, `Utilities`).
5.  **Payment Method:** Dropdown or pills to select the payment method (e.g., `Cash`, `Maybank CC`, `Petronas CC`, `TnG eWallet`).
6.  **Expense Type / Ownership:** Radio pills to tag ownership:
    *   `Self`: Paid by me, for me (Standard calculation).
    *   `Shared`: Family/Household expenses.
    *   `Gift / Treat Spouse`: Paid voluntarily for spouse (Counted towards spending, but categorized as gift).
    *   `Paid for Others (Reimbursable)`: Advanced money/loan. Backed by a boolean `is_reimbursed` flag. Once toggled to `true`, this transaction's amount is deducted from the Total Spending calculation.

#### 4.3 Data Import & Safety Net Parser (Dedicated Page)
This feature acts as a backup mechanism to catch missed manual entries at the end of the month via client-side processing (100% free).

*   **PDF Statement Import (Bank/Credit Card):**
    *   Supports upload of bank statement PDFs. If encrypted, the UI prompts for the PDF password.
    *   Extracted via browser-side libraries (e.g., `pdfjs-dist`). 
    *   **Auto-Reload Separation:** If the parser detects credit card line items indicating e-wallet funding (e.g., `AUTO RELOAD TNG`), it classifies the principal amount as a `Transfer` (excluded from spending to prevent double-counting) and logs the 1% reload fee into `Bank Fees` (included in spending).
*   **Screenshot Import (e-Wallet/TnG):**
    *   Supports uploading transaction history screenshots to extract micro-transactions that occurred inside e-wallets.
*   **Interactive Review & Deduplication Screen:**
    *   Before committing data to the database, extracted data is rendered in a staging table.
    *   **Deduplication Engine:** The system cross-checks the database for any manual entry matching the same `transaction_date`, `amount`, and `payment_method`. If a match is found, it marks it as a **"Duplicate/Matched"** and automatically unchecks it. Missed entries are marked as **"New Transaction"**.
    *   Users can inline-edit messy statement texts (e.g., renaming `ZW*MCDONALD SUBANG` to `McDonalds`) and bulk-assign categories before hitting "Confirm & Bulk Save".

---

### 5. Database Schema (Supabase / PostgreSQL)

```sql
-- 1. Table for Space/Household
create table spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Table for Payment Methods
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id) on delete cascade not null,
  name text not null, -- e.g., 'Petronas CC', 'TnG eWallet', 'Cash'
  type text check (type in ('credit_card', 'ewallet', 'cash')) not null,
  statement_close_day integer check (statement_close_day between 1 and 31), -- e.g., 24
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Table for Transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  amount numeric(10, 2) not null,
  currency text default 'RM' not null,
  merchant_name text not null,
  transaction_date date not null,
  transaction_time time,
  category text not null,
  payment_method_id uuid references payment_methods(id) on delete set null,
  transaction_type text check (transaction_type in ('expense', 'transfer')) default 'expense' not null, -- 'transfer' for ewallet loads
  expense_ownership text check (expense_ownership in ('self', 'shared', 'gift_spouse', 'paid_for_others')) default 'self' not null,
  is_reimbursed boolean default false not null, -- Toggled true when peer loans/advances are repaid
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
6. Constraints & Edge Cases
Auto Space Mapping: To keep the MVP onboarding entirely seamless, the first whitelisted user to register will instantiate the primary space_id. The second whitelisted user (spouse) will automatically be mapped to that exact same space_id upon their first successful login.

The Single Source of Truth Rule: To safeguard behavioral breakdown data, actual spending is calculated from e-wallet itemized logs and physical credit card card-swipes. Financial transfers from a Credit Card to an e-Wallet are marked as transaction_type = 'transfer' and are explicitly omitted from the Dashboard total spending sum to eliminate double-counting.