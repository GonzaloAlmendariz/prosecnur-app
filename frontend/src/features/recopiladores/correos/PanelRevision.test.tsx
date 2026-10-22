import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MAIL_CHECK_CODES, normalizeMailReview, type MailCheck, type MailImageBlock, type MailTemplate } from "../../../api/materialMail";
import { arregloEnLaRevision, causaDelChequeo, comoArreglar } from "./comoArreglar";
import { CABECERA, cifraDeChequeo, franjaPorElBanner, partesDeRevision, resumenDeRevision, rotuloDeChequeo, TODO_EN_ORDEN } from "./modeloCorreo";
import { pasoALaCabecera } from "./PanelDeBloque";
import { PanelRevision, salidaDelChequeo, textoDelItem } from "./PanelRevision";

const chk = (code: string, status: MailCheck["status"], value: MailCheck["value"] = 0, detail = ""): MailCheck => ({
  code, status, value, detail, items: [], targets: [],
});

const CON_FALLOS = normalizeMailReview({
  checks: [
    { code: "subject", status: "ok", value: 45, detail: "Asunto presente." },
    { code: "greeting_trato", status: "warning", value: 0, detail: "El saludo dirá «Estimado(a)» a todos: declara la columna de sexo.", targets: [{ block_id: "saludo" }] },
    { code: "preheader", status: "ok", value: 91, detail: "" },
    { code: "recipients", status: "error", value: 0, detail: "Importa los destinatarios para exportar la audiencia." },
    { code: "accent_contrast", status: "ok", value: 15.66, detail: "" },
    { code: "footer_unsub", status: "ok", value: null, detail: "" },
  ],
});

const TODO_BIEN = normalizeMailReview({
  checks: [
    { code: "subject", status: "ok", value: 45, detail: "" },
    { code: "preheader", status: "ok", value: 91, detail: "" },
    { code: "accent_contrast", status: "ok", value: 15.66, detail: "" },
  ],
});

/** El texto visible fuera de la lista plegada (lo `hidden` no se ve hasta abrirla). */
function visible(html: string): string {
  return html.replace(/<ul[^>]*hidden=""[^>]*>[\s\S]*?<\/ul>/g, "");
}

describe("Revisión › lo que falla arriba, lo que está bien plegado (H8)", () => {
  it("ordena por corregir > avisos > en orden, sin mezclar", () => {
    const partes = partesDeRevision(CON_FALLOS.checks);
    expect(partes.porCorregir.map((c) => c.code)).toEqual(["recipients"]);
    expect(partes.avisos.map((c) => c.code)).toEqual(["greeting_trato"]);
    expect(partes.enOrden.map((c) => c.code)).toEqual(["subject", "preheader", "accent_contrast", "footer_unsub"]);

    const html = renderToStaticMarkup(<PanelRevision revision={CON_FALLOS} cargando={false} onIrAlBloque={() => undefined} />);
    const rojo = html.indexOf("Destinatarios con correo válido");
    const ambar = html.indexOf("Saludo según la persona");
    const plegado = html.indexOf("4 en orden");
    expect(rojo).toBeGreaterThan(-1);
    expect(rojo).toBeLessThan(ambar);
    expect(ambar).toBeLessThan(plegado);
    // Lo que está bien no se ve hasta abrir el desplegable.
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="([^"]+)"[\s\S]*?<ul id="\1" hidden=""/);
    expect(visible(html)).not.toContain("Asunto definido");
  });

  it("el encabezado cuenta lo que lista y cada falla lleva causa, arreglo y botón", () => {
    const html = renderToStaticMarkup(<PanelRevision revision={CON_FALLOS} cargando={false} onIrAlBloque={() => undefined} />);
    expect(html).toContain(resumenDeRevision(CON_FALLOS.errors, CON_FALLOS.warnings));
    expect(resumenDeRevision(CON_FALLOS.errors, CON_FALLOS.warnings)).toBe("1 por corregir · 1 aviso");
    expect(html.match(/rec-mail-rev-falla is-error/g)).toHaveLength(CON_FALLOS.errors);
    expect(html.match(/rec-mail-rev-falla is-warning/g)).toHaveLength(CON_FALLOS.warnings);
    // Una sola frase de causa; el botón «Elegir columna» es el arreglo del saludo.
    expect(html).toContain("El saludo dirá «Estimado(a)» a todos.");
    expect(html).not.toContain("declara la columna");
    expect(arregloEnLaRevision("greeting_trato")).toBeNull();
    expect(html).toContain("Elegir columna");
    expect(html).toContain("Todavía no hay lista de personas.");
    expect(html).toContain("Importa la lista en Personas.");
  });

  it("sin nada que falle dice «Todo en orden» y deja la lista plegada", () => {
    const html = renderToStaticMarkup(<PanelRevision revision={TODO_BIEN} cargando={false} />);
    expect(html).toContain(TODO_EN_ORDEN);
    expect(TODO_EN_ORDEN).toBe("Todo en orden: listo para exportar");
    expect(html).toContain("Ir a Exportar");
    expect(html).toContain("3 en orden");
    expect(html).not.toContain("rec-mail-rev-falla");
    expect(html).toContain('aria-expanded="false"');
  });

  it("la razón de contraste sólo va en el title, con coma decimal", () => {
    const html = renderToStaticMarkup(<PanelRevision revision={TODO_BIEN} cargando={false} />);
    expect(html).toContain('title="Contraste 15,7:1"');
    expect(html).not.toMatch(/>[^<]*15[.,]7:1/);
  });
});

