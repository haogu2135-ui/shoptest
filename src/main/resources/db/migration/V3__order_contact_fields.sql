ALTER TABLE orders ADD COLUMN recipient_name VARCHAR(120);
ALTER TABLE orders ADD COLUMN recipient_phone VARCHAR(60);
ALTER TABLE orders ADD COLUMN contact_email VARCHAR(160);
CREATE INDEX idx_orders_contact_email ON orders (contact_email);
