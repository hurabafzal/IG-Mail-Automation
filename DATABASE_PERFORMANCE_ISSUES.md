# Database Performance Issues - Exact Locations

## 🔴 Issue 1: Large Queries Without Pagination

### **Problem:** Queries fetch thousands of rows at once, causing memory issues and slow queries.

---

### **1.1 recursive-import.ts - Line 29**
**File:** `backend/src/mining/recursive-import.ts`

```typescript
const postsQuery = db_retry_effect({ name: "recursiveImportSearch" }, () =>
	db
		.selectFrom("InstagramAccountBase")
		.innerJoin(
			"InstagramPost",
			"InstagramAccountBase.id",
			"InstagramPost.user_id",
		)
		.select([
			"InstagramPost.id as post_id",
			"InstagramPost.user_id",
			"shortcode",
		])
		.where("InstagramPost.comment_count", ">", 5)
		.where("InstagramPost.comments_searched", "=", false)
		.where("InstagramAccountBase.ai_bio_lang", "=", "DE")
		.where("InstagramAccountBase.ai_bio_lang_conf", ">=", 4)
		.limit(5_000)  // ❌ FETCHES 5,000 ROWS AT ONCE
		.execute(),
);
```

**Impact:** 
- Loads 5,000 posts into memory
- Can cause database connection timeout
- High memory usage

**Fix:** Use cursor-based pagination or process in batches

---

### **1.2 detectLanguage.ts - Line 51**
**File:** `backend/src/mining/ML/detectLanguage.ts`

```typescript
const accounts = Effect.promise(() =>
	db
		.selectFrom("InstagramPost")
		.innerJoin(
			"InstagramAccountBase",
			"InstagramPost.user_id",
			"InstagramAccountBase.id",
		)
		.select([
			"InstagramPost.id",
			"InstagramPost.caption",
			"InstagramPost.user_id",
		])
		.where("caption_lang", "is", null)
		.where("caption", "!=", "")
		.where("caption", "is not", null)
		.limit(50_000)  // ❌ FETCHES 50,000 ROWS AT ONCE!
		.orderBy("InstagramPost.user_id", "desc")
		.execute(),
);
```

**Impact:**
- **CRITICAL:** Loads 50,000 posts into memory
- Will cause memory exhaustion
- Database query will be very slow
- Can crash the service

**Fix:** MUST use pagination - process in batches of 1000

---

### **1.3 findMissingCountires.ts - Line 28**
**File:** `backend/src/mining/instagramMiner/findMissingCountires.ts`

```typescript
const accounts = db_retry_effect({ name: "findMissingCountries" }, () =>
	db
		.selectFrom("InstagramAccountBase")
		.select(["InstagramAccountBase.id", "InstagramAccountBase.username"])
		.where("country", "is", null)
		.orderBy("InstagramAccountBase.created_at", "desc")
		.limit(5000)  // ❌ FETCHES 5,000 ROWS AT ONCE
		.execute(),
);
```

**Impact:**
- Loads 5,000 accounts into memory
- Can slow down database

---

### **1.4 InstagramDB.ts - Multiple Locations**

**File:** `backend/src/mining/InstagramDB.ts`

#### **Line 24:**
```typescript
const getHypeAuditAccounts = db_retry_effect(
	{ name: "GetHypeAuditAccounts" },
	() =>
		db
			.selectFrom("InitialInstagramAccount")
			.where("source_type", "=", "HYPE_AUDIT")
			.where("not_found", "=", false)
			.where("private", "=", false)
			.where("InitialInstagramAccount.account_id", "is", null)
			.limit(2000)  // ❌ FETCHES 2,000 ROWS
			.select(["InitialInstagramAccount.username as username"])
			.execute(),
);
```

#### **Line 38:**
```typescript
const getManualAccountBatches = db_retry_effect(
	{ name: "GetManualAccountBatches" },
	() =>
		db
			.selectFrom("ManualMiningQueue")
			.select(["ManualMiningQueue.username", "ManualMiningQueue.batch_id"])
			.where((eb) =>
				eb.and([eb("account_id", "is", null), eb("not_found", "=", false)]),
			)
			.limit(2000)  // ❌ FETCHES 2,000 ROWS
			.execute(),
);
```

