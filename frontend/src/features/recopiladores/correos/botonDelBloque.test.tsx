// El botón de un Destacado o de una Fecha límite (Acreditación 2026, R4): se
// quita entero, se pone con el enlace del correo y se separa a un bloque Botón
// propio justo encima, en un solo paso.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizeMailTemplate, type MailBlock, type MailTemplate } from "../../../api/materialMail";
import { BotonDelBloque } from "./BotonDelBloque";
import { botonesDeSeccion } from "./AccionesDeSeccion";
import { MAXIMO_DE_BLOQUES } from "./estructuraCorreo";
import { TEXTO_DEL_BOTON_NUEVO, botonPuesto, conBoton, puedeSepararBoton, separarBoton, sinBoton, tieneBoton } from "./modeloBotonDelBloque";
import { conTexto } from "./modeloCorreo";

const premio = {
  block_id: "sorteo", type: "feature", title: "Al responder podrá entrar al sorteo", image_ref: "tablet", alt: "Tablet",
  align: "center", button_text: "Responda y participe", url: "{{enlace}}", button_size: "grande", button_color: "#f5b800",
};

const correo = (blocks: unknown[] = [premio]): MailTemplate => normalizeMailTemplate({
  schema: "collection_mail_template/v2", template_id: "t", revision: 1, subject: "S", preheader: "",
  fields: [{ key: "enlace", tag: "ENLACE", label: "Enlace", destino: "encuesta" }], images: {}, theme: { accent: "#004dac" },
  header: { kind: "logos", logo_ids: ["pulso"], background: "light" },
  blocks: [{ block_id: "p1", type: "paragraph", text: "Le invitamos." }, ...blocks],
});

const bloque = (t: MailTemplate, id: string) => t.blocks.find((b) => b.block_id === id) as MailBlock;

describe("el botón de la sección", () => {
  it("se quita entero: texto, enlace, tamaño y color", () => {
    const sin = sinBoton(bloque(correo(), "sorteo"));
    expect(tieneBoton(sin)).toBe(false);
    for (const k of ["button_text", "url", "button_size", "button_color"]) expect(sin).not.toHaveProperty(k);
    expect(sin).toMatchObject({ title: premio.title, image_ref: "tablet", align: "center" });
  });

  it("se pone con el enlace que lleva a la encuesta", () => {
    const t = correo();
    const con = conBoton(sinBoton(bloque(t, "sorteo")), t);
    expect(con).toMatchObject({ button_text: TEXTO_DEL_BOTON_NUEVO, url: "{{enlace}}" });
    // Con botón no se toca.
    expect(conBoton(bloque(t, "sorteo"), t)).toBe(bloque(t, "sorteo"));
  });

  it("se separa a un bloque Botón justo encima, y la sección queda sin botón", () => {
    const out = separarBoton(correo(), "sorteo");
    expect(out).not.toBeNull();
    const { template, block_id } = out!;
    expect(template.blocks.map((b) => b.block_id)).toEqual(["p1", block_id, "sorteo"]);
    expect(bloque(template, block_id)).toEqual({ block_id, type: "button", text: "Responda y participe", url: "{{enlace}}", size: "grande" });
    expect(tieneBoton(bloque(template, "sorteo"))).toBe(false);
  });

  it("un Destacado alineado a la izquierda da un botón a la izquierda; una Fecha límite, uno centrado", () => {
    const izq = separarBoton(correo([{ ...premio, align: undefined, button_size: undefined }]), "sorteo")!;
    expect(bloque(izq.template, izq.block_id)).toMatchObject({ align: "left" });
    expect(bloque(izq.template, izq.block_id)).not.toHaveProperty("size");
    const fecha = { block_id: "plazo", type: "deadline", title: "Hasta el 30", button_text: "Responder", url: "{{enlace}}" };
    const f = separarBoton(correo([fecha]), "plazo")!;
    expect(bloque(f.template, f.block_id)).not.toHaveProperty("align");
  });

  it("no separa sin botón ni cuando el correo ya no admite otro bloque", () => {
    const t = correo([sinBoton(premio as MailBlock)]);
    expect(separarBoton(t, "sorteo")).toBeNull();
    const lleno = correo([premio, ...Array.from({ length: MAXIMO_DE_BLOQUES - 2 }, (_, i) => ({ block_id: `p${i + 2}`, type: "paragraph", text: "x" }))]);
    expect(lleno.blocks).toHaveLength(MAXIMO_DE_BLOQUES);
    expect(puedeSepararBoton(lleno, "sorteo")).toBe(false);
  });

  it("la barra cuenta \"Separar el botón\" sólo cuando se puede y se ofrece", () => {
    const t = correo();
    const sin = correo([sinBoton(premio as MailBlock)]);
    expect(botonesDeSeccion(t, bloque(t, "sorteo"), false, true) - botonesDeSeccion(sin, bloque(sin, "sorteo"), false, true)).toBe(1);
    // Sin la acción cableada, no ocupa lugar.
    expect(botonesDeSeccion(t, bloque(t, "sorteo"), false, false)).toBe(botonesDeSeccion(sin, bloque(sin, "sorteo"), false, false));
  });

  it("vaciar el texto del botón no lo quita: el enlace y los campos siguen", () => {
    const t = correo();
    const vaciado = conTexto(bloque(t, "sorteo"), "button_text", "");
    expect(vaciado).not.toHaveProperty("button_text");
    expect(botonPuesto(vaciado)).toBe(true);
    expect(tieneBoton(vaciado)).toBe(false);
    const html = renderToStaticMarkup(<BotonDelBloque template={t} block={vaciado} onEditarBloque={() => {}} onEditar={() => {}} />);
    expect(html).toContain('aria-checked="true"');
    // Volver a encenderlo conserva el enlace propio.
    const propio = { ...vaciado, url: "https://pucp.edu.pe/encuesta" } as MailBlock;
    expect(conBoton(propio, t)).toMatchObject({ button_text: TEXTO_DEL_BOTON_NUEVO, url: "https://pucp.edu.pe/encuesta" });
  });

  it("el inspector muestra el interruptor y, con botón, «Separar como bloque»", () => {
    const t = correo();
    const con = renderToStaticMarkup(<BotonDelBloque template={t} block={bloque(t, "sorteo")} onEditarBloque={() => {}} onEditar={() => {}} />);
    expect(con).toContain("Lleva botón");
    expect(con).toContain("Separar como bloque");
    expect(con).toContain("El color propio no pasa");
    const s = correo([sinBoton(premio as MailBlock)]);
    const sin = renderToStaticMarkup(<BotonDelBloque template={s} block={bloque(s, "sorteo")} onEditarBloque={() => {}} onEditar={() => {}} />);
    expect(sin).toContain("La sección sale sin botón");
    expect(sin).not.toContain("Separar como bloque");
  });
});
