/**
 * Gonzalo (2026-10-02): ver qué trae otro tipo de estudio sin perder el
 * actual; elegirlo sí es definitivo y lo advierte diciendo qué se pierde.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { defaultComponente } from "../sharedCore";
import { VistaPreviaTipo } from "../VistaPreviaTipo";
import { cambiarReinicia, loQueSePierde, seccionesDelTipo } from "../modeloVistaPreviaTipo";

describe("vista previa de otro tipo de estudio", () => {
  it("las secciones y pestañas salen del manifiesto, en el orden del rail", () => {
    const general = seccionesDelTipo("marco_disponible");
    expect(general.map((s) => s.label)).toEqual(["Marco", "Método", "Selección", "Resultados"]);
    expect(general[0].pasos.map((p) => p.label)).toEqual(["Forma del marco", "Archivo del marco", "Ficha del estudio"]);
    expect(general[0].pasos[0].detalle).toBe("¿qué elementos contiene el marco muestral?");
    const aulas = seccionesDelTipo("opinion_universitaria");
    expect(aulas.map((s) => s.label)).toEqual(["Datos", "Marco", "Cálculo", "Selección", "Entrega"]);
    expect(seccionesDelTipo("acreditacion").map((s) => s.label)).toContain("Actores");
  });

  it("ir a Hojas de ruta no reinicia; los demás tipos sí", () => {
    expect(cambiarReinicia("territorial_handoff")).toBe(false);
    expect(cambiarReinicia("acreditacion")).toBe(true);
  });

  it("lo que se pierde se dice con lo que el estudio tiene", () => {
    const con = { ...defaultComponente({ id: "a", actor: "Hogares" }) };
    con.marco = { ...con.marco, marco_validado: 2000 };
    con.resultado = { n_objetivo: 323 } as unknown as typeof con.resultado;
    const sin = defaultComponente({ id: "b", actor: "Docentes" });
    const items = loQueSePierde({ titulo: "Encuesta Puno", componentes: [con, sin], tieneEstadoAulas: false });
    expect(items).toEqual([
      "La ficha del estudio «Encuesta Puno»",
      "2 grupos con su marco, técnica y parámetros (1 con N declarado)",
      "El tamaño de muestra calculado",
    ]);
    expect(loQueSePierde({ titulo: "", componentes: [], tieneEstadoAulas: true }))
      .toEqual(["Las bases cargadas, el marco de cursos-horario y la selección de aulas"]);
  });

  it("mirar no borra: el paso de mirar no tiene botón que borre; el de confirmar dice qué se pierde", () => {
    const props = {
      destino: "acreditacion" as const,
      destinoTitulo: "Metas por grupo de informantes",
      destinoCopy: "Para procesos que piden un mínimo por grupo.",
      actualTitulo: "Muestra general",
      perdidas: ["La ficha del estudio «Encuesta Puno»"],
      onVolver: () => {},
      onConfirmar: () => {},
    };
    const mirar = renderToStaticMarkup(<VistaPreviaTipo {...props} />);
    expect(mirar).toContain("sigue intacto");
    expect(mirar).toContain("Actores");
    expect(mirar).toContain("Volver a Muestra general");
    expect(mirar).toContain("Cambiar a Metas por grupo de informantes…");
    expect(mirar).not.toContain("Borrar y empezar");
    expect(mirar).not.toContain("El cambio es definitivo");

    const confirmar = renderToStaticMarkup(<VistaPreviaTipo {...props} confirmandoInicial />);
    expect(confirmar).toContain("El cambio es definitivo");
    expect(confirmar).toContain("«Encuesta Puno»");
    expect(confirmar).toContain("No, seguir mirando");
    expect(confirmar).toContain("Borrar y empezar con Metas por grupo de informantes");
  });

  it("territorial navega sin aviso de borrado", () => {
    const html = renderToStaticMarkup(
      <VistaPreviaTipo destino="territorial_handoff" destinoTitulo="Muestreo de áreas y viviendas" destinoCopy="" actualTitulo="Muestra general" perdidas={[]} onVolver={() => {}} onConfirmar={() => {}} />,
    );
    expect(html).toContain("Ir a Hojas de ruta");
    expect(html).not.toContain("Cambiar a");
  });
});
