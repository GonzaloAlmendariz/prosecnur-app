import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MAIL_CHECK_CODES, normalizeMailReview, type MailCheck } from "../../../api/materialMail";
import { arregloEnLaRevision, causaDelChequeo, comoArreglar } from "./comoArreglar";
import { cifraDeChequeo, partesDeRevision, resumenDeRevision, rotuloDeChequeo, TODO_EN_ORDEN } from "./modeloCorreo";
import { PanelRevision } from "./PanelRevision";

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
