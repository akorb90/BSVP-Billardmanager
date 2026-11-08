export const rentalDrinkSchema = `
ALTER TABLE rentals ADD COLUMN comment TEXT CHECK(comment IS NULL OR (length(trim(comment)) BETWEEN 1 AND 200 AND comment=trim(comment)));
CREATE TABLE rental_drinks (
 id TEXT PRIMARY KEY, rental_id BIGINT NOT NULL REFERENCES rentals(id) DEFERRABLE INITIALLY DEFERRED,
 movement_id BIGINT NOT NULL UNIQUE REFERENCES inventory_movements(id) DEFERRABLE INITIALLY DEFERRED,
 cancelled_at BIGINT, reason TEXT, returned BIGINT CHECK(returned IN (0,1)),
 reversal_id BIGINT UNIQUE REFERENCES inventory_movements(id) DEFERRABLE INITIALLY DEFERRED,
 CHECK ((cancelled_at IS NULL AND reason IS NULL AND returned IS NULL AND reversal_id IS NULL) OR
 (cancelled_at IS NOT NULL AND length(trim(reason)) BETWEEN 1 AND 500 AND returned IS NOT NULL AND (returned=0 AND reversal_id IS NULL OR returned=1 AND reversal_id IS NOT NULL)))
);
CREATE TABLE rental_checks (
 id TEXT PRIMARY KEY, rental_id BIGINT NOT NULL REFERENCES rentals(id) DEFERRABLE INITIALLY DEFERRED,
 version BIGINT NOT NULL CHECK(version>=0), checked_at BIGINT NOT NULL, snapshot TEXT NOT NULL, request TEXT NOT NULL,
 UNIQUE(rental_id,version)
);
CREATE TABLE rental_operations (
 id TEXT PRIMARY KEY, rental_id BIGINT NOT NULL REFERENCES rentals(id) DEFERRABLE INITIALLY DEFERRED,
 request TEXT NOT NULL, result TEXT NOT NULL
);
`;
