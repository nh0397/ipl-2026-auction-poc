# IPL Auction Hub: PoC (2026 season)

This repository is a **proof of concept** for a private IPL-style league: a small group of friends who care about cricket and wanted **one system** for the auction and for scoring, instead of running the league through **one Google Sheet**, chat, and third-party fantasy apps.

**How we worked before.** **Coordination lived in a single Google Sheet**: rosters, auction notes, and tracking all met there. Chat carried the side conversation, and fantasy apps (Dream11, My11Circle, and similar) were still where many of us checked **official** points, which rarely matched **our** house rules line for line. Keeping the sheet, the chat thread, and external apps in sync took **steady effort**: tying messages back to the right rows and reconciling scores against apps by hand.

**Why a PoC now.** The last few years of the **developer ecosystem** made it much more practical to wire this up in one place: managed **PostgreSQL**, hosted **authentication**, **realtime** subscriptions without running your own socket farm, solid **APIs** for cricket data, and **automation** in CI. We did not need a multi-month platform project to get a credible first version. We **quickly** put together this PoC so we could **run bidding and track scores throughout the season** in a single app, with room to harden it for **IPL 2026** and **four franchises**. A wider release or a commercial path is something we can explore **later** if it makes sense.

---

## Why we built this

We are **cricket enthusiasts** first: we love **living in the game** through the league, and the **excitement** of auction night and match week is what keeps us coming back. This app exists so we could **ease our own pain points** in one place instead of spreading the work across a sheet, chat, and other apps.

At a high level, we wanted:

- A **rule book** the **organizer** controls: set how points and league rules work so what you configure is what everyone plays under (a **what-you-see-is-what-you-get** feel for the rules).
- **Rosters and pools** built to feel **realistic**: group players into pools, then run a **real-time auction** where franchises **bid for players across those pools** with clear state for everyone in the room.
- **Real-time analytics** during and after the auction: visibility into your **purse**, and a **breakdown** of the **types of players** you have landed and how they map to **teams** (IPL squads), so strategy is visible, not buried in a cell.
- **Sign in with Google** so users do not need another password for this league: we **delegate identity to Google** and avoid storing or managing passwords ourselves (details below).
- After the hammer drops, **points and results** stay in the same app, **admins** can fix mistakes with an audit trail, and **everyone** can see what happened in a match without leaving the product.

We are **trialing** this PoC for **IPL 2026** and will keep iterating as we learn.

---

## What you can do with it (main features)

### Rules, rosters, and pools

- Configure league **rules** so the organizer defines how the season behaves; players see a clear picture of **what rules are in effect**.
- Build **rosters** and **player pools** so the auction mirrors a credible IPL-style setup before anyone raises a paddle.

### Real-time auction

- Run a **live auction** with **real-time bidding** across pools so franchises compete fairly and everyone sees the same state.
- Track **sold / unsold** status and squad composition without duplicating lists elsewhere.

### Analytics

- **Real-time** views of your **remaining purse** and how your spend breaks down.
- See how your picks **break down by player type** and **source team**, so you understand squad balance at a glance.

### Points after the auction

- Franchises can **enter and adjust match points** in the app (with sensible UX around drafts and saves).
- Data from matches can flow in from **automated jobs** so you are not always typing scorecards by hand.

### Match data & automation

- **CricAPI** is the **primary** source for fixtures and scorecard-style data in our pipeline.
- **ESPNcricinfo** is used as a **fallback** path (including scripted flows where we need HTML that APIs do not expose the same way).
- **GitHub Actions** run scheduled sync jobs so the database can stay updated without someone SSH-ing into a box at midnight.

### Roles & trust

- **Role-based access**: admins, participating players, and viewers see what they should.
- **Admins** can **override** movements or points when reality disagrees with automation, because sport is messy and software should be flexible.

### When the match ends

- Completed fixtures and **scoreboard-style views** help everyone see **what was posted** for a game, with a clear trail from raw data to points.

---

## Tech stack (high level)

| Layer | Choice |
|--------|--------|
| App | **Next.js** (App Router), **React**, **TypeScript** |
| UI | **Tailwind CSS**, **shadcn-style** components, **Lucide** icons |
| Backend / data | **Supabase** (PostgreSQL, auth, realtime where needed) |
| Charts | **Recharts** |
| Automation | **Python** scripts + **GitHub Actions** |
| Browser automation (where used) | **Playwright** |

