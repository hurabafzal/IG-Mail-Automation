# How to Populate Your Database

Since your database is empty, here are **3 ways** to populate it and start the mining flow:

## Method 1: Use the Frontend `/mine` Page (Easiest - Recommended)

1. **Start your services:**
   ```bash
   bun run services.ts
   ```

2. **Start your frontend** (in another terminal):
   ```bash
   bun run dev
   ```

3. **Go to the mining page:**
   - Open `http://localhost:3000/mine` in your browser
   - Click "New Task"
   - Enter a title (e.g., "Initial Seed Batch")
   - Paste Instagram usernames (one per line), for example:
     ```
     cristiano
     leomessi
     selenagomez
     kyliejenner
     therock
     ```
   - Click "Submit"

4. **Watch the terminal** - You'll see `ManualMiningService` processing the accounts:
   ```
   [1/5] cristiano - { followers_count: 500000000, ... }
   ```

5. **Check progress:**
   - Refresh `/mine` page to see processed/public/private counts
   - Go to `/dashboard` to see total accounts mined

## Method 2: Use SQL Script (Direct Database Insert)

1. **Edit `seed_database.sql`** and replace the example usernames with real Instagram usernames

2. **Run the SQL script:**
   ```bash
   # If using psql
   psql -U your_username -d igdb -f seed_database.sql
   
   # Or connect to your database and run:
   # \i seed_database.sql
   ```

3. **Start miner1:**
   ```bash
   bun run start:miner1
   ```

## Method 3: Use the API Directly

You can also use the API endpoint directly:

```bash
curl -X POST http://localhost:3000/api/mine/new \
  -H "Content-Type: application/json" \
  -H "Cookie: your_auth_cookie" \
  -d '{
    "title": "Initial Seed",
    "usernames": "cristiano\nleomessi\nselenagomez"
  }'
```

## What Happens After Seeding?

Once you add accounts:

1. **ManualMiningService** (if using `/mine` page) will:
   - Fetch profile data from Instagram
   - Save to `InstagramAccountBase`
   - Find related accounts (suggested accounts)
   - Add related accounts to `InitialInstagramAccount` for further mining

2. **recursiveImportCron** (if you have posts) will:
   - Mine comments from existing posts
   - Find new accounts from commenters
   - Add them to the database

3. **CloneService** will:
   - Find accounts matching clone task criteria
   - Process them for cloning

## Recommended Flow for Testing

1. **Start services:**
   ```bash
   bun run services.ts
   ```

2. **Add 5-10 accounts via `/mine` page** (use real Instagram usernames)

3. **Wait for them to be processed** (check terminal logs)

4. **Check `/dashboard`** to see accounts being added

5. **Create a clone task** at `/clone` to test the full flow

6. **Watch the magic happen!** 🎉

## Tips

- Use **real, public Instagram usernames** (not private accounts)
- Start with **5-10 accounts** to test
- Accounts with many followers (7k-100k) work best for the clone service
- German accounts (`ai_bio_lang = 'DE'`) are prioritized for cloning




