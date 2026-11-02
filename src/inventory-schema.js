export const inventorySchema = `
CREATE TABLE inventory_drinks (
 id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 size_ml BIGINT NOT NULL CHECK(size_ml BETWEEN 1 AND 100000),
 sale_cents BIGINT NOT NULL CHECK(sale_cents BETWEEN 0 AND 1000000),
 purchase_cents BIGINT CHECK(purchase_cents BETWEEN 0 AND 1000000),
 minimum BIGINT NOT NULL CHECK(minimum BETWEEN 0 AND 1000000000),
 active BIGINT NOT NULL CHECK(active IN (0,1)), version BIGINT NOT NULL CHECK(version>=0)
);
CREATE TABLE inventory_packages (
 id TEXT PRIMARY KEY, drink_id TEXT NOT NULL REFERENCES inventory_drinks(id) DEFERRABLE INITIALLY DEFERRED,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 bottles BIGINT NOT NULL CHECK(bottles BETWEEN 1 AND 1000000), version BIGINT NOT NULL CHECK(version>=0)
);
CREATE TABLE inventory_operations (
 id TEXT PRIMARY KEY, request TEXT NOT NULL, result TEXT NOT NULL
);
CREATE TABLE inventory_movements (
 id BIGINT PRIMARY KEY CHECK(id>0), drink_id TEXT NOT NULL REFERENCES inventory_drinks(id) DEFERRABLE INITIALLY DEFERRED,
 operation_id TEXT NOT NULL UNIQUE REFERENCES inventory_operations(id) DEFERRABLE INITIALLY DEFERRED,
 kind TEXT NOT NULL CHECK(kind IN ('initial','receipt','consumption','breakage','own_use','adjustment','reversal')),
 quantity BIGINT NOT NULL CHECK(quantity<>0 AND quantity BETWEEN -1000000000 AND 1000000000),
 created_at TEXT NOT NULL, reason TEXT NOT NULL, snapshot TEXT NOT NULL,
 reverses BIGINT UNIQUE REFERENCES inventory_movements(id) DEFERRABLE INITIALLY DEFERRED
);
`;
