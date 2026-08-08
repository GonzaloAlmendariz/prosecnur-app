import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GraficosSlideLayoutMatrix } from "../../api/client";
import {
  acknowledgeSlideCompositionRevision,
  clearSlideCompositionCache,
  invalidateSlideCompositionPersistenceAck,
  publicSlideCompositionError,
  requestSlideCompositionMatrix,
  slideCompositionIdentityFromScopeRules,
  slideCompositionMatrixCacheKey,
  slideCompositionRequestKey,
  slideCompositionRevision,
  visibleSlideCompositionsSnapshot,
} from "./useSlideCompositions";

function matrix(
  fingerprint = "sha256:matrix-a",
  template: GraficosSlideLayoutMatrix["template"] = {
    id: "template-explicit",
    fingerprint,
    identity_source: "template_id",
  },
): GraficosSlideLayoutMatrix {
  return {
    schema: "graficos.slide_layout_matrix/v2",
    contract_version: 2,
    template: { ...template, fingerprint },
    canvas: { width: 13.333, height: 7.5, aspect_ratio: 16 / 9 },
    slides: [],
  };
}

function matchingMatrix(
  options: { profile_id?: string; template_id?: string },
  fingerprint = "sha256:matrix-a",
): GraficosSlideLayoutMatrix {
  const templateId = options.template_id?.trim();
  const profileId = options.profile_id?.trim();
  return matrix(fingerprint, {
    id: templateId || (profileId ? `profile:${profileId}` : "default-template"),
    fingerprint,
    identity_source: templateId ? "template_id" : profileId ? "profile_id" : "default",
  });
}

