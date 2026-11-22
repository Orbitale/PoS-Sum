-- Widen payment_method CHECK to include 'check' (SQLite cannot ALTER CHECK in place).
CREATE TABLE orders_new (
    id              TEXT PRIMARY KEY NOT NULL,
    created_at      TEXT NOT NULL,
    total           INTEGER NOT NULL,
    payment_method  TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'check')),
    weight          REAL
);

INSERT INTO orders_new (id, created_at, total, payment_method, weight)
SELECT id, created_at, total, payment_method, weight FROM orders;

DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;
