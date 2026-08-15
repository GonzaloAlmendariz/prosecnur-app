import { describe, expect, it } from "vitest";

import { extractArtifacts, normalizePromocion } from "./limpiezaArtifacts";

const LINAJE = {
  enabled: true,
  source_data_file_id: "DATA_CRUDA",
  effective_data_file_id: "DATA_LIMPIA",
  applied_at: "2026-08-15T10:01:35Z",
  n_casos_antes: 103,
  n_casos_despues: 101,
};

describe("normalizePromocion", () => {
  it("lee el linaje completo", () => {
    const out = normalizePromocion(LINAJE);
    expect(out?.enabled).toBe(true);
    expect(out?.n_casos_antes).toBe(103);
    expect(out?.n_casos_despues).toBe(101);
  });

  it("descarta el objeto vacío con el que R serializa un linaje ausente", () => {
    expect(normalizePromocion({})).toBeNull();
    expect(normalizePromocion(undefined)).toBeNull();
    expect(normalizePromocion(null)).toBeNull();
  });

  it("no toma por conteo el 'NA' que R manda como cadena", () => {
    const out = normalizePromocion({ ...LINAJE, n_casos_despues: "NA" });
    expect(out?.n_casos_despues).toBeNull();
    expect(out?.n_casos_antes).toBe(103);
  });

  it("solo reconoce un bloqueo con texto", () => {
    expect(normalizePromocion({ ...LINAJE, bloqueo: "  " })?.bloqueo).toBeUndefined();
    expect(normalizePromocion({ ...LINAJE, bloqueo: {} })?.bloqueo).toBeUndefined();
    expect(normalizePromocion({ ...LINAJE, enabled: false, bloqueo: "tiene repeats" })?.bloqueo).toBe(
      "tiene repeats",
    );
  });
});

describe("extractArtifacts", () => {
  it("conserva el linaje aunque el cierre se haya invalidado y no queden archivos", () => {
    // Editar una decisión borra `files` y `finalized_at`, pero la base promovida
    // sigue rigiendo: si el bundle se descarta, la promoción queda muda.
    const bundle = extractArtifacts({ promocion: LINAJE } as never);
    expect(bundle).not.toBeNull();
    expect(bundle?.promocion?.enabled).toBe(true);
    expect(bundle?.files).toEqual([]);
  });

  it("sigue leyendo el bundle normal del cierre", () => {
    const bundle = extractArtifacts({
      finalized_at: "2026-08-15T10:01:35Z",
      promocion: LINAJE,
      files: [
        {
          kind: "base_limpia",
          label: "Base final limpia",
          file_id: "F1",
          original_name: "base_limpia.xlsx",
          generated_at: "2026-08-15T10:01:35Z",
        },
      ],
    } as never);
    expect(bundle?.files).toHaveLength(1);
    expect(bundle?.finalized_at).toBe("2026-08-15T10:01:35Z");
  });

  it("devuelve null cuando no hay ni archivos ni linaje", () => {
    expect(extractArtifacts({} as never)).toBeNull();
    expect(extractArtifacts(undefined)).toBeNull();
  });
});

describe("sin_respaldo", () => {
  it("solo viaja en TRUE: un {} del serializer no debe encenderlo", () => {
    expect(normalizePromocion({ ...LINAJE, sin_respaldo: true })?.sin_respaldo).toBe(true);
    expect(normalizePromocion({ ...LINAJE, sin_respaldo: {} })?.sin_respaldo).toBeUndefined();
    expect(normalizePromocion({ ...LINAJE, sin_respaldo: false })?.sin_respaldo).toBeUndefined();
    expect(normalizePromocion(LINAJE)?.sin_respaldo).toBeUndefined();
  });
});
