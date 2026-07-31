"use strict";

const ALLOWED_KEYS = new Set([
  "session_id",
  "token_id",
  "hf_username",
  "space_name",
  "private",
]);

function requiredString(payload, key, pattern) {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${key} debe ser un texto no vacío.`);
  }
  const normalized = value.trim();
  if (pattern && !pattern.test(normalized)) {
    throw new TypeError(`${key} tiene un formato inválido.`);
  }
  return normalized;
}

function validatePayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("El payload de publicación HF debe ser un objeto.");
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new TypeError(`El campo ${key} no está permitido en el broker HF.`);
    }
  }
  if (input.private !== undefined && typeof input.private !== "boolean") {
    throw new TypeError("private debe ser booleano.");
  }

  return {
    session_id: requiredString(input, "session_id", /^[A-Za-z0-9._:-]{1,256}$/),
    token_id: requiredString(input, "token_id", /^[A-Za-z0-9._:-]{1,256}$/),
    hf_username: requiredString(
      input,
      "hf_username",
      /^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/,
    ),
    space_name: requiredString(
      input,
      "space_name",
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/,
    ),
    private: input.private,
  };
}

function createHfPublishBroker({
  getBackendPort,
  resolveSavedToken,
  fetch: fetchImpl,
  logger,
} = {}) {
  if (typeof getBackendPort !== "function") {
    throw new TypeError("getBackendPort es obligatorio.");
  }
  if (typeof resolveSavedToken !== "function") {
    throw new TypeError("resolveSavedToken es obligatorio.");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch es obligatorio.");
  }

  return {
    async publish(input) {
      const payload = validatePayload(input);
      const port = Number(getBackendPort());
      if (!Number.isInteger(port) || port < 1024 || port > 49151) {
        throw new Error("El backend local no está listo para publicar.");
      }

      const token = String(
        (await resolveSavedToken(payload.token_id)) || "",
      ).trim();
      if (!token) {
        throw new Error(
          "La credencial guardada no está disponible. Vuelve a autenticarla.",
        );
      }

      const endpoint = `http://127.0.0.1:${port}/api/dashboard/publish`;
      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          redirect: "error",
          headers: {
            "Content-Type": "application/json",
            "X-Pulso-Session": payload.session_id,
          },
          body: JSON.stringify({
            hf_username: payload.hf_username,
            hf_token: token,
            space_name: payload.space_name,
            ...(payload.private === undefined ? {} : { private: payload.private }),
          }),
        });
      } catch (_error) {
        logger?.warn?.("hf_publish_broker_failed", {
          token_id: payload.token_id,
          reason: "transport",
        });
        throw new Error("No se pudo contactar el backend local de publicación.");
      }

      if (!response?.ok) {
        logger?.warn?.("hf_publish_broker_failed", {
          token_id: payload.token_id,
          status: Number(response?.status || 0),
        });
        throw new Error(
          `La publicación local falló (HTTP ${Number(response?.status || 0)}).`,
        );
      }

      let result;
      try {
        result = await response.json();
      } catch (_error) {
        throw new Error("El backend devolvió una respuesta de publicación inválida.");
      }
      if (JSON.stringify(result).includes(token)) {
        throw new Error("El backend intentó devolver material secreto.");
      }
      return result;
    },
  };
}

module.exports = {
  createHfPublishBroker,
};
