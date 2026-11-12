// @vitest-environment happy-dom
// Ítem 26 del checklist del practicante: después de "Leer el formulario" la
// mesa seguía unos segundos (60 en la prueba P1) diciendo "El plan del
// formulario todavía no se leyó". El plan ya estaba leído; lo que no se había
// refrescado era el catálogo de la mesa: `onBuildPlan` soltaba su rótulo de
// espera al terminar el POST y la mesa volvía a pedir el catálogo detrás de
// cinco lecturas más, con el catálogo viejo (sin plan) a la vista y sin nada
// que dijera que se estaba leyendo.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { LecturaDelCatalogo } from "../../../../api/validacionCatalogo";
import { normalizarCatalogoCompleto, normalizarCatalogoDeReglas } from "../../../../api/validacionCatalogo";

const orden: string[] = [];
const registrar = <T,>(nombre: string, valor: T) => () => {
  orden.push(nombre);
  return Promise.resolve(valor);
};

vi.mock("../../../../api/client", () => ({
  apiV2InstrumentoReglaToggleActiva: vi.fn(),
  apiV2InstrumentoVariablesExcluidas: registrar("excluidas", { variables: [] }),
  apiV2InstrumentoVariablesExcluidasSave: vi.fn(),
  apiV2Limpieza: registrar("limpieza", null),
  apiV2ReglasCustomCreate: vi.fn(),
  apiV2ReglasCustomDelete: vi.fn(),
  apiV2ReglasCustomList: registrar("propias", { reglas: [] }),
  apiV2ReglasCustomSemillas: registrar("semillas", { semillas: [] }),
  apiV2ReglasCustomUpdate: vi.fn(),
}));
vi.mock("../../../../api/validacionAuditoria", () => ({
  apiAuditar: vi.fn(),
  normalizarCifrasHallazgos: () => null,
}));
vi.mock("../../../../hooks/useJob", () => ({ useJob: () => ({ snapshot: null, error: null, cancel: vi.fn() }) }));
vi.mock("../../inventarioDeBase", () => ({ pedirInventario: registrar("inventario", null) }));

const pedirCatalogo = vi.fn<(base?: string | null) => Promise<LecturaDelCatalogo>>();
vi.mock("../../../../api/validacionCatalogo", async (original) => ({
  ...(await original<typeof import("../../../../api/validacionCatalogo")>()),
  pedirCatalogoCompleto: (base?: string | null) => {
    orden.push("catalogo");
    return pedirCatalogo(base);
  },
}));

const { useMesaDeReglas, LEYENDO_EL_PLAN } = await import("./useMesaDeReglas");
type Mesa = ReturnType<typeof useMesaDeReglas>;

function catalogo(planConstruido: boolean): LecturaDelCatalogo {
  const crudo = { plan_construido: planConstruido, reglas: [], familias: [], por_origen: {} };
  return { completo: normalizarCatalogoCompleto(crudo), ligero: normalizarCatalogoDeReglas(crudo) };
}

let host: HTMLDivElement;
let root: Root;
let mesa: Mesa;

function Sonda() {
  mesa = useMesaDeReglas({ alTerminarAuditoriaDelPanel: () => undefined });
  return null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  orden.length = 0;
  pedirCatalogo.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const planDe = (m: Mesa) => (m.lectura.fase === "lista" ? m.lectura.catalogo.plan_construido : null);

test("el catálogo se pide primero: el motor atiende en orden y es lo único que la mesa espera", async () => {
  pedirCatalogo.mockResolvedValue(catalogo(false));
  await act(async () => root.render(<Sonda />));
  expect(orden[0]).toBe("catalogo");
  expect(orden.slice(1).sort()).toEqual(["excluidas", "inventario", "limpieza", "propias", "semillas"]);
});

test("tras leer el formulario la mesa sigue leyendo hasta tener el catálogo nuevo, sin mostrar el viejo como vigente", async () => {
  pedirCatalogo.mockResolvedValueOnce(catalogo(false));
  await act(async () => root.render(<Sonda />));
  expect(planDe(mesa)).toBe(false);

  // El POST del plan responde; el catálogo nuevo todavía no.
  let entregarCatalogo: (c: LecturaDelCatalogo) => void = () => undefined;
  pedirCatalogo.mockImplementationOnce(() => new Promise((resolve) => { entregarCatalogo = resolve; }));
  const construir = vi.fn(() => Promise.resolve());
  let lectura: Promise<void> = Promise.resolve();
  await act(async () => {
    lectura = mesa.leerFormulario(construir);
  });
  expect(construir).toHaveBeenCalledTimes(1);
  // Mientras el catálogo no llega, la mesa dice que está leyendo el plan.
  expect(mesa.ocupado).toBe(LEYENDO_EL_PLAN);
  expect(mesa.leyendoPlan).toBe(true);

  await act(async () => {
    entregarCatalogo(catalogo(true));
    await lectura;
  });
  expect(planDe(mesa)).toBe(true);
  expect(mesa.ocupado).toBe("");
  expect(mesa.leyendoPlan).toBe(false);
});
