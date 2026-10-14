// W2-8: el inspector de un índice monta su editor y ya no manda los capítulos al Editor anterior. Markup estático (sin
// DOM): importa lo que el analista ve en Contenido y el diálogo direccionable `panel=iconos`.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Slide } from "../../../api/graficos";
import { InspectorLamina } from "../laminas/InspectorLamina";
import { SeccionComposicion } from "../laminas/SeccionComposicion";
import { construirEstructura } from "../laminas/modeloEstructura";
import { useLaminasUi } from "../laminas/laminasStore";
import { EditorIndiceVista } from "./EditorIndice";
import { borradorVigente, useIndiceUi } from "./indiceUiStore";
import { firmaIndice, leerIndice, type IndiceEditable } from "./modeloIndice";

vi.mock("../useGraficosRegistry", () => ({
  useGraficosRegistry: () => ({
    slidesById: {
      p_slide_indice: {
        args: [
          { name: "titulo", label: "Título", tipo_input: "string", grupo: "textos" },
          { name: "secciones", label: "Secciones principales", tipo_input: "textarea", grupo: "textos" },
          { name: "subtemas", label: "Subtemas", tipo_input: "textarea", grupo: "textos" },
          { name: "subindices", label: "Subíndices", tipo_input: "textarea", grupo: "textos" },
          { name: "iconos_focos", label: "Íconos de los focos", tipo_input: "iconos_list", grupo: "estilo" },
        ],
      },
    },
    graficadoresById: {},
  }),
}));

vi.mock("./useIconosRecetario", () => ({
  useIconosRecetario: () => ({ imagenes: new Map<string, string>(), nombres: null, cargando: false, error: null, reintentar: () => undefined }),
}));

const indice: Slide = {
  id: "ix",
  tipo: "p_slide_indice",
  payload: { titulo: "Índice", secciones: "Perfil\nResultados", subindices: "Perfil: Edad", meta: { iconos: ["none", ""] } },
};
const plan: Slide[] = [
  indice,
  { id: "s1", tipo: "p_slide_seccion", payload: { titulo: "Perfil" } },
  { id: "s2", tipo: "p_slide_seccion", payload: { titulo: "Hallazgos" } },
];

function pintarInspector(slide: Slide, search = ""): string {
  const lamina = construirEstructura(plan).laminas.find((l) => l.id === slide.id)!;
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [`/graficos${search}`] },
    createElement(InspectorLamina, {
      slide, lamina, ranura: null, onRanura: () => undefined, visor: null, onCerrar: () => undefined,
      onIrEditorAnterior: () => undefined, onCambiarLamina: () => undefined, onCambiarGrafico: () => undefined,
    })));
}

afterEach(() => {
  useIndiceUi.setState({ borrador: null, capituloIcono: null });
});

// El render de servidor de zustand lee el estado INICIAL de los stores: la vista se pinta con lo que el contenedor le
// pasaría (borrador vigente o payload, y la estructura del plan).
const pintarVista = (ix: IndiceEditable, slides: Slide[]) => texto(renderToStaticMarkup(
  createElement(EditorIndiceVista, { indice: ix, estructura: construirEstructura(slides), onAplicar: () => undefined, onAbrirIcono: () => undefined }),
));

/** El markup sin los separadores `<!-- -->` que React pone entre textos contiguos. */
const texto = (html: string) => html.replace(/<!-- -->/g, "");

