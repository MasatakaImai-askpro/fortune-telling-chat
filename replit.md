# Fortune-Telling Chat Application (占いチャット)

## Overview
A fortune-telling chat application connecting querents (customers) with fortunetellers through real-time chat. Built with Express + Vite + React on a single port (5000), using PostgreSQL for data persistence and WebSocket for real-time messaging.

## Architecture
- **Backend**: Express.js with session auth (connect-pg-simple), WebSocket (ws library)
- **Frontend**: React 18 + wouter routing + TanStack Query + Tailwind CSS v3
- **Database**: PostgreSQL via Drizzle ORM with Neon serverless driver
- **Real-time**: Native WebSocket on `/ws` endpoint
- **Single port**: Express serves both API and Vite-processed frontend on port 5000

## Project Structure
```
server/
  index.ts        - Express server, WebSocket, session middleware
  routes.ts       - REST API endpoints
  storage.ts      - Database CRUD operations (IStorage interface)
  db.ts           - Drizzle ORM + Neon pool setup
  vite.ts         - Vite dev/prod serving middleware
shared/
  schema.ts       - Drizzle schema (6 tables), Zod insert schemas, types
client/
  index.html      - HTML entry point
  src/
    main.tsx      - React root
    App.tsx       - Router with wouter
    index.css     - Tailwind v3 directives + dark mystical theme CSS vars
    hooks/use-auth.tsx  - Auth context provider
    lib/queryClient.ts  - TanStack Query setup
    pages/
      top.tsx                    - Main page: advisor listing + chat
      querent-login.tsx          - Querent login
      fortuneteller-login.tsx    - Fortuneteller login
      querent-registration.tsx   - Querent registration
      fortuneteller-registration.tsx - Fortuneteller registration
      advisor-app.tsx            - Fortuneteller dashboard (chat, profile, bank)
```

## Database Tables
- `users` - email, password (bcrypt), role ("1"=querent, "2"=fortuneteller)
- `fortuneteller_profiles` - name, headline, intro, rank, images, is_recommended, style, divination_methods, regular_holidays, business_hours, long_intro
- `querent_profiles` - name, contact info, birthdate, zodiac, worry details, points
- `bank_info` - bank account details for fortunetellers
- `rooms` - chat rooms (fortuneteller_id + querent_id unique pair)
- `messages` - chat messages with sender, text, cost_pt, is_locked
- `subscriptions` - subscription records (querent_id, amount, status, start_date, end_date)

## API Routes
- POST `/api/user_login` - Login with email/password/role
- POST `/api/logout` - Logout
- GET `/api/get_login_info` - Current user info (null if not logged in)
- POST `/api/register_querent` - Register querent user + profile
- POST `/api/register_fortuneteller` - Register fortuneteller user + profile
- GET `/api/get_fortuneteller_profiles` - List all fortunetellers
- GET `/api/get_fortuneteller_all` - Get all advisors with tags array
- GET `/api/get_querent_info` - Get logged-in querent's profile info
- POST `/api/edit_querent_karte` - Update querent karte (Zod validated)
- POST `/api/edit_querent_info` - Update querent registration info (Zod validated)
- GET `/api/get_room` - Get existing chat room by fortuneteller ID
- GET/PATCH `/api/my_fortuneteller_profile` - Own profile management
- GET/PATCH `/api/my_bank_info` - Own bank info management
- GET `/api/my_rooms` - List chat rooms
- POST `/api/send_dm` - Send DM to fortuneteller
- GET `/api/all_querents` - List all querent profiles (fortuneteller auth required)
- POST `/api/send_bulk_message` - Send message to multiple querents (fortuneteller auth, max 150 chars)
- GET `/api/my_subscription` - Get active subscription status (querent auth)
- POST `/api/subscribe` - Start 20,000 yen/30-day subscription (querent auth)
- POST `/api/cancel_subscription` - Cancel active subscription (querent auth)

