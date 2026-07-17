-- 008: Add is_auto flag to installments for manual (eWallet PayLater) vs auto (CC) tracking

alter table installments add column is_auto boolean default true;

-- Existing CC installments should be auto
update installments set is_auto = true;
