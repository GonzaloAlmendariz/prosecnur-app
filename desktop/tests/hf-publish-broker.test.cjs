"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

function loadBrokerContract() {
  // El broker puro se crea con el fix. El require por test permite que Node
  // reporte cada frontera roja mientras el módulo todavía no existe.
  return require("../hf-publish-broker.cjs");
}

const VALID_PAYLOAD = Object.freeze({
  session_id: "session-42",
  token_id: "token-42",
  hf_username: "pulso-lab",
  space_name: "encuesta-demo",
  private: true
});

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

function loggerSpy() {
  const calls = [];
  const logger = Object.fromEntries(
    ["debug", "info", "warn", "error"].map((level) => [
      level,
      (...args) => calls.push([level, ...args])
    ])
  );
  return { logger, calls };
}

test("publica únicamente al endpoint loopback fijo con sesión y token resuelto", async () => {
  const { createHfPublishBroker } = loadBrokerContract();
  const secret = "hf_super_secret_for_broker_test";
  const requests = [];
  const resolvedIds = [];
  const backendJson = {
    ok: true,
    repo_id: "pulso-lab/encuesta-demo",
    url: "https://huggingface.co/spaces/pulso-lab/encuesta-demo",
    app_url: "https://pulso-lab-encuesta-demo.hf.space"
  };
  const { logger, calls } = loggerSpy();
  const broker = createHfPublishBroker({
    getBackendPort: () => 8877,
    resolveSavedToken: async (id) => {
      resolvedIds.push(id);
      return secret;
    },
    fetch: async (url, init) => {
      requests.push({ url, init });
      return response(backendJson);
    },
    logger
  });

  const result = await broker.publish(VALID_PAYLOAD);

  assert.deepEqual(resolvedIds, ["token-42"]);
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    "http://127.0.0.1:8877/api/dashboard/publish"
  );
  assert.equal(requests[0].init.method, "POST");
  const requestHeaders = new Headers(requests[0].init.headers);
  assert.equal(requestHeaders.get("Content-Type"), "application/json");
  assert.equal(requestHeaders.get("X-Pulso-Session"), "session-42");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    hf_username: "pulso-lab",
    hf_token: secret,
    space_name: "encuesta-demo",
    private: true
  });

  // El resultado público es exactamente el JSON del backend: el broker no
  // agrega token_id, token resuelto ni datos internos.
  assert.deepEqual(result, backendJson);
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(JSON.stringify(calls).includes(secret), false);
})

test("exige IDs y campos tipados antes de resolver secretos o hacer red", async () => {
  const { createHfPublishBroker } = loadBrokerContract();
  let tokenReads = 0;
  let networkCalls = 0;
  const broker = createHfPublishBroker({
    getBackendPort: () => 8877,
    resolveSavedToken: async () => {
      tokenReads += 1;
      return "hf_should_not_be_read";
    },
    fetch: async () => {
      networkCalls += 1;
      return response({ ok: true });
    },
    logger: loggerSpy().logger
  });

  const invalidCases = [
    [{ ...VALID_PAYLOAD, session_id: "" }, /session_id/i],
    [{ ...VALID_PAYLOAD, token_id: "" }, /token_id/i],
    [{ ...VALID_PAYLOAD, hf_username: 7 }, /hf_username/i],
    [{ ...VALID_PAYLOAD, space_name: null }, /space_name/i],
    [{ ...VALID_PAYLOAD, private: "true" }, /private/i]
  ];
  for (const [payload, diagnostic] of invalidCases) {
    await assert.rejects(() => broker.publish(payload), diagnostic);
  }

  assert.equal(tokenReads, 0);
  assert.equal(networkCalls, 0);
})

test("rechaza URL, path, headers, plaintext y cualquier key arbitraria", async () => {
  const { createHfPublishBroker } = loadBrokerContract();
  const broker = createHfPublishBroker({
    getBackendPort: () => 8877,
    resolveSavedToken: async () => "hf_never_reached",
    fetch: async () => response({ ok: true }),
    logger: loggerSpy().logger
  });

  for (const [key, value] of [
    ["url", "https://attacker.example/collect"],
    ["path", "/api/system/shutdown"],
    ["headers", { Authorization: "Bearer attacker" }],
    ["hf_token", "hf_plaintext_from_renderer"],
    ["debug", true]
  ]) {
    await assert.rejects(
      () => broker.publish({ ...VALID_PAYLOAD, [key]: value }),
      new RegExp(key, "i"),
      key
    );
  }
})

test("private es opcional, pero cuando aparece solo acepta booleanos", async () => {
  const { createHfPublishBroker } = loadBrokerContract();
  let sentBody = null;
  const broker = createHfPublishBroker({
    getBackendPort: () => 8877,
    resolveSavedToken: async () => "hf_private_optional",
    fetch: async (_url, init) => {
      sentBody = JSON.parse(init.body);
      return response({ ok: true });
    },
    logger: loggerSpy().logger
  });

  await broker.publish({
    session_id: "session-42",
    token_id: "token-42",
    hf_username: "pulso-lab",
    space_name: "encuesta-demo"
  });

  assert.ok(
    sentBody.private === undefined || sentBody.private === false,
    "private omitido no puede convertirse a un valor no booleano"
  );
})
