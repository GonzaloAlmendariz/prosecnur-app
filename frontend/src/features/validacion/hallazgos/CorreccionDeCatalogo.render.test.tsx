// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { HallazgoDelCaso } from "../../../api/validacionAuditoria";
import { CorreccionDeCatalogo } from "./CorreccionDeCatalogo";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function hallazgo(candidatos: NonNullable<HallazgoDelCaso["esperado"]>["candidatos"]): HallazgoDelCaso {
  return {
    id_regla: "RC_007",
    roles: { departamento: "P2_dep", provincia: "P2_prov", distrito: "P2_dist", ubigeo: "P2_ubigeo" },
    esperado: { anomalia_tipo: null, subtipo: "combinacion_catalogo", sujeto: null, hecho: null, choque: null, accion: null, texto: null, candidatos, a_investigar: !candidatos?.length },
  } as unknown as HallazgoDelCaso;
}

const comas = {
  rol: "distrito", valor: "Comas", causa: "por el ubigeo 150110",
  entidad: { departamento: "Lima", provincia: "Lima", distrito: "Comas", ubigeo: "150110" },
};

const boton = (texto: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === texto);

describe("corrección de un caso de catálogo en la ficha", () => {
  test("muestra la propuesta con su causa y no guarda nada hasta confirmar", async () => {
    const guardar = vi.fn().mockResolvedValue({});
    act(() => root.render(<CorreccionDeCatalogo hallazgo={hallazgo([comas])} idCaso="E-17" baseNombre="base" guardarDecision={guardar} />));
    expect(host.textContent).toContain("Propuesta: Distrito Comas (por el ubigeo 150110)");
    act(() => boton("Usar propuesta")?.click());
    expect(host.querySelector("[aria-label='Confirmar la corrección']")?.textContent).toContain("Distrito");
    expect(guardar).not.toHaveBeenCalled();
    await act(async () => { boton("Confirmar corrección")?.click(); });
    expect(guardar).toHaveBeenCalledTimes(4);
    expect(guardar.mock.calls.map((c) => [c[0].target_variable, c[0].action_params.value, c[0].target_case_ids, c[0].source_id])).toEqual([
      ["P2_dep", "Lima", ["E-17"], "RC_007"], ["P2_prov", "Lima", ["E-17"], "RC_007"],
      ["P2_dist", "Comas", ["E-17"], "RC_007"], ["P2_ubigeo", "150110", ["E-17"], "RC_007"],
    ]);
    expect(host.querySelector("[role='status']")?.textContent).toBe("Corrección guardada en 4 columnas.");
  });

  test("cancelar descarta la corrección", () => {
    const guardar = vi.fn();
    act(() => root.render(<CorreccionDeCatalogo hallazgo={hallazgo([comas])} idCaso="E-17" baseNombre="base" guardarDecision={guardar} />));
    act(() => boton("Usar propuesta")?.click());
    act(() => boton("Cancelar")?.click());
    expect(host.querySelector("[aria-label='Confirmar la corrección']")).toBeNull();
    expect(guardar).not.toHaveBeenCalled();
  });

  test("sin candidato dice A investigar y deja el selector", () => {
    act(() => root.render(<CorreccionDeCatalogo hallazgo={hallazgo([])} idCaso="E-17" baseNombre="base" />));
    expect(host.textContent).toContain("A investigar");
    expect(host.querySelector("input")).not.toBeNull();
  });

  // Ítem 49 (QA30b): la confirmación mostraba solo valores nuevos con códigos de columna y, ya guardada,
  // la ficha seguía con la propuesta.
  test("la confirmación dice el lugar de cada valor y el que tenía antes", () => {
    act(() => root.render(<CorreccionDeCatalogo hallazgo={hallazgo([comas])} idCaso="E-17" baseNombre="base" valorActual={(c) => (c === "P2_dist" ? "RINAC" : null)} />));
    act(() => boton("Usar propuesta")?.click());
    const texto = host.querySelector("[aria-label='Confirmar la corrección']")?.textContent ?? "";
    expect(texto).toContain("Distrito");
    expect(texto).toContain("de RINAC a Comas");
    expect(texto).not.toContain("P2_dist");
  });

  test("con la corrección ya guardada la ficha la dice y no vuelve a proponer", () => {
    const guardadas = [{ columna: "P2_dist", valor: "Comas" }, { columna: "P2_ubigeo", valor: "150110" }];
    act(() => root.render(<CorreccionDeCatalogo hallazgo={hallazgo([comas])} idCaso="E-17" baseNombre="base" guardadas={guardadas} />));
    const bloque = host.querySelector("[aria-label='Corrección guardada']");
    expect(bloque?.textContent).toContain("Distrito");
    expect(bloque?.textContent).toContain("Comas");
    expect(bloque?.textContent).toContain("Ubigeo");
    expect(bloque?.textContent).toContain("Se aplica al cerrar la base.");
    expect(host.textContent).not.toContain("Propuesta:");
    expect(host.querySelector("input")).not.toBeNull();
  });
});
