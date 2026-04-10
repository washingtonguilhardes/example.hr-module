import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Balance } from "../src/balance/balance.entity";
import { SyncLog } from "../src/sync/sync-log.entity";
import { BalanceModule } from "../src/balance/balance.module";
import { SyncModule } from "../src/sync/sync.module";
import { BalanceService } from "../src/balance/balance.service";

describe("Sync endpoints (e2e)", () => {
  let app: INestApplication;
  let balanceService: BalanceService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "better-sqlite3",
          database: ":memory:",
          entities: [Balance, SyncLog],
          synchronize: true,
        }),
        BalanceModule,
        SyncModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    balanceService = moduleFixture.get<BalanceService>(BalanceService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /sync/batch", () => {
    it("should sync balances and return summary", async () => {
      const res = await request(app.getHttpServer())
        .post("/sync/batch")
        .send({
          source: "workday",
          timestamp: "2026-04-10T00:00:00Z",
          balances: [
            { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 15, used: 3 },
            { employeeId: "emp-2", locationId: "loc-la", policyType: "SICK", available: 10, used: 0 },
          ],
        })
        .expect(201);

      expect(res.body.received).toBe(2);
      expect(res.body.applied).toBe(2);
      expect(res.body.conflicts).toBe(0);
    });

    it("should report conflicts with pending requests", async () => {
      const balance = await balanceService.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);
      await balanceService.holdPending(balance, 8);

      const res = await request(app.getHttpServer())
        .post("/sync/batch")
        .send({
          source: "workday",
          timestamp: "2026-04-10T00:00:00Z",
          balances: [
            { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 5, used: 3 },
          ],
        })
        .expect(201);

      expect(res.body.conflicts).toBe(1);
      expect(res.body.conflictDetails[0].employeeId).toBe("emp-1");
      expect(res.body.applied).toBe(1); // still applied
    });

    it("should create balances that can then be queried", async () => {
      await request(app.getHttpServer())
        .post("/sync/batch")
        .send({
          source: "workday",
          timestamp: "2026-04-10T00:00:00Z",
          balances: [
            { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 20, used: 5 },
          ],
        })
        .expect(201);

      // Now query the balance
      const balanceRes = await request(app.getHttpServer())
        .get("/balances/emp-1/loc-nyc")
        .expect(200);

      expect(balanceRes.body.balances[0].available).toBe(20);
      expect(balanceRes.body.balances[0].used).toBe(5);
      expect(balanceRes.body.balances[0].effectiveAvailable).toBe(15);
    });
  });
});
