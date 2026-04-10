import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Balance } from "../src/balance/balance.entity";
import { TimeOffRequest } from "../src/request/request.entity";
import { SyncLog } from "../src/sync/sync-log.entity";
import { BalanceModule } from "../src/balance/balance.module";
import { RequestModule } from "../src/request/request.module";
import { SyncModule } from "../src/sync/sync.module";
import { HcmClientService } from "../src/hcm/hcm-client.service";
import { GlobalExceptionFilter } from "../src/common/filters/http-exception.filter";

const mockHcmClient = {
  getBalance: jest.fn().mockResolvedValue({ available: 15, used: 3 }),
  submitTimeOff: jest.fn().mockResolvedValue({ submissionId: "mock", status: "ACCEPTED" }),
};

describe("Input validation and error handling (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "better-sqlite3",
          database: ":memory:",
          entities: [Balance, TimeOffRequest, SyncLog],
          synchronize: true,
        }),
        BalanceModule,
        RequestModule,
        SyncModule,
      ],
    })
      .overrideProvider(HcmClientService)
      .useValue(mockHcmClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /requests — validation", () => {
    it("should reject missing required fields", async () => {
      const res = await request(app.getHttpServer())
        .post("/requests")
        .send({})
        .expect(400);

      expect(res.body.message).toBeInstanceOf(Array);
      expect(res.body.message.length).toBeGreaterThan(0);
    });

    it("should reject invalid policyType", async () => {
      const res = await request(app.getHttpServer())
        .post("/requests")
        .send({
          employeeId: "emp-1",
          locationId: "loc-nyc",
          policyType: "INVALID",
          startDate: "2026-05-01",
          endDate: "2026-05-05",
          days: 3,
          idempotencyKey: "val-001",
        })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining("policyType")]),
      );
    });

    it("should reject invalid date format", async () => {
      const res = await request(app.getHttpServer())
        .post("/requests")
        .send({
          employeeId: "emp-1",
          locationId: "loc-nyc",
          policyType: "VACATION",
          startDate: "not-a-date",
          endDate: "2026-05-05",
          days: 3,
          idempotencyKey: "val-002",
        })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining("startDate")]),
      );
    });

    it("should reject negative days", async () => {
      const res = await request(app.getHttpServer())
        .post("/requests")
        .send({
          employeeId: "emp-1",
          locationId: "loc-nyc",
          policyType: "VACATION",
          startDate: "2026-05-01",
          endDate: "2026-05-05",
          days: -1,
          idempotencyKey: "val-003",
        })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining("days")]),
      );
    });

    it("should reject unknown fields", async () => {
      const res = await request(app.getHttpServer())
        .post("/requests")
        .send({
          employeeId: "emp-1",
          locationId: "loc-nyc",
          policyType: "VACATION",
          startDate: "2026-05-01",
          endDate: "2026-05-05",
          days: 3,
          idempotencyKey: "val-004",
          hackerField: "malicious",
        })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining("hackerField")]),
      );
    });
  });

  describe("POST /sync/batch — validation", () => {
    it("should reject missing source", async () => {
      const res = await request(app.getHttpServer())
        .post("/sync/batch")
        .send({ timestamp: "2026-04-10T00:00:00Z", balances: [] })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining("source")]),
      );
    });

    it("should reject invalid balance items", async () => {
      const res = await request(app.getHttpServer())
        .post("/sync/batch")
        .send({
          source: "workday",
          timestamp: "2026-04-10T00:00:00Z",
          balances: [{ employeeId: "emp-1" }],
        })
        .expect(400);

      expect(res.body.message.length).toBeGreaterThan(0);
    });
  });

  describe("Error response format", () => {
    it("should return structured 404 for unknown request", async () => {
      const res = await request(app.getHttpServer())
        .patch("/requests/00000000-0000-0000-0000-000000000000/approve")
        .send({})
        .expect(404);

      expect(res.body).toHaveProperty("statusCode", 404);
      expect(res.body).toHaveProperty("error");
      expect(res.body).toHaveProperty("message");
    });
  });
});
