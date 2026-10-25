// U9 del QA de CCSS (2026-10-24): el panel y el menú «Exportar» tienen que decir lo mismo sobre los colores pendientes.
// Regla de producto P8 (Gonzalo 2026-10-11): con gráficos que pintan cada respuesta con su color y a los que les falta
// alguno, no se exporta; completarlos es un clic. Aunque el motor sabría exportar con los de por defecto, la regla es
// de producto: el panel los pone en «Bloquean la exportación» con «Completar todos los colores», y el menú deja
// PowerPoint y Word deshabilitados con el mismo motivo y el mismo botón.
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ColoresPendientesAviso } from "../estilo/ColoresPendientesAviso";
import type { ColorPendiente } from "../estilo/coloresPendientes";
import { MOTIVO_COLORES_PENDIENTES, puedeGenerarInforme } from "../exportarInformeRegla";
import { PanelAvisos } from "./PanelAvisos";

const pintar = (laminas: number) => renderToStaticMarkup(
  <PanelAvisos
    panel={{ abierto: true, abrir: () => {}, cerrar: () => {}, alternar: () => {}, props: { "data-pulso-panel": "avisos" } }}
    grupos={{ bloquean: [], revisar: [], motor: [], plan: [], equivalencias: [] }}
    estructura={{ nodos: [], laminas: [] }}
    onIr={() => {}}
    coloresPendientes={{ laminas, completar: () => {} }}
  />,
);
const seccion = (html: string, nombre: string) => {
  const i = html.lastIndexOf("<section", html.indexOf(`aria-label="${nombre}"`));
  return html.slice(i, html.indexOf("</section>", i));
};

describe("U9 · P8: los colores pendientes bloquean la exportación, y todos lo dicen igual", () => {
  it("el panel los pone en «Bloquean la exportación» con el arreglo en un clic", () => {
    const html = pintar(26);
    const bloquean = seccion(html, "Bloquean la exportación");
    expect(bloquean).toContain("is-bloquea");
    expect(bloquean).toMatch(/Bloquean la exportación <span>1<\/span>/);
    expect(bloquean).toContain("Faltan colores en 26 láminas");
    expect(bloquean).toContain(MOTIVO_COLORES_PENDIENTES);
    expect(bloquean).toContain("Completar todos los colores");
    expect(seccion(html, "Conviene revisar")).not.toContain("Faltan colores");
  });

  it("sin colores pendientes ni errores, nada bloquea y el contador no va en rojo", () => {
    const bloquean = seccion(pintar(0), "Bloquean la exportación");
    expect(bloquean).toContain("Nada bloquea la exportación.");
    expect(bloquean).not.toContain("is-bloquea");
  });

  it("el menú no deja generar con colores pendientes y muestra el mismo motivo y el mismo botón", () => {
    expect(puedeGenerarInforme({ planSinErrores: true, coloresPendientes: 26 })).toBe(false);
    expect(puedeGenerarInforme({ planSinErrores: true, coloresPendientes: 0 })).toBe(true);
    expect(puedeGenerarInforme({ planSinErrores: false, coloresPendientes: 0 })).toBe(false);
    const fila = { id: "grupo:1", nombre: "Sí / No", clave: null, grupos: [], opciones: ["Sí", "No"], colores: {}, preguntas: [], bases: [], faltan: 2 };
    const pendientes: ColorPendiente[] = [{ slideId: "s1", numero: 1, slot: "grafico", pregunta: "Beca", fila }];
    const html = renderToStaticMarkup(<MemoryRouter><ColoresPendientesAviso pendientes={pendientes} onCompletar={() => {}} /></MemoryRouter>);
    expect(html).toContain(MOTIVO_COLORES_PENDIENTES.slice(1));   // en el menú abre la frase, con mayúscula
    expect(html).toContain("Completar todos los colores");
    expect(html).toContain("role=\"status\"");
  });
});