## WebSocket
- Connect to `/ws?room_id=X` or `/ws?fortuneteller_id=X`
- Message types: `history`, `new_message`, `room_init`, `chat_message`
- Message categories: `free`, `length_paying`, `healing`

## User Preferences
- Japanese UI (占いチャット theme)
- Dark mystical color scheme (deep navy/purple gradients)
- Fuchsia accent colors

## Top Page Features (top.tsx)
- Bottom navigation: Home / Advisors / Chat / Account (4 tabs)
- Home tab: Featured advisors, Overall ranking TOP10, Genre ranking, Favorites list
- Advisors tab: Search + full advisor list with fav/detail/chat actions
- Chat tab: Real-time WebSocket chat with point consumption confirmation modal, templates, file attachments
- Account tab: Plan/Registration/Karte sub-tabs with auto-save karte
- Favorites: localStorage persistence
- Genre chip filtering (恋愛/仕事/人間関係/金運/健康)
- Data fetching: TanStack Query for advisors and querent info

## Advisor Dashboard Features (advisor-app.tsx)
- Bottom navigation: Chat / Querent List / Profile / Bank (4 tabs)
- Chat tab: Room list with real-time WebSocket messaging
- Querent List tab: View all 30 querents, search/filter, multi-select, send bulk messages (150 char limit)
- Profile tab: Edit fortuneteller name, headline, intro, file upload for icon (1:1, 2MB) and banner (16:9-2:1, 5MB) images with client+server validation
- Bank tab: Edit bank account details

## Test Data
- 30 fortunetellers: fortune01@example.com ~ fortune30@example.com (password: Test1234)
- 30 querents: querent01@example.com ~ querent30@example.com (password: Test1234)
- Auto-seeded on first startup if database is empty

