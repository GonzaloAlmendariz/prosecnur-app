// Ajustes del bloque con alineación clásica, tamaño y tono en cuatro/tres pasos
// (checklist ajustes-bloque 2026-10-23, ítems 1–3).

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MailBlock, MailTemplate } from "../../../api/materialMail";
import { AjusteDeBloque } from "./AjusteDeBloque";
import { ajustesDe, conAjuste, heredadoDe, sigueAIdentidad, valorDeAjuste, type Ajuste } from "./ajustesDeBloque";
import { repartirProblemas } from "./modeloCorreo";
import { PanelDeBloque } from "./PanelDeBloque";

const parrafo: MailBlock = { block_id: "p", type: "paragraph", text: "Hola" };
const titulo: MailBlock = { block_id: "t", type: "heading", text: "Título" };
const boton: MailBlock = { block_id: "b", type: "button", text: "Responder", url: "https://pulso.pucp.edu.pe" };

function ajuste(block: MailBlock, clave: string): Ajuste {
  const a = ajustesDe(block).find((x) => x.clave === clave);
  if (!a) throw new Error(`sin ajuste ${clave}`);
  return a;
}

const rotulos = (block: MailBlock, clave: string) => ajuste(block, clave).opciones.map((o) => o.rotulo);

const noop = () => {};

function plantilla(blocks: MailBlock[], textAlign?: "left" | "center" | "justify"): MailTemplate {
  return {
    schema: "collection_mail_template/v2",
    template_id: "correo",
    revision: 1,
    subject: "Invitación",
    preheader: "",
    theme: { accent: "#0b1f54", ...(textAlign ? { text_align: textAlign } : {}) },
    header: { kind: "logos", logo_ids: ["pulso"], background: "dark" },
    images: { pulso: { alt: "Pulso PUCP" } },
    fields: [],
    blocks: [...blocks, { block_id: "pie", type: "footer_legal" }],
  };
}

function panel(template: MailTemplate, seleccion: string): string {
  return renderToStaticMarkup(
    <PanelDeBloque
      template={template}
      seleccion={seleccion}
      problemas={repartirProblemas([], template)}
      persona={null}
      onEditar={noop}
      onEditarBloque={noop}
      onDestino={noop}
      onMover={noop}
      onQuitar={noop}
      onAbrirIdentidad={noop}
    />,
  );
}

describe("ajustes del bloque › opciones por tipo", () => {
  it("la alineación va en el orden clásico y sólo el párrafo se justifica", () => {
    expect(rotulos(parrafo, "align")).toEqual(["Izquierda", "Centrado", "Derecha", "Justificado"]);
    expect(rotulos(titulo, "align")).toEqual(["Izquierda", "Centrado", "Derecha"]);
    expect(rotulos(boton, "align")).toEqual(["Izquierda", "Centrado", "Derecha"]);
  });

  it("el párrafo ofrece cuatro tamaños y tres tonos, con los px del render en la ayuda", () => {
    expect(rotulos(parrafo, "size")).toEqual(["Pequeño", "Normal", "Grande", "Muy grande"]);
    expect(ajuste(parrafo, "size").opciones.map((o) => o.valor)).toEqual(["pequeno", "normal", "grande", "muy_grande"]);
    expect(ajuste(parrafo, "size").opciones.map((o) => o.ayuda?.match(/\d+ px/)?.[0])).toEqual(["13 px", "16 px", "18 px", "21 px"]);
    expect(ajuste(parrafo, "tone").opciones.map((o) => o.valor)).toEqual(["normal", "suave", "acento"]);
  });

  it("ya no existe «Del estilo» en ningún tipo", () => {
    for (const block of [parrafo, titulo, boton]) {
      for (const a of ajustesDe(block)) {
        expect(a.opciones.map((o) => o.rotulo)).not.toContain("Del estilo");
        expect(a.opciones.map((o) => o.valor)).not.toContain("estilo");
      }
    }
    expect(panel(plantilla([parrafo]), "p")).not.toContain("Del estilo");
  });
});

