export const inventoryBatchSchema = `
CREATE TABLE inventory_templates (
 id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 version BIGINT NOT NULL CHECK(version>=0), lines TEXT NOT NULL
);
CREATE TABLE inventory_batches (
 id TEXT PRIMARY KEY REFERENCES inventory_operations(id) DEFERRABLE INITIALLY DEFERRED,
 kind TEXT NOT NULL CHECK(kind IN ('receipt','inventory')), created_at TEXT NOT NULL, lines TEXT NOT NULL
);
CREATE INDEX inventory_batches_kind_time ON inventory_batches(kind,created_at DESC);
`;
