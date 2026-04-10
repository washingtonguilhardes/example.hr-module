import { Test, TestingModule } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotFoundException } from "@nestjs/common";
import { BalanceService } from "./balance.service";
import { Balance } from "./balance.entity";

describe("BalanceService", () => {
  let service: BalanceService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "better-sqlite3",
          database: ":memory:",
          entities: [Balance],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Balance]),
      ],
      providers: [BalanceService],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe("upsert", () => {
    it("should create a new balance record", async () => {
      const balance = await service.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);

      expect(balance.employeeId).toBe("emp-1");
      expect(balance.locationId).toBe("loc-nyc");
      expect(balance.policyType).toBe("VACATION");
      expect(Number(balance.available)).toBe(15);
      expect(Number(balance.used)).toBe(3);
      expect(Number(balance.pending)).toBe(0);
      expect(balance.lastSyncedAt).toBeTruthy();
    });

    it("should update an existing balance record", async () => {
      await service.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);
      const updated = await service.upsert("emp-1", "loc-nyc", "VACATION", 20, 5);

      expect(Number(updated.available)).toBe(20);
      expect(Number(updated.used)).toBe(5);
    });

    it("should not reset pending when updating via upsert", async () => {
      const balance = await service.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);
      await service.holdPending(balance, 2);

      const updated = await service.upsert("emp-1", "loc-nyc", "VACATION", 20, 3);
      expect(Number(updated.pending)).toBe(2);
    });
  });

  describe("getByEmployee", () => {
    it("should return all balances for an employee", async () => {
      await service.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);
      await service.upsert("emp-1", "loc-nyc", "SICK", 10, 1);
      await service.upsert("emp-1", "loc-la", "VACATION", 12, 0);

      const result = await service.getByEmployee("emp-1");

      expect(result.employeeId).toBe("emp-1");
      expect(result.balances).toHaveLength(3);
    });

    it("should throw NotFoundException for unknown employee", async () => {
      await expect(service.getByEmployee("unknown")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should compute effectiveAvailable correctly", async () => {
      const balance = await service.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);
      await service.holdPending(balance, 2);

      const result = await service.getByEmployee("emp-1");
      expect(result.balances[0].effectiveAvailable).toBe(10);
    });
  });

  describe("getByEmployeeAndLocation", () => {
    it("should return balances filtered by location", async () => {
      await service.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);
      await service.upsert("emp-1", "loc-la", "VACATION", 12, 0);

      const result = await service.getByEmployeeAndLocation("emp-1", "loc-nyc");

      expect(result.balances).toHaveLength(1);
      expect(result.balances[0].locationId).toBe("loc-nyc");
    });

    it("should throw NotFoundException for unknown location", async () => {
      await service.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);

      await expect(
        service.getByEmployeeAndLocation("emp-1", "unknown"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("balance mutations", () => {
    let balance: Balance;

    beforeEach(async () => {
      balance = await service.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);
    });

    it("should hold pending days", async () => {
      const updated = await service.holdPending(balance, 2);
      expect(Number(updated.pending)).toBe(2);
    });

    it("should accumulate pending holds", async () => {
      balance = await service.holdPending(balance, 2);
      const updated = await service.holdPending(balance, 3);
      expect(Number(updated.pending)).toBe(5);
    });

    it("should release pending days", async () => {
      balance = await service.holdPending(balance, 5);
      const updated = await service.releasePending(balance, 3);
      expect(Number(updated.pending)).toBe(2);
    });

    it("should not go below zero when releasing pending", async () => {
      balance = await service.holdPending(balance, 2);
      const updated = await service.releasePending(balance, 5);
      expect(Number(updated.pending)).toBe(0);
    });

    it("should deduct used days and release pending", async () => {
      balance = await service.holdPending(balance, 3);
      const updated = await service.deductUsed(balance, 3);

      expect(Number(updated.pending)).toBe(0);
      expect(Number(updated.used)).toBe(6); // 3 original + 3 deducted
    });

    it("should restore used days", async () => {
      balance = await service.deductUsed(balance, 2);
      const updated = await service.restoreUsed(balance, 2);
      expect(Number(updated.used)).toBe(3); // back to original
    });

    it("should not go below zero when restoring used", async () => {
      const updated = await service.restoreUsed(balance, 10);
      expect(Number(updated.used)).toBe(0);
    });
  });

  describe("findOne", () => {
    it("should return a balance by composite key", async () => {
      await service.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);

      const balance = await service.findOne("emp-1", "loc-nyc", "VACATION");
      expect(balance).toBeTruthy();
      expect(balance!.employeeId).toBe("emp-1");
    });

    it("should return null for non-existent balance", async () => {
      const balance = await service.findOne("emp-1", "loc-nyc", "VACATION");
      expect(balance).toBeNull();
    });
  });
});
