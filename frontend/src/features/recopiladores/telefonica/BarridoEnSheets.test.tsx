import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { normalizarBarridoEnSheets, normalizarConfigTelefonica, normalizarEstadoDelBarrido } from "../../../api/materialTelefonica";
import { BarridoEnSheets } from "./BarridoEnSheets";
import { DocumentoDelBarrido } from "./DocumentoDelBarrido";

describe("el barrido en el Sheets del estudio", () => {
  it("lee lo que le pasó a cada pestaña como lo serializa R", () => {
    const r = normalizarBarridoEnSheets({
      url: ["https://docs.google.com/spreadsheets/d/x/edit"],
      hojas: [{ hoja: "Barrido", accion: "respetada", filas: 0 }, { hoja: "Listas", accion: "sembrada", filas: [14] }, { hoja: "" }],
      columnas: ["Cod pulso", "Código"], sin_sensibles: "Estatus Legal",
    });
    expect(r.hojas).toEqual([{ hoja: "Barrido", accion: "respetada", filas: 0 }, { hoja: "Listas", accion: "sembrada", filas: 14 }]);
    expect(r.sinSensibles).toEqual(["Estatus Legal"]);
    expect(() => normalizarBarridoEnSheets({ hojas: [] })).toThrow();
  });

  it("sin pestaña construida ofrece construir y dice que las sensibles no se copian", () => {
    const html = renderToStaticMarkup(<BarridoEnSheets campaignId="telefonica.principal" sensibles={["Estatus Legal"]} />);
    for (const t of ["Construir en el Sheets", "sólo para el barrido", "Estatus Legal"]) expect(html).toContain(t);
  });

  it("con pestaña construida, el control pasa a crear sólo las que falten", () => {
    const html = renderToStaticMarkup(<BarridoEnSheets campaignId="telefonica.principal" sensibles={[]} construido />);
    expect(html).toContain("Crear las pestañas que falten");
  });
});

describe("el estado del barrido que manda la config (revamp v5)", () => {
  it("sin url no cuenta como construido aunque diga true", () => {
    expect(normalizarEstadoDelBarrido({ construido: [true] })).toEqual({ construido: false, url: null, pestana: null, actualizado_en: null, conectado_en_monitoreo: false });
  });

  it("lee el documento y la conexión como los serializa R", () => {
    const e = normalizarEstadoDelBarrido({ construido: [true], url: ["https://x"], pestana: ["Barrido"], actualizado_en: ["2026-11-02T15:00:00Z"], conectado_en_monitoreo: [true] });
    expect(e).toEqual({ construido: true, url: "https://x", pestana: "Barrido", actualizado_en: "2026-11-02T15:00:00Z", conectado_en_monitoreo: true });
  });

  it("los pasos dicen qué está hecho y el de pegar casos no finge estado", () => {
    const config = normalizarConfigTelefonica({
      campaign_id: "telefonica.principal", llave: "Código", muestra: 1240, backup: 300, telefonos: 2,
      barrido: { construido: true, url: "https://x", pestana: "Barrido", conectado_en_monitoreo: false },
    });
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DocumentoDelBarrido config={config} campaignId="telefonica.principal" hrefCasos="/c" hrefFuentes="/f" onCambio={() => undefined} />
      </MemoryRouter>,
    );
    expect(html).toContain("Abrir el Sheets");
    expect(html).toContain("1,240 casos y 300 de backup declarados");
    expect(html).toContain("En el Sheets");
    expect(html).toContain("Ir a Insumos › Fuentes");
  });
});
