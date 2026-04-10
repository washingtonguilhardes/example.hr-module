---
name: test
description: required reading for all test/spec files or test related queries.
targets:
  - '*'
---

# /test - Test Quality & Coverage

Quality guardrails for AI-generated tests at any layer (unit, integration, HTTP, E2E), plus a coverage workflow for adding tests to existing code.

> [!IMPORTANT]
> This skill defines what makes a **correct** test. For Playwright-specific mechanics (selectors, fixtures, Docker verification), also load `/e2e`. For RC smoke test coverage rules, also load `/e2e-rc`.

## Test Naming Rule

> [!IMPORTANT]
> Test names must describe **expected user behavior only**.
> Test names must **never** include implementation details.
> Test names must **never** use vague wording like "as expected", "works correctly", or "should work".

**Required:** Describe what the user does and what the user observes. Focus on externally visible behavior, not internals.

**Forbidden in test names:**
- Internal function names, hook names, reducers, component internals
- API endpoint names, database/storage details, mock/setup mechanics
- Generic assertions without behavior context ("as expected", "returns correct value")

**Good examples:**
- `"when I login with valid credentials, I am redirected to the dashboard"`
- `"when I remove an item from cart, the total updates immediately"`
- `"sending a message in a space makes it visible in the thread"`

**Bad examples:**
- `"useLoginMutation returns success as expected"`
- `"cart reducer updates state correctly"`
- `"POST /api/files returns 200"`

If the current behavior differs from what the title describes, either fix the code or use `it.fails()`.

## Context Acquisition (Before Writing Anything)

1. **Start from user expectations.** What should the user be able to do? What are the expected outcomes for both success and failure? Build tests from these expectations first, then read the code to refine. This avoids validating bugs as correct behavior.
2. **Read existing helpers.** Check `tests/`, `e2e/helpers/`, `e2e/fixtures/`, and colocated test files for established patterns, seed builders, and assertion utilities.
3. **Read the public API or schema** for the code under test (OpenAPI spec, tRPC router, component props).
4. **Read similar tests** in the same repo to match style, naming, and infrastructure patterns.
5. **Use existing test infrastructure.** Never invent a new HTTP helper, seed builder, or assertion utility when one already exists.

## Coverage Workflow

Use this workflow when adding test coverage to existing code. For new features or bugfixes, use `/tdd` (test-first).

