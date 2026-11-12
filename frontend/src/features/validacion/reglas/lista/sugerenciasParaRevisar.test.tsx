// @vitest-environment happy-dom
// "Sugerencias para revisar" (ítem 31): la frase, la cifra de concentración,
// "Ver casos" por la dirección y "Convertir en regla".
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DetectorDeConsistencia } from "../../../../api/validacionDetector";
import { columnasDeCasos, lineaDeConcentracion, searchConCasosDeSugerencia, searchSinCasosDeSugerencia } from "./modeloSugerencias";

const pedir = vi.fn<(base?: string | null) => Promise<DetectorDeConsistencia>>();
vi.mock("../../../../api/validacionDetector", () => ({ pedirDetectorDeConsistencia: (b?: string | null) => pedir(b) }));

const { SugerenciasParaRevisar } = await import("./SugerenciasParaRevisar");

const REGLA = {
  tipo: "select_multiple_cardinality" as const, variables: ["serv"], params: { max: 3 },
  gate_conditions: [{ variable: "frec", op: "==" as const, value: "1" }],
  nombre: "frec \"Una vez\" con 4 o más opciones en serv", mensaje: "m", severidad: "advertencia" as const, activa: true,
  semilla: { origen: "detector_consistencia", porque: "p" },
};

const DETECTOR: DetectorDeConsistencia = {
  estado: "listo",
  nTotal: 300,
  recopilador: { variable: "enc", rotulo: null },
  nCandidatas: 1,
  avisos: [],
  sugerencias: [{
    id: "SC_01", familia: "combinacion", tipo: "frecuencia_multiple",
    titulo: "frec \"Una vez\" con 4 o más opciones marcadas en serv",
    texto: "Responden \"Una vez\" en frec y marcan 4 o más de las 7 opciones de serv.",
    variables: [{ variable: "frec", rotulo: null }, { variable: "serv", rotulo: null }],
    nCasos: 2, base: "casos", baseN: 100,
    concentracion: { estado: "concentrada", texto: "2 de los 2 casos (100.0 %) son de Persona 10, que hizo 30 de las 300 encuestas (10.0 %).",
      recopilador: "Persona 10", nCasosRecopilador: 2, nCasos: 2, nEncuestasRecopilador: 30, nEncuestas: 300 },
    casos: [
      { fila: 271, recopilador: "Persona 10", valores: { frec: "1", serv: "1 2 3 4 5 6" } },
      { fila: 272, recopilador: "Persona 10", valores: { frec: "1", serv: "1 2 3 4" } },
    ],
    regla: REGLA,
  }],
};

let host: HTMLDivElement;
let root: Root;
let ubicacion = "";

function Ubicacion() {
  ubicacion = useLocation().search;
  return null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  pedir.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

async function montar(detector: DetectorDeConsistencia, onConvertir = vi.fn()) {
  pedir.mockResolvedValue(detector);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/procesamiento?seccion=validacion&pestana=reglas&familia=propias"]}>
        <SugerenciasParaRevisar ocupada={false} onConvertir={onConvertir} />
        <Ubicacion />
      </MemoryRouter>,
    );
  });
  return onConvertir;
}

const boton = (texto: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === texto) as HTMLButtonElement | undefined;

test("muestra la frase y quién concentra los casos, sin íconos de varita ni estrellas", async () => {
  await montar(DETECTOR);
  const bloque = host.querySelector("section.pulso-rl-sugerencias");
  expect(bloque?.textContent).toContain("Sugerencias para revisar");
  expect(bloque?.textContent).toContain("Responden \"Una vez\" en frec");
  expect(bloque?.textContent).toContain("2 de los 2 casos (100.0 %) son de Persona 10");
  expect(bloque?.querySelector("svg")).toBeNull();
});

test("Ver casos abre el diálogo por la dirección y lista las filas; cerrar limpia panel y foco", async () => {
  await montar(DETECTOR);
  await act(async () => boton("Ver casos")!.click());
  expect(new URLSearchParams(ubicacion).get("panel")).toBe("sugerencia");
  expect(new URLSearchParams(ubicacion).get("foco")).toBe("SC_01");
  const dialogo = document.querySelector("[role='dialog']");
  expect(dialogo?.textContent).toContain("271");
  expect(dialogo?.textContent).toContain("1 2 3 4 5 6");
  expect(dialogo?.textContent).toContain("Recopilador");
  expect(searchSinCasosDeSugerencia(ubicacion)).not.toContain("foco");
});

test("Convertir en regla entrega la regla de la sugerencia", async () => {
  const onConvertir = await montar(DETECTOR);
  await act(async () => boton("Convertir en regla")!.click());
  expect(onConvertir).toHaveBeenCalledWith(REGLA);
});

test("sin sugerencias lo dice con la cifra de la base; sin recopilador avisa una vez", async () => {
  await montar({ ...DETECTOR, sugerencias: [] });
  expect(host.textContent).toContain("Sin sugerencias en los 300 casos de la base.");
  act(() => root.unmount());
  root = createRoot(host);
  const sinRol = {
    ...DETECTOR,
    recopilador: null,
    avisos: [{ codigo: "sin_recopilador", texto: "No hay un recopilador declarado: las sugerencias no dicen si sus casos se concentran en una persona de campo." }],
    sugerencias: [{ ...DETECTOR.sugerencias[0], concentracion: { ...DETECTOR.sugerencias[0].concentracion!, estado: "sin_rol" as const, texto: "Sin un recopilador declarado." } }],
  };
  await montar(sinRol);
  expect(host.textContent?.match(/No hay un recopilador declarado/g)).toHaveLength(1);
  expect(host.textContent).not.toContain("Sin un recopilador declarado.");
});

test("modelo: la concentración solo se muestra si dice algo; las columnas siguen a las preguntas", () => {
  const s = DETECTOR.sugerencias[0];
  expect(lineaDeConcentracion(s)).toEqual({ texto: s.concentracion!.texto, destacada: true });
  expect(lineaDeConcentracion({ ...s, concentracion: { ...s.concentracion!, estado: "pocos_casos" } })).toBeNull();
  expect(columnasDeCasos(s, "enc").map((c) => c.encabezado)).toEqual(["Fila", "Recopilador", "frec", "serv"]);
  expect(columnasDeCasos(s, null).map((c) => c.encabezado)).toEqual(["Fila", "frec", "serv"]);
  const abierto = searchConCasosDeSugerencia("?pestana=reglas&foco=RC_1", "SC_02");
  expect(new URLSearchParams(abierto).get("foco")).toBe("SC_02");
  expect(new URLSearchParams(abierto).get("panel")).toBe("sugerencia");
});
