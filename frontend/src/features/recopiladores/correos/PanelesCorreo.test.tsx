import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizeMailRecipients, normalizeMailReview, type MailTemplate } from "../../../api/materialMail";
import { ColumnaDeBloques } from "./ColumnaDeBloques";
import { repartirProblemas } from "./modeloCorreo";
import { PanelDestinatarios } from "./PanelDestinatarios";
import { PanelMailchimp } from "./PanelMailchimp";
import { PanelRevision } from "./PanelRevision";

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
  blocks: [
    { block_id: "saludo", type: "greeting", text: "Estimado(a) {{nombre}}:", fallback: "Estimado(a):" },
    { block_id: "texto", type: "paragraph", text: "Hola" },
  ],
};

const noop = () => {};

describe("ColumnaDeBloques", () => {
  it("lista sobre, cabecera y bloques; marca los que tienen problemas", () => {
    const html = renderToStaticMarkup(
      <ColumnaDeBloques
        presets={[{ preset_id: "recuperacion_estudiantes_v1", title: "Recuperación de estudiantes", template: PLANTILLA }]}
        miniaturas={{}}
        template={PLANTILLA}
        seleccion="texto"
        problemas={repartirProblemas([{ path: "template.blocks[2].text", code: "missing_text", detail: "Falta el texto." }], PLANTILLA)}
        presetPendiente={null}
        onElegirPreset={noop}
        onConfirmarPreset={noop}
        onCancelarPreset={noop}
        onSeleccionar={noop}
        onAgregar={noop}
        onInsertarCampo={noop}
        hayDestino={false}
      />,
    );
    expect(html).toContain("Asunto y vista previa");
    expect(html).toContain("Cabecera de logos");
    expect(html).toContain("CCSS Perfil 2026");
    expect(html).toContain("1 por corregir");
    expect(html).toContain("{{carrera}}");
    // Sin un texto elegido, los campos no se pueden insertar.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>\{\{nombre\}\}/);
    // Sin numeral: el orden lo da la lista, no un número.
    expect(html).not.toMatch(/rec-mail-bloque-icono">\d/);
  });
});

describe("PanelDestinatarios", () => {
  it("muestra nombre y campos, nunca correos", () => {
    const destinatarios = normalizeMailRecipients({
      loaded: true,
      file_name: "lista.csv",
      row_count: 3,
      columns: ["Correo", "Nombre", "Carrera"],
      mapping: { email_column: "Correo", name_column: "Nombre", name_format: "nombre", fields: { carrera: "Carrera" } },
      counts: { total: 3, valid: 2, without_email: 1, invalid_email: 0, duplicated: 0, names_unsplit: 0 },
      sample: [{ index: 1, nombre: "Andrea", fields: { carrera: "Sociología" } }],
    });
    const html = renderToStaticMarkup(
      <PanelDestinatarios
        template={PLANTILLA}
        destinatarios={destinatarios}
        persona={1}
        ocupado={false}
        onEditar={noop}
        onImportar={noop}
        onMapear={noop}
        onOlvidar={noop}
        onVerComo={noop}
      />,
    );
    expect(html).toContain("2 destinatarios");
    expect(html).toContain("1 sin correo");
    expect(html).toContain("Andrea");
    expect(html).toContain("Sociología");
    expect(html).not.toContain("@");
  });

  it("sin lista ofrece importar y explica la persona de ejemplo", () => {
    const html = renderToStaticMarkup(
      <PanelDestinatarios
        template={PLANTILLA}
        destinatarios={normalizeMailRecipients({ loaded: false })}
        persona={null}
        ocupado={false}
        onEditar={noop}
        onImportar={noop}
        onMapear={noop}
        onOlvidar={noop}
        onVerComo={noop}
      />,
    );
    expect(html).toContain("Importar destinatarios");
    expect(html).toContain("persona de ejemplo");
  });
});

describe("PanelRevision y PanelMailchimp", () => {
  const revision = normalizeMailReview({
    checks: [
      { code: "recipients", status: "error", value: 0, detail: "Importa los destinatarios para exportar la audiencia." },
      { code: "subject", status: "ok", value: 22, detail: "Asunto presente." },
    ],
  });

  it("la revisión pone primero lo que bloquea, con su texto", () => {
    const html = renderToStaticMarkup(<PanelRevision revision={revision} cargando={false} />);
    expect(html.indexOf("Destinatarios con correo válido")).toBeLessThan(html.indexOf("Asunto definido"));
    expect(html).toContain("1 por corregir");
    expect(html).toContain("sin importar");
  });

  it("no hay botón de enviar; exportar queda bloqueado mientras la revisión tenga errores", () => {
    const html = renderToStaticMarkup(
      <PanelMailchimp
        template={PLANTILLA}
        revision={revision}
        exportacion={null}
        exportando={false}
        ocupado={false}
        htmlActual="<p>x</p>"
        onExportar={noop}
        onGuardarJunto={noop}
        onVerRevision={noop}
      />,
    );
    expect(html).toContain("*|FNAME|*");
    expect(html).toContain("*|CARRERA|*");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Exportar para Mailchimp/);
    expect(html).not.toMatch(/Enviar/);
  });
});