## Recent Changes
- 2026-02-06: Complete migration from Django + separate Vite to Express + integrated Vite
- 2026-02-06: Removed old Django backend and separate frontend directories
- 2026-02-06: All 6 database tables created via SQL
- 2026-02-06: Added new API endpoints (get_querent_info, edit_querent_karte, edit_querent_info, get_room, get_fortuneteller_all) with Zod validation
- 2026-02-06: Rewrote top.tsx with bottom navigation, favorites, ranking carousels, genre filtering, point consumption modal, account management
- 2026-02-06: Refactored data fetching to use TanStack Query with proper cache invalidation
- 2026-02-06: Added 30 fortuneteller + 30 querent test data seed, bulk message API, querent list tab in advisor dashboard
- 2026-02-06: Added subscription system (20,000 yen/30 days) with subscribe/cancel APIs, subscription tracking in DB, point-free chat when subscribed
- 2026-02-06: Added fortuneteller profile fields: style (6 options) and divination_methods (5 options, multi-select). Displayed on advisor listing cards and detail modal. Editable in fortuneteller profile settings.
- 2026-02-09: Added backfill for style/divination_methods on server startup for production DB sync
- 2026-02-09: Added fortuneteller profile fields: regular_holidays, business_hours, long_intro (10000 chars). Displayed on detail modal with icons. Editable in profile settings with banner/icon URL inputs.
- 2026-02-09: Implemented treatment (施術) message system: category+title fields on messages, 1char=10yen auto-cost, locked until querent unlocks via /api/unlock_message. Color-coded bubbles (free=emerald, paid=fuchsia, treatment=amber). Full-width Japanese input validation on all chat inputs.
- 2026-02-09: Added admin dashboard (/admin) with 3 tabs: ranking management (edit rank/featured status), transfer request approval (approve with scheduled date, auto-mark transferred), user management (search/filter/edit/delete). Admin role="9", admin user: admin@example.com (Test1234). Added transfer_requests table, subscription filter in querent list, 10 seed subscriptions.
- 2026-02-09: Implemented automatic ranking system based on 6-month revenue. 7 tiers: Bronze (30,000pt min), Silver (100,000pt), Gold (200,000pt), Platinum (500,000pt), Platinum+ (800,000pt), Diamond (1,200,000pt), Diamond+ (2,000,000pt). 50% cashable rate. Ranks auto-computed via computeRankFromRevenue(). Admin can only edit is_recommended flag; ranking tab shows revenue/cashable data.
- 2026-02-09: Added unread message badges. Messages track is_read_by_querent/is_read_by_fortuneteller booleans. New APIs: GET /api/unread_count, POST /api/rooms/:id/mark_read. Both querent and fortuneteller apps show red unread count badges on chat tabs (polled every 10s) and per-room badges in room lists. Messages auto-marked read via WebSocket mark_read events.
- 2026-02-09: Implemented image upload system: POST /api/upload_image (multer + sharp), validates aspect ratios (icon 1:1 ±0.1, banner 16:9-2:1), file size limits (icon 2MB, banner 5MB), converts to WebP, saves to /uploads/. Replaced URL text inputs with file upload buttons in profile settings with client-side validation and preview.
- 2026-02-09: Generated 5 sample icon + 5 sample banner images, backfillSampleImages() assigns them to all 30 fortuneteller profiles on startup.
- 2026-02-09: Complete color scheme overhaul from dark navy/purple/fuchsia to white + light pink + dark pink theme. Updated CSS variables in index.css and all pages (top.tsx, advisor-app.tsx, admin-app.tsx, all login/registration/password pages). New palette: white/pink-50 backgrounds, pink-600 primary buttons, pink-200 borders, gray-900/600/400 text hierarchy.
- 2026-02-09: Subscription members no longer consume points for paid/treatment messages. Client UI shows "サブスク会員無料" on unlock buttons. Server already skipped deduction; client now reflects this.
- 2026-02-09: Fortuneteller earns 2000pt bonus when first responding to a subscriber in a room with no fortuneteller messages in past 30 days. Stored in messages.bonus_pt column (separate from costPt). Revenue calculation includes bonusPt. Fortuneteller sees alert notification on bonus earned.
- 2026-02-09: Updated querent free message templates to 6 options: ご依頼よろしくお願いします / 鑑定お願いできますか？ / 施術をお願いできますか？ / 前回の続きからよろしくお願します / はい / 相談ありがとうございました
- 2026-02-09: Replaced 口座設定 tab with 振込申請 (withdrawal application) tab in fortuneteller dashboard. Features: bank account form (save), withdrawal application with full breakdown (1pt=1.5yen, floor decimals, -1000 yen fee), all-points-only withdrawal, points deducted upon application, application history with status badges. New APIs: GET /api/my_cashable, POST /api/apply_withdrawal, GET /api/my_withdrawals. Available points = cashable (from rank) - sum(past withdrawals).
- 2026-04-09: LINE-style chat room list in querent top.tsx: shows advisor icon, bold unread messages, time labels, "あなた: " prefix for querent's own last message. Chat header simplified (profile card removed, shows worry category summary instead). ※ footnote removed.
- 2026-04-09: Two subscription tiers: standard (¥20,000/30d, Platinum and below, 2000pt/advisor) and premium (¥50,000/30d, any rank, 2000pt for ≤Platinum, 5000pt for Platinum+). Subscription UI shows active plan name/type, buttons for each plan.
- 2026-04-09: Point purchase 6 tiers in account tab: ¥500/¥1,000/¥3,000/¥5,000/¥10,000/¥30,000 (3-column grid).
- 2026-04-09: Karte split into two sections (自分の情報 / お相手の情報) with partner fields: name, birthdate, zodiac_sign, birthplace, birthtime. Auto-saves on change.
- 2026-04-09: Treatment messages in advisor-app.tsx: removed text input, replaced with 6 point amount buttons (500/1000/2000/3000/5000/10000pt) + send button. No body text for treatment messages.
- 2026-04-09: Advisor profile: removed image upload buttons, replaced with read-only display and "管理者のみ変更可能" notice.
- 2026-04-09: Divination methods expanded to 10 options: タロット・オラクルカード, 四柱推命, 霊視・霊聴・オーラ, 手相, 占星術, 九星気学, チャネリング, ツインレイ鑑定, カウンセリング, その他.
