-- In kilograms.
ALTER TABLE orders ADD COLUMN weight REAL;

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

-- 0 means the price is only a suggestion and can be changed on each order.
ALTER TABLE products ADD COLUMN fixed_price INTEGER NOT NULL DEFAULT 1;

ALTER TABLE order_items ADD COLUMN comment TEXT NOT NULL DEFAULT '';
