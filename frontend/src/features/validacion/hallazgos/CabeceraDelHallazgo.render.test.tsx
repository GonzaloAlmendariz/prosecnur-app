// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { NarrativaDeRegla } from "../../../api/validacionAuditoria";
import { CabeceraDelHallazgo } from "./CabeceraDelHallazgo";

const narrativa = (detalle: string | null): NarrativaDeRegla => ({
  nombre: "Edad fuera de rango", frase: [{ tipo: "texto", texto: "Se marca cuando la edad está fuera de 16 a 25" }],
  frase_completa: true, clase: "caso_a_revisar", familia: "rango_num", familia_nombre: "Valor fuera de rango",
  origen_regla: "propia", severidad: "advertencia", en_catalogo: true, id_catalogo: "RC_001", detalle,
});

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

function pintar(detalle: string | null) {
  act(() => {
    root.render(
      <CabeceraDelHallazgo narrativa={narrativa(detalle)} nombre="Edad fuera de rango" origen="Propia" n={3}
        unidad="casos" cifra={null} onVerRegla={() => undefined} />,
    );
  });
}

describe("CabeceraDelHallazgo", () => {
  test("muestra el detalle que el equipo escribió en la regla", () => {
    pintar("Revisar con la ficha física");
    expect(host.querySelector(".pulso-hz-detalle")?.textContent).toBe("Detalle de la regla: Revisar con la ficha física");
  });

  test("sin detalle no dibuja la línea", () => {
    pintar(null);
    expect(host.querySelector(".pulso-hz-detalle")).toBeNull();
  });
});
