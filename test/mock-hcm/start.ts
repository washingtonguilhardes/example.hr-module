import { MockHcmServer } from "./mock-hcm.server";

const server = new MockHcmServer({
  balances: [
    { employeeId: "emp-1", locationId: "loc-nyc", policyType: "VACATION", available: 15, used: 3 },
    { employeeId: "emp-1", locationId: "loc-nyc", policyType: "SICK", available: 10, used: 1 },
    { employeeId: "emp-1", locationId: "loc-la", policyType: "VACATION", available: 12, used: 0 },
    { employeeId: "emp-2", locationId: "loc-nyc", policyType: "VACATION", available: 20, used: 5 },
    // Drift scenario: local DB will show 10 available, but HCM only has 2 left.
    // Creating a 5-day request passes locally, but approval fails on HCM validation.
    { employeeId: "emp-3", locationId: "loc-nyc", policyType: "VACATION", available: 10, used: 8 },
  ],
});

const port = parseInt(process.env.HCM_PORT || "3001", 10);

server.start(port).then((assignedPort) => {
  console.log(`Mock HCM server running on http://localhost:${assignedPort}`);
  console.log("\nAvailable balances:");
  console.log("  emp-1 / loc-nyc / VACATION: 15 available, 3 used  (12 effective)");
  console.log("  emp-1 / loc-nyc / SICK:     10 available, 1 used  (9 effective)");
  console.log("  emp-1 / loc-la  / VACATION: 12 available, 0 used  (12 effective)");
  console.log("  emp-2 / loc-nyc / VACATION: 20 available, 5 used  (15 effective)");
  console.log("  emp-3 / loc-nyc / VACATION: 10 available, 8 used  (2 effective) <-- HCM drift scenario");
  console.log("\nTest scenario — HCM rejects on approval:");
  console.log("  1. POST /balances/seed  { employeeId: 'emp-3', locationId: 'loc-nyc', policyType: 'VACATION', available: 10, used: 3 }");
  console.log("     ^ Seeds local DB with 7 effective days (more than HCM's 2)");
  console.log("  2. POST /requests       { employeeId: 'emp-3', ..., days: 5, idempotencyKey: 'drift-001' }");
  console.log("     ^ Passes locally (7 >= 5)");
  console.log("  3. PATCH /requests/:id/approve");
  console.log("     ^ Fails! HCM says only 2 days available");
  console.log("\nEndpoints:");
  console.log("  GET  /hcm/balances/:employeeId/:locationId");
  console.log("  POST /hcm/time-off");
});
