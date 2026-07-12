-- Seed default categories for a new space
-- Run this after creating a space, replacing 'SPACE_ID_HERE' with the actual space UUID

insert into categories (space_id, name, icon, sort_order, is_default) values
  ('SPACE_ID_HERE', 'Eating Out', '🍽️', 1, true),
  ('SPACE_ID_HERE', 'Groceries', '🛒', 2, true),
  ('SPACE_ID_HERE', 'Petrol', '⛽', 3, true),
  ('SPACE_ID_HERE', 'Shopping', '🛍️', 4, true),
  ('SPACE_ID_HERE', 'Utilities', '💡', 5, true),
  ('SPACE_ID_HERE', 'Transport', '🚗', 6, true),
  ('SPACE_ID_HERE', 'Entertainment', '🎬', 7, true),
  ('SPACE_ID_HERE', 'Health', '🏥', 8, true),
  ('SPACE_ID_HERE', 'Education', '📚', 9, true),
  ('SPACE_ID_HERE', 'Household', '🏠', 10, true),
  ('SPACE_ID_HERE', 'Clothing', '👕', 11, true),
  ('SPACE_ID_HERE', 'Personal Care', '💆', 12, true),
  ('SPACE_ID_HERE', 'Bank Fees', '🏦', 13, true),
  ('SPACE_ID_HERE', 'Transfer', '🔄', 14, true),
  ('SPACE_ID_HERE', 'Gift', '🎁', 15, true);
