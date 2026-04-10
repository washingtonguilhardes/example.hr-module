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

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[HCM ${timestamp}] ${message}`);
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const start = Date.now();
    const url = new URL(req.url!, `http://localhost`);
    const method = req.method?.toUpperCase();

    this.log(`--> ${method} ${url.pathname}`);

    if (this.config.latencyMs) {
      this.log(`    simulating ${this.config.latencyMs}ms latency...`);
      await new Promise((r) => setTimeout(r, this.config.latencyMs));
    }

    if (this.config.forceError) {
      this.log(`<-- ${method} ${url.pathname} ${this.config.forceError} FORCED ERROR (${Date.now() - start}ms)`);
      res.writeHead(this.config.forceError, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forced error", status: this.config.forceError }));
      return;
    }

    // GET /hcm/balances/:employeeId/:locationId
    const balanceMatch = url.pathname.match(/^\/hcm\/balances\/([^/]+)\/([^/]+)$/);
    if (method === "GET" && balanceMatch) {
      const [, employeeId, locationId] = balanceMatch;
      const balance = this.balances.get(`${employeeId}:${locationId}`);

      if (!balance) {
        this.log(`<-- ${method} ${url.pathname} 404 balance not found (${Date.now() - start}ms)`);
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Balance not found" }));
        return;
      }

      this.log(`<-- ${method} ${url.pathname} 200 | available=${balance.available} used=${balance.used} (${Date.now() - start}ms)`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(balance));
      return;
    }

    // POST /hcm/time-off
    if (method === "POST" && url.pathname === "/hcm/time-off") {
      const body = await this.readBody(req);
      const dto = JSON.parse(body);
      const submissionId = `hcm-sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      this.log(`    employee=${dto.employeeId} location=${dto.locationId} days=${dto.days} (${dto.startDate} to ${dto.endDate})`);

      if (this.config.rejectSubmissions?.includes(dto.employeeId)) {
        this.log(`<-- POST /hcm/time-off 422 REJECTED (forced) | submission=${submissionId} (${Date.now() - start}ms)`);
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
        this.log(`<-- POST /hcm/time-off 422 REJECTED (insufficient) | available=${balance.available - balance.used} < requested=${dto.days} (${Date.now() - start}ms)`);
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
        this.log(`    balance updated: used ${balance.used - dto.days} -> ${balance.used}`);
      }

      this.submissions.push({ employeeId: dto.employeeId, days: dto.days, submissionId });

      this.log(`<-- POST /hcm/time-off 200 ACCEPTED | submission=${submissionId} (${Date.now() - start}ms)`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        submissionId,
        status: "ACCEPTED",
      }));
      return;
    }

    this.log(`<-- ${method} ${url.pathname} 404 unknown route (${Date.now() - start}ms)`);
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
