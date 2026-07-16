-- Add eWallet balance tracking and auto-reload configuration
-- Only used when payment_methods.type = 'ewallet'

ALTER TABLE payment_methods
  ADD COLUMN balance numeric(10,2) DEFAULT 0,
  ADD COLUMN auto_reload_enabled boolean DEFAULT false,
  ADD COLUMN reload_amount numeric(10,2) DEFAULT 20,
  ADD COLUMN reload_threshold numeric(10,2) DEFAULT 20,
  ADD COLUMN linked_payment_method_id uuid REFERENCES payment_methods(id),
  ADD COLUMN fee_rate numeric(5,4) DEFAULT 0.01;
