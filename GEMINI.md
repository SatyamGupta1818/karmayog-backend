# Project Instructions: Real-time Notification System

This document outlines the architectural plan for implementing real-time notifications across the Karmayog platform.

## Goal
Whenever a new Project, Task, Feature, Issue, or Comment is created or assigned, real-time notifications must be sent to the relevant users.

## Architecture & Tech Stack
- **WebSocket Engine:** `@nestjs/websockets` (Socket.io) for real-time communication.
- **Event Orchestration:** `@nestjs/event-emitter` to decouple business logic from notification delivery.
- **Persistence:** Dedicated `NotificationsModule` with a `Notification` entity to store history and read/unread states.
- **Scaling:** Redis Adapter for Socket.io to support horizontal scaling across multiple instances.

## Implementation Roadmap

### Phase 1: Infrastructure Setup
- **Dependencies:** Install `@nestjs/websockets`, `@nestjs/platform-socket.io`, and `@nestjs/event-emitter`.
- **Entity Definition:** Create `Notification` entity:
  - `id`: UUID
  - `recipientId`: UUID (relation to User)
  - `title`: string
  - `message`: string
  - `type`: enum (PROJECT_CREATED, TASK_ASSIGNED, etc.)
  - `isRead`: boolean (default: false)
  - `metadata`: JSON (link to specific entity ID)
  - `createdAt`: timestamp
- **Gateway:** Implement `NotificationGateway` to handle socket connections and room management (join room per `userId`).

### Phase 2: Centralized Event Handling
- **Notification Listener:** Create a central service/listener that subscribes to application-wide events.
- **Logic:**
  1. Catch event (e.g., `task.assigned`).
  2. Create and save `Notification` record in the database.
  3. Emit WebSocket event to the recipient's room.
  4. (Optional) Trigger `EmailService` if notification requires high priority.

### Phase 3: Domain Integration
- Update existing services (`ProjectsService`, `TasksService`, `FeaturesService`, `IssuesService`, `CommentsService`) to emit events using `EventEmitter2` upon successful creation or assignment.
- Standardize event payloads across modules.

### Phase 4: API & Frontend Readiness
- Implement `GET /notifications` for fetching user notification history.
- Implement `PATCH /notifications/:id/read` for updating status.
- Ensure the gateway handles authentication via JWT (reusing existing `AuthModule` logic).

## Principles
- **Asynchronous:** Notifications should never block the main business transaction.
- **Reliable:** Store first, emit second. If a user is offline, they will see the notification in their history upon login.
- **Scalable:** Keep the gateway lean and use Redis for message broadcasting.
