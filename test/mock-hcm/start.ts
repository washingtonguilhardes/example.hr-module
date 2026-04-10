import { MockHcmServer } from "./mock-hcm.server";

const server = new MockHcmServer({
  balances: [
    { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 15, used: 3 },
    { employeeId: "emp-1", locationId: "loc-nyc", policyType: "SICK", available: 10, used: 1 },
    { employeeId: "emp-1", locationId: "loc-la", policyType: "VACATION", available: 12, used: 0 },
    { employeeId: "emp-2", locationId: "loc-nyc", policyType: "VACATION", available: 20, used: 5 },
  ],
});

const port = parseInt(process.env.HCM_PORT || "3001", 10);

server.start(port).then((assignedPort) => {
  console.log(`Mock HCM server running on http://localhost:${assignedPort}`);
  console.log("Available balances:");
  console.log("  emp-1 / loc-nyc / VACATION: 15 available, 3 used");
  console.log("  emp-1 / loc-nyc / SICK:     10 available, 1 used");
  console.log("  emp-1 / loc-la  / VACATION: 12 available, 0 used");
  console.log("  emp-2 / loc-nyc / VACATION: 20 available, 5 used");
  console.log("\nEndpoints:");
  console.log("  GET  /hcm/balances/:employeeId/:locationId");
  console.log("  POST /hcm/time-off");
});
