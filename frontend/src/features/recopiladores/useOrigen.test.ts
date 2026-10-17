/**
 * Lista y Origen leen la misma respuesta de `/origen` (E1e): la Lista no pide
 * otra si Origen acaba de leer la de esta revisión, y dos montajes a la vez no
 * duplican el fetch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { origenDe } from "./origen.fixture";

const api = vi.hoisted(() => ({ apiRecopiladoresOrigen: vi.fn() }));
vi.mock("../../api/recopiladores", async (original) => ({
  ...(await original<typeof import("../../api/recopiladores")>()),
  apiRecopiladoresOrigen: api.apiRecopiladoresOrigen,
}));

import { VIGENCIA_DE_LO_LEIDO_MS, leerOrigen, olvidarOrigenLeido, origenReusable } from "./useOrigen";

describe("la lectura compartida del origen", () => {
  beforeEach(() => {
    olvidarOrigenLeido();
    api.apiRecopiladoresOrigen.mockReset();
    api.apiRecopiladoresOrigen.mockResolvedValue(origenDe());
  });
  afterEach(() => olvidarOrigenLeido());

  it("las diferencias de Origen le sirven a la Lista en la misma revisión", async () => {
    await leerOrigen(7, "diferencias");
    expect(origenReusable(7, "resumen")?.stale).toBe(true);
    expect(origenReusable(7, "diferencias")).not.toBeNull();
    expect(origenReusable(8, "resumen")).toBeNull();
  });

  it("un resumen no sirve a quien pide diferencias, ni lo viejo a nadie", async () => {
    await leerOrigen(7, "resumen");
    expect(origenReusable(7, "diferencias")).toBeNull();
    expect(origenReusable(7, "resumen", Date.now() + VIGENCIA_DE_LO_LEIDO_MS + 1)).toBeNull();
  });

  it("dos lecturas a la vez de la misma revisión son un solo fetch", async () => {
    await Promise.all([leerOrigen(7, "resumen"), leerOrigen(7, "resumen")]);
    expect(api.apiRecopiladoresOrigen).toHaveBeenCalledTimes(1);
  });
});
