import { beforeEach, describe, expect, test } from "vitest";
import { conOrigenPesoBase, normalizarPonderacion, origenPesoBase } from "./ponderacionConfigModel";
import { DEFAULT_CONFIG, useAnaliticaStore, type PonderacionConfig } from "./store";

// Editar una parte de la ponderación no puede borrar lo que otra parte declaró:
// el peso base (`design.peso_columna`), el tratamiento de NA/98/99
// (`rake.faltantes`, `rake.imputacion`) y la recalibración del recorte.

const CONFIG: PonderacionConfig = {
  enabled: true,
  design: { var: "", pop_sizes: {}, peso_columna: "peso_diseno" },
  rake: {
    margins: [{ var: "sexo", targets: { "1": 0.48, "2": 0.52 } }],
    faltantes: "imputar",
    imputacion: { umbral: 0.05, semilla: 20261104 },
  },
  trim: { cap: 5, recalibrar: true },
  escala: "expansion",
};

function sembrar() {
  useAnaliticaStore.setState({
    config: { ...DEFAULT_CONFIG, ponderacion: CONFIG },
    hydrated: true,
    dirty: false,
  });
}
const pond = () => useAnaliticaStore.getState().config.ponderacion;

describe("ponderación — editar no borra lo declarado", () => {
  beforeEach(sembrar);

  test("editar una meta conserva el peso base, NA/98/99 y la recalibración", () => {
    useAnaliticaStore.getState().upsertPonderMargin({ var: "sexo", targets: { "1": 0.5, "2": 0.5 } });
    expect(pond().design?.peso_columna).toBe("peso_diseno");
    expect(pond().rake.faltantes).toBe("imputar");
    expect(pond().rake.imputacion).toEqual({ umbral: 0.05, semilla: 20261104 });
    expect(pond().trim).toEqual({ cap: 5, recalibrar: true });
    expect(pond().escala).toBe("expansion");
  });

  test("quitar un margen conserva el tratamiento de NA/98/99", () => {
    useAnaliticaStore.getState().removePonderMargin("sexo");
    expect(pond().rake.margins).toEqual([]);
    expect(pond().rake.faltantes).toBe("imputar");
  });

  test("editar el estrato del diseño no borra el peso base", () => {
    useAnaliticaStore.getState().setPonderDesign({ var: "distrito", pop_sizes: { A: 10 } });
    expect(pond().design).toEqual({ var: "distrito", pop_sizes: { A: 10 }, peso_columna: "peso_diseno" });
  });

  test("cambiar el tope del recorte conserva la recalibración", () => {
    useAnaliticaStore.getState().setPonderTrim({ cap: 4 });
    expect(pond().trim).toEqual({ cap: 4, recalibrar: true });
    useAnaliticaStore.getState().setPonderTrim(null);
    expect(pond().trim).toBeNull();
  });

  test("cambiar NA/98/99 conserva los márgenes", () => {
    useAnaliticaStore.getState().setPonderRake({ faltantes: "excluir" });
    expect(pond().rake.margins).toHaveLength(1);
    expect(pond().rake.imputacion).toEqual({ umbral: 0.05, semilla: 20261104 });
  });
});

describe("origen del peso base", () => {
  const base: PonderacionConfig = { enabled: true, rake: { margins: [] } };
  test('elegir columna antes de nombrarla ya es "columna", no "estrato"', () => {
    expect(origenPesoBase(conOrigenPesoBase(base, "columna"))).toBe("columna");
  });
  test("ninguno, estrato y columna se excluyen", () => {
    const est = conOrigenPesoBase({ ...base, design: { peso_columna: "w" } }, "estrato");
    expect(origenPesoBase(est)).toBe("estrato");
    expect(est.design?.peso_columna).toBeUndefined();
    expect(origenPesoBase(conOrigenPesoBase(est, "ninguno"))).toBe("ninguno");
  });
});

describe("hidratación: la config vuelve pasada por R", () => {
  test("null llega como {} y no cambia el significado", () => {
    const p = normalizarPonderacion({
      enabled: true,
      design: {},
      trim: {},
      total_poblacion: {},
      rake: { margins: [{ var: "sexo", targets: { "1": 4 }, fuente: { tipo: "cpv2025", variable: "sexo", mapeo: { "1": "Hombre" } } }], imputacion: {} },
      metas_cpv2025: { distritos: {}, provincias: "0401", grupos_edad: [{ etiqueta: "65 a más", min: 65, max: {} }], agrupacion_educacion: "4_grupos", desagregacion: "ninguna" },
    });
    expect(origenPesoBase(p)).toBe("ninguno");
    expect(p.trim).toBeNull();
    expect(p.total_poblacion).toBeNull();
    expect(p.rake.margins[0].fuente?.mapeo).toEqual({ "1": ["Hombre"] });
    expect(p.rake.imputacion).toBeUndefined();
    expect(p.metas_cpv2025?.provincias).toEqual(["0401"]);
    expect(p.metas_cpv2025?.distritos).toEqual([]);
    expect(p.metas_cpv2025?.grupos_edad[0].max).toBeNull();
  });
});

describe("metas del CPV editadas a mano", () => {
  test("retocar una meta que vino del censo la deja como tecleada: sin fuente", () => {
    const conFuente: PonderacionConfig = {
      enabled: true,
      rake: { margins: [{ var: "sexo", targets: { "1": 480, "2": 520 }, fuente: { tipo: "cpv2025", variable: "sexo", mapeo: { "1": ["Hombre"], "2": ["Mujer"] } } }] },
    };
    useAnaliticaStore.setState({ config: { ...DEFAULT_CONFIG, ponderacion: conFuente }, hydrated: true, dirty: false });
    // Así edita el panel (CategoryEditor.onChange): margen nuevo con sólo var y targets.
    useAnaliticaStore.getState().upsertPonderMargin({ var: "sexo", targets: { "1": 500, "2": 520 } });
    expect(useAnaliticaStore.getState().config.ponderacion.rake.margins[0].fuente).toBeUndefined();
  });
});
