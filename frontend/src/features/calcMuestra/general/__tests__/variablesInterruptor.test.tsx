/**
 * Revamp 2026-09-27: «Disponible» era una casilla que heredaba el estilo de los
 * campos de texto (ancho completo, 32 px, radio) y se pintaba como píldora.
 * Es el interruptor de la casa, con su nombre accesible y rótulo al lado.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalcMuestraWorkspace } from "../../../../api/calcMuestra";
import { VariablesControl } from "../VariablesControl";

const workspace = {
  variables_control: [
    { id: "v1", label: "Territorio", tipo: "estrato", disponible: true },
    { id: "v2", label: "Servicio", tipo: "cuota", disponible: false },
  ],
} as unknown as CalcMuestraWorkspace;

describe("VariablesControl", () => {
  it("usa el interruptor de la casa, no una casilla", () => {
    const html = renderToStaticMarkup(<VariablesControl workspace={workspace} onWorkspace={() => undefined} />);
    expect(html).not.toContain('type="checkbox"');
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"[^>]*aria-label="Territorio disponible en el marco"/);
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"[^>]*aria-label="Servicio disponible en el marco"/);
    expect(html).toContain("En el marco");
  });
});
