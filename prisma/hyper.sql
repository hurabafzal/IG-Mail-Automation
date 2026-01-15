-- SELECT create_hypertable('"IGHistoryTable"', ('created_at'), migrate_data => true);
-- SELECT create_hypertable('"InstagramPost"', ('taken_at'), migrate_data => true);

CREATE MATERIALIZED VIEW  IF NOT EXISTS total_daily_count AS
SELECT
  time_bucket('1 day', created_at) AS bucket,
  count(*) AS count
FROM  "InstagramAccountBase"
GROUP BY bucket
WITH DATA;

CREATE UNIQUE INDEX total_daily_count_bucket ON total_daily_count (bucket);

BEGIN;
DROP MATERIALIZED VIEW IF EXISTS leads;

CREATE MATERIALIZED VIEW IF NOT EXISTS leads AS
SELECT DISTINCT ON ("InstagramAccountBase".id)
	"InstagramAccountBase".id,
	"InstagramAccountBase".username,
	"InstagramAccountBase".created_at,
	"InstagramAccountBase".country,
	"InstagramAccountBase"."activeCampaignId",
	"triggerBitmap" AS bitmap,
	bio_language,
	"lastSentEmail",
	approved,
	"lastSentOpener",
	"hiddenLikes",
	"Email".email
FROM
	"InstagramAccountBase"
	INNER JOIN "Email" ON "InstagramAccountBase".id = "Email".instagram_id
WHERE
	"Email".code <> 6
	AND "Email".code <> 7
	AND "blacklist" = FALSE
	AND "last_updated" > NOW() - INTERVAL '30 days'
	AND "Email".code IS NOT NULL
	AND "first_name" IS NOT NULL
	AND "first_name" != 'No name found'
	AND "niche" != 'no niche found'
	AND "followers_count" > 7000
	AND "followers_count" < 100000
WITH DATA;

CREATE UNIQUE INDEX leads_id ON leads (id);
COMMIT;


BEGIN;
DROP MATERIALIZED VIEW IF EXISTS ig_history_leads;

CREATE MATERIALIZED VIEW IF NOT EXISTS ig_history_leads AS
SELECT "IGHistoryTable".* 
FROM "IGHistoryTable" 
INNER JOIN leads ON "IGHistoryTable".user_id = leads.id
WITH DATA;

CREATE UNIQUE INDEX ig_history_leads_idx ON ig_history_leads (day, user_id, created_at);
COMMIT;

CREATE MATERIALIZED VIEW IF NOT EXISTS target_daily_counts AS
SELECT
  time_bucket('1 day', "InstagramAccountBase".created_at) AS bucket,
  count(*) AS count
FROM
	"InstagramAccountBase"
WHERE
	"followers_count" > 7000
	AND "followers_count" < 100000
GROUP BY bucket
WITH DATA;

CREATE UNIQUE INDEX target_daily_bucket ON target_daily_counts (bucket);