-- Run exactly once with: npx wrangler d1 execute fluentpath-sync --remote --file=worker/schema.sql
-- If running from inside worker/, use --file=schema.sql instead.
CREATE TABLE IF NOT EXISTS device_snapshots (
  device_id TEXT PRIMARY KEY NOT NULL,
  device_name TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_device_snapshots_updated_at ON device_snapshots(updated_at);
