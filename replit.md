# Fortune-Telling Chat Application (占いチャット)

## Overview
A fortune-telling chat application enabling real-time chat between querents (customers) and fortunetellers. The platform aims to provide a seamless and engaging experience for both parties, facilitating spiritual guidance and connection. Key capabilities include real-time messaging, subscription management, fortuneteller profile customization, and an administrative dashboard for system oversight.

## User Preferences
- Japanese UI (占いチャット theme)
- White + light pink + dark pink theme. New palette: white/pink-50 backgrounds, pink-600 primary buttons, pink-200 borders, gray-900/600/400 text hierarchy.

## System Architecture
The application is built with Express.js, React, and PostgreSQL, leveraging a single-port architecture (5000) for both API and frontend. Real-time communication is handled via Native WebSockets.

**Technical Implementations:**
- **Backend**: Express.js with session authentication (`connect-pg-simple`) and `ws` for WebSockets.
- **Frontend**: React 18 with `wouter` for routing, `TanStack Query` for data fetching, and `Tailwind CSS v3` for styling.
- **Database**: PostgreSQL managed with Drizzle ORM and Neon serverless driver.
- **Real-time**: Native WebSocket on the `/ws` endpoint for chat and notifications.
- **User Authentication**: Email/password authentication with `bcrypt` for password hashing.
- **Image Uploads**: `multer` and `sharp` for server-side image processing, including validation (aspect ratio, size) and conversion to WebP.
- **Payment Processing**: Integration with Stripe for point purchases and subscription management.

**Feature Specifications:**

**Core Chat Functionality:**
- Real-time WebSocket chat with various message categories: `free`, `length_paying`, `healing`.
- Point consumption system for paid messages, with confirmation modals.
- Treatment messages with selectable point amounts and optional titles.
- Subscription-based chat: querents can subscribe for point-free communication within a 5-advisor slot limit.
- Unread message badges and notifications for both querents and fortunetellers.
- Advisor-specific chat templates for quick responses.

**Querent Features:**
- Advisor listing with search, filtering (genre chips), ranking, and favorites.
- Detailed advisor profiles with images, long introductions, business hours, and divination methods.
- Account management: profile editing (`karte`), point purchase (6 tiers), and subscription management (standard/premium tiers).
- LINE-style chat room list with advisor icons and unread indicators.

**Fortuneteller Features:**
- Dashboard with chat room list, querent list, profile management, and withdrawal application.
- Profile customization: headline, introduction, images (managed by admin), regular holidays, business hours, divination methods (10 options).
- Menu and template settings for chat interactions.
- Bulk messaging to querents (150 char limit).
- Withdrawal application system with point conversion rates, fees, and history.
- Automatic ranking system based on 6-month revenue (Bronze to Diamond+ tiers).

**Admin Features:**
- Admin dashboard with tabs for ranking management (edit rank/featured status), transfer request approval, user management (search/filter/edit/delete), and image management.
- Ability to upload/change fortuneteller icon and banner images.

**UI/UX Decisions:**
- Japanese UI with a "占いチャット" theme.
- Modern, clean design using Tailwind CSS.
- Responsive mobile-first approach for all interfaces.
- Dark mystical color scheme for initial design, later updated to a white + light pink + dark pink theme.

**Data Models (Drizzle ORM):**
- `users`: Stores user credentials and roles.
- `fortuneteller_profiles`: Detailed profiles for fortunetellers, including service offerings and scheduling. Fields: `genre` (single select from SAMPLE_GENRES), `style` (text[] multi-select), `divination_methods` (max 3 selections).
- `querent_profiles`: Querent personal information and consultation preferences. Note: `tel_number` and `postal_code` fields have been removed from both DB and UI.
- `bank_info`: Fortuneteller bank details for payouts.
- `rooms`: Manages chat room associations between querents and fortunetellers.
- `messages`: Stores chat message content, sender, cost, and lock status.
- `subscriptions`: Records querent subscription details.
- `transfer_requests`: Manages withdrawal requests from fortunetellers.

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Neon**: Serverless driver for PostgreSQL.
- **Stripe**: Payment gateway for point purchases and subscription payments.
- **bcrypt**: For password hashing.
- **ws**: WebSocket library for real-time communication.
- **multer**: Middleware for handling `multipart/form-data`, primarily for file uploads.
- **sharp**: High-performance Node.js image processing library.
- **TanStack Query**: For efficient data fetching, caching, and state management in the frontend.
- **wouter**: A minimalistic React hook-based router.
- **Tailwind CSS v3**: Utility-first CSS framework for styling.
- **Zod**: Schema declaration and validation library for API request bodies.