#### **Line 69:**
```typescript
const getInitial = db_retry_effect(
	{ name: "GetInitialInstagramAccounts" },
	() =>
		db
			.selectFrom("InstagramAccountBase")
			.innerJoin(
				"RelatedAccounts",
				"RelatedAccounts.from_id",
				"InstagramAccountBase.id",
			)
			.innerJoin(
				"InitialInstagramAccount",
				"RelatedAccounts.to_username",
				"InitialInstagramAccount.username",
			)
			.where("InitialInstagramAccount.account_id", "is", null)
			.where("not_found", "=", false)
			.where("private", "=", false)
			.where((w) => /* ... filters ... */)
			.groupBy("RelatedAccounts.to_username")
			.limit(2000)  // ❌ FETCHES 2,000 ROWS
			.select([/* ... */])
			.orderBy("count", "desc")
			.execute(),
);
```

#### **Line 111:**
```typescript
const getExisting = db_retry_effect(
	{ name: "GetExistingInstagramAccounts" },
	() =>
		cache.settings.getOne("scraping_frequency").then((scraping_frequency) =>
			db
				.selectFrom("InstagramAccountBase")
				.select(["InstagramAccountBase.id", "username", "last_updated"])
				.orderBy("last_searched asc")
				.where("blacklist", "=", false)
				.where("missing", "=", false)
				.where(
					"last_updated",
					"<",
					new Date(Date.now() - 1000 * 60 * 60 * 24 * scraping_frequency),
				)
				.where("InstagramAccountBase.followers_count", ">", 5000)
				.where((oc) => /* ... filters ... */)
				.limit(2000)  // ❌ FETCHES 2,000 ROWS
				.execute(),
		),
);
```

---

### **1.5 fill-clone-task.ts - Line 40**
**File:** `backend/src/cloneTool/utils/fill-clone-task.ts`

```typescript
export function fillCloneTask(
	count: number,
	taskId: number,
	gender: "M" | "F",
	target_country: string | null,
) {
	if (count <= 0) return Effect.void;
	console.log(target_country);
	return pipe(
		Effect.promise(() =>
			db
				.selectFrom("InstagramAccountBase as b")
				.select(["b.id", "b.username", "b.ig_full_name"])
				.leftJoin("UsersToClone", "UsersToClone.ig_id", "b.id")
				.where("b.ai_bio_lang", "=", "DE")
				.where("b.ai_bio_lang_conf", ">=", 3)
				.where("b.gender", "=", gender)
				.where("b.gender_conf", ">=", 4)
				.where("b.bio", "is not", null)
				.where("b.bio", "!=", "")
				.where("b.posts_count", ">=", 5)
				.where("b.posts_count", "<=", 40)
				.where("b.followers_count", ">=", 50)
				.where("b.followers_count", "<=", 1000)
				.where("b.following_count", ">=", 50)
				.where("b.following_count", "<=", 1000)
				.where((eb) => /* ... filters ... */)
				.limit(Math.min(count, 15000))  // ❌ CAN FETCH UP TO 15,000 ROWS!
				.orderBy("b.clone_count", "asc")
				.orderBy("UsersToClone.createdAt", "asc")
				.execute(),
		),
		// ... rest of the code
	);
}
```

**Impact:**
- Can fetch up to 15,000 rows
- Very slow query with many WHERE conditions
- High memory usage

---

### **1.6 outreach.ts - Line 264**
**File:** `backend/src/api/outreach.ts`

```typescript
const accounts = await db
	.selectFrom("InstagramAccountBase")
	// ... many joins and filters ...
	.orderBy("InstagramAccountBase.created_at", "desc")
	.limit(2000)  // ❌ FETCHES 2,000 ROWS FOR API RESPONSE
	.execute();
```

**Impact:**
- API endpoint returns 2,000 rows
- Slow API response
- High memory usage
- No pagination for frontend

---

## 🔴 Issue 2: No Connection Pooling Configuration

### **Problem:** Connection pool uses default settings, which may not be optimal.

**File:** `backend/src/db/db.ts` - Lines 18-25

```typescript
export const pool = new Pool({
	host: env.DATABASE_HOST,
	port: 5432,
	user: env.DATABASE_USERNAME,
	password: env.DATABASE_PASSWORD,
	database: "igdb",
	idle_in_transaction_session_timeout: 120 * 1000,
	// ❌ MISSING CONFIGURATION:
	// - max: maximum number of clients in pool (default: 10)
	// - min: minimum number of clients in pool (default: 0)
	// - idleTimeoutMillis: how long a client can sit idle (default: 10000)
	// - connectionTimeoutMillis: how long to wait for connection (default: 0)
	// - statement_timeout: how long a query can run (not set)
});
```

**Impact:**
- Default pool size (10) may be too small for concurrent services
- No connection timeout configured
- No query timeout configured
- Can lead to connection exhaustion

