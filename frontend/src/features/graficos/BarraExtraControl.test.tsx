import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BarraExtra } from "./barraExtra";
import { BarraExtraControl, type EscalaBarraExtra } from "./BarraExtraControl";

// C2/C3/C5 en Gráficos > barra extra: el marco es el mismo con la barra apagada, con cada opción y con cada estado de la
// escala (cargando, error, sin escala, categorías por elegir); el vacío vive dentro del control y dice lo que el motor hace.

const CATS = ["Nada", "Poco", "Bastante", "Mucho"];
const LISTA: EscalaBarraExtra = { fase: "lista", categorias: CATS };
const pintar = (valor: BarraExtra, extra: Partial<Parameters<typeof BarraExtraControl>[0]> = {}) =>
  renderToStaticMarkup(
    <BarraExtraControl valor={valor} onChange={() => undefined} onEtiquetas={() => undefined} escala={LISTA} etiquetas={{ top2box: [], bottom2box: [] }} {...extra} />,
  );

describe("BarraExtraControl", () => {
  it("apagada: sólo el interruptor y su ayuda; sin chips", () => {
    const html = pintar(false);
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("Muestra una columna a la derecha de cada barra.");
    expect(html).not.toContain("aria-pressed");
  });

  it("encendida: tres chips con aria-pressed y los marcados según el valor", () => {
    const html = pintar(["top2box", "bottom2box"], { etiquetas: { top2box: ["Bastante", "Mucho"], bottom2box: ["Nada", "Poco"] } });
    expect(html).toContain('aria-checked="true"');
    expect(html.match(/class="pulso-barra-extra-chip"[^>]*aria-pressed="true"/g)).toHaveLength(2);
    for (const nombre of ["Top Two Box", "Bottom Two Box", "Conteos"]) expect(html).toContain(`>${nombre}</button>`);
  });

  it("Conteos va solo: con Conteos los boxes quedan deshabilitados con su nota, y al revés", () => {
    const conConteos = pintar(["conteos"]);
    expect(conConteos).toMatch(/disabled=""[^>]*>Top Two Box<\/button>/);
    expect(conConteos).toMatch(/disabled=""[^>]*>Bottom Two Box<\/button>/);
    expect(conConteos).toContain("Conteos va solo");
    expect(conConteos).toContain("El n de casos de cada barra o fila.");
    const conBox = pintar(["top2box"], { etiquetas: { top2box: ["Bastante", "Mucho"], bottom2box: [] } });
    expect(conBox).toMatch(/disabled=""[^>]*>Conteos<\/button>/);
    expect(conBox).not.toMatch(/disabled=""[^>]*>Top Two Box<\/button>/);
  });

  it("un box sin categorías: ofrece elegirlas y avisa que la columna no sale", () => {
    const html = pintar(["top2box"]);
    expect(html).toContain('data-qa="top2box-selector"');
    expect(html).toContain("Sin categorías elegidas: la columna Top Two Box no sale hasta que elijas al menos una.");
  });

  it("con categorías elegidas no hay aviso y los chips de la escala quedan marcados", () => {
    const html = pintar(["top2box"], { etiquetas: { top2box: ["Bastante", "Mucho"], bottom2box: [] } });
    expect(html).not.toContain("Sin categorías elegidas");
  });

  it("Bottom Two Box bloqueado por la composición: chip inactivo y la razón visible", () => {
    const html = pintar(["top2box"], { bottomBloqueado: "En esta composición el Bottom Two Box todavía no sale en la lámina.", etiquetas: { top2box: ["Bastante", "Mucho"] } });
    expect(html).toMatch(/disabled=""[^>]*>Bottom Two Box<\/button>/);
    expect(html).toContain("todavía no sale en la lámina");
  });

  it("cargando, error y sin escala se resuelven dentro del control (C3)", () => {
    expect(pintar(["top2box"], { escala: { fase: "cargando" } })).toContain("Leyendo la escala de la pregunta");
    const error = pintar(["top2box"], { escala: { fase: "error", mensaje: "No se pudo leer.", reintentar: () => undefined } });
    expect(error).toContain('role="alert"');
    expect(error).toContain("Reintentar");
    const sin = pintar(["conteos"], { escala: { fase: "sin_escala", mensaje: "Sin escala." } });
    expect(sin).toContain("Conteos");
    expect(pintar(["top2box"], { escala: { fase: "sin_escala", mensaje: "No hay escala con categorías." } })).toContain("No hay escala con categorías.");
  });

  it("categorías de otro lugar (Word, multilista): lo dice y no ofrece chips de categorías", () => {
    const html = pintar(["top2box"], { escala: { fase: "externa", nota: "Se eligen en su bloque." }, etiquetas: {}, onEtiquetas: undefined });
    expect(html).toContain("Se eligen en su bloque.");
    expect(html).not.toContain("top2box-selector");
    expect(html).not.toContain("Sin categorías elegidas");
  });

  it("una escala de dos categorías o menos no ofrece box: sumaría la escala entera", () => {
    expect(pintar(["top2box"], { escala: { fase: "lista", categorias: ["Sí", "No"] } })).toContain("sumaría la escala entera");
  });

  it("origen heredado y acción de volver", () => {
    const html = pintar(["top2box"], { heredada: "Viene del estilo del informe.", restablecer: { rotulo: "Volver a la del informe", onClick: () => undefined } });
    expect(html).toContain("Viene del estilo del informe.");
    expect(html).toContain("Volver a la del informe");
  });

  it("nombre accesible propio para el Word y grupo etiquetado", () => {
    const html = pintar(false, { rotulo: "Barra extra en el Word", ariaLabel: "Barra extra en el Word" });
    expect(html).toContain('aria-label="Barra extra en el Word"');
    expect(html).toContain('role="group" aria-labelledby=');
  });
});