Node **20+** is required (see `package.json` `engines`).

---

## Why these tools and technologies

**Next.js, React, and TypeScript.** We wanted a **single language** end to end in the app layer, **server and client components** where it helps, and a framework the team already knows. TypeScript catches a large class of bugs before runtime, which matters when auction state and roles touch many files.

**Supabase (PostgreSQL, Auth, Realtime).** A **real database** with **row-level security** fits a league: bids, players, and points are relational, and we can enforce who may insert or update what. **Auth** (including Sign in with Google via Supabase) avoids building login ourselves. **Realtime** sits on the same project so the auction room gets **live updates** without us operating a separate message broker or custom WebSocket service for v1.

**Tailwind and shadcn-style UI.** Fast iteration and **consistent spacing and components** across auction, scoreboard, and admin views, without a heavy bespoke design system for a PoC.

**Recharts.** Simple, React-friendly charts for standings and trends over the season.

**Python and GitHub Actions.** **CricAPI** sync, **ESPN** fallback scraping, and fixture helpers are easier to express as **scripts** that run on a schedule in **CI**, with secrets in the repo, than as long-lived servers. Python is a good fit for HTTP clients, parsing, and glue.

**Playwright.** Where ESPN pages need a **real browser** (dynamic content, or layouts the API path does not cover the same way), Playwright gives reliable automation. We use it **selectively**, not for every request.

Together, the stack favors **shipping a PoC quickly** while keeping a path to something more robust: Postgres remains the source of truth, and the web app stays a thin, typed client on top.

---

## Sign-in with Google: what it actually is

**Why not passwords in our database?** Storing usernames and passwords means **hashing**, **reset flows**, **breach surface**, and ongoing **security** work. **Sign in with Google** lets us **skip password storage entirely** for league members: Google authenticates the user, and Supabase gives our app a **session**. You keep using an account you already trust; we do not hold secrets that unlock your identity for this app.

People often say “Gmail login” or “Google APIs.” For this app, **you are not calling the Gmail API** to read email. Login uses **OAuth 2.0** (and the related **OpenID Connect** pieces Google exposes) so a user can prove they control a Google account.

**What happens in practice**

1. The landing page calls **Supabase Auth**: `signInWithOAuth({ provider: "google", ... })` (see `app/page.tsx`).
2. Supabase redirects the browser to **Google’s consent screen** (hosted by Google).
3. After the user approves, Google redirects back to your app at **`/auth/callback`** with an authorization code in the URL fragment or query, depending on flow. Supabase’s client completes the exchange and establishes a **session** (JWT-backed).
4. **`AuthProvider`** listens for `onAuthStateChange`, loads the row from **`profiles`** for that user id, and the UI uses **role** (Admin, Participant, Viewer, etc.).

**Where you configure Google (not usually in `.env` for the Next app)**

- **Google Cloud Console**: create an **OAuth 2.0 Client ID** (type “Web application”). You set **authorized redirect URIs** to Supabase’s callback URL (Supabase shows the exact URL in the dashboard).
- **Supabase Dashboard**: **Authentication**, then **Providers**, then **Google**. Paste Google’s **Client ID** and **Client secret** there. Supabase stores them server-side; your Next.js bundle only needs the **public** Supabase URL and **anon** key.

So: **OAuth 2.0** is the protocol name; **“Sign in with Google”** is the product experience; **Supabase Auth** is the broker that talks to Google and issues your app session. No Gmail API keys are required for login alone.

**Local dev**: add `http://localhost:3000` and `http://localhost:3000/auth/callback` (or whatever Supabase docs require) to Google OAuth allowed origins / redirect URIs as needed.

---

## Realtime bidding: what drives it

The auction room does **not** poll the database on a timer for every update. It uses **Supabase Realtime**: the browser opens a **RealtimeChannel** on top of a **long-lived connection** (in practice, **WebSockets**), which matches the mental model you may already have: **one duplex link that stays open**, so the server can **push** updates without the client asking again and again.

