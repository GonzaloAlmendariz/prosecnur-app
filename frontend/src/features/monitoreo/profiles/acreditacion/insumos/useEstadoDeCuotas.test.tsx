// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { MonitoreoCuotasEstado } from "../../../../../api/monitoreoCuotas";

vi.mock("../../../../../api/monitoreoCuotas", () => ({ getMonitoreoCuotas: () => new Promise(() => undefined) }));

import { recordarCuotas } from "./cuotasRecientes";
import { useEstadoDeCuotas } from "./useEstadoDeCuotas";

// Lo que pinta el primer render de una vista de cuotas: con estado, la marca
// de lectura sale lista; sin él, «leyendo». renderToStaticMarkup no corre
// efectos, así que mide justo el estado con que arranca el montaje.
function Sonda() {
  const { estado } = useEstadoDeCuotas();
  return <span data-audit-ready={estado ? "true" : "false"} />;
}

const estado = { preparando: false, cuotas: [], publicos: [] } as unknown as MonitoreoCuotasEstado;

describe("useEstadoDeCuotas · primer render", () => {
  test("arranca con lo último leído del mismo proyecto", () => {
    recordarCuotas(estado);
    expect(renderToStaticMarkup(<Sonda />)).toContain('data-audit-ready="true"');
  });

  test.each(["pulso:session-changed", "pulso:project-closed"])("tras %s arranca leyendo", (evento) => {
    recordarCuotas(estado);
    window.dispatchEvent(new Event(evento));
    expect(renderToStaticMarkup(<Sonda />)).toContain('data-audit-ready="false"');
  });
});
