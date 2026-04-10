import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Balance } from "../src/balance/balance.entity";
import { TimeOffRequest } from "../src/request/request.entity";
import { SyncLog } from "../src/sync/sync-log.entity";
import { BalanceModule } from "../src/balance/balance.module";
import { RequestModule } from "../src/request/request.module";
import { SyncModule } from "../src/sync/sync.module";
import { HcmClientService } from "../src/hcm/hcm-client.service";
import { MockHcmServer } from "./mock-hcm/mock-hcm.server";

describe("Integration tests (e2e)", () => {
  let app: INestApplication;
  let mockHcm: MockHcmServer;
  let hcmPort: number;

  beforeEach(async () => {
    // Start mock HCM with realistic balances
    mockHcm = new MockHcmServer({
      balances: [
        { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 15, used: 3 },
        { employeeId: "emp-1", locationId: "loc-nyc", policyType: "SICK", available: 10, used: 1 },
        { employeeId: "emp-2", locationId: "loc-nyc", policyType: "VACATION", available: 20, used: 5 },
      ],
    });
    hcmPort = await mockHcm.start();

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
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Point HCM client at mock server
    const hcmClient = moduleFixture.get<HcmClientService>(HcmClientService);
    hcmClient.setConfig({
      baseUrl: `http://localhost:${hcmPort}`,
      timeoutMs: 2000,
      maxRetries: 0,
    });
  });

  afterEach(async () => {
    await app.close();
    await mockHcm.stop();
  });

  async function seedBalancesViaBatchSync() {
    return request(app.getHttpServer())
      .post("/sync/batch")
      .send({
        source: "workday",
        timestamp: "2026-04-10T00:00:00Z",
        balances: [
          { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 15, used: 3 },
          { employeeId: "emp-1", locationId: "loc-nyc", policyType: "SICK", available: 10, used: 1 },
          { employeeId: "emp-2", locationId: "loc-nyc", policyType: "VACATION", available: 20, used: 5 },
        ],
      });
  }

  describe("Full request lifecycle", () => {
    it("create -> approve -> verify balance deduction", async () => {
      await seedBalancesViaBatchSync();

      // Create request
      const created = await request(app.getHttpServer())
        .post("/requests")
        .send({
          employeeId: "emp-1",
          locationId: "loc-nyc",
          policyType: "VACATION",
          startDate: "2026-05-01",
          endDate: "2026-05-05",
          days: 3,
          idempotencyKey: "int-001",
        })
        .expect(201);

      expect(created.body.status).toBe("PENDING");

      // Verify pending hold
      const pendingBalance = await request(app.getHttpServer())
        .get("/balances/emp-1/loc-nyc")
        .expect(200);
      const vacBalance = pendingBalance.body.balances.find((b: any) => b.policyType === "VACATION");
      expect(vacBalance.pending).toBe(3);
      expect(vacBalance.effectiveAvailable).toBe(9); // 15 - 3 - 3

      // Approve
      const approved = await request(app.getHttpServer())
        .patch(`/requests/${created.body.id}/approve`)
        .send({ reviewerNote: "Enjoy!" })
        .expect(200);

      expect(approved.body.status).toBe("APPROVED");
      expect(approved.body.hcmSubmissionId).toBeTruthy();

      // Verify balance after approval
      const finalBalance = await request(app.getHttpServer())
        .get("/balances/emp-1/loc-nyc")
        .expect(200);
      const finalVac = finalBalance.body.balances.find((b: any) => b.policyType === "VACATION");
      expect(finalVac.pending).toBe(0);
      expect(finalVac.used).toBe(6); // 3 original + 3 deducted
      expect(finalVac.effectiveAvailable).toBe(9);

      // Verify HCM received the submission
      expect(mockHcm.getSubmissions()).toHaveLength(1);
      expect(mockHcm.getSubmissions()[0].employeeId).toBe("emp-1");
    });

    it("create -> reject -> verify balance released", async () => {
      await seedBalancesViaBatchSync();

      const created = await request(app.getHttpServer())
        .post("/requests")
        .send({
          employeeId: "emp-1",
          locationId: "loc-nyc",
          policyType: "VACATION",
          startDate: "2026-06-01",
          endDate: "2026-06-03",
          days: 2,
          idempotencyKey: "int-002",
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/requests/${created.body.id}/reject`)
        .send({ reviewerNote: "Bad timing" })
        .expect(200);

      const balance = await request(app.getHttpServer())
        .get("/balances/emp-1/loc-nyc")
        .expect(200);
      const vac = balance.body.balances.find((b: any) => b.policyType === "VACATION");
      expect(vac.pending).toBe(0);
      expect(vac.used).toBe(3); // unchanged
    });

    it("create -> approve -> cancel -> verify balance restored", async () => {
      await seedBalancesViaBatchSync();

      const created = await request(app.getHttpServer())
        .post("/requests")
        .send({
          employeeId: "emp-1",
          locationId: "loc-nyc",
          policyType: "VACATION",
          startDate: "2026-07-01",
          endDate: "2026-07-03",
          days: 2,
          idempotencyKey: "int-003",
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/requests/${created.body.id}/approve`)
        .expect(200);

      // Cancel the approved request
      const cancelled = await request(app.getHttpServer())
        .patch(`/requests/${created.body.id}/cancel`)
        .expect(200);

      expect(cancelled.body.status).toBe("CANCELLED");

      const balance = await request(app.getHttpServer())
        .get("/balances/emp-1/loc-nyc")
        .expect(200);
      const vac = balance.body.balances.find((b: any) => b.policyType === "VACATION");
      expect(vac.used).toBe(3); // restored back to original
    });
  });

  describe("HCM rejection scenarios", () => {
    it("should fail approval when HCM balance is insufficient", async () => {
      await seedBalancesViaBatchSync();

      // HCM has 12 available (15 - 3), but let's request all of it
      // Then update HCM mock to reduce the balance before approval
      const created = await request(app.getHttpServer())
        .post("/requests")
        .send({
          employeeId: "emp-1",
          locationId: "loc-nyc",
          policyType: "VACATION",
          startDate: "2026-08-01",
          endDate: "2026-08-20",
          days: 10,
          idempotencyKey: "int-004",
        })
        .expect(201);

      // Simulate HCM balance drop
      mockHcm.updateBalance("emp-1", "loc-nyc", { available: 5, used: 4 });

      // Approve should fail because HCM now shows only 1 day available
      const res = await request(app.getHttpServer())
        .patch(`/requests/${created.body.id}/approve`)
        .expect(422);

      expect(res.body.error).toBe("HCM_VALIDATION_ERROR");
    });
  });

  describe("Batch sync with conflicts", () => {
    it("should detect conflict when sync reduces balance below pending", async () => {
      await seedBalancesViaBatchSync();

      // Create a pending request
      await request(app.getHttpServer())
        .post("/requests")
        .send({
          employeeId: "emp-1",
          locationId: "loc-nyc",
          policyType: "VACATION",
          startDate: "2026-09-01",
          endDate: "2026-09-10",
          days: 8,
          idempotencyKey: "int-005",
        })
        .expect(201);

      // Batch sync reduces balance — conflict expected
      const syncRes = await request(app.getHttpServer())
        .post("/sync/batch")
        .send({
          source: "workday",
          timestamp: "2026-04-10T12:00:00Z",
          balances: [
            { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 5, used: 3 },
          ],
        })
        .expect(201);

      expect(syncRes.body.conflicts).toBe(1);
      expect(syncRes.body.applied).toBe(1); // still applied

      // Balance was updated despite conflict
      const balance = await request(app.getHttpServer())
        .get("/balances/emp-1/loc-nyc")
        .expect(200);
      const vac = balance.body.balances.find((b: any) => b.policyType === "VACATION");
      expect(vac.available).toBe(5);
      expect(vac.pending).toBe(8); // still held
      expect(vac.effectiveAvailable).toBe(-6); // negative — approval would fail
    });
  });

  describe("HCM unavailable", () => {
    it("should return 502 when HCM is down during approval", async () => {
      await seedBalancesViaBatchSync();

      const created = await request(app.getHttpServer())
        .post("/requests")
        .send({
          employeeId: "emp-1",
          locationId: "loc-nyc",
          policyType: "VACATION",
          startDate: "2026-10-01",
          endDate: "2026-10-03",
          days: 2,
          idempotencyKey: "int-006",
        })
        .expect(201);

      // Stop mock HCM to simulate outage
      await mockHcm.stop();

      const res = await request(app.getHttpServer())
        .patch(`/requests/${created.body.id}/approve`)
        .expect(502);

      expect(res.body.error).toBe("HCM_UNAVAILABLE");

      // Request should still be PENDING
      const listRes = await request(app.getHttpServer())
        .get(`/requests?employeeId=emp-1&status=PENDING`)
        .expect(200);
      expect(listRes.body.total).toBe(1);
    });
  });

  describe("Idempotency and duplicate prevention", () => {
    it("should return same request for duplicate idempotency key", async () => {
      await seedBalancesViaBatchSync();

      const body = {
        employeeId: "emp-1",
        locationId: "loc-nyc",
        policyType: "VACATION",
        startDate: "2026-11-01",
        endDate: "2026-11-03",
        days: 2,
        idempotencyKey: "int-007",
      };

      const first = await request(app.getHttpServer())
        .post("/requests")
        .send(body)
        .expect(201);

      const second = await request(app.getHttpServer())
        .post("/requests")
        .send(body)
        .expect(201);

      expect(second.body.id).toBe(first.body.id);

      // Balance should only be held once
      const balance = await request(app.getHttpServer())
        .get("/balances/emp-1/loc-nyc")
        .expect(200);
      const vac = balance.body.balances.find((b: any) => b.policyType === "VACATION");
      expect(vac.pending).toBe(2); // not 4
    });
  });

  describe("Balance refresh scenarios", () => {
    it("should handle anniversary bonus via batch sync", async () => {
      await seedBalancesViaBatchSync();

      // Initial balance: 15 available
      // Simulate anniversary bonus: HCM increases to 20
      const syncRes = await request(app.getHttpServer())
        .post("/sync/batch")
        .send({
          source: "workday",
          timestamp: "2026-04-10T18:00:00Z",
          balances: [
            { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 20, used: 3 },
          ],
        })
        .expect(201);

      expect(syncRes.body.conflicts).toBe(0);

      const balance = await request(app.getHttpServer())
        .get("/balances/emp-1/loc-nyc")
        .expect(200);
      const vac = balance.body.balances.find((b: any) => b.policyType === "VACATION");
      expect(vac.available).toBe(20);
      expect(vac.effectiveAvailable).toBe(17); // 20 - 3 - 0
    });
  });
});
