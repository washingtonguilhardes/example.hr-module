import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Balance } from "../src/balance/balance.entity";
import { BalanceModule } from "../src/balance/balance.module";
import { BalanceService } from "../src/balance/balance.service";

describe("Balance endpoints (e2e)", () => {
  let app: INestApplication;
  let balanceService: BalanceService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "better-sqlite3",
          database: ":memory:",
          entities: [Balance],
          synchronize: true,
        }),
        BalanceModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    balanceService = moduleFixture.get<BalanceService>(BalanceService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /balances/:employeeId", () => {
    it("should return all balances for an employee", async () => {
      await balanceService.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);
      await balanceService.upsert("emp-1", "loc-nyc", "SICK", 10, 1);

      const response = await request(app.getHttpServer())
        .get("/balances/emp-1")
        .expect(200);

      expect(response.body.employeeId).toBe("emp-1");
      expect(response.body.balances).toHaveLength(2);
      expect(response.body.balances[0]).toHaveProperty("effectiveAvailable");
      expect(response.body.balances[0]).toHaveProperty("lastSyncedAt");
    });

    it("should return 404 for unknown employee", async () => {
      await request(app.getHttpServer())
        .get("/balances/unknown")
        .expect(404);
    });
  });

  describe("GET /balances/:employeeId/:locationId", () => {
    it("should return balances filtered by location", async () => {
      await balanceService.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);
      await balanceService.upsert("emp-1", "loc-la", "VACATION", 12, 0);

      const response = await request(app.getHttpServer())
        .get("/balances/emp-1/loc-nyc")
        .expect(200);

      expect(response.body.balances).toHaveLength(1);
      expect(response.body.balances[0].locationId).toBe("loc-nyc");
    });

    it("should return 404 for unknown location", async () => {
      await balanceService.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);

      await request(app.getHttpServer())
        .get("/balances/emp-1/unknown")
        .expect(404);
    });

    it("should include correct effectiveAvailable in response", async () => {
      const balance = await balanceService.upsert("emp-1", "loc-nyc", "VACATION", 20, 5);
      await balanceService.holdPending(balance, 3);

      const response = await request(app.getHttpServer())
        .get("/balances/emp-1/loc-nyc")
        .expect(200);

      expect(response.body.balances[0].available).toBe(20);
      expect(response.body.balances[0].used).toBe(5);
      expect(response.body.balances[0].pending).toBe(3);
      expect(response.body.balances[0].effectiveAvailable).toBe(12);
    });
  });
});
