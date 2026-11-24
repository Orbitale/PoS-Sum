-- SQLite can't change a CHECK constraint in place, so the table is rebuilt to allow 'check'.
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
