import { Test, TestingModule } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UnprocessableEntityException, NotFoundException } from "@nestjs/common";
import { RequestService } from "./request.service";
import { TimeOffRequest, RequestStatus } from "./request.entity";
import { Balance } from "../balance/balance.entity";
import { BalanceService } from "../balance/balance.service";
import { HcmClientService } from "../hcm/hcm-client.service";

const mockHcmClient = {
  getBalance: jest.fn().mockResolvedValue({
    employeeId: "emp-1",
    locationId: "loc-nyc",
    policyType: "VACATION",
    available: 15,
    used: 3,
  }),
  submitTimeOff: jest.fn().mockResolvedValue({
    submissionId: "hcm-sub-mock",
    status: "ACCEPTED",
  }),
};

describe("RequestService", () => {
  let service: RequestService;
  let balanceService: BalanceService;
  let module: TestingModule;

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "better-sqlite3",
          database: ":memory:",
          entities: [TimeOffRequest, Balance],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([TimeOffRequest, Balance]),
      ],
      providers: [
        RequestService,
        BalanceService,
        { provide: HcmClientService, useValue: mockHcmClient },
      ],
    }).compile();

    service = module.get<RequestService>(RequestService);
    balanceService = module.get<BalanceService>(BalanceService);

    // Seed a balance for tests
    await balanceService.upsert("emp-1", "loc-nyc", "VACATION", 15, 3);
  });

  afterEach(async () => {
    await module.close();
  });

  const validDto = {
    employeeId: "emp-1",
    locationId: "loc-nyc",
    policyType: "VACATION",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
    days: 3,
    reason: "Family vacation",
    idempotencyKey: "key-001",
  };

  describe("create", () => {
    it("should create a PENDING request and hold balance", async () => {
      const result = await service.create(validDto);

      expect(result.status).toBe(RequestStatus.PENDING);
      expect(result.employeeId).toBe("emp-1");
      expect(result.days).toBe(3);

      const balance = await balanceService.findOne("emp-1", "loc-nyc", "VACATION");
      expect(Number(balance!.pending)).toBe(3);
    });

    it("should return existing request for duplicate idempotency key", async () => {
      const first = await service.create(validDto);
      const second = await service.create(validDto);

      expect(second.id).toBe(first.id);
    });

    it("should reject if balance does not exist (invalid dimensions)", async () => {
      await expect(
        service.create({ ...validDto, locationId: "unknown", idempotencyKey: "key-002" }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("should reject if insufficient balance", async () => {
      await expect(
        service.create({ ...validDto, days: 50, idempotencyKey: "key-003" }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("should reject if start date is after end date", async () => {
      await expect(
        service.create({
          ...validDto,
          startDate: "2026-05-10",
          endDate: "2026-05-01",
          idempotencyKey: "key-004",
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("should reject if days is zero or negative", async () => {
      await expect(
        service.create({ ...validDto, days: 0, idempotencyKey: "key-005" }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("should reject overlapping date ranges", async () => {
      await service.create(validDto);

      await expect(
        service.create({
          ...validDto,
          startDate: "2026-05-03",
          endDate: "2026-05-07",
          days: 2,
          idempotencyKey: "key-006",
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe("approve", () => {
    it("should approve a PENDING request and deduct balance", async () => {
      const created = await service.create(validDto);
      const result = await service.approve(created.id, "Enjoy!");

      expect(result.status).toBe(RequestStatus.APPROVED);
      expect(result.reviewerNote).toBe("Enjoy!");

      const balance = await balanceService.findOne("emp-1", "loc-nyc", "VACATION");
      expect(Number(balance!.pending)).toBe(0);
      expect(Number(balance!.used)).toBe(6); // 3 original + 3 deducted
    });

    it("should reject approving a REJECTED request", async () => {
      const created = await service.create(validDto);
      await service.reject(created.id);

      await expect(service.approve(created.id)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("should throw NOT_FOUND for unknown request", async () => {
      await expect(
        service.approve("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("reject", () => {
    it("should reject a PENDING request and release pending", async () => {
      const created = await service.create(validDto);
      const result = await service.reject(created.id, "Team capacity issue");

      expect(result.status).toBe(RequestStatus.REJECTED);
      expect(result.reviewerNote).toBe("Team capacity issue");

      const balance = await balanceService.findOne("emp-1", "loc-nyc", "VACATION");
      expect(Number(balance!.pending)).toBe(0);
    });

    it("should reject rejecting a CANCELLED request", async () => {
      const created = await service.create(validDto);
      await service.cancel(created.id);

      await expect(service.reject(created.id)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe("cancel", () => {
    it("should cancel a PENDING request and release pending", async () => {
      const created = await service.create(validDto);
      const result = await service.cancel(created.id);

      expect(result.status).toBe(RequestStatus.CANCELLED);

      const balance = await balanceService.findOne("emp-1", "loc-nyc", "VACATION");
      expect(Number(balance!.pending)).toBe(0);
    });

    it("should cancel an APPROVED request and restore used", async () => {
      const created = await service.create(validDto);
      await service.approve(created.id);

      const result = await service.cancel(created.id);
      expect(result.status).toBe(RequestStatus.CANCELLED);

      const balance = await balanceService.findOne("emp-1", "loc-nyc", "VACATION");
      expect(Number(balance!.used)).toBe(3); // restored to original
    });

    it("should reject cancelling a REJECTED request", async () => {
      const created = await service.create(validDto);
      await service.reject(created.id);

      await expect(service.cancel(created.id)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe("list", () => {
    it("should return paginated results", async () => {
      await service.create(validDto);
      await service.create({
        ...validDto,
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        days: 2,
        idempotencyKey: "key-010",
      });

      const result = await service.list({}, 1, 10);

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it("should filter by employeeId", async () => {
      await service.create(validDto);

      const result = await service.list({ employeeId: "emp-1" });
      expect(result.total).toBe(1);

      const empty = await service.list({ employeeId: "emp-999" });
      expect(empty.total).toBe(0);
    });

    it("should filter by status", async () => {
      const created = await service.create(validDto);
      await service.approve(created.id);

      const approved = await service.list({ status: RequestStatus.APPROVED });
      expect(approved.total).toBe(1);

      const pending = await service.list({ status: RequestStatus.PENDING });
      expect(pending.total).toBe(0);
    });
  });
});
