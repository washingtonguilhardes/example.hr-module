# Technical Requirement Document (TRD)

## Time-Off Microservice — ExampleHR

**Author:** Washington Guilhardes
**Date:** 2026-04-10
**Status:** Draft

---

## 1. Overview

ExampleHR provides a module where employees request time off. However, the Human Capital Management (HCM) system (e.g., Workday, SAP) remains the **source of truth** for employment data and leave balances.

This document specifies the design of a **Time-Off Microservice** responsible for:

- Managing the full lifecycle of time-off requests (create, approve, reject, cancel)
- Maintaining a local mirror of leave balances per employee per location
- Synchronizing balances with HCM via real-time and batch APIs
- Providing defensive validation when HCM guarantees are unavailable

### 1.1 Key Personas

| Persona | Need |
|---------|------|
| **Employee** | See accurate balance, get instant feedback on requests |
| **Manager** | Approve/reject requests with confidence that data is valid |

### 1.2 Core Constraint

ExampleHR is **not the only system** that modifies HCM balances. External events (work anniversaries, yearly resets, manual adjustments) can change balances at any time without notifying ExampleHR. The system must handle this gracefully.

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ExampleHR Client                     │
│                  (Employee / Manager)                   │
└─────────────┬───────────────────────────┬───────────────┘
              │ REST API                  │
              ▼                           ▼
┌─────────────────────┐   ┌──────────────────────────────┐
│   Request Module    │   │       Balance Module         │
│                     │   │                              │
│ - Create request    │──▶│ - Query balances             │
│ - Approve / Reject  │   │ - Hold pending days          │
│ - Cancel            │   │ - Release / deduct on outcome│
│ - Lifecycle FSM     │   │                              │
└────────┬────────────┘   └──────────────┬───────────────┘
         │                               │
         │  On approval                  │  Sync
         ▼                               ▼
┌─────────────────────────────────────────────────────────┐
│                     HCM Module                          │
│                                                         │
│ - Real-time client: GET balance, POST submit time-off   │
│ - Batch sync receiver: POST /sync/batch                 │
│ - Retry with exponential backoff                        │
│ - Error mapping and circuit breaking                    │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
               ┌─────────────────────┐
               │   External HCM      │
               │  (Source of Truth)  │
               └─────────────────────┘

Cross-cutting:
┌─────────────────────────────────────────────────────────┐
│  Validation Layer (defensive checks, independent of HCM)│
│  SyncLog (audit trail for all sync operations)          │
│  SQLite Database (local persistence via TypeORM)        │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Module Boundaries

| Module | Responsibility | Depends On |
|--------|---------------|------------|
| **BalanceModule** | Local balance CRUD, hold/release pending days | Database |
| **RequestModule** | Time-off request lifecycle (FSM), orchestrates approval flow | BalanceModule, HcmModule |
| **HcmModule** | Communication with external HCM (real-time + batch receive) | BalanceModule |
| **ValidationModule** | Defensive local validation rules, independent of HCM | BalanceModule |
| **DatabaseModule** | TypeORM + SQLite configuration | — |

### 2.3 Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | NestJS 11 | Modular architecture, DI, testing support |
| Database | SQLite via TypeORM | Lightweight, zero-config, specified in requirements |
| Language | TypeScript | Type safety, NestJS standard |
| Testing | Jest + Supertest | Built-in NestJS support, e2e capability |
| Mock HCM | Standalone Express/NestJS app | Configurable per-test behavior |

---

## 3. Data Model

### 3.1 Entity: Balance

Represents the local mirror of an employee's time-off balance for a specific location and policy type.

```
Table: balances
├── id              UUID        PK, auto-generated
├── employeeId      VARCHAR     NOT NULL, indexed
├── locationId      VARCHAR     NOT NULL, indexed
├── policyType      VARCHAR     NOT NULL (e.g., "VACATION", "SICK", "PERSONAL")
├── available       DECIMAL     NOT NULL, default 0 — total days available from HCM
├── used            DECIMAL     NOT NULL, default 0 — days already consumed
├── pending         DECIMAL     NOT NULL, default 0 — days held by pending requests
├── lastSyncedAt    DATETIME    NULL — last time this balance was synced with HCM
├── createdAt       DATETIME    auto-generated
├── updatedAt       DATETIME    auto-generated
│
├── UNIQUE(employeeId, locationId, policyType)
```

**Derived value:** `effectiveAvailable = available - used - pending`

### 3.2 Entity: TimeOffRequest

Represents a time-off request with its lifecycle state.

