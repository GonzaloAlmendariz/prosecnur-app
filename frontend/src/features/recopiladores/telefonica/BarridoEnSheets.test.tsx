import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizarBarridoEnSheets } from "../../../api/materialTelefonica";
import { BarridoEnSheets } from "./BarridoEnSheets";

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

  it("dice qué crea, que no pisa lo que existe y que las sensibles no se copian", () => {
    const html = renderToStaticMarkup(<BarridoEnSheets campaignId="telefonica.principal" sensibles={["Estatus Legal"]} />);
    for (const t of ["En el Sheets del estudio", "«Barrido», «Listas» y «Léeme»", "Si una pestaña ya existe", "Estatus Legal", "Construir en el Sheets"]) {
      expect(html).toContain(t);
    }
  });
});
