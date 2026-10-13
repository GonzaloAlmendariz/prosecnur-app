import { describe, expect, it } from "vitest";
import { normalizeOrigenExterno } from "./cargaOrigenExterno";

// Fixture del contrato `GET/POST /api/carga/origen-externo` (ADR 0100, P2),
// con la forma en que R serializa: escalares de largo uno y listas desenrolladas.
const HSYVBG = {
  ok: [true],
  base: ["hostigamiento"],
  estado: ["vigente"],
  bloque: {
    enabled: [true],
    script: ["limpieza_hostigamiento.R"],
    version: ["v3"],
    n_recibidas: [3327],
    n_recibidas_deducida: [false],
    n_entregadas: [3318],
    n_excluidas: [9],
    data_file_id: ["abc"],
    declarado_at: ["2026-10-13T15:00:00Z"],
  },
  resumen: {
    recibidas: [3327],
    excluidas: [9],
    entregadas: [3318],
    por_categoria: [
      { categoria: ["ambiguo"], n: [6] },
      { categoria: ["crítico"], n: [3] },
    ],
  },
};

describe("normalizeOrigenExterno", () => {
  it("lee el caso HSyVBG con escalares de largo uno", () => {
    const out = normalizeOrigenExterno(HSYVBG);
    expect(out.base).toBe("hostigamiento");
    expect(out.estado).toBe("vigente");
    expect(out.bloque).toMatchObject({
      script: "limpieza_hostigamiento.R",
      version: "v3",
      n_recibidas: 3327,
      n_recibidas_deducida: false,
      n_entregadas: 3318,
      n_excluidas: 9,
      enabled: true,
    });
    expect(out.resumen).toEqual({
      recibidas: 3327,
      excluidas: 9,
      entregadas: 3318,
      por_categoria: [
        { categoria: "ambiguo", n: 6 },
        { categoria: "crítico", n: 3 },
      ],
    });
    expect(out.avisos).toEqual([]);
  });

  it("acepta por_categoria desenrollado o por columnas", () => {
    const uno = normalizeOrigenExterno({
      ...HSYVBG,
      resumen: { ...HSYVBG.resumen, por_categoria: { categoria: "crítico", n: 9 } },
    });
    expect(uno.resumen?.por_categoria).toEqual([{ categoria: "crítico", n: 9 }]);
    const columnas = normalizeOrigenExterno({
      ...HSYVBG,
      resumen: { ...HSYVBG.resumen, por_categoria: { categoria: ["a", "b"], n: [4, 5] } },
    });
    expect(columnas.resumen?.por_categoria).toEqual([{ categoria: "a", n: 4 }, { categoria: "b", n: 5 }]);
  });

  it("sin declaración: R manda NULL como {} o [] y el estado vacío", () => {
    for (const bloque of [null, {}, [], undefined]) {
      const out = normalizeOrigenExterno({ ok: true, base: "b", estado: "", bloque, resumen: {} });
      expect(out.estado).toBe("");
      expect(out.bloque).toBeNull();
      expect(out.resumen).toBeNull();
    }
  });

  it("un bloque deshabilitado no es declaración aunque el estado diga vigente", () => {
    const out = normalizeOrigenExterno({ ...HSYVBG, bloque: { ...HSYVBG.bloque, enabled: [false] } });
    expect(out.bloque).toBeNull();
    expect(out.estado).toBe("");
  });

  it("conserva otra_base y lee un estado desconocido con bloque como vigente", () => {
    expect(normalizeOrigenExterno({ ...HSYVBG, estado: ["otra_base"] }).estado).toBe("otra_base");
    expect(normalizeOrigenExterno({ ...HSYVBG, estado: ["raro"] }).estado).toBe("vigente");
  });

  it("NA o ausente no se vuelve cero en las recibidas", () => {
    const out = normalizeOrigenExterno({
      ...HSYVBG,
      bloque: { ...HSYVBG.bloque, n_recibidas: ["NA"], n_entregadas: null },
      resumen: { excluidas: [9] },
    });
    expect(out.bloque?.n_recibidas).toBeNull();
    expect(out.bloque?.n_entregadas).toBeNull();
    expect(out.resumen?.recibidas).toBeNull();
    expect(out.resumen?.por_categoria).toEqual([]);
  });

  it("lee avisos desenrollados y descarta los que no traen mensaje", () => {
    const out = normalizeOrigenExterno({
      ...HSYVBG,
      avisos: { codigo: ["no_cuadra"], mensaje: ["Se declararon 3330 recibidas…"] },
    });
    expect(out.avisos).toEqual([{ codigo: "no_cuadra", mensaje: "Se declararon 3330 recibidas…" }]);
    const varios = normalizeOrigenExterno({
      ...HSYVBG,
      avisos: [
        { codigo: "duplicadas", mensaje: "La lista repite 1 identificador(es)." },
        { codigo: "nuevo_codigo", mensaje: "Algo que el front no conoce." },
        { codigo: "sin_motivo", mensaje: "" },
      ],
    });
    expect(varios.avisos.map((aviso) => aviso.codigo)).toEqual(["duplicadas", "otro"]);
  });

  it("no expone identificadores aunque el payload los trajera", () => {
    const out = normalizeOrigenExterno({
      ...HSYVBG,
      bloque: { ...HSYVBG.bloque, exclusiones: [{ id: "uuid-secreto", motivo: "burla" }] },
    });
    expect(JSON.stringify(out)).not.toContain("uuid-secreto");
  });
});