```
Table: time_off_requests
├── id              UUID        PK, auto-generated
├── employeeId      VARCHAR     NOT NULL, indexed
├── locationId      VARCHAR     NOT NULL
├── policyType      VARCHAR     NOT NULL
├── startDate       DATE        NOT NULL
├── endDate         DATE        NOT NULL
├── days            DECIMAL     NOT NULL — business days requested
├── status          ENUM        NOT NULL (PENDING, APPROVED, REJECTED, CANCELLED)
├── reason          VARCHAR     NULL — employee's reason for request
├── reviewerNote    VARCHAR     NULL — manager's note on decision
├── hcmSubmissionId VARCHAR     NULL — reference ID returned by HCM on submission
├── idempotencyKey  VARCHAR     UNIQUE, NOT NULL — prevents double submissions
├── createdAt       DATETIME    auto-generated
├── updatedAt       DATETIME    auto-generated
```

**State Machine:**

```
  ┌──────────┐
  │ PENDING  │──────────────┐
  └────┬─────┘              │
       │                    │
  ┌────▼─────┐        ┌────▼──────┐
  │ APPROVED │        │ REJECTED  │
  └────┬─────┘        └───────────┘
       │
  ┌────▼──────┐
  │ CANCELLED │  (only from PENDING or APPROVED)
  └───────────┘
```

**Transition rules:**
- `PENDING → APPROVED`: Manager approves; system validates with HCM, submits, deducts from balance
- `PENDING → REJECTED`: Manager rejects; pending hold is released
- `PENDING → CANCELLED`: Employee cancels before approval; pending hold is released
- `APPROVED → CANCELLED`: Employee cancels after approval; used days are restored, HCM is notified

### 3.3 Entity: SyncLog

Audit trail for all synchronization operations with HCM.

```
Table: sync_logs
├── id              UUID        PK, auto-generated
├── type            ENUM        NOT NULL (BATCH_INBOUND, REALTIME_GET, REALTIME_SUBMIT)
├── status          ENUM        NOT NULL (SUCCESS, PARTIAL, FAILED)
├── recordsReceived INTEGER     NULL — for batch operations
├── recordsApplied  INTEGER     NULL — for batch operations
├── conflicts       INTEGER     NULL — records with pending request conflicts
├── errorMessage    VARCHAR     NULL
├── payload         TEXT        NULL — raw request/response for debugging (truncated)
├── createdAt       DATETIME    auto-generated
```

---

## 4. REST API Contract

> Full OpenAPI 3.0 specification available at [`docs/openapi.yaml`](./openapi.yaml).
> Can be previewed in any Swagger UI or imported into Postman.

### 4.1 Balance Endpoints

#### `GET /balances/:employeeId`

Returns all balances for an employee across locations and policy types.

**Response 200:**
```json
{
  "employeeId": "emp-123",
  "balances": [
    {
      "locationId": "loc-us-nyc",
      "policyType": "VACATION",
      "available": 15,
      "used": 3,
      "pending": 2,
      "effectiveAvailable": 10,
      "lastSyncedAt": "2026-04-09T14:00:00Z"
    }
  ]
}
```

#### `GET /balances/:employeeId/:locationId`

Returns balances for a specific employee at a specific location.

**Response 200:** Same shape as above, filtered to the location.

**Response 404:** Employee or location not found.

### 4.2 Request Endpoints

#### `POST /requests`

Create a new time-off request.

**Request body:**
```json
{
  "employeeId": "emp-123",
  "locationId": "loc-us-nyc",
  "policyType": "VACATION",
  "startDate": "2026-05-01",
  "endDate": "2026-05-05",
  "days": 3,
  "reason": "Family vacation",
  "idempotencyKey": "req-abc-123"
}
```

**Response 201:** Request created with status `PENDING`. Balance `pending` incremented.

**Response 409:** Duplicate `idempotencyKey` — returns existing request.

**Response 422:** Validation failure (insufficient balance, invalid dates, invalid dimensions).

#### `PATCH /requests/:id/approve`

Manager approves the request. Triggers HCM submission.

**Request body (optional):**
```json
{
  "reviewerNote": "Approved, enjoy your time off"
}
```

**Response 200:** Request status updated to `APPROVED`. Balance `pending` decremented, `used` incremented. HCM notified.

**Response 422:** HCM rejected the submission (insufficient balance on HCM side, invalid dimensions).

**Response 502:** HCM unavailable. Request stays `PENDING`, can retry.

#### `PATCH /requests/:id/reject`

Manager rejects the request.

**Request body (optional):**
```json
{
  "reviewerNote": "Team capacity issue during that period"
}
```

**Response 200:** Request status updated to `REJECTED`. Balance `pending` decremented.