### How this lines up with WebSockets and “broadcast”

- **WebSocket-style connection**: the client and Supabase keep a **single persistent channel** open. Either side can send when something happens. That is why the UI can update **immediately** after a bid lands in the database.
- **Broadcast** (in Supabase’s API): your app sends a **small message** on the channel; the **Realtime server** delivers it to **every other subscriber** on that channel (fan-out). With **`self: false`**, the sender does not get a copy back, which avoids double-updating the same UI.

### What Supabase Realtime is driven by (three different mechanisms)

Realtime combines **three** behaviors. They are **not** all “the database pushing rows.”

**A. `postgres_changes`: when the database row really changed**

When you subscribe with **`postgres_changes`**, updates come from **actual writes** to **PostgreSQL** (inserts, updates, deletes). Someone saves a bid; the row exists; every subscribed client can learn about it.

**What is WAL (write-ahead log), in simple terms?**  
Postgres does not only store your tables. It also keeps an **ordered journal on disk** of **committed** changes. People call that journal the **WAL** (**write-ahead log**). Think of it as the database’s **ledger**: a line appears when a change is **final**. Supabase Realtime can **tap into that committed stream** (through its own infrastructure) so that **new lines in the ledger** become **events** your app receives. You do not need to operate WAL yourself; it is enough to know that **database writes** are the **source** of these events, not magic on the client.

So the **driver** for `postgres_changes` is: **normal saves** to the database (Supabase client, RPC, or scripts), then Realtime **notifying** subscribers who care about those tables.

In this app (`app/auction/page.tsx`), that means:

- **`auction_state`**: current lot, status, timer anchor (`started_at`), etc. When this row updates, every subscribed client applies the new state.
- **`bids`**: **`INSERT`** events when a bid row is committed, so bid history updates for everyone at once.
- **`players`**: sold / unsold / on-block changes for the player on the block.

**Authoritative state still lives in Postgres.** Realtime does not invent bids; it **delivers** what the database already recorded after commit.

**B. `broadcast`: messages your app sends, not database rows**

**`broadcast`** events are **not** read from Postgres’s journal. They are **messages** your code sends on the channel (for example `channel.send`). The Realtime server **fans them out** to other clients, similar to “**server sends to all the sockets**” on that topic. The **driver** is **your application** plus the Realtime service, not a SQL `INSERT`.

We use this for **fast coordination** that would be clumsy as extra rows:

- **`timer_reset`**: the database may hold `started_at`, and a broadcast can still nudge every clock to align **immediately** on all screens.
- **`bidding_start`**: short-lived **peer lock** (who is currently bidding) so two people do not double-submit in the same instant; timeouts clear the lock if something fails.
- **`out`**: quick pass-style notifications with a short on-screen message.

The channel uses **`broadcast: { self: false }`** so the sender does not receive their own broadcast when that would duplicate UI updates they already applied.

**C. `presence`: who is connected right now**

**Presence** tracks **who is connected**. Clients call **`channel.track({ presence: { key: profile.id } })`**. The Realtime service maintains **presence state** per channel and emits **`sync`** (and related) events when members join, leave, or refresh. The **driver** is **connection lifecycle** and **track payloads**, not SQL. The UI uses this to list **online user ids** in the auction room.

### End-to-end picture for the auction

1. **Writes** (bids, state, players) go to **PostgreSQL** through Supabase.
2. **`postgres_changes`** pushes those committed changes to all subscribers on `auction-room`.
3. **`broadcast`** adds **short-lived** UI signals (timers, locks, quick messages) **without** storing every nuance as a row.
4. **`presence`** answers “who is here right now?”

Together, that is what makes bidding feel **live**: the database stays the **source of truth**, and Realtime **propagates** both **data changes** and **coordination messages** in near real time.

**Channel name**: `auction-room` (see `app/auction/page.tsx`).

Other pages reuse the same idea on different channel names (for example `dashboard-updates`, `chat-room`, `rules-sync`) for their own tables or messages.

---

## Installation & local development

### Prerequisites

- **Node.js** ≥ 20  
- **npm** (or pnpm/yarn if you adapt commands)  
- A **Supabase** project with **Auth** (Google provider configured if you want Google login) and **Realtime** enabled for the tables you subscribe to  
- Optional: **Python 3** if you run `scripts/*.py` locally  
- **CricAPI** API key if you use CricAPI sync scripts  

