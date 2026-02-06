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
- `fortuneteller_profiles` - name, headline, intro, rank, images, is_recommended
- `querent_profiles` - name, contact info, birthdate, zodiac, worry details, points
- `bank_info` - bank account details for fortunetellers
- `rooms` - chat rooms (fortuneteller_id + querent_id unique pair)
- `messages` - chat messages with sender, text, cost_pt, is_locked

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
- Profile tab: Edit fortuneteller name, headline, intro
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
