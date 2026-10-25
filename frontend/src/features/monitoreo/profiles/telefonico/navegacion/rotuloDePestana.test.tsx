/**
 * §2a-bis: el rótulo «SECCIÓN · GRUPO / Pestaña» va dentro de la pestaña (en
 * su barra o en su primera tarjeta) y no en una fila propia.
 */
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RondasDeSupervision } from "../control/RondasDeSupervision";
import { rotuloEnLaPestana, pestanaConLienzo } from "./barraTelefonica";
import { RotuloDePestana, RotuloDePestanaProvider } from "./RotuloDePestana";

const VALOR = { antetitulo: "Control · Casos", titulo: "Supervisión", chips: ["24 casos"] };

function conRotulo(nodo: ReactNode) {
  return renderToStaticMarkup(<RotuloDePestanaProvider valor={VALOR}>{nodo}</RotuloDePestanaProvider>).replace(/<!-- -->/g, "");
}

describe("rótulo de la pestaña", () => {
  it("pinta antetítulo, nombre y chips, sin ícono; sin proveedor no pinta nada", () => {
    const html = conRotulo(<RotuloDePestana />);
    expect(html).toContain("Control · Casos");
    expect(html).toContain("<h2>Supervisión</h2>");
    expect(html).toContain("24 casos");
    expect(html).not.toContain("<svg");
    expect(renderToStaticMarkup(<RotuloDePestana />)).toBe("");
  });

  it("todas las pestañas del modo lo llevan dentro, salvo las sub-vistas que montan la vista anterior", () => {
    const pestanas = [
      ["insumos", "fuentes"], ["insumos", "llave"], ["insumos", "estados"], ["modelo", "cuotas"],
      ["control", "barrido"], ["control", "insistencia"], ["control", "equipo"], ["control", "discrepancias"],
      ["control", "respuestas"], ["control", "supervision"], ["control", "avisos"],
      ["avance", "cuotas"], ["avance", "ritmo"], ["avance", "entregas"],
    ];
    for (const [seccion, pestana] of pestanas) {
      expect(rotuloEnLaPestana({ seccion, pestana, panel: null }), `${seccion}/${pestana}`).toBe(true);
      // Sin tarjeta envolvente: sus tarjetas van sobre el lienzo.
      expect(pestanaConLienzo({ seccion, pestana, panel: null }), `${seccion}/${pestana}`).toBe(true);
    }
    expect(rotuloEnLaPestana({ seccion: "control", pestana: "respuestas", panel: "salvedades" })).toBe(false);
    expect(rotuloEnLaPestana({ seccion: "modelo", pestana: "cuotas", panel: "calendario" })).toBe(false);
    // «Estados por operador» es de la propia pestaña Equipo: conserva el rótulo.
    expect(rotuloEnLaPestana({ seccion: "control", pestana: "equipo", panel: "estados" })).toBe(true);
  });

  it("en Supervisión encabeza la tarjeta de rondas, antes de su título y con las acciones", () => {
    const html = conRotulo(
      <RondasDeSupervision rondas={[]} actual={null} proxima={1} nuevas={null}
        onElegir={() => {}} onNueva={() => {}} onPublicar={() => {}} onGuardada={() => {}} />,
    );
    expect(html.indexOf("<h2>Supervisión</h2>")).toBeGreaterThan(-1);
    expect(html.indexOf("<h2>Supervisión</h2>")).toBeLessThan(html.indexOf("<b>Rondas</b>"));
    expect(html).toContain("Nueva ronda");
  });
});
