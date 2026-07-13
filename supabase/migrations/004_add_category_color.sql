-- Add color column to categories
ALTER TABLE categories ADD COLUMN color text;

-- Update the seeded categories with distinct colors
UPDATE categories SET color = '#ef4444' WHERE name = 'Food & Drinks';
UPDATE categories SET color = '#3b82f6' WHERE name = 'Transport';
UPDATE categories SET color = '#f59e0b' WHERE name = 'Shopping';
UPDATE categories SET color = '#8b5cf6' WHERE name = 'Entertainment';
UPDATE categories SET color = '#10b981' WHERE name = 'Bills & Utilities';
UPDATE categories SET color = '#ec4899' WHERE name = 'Health';
UPDATE categories SET color = '#6366f1' WHERE name = 'Education';
UPDATE categories SET color = '#14b8a6' WHERE name = 'Personal Care';