**What's Missing:**
```typescript
export const pool = new Pool({
	host: env.DATABASE_HOST,
	port: 5432,
	user: env.DATABASE_USERNAME,
	password: env.DATABASE_PASSWORD,
	database: "igdb",
	idle_in_transaction_session_timeout: 120 * 1000,
	
	// ✅ SHOULD ADD:
	max: 20,  // Maximum connections in pool
	min: 5,   // Minimum connections to keep alive
	idleTimeoutMillis: 30000,  // Close idle clients after 30s
	connectionTimeoutMillis: 5000,  // Timeout after 5s
	statement_timeout: 30000,  // Query timeout 30s
});
```

---

## 🔴 Issue 3: Materialized Views Refresh Might Block Queries

### **Problem:** Materialized views refresh runs every 20 minutes and might block other queries.

**File:** `backend/src/db/refresh_views.ts` - Lines 6-30

```typescript
export const refreshViews = Effect.all([
	Effect.tryPromise(() =>
		sql`REFRESH MATERIALIZED VIEW CONCURRENTLY total_daily_count;`.execute(db),
	),
	Effect.tryPromise(() =>
		sql`REFRESH MATERIALIZED VIEW CONCURRENTLY leads;`.execute(db),
	),
	Effect.tryPromise(() =>
		sql`REFRESH MATERIALIZED VIEW CONCURRENTLY target_daily_counts;`.execute(
			db,
		),
	),
	Effect.tryPromise(() =>
		sql`REFRESH MATERIALIZED VIEW CONCURRENTLY ig_history_leads;`.execute(db),
	),
]);

export const refreshViewsCron = pipe(
	refreshViews,
	Effect.schedule(Schedule.cron("*/20 * * * *")),  // ❌ RUNS EVERY 20 MINUTES
	Effect.catchAllDefect((e) =>
		sendSlackMessageE(`defect in frefresh views ${e}`),
	),
	Effect.catchAll(Console.error),
);
```

**Issues:**
1. **CONCURRENTLY is good** - but still uses resources
2. **Runs every 20 minutes** - frequent refreshes
3. **No check if refresh is needed** - always refreshes
4. **No monitoring** - don't know if it's blocking
5. **All views refresh at once** - could stagger them

**Impact:**
- Uses database resources every 20 minutes
- Can slow down other queries during refresh
- No way to know if refresh is actually needed
- If one view fails, others still run (good) but no retry logic

**Better Approach:**
```typescript
// Check if refresh is needed (data changed since last refresh)
const needsRefresh = await db
	.selectFrom("pg_stat_user_tables")
	.where("relname", "=", "total_daily_count")
	.select("n_tup_upd", "n_tup_ins", "n_tup_del")
	.executeTakeFirst();

if (needsRefresh && (needsRefresh.n_tup_upd > 0 || needsRefresh.n_tup_ins > 0)) {
	// Only refresh if data changed
	await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY total_daily_count;`.execute(db);
}

// Stagger refreshes (don't run all at once)
// Refresh view1 at :00, view2 at :05, view3 at :10, etc.
```

---

## 🔴 Issue 4: No Query Optimization for Large Datasets

### **Problem:** Queries don't use indexes efficiently or have missing indexes.

### **4.1 Complex Joins Without Index Hints**

**File:** `backend/src/mining/InstagramDB.ts` - Line 42-78

```typescript
const getInitial = db_retry_effect(
	{ name: "GetInitialInstagramAccounts" },
	() =>
		db
			.selectFrom("InstagramAccountBase")
			.innerJoin(
				"RelatedAccounts",
				"RelatedAccounts.from_id",
				"InstagramAccountBase.id",
			)
			.innerJoin(
				"InitialInstagramAccount",
				"RelatedAccounts.to_username",
				"InitialInstagramAccount.username",
			)
			.where("InitialInstagramAccount.account_id", "is", null)
			.where("not_found", "=", false)
			.where("private", "=", false)
			.where((w) => /* complex OR conditions */)
			.groupBy("RelatedAccounts.to_username")
			.limit(2000)
			.select([/* ... */])
			.orderBy("count", "desc")
			.execute(),
);
```

**Issues:**
- **3 table joins** - can be slow
- **Complex WHERE with OR** - may not use indexes efficiently
- **GROUP BY** - requires sorting
- **ORDER BY count** - computed field, can't use index
- **No query plan analysis** - don't know if indexes are used

---

### **4.2 Multiple WHERE Conditions**

**File:** `backend/src/cloneTool/utils/fill-clone-task.ts` - Lines 20-40

```typescript
db
	.selectFrom("InstagramAccountBase as b")
	.select(["b.id", "b.username", "b.ig_full_name"])
	.leftJoin("UsersToClone", "UsersToClone.ig_id", "b.id")
	.where("b.ai_bio_lang", "=", "DE")
	.where("b.ai_bio_lang_conf", ">=", 3)
	.where("b.gender", "=", gender)
	.where("b.gender_conf", ">=", 4)
	.where("b.bio", "is not", null)
	.where("b.bio", "!=", "")
	.where("b.posts_count", ">=", 5)
	.where("b.posts_count", "<=", 40)
	.where("b.followers_count", ">=", 50)
	.where("b.followers_count", "<=", 1000)
	.where("b.following_count", ">=", 50)
	.where("b.following_count", "<=", 1000)
	.where((eb) => /* more conditions */)
	.limit(Math.min(count, 15000))
	.orderBy("b.clone_count", "asc")
	.orderBy("UsersToClone.createdAt", "asc")
	.execute()
