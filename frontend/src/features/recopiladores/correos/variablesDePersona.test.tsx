// Personas › «Variables de cada persona» (checklist-inspector-correo-2026-10-23, ítem 1):
// visible con o sin lista; cada campo con su etiqueta, su columna (o la línea
// que pide importar la lista) y su respaldo; y el saludo según la persona.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizeMailRecipients, type MailGreetingBlock, type MailTemplate } from "../../../api/materialMail";
import { conTrato } from "./modeloTrato";
import { PanelDestinatarios } from "./PanelDestinatarios";

const SALUDO: MailGreetingBlock = { block_id: "saludo", type: "greeting", text: "Estimado(a) {{nombre}}:", fallback: "Estimado(a):" };

const PLANTILLA: MailTemplate = {
  schema: "collection_mail_template/v1",
  template_id: "correo",
  preset_id: "recuperacion_estudiantes_v1",
  title: "Recuperación de estudiantes",
  revision: 1,
  subject: "Perfil 2026: invitación",
  preheader: "",
  theme: { accent: "#0b1f54" },
  header: { kind: "logos", logo_ids: ["pulso"], background: "dark" },
  images: { pulso: { alt: "Pulso PUCP" } },
  fields: [{ key: "carrera", tag: "CARRERA", label: "Carrera", fallback: "su carrera" }],
  blocks: [SALUDO, { block_id: "texto", type: "paragraph", text: "Hola" }],
};

const LISTA = normalizeMailRecipients({
  loaded: true,
  file_name: "lista.csv",
  row_count: 2,
  columns: ["Correo", "Nombre", "Carrera", "Sexo"],
  mapping: { email_column: "Correo", name_column: "Nombre", name_format: "nombre", fields: { carrera: "Carrera" } },
  counts: { total: 2, valid: 2, without_email: 0, invalid_email: 0, duplicated: 0, names_unsplit: 0 },
  sample: [{ index: 1, nombre: "Andrea", fields: { carrera: "Sociología" } }],
});

const noop = () => {};

function pintar(opciones: { destinatarios?: ReturnType<typeof normalizeMailRecipients> | null; saludo?: MailGreetingBlock | null; dialecto?: "mailchimp" | "surveymonkey" }) {
  const saludo = opciones.saludo === undefined ? SALUDO : opciones.saludo;
  return renderToStaticMarkup(
    <PanelDestinatarios
      template={PLANTILLA}
      destinatarios={opciones.destinatarios ?? null}
      persona={null}
      ocupado={false}
      dialecto={opciones.dialecto}
      saludo={saludo}
      onEditarSaludo={saludo ? noop : undefined}
      onEditar={noop}
      onImportar={noop}
      onMapear={noop}
      onOlvidar={noop}
      onVerComo={noop}
    />,
  );
}

describe("variablesDePersona", () => {
  it("sin lista: la sección se ve, con etiqueta, respaldo y la línea que pide importar", () => {
    const html = pintar({});
    expect(html).toContain("Variables de cada persona");
    expect(html).toContain('data-qa-geometry-group="material-campo/correo/variables"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect(html.match(/data-qa-geometry-member/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Etiqueta de Mailchimp de Carrera");
    expect(html).toContain('value="CARRERA"');
    expect(html).toContain('value="su carrera"');
    expect(html).toContain("FNAME");
    expect(html).toContain("El saludo dice «Estimado(a):»");
    // Nombre y Carrera: una línea gris cada uno, sin selector de columna.
    expect(html.match(/Elige la columna al importar la lista/g)?.length).toBe(2);
    expect(html).not.toContain('aria-label="Columna de Carrera"');
    // El saludo vive aquí, sin mandar a Personas desde Personas.
    expect(html).toContain("Saludo según la persona");
    expect(html).toContain("Igual para todos");
    expect(html).not.toContain("Ir a Personas");
    // Sin sintaxis de la plataforma a la vista.
    expect(html).not.toMatch(/\*\||\{\{/);
  });

  it("con lista: cada campo muestra el selector de su columna", () => {
    const html = pintar({ destinatarios: LISTA });
    expect(html).toContain('aria-label="Columna de Carrera"');
    expect(html).toMatch(/<option value="Carrera" selected="">Carrera<\/option>/);
    expect(html).toContain("«Nombre», la que elegiste arriba.");
    expect(html).not.toContain("Elige la columna al importar la lista");
  });

  it("saludo por sexo sin lista: palabras editables y la columna se pide al importar", () => {
    const porSexo = conTrato(conTrato(SALUDO, { modo: "por_sexo" }), { columna: "Sexo" });
    const html = pintar({ saludo: porSexo });
    expect(html).toContain("Columna elegida: <b>Sexo</b>");
    expect(html).toContain("Elige la columna al importar la lista.");
    expect(html).toContain('data-qa-geometry-group="material-campo/correo/trato-palabras"');
    expect(html).toContain("Hombre");
    expect(html).toContain("Mujer");
    expect(html).not.toContain("Ir a Personas");
  });

  it("saludo por sexo con lista: elige la columna de esta lista", () => {
    const porSexo = conTrato(conTrato(SALUDO, { modo: "por_sexo" }), { columna: "Sexo" });
    const html = pintar({ saludo: porSexo, destinatarios: LISTA });
    expect(html).toContain("Columna de sexo de la lista");
    expect(html).toMatch(/<option value="Sexo" selected="">Sexo<\/option>/);
  });

  it("sin bloque Saludo, una línea lo dice", () => {
    const html = pintar({ saludo: null });
    expect(html).toContain("Saludo según la persona");
    expect(html).toContain("El correo no tiene bloque Saludo");
    expect(html).not.toContain("Igual para todos");
  });

  it("SurveyMonkey: sin etiquetas de Mailchimp, con la misma sección", () => {
    const html = pintar({ dialecto: "surveymonkey" });
    expect(html).toContain("Variables de cada persona");
    expect(html).not.toContain("FNAME");
    expect(html).not.toContain("Mailchimp");
  });
});
