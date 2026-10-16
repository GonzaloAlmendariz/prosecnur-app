import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizeMailRecipients, normalizeMailReview, normalizeMailTemplate, type MailTemplate } from "../../../api/materialMail";
import { ColumnaDeBloques } from "./ColumnaDeBloques";
import { repartirProblemas } from "./modeloCorreo";
import { PanelDeBloque } from "./PanelDeBloque";
import { PanelDestinatarios } from "./PanelDestinatarios";
import { PanelIdentidad } from "./PanelIdentidad";
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

describe("bloques que la app no conoce", () => {
  const conRaro = normalizeMailTemplate({
    ...PLANTILLA,
    blocks: [...PLANTILLA.blocks, { block_id: "video", type: "video_embed", src: "https://x.org/v" }],
  });

  it("aparecen en la lista como «Bloque no reconocido» y el inspector no ofrece editarlos", () => {
    const lista = renderToStaticMarkup(
      <ColumnaDeBloques
        presets={[]}
        miniaturas={{}}
        template={conRaro}
        seleccion="video"
        problemas={repartirProblemas([], conRaro)}
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
    expect(lista).toContain("Bloque no reconocido");
    expect(lista).toContain("video_embed");
    const inspector = renderToStaticMarkup(
      <PanelDeBloque
        template={conRaro}
        seleccion="video"
        problemas={repartirProblemas([], conRaro)}
        persona={null}
        onEditar={noop}
        onEditarBloque={noop}
        onDestino={noop}
        onMover={noop}
        onQuitar={noop}
        onAbrirIdentidad={noop}
      />,
    );
    expect(inspector).toContain("Se conserva tal cual al guardar");
    expect(inspector).not.toMatch(/<textarea|<input/);
    expect(inspector).toContain("Quitar el bloque");
  });
});

describe("PanelDeBloque › Botón de acción", () => {
  const conBoton: MailTemplate = {
    ...PLANTILLA,
    fields: [...PLANTILLA.fields, { key: "codigo", tag: "CODIGO", label: "Código" }],
    blocks: [{ block_id: "accion", type: "button", text: "Acceder", url: "https://x.org/r/encuesta?d[codigo]={{codigo}}" }],
  };

  it("muestra el enlace resuelto para la persona elegida, sin su correo", () => {
    const html = renderToStaticMarkup(
      <PanelDeBloque
        template={conBoton}
        seleccion="accion"
        problemas={repartirProblemas([], conBoton)}
        persona={{ source: "imported", index: 2, nombre: "Luis", fields: { codigo: "20206621", correo: "luis@x.org" } }}
        onEditar={noop}
        onEditarBloque={noop}
        onDestino={noop}
        onMover={noop}
        onQuitar={noop}
        onAbrirIdentidad={noop}
      />,
    );
    expect(html).toContain("Enlace personal");
    expect(html).toContain("Luis");
    expect(html).toContain("…/r/encuesta?d[codigo]=");
    expect(html).toContain("20206621");
    expect(html).not.toContain("luis@x.org");
  });
});

describe("PanelIdentidad › Franja de logos", () => {
  it("pinta los logos que la vista previa ya tiene, sobre el fondo de la franja", () => {
    const plantilla: MailTemplate = {
      ...PLANTILLA,
      header: { kind: "logos", logo_ids: ["facultad", "pulso"], background: "dark" },
      images: { facultad: { alt: "Facultad" }, pulso: { alt: "Pulso PUCP" } },
    };
    const vista = '<tr><td bgcolor="#0b1f54"><table><tr>'
      + '<td valign="middle"><img src="data:image/png;base64,QUJD" alt="Facultad"></td>'
      + '<td valign="middle" style="padding:0 18px;"><div></div></td>'
      + '<td valign="middle"><img src="data:image/png;base64,REVG" alt="Pulso PUCP"></td>'
      + "</tr></table></td></tr>";
    const html = renderToStaticMarkup(
      <PanelIdentidad
        template={plantilla}
        imagenesLocales={{}}
        htmlDeLaVista={vista}
        sinArchivo={[]}
        bannerCheck={null}
        ocupado={false}
        onEditar={noop}
        onSubir={noop}
      />,
    );
    expect(html).toContain("rec-mail-franja-vista is-oscura");
    expect(html).toContain("background-color:#0b1f54");
    expect(html).toContain('src="data:image/png;base64,QUJD"');
    expect(html).toContain('src="data:image/png;base64,REVG"');
    expect(html).toContain("Franja de logos sobre fondo oscuro: Facultad, Pulso PUCP");
  });
});

describe("PanelRevision › chequeos de un contrato más nuevo", () => {
  it("se muestran con su code y el detalle del backend", () => {
    const revision = normalizeMailReview({
      checks: [{ code: "dmarc_alignment", status: "ok", value: null, detail: "El remitente está alineado." }],
    });
    const html = renderToStaticMarkup(<PanelRevision revision={revision} cargando={false} />);
    expect(html).toContain("dmarc_alignment");
    expect(html).toContain("El remitente está alineado.");
  });
});

describe("Revisión con un repetido que cambia el enlace y un enlace vacío", () => {
  const revision = normalizeMailReview({
    checks: [
      { code: "duplicates_conflicting", status: "error", value: 1, detail: "1 correos repetidos traen otro valor en un campo de enlace: decide cuál vale y corrige el archivo.", items: [{ row: 4, first_row: 2, tags: ["ENLACE"] }] },
      { code: "fields_empty", status: "error", value: 1, detail: "ENLACE va dentro de un enlace y le falta a algún destinatario: el enlace saldría roto.", items: [{ tag: "ENLACE", key: "enlace", empty: 1, uses: ["url"], in_url: true, fallback_covers: false }] },
    ],
  });

  it("muestra los dos errores con sus filas y deja la exportación bloqueada", () => {
    const html = renderToStaticMarkup(<PanelRevision revision={revision} cargando={false} />);
    expect(html).toContain("Correos repetidos con datos distintos");
    expect(html).toContain("Fila 4 repite la 2: otro *|ENLACE|*");
    expect(html).toContain("*|ENLACE|*: 1 sin dato · en enlace · sin respaldo posible");
    expect(html).toContain("2 por corregir");
    const mc = renderToStaticMarkup(
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
    expect(mc).toMatch(/<button[^>]*disabled=""[^>]*>.*Exportar para Mailchimp/);
  });
});

describe("PanelDestinatarios › cómo se leyó la lista", () => {
  it("dice la codificación y las filas vacías, sin alarmar", () => {
    const destinatarios = normalizeMailRecipients({
      loaded: true,
      file_name: "lista.csv",
      encoding: "windows-1252",
      columns: ["Correo", "Nombre"],
      mapping: { email_column: "Correo", name_column: "Nombre", fields: {} },
      counts: { total: 3, valid: 3, rows_blank_dropped: 1 },
      sample: [],
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
    expect(html).toContain("Leído como Windows-1252");
    expect(html).toContain("1 fila vacía descartada");
  });
});
