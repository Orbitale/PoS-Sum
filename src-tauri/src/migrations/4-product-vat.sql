ALTER TABLE products ADD COLUMN vat REAL NOT NULL DEFAULT 0 CHECK (vat >= 0 AND vat <= 100);

ALTER TABLE order_items ADD COLUMN vat REAL NOT NULL DEFAULT 0 CHECK (vat >= 0 AND vat <= 100);

ALTER TABLE orders ADD COLUMN vat_total INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO configuration (id, name, value) VALUES
    ('vat_enabled', 'Activate VAT support', '0');