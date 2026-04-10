import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Balance } from "../src/balance/balance.entity";
import { TimeOffRequest } from "../src/request/request.entity";
import { BalanceModule } from "../src/balance/balance.module";
import { RequestModule } from "../src/request/request.module";
import { BalanceService } from "../src/balance/balance.service";

describe("Request endpoints (e2e)", () => {
  let app: INestApplication;
  let balanceService: BalanceService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "better-sqlite3",
          database: ":memory:",
          entities: [Balance, TimeOffRequest],
          synchronize: true,
        }),
        BalanceModule,
        RequestModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    balanceService = moduleFixture.get<BalanceService>(BalanceService);
    await balanceService.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);
  });

  afterEach(async () => {
    await app.close();
  });

  const validBody = {
    employeeId: "emp-1",
    locationId: "loc-nyc",
    policyType: "VACATION",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
    days: 3,
    reason: "Family vacation",
    idempotencyKey: "e2e-key-001",
  };

  describe("POST /requests", () => {
    it("should create a request and return 201", async () => {
      const res = await request(app.getHttpServer())
        .post("/requests")
        .send(validBody)
        .expect(201);

      expect(res.body.status).toBe("PENDING");
      expect(res.body.employeeId).toBe("emp-1");
      expect(res.body.days).toBe(3);
    });

    it("should return existing request for duplicate idempotency key", async () => {
      const first = await request(app.getHttpServer())
        .post("/requests")
        .send(validBody)
        .expect(201);

      const second = await request(app.getHttpServer())
        .post("/requests")
        .send(validBody)
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
    });

    it("should return 422 for insufficient balance", async () => {
      await request(app.getHttpServer())
        .post("/requests")
        .send({ ...validBody, days: 50, idempotencyKey: "e2e-key-002" })
        .expect(422);
    });
  });

  describe("PATCH /requests/:id/approve", () => {
    it("should approve a pending request", async () => {
      const created = await request(app.getHttpServer())
        .post("/requests")
        .send(validBody)
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/requests/${created.body.id}/approve`)
        .send({ reviewerNote: "Approved!" })
        .expect(200);

      expect(res.body.status).toBe("APPROVED");
      expect(res.body.reviewerNote).toBe("Approved!");
    });
  });

  describe("PATCH /requests/:id/reject", () => {
    it("should reject a pending request", async () => {
      const created = await request(app.getHttpServer())
        .post("/requests")
        .send(validBody)
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/requests/${created.body.id}/reject`)
        .send({ reviewerNote: "Not now" })
        .expect(200);

      expect(res.body.status).toBe("REJECTED");
    });
  });

  describe("PATCH /requests/:id/cancel", () => {
    it("should cancel a pending request", async () => {
      const created = await request(app.getHttpServer())
        .post("/requests")
        .send(validBody)
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/requests/${created.body.id}/cancel`)
        .expect(200);

      expect(res.body.status).toBe("CANCELLED");
    });

    it("should return 422 when cancelling a rejected request", async () => {
      const created = await request(app.getHttpServer())
        .post("/requests")
        .send(validBody)
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/requests/${created.body.id}/reject`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/requests/${created.body.id}/cancel`)
        .expect(422);
    });
  });

  describe("GET /requests", () => {
    it("should list requests with pagination", async () => {
      await request(app.getHttpServer())
        .post("/requests")
        .send(validBody)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get("/requests?employeeId=emp-1")
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.page).toBe(1);
    });

    it("should return empty for non-matching filters", async () => {
      const res = await request(app.getHttpServer())
        .get("/requests?employeeId=unknown")
        .expect(200);

      expect(res.body.total).toBe(0);
      expect(res.body.data).toHaveLength(0);
    });
  });
});
