import * as http from "http";

export interface MockBalance {
  employeeId: string;
  locationId: string;
  policyType: string;
  available: number;
  used: number;
}

export interface MockHcmConfig {
  /** Pre-loaded balances */
  balances: MockBalance[];
  /** Force all requests to fail with this status code */
  forceError?: number;
  /** Add artificial latency in ms */
  latencyMs?: number;
  /** Reject specific time-off submissions by employeeId */
  rejectSubmissions?: string[];
}

export class MockHcmServer {
  private server: http.Server;
  private config: MockHcmConfig;
  private balances: Map<string, MockBalance>;
  private submissions: Array<{ employeeId: string; days: number; submissionId: string }> = [];

  constructor(config: MockHcmConfig) {
    this.config = config;
    this.balances = new Map();
    for (const b of config.balances) {
      this.balances.set(`${b.employeeId}:${b.locationId}`, b);
    }

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
  }

  async start(port = 0): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        const addr = this.server.address();
        const assignedPort = typeof addr === "object" ? addr!.port : 0;
        resolve(assignedPort);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  getSubmissions() {
    return this.submissions;
  }

  updateBalance(employeeId: string, locationId: string, updates: Partial<MockBalance>): void {
    const key = `${employeeId}:${locationId}`;
    const existing = this.balances.get(key);
    if (existing) {
      Object.assign(existing, updates);
    }
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    if (this.config.latencyMs) {
      await new Promise((r) => setTimeout(r, this.config.latencyMs));
    }

    if (this.config.forceError) {
      res.writeHead(this.config.forceError, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forced error", status: this.config.forceError }));
      return;
    }

    const url = new URL(req.url!, `http://localhost`);
    const method = req.method?.toUpperCase();

    // GET /hcm/balances/:employeeId/:locationId
    const balanceMatch = url.pathname.match(/^\/hcm\/balances\/([^/]+)\/([^/]+)$/);
    if (method === "GET" && balanceMatch) {
      const [, employeeId, locationId] = balanceMatch;
      const balance = this.balances.get(`${employeeId}:${locationId}`);

      if (!balance) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Balance not found" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(balance));
      return;
    }

    // POST /hcm/time-off
    if (method === "POST" && url.pathname === "/hcm/time-off") {
      const body = await this.readBody(req);
      const dto = JSON.parse(body);
      const submissionId = `hcm-sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      if (this.config.rejectSubmissions?.includes(dto.employeeId)) {
        res.writeHead(422, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          submissionId,
          status: "REJECTED",
          errorCode: "BALANCE_EXCEEDED",
          errorMessage: "HCM: insufficient balance for this employee",
        }));
        return;
      }

      // Check balance sufficiency
      const key = `${dto.employeeId}:${dto.locationId}`;
      const balance = this.balances.get(key);
      if (balance && (balance.available - balance.used) < dto.days) {
        res.writeHead(422, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          submissionId,
          status: "REJECTED",
          errorCode: "BALANCE_EXCEEDED",
          errorMessage: `HCM: only ${balance.available - balance.used} days available`,
        }));
        return;
      }

      // Apply the deduction on mock side
      if (balance) {
        balance.used += dto.days;
      }

      this.submissions.push({ employeeId: dto.employeeId, days: dto.days, submissionId });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        submissionId,
        status: "ACCEPTED",
      }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
    });
  }
}
