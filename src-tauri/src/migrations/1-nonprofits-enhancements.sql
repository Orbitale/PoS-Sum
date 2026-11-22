-- Optional order weight (kilograms).
ALTER TABLE orders ADD COLUMN weight REAL;

-- Application configuration key/value store.
CREATE TABLE IF NOT EXISTS configuration (
    id    TEXT PRIMARY KEY NOT NULL,
    name  TEXT NOT NULL,
    value TEXT NOT NULL
);

INSERT OR IGNORE INTO configuration (id, name, value) VALUES
    ('shop_name', 'Shop name', ''),
    ('order_weight_enabled', 'Activate weight field in Order page', '0'),
    ('custom_product_enabled', 'Allow adding custom product on-the-fly', '0'),
    ('shop_language', 'Shop language', 'fr'),
    ('theme', 'Dark/Light mode', 'light');

-- 1 = fixed catalog price, 0 = updatable/recommended price at sale time.
ALTER TABLE products ADD COLUMN fixed_price INTEGER NOT NULL DEFAULT 1;

-- Free-text note attached to a sold line item.
ALTER TABLE order_items ADD COLUMN comment TEXT NOT NULL DEFAULT '';
