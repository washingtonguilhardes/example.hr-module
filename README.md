# ExampleHR Time-Off Microservice

A backend microservice that manages employee time-off requests and maintains balance integrity with an external Human Capital Management (HCM) system.

## Overview

ExampleHR serves as the primary interface for employees to request time off, while the HCM system (e.g., Workday, SAP) remains the **source of truth** for employment data. This microservice handles:

- **Request lifecycle** — create, approve, reject, and cancel time-off requests
- **Balance management** — local mirror of HCM balances with optimistic holds for pending requests
- **HCM synchronization** — real-time validation on approval and batch inbound sync
- **Defensive validation** — local checks that work independently of HCM availability

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | NestJS 11 (TypeScript) |
| Database | SQLite via TypeORM |
| Testing | Jest + Supertest |
| API Docs | Swagger UI (OpenAPI) |
| Mock HCM | Standalone Node.js HTTP server |

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9

## Setup

```bash
# Install dependencies
npm install
```

No additional configuration is required. SQLite creates the database file automatically.

## Running the Application

### 1. Start the Mock HCM Server

The mock HCM simulates an external HCM system (Workday/SAP). It runs on port 3001 and provides pre-loaded employee balances.

```bash
npm run mock:hcm
```

### 2. Start the Application

In a separate terminal:

```bash
# Development (with hot reload)
npm run start:dev

# Or production build
npm run build && npm run start:prod
```

The API will be available at **http://localhost:3000**.

### 3. Explore the API

Open **http://localhost:3000/api/docs** for the Swagger UI where you can test all endpoints interactively.

## Quick Start Guide

Once both servers are running, test the full flow:

**Step 1 — Seed balances via batch sync (simulates HCM pushing data):**
```bash
curl -X POST http://localhost:3000/sync/batch \
  -H "Content-Type: application/json" \
  -d '{
    "source": "workday",
    "timestamp": "2026-04-10T00:00:00Z",
    "balances": [
      {"employeeId": "emp-1", "locationId": "loc-nyc", "policyType": "VACATION", "available": 15, "used": 3}
    ]
  }'
```

**Step 2 — Check the balance:**
```bash
curl http://localhost:3000/balances/emp-1
```

**Step 3 — Create a time-off request:**
```bash
curl -X POST http://localhost:3000/requests \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "emp-1",
    "locationId": "loc-nyc",
    "policyType": "VACATION",
    "startDate": "2026-05-01",
    "endDate": "2026-05-05",
    "days": 3,
    "idempotencyKey": "req-001"
  }'
```

**Step 4 — Approve the request (uses the `id` from step 3):**
```bash
curl -X PATCH http://localhost:3000/requests/<REQUEST_ID>/approve \
  -H "Content-Type: application/json" \
  -d '{"reviewerNote": "Enjoy your time off!"}'
```

**Step 5 — Verify the balance was updated:**
```bash
curl http://localhost:3000/balances/emp-1
```

## Running Tests

```bash
# Unit tests (50 tests)
npm test

# E2E tests (26 tests)
npm run test:e2e

# All tests with coverage report
npm run test:cov
```

### Test Coverage

Core business logic coverage:

| Module | Lines |
|--------|-------|
| balance.service.ts | 100% |
| request.service.ts | 92% |
| hcm-client.service.ts | 94% |
| sync.service.ts | 100% |
| request.entity.ts (FSM) | 100% |

### Test Scenarios

The test suite covers:

- **Full request lifecycle** — create -> approve -> balance deduction verified
- **Rejection flow** — create -> reject -> pending hold released
- **Cancellation** — cancel pending (release hold) and cancel approved (restore used)
- **HCM rejection** — approval fails when HCM balance is insufficient
- **HCM outage** — returns 502, request stays PENDING for retry
- **Batch sync** — new balances, updates, conflict detection with pending requests
- **Anniversary bonus** — balance increase via batch sync reconciles correctly
- **Idempotency** — duplicate requests return existing, no double balance hold
- **Defensive validation** — insufficient balance, invalid dates, date overlaps, invalid dimensions
- **State machine** — all valid and invalid transitions tested

## Project Structure

```
src/
  balance/          Balance module (entity, service, controller)
  request/          Request module (entity, service, controller, DTOs)
  hcm/              HCM client module (real-time API communication)
  sync/             Batch sync module (inbound HCM data, SyncLog)
  database/         TypeORM + SQLite configuration
  main.ts           App bootstrap with Swagger setup

test/
  mock-hcm/         Standalone mock HCM server
  *.e2e-spec.ts     E2E tests (balance, request, sync, integration)

docs/
  TRD.md            Technical Requirement Document
  openapi.yaml      OpenAPI 3.0 specification
```

## Architecture

```
Employee/Manager  -->  ExampleHR (localhost:3000)  -->  HCM System (localhost:3001)
                       |                                |
                       | Manages requests,              | Source of truth for
                       | local balances,                | employment data and
                       | defensive validation           | leave balances
                       |                                |
                       SQLite DB                        (Workday / SAP)
```

**Key design decisions:**

- **Eventual consistency** — local balances are a cache of HCM, updated via batch sync and validated on-demand during approval
- **Double validation on approval** — local check first (avoids unnecessary HCM calls), then HCM cross-check
- **Optimistic locking** — prevents concurrent requests from overdrawing balance
- **Idempotency keys** — client-provided keys prevent duplicate submissions
- **Conflict-aware sync** — batch sync applies HCM data (source of truth) but flags conflicts with pending requests rather than auto-cancelling

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/balances/:employeeId` | Get all balances for an employee |
| GET | `/balances/:employeeId/:locationId` | Get balances at a specific location |
| POST | `/balances/seed` | Seed a balance record (dev helper) |
| POST | `/requests` | Create a time-off request |
| GET | `/requests` | List requests (filterable by employeeId, status) |
| PATCH | `/requests/:id/approve` | Approve a request (validates with HCM) |
| PATCH | `/requests/:id/reject` | Reject a request |
| PATCH | `/requests/:id/cancel` | Cancel a request |
| POST | `/sync/batch` | Receive bulk balance data from HCM |

## Documentation

- **[Technical Requirement Document](docs/TRD.md)** — architecture, data model, API design, challenges, and alternatives
- **[OpenAPI Specification](docs/openapi.yaml)** — full API contract
- **Swagger UI** — available at `/api/docs` when the app is running

## License

UNLICENSED
