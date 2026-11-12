import { describe, expect, it } from "vitest";
import { normalizarDetector } from "./validacionDetector";

// Lo que serializa Plumber con `serializer_unboxed_json(na = "null")`: escalares
// sueltos, NULL como `{}` y NA como `null`.
const CRUDO = {
  ok: true,
  estado: "listo",
  n_total: 343,
  recopilador: { variable: "Enumerator_name", rotulo: null },
  n_candidatas: 2,
  avisos: [],
  sugerencias: [
    {
      id: "SC_01",
      familia: "combinacion",
      tipo: "frecuencia_multiple",
      titulo: "p11 \"Una vez\" con 4 o más opciones marcadas en p10",
      texto: "Responden \"Una vez\" en p11 y marcan 4 o más de las 8 opciones de p10.",
      variables: [{ variable: "p11", rotulo: "¿Cuántas veces?" }, { variable: "p10", rotulo: null }],
      cifra: { n_casos: 11, base_n: 35, base: "casos que responden \"Una vez\" en p11 y responden p10" },
      concentracion: {
        estado: "concentrada",
        texto: "9 de los 11 casos (81.8 %) son de Karina, que hizo 43 de las 343 encuestas (12.5 %).",
        recopilador: "Karina", n_casos_recopilador: 9, n_casos: 11, n_encuestas_recopilador: 43, n_encuestas: 343,
      },
      casos: [{ fila: 12, recopilador: "Karina", valores: { p11: "1", p10: "1 2 3 4 5 6 7", Enumerator_name: "Karina" } }],
      regla: {
        tipo: "select_multiple_cardinality", variables: ["p10"], params: { max: 3 },
        gate_conditions: [{ variable: "p11", op: "==", value: "1" }],
        nombre: "p11 \"Una vez\" con 4 o más opciones en p10", mensaje: "x", severidad: "advertencia", activa: true,
        origen: "sembrado", semilla: { origen: "detector_consistencia", porque: "y", n_casos_afectados: 11 },
      },
    },
    {
      id: "SC_02",
      familia: "columna",
      tipo: "dato_personal",
      titulo: "Dato potencialmente personal en telefono",
      texto: "telefono: Parece teléfono.",
      variables: { variable: "telefono", rotulo: null },
      cifra: { n_columnas: 1, base_n: 343, base: "casos de la base" },
      concentracion: {},
      casos: [],
      regla: {},
    },
    { id: "SC_03", familia: "otra", titulo: "no" },
  ],
};

describe("normalizarDetector", () => {
  it("lee la sugerencia con su cifra, su concentración, sus casos y su regla", () => {
    const d = normalizarDetector(CRUDO);
    expect(d.estado).toBe("listo");
    expect(d.nTotal).toBe(343);
    expect(d.recopilador).toEqual({ variable: "Enumerator_name", rotulo: null });
    expect(d.sugerencias).toHaveLength(2);
    const [s] = d.sugerencias;
    expect(s.nCasos).toBe(11);
    expect(s.baseN).toBe(35);
    expect(s.concentracion?.estado).toBe("concentrada");
    expect(s.concentracion?.nEncuestasRecopilador).toBe(43);
    expect(s.casos[0]).toEqual({ fila: 12, recopilador: "Karina", valores: { p11: "1", p10: "1 2 3 4 5 6 7", Enumerator_name: "Karina" } });
    expect(s.regla?.tipo).toBe("select_multiple_cardinality");
    expect(s.regla?.gate_conditions).toEqual([{ variable: "p11", op: "==", value: "1" }]);
  });

  it("una regla o una concentración vacías (NULL de R) quedan en null; una variable suelta es lista", () => {
    const s = normalizarDetector(CRUDO).sugerencias[1];
    expect(s.regla).toBeNull();
    expect(s.concentracion).toBeNull();
    expect(s.nCasos).toBeNull();
    expect(s.variables).toEqual([{ variable: "telefono", rotulo: null }]);
  });

  it("sin datos no inventa cifras", () => {
    const d = normalizarDetector({ estado: "sin_datos", n_total: 0, sugerencias: [], avisos: [{ codigo: "sin_datos", texto: "La base todavía no tiene datos cargados." }] });
    expect(d.estado).toBe("sin_datos");
    expect(d.sugerencias).toEqual([]);
    expect(d.nCandidatas).toBeNull();
    expect(d.avisos).toHaveLength(1);
  });
});
