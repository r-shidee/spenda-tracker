-- Subcategories table
CREATE TABLE subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid REFERENCES spaces(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  icon text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(space_id, category_id, name)
);

-- Add subcategory_id to transactions
ALTER TABLE transactions
  ADD COLUMN subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_subcategory ON transactions(subcategory_id);

-- RLS
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subcategories: members can view" ON subcategories FOR SELECT
  USING (space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid()));

CREATE POLICY "Subcategories: members can insert" ON subcategories FOR INSERT
  WITH CHECK (space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid()));

CREATE POLICY "Subcategories: members can update" ON subcategories FOR UPDATE
  USING (space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid()));

CREATE POLICY "Subcategories: members can delete" ON subcategories FOR DELETE
  USING (space_id IN (SELECT space_id FROM space_members WHERE user_id = auth.uid()));
