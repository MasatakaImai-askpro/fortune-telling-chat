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
- GET/PATCH `/api/my_fortuneteller_profile` - Own profile management
- GET/PATCH `/api/my_bank_info` - Own bank info management
- GET `/api/my_rooms` - List chat rooms
- POST `/api/send_dm` - Send DM to fortuneteller

## WebSocket
- Connect to `/ws?room_id=X` or `/ws?fortuneteller_id=X`
- Message types: `history`, `new_message`, `room_init`, `chat_message`
- Message categories: `free`, `length_paying`, `healing`

## User Preferences
- Japanese UI (占いチャット theme)
- Dark mystical color scheme (deep navy/purple gradients)
- Fuchsia accent colors

## Recent Changes
- 2026-02-06: Complete migration from Django + separate Vite to Express + integrated Vite
- 2026-02-06: Removed old Django backend and separate frontend directories
- 2026-02-06: All 6 database tables created via SQL
