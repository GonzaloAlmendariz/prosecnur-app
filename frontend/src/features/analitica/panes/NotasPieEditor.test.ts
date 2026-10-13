import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

// renderToStaticMarkup lee el snapshot de servidor de zustand, que es el
// estado inicial del store. Para probar el render con datos, el hook lee el
// estado vivo; setState/getState siguen siendo los reales.
vi.mock("../store", async (importOriginal) => {
  const real = await importOriginal<typeof import("../store")>();
  const live = <T,>(selector: (s: ReturnType<typeof real.useAnaliticaStore.getState>) => T): T =>
    selector(real.useAnaliticaStore.getState());
  return { ...real, useAnaliticaStore: Object.assign(live, real.useAnaliticaStore) };
});
import { DEFAULT_CONFIG, normalizeAnaliticaConfig, useAnaliticaStore, type AnaliticaConfig } from "../store";
import { NotasPieEditor } from "./NotasPieEditor";
import {
  coerceNotasTexto,
  coerceUmbral,
  DEFAULT_NOTAS_PIE,
  normalizeNotasPie,
  notasDeCruceHuerfanas,
  notasDeCruceVisibles,
  resumenNotasPie,
  setNotaTexto,
} from "./notasPieModel";

function resetStore() {
  useAnaliticaStore.setState({ config: DEFAULT_CONFIG, hydrated: false, dirty: false });
}

describe("normalizeNotasPie", () => {
  test("sin bloque devuelve los defaults del contrato", () => {
    expect(normalizeNotasPie(undefined)).toEqual({
      fuente: "Pulso PUCP",
      base_defecto: "",
      base_por_pregunta: {},
      por_cruce: {},
      base_reducida: { activo: false, umbral: 30 },
    });
    expect(normalizeNotasPie(["x"])).toEqual(DEFAULT_NOTAS_PIE);
  });

  test("conserva los valores válidos y descarta basura", () => {
    const n = normalizeNotasPie({
      fuente: "Pulso PUCP 2026.",
      base_defecto: "total de encuestados.",
      base_por_pregunta: { p1: "quienes trabajan.", p2: "   ", p3: 7, "": "x" },
      por_cruce: { nacimiento: "Agrupa regiones.", sexo: null },
      base_reducida: { activo: true, umbral: "25" },
    });
    expect(n.fuente).toBe("Pulso PUCP 2026.");
    expect(n.base_defecto).toBe("total de encuestados.");
    expect(n.base_por_pregunta).toEqual({ p1: "quienes trabajan." });
    expect(n.por_cruce).toEqual({ nacimiento: "Agrupa regiones." });
    expect(n.base_reducida).toEqual({ activo: true, umbral: 25 });
  });

  test("fuente vacía se respeta (no se rellena con el default)", () => {
    expect(normalizeNotasPie({ fuente: "" }).fuente).toBe("");
  });

  test("activo solo con boolean true", () => {
    expect(normalizeNotasPie({ base_reducida: { activo: "true" } }).base_reducida.activo).toBe(false);
  });
});

describe("coerciones", () => {
  test("coerceUmbral: entero positivo o 30", () => {
    expect(coerceUmbral(12.7)).toBe(12);
    expect(coerceUmbral("40")).toBe(40);
    expect(coerceUmbral(0)).toBe(30);
    expect(coerceUmbral(-5)).toBe(30);
    expect(coerceUmbral("")).toBe(30);
    expect(coerceUmbral(Number.NaN)).toBe(30);
  });

  test("coerceNotasTexto no acepta arrays", () => {
    expect(coerceNotasTexto(["a"])).toEqual({});
  });

  test("setNotaTexto escribe y un texto en blanco borra la clave", () => {
    const a = setNotaTexto({}, "p1", "quienes trabajan.");
    expect(a).toEqual({ p1: "quienes trabajan." });
    const b = setNotaTexto(a, "p1", "  ");
    expect(b).toEqual({});
    expect(a).toEqual({ p1: "quienes trabajan." });
    expect(setNotaTexto(a, " ", "x")).toBe(a);
  });

  test("notas de cruce siguen el orden del banner y avisan las huérfanas", () => {
    const porCruce = { sexo: "Nota sexo.", viejo: "Nota vieja." };
    expect(notasDeCruceVisibles(porCruce, ["nacimiento", "sexo"])).toEqual([
      { variable: "nacimiento", texto: "" },
      { variable: "sexo", texto: "Nota sexo." },
    ]);
    expect(notasDeCruceHuerfanas(porCruce, ["nacimiento", "sexo"])).toEqual(["viejo"]);
  });

  test("resumen del plegable", () => {
    expect(resumenNotasPie(DEFAULT_NOTAS_PIE, false)).toBe("Fuente: Pulso PUCP");
    const n = {
      ...DEFAULT_NOTAS_PIE,
      base_defecto: "total.",
      base_por_pregunta: { p1: "x" },
      por_cruce: { sexo: "y", edad: "z" },
      base_reducida: { activo: true, umbral: 30 },
    };
    expect(resumenNotasPie(n, false)).toBe("Fuente: Pulso PUCP, base por defecto, 1 base propia");
    expect(resumenNotasPie(n, true)).toBe(
      "Fuente: Pulso PUCP, base por defecto, 1 base propia, 2 notas de cruce, aviso bajo 30 casos",
    );
  });
});

