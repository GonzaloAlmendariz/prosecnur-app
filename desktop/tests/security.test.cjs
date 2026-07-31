"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

function loadSecurityContract() {
  // Este módulo puro se crea con el fix. Mantener el require dentro de cada
  // test deja un rojo causal por frontera mientras el seam aún no existe.
  return require("../security.cjs");
}

const RENDERER_ORIGINS = [
  "http://127.0.0.1:8877",
  "http://localhost:5173"
];

function directive(csp, name) {
  const match = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  assert.ok(match, `falta la directiva CSP ${name}`);
  return match.split(/\s+/).slice(1);
}

test("navegación permite solo el renderer conocido y deriva HTTPS al navegador externo", () => {
  const { createNavigationPolicy } = loadSecurityContract();
  const pendingDataUrl = "data:text/html;charset=utf-8,%3Ch1%3EVista%20interna%3C%2Fh1%3E";
  const policy = createNavigationPolicy({
    rendererOrigins: RENDERER_ORIGINS,
    pendingInternalDataUrl: pendingDataUrl
  });

  assert.equal(
    policy.decide("http://127.0.0.1:8877/dashboard?tab=datos").action,
    "allow"
  );
  assert.equal(
    policy.decide("http://localhost:5173/dashboard").action,
    "allow"
  );
  assert.deepEqual(
    policy.decide("https://huggingface.co/spaces/pulso/demo"),
    {
      action: "open-external",
      url: "https://huggingface.co/spaces/pulso/demo"
    }
  );

  for (const url of [
    "http://example.com/inseguro",
    "http://127.0.0.1:9999/no-es-el-renderer",
    "file:///tmp/secreto.txt",
    "javascript:alert(document.cookie)",
    "data:text/html,<script>alert(1)</script>",
    "prosecnur-custom://abrir/algo"
  ]) {
    assert.equal(policy.decide(url).action, "deny", url);
  }

  // La excepción data: es de igualdad exacta y de un solo uso. No autoriza
  // otras data URLs ni deja una allowlist persistente.
  assert.equal(policy.decide(pendingDataUrl).action, "allow");
  assert.equal(policy.decide(pendingDataUrl).action, "deny");
  assert.equal(policy.decide(`${pendingDataUrl}%20`).action, "deny");
})

test("redirects atraviesan exactamente la misma decisión que la navegación inicial", () => {
  const { createNavigationPolicy } = loadSecurityContract();
  const policy = createNavigationPolicy({ rendererOrigins: RENDERER_ORIGINS });

  const cases = [
    ["http://127.0.0.1:8877/app", "allow"],
    ["https://example.org/final", "open-external"],
    ["http://example.org/final", "deny"],
    ["file:///etc/passwd", "deny"]
  ];
  for (const [url, expected] of cases) {
    assert.equal(
      policy.decide(url, { phase: "redirect" }).action,
      expected,
      url
    );
  }
})

test("IPC confía solo en webContents, frame principal y origen del renderer", () => {
  const { isTrustedIpcEvent } = loadSecurityContract();
  const mainFrame = { url: "http://127.0.0.1:8877/dashboard" };
  const trustedWebContents = { mainFrame };
  const mainWindow = { webContents: trustedWebContents };
  const options = { mainWindow, rendererOrigins: RENDERER_ORIGINS };

  assert.equal(
    isTrustedIpcEvent(
      { sender: trustedWebContents, senderFrame: mainFrame },
      options
    ),
    true
  );

  assert.equal(
    isTrustedIpcEvent(
      {
        sender: { mainFrame: { url: mainFrame.url } },
        senderFrame: mainFrame
      },
      options
    ),
    false,
    "otro webContents no puede invocar handlers"
  );
  assert.equal(
    isTrustedIpcEvent(
      {
        sender: trustedWebContents,
        senderFrame: { url: mainFrame.url, parent: mainFrame }
      },
      options
    ),
    false,
    "un subframe no hereda confianza por compartir origen"
  );
  assert.equal(
    isTrustedIpcEvent(
      {
        sender: {
          mainFrame: { url: "https://example.org/" }
        },
        senderFrame: null
      },
      options
    ),
    false,
    "un frame que no coincide con el principal no puede suplantar el origen"
  );

  const externalMainFrame = { url: "https://example.org/" };
  const externalWebContents = { mainFrame: externalMainFrame };
  assert.equal(
    isTrustedIpcEvent(
      {
        sender: externalWebContents,
        senderFrame: externalMainFrame
      },
      {
        mainWindow: { webContents: externalWebContents },
        rendererOrigins: RENDERER_ORIGINS
      }
    ),
    false,
    "incluso el frame principal debe declarar un origen permitido"
  );
})

test("CSP de producción elimina concesiones de script sin imponer política a style-src", () => {
  const { buildContentSecurityPolicy } = loadSecurityContract();
  const production = buildContentSecurityPolicy({
    isDev: false,
    rendererOrigins: ["http://127.0.0.1:8877"]
  });
  const scripts = directive(production, "script-src");

  assert.ok(scripts.includes("'self'"));
  assert.equal(scripts.includes("'unsafe-eval'"), false);
  assert.equal(scripts.includes("'unsafe-inline'"), false);

  // Desarrollo puede conservar concesiones; lo único compartido que se
  // congela aquí es que la directiva siga siendo explícita.
  const development = buildContentSecurityPolicy({
    isDev: true,
    rendererOrigins: ["http://localhost:5173"]
  });
  assert.ok(directive(development, "script-src").includes("'self'"));
})

