---
name: monitor
description: Add structured logging and error tracking for observability
---
# MONITOR Task

**Persona:** Execute this task as the `@developer` subagent.
Load the persona characteristics from `.rulesync/subagents/developer.md` before proceeding.

## Objective

Add structured logging and error tracking to improve observability, debugging, monitoring.

## Instructions

1. **Discovery:** - Ask: Code to monitor? (file/function/feature), Monitoring level? (basic logging/detailed tracing/error tracking), Specific error scenarios?, Error boundaries for frontend?

2. **Review existing:** - Check console.log/console.error usage - Review error handling in tRPC procedures - Examine TRPCError patterns

3. **Add structured logging (tRPC):** - Log at entry: `console.log("[procedure] Starting", {userId, input})` - Log success: `console.log("[procedure] Success", {result})` - Log errors: `console.error("[procedure] Failed", {error, context})` - Use TRPCError with appropriate codes

4. **Error boundaries (React):** - Create ErrorBoundary component: `getDerivedStateFromError`, `componentDidCatch` with logging - Use: `<ErrorBoundary name="ComponentName" fallback={...}>{children}</ErrorBoundary>`

5. **TRPCError usage:** - NOT_FOUND: Channel/user not found - FORBIDDEN: Not authorized - BAD_REQUEST: Validation error - INTERNAL_SERVER_ERROR: Operation failed (with cause)

6. **Logging points:** - Procedure entry (with input), Database operations, Business logic decisions, Errors/exceptions, Procedure exit (with results)

7. **Security:** - Never log: passwords, API tokens - Caution with: user data in logs - Log: error codes, not sensitive details - Use structured logging (JSON objects)

8. **Performance monitoring:** - Track execution time for slow operations - Log duration, flag if > threshold

9. **Test error scenarios:** - Add tests to verify error handling - Test error paths ensure handled correctly

10. **Quality checks:** - `pnpm lint && pnpm typecheck && pnpm test`

11. **Summary:** - Procedures/components instrumented - Error boundaries added - Logging added (entry/exit/errors/performance) - Security considerations - Testing coverage - Log analysis examples

## Example Prompts

- `/monitor app/api/trpc/routers/channels.ts --level detailed` - Adds structured entry/exit/error logging to each procedure, tracks execution duration, and uses TRPCError codes consistently.
- `/monitor app/ --level basic --error-boundaries` - Adds ErrorBoundary components around key UI sections with meaningful fallback UI and error logging to console.

## Quality Criteria

- Logging uses structured format with JSON objects (e.g., `{procedure, userId, duration}`) not string concatenation
- Sensitive data (passwords, tokens, API keys, PII) is never logged -- even at debug level
- Error boundaries include meaningful fallback UI that tells the user what went wrong, not just a generic "Something went wrong"
- Performance thresholds are documented next to timing checks (e.g., `// warn if > 500ms`)
- TRPCError codes match the semantic meaning: NOT_FOUND, FORBIDDEN, BAD_REQUEST, INTERNAL_SERVER_ERROR
- Every procedure has at minimum entry and error logging after instrumentation

## Scope Boundaries

- Add observability (logging, error boundaries, timing) -- do NOT refactor business logic
- Add error boundaries -- do NOT change existing error handling behavior or catch logic
- Do NOT introduce new dependencies or logging libraries without discussion
- Do NOT modify test assertions unless a test explicitly validates logging output

## Cross-References

- `/audit` - Identifies observability gaps and missing error handling
- `/review` - Checks logging quality and security of log statements