describe("useSlideCompositions cache", () => {
  beforeEach(() => {
    clearSlideCompositionCache();
  });

  it("deduplica veinte consumidores en un solo request batch", async () => {
    const response = matrix();
    const loader = vi.fn(async () => response);
    const identity = {
      profile_id: "profile-1",
      template_id: "template-explicit",
      scope: "consolidated" as const,
    };
    const revision = "revision-a";
    acknowledgeSlideCompositionRevision("sid-1", "consolidated", revision);

    const matrices = await Promise.all(
      Array.from({ length: 20 }, () => (
        requestSlideCompositionMatrix("sid-1", identity, revision, loader)
      )),
    );
    const cached = await requestSlideCompositionMatrix("sid-1", identity, revision, loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith(identity);
    expect(matrices.every((candidate) => candidate === response)).toBe(true);
    expect(cached).toBe(response);
  });

  it("separa caché por sesión, profile, template, scope y fingerprint", async () => {
    const loader = vi.fn(async (options) => matchingMatrix(options));
    const revision = "revision-a";
    acknowledgeSlideCompositionRevision("sid-a", "active", revision);
    acknowledgeSlideCompositionRevision("sid-b", "active", revision);
    acknowledgeSlideCompositionRevision("sid-a", "consolidated", revision);

    await requestSlideCompositionMatrix("sid-a", { profile_id: "p", template_id: "t", scope: "active" }, revision, loader);
    await requestSlideCompositionMatrix("sid-b", { profile_id: "p", template_id: "t", scope: "active" }, revision, loader);
    await requestSlideCompositionMatrix("sid-a", { profile_id: "p-2", template_id: "t", scope: "active" }, revision, loader);
    await requestSlideCompositionMatrix("sid-a", { profile_id: "p", template_id: "t-2", scope: "active" }, revision, loader);
    await requestSlideCompositionMatrix("sid-a", { profile_id: "p", template_id: "t", scope: "consolidated" }, revision, loader);

    expect(loader).toHaveBeenCalledTimes(5);
    expect(slideCompositionRequestKey("sid-a", { profile_id: "p", template_id: "t", scope: "active" }))
      .not.toBe(slideCompositionRequestKey("sid-b", { profile_id: "p", template_id: "t", scope: "active" }));
    expect(slideCompositionRequestKey("sid-a", { profile_id: "p", template_id: "t", scope: "active" }))
      .not.toBe(slideCompositionRequestKey("sid-a", { profile_id: "p", template_id: "t", scope: "consolidated" }));
    expect(slideCompositionMatrixCacheKey(
      "sid-a",
      { profile_id: "p", template_id: "t", scope: "active" },
      "sha256:matrix-a",
    )).not.toBe(slideCompositionMatrixCacheKey(
      "sid-a",
      { profile_id: "p", template_id: "t", scope: "active" },
      "sha256:matrix-b",
    ));
    expect(slideCompositionMatrixCacheKey(
      "sid-a",
      { profile_id: "p", template_id: "t", scope: "active" },
      "sha256:matrix-a",
    )).not.toBe(slideCompositionMatrixCacheKey(
      "sid-a",
      { profile_id: "p", template_id: "t", scope: "consolidated" },
      "sha256:matrix-a",
    ));
  });

  it("refresca al cambiar la revisión sin enviarla como query a la API", async () => {
    const loader = vi.fn(async (options) => matchingMatrix(options));
    const identity = {
      profile_id: " profile-1 ",
      template_id: " template-explicit ",
      scope: "consolidated" as const,
    };

    acknowledgeSlideCompositionRevision("sid-1", "consolidated", "revision-a");
    await requestSlideCompositionMatrix("sid-1", identity, "revision-a", loader);
    await requestSlideCompositionMatrix("sid-1", identity, "revision-a", loader);
    acknowledgeSlideCompositionRevision("sid-1", "consolidated", "revision-b");
    await requestSlideCompositionMatrix("sid-1", identity, "revision-b", loader);

    expect(loader).toHaveBeenCalledTimes(2);
    expect(loader).toHaveBeenNthCalledWith(1, {
      profile_id: "profile-1",
      template_id: "template-explicit",
      scope: "consolidated",
    });
    expect(loader).toHaveBeenNthCalledWith(2, {
      profile_id: "profile-1",
      template_id: "template-explicit",
      scope: "consolidated",
    });
    expect(loader.mock.calls.every(([options]) => (
      !("cache_revision" in options)
      && !("presets" in options)
      && !("debug_ph" in options)
    ))).toBe(true);
  });

  it("rechaza template.id vacío antes de cachear", async () => {
    const revision = "revision-empty-id";
    const identity = { scope: "active" as const };
    const loader = vi.fn(async () => matrix("sha256:empty-id", {
      id: " ",
      fingerprint: "sha256:empty-id",
      identity_source: "default",
    }));
    acknowledgeSlideCompositionRevision("sid-empty", "active", revision);

    await expect(requestSlideCompositionMatrix(
      "sid-empty",
      identity,
      revision,
      loader,
    )).rejects.toThrow(/identidad de plantilla válida/);
  });

  it("rechaza template mismatch y permite reintentar porque no lo cachea", async () => {
    const revision = "revision-template";
    const identity = { template_id: "template-explicit", scope: "active" as const };
    const invalid = matrix("sha256:mismatch", {
      id: "template-other",
      fingerprint: "sha256:mismatch",
      identity_source: "template_id",
    });
    const valid = matchingMatrix(identity, "sha256:valid");
    const loader = vi.fn()
      .mockResolvedValueOnce(invalid)
      .mockResolvedValueOnce(valid);
    acknowledgeSlideCompositionRevision("sid-template", "active", revision);

    await expect(requestSlideCompositionMatrix(
      "sid-template",
      identity,
      revision,
      loader,
    )).rejects.toThrow(/contradice la identidad de plantilla/);
    await expect(requestSlideCompositionMatrix(
      "sid-template",
      identity,
      revision,
      loader,
    )).resolves.toBe(valid);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("rechaza identity_source incompatible con template o profile explícitos", async () => {
    const revision = "revision-source";
    acknowledgeSlideCompositionRevision("sid-source", "active", revision);

    await expect(requestSlideCompositionMatrix(
      "sid-source",
      { template_id: "template-explicit", scope: "active" },
      revision,
      vi.fn(async () => matrix("sha256:wrong-template-source", {
        id: "template-explicit",
        fingerprint: "sha256:wrong-template-source",
        identity_source: "profile_id",
      })),
    )).rejects.toThrow(/contradice la identidad de plantilla/);

    await expect(requestSlideCompositionMatrix(
      "sid-source",
      { profile_id: "profile-explicit", scope: "active" },
      revision,
      vi.fn(async () => matrix("sha256:wrong-profile-source", {
        id: "profile-template",
        fingerprint: "sha256:wrong-profile-source",
        identity_source: "default",
      })),
    )).rejects.toThrow(/contradice la identidad de perfil/);
  });

  it("calcula una revisión determinista de presets, debug y scope efectivo", () => {
    const left = slideCompositionRevision({
      presets: { theme: { accent: "#123456", font: "Inter" }, density: 2 },
      debugPh: { lwd: 1, color: "red" },
      scopeRules: { global: { template_id: "template-1", profile_id: "profile-1" } },
    });
    const reordered = slideCompositionRevision({
      presets: { density: 2, theme: { font: "Inter", accent: "#123456" } },
      debugPh: { color: "red", lwd: 1 },
      scopeRules: { global: { profile_id: "profile-1", template_id: "template-1" } },
    });

    expect(reordered).toBe(left);
    expect(slideCompositionRevision({
      presets: { density: 3 },
      debugPh: { lwd: 1, color: "red" },
      scopeRules: { global: { template_id: "template-1" } },
    })).not.toBe(left);
    expect(slideCompositionRevision({
      presets: { density: 2 },
      debugPh: { lwd: 2, color: "red" },
      scopeRules: { global: { template_id: "template-1" } },
    })).not.toBe(left);
    expect(slideCompositionRevision({
      presets: { density: 2 },
      debugPh: { lwd: 1, color: "red" },
      scopeRules: { global: { template_id: "template-2" } },
    })).not.toBe(left);
  });

  it("no carga con ack ausente o viejo y vuelve a cerrar al invalidarlo", async () => {
    const loader = vi.fn(async (options) => matchingMatrix(options));
    const identity = { template_id: "template-explicit", scope: "active" as const };

    await expect(requestSlideCompositionMatrix(
      "sid-1",
      identity,
      "revision-current",
      loader,
    )).rejects.toThrow(/aún no fue persistida/);
    acknowledgeSlideCompositionRevision("sid-1", "active", "revision-old");
    await expect(requestSlideCompositionMatrix(
      "sid-1",
      identity,
      "revision-current",
      loader,
    )).rejects.toThrow(/aún no fue persistida/);
    expect(loader).not.toHaveBeenCalled();

    acknowledgeSlideCompositionRevision("sid-1", "active", "revision-current");
    await expect(requestSlideCompositionMatrix(
      "sid-1",
      identity,
      "revision-current",
      loader,
    )).resolves.toMatchObject({ template: { id: "template-explicit" } });
    invalidateSlideCompositionPersistenceAck("sid-1", "active");
    await expect(requestSlideCompositionMatrix(
      "sid-1",
      identity,
      "revision-current",
      loader,
    )).rejects.toThrow(/aún no fue persistida/);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("no cachea una respuesta si el ack deja de ser exacto durante el request", async () => {
    const revision = "revision-in-flight";
    const identity = { template_id: "template-explicit", scope: "active" as const };
    const response = matchingMatrix(identity);
    let resolveRequest: (matrix: GraficosSlideLayoutMatrix) => void = () => {
      throw new Error("Request de prueba no iniciado");
    };
    const loader = vi.fn(() => new Promise<GraficosSlideLayoutMatrix>((resolve) => {
      resolveRequest = resolve;
    }));
    acknowledgeSlideCompositionRevision("sid-flight", "active", revision);

    const pending = requestSlideCompositionMatrix(
      "sid-flight",
      identity,
      revision,
      loader,
    );
    invalidateSlideCompositionPersistenceAck("sid-flight", "active");
    resolveRequest(response);
    await expect(pending).rejects.toThrow(/cambió durante la carga/);

    acknowledgeSlideCompositionRevision("sid-flight", "active", revision);
    const retryLoader = vi.fn(async () => response);
    await expect(requestSlideCompositionMatrix(
      "sid-flight",
      identity,
      revision,
      retryLoader,
    )).resolves.toBe(response);
    expect(retryLoader).toHaveBeenCalledTimes(1);
  });

  it("un nuevo ack de la misma revisión no reutiliza la caché de otra hidratación", async () => {
    const revision = "revision-same";
    const identity = { template_id: "template-explicit", scope: "active" as const };
    const first = matchingMatrix(identity, "sha256:first-hydration");
    const second = matchingMatrix(identity, "sha256:second-hydration");
    const loader = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    acknowledgeSlideCompositionRevision("sid-same", "active", revision);
    await expect(requestSlideCompositionMatrix(
      "sid-same",
      identity,
      revision,
      loader,
    )).resolves.toBe(first);
    invalidateSlideCompositionPersistenceAck("sid-same", "active");
    acknowledgeSlideCompositionRevision("sid-same", "active", revision);
    await expect(requestSlideCompositionMatrix(
      "sid-same",
      identity,
      revision,
      loader,
    )).resolves.toBe(second);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("normaliza aliases nested con precedencia snake y no lee identidad top-level", () => {
    expect(slideCompositionIdentityFromScopeRules({
      global: {
        profile_id: "  profile-explicit  ",
        template_id: " template-explicit ",
        profileId: "profile-camel-ignored",
        templateId: "template-camel-ignored",
        acnur_mode: true,
        template_path: "/private/project/template.pptx",
      },
    })).toEqual({
      profile_id: "profile-explicit",
      template_id: "template-explicit",
    });
    expect(slideCompositionIdentityFromScopeRules({
      global: {
        profileId: " profile-camel ",
        templateId: " template-camel ",
      },
    })).toEqual({
      profile_id: "profile-camel",
      template_id: "template-camel",
    });
    expect(slideCompositionIdentityFromScopeRules({
      profile_id: "profile-top-level-backend",
      templateId: "template-top-level-backend",
      global: { acnur_mode: true, template_path: "ACNUR.pptx" },
    })).toEqual({
      profile_id: undefined,
      template_id: undefined,
    });
  });

  it("cierra el snapshot anterior al cambiar la clave de sesión/identidad", () => {
    const previous = {
      requestKey: "sid-a",
      matrix: matrix(),
      loading: false,
      error: "",
    };

    expect(visibleSlideCompositionsSnapshot("sid-b", previous)).toEqual({
      requestKey: "sid-b",
      matrix: null,
      loading: true,
      error: "",
    });
    expect(visibleSlideCompositionsSnapshot("sid-a", previous)).toBe(previous);
  });

  it("expone un error público constante sin filtrar la causa", () => {
    expect(publicSlideCompositionError(new Error("ruta/secreto"))).toBe(
      "No pudimos consultar la composición efectiva; se conserva la referencia nominal.",
    );
  });
});
