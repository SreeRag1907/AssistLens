# AssistLens — Complete System Architecture
## From Problem Statement to Working Solution

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [Our Solution](#2-our-solution)
3. [The Big Picture — How Everything Connects](#3-the-big-picture--how-everything-connects)
4. [Technology Choices and Why](#4-technology-choices-and-why)
5. [The Database — Where Data Lives](#5-the-database--where-data-lives)
6. [How Login and Security Works](#6-how-login-and-security-works)
7. [How a Video Call Works (Step by Step)](#7-how-a-video-call-works-step-by-step)
8. [How Chat Works](#8-how-chat-works)
9. [How File Sharing Works](#9-how-file-sharing-works)
10. [How Recording Works](#10-how-recording-works)
11. [How Reconnect (Disconnect Recovery) Works](#11-how-reconnect-disconnect-recovery-works)
12. [How the Admin Dashboard Works](#12-how-the-admin-dashboard-works)
13. [Background Jobs (What Runs Automatically)](#13-background-jobs-what-runs-automatically)
14. [The Invite Link System](#14-the-invite-link-system)
15. [WebRTC Explained Simply](#15-webrtc-explained-simply)
16. [Challenges We Faced and How We Solved Them](#16-challenges-we-faced-and-how-we-solved-them)
17. [Production Infrastructure Map](#17-production-infrastructure-map)

---

## 1. The Problem

### What the hackathon asked us to build

> "Build a real-time video support platform where a customer can get help from a support agent over live video — without installing any app, without using Twilio/Zoom/Google Meet, and where the video must go through **your own server**."

### Breaking that down simply

Imagine a customer calls a bank helpline. Instead of just voice, they need to show the agent their screen or face on live video. Currently this means:

- Downloading Zoom / Google Meet
- Creating an account
- Sharing a long confusing link
- Trusting a third-party company with your video

**The challenge was:**
- No app install for the customer
- No third-party video service (no Zoom API, Twilio, Daily.co, etc.)
- Video must go through YOUR server — not browser-to-browser directly
- Agent manages sessions, customer just clicks a link

---

## 2. Our Solution

**AssistLens** = A web platform where:

1. **Agent** logs in, creates a session, gets a short link (`/j/abc12345`)
2. **Agent** shares that link to the customer via SMS, WhatsApp, or email
3. **Customer** clicks link on any phone/laptop browser — no download, no account
4. Customer sees a camera preview, clicks Join
5. Both are on live video — with chat, file sharing, and recording
6. Agent ends the session when done
7. Full history (transcript, participants, recording) saved forever

**Key rule we followed:** Video never goes browser-to-browser. It always goes through **our own LiveKit server** on Railway.

---

## 3. The Big Picture — How Everything Connects

```
BROWSERS (no app install)
┌─────────────────────────────────────────────────┐
│  Agent Console    Admin Dashboard    Customer   │
│  (laptop/PC)      (laptop/PC)        (/j/code)  │
└──────────┬────────────┬────────────────┬────────┘
           │            │                │
           ▼            ▼                ▼
    ┌──────────────────────────────────────────┐
    │         Vercel (Web App - React)         │
    │         https://assist-lens.vercel.app   │
    └───────────────────┬──────────────────────┘
                        │ REST API calls (HTTP)
                        ▼
    ┌──────────────────────────────────────────┐
    │      Render (Fastify API - Node.js)      │
    │      https://assistlens-api.onrender.com │
    └──────┬─────────────┬───────────┬─────────┘
           │             │           │
           ▼             ▼           ▼
    Supabase       LiveKit      MinIO Storage
    (Postgres)    (Railway)    (Railway)
    Sessions,     Video/Audio  Files + MP4
    Chat, Events  Routing      Recordings
```

**What each piece does in one line:**
- **Vercel** → shows the website to users
- **Render API** → the brain: login, create sessions, issue tokens, save chat
- **Supabase** → remembers everything permanently (database)
- **LiveKit** → routes live video/audio between agent and customer
- **MinIO** → stores uploaded files and recorded MP4 videos

---

## 4. Technology Choices and Why

### Frontend (what users see)

| Technology | What it is | Why we used it |
|-----------|------------|----------------|
| **React 18** | UI library — builds interactive web pages | Standard, fast for dashboards and real-time screens |
| **TypeScript** | JavaScript with type safety | Catches bugs before they happen; safer code |
| **Vite** | Build tool and dev server | Extremely fast during development |
| **Tailwind CSS** | CSS utility classes | Quick consistent styling without writing much CSS |
| **livekit-client** | LiveKit's browser SDK | Handles all the WebRTC complexity (camera, mic, data channel) |

### Backend (the API server)

| Technology | What it is | Why we used it |
|-----------|------------|----------------|
| **Node.js** | Runs JavaScript on the server | Same language as frontend |
| **Fastify** | HTTP web framework | Faster and lighter than Express; built-in schema validation |
| **TypeScript** | Type-safe JavaScript | Same reason as frontend |
| **Zod** | Schema validation library | Validates all incoming request data before touching the database |
| **bcryptjs** | Password hashing | Safely stores passwords — never plain text |
| **jsonwebtoken** | JWT library | Creates and verifies login tokens |
| **pg** | PostgreSQL client | Talks to the Supabase Postgres database |

### Infrastructure

| Service | Role | Why |
|---------|------|-----|
| **Vercel** | Hosts the React website | Free HTTPS, instant deploy from GitHub |
| **Render** | Hosts the API server as a Docker container | Always-on process, easy env vars |
| **Supabase** | Managed PostgreSQL cloud database | Free tier, no server to manage |
| **Railway (LiveKit)** | Runs the LiveKit video SFU | WebRTC needs real TCP ports; Railway supports that |
| **Railway (MinIO)** | Self-hosted S3 file storage | For recordings and chat files you control |
| **Railway (Redis)** | Fast in-memory store | LiveKit + Egress need shared coordination |
| **Railway (Egress)** | LiveKit recording service | Records calls and uploads MP4 to MinIO |

---

## 5. The Database — Where Data Lives

We use **PostgreSQL** (hosted on **Supabase**). Here are all the tables:

### `agents` — Support staff accounts
```
id            → unique ID (UUID)
email         → login email
password_hash → bcrypt-hashed password (never plain text)
is_admin      → true for admin dashboard users
created_at    → when account was made
```

### `sessions` — One support session = one call
```
id          → unique session ID
agent_id    → which agent owns this session
room_name   → LiveKit room name (e.g. "room_abc123")
invite_code → short code for the link (e.g. "xk9m2pqa")
title       → optional session title
status      → 'active' or 'ended'
created_at  → when agent created it
ended_at    → when it was ended
ended_by    → who ended it (agent identity)
```

### `participants` — Who joined each session
```
id           → unique ID
session_id   → which session
role         → 'agent' or 'customer'
identity     → unique string (e.g. "agent-abc" or "customer-xyz")
display_name → name shown in call
joined_at    → when they entered
left_at      → when they left (NULL if still in call)
grace_until  → reconnect deadline (explained in section 11)
```

**Key design:** A participant is "present" if `left_at IS NULL`. This is our source of truth — not LiveKit's state.

### `events` — Audit log of everything that happened
```
id         → unique ID
session_id → which session
type       → event name: 'joined', 'left', 'disconnected', 'reconnected',
             'duplicate_join', 'recording_started', 'recording_stopped',
             'recording_ready', 'session_ended', 'room_finished'
identity   → who triggered it
metadata   → extra JSON data (grace_seconds, role, etc.)
created_at → exact timestamp
```

This table is shown in the Admin Dashboard as the full event audit trail.

### `chat_messages` — Text messages during the call
```
id              → unique ID
session_id      → which session
sender_identity → who sent it
sender_role     → 'agent' or 'customer'
sender_name     → display name
body            → the message text
created_at      → timestamp
```

### `recordings` — Video recording status
```
id         → unique ID
session_id → which session
egress_id  → LiveKit Egress job ID
status     → 'in_progress' → 'processing' → 'ready' (or 'failed')
object_key → path in MinIO (e.g. "room_abc/1718200000.mp4")
created_at → when recording started
updated_at → last status change
```

### `chat_files` — Files uploaded during chat
```
id              → unique ID
session_id      → which session
sender_identity → who uploaded
sender_name     → display name
file_name       → original file name
file_size       → bytes
content_type    → MIME type (e.g. "application/pdf")
object_key      → path in MinIO (e.g. "session-id/uuid-file.pdf")
created_at      → when uploaded
```

---

## 6. How Login and Security Works

We have **three separate roles**, each with different access:

```
Agent     → /api/auth/login          → gets Agent JWT
Admin     → /api/auth/admin/login    → gets Admin JWT
Customer  → no login, uses invite code → gets scoped Invite JWT
```

### What is a JWT (JSON Web Token)?

Think of it like a **wristband at an event**:
- When you login, the API gives you a signed wristband (JWT token string)
- You send this wristband with every request
- The API reads it to know who you are and what you're allowed to do
- It expires after 12 hours — then you must login again

```
Agent JWT contains:
  sub   → agent's database ID
  email → agent's email
  role  → "agent"
  exp   → expiry timestamp

Admin JWT contains:
  sub   → admin's database ID
  email → admin's email
  role  → "admin"
```

### How agent login works (step by step)

1. Agent enters email + password on the login page
2. Browser sends `POST /api/auth/login` with email + password
3. API looks up the agent in the `agents` table by email
4. API uses **bcrypt** to compare the submitted password against the stored hash
5. If it matches → API creates a JWT and sends it back
6. Browser stores the JWT in `localStorage`
7. Every future API call includes `Authorization: Bearer <token>` in the header

### How passwords are stored safely

We never store plain passwords. When a password is created:
```
"demo-agent-pass"  →  bcrypt hash  →  "$2a$10$XJnP2k..."
```

bcrypt is a one-way function. You can't reverse it. To verify, you hash again and compare.

### How the invite link system protects the customer route

When a customer joins, they don't login. Instead:
1. They present an **invite code** (`xk9m2pqa`)
2. API checks the code exists in the `sessions` table
3. If session is active → API creates two things:
   - A **LiveKit token** (lets them join the video room)
   - An **Invite JWT** (lets them send chat messages and files during the session)

The Invite JWT is scoped — it only works for that one session ID. It can't access other sessions.

### Route protection (guards)

```
requireAgent(req)    → verifies JWT has role='agent'; returns agent info or sends 403
requireAdmin(req)    → verifies JWT has role='admin'; returns admin info or sends 403
resolveParticipant() → accepts EITHER an agent JWT (must own session)
                       OR an invite JWT (must match session ID)
```

---

## 7. How a Video Call Works (Step by Step)

This is the most important part. Understanding this requires understanding **WebRTC** and **SFU** first.

### What is WebRTC?

**WebRTC** (Web Real-Time Communication) is a technology built into modern browsers that lets them send live video and audio. It handles:
- Capturing your camera and microphone
- Encoding video into a compressed stream
- Sending it over the internet in real time
- Receiving and decoding the other person's stream

### What is an SFU?

**SFU = Selective Forwarding Unit** — a media relay server in the middle.

**Without SFU (P2P — peer-to-peer, which we can't use):**
```
Browser A  ←→  Browser B  (direct connection)
```
Problem: Browsers need to know each other's IP addresses, firewalls often block it, and it doesn't scale beyond 2 people.

**With SFU (what we do):**
```
Browser A  →  SFU Server  →  Browser B
Browser A  ←  SFU Server  ←  Browser B
```
Each browser only talks to the SFU server. The SFU forwards video to everyone else. This:
- Works through firewalls
- Scales to multiple participants
- Stays on YOUR infrastructure (not a hosted video API)

**We use LiveKit as our SFU**, running on Railway.

### Full call flow: Agent creates session → Both join → Call ends

```
STEP 1: Agent creates the session
────────────────────────────────
Agent clicks "Create Session"
  → Browser sends POST /api/sessions with title
  → API creates a random room_name: "room_<uuid>"
  → API creates a random invite_code: "xk9m2pqa"
  → API inserts a row in sessions table
  → API logs 'session_created' event
  → Returns: { session, invite: { code: "xk9m2pqa", url: "/j/xk9m2pqa" } }
  → Agent sees the short link to share

STEP 2: Agent joins the call
────────────────────────────
Agent clicks "Join Call"
  → Browser sends GET /api/sessions/:id/agent-token
  → API checks: agent owns this session? session still active?
  → API creates a LiveKit Access Token:
      room = "room_<uuid>"
      identity = "agent-<agentId>"
      roomAdmin = TRUE (agent can manage the room)
      canPublish = TRUE (can send camera/mic)
      canSubscribe = TRUE (can receive others)
      TTL = 12 hours
  → API calls registerParticipantJoin → inserts participant row in DB
  → API returns: { url: "wss://livekit.railway.app", token: "<lk-token>" }
  
  → Browser's livekit-client calls room.connect(url, token)
  → WebRTC handshake happens with LiveKit server
  → Browser publishes camera/mic tracks to LiveKit
  → Agent sees "Waiting for customer..."

STEP 3: LiveKit tells our API (webhook)
─────────────────────────────────────
LiveKit server detects agent joined the room
  → LiveKit sends POST /api/webhooks/livekit
     with event: "participant_joined", room: "room_<uuid>", identity: "agent-<id>"
  → API verifies HMAC signature (security check)
  → API logs 'joined' event to events table

STEP 4: Customer opens invite link
───────────────────────────────────
Customer clicks /j/xk9m2pqa
  → React app loads CustomerJoin page
  → Browser sends GET /api/invite/xk9m2pqa  (pre-flight check)
  → API looks up sessions WHERE invite_code = 'xk9m2pqa'
  → Returns: { valid: true, sessionTitle: "My support session" }
  → Customer sees lobby: camera preview + name field

STEP 5: Customer clicks "Join Now"
───────────────────────────────────
  → Browser sends POST /api/join { code: "xk9m2pqa", name: "John" }
  → API finds the session by invite code
  → API checks: session still active? (status = 'active')
  → API creates customer identity: "customer-<sessionId>"
  → API creates LiveKit Access Token:
      room = "room_<uuid>"
      identity = "customer-<sessionId>"
      roomAdmin = FALSE (customer cannot manage room)
      canPublish = TRUE
      canSubscribe = TRUE
  → API also creates an Invite JWT for chat/files access
  → API calls registerParticipantJoin → DB row created
  → Returns: { url: "wss://livekit.railway.app", token: "<lk-token>", inviteToken: "<inv-jwt>" }
  
  → Browser connects to LiveKit room
  → LiveKit sends agent a "new participant joined" event
  → Agent now sees customer video
  → Customer now sees agent video

STEP 6: Live call is running
──────────────────────────────
  Agent camera/mic → LiveKit SFU → Customer browser   (video/audio)
  Customer camera/mic → LiveKit SFU → Agent browser   (video/audio)
  Text chat → LiveKit data channel (real-time) + POST /api/messages (persistent)

STEP 7: Agent ends the call
─────────────────────────────
Agent clicks "End"
  → Browser sends POST /api/sessions/:id/end
  → API: if recording is running → stop it (egress_id sent to LiveKit)
  → API: calls roomService.deleteRoom("room_<uuid>")  ← LiveKit room deleted
  → API: UPDATE sessions SET status='ended', ended_at=now()
  → API: closeAllParticipants() → stamps left_at on all participant rows
  → API: logs 'session_ended' event
  
  → LiveKit room deletion triggers webhook: "room_finished"
  → All browsers get disconnected (DisconnectReason.ROOM_DELETED)
  → Agent browser navigates to session history
  → Customer browser shows "Thanks for joining" screen
```

---

## 8. How Chat Works

Chat is a **two-layer system**: real-time delivery + permanent storage.

### Layer 1: Real-time — LiveKit Data Channel

When you type a message and press Enter:

```
Your browser  →  JSON encode the message  →  publishData() to LiveKit
LiveKit  →  forwards encoded data to all other participants in the room
Other browser  →  receives data  →  JSON decode  →  shows in chat panel
```

This is instant (< 100ms typically). The `livekit-client` handles this with `room.localParticipant.publishData(encodedMessage, { reliable: true })`.

`reliable: true` means LiveKit guarantees delivery (like TCP). Without it, packets can be dropped.

### Layer 2: Persistence — Postgres

Every message is also saved to the database:

```
User sends message
  → Browser also sends POST /api/sessions/:id/messages { body: "Hello" }
  → API validates: is user a participant of this session?
  → API inserts into chat_messages table
  → Returns the saved message with timestamp
```

**Why save to DB if LiveKit already delivered it?**
Because after the call ends, the LiveKit room is gone. The transcript must survive. Agents can read full chat history days later in session detail.

### How history is loaded

When agent opens a past session:
```
GET /api/sessions/:id
  → API fetches ALL chat_messages for that session
  → Returns messages in order by created_at
  → Frontend renders the full transcript
```

---

## 9. How File Sharing Works

```
UPLOAD FLOW
───────────
User picks a file in chat (PDF, image, Word, Excel, max 20MB)
  → Browser sends POST /api/sessions/:id/files
     with file as multipart/form-data
  → API checks: is user a participant?
  → API checks MIME type against allowlist:
     image/jpeg, image/png, image/gif, image/webp,
     application/pdf, text/plain,
     application/msword, .docx, .xls, .xlsx
  → If not allowed → 415 Unsupported Media Type
  → API sanitizes filename: special chars → underscore, max 200 chars
  → API generates unique storage path:
     "{sessionId}/{randomUUID}-{filename}"
     e.g. "abc123.../def456-report.pdf"
  → API uploads to MinIO bucket "files"
  → API inserts row in chat_files table with object_key
  → Returns file metadata to browser

  → Browser also sends this as a chat data message via LiveKit
  → Other participant sees "New file: report.pdf" in chat panel instantly

DOWNLOAD FLOW
─────────────
User clicks download on a file
  → Browser sends GET /api/sessions/:id/files/:fid/download
  → API: check participant access
  → API: fetch file record from chat_files table → get object_key
  → API: stream file bytes from MinIO
  → Browser: file downloads
```

**Why stream through the API instead of direct MinIO URL?**
Because the MinIO URL is internal infrastructure. We don't expose it publicly. The API acts as a secure proxy — you can only download files you're authorized to access.

---

## 10. How Recording Works

This is the most complex feature. It involves 4 services working together: API (Render) + LiveKit + Redis + Egress (all on Railway), plus MinIO storage.

### What is LiveKit Egress?

Egress is a separate service that:
- Joins the LiveKit room as a bot participant (identity starts with `EG_`)
- Captures the composite video (all participants on screen)
- Encodes it as MP4
- Uploads the MP4 to MinIO when done

### Recording status flow

```
in_progress → processing → ready
                        ↘ failed
```

### Full recording flow

```
STEP 1: Agent starts recording
────────────────────────────────
Agent clicks "Record" button
  → Browser sends POST /api/sessions/:id/recording/start
  → API checks if recording already in_progress → if yes, return it
  → API calls startRoomRecording("room_<uuid>"):
      - Generates object_key: "room_<uuid>/1718200000000.mp4"
      - Tells LiveKit Egress: "record room X, save to MinIO at this path"
      - Returns { egressId: "EG_abc...", objectKey: "room_.../....mp4" }
  → API inserts into recordings table:
      { session_id, egress_id, status: 'in_progress', object_key }
  → API logs 'recording_started' event

STEP 2: Egress bot joins the room
───────────────────────────────────
  → Egress worker picks up the job from Redis (LiveKit sends jobs via Redis)
  → Egress bot connects to the LiveKit room as "EG_xxxxx"
  → LiveKit sends webhook: participant_joined with identity "EG_xxxxx"
  → Our webhook handler sees isEgressBot("EG_xxxxx") = true → IGNORES IT
     (we don't add Egress bot as a human participant)
  → Egress bot starts recording the composite video in real time

STEP 3: Agent stops recording
───────────────────────────────
Agent clicks "Stop"
  → Browser sends POST /api/sessions/:id/recording/stop
  → API calls stopRecording(egressId) → tells LiveKit Egress to finalize
  → API UPDATE recordings SET status = 'processing'

STEP 4: Egress finalizes and uploads
──────────────────────────────────────
  → Egress finishes encoding the MP4
  → Egress uploads file to MinIO bucket "recordings" at object_key path
  → Egress sends webhook to our API: "egress_ended"
     with status=3 (COMPLETE) and filename = actual S3 path
  
  → API webhook handler:
      event = "egress_ended"
      complete = (info.status === 3)
      fileKey = info.fileResults[0].filename
      newStatus = 'ready'
      UPDATE recordings SET status='ready', object_key=fileKey

STEP 5: Agent downloads recording
────────────────────────────────────
  → Agent opens session detail → sees recording status: "Ready"
  → Agent clicks Download
  → Browser sends GET /api/sessions/:id/recording/:rid/download
  → API checks: session belongs to agent? recording status = 'ready'?
  → API checks: does file exist in MinIO?
  → API streams MP4 bytes from MinIO to browser
  → MP4 file downloads

RECONCILE (automatic background check)
────────────────────────────────────────
If webhooks fail or MinIO times out, recordings can get stuck in 'processing'.
Every 60 seconds, our API runs reconcileStaleRecordings():
  → Finds recordings stuck in 'processing' > 5 minutes
  → Checks: does the file exist in MinIO?
  → If yes → UPDATE status = 'ready'
  → If file is missing > 10 minutes → UPDATE status = 'failed'
```

### Why Redis is needed for recording

LiveKit and Egress are separate processes on Railway. They communicate through **Redis** as a message bus:

```
Agent starts recording
  → API tells LiveKit: "start egress for room X"
  → LiveKit puts job in Redis queue
  → Egress worker (separate process) picks job from Redis
  → Egress starts recording
```

Without Redis, LiveKit and Egress can't coordinate. This is why the Railway setup requires `REDIS_URL` on both LiveKit and Egress services.

---

## 11. How Reconnect (Disconnect Recovery) Works

### The problem

When someone loses internet (phone goes to background, tunnel, bad signal):
1. LiveKit drops the connection
2. LiveKit fires `participant_left` webhook
3. Should we mark them as "left" the session permanently?

**No!** If we mark them as left immediately, and they come back in 5 seconds, they'd be logged as "left + rejoined" which is noisy and wrong.

### Our solution: Grace window

We give every disconnected participant a **30-second grace period** to reconnect.

```
CUSTOMER DISCONNECTS (phone signal lost)
─────────────────────────────────────────
LiveKit fires webhook: "participant_left"
  → Our webhook handler:
      closeParticipantWithGrace(session_id, identity, 30):
        UPDATE participants
        SET left_at = now(), grace_until = now() + '30 seconds'
        WHERE session_id = X AND identity = Y AND left_at IS NULL
      logs 'disconnected' event (NOT 'left')

RECONNECT WITHIN 30 SECONDS
──────────────────────────────
Customer's browser reconnects automatically (LiveKit handles this)
LiveKit fires webhook: "participant_joined"
  → Our webhook handler:
      isReconnectable(session_id, identity):
        SELECT 1 FROM participants
        WHERE left_at IS NOT NULL AND grace_until > now()
      → true! (still within grace window)
      
      reopenParticipant(session_id, identity):
        UPDATE participants SET left_at = NULL, grace_until = NULL
      logs 'reconnected' event
  → Nobody else is notified, no disruption

GRACE WINDOW EXPIRES (didn't reconnect in time)
─────────────────────────────────────────────────
Every 5 seconds, our background sweep runs sweepExpiredGrace():
  SELECT participants WHERE grace_until <= now()
  → Finds rows with expired grace windows
  → Clears grace_until (so it only fires once)
  → Logs 'left' event with reason: 'grace_window_expired'
```

### Customer browser reconnect

The `livekit-client` library handles automatic reconnection internally. When it detects a dropped connection:
1. It tries to reconnect to the same room using the same token
2. Shows `ConnectionState.Reconnecting` status
3. Our UI shows "Connection dropped — reconnecting..."

If auto-reconnect fails, our `CustomerJoin` page checks `sessionStorage` for a `wasInCall` flag. If set, it goes straight to pre-join lobby for manual rejoin.

---

## 12. How the Admin Dashboard Works

The Admin has a completely **separate login** from agents. Admin can see **all sessions from all agents** — not just their own.

### Admin login

```
POST /api/auth/admin/login { email, password }
  → API: SELECT * FROM agents WHERE email = ? AND is_admin = true
  → If found + bcrypt matches → issue Admin JWT with role='admin'
```

The check `is_admin = true` means even if someone has the agent password, they can't log in as admin from the admin login page.

### What admin can see

```
GET /api/admin/sessions
  → No agent_id filter — returns ALL sessions across all agents
  → Each session has: agent email, title, status, participant count, live count

GET /api/admin/sessions/:id/detail
  → Full detail: participants, events, chat transcript, files, recordings
  → Same data as agent session detail, but accessible for any session

POST /api/admin/sessions/:id/end
  → Admin can forcibly end any active session (same flow as agent ending)
```

### Event log (most powerful feature for judges)

Every event is shown in order with a human-readable label:

| Event type in DB | Shown as |
|-----------------|----------|
| `joined` | "Joined the call" |
| `left` | "Left the call" |
| `disconnected` | "Disconnected (reconnect grace started)" |
| `reconnected` | "Reconnected within grace window" |
| `duplicate_join` | "Duplicate join ignored" |
| `recording_started` | "Recording started" |
| `recording_stopped` | "Recording stopped" |
| `recording_ready` | "Recording ready to download" |
| `session_ended` | "Session ended" |
| `room_finished` | "Room closed by LiveKit" |

---

## 13. Background Jobs (What Runs Automatically)

When the API server starts, it kicks off two recurring background tasks:

### 1. Grace sweep (every 5 seconds)
```javascript
setInterval(() => {
  sweepExpiredGrace()  // check if any participant's 30s is up → mark as 'left'
}, 5000)
```

### 2. Recording reconcile (every 60 seconds)
```javascript
setInterval(() => {
  reconcileStaleRecordings()  // fix stuck 'processing' recordings
}, 60_000)
```

### What runs on API startup

Every time the Render API boots (deploy or restart):

1. **`migrate()`** — runs all SQL in `migrations.sql` (idempotent: `CREATE TABLE IF NOT EXISTS`)
2. **`seedAgent()`** — creates/updates the demo agent account
3. **`seedAdmin()`** — creates/updates the demo admin account
4. **`backfillInviteCodes()`** — if any old sessions have no invite code, generate one
5. **`ensureBuckets()`** — creates the `recordings` and `files` buckets in MinIO if they don't exist
6. **`reconcileStaleRecordings()`** — immediately fix any stuck recordings from before the restart

This means the app is **always self-healing** on restart.

---

## 14. The Invite Link System

### How the short code is generated

```javascript
// Alphabet with no ambiguous chars (no 0/O, 1/l/I)
const ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789'  // 33 chars

function generateInviteCode(length = 8): string {
  const bytes = randomBytes(8)  // cryptographically random
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % 33]
  }
  return code  // e.g. "xk9m2pqa"
}
```

8 characters × 33 possibilities = **33^8 = ~1.1 trillion** possible codes. Essentially impossible to guess.

### The link flow

```
Agent creates session → invite_code "xk9m2pqa" saved in sessions table
Agent shares link: https://assist-lens.vercel.app/j/xk9m2pqa

Customer opens /j/xk9m2pqa
  → React Router renders CustomerJoin component
  → CustomerJoin extracts code "xk9m2pqa" from URL
  → GET /api/invite/xk9m2pqa  → { valid: true, sessionTitle: "..." }
  → Shows pre-join lobby

Customer submits join form
  → POST /api/join { code: "xk9m2pqa", name: "John" }
  → API: SELECT * FROM sessions WHERE LOWER(invite_code) = LOWER('xk9m2pqa')
  → Found → active → build join response
```

### Why two token types for the customer?

When a customer joins, they get two separate tokens:

1. **LiveKit token** — given directly to `livekit-client` to connect to the video room
2. **Invite JWT** — used as `Authorization: Bearer <token>` for REST API calls (chat, files)

The LiveKit token is only valid for media (video/audio). The invite JWT is used for HTTP requests to the API. They serve different purposes and are validated differently.

---

## 15. WebRTC Explained Simply

Here's what actually happens when two browsers connect over video:

### Step 1: Signaling (finding each other)

Browsers can't just "call" each other. They need to exchange connection info first. This happens through our **LiveKit server** (the signaling channel):

```
Browser A: "Here's my IP address, camera format, supported codecs"
                ↓ via LiveKit
Browser B: "OK, here's mine"
                ↓ via LiveKit
Browser A: "Let's use H.264 codec at 720p"
```

This negotiation is called **SDP (Session Description Protocol)** exchange.

### Step 2: ICE (finding the best network path)

ICE = Interactive Connectivity Establishment. It tries many ways to route data:

1. Direct LAN connection (same WiFi)
2. Through a STUN server (tells you your public IP)
3. Through a TURN/RELAY server (when firewalls block everything)

LiveKit acts as the STUN/TURN relay, which is why `use_external_ip: true` matters in production.

### Step 3: DTLS handshake (security)

Once a path is found, browsers do a TLS-like handshake to encrypt all media traffic. Even though it goes through LiveKit's server, the media is encrypted end-to-end at the DTLS level.

### Step 4: Tracks flowing

```
Camera → video encoder (H.264/VP8) → RTP packets → LiveKit → other browser
Mic   → audio encoder (Opus)       → RTP packets → LiveKit → other browser
```

**Adaptive stream** (`adaptiveStream: true` in our code): LiveKit automatically lowers video quality if the connection is poor, and raises it when stable. The viewer's browser signals bandwidth to LiveKit, and LiveKit sends a lower-resolution version.

**Dynacast** (`dynacast: true`): If nobody is watching your video, LiveKit stops forwarding it, saving bandwidth.

---

## 16. Challenges We Faced and How We Solved Them

### Challenge 1: "Video doesn't work through the browser on production"

**Problem:** WebRTC requires HTTPS and specific network ports. Our LiveKit was on Railway but video calls weren't connecting.

**Root cause:** WebRTC uses UDP ports for media. Railway's default HTTP proxy doesn't pass UDP. LiveKit needs a **TCP proxy on port 7882** as a fallback for WebRTC when UDP is blocked.

**Solution:** Added TCP proxy on port 7882 in Railway's LiveKit service settings. This allows WebRTC to fall back to TCP when UDP is blocked (common in corporate networks).

### Challenge 2: "Recording never shows as Ready"

**Problem:** After stopping recording, status stayed `processing` forever.

**Root cause:** LiveKit Egress and LiveKit server need to talk to each other via Redis. Without Redis, Egress jobs are never dispatched. Also, our webhook endpoint for `egress_ended` wasn't receiving the correct final file path.

**Solution:**
1. Added Redis to Railway and connected both LiveKit and Egress to it
2. Added `reconcileStaleRecordings()` — a background job that checks MinIO directly to fix stuck recordings even if webhooks fail
3. LiveKit sends a webhook with `fileResults[0].filename` — we parse that to get the real MinIO path

### Challenge 3: "Customer refresh kills the session"

**Problem:** Customer loses WiFi, page refreshes, LiveKit fires `participant_left`, we marked them as gone. They rejoined and appeared as a "new" participant.

**Solution:** The 30-second grace window system (section 11). Instead of immediately marking left, we hold a grace period. The webhook logs `disconnected` not `left`. If they come back within 30s, we silently reopen their row and log `reconnected`. Nobody knows they dropped.

### Challenge 4: "Egress bot showing as a participant"

**Problem:** When recording starts, LiveKit Egress joins the room as a participant. Our webhook was treating it as a human and adding it to the participants table. Admin dashboard showed "EG_xxx" as a participant.

**Solution:**
```javascript
function isEgressBot(identity: string): boolean {
  return identity.startsWith('EG_')
}
// In webhook handler:
if (isEgressBot(identity)) break  // skip, don't add to participants table
```

Also in the SQL queries:
```sql
WHERE p.identity NOT LIKE 'EG_%'  -- exclude Egress bots from counts
```

### Challenge 5: "Admin can see everything but agents can only see their own"

**Problem:** We needed agent session queries to be scoped to `agent_id`, but admin queries to see all sessions.

**Solution:** Two completely separate route sets with different guards:

```
Agent routes: /api/sessions/*
  → requireAgent() check
  → All queries include: WHERE agent_id = $agentId

Admin routes: /api/admin/sessions/*
  → requireAdmin() check
  → No agent_id filter — all sessions visible
```

### Challenge 6: "Git HEAD couldn't resolve" (repo issue)

**Problem:** `.git/refs/heads/main` file was deleted (likely by antivirus or sync tool). Git couldn't find the branch pointer.

**Solution:** Read the reflog (`.git/logs/refs/heads/main`) to find the last commit hash, then manually wrote the hash into the missing `.git/refs/heads/main` file. Repo restored without losing any commits.

### Challenge 7: "How do we handle a session that ended while customer has a valid JWT?"

**Problem:** Customer holds an invite JWT valid for 24 hours. If the session ends, the JWT is still technically valid. Should they be able to call chat/files endpoints?

**Design decision:** The `join` endpoint checks `session.status === 'ended'` and rejects. The `resolveParticipant` guard (used for chat/files) does not re-check session status — once you have a valid JWT for a session, you can access its history. This is acceptable because:
1. The session is over — no new harm is done by reading history
2. We didn't want to complicate every chat/file request with a DB session status check
3. JWT expires in 24h anyway

---

## 17. Production Infrastructure Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL                                   │
│   https://assist-lens.vercel.app                                │
│   Static React SPA (HTML + JS + CSS)                            │
│   Routes: / (agent), /admin/login, /j/:code (customer)          │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS REST API calls
                         │ (VITE_API_BASE = onrender.com/api)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RENDER                                   │
│   https://assistlens-api.onrender.com                           │
│   Fastify Node.js API (Docker container)                        │
│   Port 8080, always-on, health check at /api/health             │
│                                                                 │
│   Routes registered:                                            │
│   POST /api/auth/login              (agent login)               │
│   POST /api/auth/admin/login        (admin login)               │
│   POST /api/auth/register           (agent signup)              │
│   POST /api/sessions                (create session)            │
│   GET  /api/sessions                (list my sessions)          │
│   GET  /api/sessions/:id            (full session detail)       │
│   POST /api/sessions/:id/end        (end session)               │
│   GET  /api/sessions/:id/agent-token (join as agent)            │
│   POST /api/join                    (customer join)             │
│   GET  /api/invite/:code            (pre-flight check)          │
│   GET/POST /api/sessions/:id/messages (chat)                    │
│   GET/POST /api/sessions/:id/files   (file upload/list)         │
│   POST /api/sessions/:id/recording/start                        │
│   POST /api/sessions/:id/recording/stop                         │
│   GET  /api/sessions/:id/recording/:rid/download                │
│   GET  /api/admin/sessions          (all sessions)              │
│   POST /api/admin/sessions/:id/end  (force end)                 │
│   POST /api/webhooks/livekit        (LiveKit events)            │
│   GET  /api/health                  (liveness check)            │
│   GET  /api/metrics                 (Prometheus)                │
└──────┬─────────────────────┬──────────────────┬────────────────┘
       │                     │                  │
       ▼                     ▼                  ▼
┌──────────────┐   ┌──────────────────┐  ┌─────────────────────┐
│  SUPABASE    │   │  RAILWAY         │  │  RAILWAY            │
│  PostgreSQL  │   │  LiveKit SFU     │  │  MinIO              │
│              │   │                  │  │                     │
│  Tables:     │   │  wss://livekit   │  │  Bucket: recordings │
│  agents      │   │  .railway.app    │  │  Bucket: files      │
│  sessions    │   │                  │  │                     │
│  participants│   │  Port 7880 (HTTP)│  │  Port 9000 (HTTP)   │
│  events      │   │  Port 7882 (TCP) │  │  Public HTTPS URL   │
│  chat_messages    │  (WebRTC fallback)│  │  Volume at /data    │
│  recordings  │   │                  │  └─────────────────────┘
│  chat_files  │   │  ┌───────────┐   │
└──────────────┘   │  │  Redis    │   │
                   │  │ (private) │   │
                   │  └─────┬─────┘   │
                   │        │         │
                   │  ┌─────▼─────┐   │
                   │  │  Egress   │   │
                   │  │ (private) │───┘
                   │  │ Records   │
                   │  │ MP4 →     │
                   │  │ MinIO     │
                   │  └───────────┘
                   └──────────────────┘

BROWSERS ←─── WebRTC (WSS + UDP/TCP) ───► LiveKit SFU
              (wss://livekit.railway.app)
```

### Data flows summary

| Action | Flow |
|--------|------|
| Agent login | Browser → Render API → Supabase → JWT back |
| Create session | Browser → Render API → Supabase (insert) → invite code back |
| Join video | Browser → Render API (get token) → LiveKit (WebRTC connect) |
| Send chat | Browser → LiveKit data channel (instant) + Render API → Supabase |
| Upload file | Browser → Render API → MinIO (store) → Supabase (metadata) |
| Start recording | Browser → Render API → LiveKit Egress (via Redis) → MinIO |
| Participant joins | LiveKit → webhook → Render API → Supabase |
| Participant drops | LiveKit → webhook → Render API → Supabase (grace window) |
| Download recording | Browser → Render API → MinIO (stream bytes) |
| Admin views all | Browser → Render API (admin JWT) → Supabase → all sessions |

---

*AssistLens — Built for AtomQuest Hackathon 2026*