#### `PATCH /requests/:id/cancel`

Employee cancels their request.

**Response 200:** Request status updated to `CANCELLED`. Balance adjusted (pending released or used restored depending on prior status).

#### `GET /requests?employeeId=&status=&page=&limit=`

List requests with optional filters.

**Response 200:**
```json
{
  "data": [{ "id": "...", "status": "PENDING", "..." : "..." }],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### 4.3 Sync Endpoints

#### `POST /sync/batch`

Receive bulk balance data from HCM. This is called by the HCM system to push the full corpus of balances.

**Request body:**
```json
{
  "source": "workday",
  "timestamp": "2026-04-10T00:00:00Z",
  "balances": [
    {
      "employeeId": "emp-123",
      "locationId": "loc-us-nyc",
      "policyType": "VACATION",
      "available": 15,
      "used": 5
    }
  ]
}
```

**Response 200:**
```json
{
  "received": 150,
  "applied": 148,
  "conflicts": 2,
  "conflictDetails": [
    {
      "employeeId": "emp-456",
      "locationId": "loc-us-nyc",
      "reason": "Employee has pending request for 3 days; new HCM balance would make it insufficient"
    }
  ]
}
```

### 4.4 Error Response Format

All errors follow a consistent structure:

```json
{
  "statusCode": 422,
  "error": "INSUFFICIENT_BALANCE",
  "message": "Employee emp-123 has 2 effective days available but requested 5",
  "details": {
    "employeeId": "emp-123",
    "locationId": "loc-us-nyc",
    "available": 10,
    "used": 6,
    "pending": 2,
    "requested": 5
  }
}
```

**Error codes:**
| Code | HTTP | Meaning |
|------|------|---------|
| `INSUFFICIENT_BALANCE` | 422 | Not enough effective balance |
| `INVALID_DATE_RANGE` | 422 | Start after end, past dates, overlap |
| `INVALID_DIMENSIONS` | 422 | Unknown locationId for employee |
| `DUPLICATE_REQUEST` | 409 | Idempotency key already used |
| `INVALID_TRANSITION` | 422 | Invalid status transition (e.g., approve a cancelled request) |
| `HCM_VALIDATION_ERROR` | 422 | HCM rejected the operation |
| `HCM_UNAVAILABLE` | 502 | HCM system is unreachable |
| `NOT_FOUND` | 404 | Resource not found |

---

## 5. HCM Integration Strategy

### 5.1 Real-Time API Client

The HCM exposes two real-time endpoints that ExampleHR consumes:

| Operation | HCM Endpoint | When Used |
|-----------|-------------|-----------|
| Get balance | `GET /hcm/balances/:employeeId/:locationId` | On-demand validation before approval |
| Submit time-off | `POST /hcm/time-off` | After manager approves a request |

**Retry policy:** Exponential backoff with jitter, max 3 retries, 1s/2s/4s base delays.

**Timeout:** 5 seconds per request. If HCM doesn't respond, the approval is not processed and the request stays in `PENDING`. The manager can retry.

### 5.2 Batch Sync (Inbound)

HCM pushes the full balance corpus to `POST /sync/batch`. This handles:

- **New balances** (employee got a new policy type) — created locally
- **Updated balances** (anniversary bonus, yearly reset) — local balance updated
- **Conflicts** — when updated balance would make a pending request insufficient

**Conflict handling strategy:**

When a batch sync detects that an incoming balance change would make a pending request insufficient (`newAvailable - used - pending < 0`), the system:

1. Applies the balance update anyway (HCM is source of truth)
2. Logs the conflict in the sync response and SyncLog
3. Does **not** auto-cancel the pending request — this requires human decision
4. The pending request remains, but subsequent approval attempts will fail validation

This preserves data accuracy while avoiding destructive automated decisions.

### 5.3 Sync Flow Diagram

```
Batch Sync Inbound:
  HCM ──POST /sync/batch──▶ ExampleHR
                              │
                    ┌─────────▼──────────┐
                    │ For each balance:   │
                    │ 1. Upsert balance   │
                    │ 2. Check conflicts  │
                    │ 3. Log to SyncLog   │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Return summary:     │
                    │ applied, conflicts  │
                    └────────────────────┘

Request Approval Flow:
  Manager ──PATCH /requests/:id/approve──▶ ExampleHR
                                             │
                                   ┌─────────▼──────────┐
                                   │ 1. Local validation │
                                   │ 2. HCM getBalance   │
                                   │ 3. Compare balances  │
                                   │ 4. HCM submitTimeOff │
                                   │ 5. Update local DB   │
                                   └─────────────────────┘
