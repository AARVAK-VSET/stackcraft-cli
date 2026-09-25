const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server.js");

test("register rejects passwords shorter than 8 characters", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ name: "Test User", email: "short@test.com", password: "abc" });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Password must be at least 8 characters long");
});

test("auth endpoints are rate limited after repeated requests", async () => {
  let lastStatus;

  for (let i = 0; i < 11; i++) {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: `ratelimit-test-${i}@test.com`,
        password: "password123",
      });
    lastStatus = response.status;
  }

  assert.equal(lastStatus, 429);
});
