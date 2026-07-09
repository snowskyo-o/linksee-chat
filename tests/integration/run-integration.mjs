import assert from "node:assert/strict";

const baseUrl = (process.env.CHAT_TEST_BASE_URL || "http://127.0.0.1:3010").replace(/\/$/, "");

async function expectJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  assert.equal(response.ok, true, payload?.message || `${path} failed`);
  return payload;
}

async function loginAsSeedUser() {
  const payload = await expectJson("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: process.env.CHAT_TEST_USER_ID || "1000000001",
      password: process.env.CHAT_TEST_PASSWORD || "Chat1234",
    }),
  });
  return payload.data.accessToken;
}

const health = await expectJson("/health");
assert.equal(health.ok, true);

const accessToken = await loginAsSeedUser();
assert.ok(accessToken);

const conversations = await expectJson("/api/v1/conversations", {
  headers: { Authorization: `Bearer ${accessToken}` },
});
assert.ok(Array.isArray(conversations.data));
assert.ok(conversations.data.length > 0);

const conversationId = conversations.data[0].id;
const messages = await expectJson(`/api/v1/conversations/${encodeURIComponent(conversationId)}/messages?limit=20`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
assert.ok(Array.isArray(messages.data));

for (let index = 1; index < messages.data.length; index += 1) {
  const prev = BigInt(messages.data[index - 1].id);
  const curr = BigInt(messages.data[index].id);
  assert.equal(prev < curr, true, "messages should be returned in ascending order");
}

console.log("[integration] login, conversations, and message ordering ok");

