// Mata: un veredicto nuevo del motor («fuera_de_familia» u otro) que se lee como marca, un público sin la marca de
// comparable que se da por comparable, un panorama sin matriz que tumba la UI y el intervalo de Newcombe al revés.
import { describe, expect, it } from "vitest";
import { normalizeDiferenciasLamina } from "./graficosDiferencias";
import { normalizeLaminaEntrePublicos, normalizeParPublico, normalizeTemaEntrePublicos } from "./graficosDiferenciasPublicos";

const TEMA = {
  tipo: "entre_publicos",
  fila: "Satisfacción con la biblioteca",
  indicador: "Top Two Box",
  estado: "evaluable",
  motivo: null,
  equivalencia: "matriz",
  grupos: [
    { base: "docentes", etiqueta: "Docentes", p: 78, n: 120, comparable: true, motivo: null },
    { base: "estudiantes", etiqueta: "Estudiantes", p: 64, n: 410, comparable: true, motivo: null },
  ],
  pares: [{ a: "docentes", b: "estudiantes", p_a: 78, p_b: 64, dif_pp: 14, p: 0.0012, p_ajustado: 0.004, veredicto: "marcada", ic_newcombe: [21.3, 6.2] }],
  nota: "Diferencias entre públicos (muestras independientes): prueba z, corrección de Bonferroni y al menos 30 casos por público.",
};

describe("normalizeLaminaEntrePublicos", () => {
  it("la forma real del motor: temas, pares, familia y tarjetas", () => {
    const l = normalizeLaminaEntrePublicos({ familia: { m: 12, local: false }, temas: [TEMA], tarjetas: [TEMA] });
    expect(l.familia).toEqual({ m: 12, local: false });
    expect(l.temas[0]).toMatchObject({ fila: "Satisfacción con la biblioteca", estado: "evaluable", equivalencia: "matriz", indicador: "Top Two Box" });
    expect(l.temas[0].grupos.map((g) => [g.etiqueta, g.p, g.n, g.comparable])).toEqual([["Docentes", 78, 120, true], ["Estudiantes", 64, 410, true]]);
    expect(l.temas[0].pares[0]).toMatchObject({ dif_pp: 14, p_ajustado: 0.004, veredicto: "marcada", veredicto_crudo: null });
    // El intervalo se ordena: es un dato informativo, no un signo.
    expect(l.temas[0].pares[0].ic_newcombe).toEqual([6.2, 21.3]);
    expect(l.tarjetas.map((t) => t.fila)).toEqual(["Satisfacción con la biblioteca"]);
  });

  it("vacío o basura no revienta: listas vacías, familia 0", () => {
    expect(normalizeLaminaEntrePublicos(undefined)).toEqual({ familia: { m: 0, local: false }, temas: [], tarjetas: [] });
    expect(normalizeLaminaEntrePublicos({ familia: "x", temas: "y", tarjetas: null })).toEqual({ familia: { m: 0, local: false }, temas: [], tarjetas: [] });
  });

  it("un veredicto desconocido no es marca: queda «desconocido» con su texto", () => {
    expect(normalizeParPublico({ veredicto: "fuera_de_familia" }).veredicto).toBe("fuera_de_familia");
    const raro = normalizeParPublico({ veredicto: "marcadisima" });
    expect(raro.veredicto).toBe("desconocido");
    expect(raro.veredicto_crudo).toBe("marcadisima");
    expect(normalizeParPublico({}).veredicto).toBe("desconocido");
    expect(normalizeParPublico({ ic_newcombe: "NA" }).ic_newcombe).toBeNull();
  });

  it("un público sin la marca explícita no es comparable; una equivalencia desconocida cuenta como no declarada", () => {
    const t = normalizeTemaEntrePublicos({ fila: "x", estado: "sin_equivalencia", equivalencia: "por_nombre", grupos: [{ base: "a" }], motivo: "NA" });
    expect(t.grupos[0]).toMatchObject({ base: "a", etiqueta: "a", comparable: false, p: null, n: null });
    expect(t.equivalencia).toBeNull();
    expect(t.motivo).toBeNull();
    expect(t.estado).toBe("sin_equivalencia");
    const nuevo = normalizeTemaEntrePublicos({ estado: "otra_cosa" });
    expect(nuevo.estado).toBe("desconocido");
    expect(nuevo.estado_crudo).toBe("otra_cosa");
  });

  it("acepta escalares de R como vectores de largo uno", () => {
    const t = normalizeTemaEntrePublicos({ fila: ["Tema"], estado: ["evaluable"], grupos: [{ base: ["a"], p: [50], comparable: [true] }] });
    expect(t.fila).toBe("Tema");
    expect(t.estado).toBe("evaluable");
    expect(t.grupos[0]).toMatchObject({ base: "a", p: 50, comparable: true });
  });
});

describe("normalizeDiferenciasLamina con modo_letras «entre_publicos»", () => {
  it("trae `entre_publicos`; una lámina de grupos lo deja en null", () => {
    const l = normalizeDiferenciasLamina({ estado: "con_marcas", modo_letras: "entre_publicos", temas: [TEMA], tarjetas: [TEMA], familia: { m: 3, local: true } });
    expect(l.modo_letras).toBe("entre_publicos");
    expect(l.entre_publicos?.familia).toEqual({ m: 3, local: true });
    expect(l.entre_publicos?.temas).toHaveLength(1);
    expect(normalizeDiferenciasLamina({ estado: "ninguna", modo_letras: "letras" }).entre_publicos).toBeNull();
  });

  it("panorama sin matriz: abstención con temas vacíos, sin error", () => {
    const l = normalizeDiferenciasLamina({ estado: "abstencion", modo_letras: "entre_publicos", temas: [], tarjetas: [], revisar: ["sin_diferencias"] });
    expect(l.estado).toBe("abstencion");
    expect(l.error).toBeNull();
    expect(l.entre_publicos?.temas).toEqual([]);
  });
});