describe("W2-8 Contenido del índice", () => {
  it("monta el editor de capítulos y no dice «todavía se edita en el Editor anterior»", () => {
    // Mutante «volver a sumar “Capítulos e íconos del índice” a los pendientes»: el texto reaparece.
    expect(useLaminasUi.getInitialState().seccionInspector).toBe("contenido");
    const html = texto(pintarInspector(indice));
    expect(html).not.toContain("todavía se edita en el");
    expect(html).not.toContain("Capítulos e íconos del índice");
    expect(html).toContain("Capítulos del índice");
    expect(html).toContain('value="Perfil"');
    expect(html).toContain("Edad");
    expect(html).toContain("Ícono del capítulo 1: Sin ícono");
    expect(html).toContain("Ícono del capítulo 2: Automático");
    // Los campos crudos del motor no se ofrecen además del editor.
    expect(html).not.toContain("Secciones principales");
  });

  it("avisa el desfase con los capítulos del informe y ofrece tomarlos", () => {
    const html = pintarVista(leerIndice(indice.payload), plan);
    expect(html).toContain("no coincide con los 2 capítulos del informe");
    expect(html).toContain("Tomar los capítulos del informe");
  });

  it("un borrador bloqueado se muestra con su aviso y el payload no cambia", () => {
    const bloqueado: IndiceEditable = { capitulos: [{ titulo: "Perfil: base", subcapitulos: ["Edad"], icono: "none" }], huerfanos: [] };
    const borrador = { slideId: "ix", firma: firmaIndice(indice.payload), indice: bloqueado };
    const vigente = borradorVigente(borrador, "ix", firmaIndice(indice.payload));
    expect(vigente).toBe(bloqueado);
    // Deshacer cambia el payload: el borrador deja de valer y se vuelve a leer lo guardado.
    expect(borradorVigente(borrador, "ix", firmaIndice({ ...indice.payload, secciones: "Otra" }))).toBeNull();
    expect(borradorVigente(borrador, "otra", firmaIndice(indice.payload))).toBeNull();
    const html = pintarVista(vigente ?? leerIndice(indice.payload), plan);
    expect(html).toContain('value="Perfil: base"');
    expect(html).toContain("Quita el signo para guardar el índice");
  });

  it("un índice sin capítulos contiene su vacío y deshabilita «Tomar» con motivo si el informe no tiene capítulos", () => {
    const vacio: Slide = { id: "iv", tipo: "p_slide_indice", payload: {} };
    const html = pintarVista(leerIndice(vacio.payload), [vacio]);
    expect(html).toContain("Ni el índice ni el informe tienen capítulos");   // no promete «los capítulos del informe» si no hay ninguno
    expect(html).toMatch(/aria-disabled="true"[^>]*aria-describedby/);
    expect(html).toContain("todavía no tiene separadores de capítulo");
  });
});

describe("E2 en Composición: se marca la que exporta el motor, con el sello «Del recetario»", () => {
  const pintarComposicion = (payload: Record<string, unknown>) => {
    const slide: Slide = { id: "ix", tipo: "p_slide_indice", payload };
    const lamina = construirEstructura([slide]).laminas[0];
    return texto(renderToStaticMarkup(createElement(SeccionComposicion, { slide, lamina, ranura: null, onCambiarLamina: () => undefined })));
  };
  /** La opción (label) que contiene el texto, con su radio. */
  const opcion = (html: string, rotulo: string) => html.split("<label").find((l) => l.includes(`<span>${rotulo}</span>`)) ?? "";

  it("con iconos_focos y sin composición, «Círculos» está marcada y lleva el sello", () => {
    // Mutante «varianteDe sin la composición efectiva»: quedaría marcada «Arcos» y se exportaría «Círculos».
    const html = pintarComposicion({ secciones: "A", iconos_focos: "lightbulb" });
    expect(opcion(html, "Círculos")).toContain('checked=""');
    expect(opcion(html, "Círculos")).toContain("Por defecto");
    expect(opcion(html, "Arcos")).not.toContain('checked=""');
    expect(opcion(html, "Arcos")).not.toContain("Por defecto");
  });

  it("sin focos, «Arcos» es la del recetario; «focos» declarado se explica y no marca ninguna", () => {
    expect(opcion(pintarComposicion({}), "Arcos")).toContain("Por defecto");
    const focos = pintarComposicion({ meta: { composicion: "focos" } });
    expect(focos).not.toContain('checked=""');
    expect(focos).toContain("Usa un estilo antiguo");
  });
});