```

---

## 6. Defensive Validation

Since HCM validation is **not always guaranteed**, the system implements its own validation layer that runs independently before any HCM call.

### 6.1 Validation Rules

| Rule | Check | When |
|------|-------|------|
| **Balance sufficiency** | `available - used - pending >= requested` | Request creation, approval |
| **Date range validity** | `startDate <= endDate`, not in the past, within reasonable future | Request creation |
| **Date overlap** | No existing non-cancelled request overlaps the date range for same employee | Request creation |
| **Dimension validity** | Balance record exists for `(employeeId, locationId, policyType)` | Request creation |
| **Idempotency** | `idempotencyKey` is unique across non-cancelled requests | Request creation |
| **State transition** | Only valid FSM transitions allowed | All status changes |

### 6.2 Double Validation on Approval

When a manager approves a request, the system performs **two layers** of validation:

1. **Local check** — re-validates balance sufficiency against current local state (balances may have changed since request creation)
2. **HCM check** — fetches fresh balance from HCM and validates again

If local passes but HCM fails → return `HCM_VALIDATION_ERROR` (422)
If local passes but HCM is unreachable → return `HCM_UNAVAILABLE` (502), request stays `PENDING`
If local fails → return `INSUFFICIENT_BALANCE` (422), no HCM call made

This prevents unnecessary HCM calls when local state already shows insufficiency.

### 6.3 Concurrency Protection

To prevent race conditions where two requests for the same employee could overdraw the balance:

- Balance updates (hold/release/deduct) use **optimistic locking** via TypeORM's `@VersionColumn`
- If a version conflict occurs during balance update, the operation is retried once with fresh data
- If still conflicting, return `INSUFFICIENT_BALANCE`

---

## 7. Challenges and Alternatives Considered

### 7.1 Challenge: Eventual Consistency Between ExampleHR and HCM

**Problem:** ExampleHR's local balance is a cache of HCM's data. It can become stale at any time due to external events (anniversary bonuses, yearly resets, manual HR adjustments).

**Chosen approach:** Accept eventual consistency. Local balances are updated via batch sync and refreshed on-demand during approval. Pending requests use optimistic holds that may become invalid.

**Alternative considered:** Always query HCM in real-time for every balance check. Rejected because: (a) adds latency to every read operation, (b) HCM may be unavailable, (c) the requirements specify a batch endpoint exists for this purpose.

### 7.2 Challenge: Pending Requests During Balance Changes

**Problem:** An employee creates a request for 5 days when they have 10 available. Before approval, a batch sync reduces their balance to 3. The pending request is now insufficient.

**Chosen approach:** Allow the conflict to exist. Update the balance (HCM is truth), log the conflict, but don't auto-cancel the request. The approval attempt will fail with a clear error, prompting the manager to reject or the employee to modify.

**Alternative considered:** Auto-cancel pending requests that become insufficient after a batch sync. Rejected because: (a) the balance change might be temporary, (b) auto-cancellation without user consent creates a poor UX, (c) the manager should make the final call.

### 7.3 Challenge: HCM Unreliability

**Problem:** HCM may not respond, may respond slowly, or may not validate correctly (per requirements: "this may not always be guaranteed").

**Chosen approach:** Defensive local validation runs first and independently. HCM is called only when local validation passes. If HCM is down, approval is deferred (not denied). Retry with exponential backoff for transient failures.

**Alternative considered:** Queue-based async submission to HCM. Rejected because: (a) adds complexity (need a job queue), (b) the manager expects synchronous feedback on approval, (c) the retry logic with backoff handles transient failures adequately for this scope.

### 7.4 Challenge: Concurrent Requests Overdrawing Balance

**Problem:** Two managers approve two different requests for the same employee simultaneously. Each sees sufficient balance, but together they would overdraw.

**Chosen approach:** Optimistic locking on the balance record via `@VersionColumn`. The second approval will fail the version check and retry with fresh data. If balance is now insufficient, it returns an error.

**Alternative considered:** Pessimistic locking (SELECT FOR UPDATE). Rejected because: (a) SQLite has limited concurrent write support, (b) optimistic locking is sufficient for the expected request volume, (c) simpler to implement and test.

### 7.5 Challenge: Idempotency on Request Creation

**Problem:** Network issues could cause a client to retry a request creation, resulting in duplicate requests and double balance holds.

**Chosen approach:** Client provides an `idempotencyKey` with each request. If a request with the same key exists (non-cancelled), return the existing request (409) instead of creating a duplicate.

**Alternative considered:** Server-generated deduplication based on (employeeId, dates, policyType). Rejected because: (a) an employee might legitimately cancel and re-create a request for the same dates, (b) client-provided keys give the client explicit control over deduplication.

---

## 8. Testing Strategy

### 8.1 Test Layers

| Layer | Scope | Tool |
|-------|-------|------|
| **Unit tests** | Service methods, validation logic, state transitions | Jest |
| **Integration tests** | Full request lifecycle with real DB (in-memory SQLite) | Jest + Supertest |
| **E2E with mock HCM** | Full system including HCM interactions | Jest + Supertest + Mock HCM server |

### 8.2 Mock HCM Server

A standalone configurable server that simulates HCM behavior:

- **Per-test configuration** — each test can set up specific responses (success, error, timeout)
- **Stateful mode** — maintains balance state to simulate realistic scenarios
- **Scenario presets** — anniversary bonus, yearly reset, insufficient balance, server down

### 8.3 Key Test Scenarios

| Scenario | Validates |
|----------|-----------|
| Create request with sufficient balance | Happy path, pending hold |
| Create request with insufficient balance | Defensive validation rejects |
| Approve request, HCM confirms | Full lifecycle, balance deduction |
| Approve request, HCM rejects (insufficient) | HCM validation error handling |
| Approve request, HCM unreachable | Graceful degradation, request stays PENDING |
| Cancel pending request | Pending hold released |
| Cancel approved request | Used days restored |
| Batch sync updates balances | Upsert logic, SyncLog |
| Batch sync creates conflict with pending request | Conflict detection and logging |
| Concurrent approvals for same employee | Optimistic locking prevents overdraw |
| Duplicate request (same idempotency key) | Returns existing, no double hold |
| Balance refresh after anniversary | External change reconciled correctly |

### 8.4 Coverage Target

Aim for **>90% line coverage** on service and validation code, with 100% coverage on state transition logic and balance mutation operations.

---

## 9. Project Structure

```
src/
├── app.module.ts
├── main.ts
├── database/
│   └── database.module.ts
├── balance/
│   ├── balance.module.ts
│   ├── balance.controller.ts
│   ├── balance.service.ts
│   ├── balance.entity.ts
│   ├── dto/
│   │   └── balance-response.dto.ts
│   └── balance.service.spec.ts
├── request/
│   ├── request.module.ts
│   ├── request.controller.ts
│   ├── request.service.ts
│   ├── request.entity.ts
│   ├── dto/
│   │   ├── create-request.dto.ts
│   │   └── request-response.dto.ts
│   └── request.service.spec.ts
├── hcm/
│   ├── hcm.module.ts
│   ├── hcm-client.service.ts
│   ├── dto/
│   │   ├── hcm-balance.dto.ts
│   │   └── hcm-submit.dto.ts
│   └── hcm-client.service.spec.ts
├── sync/
│   ├── sync.module.ts
│   ├── sync.controller.ts
│   ├── sync.service.ts
│   ├── sync-log.entity.ts
│   ├── dto/
│   │   └── batch-sync.dto.ts
│   └── sync.service.spec.ts
├── validation/
│   ├── validation.module.ts
│   ├── validation.service.ts
│   └── validation.service.spec.ts
└── common/
    ├── filters/
    │   └── http-exception.filter.ts
    └── interfaces/
        └── error-response.interface.ts