describe("store: bloque notas", () => {
  beforeEach(resetStore);

  test("DEFAULT_CONFIG trae notas con el contrato", () => {
    expect(DEFAULT_CONFIG.notas).toEqual(DEFAULT_NOTAS_PIE);
  });

  test("normalizeAnaliticaConfig rellena notas en una config vieja", () => {
    const vieja = { ...DEFAULT_CONFIG } as Partial<AnaliticaConfig>;
    delete vieja.notas;
    const n = normalizeAnaliticaConfig(vieja as AnaliticaConfig);
    expect(n.notas).toEqual(DEFAULT_NOTAS_PIE);
  });

  test("setNotas marca dirty y mezcla base_reducida por campo", () => {
    const st = useAnaliticaStore.getState();
    st.setNotas({ fuente: "Pulso PUCP 2026." });
    st.setNotas({ base_reducida: { activo: true } });
    st.setNotas({ base_reducida: { umbral: 20 } });
    const s = useAnaliticaStore.getState();
    expect(s.dirty).toBe(true);
    expect(s.config.notas.fuente).toBe("Pulso PUCP 2026.");
    expect(s.config.notas.base_reducida).toEqual({ activo: true, umbral: 20 });
  });

  test("el config que viaja al autosave lleva notas con las claves del contrato", () => {
    useAnaliticaStore.getState().setNotas({ por_cruce: { nacimiento: "Agrupa regiones." } });
    const json = JSON.parse(JSON.stringify(useAnaliticaStore.getState().config)) as { notas: Record<string, unknown> };
    expect(Object.keys(json.notas).sort()).toEqual(
      ["base_defecto", "base_por_pregunta", "base_reducida", "fuente", "por_cruce"],
    );
    expect(json.notas.por_cruce).toEqual({ nacimiento: "Agrupa regiones." });
  });
});

describe("NotasPieEditor: render", () => {
  beforeEach(resetStore);

  test("Frecuencias: plegado con resumen, sin geometría propia (sólo el botón estándar)", () => {
    const html = renderToStaticMarkup(createElement(NotasPieEditor, { variante: "frecuencias", variables: [] }));
    expect(html).toContain('aria-label="Notas al pie"');
    expect(html).not.toContain("data-qa-geometry-group");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Fuente: Pulso PUCP");
    expect(html).not.toContain("Base por defecto");
  });

  test("Cruces: el resumen nombra el aviso de base reducida", () => {
    useAnaliticaStore.getState().setNotas({ base_reducida: { activo: true, umbral: 25 } });
    const html = renderToStaticMarkup(
      createElement(NotasPieEditor, { variante: "cruces", variables: [], crucesVars: ["sexo"] }),
    );
    expect(html).toContain("aviso bajo 25 casos");
  });

  test("abierto en Frecuencias: fuente y bases, sin bloques de cruce", () => {
    const html = renderToStaticMarkup(
      createElement(NotasPieEditor, { variante: "frecuencias", variables: [], defaultOpen: true }),
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('data-qa-geometry-group="analitica-notas-pie-frecuencias"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect(html).toContain('placeholder="Pulso PUCP 2026."');
    expect(html).toContain('placeholder="total de encuestados."');
    expect(html).toContain("Todas usan la base por defecto");
    expect(html).not.toContain("Nota por variable de cruce");
    expect(html).not.toContain("Avisar base reducida");
  });

  test("abierto en Cruces sin variables de cruce: vacío propio", () => {
    const html = renderToStaticMarkup(
      createElement(NotasPieEditor, { variante: "cruces", variables: [], crucesVars: [], defaultOpen: true }),
    );
    expect(html).toContain("Sin variables de cruce");
    expect(html).toContain('data-qa-geometry-group="analitica-notas-pie-cruces"');
    expect(html).toContain('data-qa-geometry-capacity="owned"');
    expect(html).toContain("Avisar base reducida");
  });

  test("abierto en Cruces con banner: una fila por variable y bases guardadas", () => {
    useAnaliticaStore.getState().setNotas({
      base_por_pregunta: { p1: "quienes trabajan." },
      por_cruce: { nacimiento: "Agrupa regiones.", viejo: "x" },
    });
    const html = renderToStaticMarkup(
      createElement(NotasPieEditor, {
        variante: "cruces",
        variables: [],
        crucesVars: ["sexo", "nacimiento"],
        defaultOpen: true,
      }),
    );
    expect(html).toContain('value="quienes trabajan."');
    expect(html).toContain('value="Agrupa regiones."');
    expect(html.indexOf("<code>sexo</code>")).toBeLessThan(html.indexOf("<code>nacimiento</code>"));
    expect(html).toContain("<code>viejo</code>");
    expect(html).not.toContain("Sin variables de cruce");
  });
});
