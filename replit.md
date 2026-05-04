# WhatsApp Monitor

## Overview

A full-stack web app that links a personal WhatsApp account via QR code scan and monitors all chats and messages in real time.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **WhatsApp**: whatsapp-web.js (via system Chromium)
- **Real-time**: WebSocket (ws)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Architecture

### Backend (`artifacts/api-server`)
- Express 5 API server with WhatsApp routes under `/api/whatsapp/*`
- WebSocket server at `/ws` for real-time events (QR updates, status changes, new messages)
- WhatsApp client managed in `src/lib/whatsapp.ts` using `whatsapp-web.js`
- System Chromium: `/nix/store/m7qi78k6711fpwnrm4r2kn4p3ga3jal9-ungoogled-chromium-123.0.6312.105/bin/chromium`
- Session persisted via LocalAuth in `.wwebjs_auth/`

### Frontend (`artifacts/whatsapp-monitor`)
- React + Vite app at `/`
- Pages: Status (QR link), Chats list, Chat message view, Stats overview
- `useWhatsapp()` hook handles WebSocket connection + polling fallback
- Dark green theme derived from WhatsApp brand identity

## API Endpoints

- `GET /api/whatsapp/status` — connection state
- `GET /api/whatsapp/qr` — QR code (data URL)
- `POST /api/whatsapp/logout` — disconnect account
- `GET /api/whatsapp/chats` — all chats
- `GET /api/whatsapp/chats/:chatId/messages` — messages in a chat
- `GET /api/whatsapp/stats` — overview stats

## WebSocket Events

- `{ type: "qr", qr, qrDataUrl }` — new QR code
- `{ type: "status", state, phoneNumber?, displayName? }` — connection state change
- `{ type: "message", message }` — new incoming/outgoing message

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
