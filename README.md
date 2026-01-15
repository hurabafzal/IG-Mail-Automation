# Outreach

These are the main parts:
- a dashboard built with [remix](https://remix.run/) and [shadcn](https://ui.shadcn.com/docs)
- custom `server.ts` that merges the the remix server with an [Elysia](https://elysiajs.com/) API server (running version 0.8, so a little outdated)
- pm2 for deployment
- bun as the package manager and runtime for the services

### Database

The database is a [timescale DB](https://github.com/timescale/timescaledb) instance based on postgres 14. Currently, it's a 160GB database, most of the space is taken up by posts and post history. We store info on over 9.5 million instagram accounts. Should probably setup backups, but I haven't gotten around to it, especially considering it's size. 

migrations are done by changing the prisma schema in the `prisma` directory and doing `bun run db:push` to push the changes. types are automatically generated and dumped into `backend/src/db/db_types.ts`. 

For the actual queries, I use [Kysely](https://kysely.dev/), which is a type safe SQL query builder. There is a few materialized views that help with query speeds, those are manually typed in `views_schema.ts`. Even so, things are still pretty sluggish. 

### Deployment

currently everything is deployed on the same server as the database, using just [pm2](https://pm2.keymetrics.io/docs/usage/quick-start/)

if you look at the `ecosystem.config.cjs`, you'll notice that there are multiple "apps" being deployed:
- server - the main remix server + API 
- services - background tasks
- miner1 - puppeteer + proxy based instagram miner that mines for new instagram accounts
- miner2 - mines existing instagram accounts, to keep them up to date for outreach
- miner3 - mines smaller german accounts for cloning.

### API

all API routes can be found in `backend/src/api`, and they're aggregated together in `backend/src/api/app.ts`. It's very similar to express.js

on the client side, the APIs are consumed with the sdk found in `app/services/api.ts`

### Instagram Miner

in `backend/src/mining`, you'll find code for instagram mining, both with `HikerAPI`, and through a puppeteer based scraper. 

you can use the web instagram scraper by calling `browser_mine_web_profiles` with a list of instagram usernames. Note that this returns an [Effect](https://effect.website/docs/getting-started/the-effect-type/), you should look at where it's used to learn how to use it properly. 

### Gmail Labels

There is certain actions that trigger when an email is labeled in gmail. We poll gmail for new emails with labels every 3 minutes, this is handled in `backend/src/gmail/emails/cron.ts`. This part of the code, including the custom pipedrive client use the Effect library very heavily, so they're a bit hard to understand if you're not familiar with it. 

The gist of it is that if an email has the Pipedrive label, it's imported to pipedrive, and if it gets the Blacklist label, we add it to the instantly blacklist, and blacklist everything that seems related to it in the database. 


### Email Outreach

Our new outreach system generates emails with an LLM. You can find the entry point for that in `backend/src/triggers/index.ts`. 


## Authentication

- **Google OAuth** via [Lucia](https://lucia-auth.com/) and `@lucia-auth/oauth`
- Only whitelisted emails or `@startviral.de` domain can log in.
- Session management via Postgres tables (`user`, `user_session`, `user_key`).
- CSRF protection enabled in production.
- See `backend/src/lucia.ts` and `backend/src/api/auth.ts` for details.

#### Appendix: full file tree

```
├── app
│   ├── components
│   │   ├── CountsPerDayChart.tsx
│   │   ├── EmailDistribution.tsx
│   │   ├── mode-toggle.tsx
│   │   ├── outreach
│   │   │   ├── columns.tsx
│   │   │   ├── data-table.tsx
│   │   │   └── edit-form.tsx
│   │   ├── triggers
│   │   │   └── TriggerLogs.tsx
│   │   └── ui
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── checkbox.tsx
│   │       ├── command.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── form.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── popover.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── sonner.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       └── textarea.tsx
│   ├── entry.client.tsx
│   ├── entry.server.tsx
│   ├── lib
│   │   ├── formatZipFilename.ts
│   │   └── utils.ts
│   ├── root.tsx
│   ├── routes
│   │   ├── _app.approve.tsx
│   │   ├── _app.clone.tsx
│   │   ├── _app.dashboard.overview.tsx
│   │   ├── _app.dashboard.tsx
│   │   ├── _app.email.settings.tsx
│   │   ├── _app.mine.tsx
│   │   ├── _app.triggers.tsx
│   │   ├── _app.tsx
│   │   ├── _index.ts
│   │   ├── login.tsx
│   │   └── logout.tsx
│   ├── services
│   │   ├── api.ts
│   │   └── env.server.ts
│   ├── sessions.server.tsx
│   └── tailwind.css
├── backend
│   └── src
│       ├── api
│       │   ├── app.ts
│       │   ├── auth.ts
│       │   ├── clone.api.ts
│       │   ├── dashboard.ts
│       │   ├── mine.api.ts
│       │   ├── outreach.ts
│       │   └── triggers.ts
│       ├── backend-only.ts
│       ├── cache
│       │   ├── caches
│       │   │   ├── ig_req_count.ts
│       │   │   └── settings.ts
│       │   └── index.ts
│       ├── cloneTool
│       │   ├── clone.controller.ts
│       │   ├── clone.service.ts
│       │   └── utils
│       │       ├── download-pfp.ts
│       │       ├── error-formatter.ts
│       │       ├── fill-clone-task.ts
│       │       ├── gpt-qualifier.ts
│       │       ├── gpt-variation.ts
│       │       └── random-variation.ts
│       ├── db
│       │   ├── db_types.ts
│       │   ├── db.ts
│       │   ├── index.ts
│       │   ├── refresh_views.ts
│       │   └── views_schema.ts
│       ├── env.ts
│       ├── export.ts
│       ├── followups
│       │   ├── followup-manager.ts
│       │   ├── index.ts
│       │   ├── README.md
│       │   └── run-followup-generation.ts
│       ├── gmail
│       │   ├── auth
│       │   │   ├── auth.test.ts
│       │   │   ├── oAuthFlow.ts
│       │   │   └── services.ts
│       │   ├── autoforwarding
│       │   │   ├── filters.ts
│       │   │   ├── import.csv
│       │   │   ├── importExistingRules.ts
│       │   │   ├── index.ts
│       │   ├── emails
│       │   │   ├── aggregator.test.ts
│       │   │   ├── blacklist.ts
│       │   │   ├── cron.ts
│       │   │   ├── findEmails.ts
│       │   │   ├── getCandidate.ts
│       │   │   ├── getMessage.ts
│       │   │   └── updateCandidates.ts
│       ├── legacy-triggers
│       │   ├── bitmap.ts
│       │   ├── delete-completed-leads.cron.ts
│       │   ├── mixmax_helpers.ts
│       │   ├── sync-stats.cron.ts
│       │   ├── types.ts
│       │   └── vars.ts
│       ├── lucia-types.d.ts
│       ├── lucia.ts
│       ├── mining
│       │   ├── browser
│       │   │   ├── browserLayer.ts
│       │   │   ├── browserResource.ts
│       │   │   ├── requestDuplicator.ts
│       │   │   └── switchPage.ts
│       │   ├── emailVerification.ts
│       │   ├── hiker_api_schemas.ts
│       │   ├── HikerAPI.ts
│       │   ├── InstagramDB.ts
│       │   ├── instagramMiner
│       │   │   ├── commentedOnGermanAccounts.ts
│       │   │   ├── findMissingCountires.ts
│       │   │   ├── instagramMiner1.ts
│       │   │   ├── instagramMiner2.ts
│       │   │   ├── instagramMiner3.ts
│       │   │   ├── mineCloneAccounts.ts
│       │   │   ├── mineComments.ts
│       │   │   ├── mineExistingAccounts.ts
│       │   │   ├── mineNewAccounts.ts
│       │   │   ├── minePublicEmails.ts
│       │   │   ├── mineUsernamesFromID.ts
│       │   │   ├── mineWebProfiles.ts
│       │   │   ├── schema.ts
│       │   │   └── web_profile.test.ts
│       │   ├── manual-mining.ts
│       │   ├── ML
│       │   │   ├── cat.ts
│       │   │   ├── detectLanguage.ts
│       │   │   ├── phi.ts
│       │   │   └── runpod.ts
│       │   ├── recursive-import.ts
│       │   └── updateOutdatedAccounts.ts
│       ├── pipedrive
│       │   ├── index.ts
│       │   ├── objects
│       │   │   ├── candidate.ts
│       │   │   ├── deal.schema.ts
│       │   │   ├── deal.ts
│       │   │   ├── mailbox.schema.ts
│       │   │   ├── mailbox.ts
│       │   │   ├── note.schema.ts
│       │   │   ├── note.ts
│       │   │   ├── person.schema.ts
│       │   │   └── person.ts
│       │   ├── types.ts
│       │   ├── updateWrongPipedriveDeal.ts
│       │   ├── updateWrongPipedrivePerson.ts
│       │   └── utils.ts
│       ├── proxy
│       │   └── DelayedRequestsCron.ts
│       ├── stripe
│       │   └── index.ts
│       ├── triggers
│       │   ├── email-generation-worker.ts
│       │   ├── index.ts
│       │   ├── instantly-sender.ts
│       │   ├── prompt-manager.ts
│       │   ├── refresh-instagram-accounts.ts
│       │   ├── sync-stats.cron.ts
│       │   └── vars.ts
│       └── utils
│           ├── async-pool.ts
│           ├── chunkArray.ts
│           ├── consts.server.ts
│           ├── consts.ts
│           ├── daysAgo.ts
│           ├── filterSchema.ts
│           ├── image-utils.ts
│           ├── infinite_loop_effect.ts
│           ├── object.ts
│           ├── sanatize.ts
│           ├── shuffleList.ts
│           ├── slack.ts
│           ├── string-utils.ts
│           └── types.ts
├── biome.json
├── bun.lockb
├── components.json
├── docker-compose.yml
├── ecosystem.config.cjs
├── package.json
├── prisma
│   ├── Clone.prisma
│   ├── Email.prisma
│   ├── Gmail.prisma
│   ├── hyper.sql
│   ├── Instagram.prisma
│   ├── Instantly.prisma
│   ├── OpenAI.prisma
│   ├── schema.prisma
│   └── Sequences.prisma
├── public
│   └── favicon.ico
├── README.md
├── remix.config.js
├── remix.env.d.ts
├── scripts
│   ├── import-accounts-to-email-sequence.ts
│   ├── instagram-mining-results.csv
│   ├── instantly-blacklist-existing-blacklist.ts
│   ├── phi.ts
│   ├── runCat.ts
│   ├── runFindMissedPublicEmails.ts
│   ├── runFindMissingCountries.ts
│   ├── runManualBlacklist.ts
│   ├── runRecursive.ts
│   ├── runUpdateOutdated.ts
│   ├── sync-leads.ts
│   └── tool.py
├── server.ts
├── services.ts
├── tailwind.config.ts
├── tsconfig.eslint.json
├── tsconfig.json
└── types.d.ts

```
# IG-Mail-Automation