describe("Revisión › sin jerga en lo que se ve", () => {
  const JERGA = /\*\||preheader|merge|dialecto/i;

  it("ningún rótulo, cifra, causa ni arreglo de los códigos conocidos la usa", () => {
    for (const code of [...MAIL_CHECK_CODES, "sm_destination_mismatch"]) {
      for (const status of ["error", "warning", "ok"] as const) {
        const c = chk(code, status, 3);
        expect(rotuloDeChequeo(c), code).not.toMatch(JERGA);
        expect(cifraDeChequeo(c), code).not.toMatch(JERGA);
        expect(causaDelChequeo(c) ?? "", code).not.toMatch(JERGA);
      }
      expect(comoArreglar(code) ?? "", code).not.toMatch(JERGA);
    }
  });

  it("los campos se nombran por su rótulo, nunca *|ETIQUETA|*", () => {
    const revision = normalizeMailReview({
      checks: [{
        code: "tags_have_columns", status: "error", value: 1, detail: "Etiquetas sin columna en la audiencia: CARRERA.",
        items: [{ key: "nombre", tag: "FNAME", column: "First Name" }, { key: "carrera", tag: "CARRERA" }, { key: "enlace", tag: "ENLACE", column: "ENLACE" }],
      }],
    });
    const template = {
      header: { kind: "logos" as const, logo_ids: [], background: "dark" as const },
      images: {},
      blocks: [],
      fields: [{ key: "carrera", tag: "CARRERA", label: "Carrera" }, { key: "enlace", tag: "ENLACE", label: "Enlace a la encuesta" }],
    };
    const html = renderToStaticMarkup(<PanelRevision revision={revision} cargando={false} template={template} />);
    expect(html).toContain("Nombre → First Name");
    expect(html).toContain("Carrera: sin columna");
    expect(html).toContain("Enlace a la encuesta → ENLACE");
    expect(html).not.toContain("*|");
    expect(html).not.toContain("Etiquetas sin columna");
  });

  it("un código desconocido conserva su code y el detalle del backend", () => {
    const revision = normalizeMailReview({ checks: [{ code: "dmarc_alignment", status: "error", value: null, detail: "El remitente no está alineado." }] });
    const html = renderToStaticMarkup(<PanelRevision revision={revision} cargando={false} />);
    expect(html).toContain("dmarc_alignment");
    expect(html).toContain("El remitente no está alineado.");
    expect(comoArreglar("dmarc_alignment")).toBeNull();
  });
});

