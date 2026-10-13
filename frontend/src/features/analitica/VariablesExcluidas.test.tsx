// Cuerpo del panel «Variables excluidas» (U5). Sin DOM: el markup estático con
// la lista del store, que es lo que el usuario lee al abrir el panel.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { VariablesExcluidas } from "./VariablesExcluidas";
import { motivosDesdeOrigen } from "./variablesExcluidasModel";

const VARIABLES = [
  { name: "p1", label: "Primera pregunta" },
  { name: "p2", label: "Segunda pregunta" },
];


describe("VariablesExcluidas", () => {
  it("muestra la excluida ausente de los datos con su motivo declarado y un botón con nombre", () => {
    const motivos = motivosDesdeOrigen([{
      base: "b",
      estado: "vigente",
      bloque: {
        script: "", version: "", n_recibidas: null, n_recibidas_deducida: false, n_entregadas: null,
        n_excluidas: 0, data_file_id: "", declarado_at: "", enabled: true,
        variables_retiradas: [{ variable: "inicio", tipo: "start", motivo: "metadato" }],
        n_variables_retiradas: 1,
      },
      resumen: null,
      variables_faltantes: [],
      avisos: [],
      variables_excluidas_agregadas: [],
    }]);
    const html = renderToStaticMarkup(<VariablesExcluidas variables={VARIABLES} excluidas={["p2", "inicio"]} onCambiar={vi.fn()} motivos={motivos} />);
    expect(html).toContain("2 excluidas");
    expect(html).toContain("1 incluida");
    expect(html).toContain("Metadato del formulario");
    expect(html).toContain("No está en los datos");
    expect(html).toContain('aria-label="Volver a incluir inicio"');
    expect(html).toContain('aria-label="Excluir p1"');
  });

  it("sin excluidas contiene su vacío y no inventa motivos", () => {
    const html = renderToStaticMarkup(<VariablesExcluidas variables={VARIABLES} excluidas={[]} onCambiar={vi.fn()} />);
    expect(html).toContain("Ninguna variable excluida: todas salen en los entregables.");
    expect(html).not.toContain("pulso-excluidas-marca");
  });
});
