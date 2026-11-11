// @vitest-environment happy-dom
/**
 * Las metas del censo no se cierran ni pierden su estado al aplicar un margen.
 *
 * El bloque se abría mientras no hubiera metas del censo (`delCenso === 0`) y se
 * desmontaba al cerrarse. "Usar como metas" sube ese conteo a 1: el bloque se
 * cerraba solo con la consulta, la selección y los márgenes aún sin asignar.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VariableInstrumento } from "../../../api/client";

const catalogo = vi.fn();
const consulta = vi.fn();

vi.mock("../../../api/ponderacionCpv2025", () => ({
  getCpv2025Catalogo: () => catalogo(),
  postCpv2025Metas: () => consulta(),
}));
vi.mock("../../../api/analitica", async (original) => ({
  ...(await original<typeof import("../../../api/analitica")>()),
  apiAnaliticaDataReview: () => Promise.resolve({ ok: true, variables: [] }),
  apiAnaliticaColumnValues: (name: string) => Promise.resolve({
    ok: true, column: name, n_total: 0, truncated: false,
    values: name === "sexo"
      ? [{ value: "1", label: "Hombre" }, { value: "2", label: "Mujer" }]
      : [{ value: "1", label: "18 a 44" }, { value: "2", label: "45 a más" }],
  }),
}));
vi.mock("../../project/ProjectModulesContext", () => ({ useProjectModules: () => ({ overview: null }) }));

const VARIABLES = [
  { name: "sexo", label: "Sexo", categorica: true, numerica: false },
  { name: "edad", label: "Grupo de edad", categorica: true, numerica: false },
] as unknown as VariableInstrumento[];

const METAS = {
  fuente: "Censo", universo: "Población de 18 años a más", consultado: "2026-11-01",
  ambito: { nivel: "conjunto", nDistritos: 12, ubigeos: [], provincias: [] },
  total: 1234567,
  margenes: [
    { variable: "sexo", etiqueta: "Sexo", total: 1234567, categorias: [{ codigo: "h", etiqueta: "Hombre", poblacion: 600000 }, { codigo: "m", etiqueta: "Mujer", poblacion: 634567 }] },
    { variable: "edad", etiqueta: "Edad", total: 1234567, categorias: [{ codigo: "a", etiqueta: "18 a 44", poblacion: 700000 }, { codigo: "b", etiqueta: "45 a más", poblacion: 534567 }] },
  ],
  avisos: [],
};

let host: HTMLDivElement;
let root: Root;

const esperar = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const botones = (texto: string) => [...host.querySelectorAll("button")].filter((b) => b.textContent?.trim() === texto);
const pulsar = async (boton: HTMLButtonElement | undefined) => {
  expect(boton, "el botón existe").toBeDefined();
  expect(boton?.disabled, "el botón está habilitado").toBe(false);
  await act(async () => { boton?.click(); });
  await esperar();
};
const bloque = () => host.querySelector<HTMLElement>("#pond-metas-del-censo");

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  catalogo.mockReset().mockResolvedValue({
    fuente: "Censo", universo: "Población de 18 años a más", consultado: "2026-11-01",
    distritos: [], provincias: [],
    agrupacionesEducacion: [{ codigo: "4_grupos", etiqueta: "Cuatro grupos" }],
    gruposEdadDefault: [{ etiqueta: "", min: 18, max: 44 }, { etiqueta: "", min: 45, max: null }],
  });
  consulta.mockReset().mockResolvedValue(METAS);
  const { useAnaliticaStore } = await import("../store");
  const base = useAnaliticaStore.getState().config;
  useAnaliticaStore.setState({ config: { ...base, ponderacion: { enabled: true, poblacion: "territorio", rake: { margins: [] } } } });
  const { PanelMuestraPoblacion } = await import("./PanelMuestraPoblacion");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <PanelMuestraPoblacion
        lecturaVariables={{ tipo: "lista", variables: VARIABLES }}
        variables={VARIABLES}
        baseActiva="hogares"
        comparacion={undefined}
      />,
    );
  });
  await esperar();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("Ponderación: metas del censo", () => {
  it("tras aplicar el primer margen el bloque sigue abierto y la consulta sigue ahí", async () => {
    // Estudio territorial sin metas del censo: el bloque está a la vista sin pulsar nada.
    expect(bloque()?.hidden).toBe(false);
    await pulsar(botones("Consultar")[0]);
    await esperar();
    expect(bloque()?.textContent).toContain("Población censada: 1,234,567 personas en 12 distritos");
    expect(botones("Usar como metas")).toHaveLength(2);

    await pulsar(botones("Usar como metas")[0]);

    const { useAnaliticaStore } = await import("../store");
    const margenes = useAnaliticaStore.getState().config.ponderacion.rake.margins;
    expect(margenes.map((m) => [m.var, m.fuente?.tipo])).toEqual([["sexo", "cpv2025"]]);
    // El conteo de metas del censo pasó de 0 a 1 y el bloque no se cerró.
    expect(bloque(), "el bloque sigue montado").not.toBeNull();
    expect(bloque()?.hidden).toBe(false);
    expect(bloque()?.textContent).toContain("Población censada: 1,234,567 personas en 12 distritos");
    // El margen aplicado se puede actualizar y el otro sigue pendiente de asignar.
    expect(botones("Actualizar metas")).toHaveLength(1);
    expect(botones("Usar como metas")).toHaveLength(1);
  });

  it("cerrar y reabrir no pierde la consulta ni vuelve a pedir el catálogo", async () => {
    await pulsar(botones("Consultar")[0]);
    await esperar();
    const alternar = () => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Metas del censo"));
    expect(alternar()?.getAttribute("aria-expanded")).toBe("true");

    await pulsar(alternar());
    expect(alternar()?.getAttribute("aria-expanded")).toBe("false");
    // Cerrado: oculto, pero montado y con la consulta dentro.
    expect(bloque()?.hidden).toBe(true);
    expect(bloque()?.textContent).toContain("Población censada: 1,234,567");

    await pulsar(alternar());
    expect(bloque()?.hidden).toBe(false);
    expect(bloque()?.textContent).toContain("Población censada: 1,234,567");
    expect(botones("Usar como metas")).toHaveLength(2);
    expect(catalogo).toHaveBeenCalledTimes(1);
    expect(consulta).toHaveBeenCalledTimes(1);
  });
});