describe("Revisión › «Logos repetidos» nombra y lleva a donde dice (e14)", () => {
  const BANNER: MailImageBlock = { block_id: "banner-arriba", type: "image", image_ref: "contabilidad-1200", alt: "Contabilidad PUCP: encuesta de acreditación", bleed: true };
  const PLANTILLA: MailTemplate = {
    schema: "collection_mail_template/v1",
    template_id: "correo",
    revision: 1,
    subject: "Acreditación",
    preheader: "",
    theme: { accent: "#0b1f54" },
    header: { kind: "logos", logo_ids: ["logo-cliente", "pulso"], background: "light" },
    images: { "logo-cliente": { alt: "Contabilidad PUCP" }, pulso: { alt: "Pulso PUCP" }, "contabilidad-1200": { alt: "", trae_logos: true } },
    fields: [{ key: "carrera", tag: "CARRERA", label: "Carrera" }],
    blocks: [BANNER, { block_id: "texto", type: "paragraph", text: "Hola" }],
  };
  const DUPLICADOS = normalizeMailReview({
    checks: [{
      code: "logos_duplicados", status: "warning", value: 1, detail: "Los logos podrían salir dos veces.",
      items: ["contabilidad-1200"], targets: [{ block_id: "__cabecera" }, { block_id: "banner-arriba" }],
    }],
  });

  it("la fila dice el nombre de la imagen, no su id", () => {
    const html = renderToStaticMarkup(<PanelRevision revision={DUPLICADOS} cargando={false} template={PLANTILLA} onIrAlBloque={() => undefined} />);
    expect(html).toContain("Contabilidad PUCP: encuesta de acreditación");
    expect(html.replace(/<[^>]*>/g, " ")).not.toContain("contabilidad-1200");
  });

  it("sin plantilla con qué nombrarla, la fila de imagen no se pinta", () => {
    const html = renderToStaticMarkup(<PanelRevision revision={DUPLICADOS} cargando={false} onIrAlBloque={() => undefined} />);
    expect(html).not.toContain("rec-mail-chk-items");
    expect(html.replace(/<[^>]*>/g, " ")).not.toContain("contabilidad-1200");
  });

  it("los demás chequeos de imagen y de campo tampoco pintan ids ni llaves", () => {
    expect(textoDelItem("images_alt", "logo-cliente", PLANTILLA)).toBe("Contabilidad PUCP");
    expect(textoDelItem("images_public_url", "pulso", PLANTILLA)).toBe("Pulso PUCP");
    expect(textoDelItem("image_weight", { id: "contabilidad-1200", size_bytes: 828071 }, PLANTILLA)).toBe("Contabilidad PUCP: encuesta de acreditación · 809 KB");
    expect(textoDelItem("import_zip_weight", { id: "pulso", file: "pulso.png", size_bytes: 2048 }, PLANTILLA)).toBe("Pulso PUCP · 2 KB");
    expect(textoDelItem("sm_fallback", "carrera", PLANTILLA)).toBe("Carrera");
    expect(textoDelItem("sm_fields_mapped", "nombre", PLANTILLA)).toBe("Nombre");
    expect(textoDelItem("sm_custom_limit", "trato", PLANTILLA)).toBe("Saludo según la persona");
  });

  it("con la cabecera descrita el botón dice «Ir a la cabecera»; sin descripción, «Ir a Identidad»", () => {
    const html = renderToStaticMarkup(<PanelRevision revision={DUPLICADOS} cargando={false} template={PLANTILLA} onIrAlBloque={() => undefined} />);
    expect(html).toContain("Ir a la cabecera");
    expect(html).not.toContain("Ir a Identidad");
    const sinAlt = { ...PLANTILLA, images: { ...PLANTILLA.images, pulso: { alt: "" } } };
    expect(renderToStaticMarkup(<PanelRevision revision={DUPLICADOS} cargando={false} template={sinAlt} onIrAlBloque={() => undefined} />)).toContain("Ir a Identidad");
    // El logo que falta se sube donde lleva el botón.
    expect(salidaDelChequeo("images_available", CABECERA, undefined, { cabeceraSinAlt: false }).texto).toBe("Subir en la cabecera");
    expect(salidaDelChequeo("images_available", CABECERA, undefined, { cabeceraSinAlt: true }).texto).toBe("Subir en Identidad");
    expect(salidaDelChequeo("logos_duplicados", CABECERA, undefined, { cabeceraSinAlt: false }).texto).toBe("Ir a la cabecera");
  });

  it("«Quitar la franja de logos» deja el bloque como cabecera: se elige la cabecera", () => {
    expect(pasoALaCabecera(franjaPorElBanner(PLANTILLA, BANNER.block_id), BANNER)).toBe(true);
    // Otras ediciones del bloque no cambian la selección.
    expect(pasoALaCabecera(PLANTILLA, BANNER)).toBe(false);
    expect(pasoALaCabecera({ ...PLANTILLA, blocks: PLANTILLA.blocks.slice(1) }, BANNER)).toBe(false);
  });
});
