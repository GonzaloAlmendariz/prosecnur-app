// A10 W-B: lo que el analista ve en Inspector › Contenido para la ficha técnica (filas), el ícono de población/objetivo
// (C38), el título por defecto (C35) y el candado de los focos del índice (decisión 32). Markup estático, sin DOM.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Slide } from "../../../../api/graficos";
import { InspectorLamina } from "../InspectorLamina";
import { construirEstructura } from "../modeloEstructura";
import { SelectorIconoSubido } from "./SelectorIconoSubido";

vi.mock("../../useGraficosRegistry", () => ({
  useGraficosRegistry: () => ({
    slidesById: {
      p_slide_tabla_tecnica: { args: [
        { name: "titulo", label: "Título de la tabla", tipo_input: "string", grupo: "textos" },
        { name: "filas", label: "Filas", tipo_input: "technical_rows", grupo: "datos" },
      ] },
      p_slide_objetivo_icono: { args: [
        { name: "icono", label: "Ícono", tipo_input: "icono", grupo: "textos" },
        { name: "titulo", label: "Título (banda lateral)", tipo_input: "string", grupo: "textos" },
      ] },
      p_slide_1_grafico: { args: [{ name: "titulo", label: "Título del slide", tipo_input: "string", grupo: "textos" }] },
      p_slide_indice: { args: [
        { name: "secciones", label: "Secciones principales", tipo_input: "textarea", grupo: "textos" },
        { name: "redibujar_focos", label: "Redibujar focos desde cero", tipo_input: "bool", grupo: "espacio", default: false },
        { name: "mostrar_iconos_focos", label: "Mostrar íconos en focos", tipo_input: "bool", grupo: "espacio", default: true },
        { name: "iconos_focos_fill", label: "Colores de focos", tipo_input: "colores_list", grupo: "valores" },
        { name: "iconos_focos_objeto_unico", label: "Mover círculo e ícono juntos", tipo_input: "bool", grupo: "espacio", default: true },
      ] },
    },
    graficadoresById: {},
  }),
}));

vi.mock("../../useVariables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../useVariables")>()),
  useVariables: () => ({
    sources: [], multi: false, loading: false, error: "",
    variables: [{ name: "q1", label: "Confianza en la institución", source: "base" }],
  }),
}));

vi.mock("../../../../api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../api/core")>()),
  downloadUrl: (fileId: string) => `/api/files/${fileId}`,
}));

vi.mock("../../indice/useIconosRecetario", () => ({
  useIconosRecetario: () => ({ imagenes: new Map<string, string>(), nombres: null, cargando: false, error: null, reintentar: () => undefined }),
}));

function pintar(slide: Slide): string {
  const lamina = construirEstructura([slide]).laminas[0];
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/graficos"] },
    createElement(InspectorLamina, {
      slide, lamina, ranura: null, onRanura: () => undefined, visor: null, onCerrar: () => undefined,
      onCambiarLamina: () => undefined, onCambiarGrafico: () => undefined,
    })));
}

describe("Inspector › Contenido especial", () => {
  it("C38: la ficha técnica edita sus filas en vez de mandarlas a «todavía no está en Láminas»", () => {
    const html = pintar({ id: "t", tipo: "p_slide_tabla_tecnica", payload: { titulo: "", filas: "Periodo: marzo\nMuestra | 400" } });
    expect(html).toContain('aria-label="Criterio de la fila 1"');
    expect(html).toContain('value="Muestra"');
    expect(html).toContain('aria-label="Detalle de la fila 2"');
    expect(html).toContain("Añadir fila");
    expect(html).toContain("se reescribe sólo cuando lo edites");
    expect(html).not.toContain("todavía no está en Láminas");
  });

  it("C38: la ficha sin filas contiene su vacío", () => {
    const html = pintar({ id: "t", tipo: "p_slide_tabla_tecnica", payload: { filas: [] } });
    expect(html).toContain("La ficha no tiene filas");
    expect(html).not.toContain("Criterio de la fila 1");
  });

  it("C38: el ícono de objetivo se elige entre los subidos, con «Sin ícono»", () => {
    // El store en render estático sirve su estado inicial: el selector se pinta con los íconos como prop.
    const html = renderToStaticMarkup(createElement(SelectorIconoSubido, {
      arg: { name: "icono", label: "Ícono", tipo_input: "icono", grupo: "textos" },
      valor: "i1",
      iconos: [{ id: "i1", nombre: "Diana", file_id: "f1" }, { id: "i2", nombre: "Casa", file_id: "f2" }],
      onCambio: () => undefined,
    }));
    expect(html).toContain("<legend");
    expect(html).toContain("Sin ícono");
    expect(html).toMatch(/aria-label="Diana" checked=""/);
    expect(html).not.toMatch(/aria-label="Casa" checked=""/);
    expect(html).toContain("Sale «Diana».");
    expect(html).toContain('src="/api/files/f1"');
    expect(html).not.toContain("El actual");
    expect(html).not.toContain("todavía no está en Láminas");
  });

  it("C38: el ícono de objetivo aparece en el Inspector como grupo de radios", () => {
    const html = pintar({ id: "o", tipo: "p_slide_objetivo_icono", payload: { icono: null } });
    expect(html).toContain('data-qa-geometry-group="graficos/f6-icono-subido"');
    expect(html).toContain("La lámina sale sin ícono.");
  });

  it("C38: un ícono guardado que ya no está se conserva elegido y sin íconos subidos se dice", () => {
    const html = pintar({ id: "o", tipo: "p_slide_objetivo_icono", payload: { icono: "perdido" } });
    expect(html).toContain("ya no está entre los subidos: perdido");
    expect(html).toContain("subirlos todavía no está en Láminas");
  });

  it("C35: el título vacío muestra el nombre de la pregunta del gráfico", () => {
    const html = pintar({ id: "g", tipo: "p_slide_1_grafico", payload: { titulo: "", grafico: { graficador: "p_barras_apiladas", args: { var: "base$q1" } } } });
    expect(html).toContain('placeholder="Confianza en la institución"');
    expect(html).toContain("Vacío, sale «Confianza en la institución»");
  });

  it("decisión 32: el índice muestra con candado los ajustes de los focos, ninguno editable", () => {
    const html = pintar({ id: "ix", tipo: "p_slide_indice", payload: { secciones: "Perfil", redibujar_focos: true } });
    for (const arg of ["redibujar_focos", "mostrar_iconos_focos", "iconos_focos_fill", "iconos_focos_objeto_unico"]) {
      expect(html).toContain(`data-arg-name="${arg}" data-arg-state="fijado"`);
    }
    expect(html).toContain("Lo fija el recetario");
    expect(html).toContain("El proyecto guarda «Sí»");
    // Fijado es fijado: ningún switch ni casilla para esos ajustes.
    expect(html).not.toMatch(/role="switch"/);
  });
});
