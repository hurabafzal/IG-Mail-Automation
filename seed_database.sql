-- Seed script to populate the database for testing
-- This will add some initial Instagram usernames to get the mining flow started

-- Option 1: Add accounts to InitialInstagramAccount (for miner1)
-- Replace these with real Instagram usernames you want to mine
INSERT INTO "InitialInstagramAccount" (username, source_type, not_found, "private", created_at)
VALUES 
    ('cristiano', 'MANUAL', false, false, NOW()),
    ('leomessi', 'MANUAL', false, false, NOW()),
    ('selenagomez', 'MANUAL', false, false, NOW()),
    ('kyliejenner', 'MANUAL', false, false, NOW()),
    ('therock', 'MANUAL', false, false, NOW()),
    ('arianagrande', 'MANUAL', false, false, NOW()),
    ('beyonce', 'MANUAL', false, false, NOW()),
    ('kimkardashian', 'MANUAL', false, false, NOW()),
    ('jlo', 'MANUAL', false, false, NOW()),
    ('nickiminaj', 'MANUAL', false, false, NOW())
ON CONFLICT (username) DO NOTHING;

-- Note: Replace the usernames above with actual Instagram usernames you want to mine
-- These are just examples. The mining service will try to fetch their data from Instagram.




