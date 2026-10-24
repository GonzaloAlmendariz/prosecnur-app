import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { OrigenDeLaMuestra } from "./OrigenDeLaMuestra";

const SIN_BLOQUE = { sheets: [{ id: "monitoreo_telefonico", blocks: [] }] } as unknown as MonitoreoAcreditacionReports;
const MARCA = "¿Se reemplaza con el Backup?";

function estado(variables: Array<{ name: string; n_unique: number; values?: string[] }>) {
  return {
    variables,
    config: { monitoreo_profile: {} },
  } as unknown as MonitoreoState;
}

describe("Origen de la muestra con un corte anterior al bloque (RMS)", () => {
  it("el select muestra «Origen» y la marca, sugeridos desde las columnas de la base", () => {
    const html = renderToStaticMarkup(
      <OrigenDeLaMuestra
        reports={SIN_BLOQUE}
        state={estado([
          { name: "Código proGres", n_unique: 800 },
          { name: "Origen", n_unique: 2, values: ["Backup", "Muestra"] },
          { name: MARCA, n_unique: 2, values: ["No"] },
        ])}
      />,
    );
    // El <option> elegido es el de la columna sugerida.
    expect(html).toMatch(/<option value="Origen" selected="">Origen<\/option>/);
    expect(html).toContain(`<option value="${MARCA}" selected="">`);
    expect(html).toContain("Sugerido por el nombre");
    // Los valores de la base, sin casos todavía.
    expect(html).toContain(">Muestra<");
    expect(html).toContain(">Backup<");
    // El vacío se dice una sola vez.
    expect(html.match(/se cuentan al confirmar y actualizar/g)).toHaveLength(1);
  });

  it("sin columnas que sugerir no hay insignia y el vacío se dice una vez", () => {
    const html = renderToStaticMarkup(<OrigenDeLaMuestra reports={SIN_BLOQUE} state={estado([{ name: "Periodo", n_unique: 4 }])} />);
    expect(html).not.toContain("Sugerido por el nombre");
    expect(html.match(/Ninguna columna de la base/g)).toHaveLength(1);
  });
});