1. **Discovery:** Ask: "What to test? (file/folder/feature)." Examine code for functionality, dependencies, and complexity.
2. **Scope:** Determine test type (unit / integration / HTTP / E2E), specific cases, update existing or create new. E2E policy is in `rules/e2e-testing.md`.
3. **Analyze:** Read target files. Understand signatures, behaviors, dependencies. Note error handling and edge cases. Check existing coverage.
4. **Write tests:** Apply the quality rules below. Unit tests go in `.test.ts` alongside source. HTTP integration tests go in `tests/harpoon/`. E2E tests go in `e2e/specs/`.
5. **Verify:** Run tests. Fix failures. Check lint.
6. **Quality check:** Run the [Pre-Submit Quality Check](#pre-submit-quality-check) before marking complete.

## Bug Discovery Protocol

**Finding a bug during test writing is a deliverable, not an obstacle.**

When a test reveals unexpected behavior in the system under test:

1. **ASK**: Ask the user whether this is expected behavior, a known limitation, or a potential bug. If the user is not available, state the uncertainty explicitly in a comment and do not convert the observed behavior into the asserted contract.
2. **If application bug, in scope**: Fix it. The bug fix is part of your deliverable, not a separate task.
3. **If application bug, out of scope**: Write the test with `it.fails()` (Vitest) or `test.fail()` (Playwright), link a filed issue, and document expected vs. actual behavior. Get human approval before adding the xfail. See [xfail Guidance](#xfail-guidance).
4. **NEVER** write a green test that asserts broken behavior as correct.
5. **NEVER** silently remove or modify test setup to avoid triggering a bug.
6. **DOCUMENT**: Add a comment explaining your diagnosis and decision.

### The Key Reframe

Your objective is **verify correctness and surface bugs**, not **make tests green**. A failing test that exposes a real bug is more valuable than a passing test that hides one.

## Assertion Depth Checklist

Every test must verify at minimum:

| Layer | Status/Return | Response Shape | Behavioral Side Effect |
|-------|:---:|:---:|:---:|
| HTTP integration | Required | Required (at least 1 field) | Required for mutations |
| Unit | N/A | Return value verified | State change verified if stateful |
| E2E (browser) | N/A | UI element verified | Action outcome visible |

**A test with only a status code assertion is INCOMPLETE.** It proves the server didn't crash, not that it did the right thing.

### Per-Layer Requirements

**HTTP / Integration tests:**
- Assert a status code that matches HTTP semantics for the operation (e.g., 201 for resource creation, 204 for successful deletion, 4xx for client errors, per RFC 9110). Do not accept `200 { status: "failed" }` patterns as valid.
- Assert at least one response body field per entity returned
- For mutations: verify the action happened via a follow-up read
- For error cases: verify error format (code, message structure), not just status
- For binary responses: verify content-type and content-length

**Unit tests:**
- Assert results match the test's behavioral claim, including return values, status codes, metadata, and data
- For stateful operations: verify state changed
- For error paths: verify the specific error, not just "it threw"

**E2E (browser) tests:**
- Assert UI elements reflect the action (follow `/e2e` skill for selector strategy)
- For mutations: verify persistence (reload or navigate away and back)

### Batch Operations

Verify each item in the batch result, not just the first. A common shortcut is to assert `result.length > 0` without checking individual items.

## Anti-Pattern Taxonomy

Five categories of AI test-writing failures, ordered by severity.

### 1. BUG-PROTECTOR (fix immediately)

The test asserts broken behavior as correct. It is green, looks intentional, and actively hides the bug.

**Detection signals:**
- `expect(status).toBe(500)` in a happy-path test (500 is never correct behavior)
- Comments containing "known limitation", "documents current behavior", "known issue"
- Test title describes what goes wrong: "returns 500 for void-returning procedure"

**Fix:** Fix the application code, or use `it.fails()` with a linked issue. Never assert broken behavior.

### 2. SYNTAX-BUG (fix immediately)

The assertion has a syntax error or omits the matcher, so nothing is actually asserted.

**Detection signals:**
- Missing matcher: `expect(result)` with no `.toBe()`/`.toEqual()` (always passes)
- Missing parentheses: `expect(x).not.toBeNull` (compares against function reference)
- Comparison inside expect without matcher: `expect(arr.length > 0)` (always passes)
- Array literal in `in` expression: `expect(['.tag'] in body)` (unintended coercion)

**Fix:** Correct the syntax. The test was asserting nothing.

### 3. WORKAROUND (fix soon)

The test avoids triggering a bug by changing test setup instead of asserting the bug.

**Detection signals:**
- POST endpoint called with no body (unusual for HTTP POST)
- Parameters omitted that the API spec includes, without clear explanation
- Comment says "omit X to avoid Y" or silently removes parameters
- Test uses a different transport than what it claims to test (e.g., tRPC caller instead of HTTP)

**Fix:** Diagnose whether the omitted behavior is correct or broken. Fix the right side, restore the parameter, test both paths.

### 4. PHANTOM COVERAGE (fix soon)

The test claims to be an integration test but hits a mock, stub, or wrong endpoint.

**Detection signals:**
- `vi.mock()` or `jest.mock()` in files labeled "integration"
- Base URL differs from actual server config
- Tests run suspiciously fast (<5ms per test for what should be real HTTP)
- Test calls `/api/v2/endpoint` but real code is at `/api/v1/endpoint`

**Fix:** Remove the mock or re-label the test. Integration tests hit real code.

### 5. THIN (fix in batch)

The test checks that the endpoint returns 200 but never verifies the response or side effects.

**Detection signals:**
- Only assertion is `expect(status).toBe(200)`
- No `body` or `response` variable read after the call
- Multiple tests with identical copy-paste pattern (different endpoints, same single assertion)
- Binary/streaming endpoints with no content-type or content-length checks

**Fix:** Add response shape and behavioral assertions per the [Assertion Depth Checklist](#assertion-depth-checklist).

## HTTP Integration Oracle Discipline

The highest-risk layer for quality failures. Concrete requirements:

**Mutations (POST, PUT, PATCH, DELETE):**
- Assert response status AND at least one response body field
- Verify the action happened via a follow-up read (e.g., GET the created resource)
- For delete: verify the resource is gone

**Reads (GET, LIST):**
- Assert at least one of: meaningful invariant, schema/shape + contract-significant fields, or round-trip/property check
- For list endpoints: verify count matches expectation, check at least one item's fields

**Error cases:**
- Assert error format (code, message structure), not just status >= 400
- Use existing error assertion helpers when available (e.g., `expectDropboxError`)

## xfail Guidance

> [!IMPORTANT]
> `it.fails()` / `test.fail()` is ONLY for known product bugs that are out of scope. It is not a general-purpose tool.

**For intended negative-path behavior** (expected errors, validation failures): use normal assertion-level error checks like `expect(...).rejects.toThrow()`, `expect(status).toBe(400)`, or equivalent. These are normal tests, not xfails.

**For known product bugs out of scope:** use `it.fails()` (Vitest) or `test.fail()` (Playwright) with:
- A linked tracking issue in the test comment
- A reason explaining expected vs. actual behavior
- Human approval before adding

```typescript
it.fails('append_v2 returns 200 for empty body', async () => {
  // BUG: adapter crashes on void result (HOT-3043)
  // Expected: 200 with null body
  // Actual: 500 due to NextResponse.json(undefined)
  const result = await httpV1.post('/files/upload_session/append_v2', { cursor, close: false });
  expect(result.status).toBe(200);
});
```

**Key inversion:** The assertion inside `it.fails()` describes **correct** behavior. When the bug is fixed, the test passes and `it.fails()` flags it for removal. **Changing the assertion to match the bug IS the anti-pattern.**

**Never use xfail to:**
- Avoid writing a proper test
- Skip flaky tests (fix the flakiness instead)
- Test intended error paths (use normal error assertions)
- Defer work that should be done in this PR
- Accumulate a backlog of "known failures" without linked issues

## Contract Source Hierarchy

Where expected behavior is allowed to come from, in priority order:

1. **Specification or requirements document** (strongest: documented intent)
2. **OpenAPI schema** (strong: machine-readable contract)
3. **Existing checklist item or acceptance criteria** (good: reviewed intent)
4. **Behavioral invariant** (good: e.g., round-trip symmetry, idempotency)
5. **Characterization of current behavior** (weakest: must be explicitly labeled)

If your test asserts current behavior rather than specified behavior, add a comment: `// Characterization test: asserts current behavior, not spec.` Characterization tests are legitimate for legacy safety nets but must never be passed off as verification.

## Per-Test Fields

Every test should be able to answer two questions:
1. **Contract source:** Where does the expected behavior come from? (spec, OpenAPI, checklist, invariant, or characterization)
2. **What bug would this catch?** If you can't name a specific failure mode this test would detect, the test may not be worth writing.

## Legitimate-Change-Resistance Gate

Before writing a test, ask: **"Would this test break under a legitimate refactor?"** If the answer is yes, the test is coupled to implementation, not behavior. Don't write it. Tests should break when behavior changes, not when code is reorganized.

## Transport Fidelity

Tests must use the transport they claim to test.

- HTTP integration tests use HTTP (fetch, axios, test helper). Never substitute a tRPC caller.
- tRPC tests use the tRPC client. Never substitute raw HTTP.
- E2E tests use the browser. Never substitute direct API calls for UI verification.

If the transport under test is broken, that is the bug to fix, not a reason to switch transports.

## Pre-Submit Quality Check

Before marking any test work complete, verify each test against:

- [ ] No `expect(500)` or `expect(4xx)` in happy-path tests
- [ ] No "known limitation" or "documents current behavior" comments near assertions
- [ ] No parameters silently omitted that the API spec requires
- [ ] Every `expect()` call has a matcher (`.toBe`, `.toEqual`, `.toMatchObject`, etc.)
- [ ] Test title describes expected user behavior, not implementation or observed bugs
- [ ] Tests use the transport they claim to test
- [ ] No `vi.mock()`/`jest.mock()` in integration test files
- [ ] Mutations verified via follow-up read (not just status code)
- [ ] Existing assertion helpers used where available
- [ ] Error cases verify error format, not just status >= 400
- [ ] Would not break under a legitimate refactor (behavior-coupled, not implementation-coupled)
- [ ] Can name the contract source and the bug this test would catch
- [ ] No skips or xfails added without human approval and a linked issue

## Exemplar Patterns

**Behavioral follow-up read (HTTP integration):**
```typescript
// Create, then verify via independent GET
const createResult = await api.post('/files/create_folder_v2', { path: '/new-folder' });
expect(createResult.status).toBe(200);
expect(createResult.body).toMatchObject({ metadata: { name: 'new-folder' } });

// Behavioral verification: folder actually exists
const listResult = await api.post('/files/list_folder', { path: '' });
const names = listResult.body.entries.map(e => e.name);
expect(names).toContain('new-folder');
```

**Structured error assertion:**
```typescript
// Use existing helpers when available
await expectDropboxError(result, 409, 'path/not_found');

// Or assert error shape directly
expect(result.status).toBe(409);
expect(result.body).toMatchObject({
  error_summary: expect.stringContaining('path/not_found'),
  error: { '.tag': 'path', path: { '.tag': 'not_found' } }
});
```

**Detailed failure message for debugging:**
```typescript
// Include response body in failure message for easier debugging
const result = await api.post('/files/list_locked_files', body);
expect(
  result.status,
  `Expected 200 but got ${result.status}. Body: ${JSON.stringify(result.body)}`
).toBe(200);
```

**xfail with linked issue (known bug, out of scope):**
```typescript
it.fails('list_locked_files accepts empty body (HOT-3044)', async () => {
  // BUG: z.void().optional() rejects {} over HTTP
  // tRPC caller works because it omits the body entirely
  const result = await api.post('/files/list_locked_files', {});
  expect(result.status).toBe(200);
});
```

**Round-trip symmetry (invariant-based):**
```typescript
it('upload then download returns identical content', async () => {
  const content = Buffer.from('test file content');
  await api.upload('/files/upload', { path: '/test.txt' }, content);

  const downloaded = await api.download('/files/download', { path: '/test.txt' });
  expect(downloaded.body).toEqual(content);
});
```
