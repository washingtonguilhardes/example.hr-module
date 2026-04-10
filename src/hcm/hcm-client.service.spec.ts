import { BadGatewayException, UnprocessableEntityException } from "@nestjs/common";
import { HcmClientService } from "./hcm-client.service";
import { MockHcmServer, MockHcmConfig } from "../../test/mock-hcm/mock-hcm.server";

describe("HcmClientService", () => {
  let service: HcmClientService;
  let mockServer: MockHcmServer;
  let port: number;

  afterEach(async () => {
    if (mockServer) await mockServer.stop();
  });

  async function setupServer(config: MockHcmConfig) {
    mockServer = new MockHcmServer(config);
    port = await mockServer.start();
    service = new HcmClientService();
    service.setConfig({
      baseUrl: `http://localhost:${port}`,
      timeoutMs: 2000,
      maxRetries: 0, // No retries in unit tests for speed
    });
  }

  describe("getBalance", () => {
    it("should return balance from HCM", async () => {
      await setupServer({
        balances: [
          { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 20, used: 5 },
        ],
      });

      const result = await service.getBalance("emp-1", "loc-nyc");

      expect(result.employeeId).toBe("emp-1");
      expect(result.available).toBe(20);
      expect(result.used).toBe(5);
    });

    it("should throw 422 when balance not found on HCM", async () => {
      await setupServer({ balances: [] });

      await expect(service.getBalance("emp-1", "loc-nyc")).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("should throw 502 when HCM is down", async () => {
      await setupServer({ balances: [], forceError: 500 });

      await expect(service.getBalance("emp-1", "loc-nyc")).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe("submitTimeOff", () => {
    const submitDto = {
      employeeId: "emp-1",
      locationId: "loc-nyc",
      policyType: "VACATION",
      days: 3,
      startDate: "2026-05-01",
      endDate: "2026-05-05",
    };

    it("should submit time-off successfully", async () => {
      await setupServer({
        balances: [
          { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 20, used: 5 },
        ],
      });

      const result = await service.submitTimeOff(submitDto);

      expect(result.status).toBe("ACCEPTED");
      expect(result.submissionId).toBeTruthy();
      expect(mockServer.getSubmissions()).toHaveLength(1);
    });

    it("should throw 422 when HCM rejects submission", async () => {
      await setupServer({
        balances: [
          { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 20, used: 5 },
        ],
        rejectSubmissions: ["emp-1"],
      });

      await expect(service.submitTimeOff(submitDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("should throw 422 when HCM balance is insufficient", async () => {
      await setupServer({
        balances: [
          { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 5, used: 4 },
        ],
      });

      await expect(service.submitTimeOff(submitDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("should throw 502 when HCM is unreachable", async () => {
      service = new HcmClientService();
      service.setConfig({
        baseUrl: "http://localhost:1", // Nothing listening
        timeoutMs: 500,
        maxRetries: 0,
      });

      await expect(service.submitTimeOff(submitDto)).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe("retry logic", () => {
    it("should retry on server errors and eventually throw", async () => {
      await setupServer({ balances: [], forceError: 503 });
      service.setConfig({ maxRetries: 1, timeoutMs: 1000 });

      await expect(service.getBalance("emp-1", "loc-nyc")).rejects.toThrow(
        BadGatewayException,
      );
    });
  });
});
