import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { XlsformEditorWorkbook } from "../types";
import { getCell } from "../parsing/sheetUtils";
import { aplicarRegistro, aplicarUbicacionInicio, leerCalidadCampo, nivelDeParametros, PARAMETROS_NIVEL } from "./calidadCampoModel";
import { CalidadCampo } from "./CalidadCampo";

const libro = (): XlsformEditorWorkbook => ({
  survey: { columns: ["type", "name", "label"], rows: [["start", "start", ""], ["end", "end", ""], ["text", "p1", "Nombre"]] },
  choices: { columns: ["list_name", "name", "label"], rows: [] },
  settings: { columns: ["form_title"], rows: [["X"]] },
});
const tipos = (wb: XlsformEditorWorkbook) => wb.survey.rows.map((_, i) => getCell(wb.survey, i, "type"));

describe("calidad de campo", () => {
  it("inserta las filas tras los automáticos del principio y las quita sin tocar lo demás", () => {
    const wb = libro();
    aplicarUbicacionInicio(wb, true);
    aplicarRegistro(wb, "cambios");
    expect(tipos(wb)).toEqual(["start", "end", "start-geopoint", "audit", "text"]);
    expect(getCell(wb.survey, 3, "name")).toBe("audit");
    expect(getCell(wb.survey, 3, "parameters")).toBe("track-changes=true");
    aplicarUbicacionInicio(wb, true);
    expect(tipos(wb).filter((t) => t === "start-geopoint")).toHaveLength(1);
    aplicarUbicacionInicio(wb, false);
    aplicarRegistro(wb, null);
    expect(tipos(wb)).toEqual(["start", "end", "text"]);
  });

  it("cambiar de nivel reescribe los parámetros de la fila existente", () => {
    const wb = libro();
    aplicarRegistro(wb, "tiempos");
    aplicarRegistro(wb, "ubicacion");
    expect(leerCalidadCampo(wb).registro).toBe("ubicacion");
    expect(tipos(wb).filter((t) => t === "audit")).toHaveLength(1);
  });

  it("reconoce el nivel sin importar el orden y marca como personalizado lo que no coincide", () => {
    expect(nivelDeParametros("location-max-age=120 track-changes=true location-priority=balanced location-min-interval=60")).toBe("ubicacion");
    expect(nivelDeParametros(PARAMETROS_NIVEL.tiempos)).toBe("tiempos");
    expect(nivelDeParametros("identify-user=true")).toBe("personalizado");
  });

  it("el panel muestra los niveles sólo con el registro encendido y avisa del consentimiento si hay ubicación", () => {
    const html = (wb: XlsformEditorWorkbook) => renderToStaticMarkup(<CalidadCampo workbook={wb} onEditar={() => {}} />);
    const apagado = html(libro());
    expect(apagado).not.toContain("radiogroup");
    expect(apagado).not.toContain("consentimiento");
    const wb = libro();
    aplicarRegistro(wb, "cambios");
    const cambios = html(wb);
    expect(cambios).toMatch(/aria-checked="true"[^>]*><strong>Y cambios/);
    expect(cambios).not.toContain("consentimiento");
    aplicarUbicacionInicio(wb, true);
    const conGps = html(wb);
    expect(conGps).toContain("ubicacion_inicio");
    expect(conGps).toContain("consentimiento");
  });
});