describe("ajustes del bloque › herencia de Identidad", () => {
  it("sin clave se marca la alineación heredada, sin escribirla", () => {
    const align = ajuste(parrafo, "align");
    expect(valorDeAjuste(parrafo, align)).toBe("justify");
    expect(valorDeAjuste(parrafo, align, { text_align: "left" })).toBe("left");
    expect(valorDeAjuste(titulo, ajuste(titulo, "align"), { text_align: "center" })).toBe("center");
    expect(valorDeAjuste(titulo, ajuste(titulo, "align"), { text_align: "justify" })).toBe("left");
    expect(valorDeAjuste(boton, ajuste(boton, "align"), { text_align: "left" })).toBe("center");
    // Elegir la heredada con la clave ausente devuelve el mismo bloque: no se escribe nada.
    expect(conAjuste(parrafo, "align", "justify")).toBe(parrafo);
    expect(conAjuste(parrafo, "align", "left", { text_align: "left" })).toBe(parrafo);
    expect(conAjuste(boton, "align", "center")).toBe(boton);
  });

  it("elegir otra opción escribe la clave; volver a la heredada la quita", () => {
    const derecha = conAjuste(parrafo, "align", "right", { text_align: "left" });
    expect(derecha).toMatchObject({ align: "right" });
    expect(valorDeAjuste(derecha, ajuste(parrafo, "align"), { text_align: "left" })).toBe("right");
    expect("align" in conAjuste(derecha, "align", "left", { text_align: "left" })).toBe(false);
    expect(conAjuste(parrafo, "size", "muy_grande")).toMatchObject({ size: "muy_grande" });
    expect(conAjuste(parrafo, "tone", "acento")).toMatchObject({ tone: "acento" });
    expect(conAjuste(titulo, "align", "justify")).toBe(titulo);
  });

  it("sólo el párrafo y el título heredan de Identidad; el botón centra por su cuenta", () => {
    expect(heredadoDe(parrafo, ajuste(parrafo, "align"))).toEqual({ valor: "justify", deIdentidad: true });
    expect(heredadoDe(boton, ajuste(boton, "align"))).toEqual({ valor: "center", deIdentidad: false });
    expect(heredadoDe(parrafo, ajuste(parrafo, "size"))).toBeNull();
    expect(sigueAIdentidad(parrafo, ajuste(parrafo, "align"))).toBe(true);
    expect(sigueAIdentidad({ ...parrafo, align: "left" } as MailBlock, ajuste(parrafo, "align"))).toBe(false);
    expect(sigueAIdentidad(boton, ajuste(boton, "align"))).toBe(false);
  });
});

describe("ajustes del bloque › en el inspector", () => {
  const AVISO = "Sigue la alineación de Identidad.";

  it("el aviso aparece sólo mientras el párrafo hereda", () => {
    const hereda = panel(plantilla([parrafo], "center"), "p");
    expect(hereda).toContain(AVISO);
    expect(hereda).toMatch(/aria-checked="true"[^>]*title="Centrado"/);
    const propio = panel(plantilla([conAjuste(parrafo, "align", "right", { text_align: "center" })], "center"), "p");
    expect(propio).not.toContain(AVISO);
    expect(propio).toMatch(/aria-checked="true"[^>]*title="Derecha"/);
    expect(panel(plantilla([boton]), "b")).not.toContain(AVISO);
  });

  it("el aviso queda enlazado al grupo y el acento pinta su muestra con el color del correo", () => {
    const html = renderToStaticMarkup(
      <AjusteDeBloque ajuste={ajuste(parrafo, "align")} valor="justify" onCambio={noop} sigueAIdentidad />,
    );
    const id = html.match(/<span id="([^"]+)" class="rec-ajuste-aviso"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`aria-describedby="${id}"`);
    const tono = panel(plantilla([parrafo]), "p");
    expect(tono).toMatch(/rec-ajuste-muestra--acento" style="background:#0b1f54"/);
  });

  it("la T del tamaño crece de 11 a 20 px", () => {
    const html = renderToStaticMarkup(<AjusteDeBloque ajuste={ajuste(parrafo, "size")} valor="normal" onCambio={noop} />);
    const tamanos = [...html.matchAll(/<svg[^>]*? width="(\d+)"/g)].map((m) => Number(m[1]));
    expect(tamanos).toEqual([11, 14, 17, 20]);
  });
});
