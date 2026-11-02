import { describe, expect, test } from "vitest";
import type { EnvioMeta } from "../../../../api/materialTerritorial";
import { envioVigente } from "./envioVigente";

const meta = (enviado_at: string, desactualizado = false): EnvioMeta => ({ enviado_at, sorteado_en: null, sample_fingerprint: "h", n_titulares: 150, n_reemplazos: 300, desactualizado });

describe("envío vigente del panel Entrega", () => {
  test("muestra el envío recién hecho hasta que el estado releído lo alcance", () => {
    const recien = meta("2026-11-01T20:14:00Z");
    expect(envioVigente(null, recien)).toBe(recien);
    expect(envioVigente(meta("2026-11-01T19:00:00Z", true), recien)).toBe(recien);
    const releido = meta("2026-11-01T20:14:00Z");
    expect(envioVigente(releido, recien)).toBe(releido);
    expect(envioVigente(releido, null)).toBe(releido);
  });
});