test/
├── mock-hcm/
│   ├── mock-hcm.server.ts
│   └── scenarios/
│       ├── happy-path.ts
│       ├── insufficient-balance.ts
│       ├── hcm-down.ts
│       └── anniversary-bonus.ts
├── e2e/
│   ├── request-lifecycle.e2e-spec.ts
│   ├── batch-sync.e2e-spec.ts
│   └── concurrent-requests.e2e-spec.ts
└── jest-e2e.json
```

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| **Input validation** | All DTOs validated with `class-validator` decorators. Reject malformed input before business logic. |
| **SQL injection** | TypeORM parameterized queries. No raw SQL. |
| **Batch sync authentication** | The `/sync/batch` endpoint should validate a shared secret or API key header to ensure only the HCM system can push data. |
| **Rate limiting** | Apply rate limits on request creation to prevent abuse. |
| **Data exposure** | Balance and request responses only return data for the requested employee. No bulk employee data leaks. |
| **Idempotency key spoofing** | Keys are scoped per employee — one employee cannot block another's key space. |

---

## 11. Out of Scope

- User authentication and authorization (assumes upstream middleware handles identity)
- Employee/location master data management (assumes seeded via HCM batch)
- Email/notification on request status changes
- Calendar/scheduling integration
- Multi-tenancy
