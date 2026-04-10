---
name: schema-and-type-safety
description: >-
  Enforce relational schema design over JSON columns, and prevent TypeScript
  type-safety evasion (any, oxlint-disable, type casting)
---
# Schema Design & TypeScript Type-Safety

## When to Use

Invoke this skill when:
- Designing or modifying database schemas (new tables, new columns, entity relationships)
- Reviewing code that introduces `any`, `unknown` without guards, `oxlint-disable`, or `as` casts
- An agent proposes a JSON/JSONB column for structured data
- Refactoring types or fixing type errors

## Part 1: Relational Schema Design

### The Rule

**99% of the time, use relational tables with proper foreign keys. Do not use JSON/JSONB columns for structured data.**

JSON columns create: no referential integrity, no queryability, no type safety (Prisma types JSON as `JsonValue`), and no schema evolution path.

### When JSON IS Acceptable

Only when ALL of these are true:
1. The data is genuinely unstructured (e.g., third-party webhook payloads)
2. You never need to query, filter, or join on the data
3. The data has no relationships to other entities
4. The data shape varies per row by design, not by laziness

### Decision Checklist

| Question | If Yes |
|----------|--------|
| Will you filter/sort by fields inside this data? | Use a relational table |
| Does this data relate to other entities? | Use a relational table with FKs |
| Could this data grow to have its own lifecycle (CRUD)? | Use a relational table |
| Is the shape consistent across rows? | Use a relational table |
| Is this third-party data you do not control? | JSON column is acceptable |

### Examples

```prisma
// ❌ BAD: JSON column for structured data
model Project {
  id       String @id @default(uuid())
  name     String
  settings Json   // { theme: "dark", members: [{ userId: "...", role: "admin" }] }
}

// ✅ GOOD: Relational tables
model Project {
  id       String            @id @default(uuid())
  name     String
  settings ProjectSettings?
  members  ProjectMember[]
}

model ProjectSettings {
  id           String  @id @default(uuid())
  project_id   String  @unique
  theme        String  @default("light")
  email_notify Boolean @default(true)
  project      Project @relation(fields: [project_id], references: [id])
}

model ProjectMember {
  id         String  @id @default(uuid())
  project_id String
  user_id    String
  role       String  @default("member")
  project    Project @relation(fields: [project_id], references: [id])
  user       User    @relation(fields: [user_id], references: [id])

  @@unique([project_id, user_id])
}
```

```prisma
// ✅ ACCEPTABLE: Genuinely unstructured data
model WebhookEvent {
  id          String   @id @default(uuid())
  source      String
  event_type  String
  payload     Json     // Third-party webhook body, shape varies by source
  received_at DateTime @default(now())

  @@index([source, event_type])
}
```

## Part 2: TypeScript Type-Safety Enforcement

### Prohibited Patterns

**1. `any` type**
```typescript
// ❌ BAD
function processData(data: any) { return data.items.map((item: any) => item.name); }

// ✅ GOOD: unknown + type guard
function processData(data: unknown): string[] {
  if (!isDataWithItems(data)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "invalid_data_shape" });
  }
  return data.items.map((item) => item.name);
}
```

**2. `oxlint-disable` comments**
```typescript
// ❌ BAD: Hiding the problem
// oxlint-disable-next-line -- no-explicit-any
const result = response as any;

// ✅ GOOD: Fix the actual type
const result: ApiResponse = responseSchema.parse(response);
```

Never add `oxlint-disable` comments. If a lint rule fires, the code has a real problem.

**3. Type casting to bypass checks**
```typescript
// ❌ BAD
const user = rawData as User;
const config = JSON.parse(text) as AppConfig;

// ✅ GOOD: Runtime validation
const user = userSchema.parse(rawData);
const config = appConfigSchema.parse(JSON.parse(text));
```

**4. Non-null assertions (`!`)**
```typescript
// ❌ BAD
const name = user.profile!.name!;

// ✅ GOOD
const name = user.profile?.name ?? "Unknown";
```

### Advanced Patterns to Use Instead

**Const assertions:**
```typescript
const ROLES = ["admin", "member", "viewer"] as const;
type Role = (typeof ROLES)[number]; // "admin" | "member" | "viewer"
```

**`satisfies` for type checking without widening:**
```typescript
const config = {
  theme: "dark",
  maxRetries: 3,
} satisfies Partial<AppConfig>;
// config.theme is "dark" (literal), not string
```

**Discriminated unions:**
```typescript
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };
```

**Generic constraints:**
```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```
