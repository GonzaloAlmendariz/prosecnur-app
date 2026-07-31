"use strict";

const { randomUUID } = require("node:crypto");
const path = require("node:path");

function normalizedOrigins(origins = []) {
  const out = new Set();
  for (const value of origins) {
    try {
      const parsed = new URL(String(value));
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        out.add(parsed.origin);
      }
    } catch (_error) {
      // Una entrada inválida no amplía la allowlist.
    }
  }
  return out;
}

function createNavigationPolicy({
  rendererOrigins = [],
  pendingInternalDataUrl = "",
} = {}) {
  const allowedOrigins = normalizedOrigins(rendererOrigins);
  let pendingDataUrl =
    typeof pendingInternalDataUrl === "string" ? pendingInternalDataUrl : "";

  return {
    decide(rawUrl) {
      if (typeof rawUrl !== "string" || !rawUrl) return { action: "deny" };

      if (pendingDataUrl && rawUrl === pendingDataUrl) {
        pendingDataUrl = "";
        return { action: "allow" };
      }

      let parsed;
      try {
        parsed = new URL(rawUrl);
      } catch (_error) {
        return { action: "deny" };
      }

      if (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        allowedOrigins.has(parsed.origin)
      ) {
        return { action: "allow" };
      }

      if (parsed.protocol === "https:") {
        return { action: "open-external", url: parsed.toString() };
      }

      return { action: "deny" };
    },
  };
}

function isTrustedIpcEvent(event, {
  mainWindow,
  rendererOrigins = [],
} = {}) {
  if (!event || !mainWindow || mainWindow.isDestroyed?.()) return false;
  const webContents = mainWindow.webContents;
  if (!webContents || event.sender !== webContents) return false;
  if (!event.senderFrame || event.senderFrame !== webContents.mainFrame) {
    return false;
  }

  let frameOrigin;
  try {
    frameOrigin = new URL(event.senderFrame.url).origin;
  } catch (_error) {
    return false;
  }
  return normalizedOrigins(rendererOrigins).has(frameOrigin);
}

function buildContentSecurityPolicy({
  isDev = false,
  rendererOrigins = [],
} = {}) {
  const httpSources = Array.from(normalizedOrigins(rendererOrigins));
  const scriptSources = ["'self'", ...httpSources];
  if (isDev) scriptSources.push("'unsafe-inline'", "'unsafe-eval'");

  const connectSources = ["'self'", ...httpSources];
  if (isDev) {
    connectSources.push(
      ...httpSources.map((origin) => origin.replace(/^http:/, "ws:").replace(/^https:/, "wss:")),
    );
  }

  return [
    `default-src ${["'self'", ...httpSources].join(" ")}`,
    `script-src ${scriptSources.join(" ")}`,
    `style-src ${["'self'", "'unsafe-inline'", ...httpSources].join(" ")}`,
    `img-src ${["'self'", "data:", "blob:", ...httpSources].join(" ")}`,
    `font-src ${["'self'", "data:", ...httpSources].join(" ")}`,
    `connect-src ${Array.from(new Set(connectSources)).join(" ")}`,
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

function samePath(a, b) {
  const normalize = (value) => {
    const resolved = path.resolve(String(value || ""));
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  return normalize(a) === normalize(b);
}

function normalizeCdpPort(value) {
  const text = String(value || "").trim();
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return number >= 1 && number <= 65535 ? text : null;
}

function resolveAuditLaunchConfig({
  manifestPath = "",
  requestedUserDataDir = "",
  defaultUserDataDir = "",
  cdpPort = "",
} = {}) {
  const manifest = String(manifestPath || "").trim();
  if (!manifest) {
    return {
      auditEnabled: false,
      manifestPath: "",
      userDataDir: "",
      cdpPort: null,
    };
  }

  const resolvedManifest = path.resolve(manifest);
  const isolatedUserData = path.resolve(
    String(requestedUserDataDir || "").trim() ||
      path.join(path.dirname(resolvedManifest), "electron-user-data"),
  );
  if (defaultUserDataDir && samePath(isolatedUserData, defaultUserDataDir)) {
    throw new Error("La auditoría requiere un directorio userData aislado.");
  }

  return {
    auditEnabled: true,
    manifestPath: resolvedManifest,
    userDataDir: isolatedUserData,
    cdpPort: normalizeCdpPort(cdpPort),
  };
}

function canPersistSecret({
  encryptionAvailable,
  platform = process.platform,
  selectedBackend = "",
} = {}) {
  if (!encryptionAvailable) return false;
  if (
    platform === "linux" &&
    String(selectedBackend || "").toLowerCase() === "basic_text"
  ) {
    return false;
  }
  return true;
}

function canReuseStoredSecret({
  storedSecret,
  fingerprintMatches = false,
  cacheMatches = false,
} = {}) {
  return Boolean(
    storedSecret?.encrypted === true &&
      storedSecret.value &&
      (fingerprintMatches || cacheMatches),
  );
}

function writeJsonAtomically(targetPath, value, fsImpl = require("node:fs")) {
  const directory = path.dirname(targetPath);
  fsImpl.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fsImpl.chmodSync(directory, 0o700);

  const temporaryPath = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let descriptor = null;
  let published = false;
  try {
    descriptor = fsImpl.openSync(temporaryPath, "wx", 0o600);
    fsImpl.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
    });
    fsImpl.fsyncSync(descriptor);
    fsImpl.closeSync(descriptor);
    descriptor = null;
    fsImpl.chmodSync(temporaryPath, 0o600);
    fsImpl.renameSync(temporaryPath, targetPath);
    published = true;
    fsImpl.chmodSync(targetPath, 0o600);

    // Sincronizar la entrada del directorio reduce el riesgo de perder el
    // rename tras un corte abrupto. Algunos filesystems/plataformas no
    // permiten abrir directorios; en ellos el archivo ya quedó publicado.
    let directoryDescriptor = null;
    try {
      directoryDescriptor = fsImpl.openSync(directory, "r");
      fsImpl.fsyncSync(directoryDescriptor);
    } catch (_error) {
      // Best effort: Windows puede rechazar openSync sobre un directorio.
    } finally {
      if (directoryDescriptor !== null) fsImpl.closeSync(directoryDescriptor);
    }
  } finally {
    if (descriptor !== null) {
      try {
        fsImpl.closeSync(descriptor);
      } catch (_error) {
        // El error original conserva prioridad.
      }
    }
    if (!published) {
      try {
        fsImpl.unlinkSync(temporaryPath);
      } catch (_error) {
        // El temporal puede no haberse creado.
      }
    }
  }
}

module.exports = {
  buildContentSecurityPolicy,
  canPersistSecret,
  canReuseStoredSecret,
  createNavigationPolicy,
  isTrustedIpcEvent,
  resolveAuditLaunchConfig,
  writeJsonAtomically,
};
