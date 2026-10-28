export const nuligaSchema = `
CREATE TABLE nuliga_entities(kind TEXT NOT NULL CHECK(kind IN ('player','team')),source_id TEXT NOT NULL,local_id TEXT NOT NULL,snapshot TEXT NOT NULL,PRIMARY KEY(kind,source_id),UNIQUE(kind,local_id));
CREATE TABLE nuliga_sync(id INTEGER PRIMARY KEY CHECK(id=1),synced_at TEXT NOT NULL,summary TEXT NOT NULL);
`;
