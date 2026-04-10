import { Test, TestingModule } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SyncService } from "./sync.service";
import { SyncLog } from "./sync-log.entity";
import { Balance } from "../balance/balance.entity";
import { BalanceService } from "../balance/balance.service";

describe("SyncService", () => {
  let service: SyncService;
  let balanceService: BalanceService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "better-sqlite3",
          database: ":memory:",
          entities: [SyncLog, Balance],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([SyncLog, Balance]),
      ],
      providers: [SyncService, BalanceService],
    }).compile();

    service = module.get<SyncService>(SyncService);
    balanceService = module.get<BalanceService>(BalanceService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe("batchSync", () => {
    it("should create new balance records", async () => {
      const result = await service.batchSync({
        source: "workday",
        timestamp: "2026-04-10T00:00:00Z",
        balances: [
          { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 15, used: 3 },
          { employeeId: "emp-2", locationId: "loc-la", policyType: "SICK", available: 10, used: 0 },
        ],
      });

      expect(result.received).toBe(2);
      expect(result.applied).toBe(2);
      expect(result.conflicts).toBe(0);

      const balance = await balanceService.findOne("emp-1", "loc-nyc", "VACATION");
      expect(Number(balance!.available)).toBe(15);
      expect(Number(balance!.used)).toBe(3);
    });

    it("should update existing balance records", async () => {
      await balanceService.upsert("emp-1", "loc-nyc", "VACATION", 10, 2);

      const result = await service.batchSync({
        source: "workday",
        timestamp: "2026-04-10T00:00:00Z",
        balances: [
          { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 20, used: 5 },
        ],
      });

      expect(result.applied).toBe(1);

      const balance = await balanceService.findOne("emp-1", "loc-nyc", "VACATION");
      expect(Number(balance!.available)).toBe(20);
      expect(Number(balance!.used)).toBe(5);
    });

    it("should detect conflicts with pending requests", async () => {
      // Create a balance and hold some pending days
      const balance = await balanceService.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);
      await balanceService.holdPending(balance, 5);

      // Batch sync reduces the balance so pending would be insufficient
      const result = await service.batchSync({
        source: "workday",
        timestamp: "2026-04-10T00:00:00Z",
        balances: [
          { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 8, used: 5 },
        ],
      });

      expect(result.conflicts).toBe(1);
      expect(result.conflictDetails[0].employeeId).toBe("emp-1");
      expect(result.conflictDetails[0].reason).toContain("pending");

      // Balance should still be updated (HCM is source of truth)
      const updated = await balanceService.findOne("emp-1", "loc-nyc", "VACATION");
      expect(Number(updated!.available)).toBe(8);
      expect(Number(updated!.used)).toBe(5);
      expect(Number(updated!.pending)).toBe(5); // pending preserved
    });

    it("should not report conflict when pending still fits", async () => {
      const balance = await balanceService.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);
      await balanceService.holdPending(balance, 2);

      const result = await service.batchSync({
        source: "workday",
        timestamp: "2026-04-10T00:00:00Z",
        balances: [
          { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 20, used: 3 },
        ],
      });

      expect(result.conflicts).toBe(0);
    });

    it("should handle empty balances array", async () => {
      const result = await service.batchSync({
        source: "workday",
        timestamp: "2026-04-10T00:00:00Z",
        balances: [],
      });

      expect(result.received).toBe(0);
      expect(result.applied).toBe(0);
      expect(result.conflicts).toBe(0);
    });

    it("should handle anniversary bonus (balance increase)", async () => {
      await balanceService.upsert("emp-1", "loc-nyc", "VACATION", 10, 5);

      const result = await service.batchSync({
        source: "workday",
        timestamp: "2026-04-10T00:00:00Z",
        balances: [
          { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 15, used: 5 },
        ],
      });

      expect(result.applied).toBe(1);
      expect(result.conflicts).toBe(0);

      const balance = await balanceService.findOne("emp-1", "loc-nyc", "VACATION");
      expect(Number(balance!.available)).toBe(15); // increased from 10 to 15
    });
  });
});
