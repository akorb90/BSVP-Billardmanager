export const scheduleSchema = `
CREATE TABLE event_planning(event_id INTEGER PRIMARY KEY,started INTEGER NOT NULL DEFAULT 0 CHECK(started IN (0,1)),source_id TEXT UNIQUE,metadata TEXT NOT NULL);
CREATE TABLE nuliga_schedule_sync(id INTEGER PRIMARY KEY CHECK(id=1),synced_at TEXT NOT NULL,summary TEXT NOT NULL);
INSERT INTO event_planning(event_id,started,metadata) SELECT id,1,'{}' FROM events;
`;