### 1. Clone and install

```bash
git clone <your-repo-url>
cd Typescript
npm install
```

### 2. Environment variables (reference)

Create **`.env`** in the project root. For Python scripts, you can duplicate the same keys into **`scripts/.env`** or load the root `.env` from your shell. **Never commit real secrets** (add `.env` to `.gitignore`).

#### Next.js app (required for `npm run dev` / `build`)

These are read in `lib/supabase.ts`, `lib/supabase/client.ts`, and middleware:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (**Settings**, **API**). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public **anon** key. Safe to expose in the browser; RLS still applies. |

There are **no** `NEXT_PUBLIC_GOOGLE_*` variables in this repo for login: Google OAuth credentials live in the **Supabase Dashboard** (Google provider), not in the frontend env file.

#### Automation / scripts (Python and CI)

Used by `scripts/sync_scorecards_cricapi.py`, `scripts/sync_scorecards_espn.py`, `scripts/populate_fixtures_*.py`, `scripts/scraper_espn_playwright.py`, `scripts/migrate_icons.py`, `scripts/sync_engine.py`, etc.:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same project URL as the app. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Often used as fallback when service role is not set. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Service role** key: bypasses RLS. Use only in **server-side** scripts or CI secrets, never in client code. |
| `SUPABASE_ACCESS_TOKEN` | Some scripts accept this as an alternative to the service role key (see `os.getenv` chains in each script). |
| `CRICAPI_KEY` or `NEXT_PUBLIC_CRICAPI_KEY` | CricAPI subscription key for fixture/scorecard sync. |
| `CRICAPI_SCORECARD_SLEEP_SECONDS` | Optional throttle between CricAPI calls (default `1.0` in CricAPI script). |
| `ESPN_HEADLESS` | Optional: Playwright / ESPN scraper headless mode (see `sync_scorecards_espn.py`). |

**GitHub Actions**: store the sensitive keys as **repository secrets** and map them into the workflow env so scripts see the same names.

**Verify locally**: `grep -r "os.getenv\|process.env" scripts/ lib/` and match your `.env` to what each file expects.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Production build (optional)

```bash
npm run build
npm start
```

### 5. Other npm scripts

| Script | Purpose |
|--------|---------|
| `npm run lint` | ESLint |
| `npm run sync:fixtures` | TS fixture sync helper (see `scripts/sync-fixtures.ts`) |
| `npm run sync:auto` | Auto score sync entrypoint (see `scripts/auto-sync-scores.ts`) |

Python automation (scorecards, fixtures) is usually run from **GitHub Actions** or locally with `python` / `uv` depending on your setup. Check `.github/workflows` if present and the `scripts/` README comments.

---

## Database & migrations

Schema changes live under **`supabase/migrations/`**. Apply them with your usual Supabase workflow (CLI or dashboard). **Real league or player data is intentionally not checked into this repository**, so private rosters and keys stay out of git history. If you are setting up a fresh environment, coordinate with the project maintainer for **how to seed or sync** data in a way that works for your group.

---

## Screenshots and GIFs (optional)

We plan to add **screenshots** or short **GIFs** under `public/screenshots/` (for example):

- Auction room / bidding
- Standings, purse, and player breakdowns
- Fixtures & match detail

*(Assets will be linked here once they are ready.)*

---

## Credits & third-party data

This project **does not** claim any affiliation with the IPL, BCCI, or commercial fantasy operators. We’re a private league tool.

**Scores and fixtures at scale** would not have been manageable for us without the services and tools below. They are the backbone of how we **pull**, **verify**, and **refresh** match data instead of typing scorecards by hand every night.

We gratefully acknowledge:

- **[CricAPI](https://www.cricapi.com/)** (Cricket Data API): our **primary** pipeline for fixtures and scorecard-style JSON. Without it, the app would lose its first-class path from **API to database** for Indian Premier League and related data.
- **[ESPNcricinfo](https://www.espncricinfo.com/)**: public match pages and scorecards for **fallback** scraping, cross-checks, and human-readable verification when an API path is not enough. Cricket content and trademarks belong to their respective owners.
- **[Playwright](https://playwright.dev/)**: browser automation that lets our scripts interact with pages the way a user would, which matters wherever we need **dynamic HTML** or layouts that differ from a clean JSON response.
- **[GitHub Actions](https://github.com/features/actions)**: scheduled **CI** runs so sync jobs can fire on a timer without a dedicated server or someone remembering to run a script at midnight. Secrets stay in the repo settings; workflows keep the database **moving forward** with the season.

We also reference **[Cricket Data](https://cricketdata.org/)** for documentation and schedule context around formats and leagues (for example [Indian Premier League schedule (Cricket Data)](https://cricketdata.org/cricket-data-formats/schedule/indian-premier-league-2025-d5a498c8-7596-4b93-8ab0-e0efc3345312)).

Always respect **terms of service**, **rate limits**, and **robots** guidance for any site or API you call. This PoC is for a small group; production use would need legal review.

---

## Roadmap / future enhancements

1. **Configurable point system**: rules for fantasy points (batting, bowling, fielding, bonuses, multipliers) should be **data-driven** (database or config files) so when Dream11, My11Circle, or *your* house rules change, you adjust rules without a full redeploy.
2. **Player pools from an API**: load and refresh **auction pools** through a **proper API** where possible, instead of leaning on **scraping** sites like ESPN for roster construction. ESPN can remain useful for **verification** or fallback, but first-class pool data from an API would be cleaner and more stable.
3. **Richer game configuration**: more **flexibility** for how the league is set up (formats, caps, tie-breakers, visibility rules), so organizers can tune the product without code changes for every house rule.
4. **Many auctions, many groups**: support **multiple concurrent auctions** or a **multi-tenant** model so different people can run their own leagues **at the same time** with isolated data and admins, not a single shared namespace.
5. Richer **audit UI** for overrides and sync runs.
6. **Mobile-friendly** polish for auction night.
7. **Scale and hosting**: the notes in **Scaling and future vision** below cover **performance**, **multi-tenancy**, and moving from **free tiers** to **managed cloud** when the product outgrows hobby limits.
8. Whatever our four franchises ask for after IPL 2026.

---

## Scaling and future vision

This is already a strong foundation. The exciting part is that the same core ideas can support a bigger audience without changing what makes the product fun: clear rules, live auctions, and trusted scoring.

**Where it runs today.** This PoC is deployed on **generous free (or low-cost) tiers** that make it affordable to ship and iterate. In practice that usually means **Supabase** (PostgreSQL, Auth, Realtime), a Next.js host such as **[Vercel](https://vercel.com/)** (or a similar platform), and **[GitHub](https://github.com/)** for source control and **Actions**. We are **grateful** to these providers for the free tiers and the DX that made rapid iteration possible.

**How we scale it.** As usage grows, we can move the same architecture to **paid cloud plans** for reliability, performance, and compliance: stronger database capacity, regional hosting, autoscaling app instances, background workers for sync, and deeper observability.

Here are the most natural scale-up directions:

- **Multi-tenancy**: separate leagues or seasons with isolated data, billing, and admin roles, instead of one shared namespace (overlaps with roadmap item 4).
- **Performance and cost**: caching for read-heavy scoreboard pages, tighter **RLS** policies, and background workers for sync so spikes on auction night do not starve other work.
- **Product**: native or **PWA** polish for phones on auction night, richer **notifications**, and deeper **analytics** exports.
- **Operations**: formal **SLAs**, **backups**, and **observability** if strangers or paying organizers rely on the system.
- **Trust and compliance**: clearer **privacy** story for Google sign-in, data retention, and regional hosting if the audience spreads out.

---

## Contributing & support

This grew out of a **friends-and-cricket** league. Issues and PRs are welcome if the repo is shared; for a private league fork, coordinate with the maintainer.

---

## License

If no `LICENSE` file is present, assume **all rights reserved** until the authors add one.

---

*Built to move auction night and season scoring off a single shared sheet, with love for cricket. IPL 2026 PoC.*

This is a **humble attempt** at **mastering the art of problem solving**: turning a messy, human process into something clearer, calmer, and more fun for everyone at the table.
