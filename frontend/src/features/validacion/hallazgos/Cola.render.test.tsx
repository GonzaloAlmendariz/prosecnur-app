// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { Cola } from "./Cola";
import type { ElementoDeCola } from "./modeloHallazgos";

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

function elemento(id: string, clase: ElementoDeCola["clase"]): ElementoDeCola {
  return {
    id, nombre: id, narrativa: {} as ElementoDeCola["narrativa"], n: 40, unidad: "casos", clase,
    origen: "Regla propia", pendiente: true, decision: null, conBorrador: false, nFicha: 0, decididoHoy: false,
    tratamiento: null, noAplicable: false, nCasosNuevos: 0,
  };
}

describe("filtros de clase de la cola", () => {
  test("cuentan reglas, no casos, y lo dicen", () => {
    const elementos = [elemento("a", "inconsistencia"), elemento("b", "inconsistencia"), elemento("c", "caso_a_revisar")];
    act(() => root.render(
      <Cola elementos={elementos} elegido={null} pestana="por-decidir" onPestana={() => undefined} clase={null}
        onClase={() => undefined} onElegir={() => undefined} sinCasos={null} onVerReglas={() => undefined} ocupada={false} />,
    ));
    const filtros = [...host.querySelectorAll("button.pulso-hz-clase-filtro")].map((b) => b.textContent);
    expect(filtros).toEqual(["2 reglas con inconsistencias", "1 regla con casos a revisar"]);
  });

  test("un hallazgo con casos para la ficha física lo dice con la concordancia", () => {
    const elementos = [{ ...elemento("a", "inconsistencia"), nFicha: 1 }, { ...elemento("b", "inconsistencia"), nFicha: 12 }];
    act(() => root.render(
      <Cola elementos={elementos} elegido={null} pestana="por-decidir" onPestana={() => undefined} clase={null}
        onClase={() => undefined} onElegir={() => undefined} sinCasos={null} onVerReglas={() => undefined} ocupada={false} />,
    ));
    const notas = [...host.querySelectorAll(".pulso-hz-fila-nota")].map((n) => n.textContent);
    expect(notas).toEqual(["1 caso a la ficha física", "12 casos a la ficha física"]);
  });
});