test("CDP de auditoría requiere manifiesto explícito y userData aislado", () => {
  const { resolveAuditLaunchConfig } = loadSecurityContract();
  const defaultUserDataDir = path.join("/tmp", "prosecnur-default-profile");
  const manifestPath = path.join("/tmp", "audit-run-42", "manifest.json");

  const withoutManifest = resolveAuditLaunchConfig({
    manifestPath: "",
    requestedUserDataDir: path.join("/tmp", "profile-manual"),
    defaultUserDataDir,
    cdpPort: "9334"
  });
  assert.equal(withoutManifest.auditEnabled, false);
  assert.equal(withoutManifest.cdpPort, null);

  const isolated = resolveAuditLaunchConfig({
    manifestPath,
    requestedUserDataDir: "",
    defaultUserDataDir,
    cdpPort: "9334"
  });
  assert.equal(isolated.auditEnabled, true);
  assert.equal(isolated.cdpPort, "9334");
  assert.equal(
    isolated.userDataDir,
    path.join(path.dirname(manifestPath), "electron-user-data")
  );
  assert.notEqual(isolated.userDataDir, defaultUserDataDir);

  assert.throws(
    () => resolveAuditLaunchConfig({
      manifestPath,
      requestedUserDataDir: defaultUserDataDir,
      defaultUserDataDir,
      cdpPort: "9334"
    }),
    /userData.*aislad|aislad.*userData/i
  );
})

test("secretos persistentes requieren cifrado real y nunca basic_text en Linux", () => {
  const { canPersistSecret } = loadSecurityContract();

  assert.equal(
    canPersistSecret({
      encryptionAvailable: false,
      platform: "darwin",
      selectedBackend: "keychain"
    }),
    false
  );
  assert.equal(
    canPersistSecret({
      encryptionAvailable: true,
      platform: "linux",
      selectedBackend: "basic_text"
    }),
    false
  );
  assert.equal(
    canPersistSecret({
      encryptionAvailable: true,
      platform: "darwin",
      selectedBackend: "keychain"
    }),
    true
  );
  assert.equal(
    canPersistSecret({
      encryptionAvailable: true,
      platform: "linux",
      selectedBackend: "secret_service"
    }),
    true
  );
})

test("un secreto legacy plaintext nunca se conserva por coincidencia de fingerprint o cache", () => {
  const { canReuseStoredSecret } = loadSecurityContract();
  const matchingIdentity = {
    fingerprintMatches: true,
    cacheMatches: true
  };

  assert.equal(
    canReuseStoredSecret({
      storedSecret: { encrypted: false, value: "legacy-base64" },
      ...matchingIdentity
    }),
    false,
    "la reautenticación debe reemplazar siempre el registro legacy"
  );
  assert.equal(
    canReuseStoredSecret({
      storedSecret: { encrypted: true, value: "safe-storage-ciphertext" },
      ...matchingIdentity
    }),
    true,
    "un ciphertext idéntico sí puede conservarse"
  );
})

test("JSON sensible se escribe con permisos mínimos, fsync y rename atómico", (t) => {
  const { writeJsonAtomically } = loadSecurityContract();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "prosecnur-atomic-json-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "private-settings");
  const target = path.join(directory, "hf-settings.json");
  const operations = [];
  const watched = new Set([
    "mkdirSync",
    "chmodSync",
    "openSync",
    "writeFileSync",
    "writeSync",
    "fsyncSync",
    "closeSync",
    "renameSync",
    "unlinkSync"
  ]);
  const fsImpl = new Proxy(fs, {
    get(source, property, receiver) {
      const value = Reflect.get(source, property, receiver);
      if (typeof value !== "function" || !watched.has(property)) return value;
      return (...args) => {
        operations.push({ name: property, args: [...args] });
        return value.apply(source, args);
      };
    }
  });

  writeJsonAtomically(target, {
    token_fingerprint: "sha256-only",
    saved_tokens: [{ id: "token-42", masked_token: "hf_••••1234" }]
  }, fsImpl);

  assert.deepEqual(JSON.parse(fs.readFileSync(target, "utf8")), {
    token_fingerprint: "sha256-only",
    saved_tokens: [{ id: "token-42", masked_token: "hf_••••1234" }]
  });
  assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
  assert.equal(fs.statSync(target).mode & 0o777, 0o600);

  const fsyncIndex = operations.findIndex(({ name }) => name === "fsyncSync");
  const renameIndex = operations.findIndex(({ name }) => name === "renameSync");
  assert.ok(fsyncIndex >= 0, "el temporal debe sincronizarse antes de publicar");
  assert.ok(renameIndex > fsyncIndex, "rename debe ocurrir después de fsync");

  const rename = operations[renameIndex].args;
  assert.equal(path.dirname(rename[0]), directory);
  assert.equal(rename[1], target);
  assert.notEqual(rename[0], target);
  assert.deepEqual(
    fs.readdirSync(directory),
    ["hf-settings.json"],
    "no deben quedar temporales junto al archivo definitivo"
  );
})