```

**Issues:**
- **12+ WHERE conditions** - very complex query
- **Range queries** (>=, <=) - may not use indexes efficiently
- **NULL checks** - can be slow
- **Multiple ORDER BY** - requires sorting
- **No composite indexes** - each condition checked separately

**Missing Indexes (should check if these exist):**
```sql
-- Composite index for common query pattern
CREATE INDEX idx_clone_candidates ON "InstagramAccountBase" 
  (ai_bio_lang, gender, gender_conf, posts_count, followers_count, clone_count)
  WHERE ai_bio_lang = 'DE' AND gender_conf >= 4;

-- Index for range queries
CREATE INDEX idx_followers_range ON "InstagramAccountBase" (followers_count)
  WHERE followers_count BETWEEN 50 AND 1000;
```

---

### **4.3 No Query Timeout**

**Problem:** Long-running queries can block the database.

**Example:** The 50,000 row query in `detectLanguage.ts` has no timeout:

```typescript
const accounts = Effect.promise(() =>
	db
		.selectFrom("InstagramPost")
		// ... complex query ...
		.limit(50_000)  // ❌ NO TIMEOUT
		.execute(),
);
```

**Should be:**
```typescript
const accounts = Effect.promise(() =>
	db
		.selectFrom("InstagramPost")
		// ... query ...
		.limit(50_000)
		.execute()
		.then(result => {
			// Set statement timeout for this query
			return db.executeQuery({
				sql: 'SET statement_timeout = 30000', // 30 seconds
			}).then(() => result);
		})
);
```

---

## 📊 Summary of All Issues

| File | Line | Issue | Severity | Impact |
|------|------|-------|----------|--------|
| `recursive-import.ts` | 29 | `limit(5_000)` | High | Memory usage |
| `detectLanguage.ts` | 51 | `limit(50_000)` | **CRITICAL** | Can crash service |
| `findMissingCountires.ts` | 28 | `limit(5000)` | High | Memory usage |
| `InstagramDB.ts` | 24, 38, 69, 111 | `limit(2000)` x4 | Medium | Slow queries |
| `fill-clone-task.ts` | 40 | `limit(15000)` | High | Very slow query |
| `outreach.ts` | 264 | `limit(2000)` | Medium | Slow API |
| `db.ts` | 18-25 | No pool config | Medium | Connection issues |
| `refresh_views.ts` | 6-30 | No optimization | Low | Resource usage |
| Multiple | - | No query timeout | Medium | Can block DB |
| Multiple | - | Complex queries | Medium | Slow performance |

---

## ✅ Recommended Fixes

### **1. Implement Pagination**
```typescript
// Instead of limit(5000), use cursor-based pagination
const getPostsPaginated = (cursor: string | null, batchSize = 100) =>
	db
		.selectFrom("InstagramPost")
		.where("id", ">", cursor ?? "0")
		.orderBy("id", "asc")
		.limit(batchSize)
		.execute();
```

### **2. Configure Connection Pool**
```typescript
export const pool = new Pool({
	// ... existing config ...
	max: 20,
	min: 5,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 5000,
});
```

### **3. Add Query Timeouts**
```typescript
// Set timeout per query
await db.executeQuery({
	sql: 'SET statement_timeout = 30000',
});
```

### **4. Optimize Materialized Views**
```typescript
// Only refresh if needed
// Stagger refresh times
// Monitor refresh duration
```

### **5. Add Database Indexes**
```sql
-- Check existing indexes
SELECT * FROM pg_indexes WHERE tablename = 'InstagramAccountBase';

-- Add missing composite indexes
CREATE INDEX CONCURRENTLY idx_clone_candidates ON "InstagramAccountBase" 
  (ai_bio_lang, gender, gender_conf, posts_count, followers_count);
```




