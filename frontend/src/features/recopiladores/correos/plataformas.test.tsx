// Plataforma por campaña, envíos e importación (addendum E1j·E1k·E1l §8, front):
// cómo sale cada bloque en cada plataforma, el pie por plataforma, «Copiar
// HTML» con el HTML de export, el diálogo de importar y la apertura del envío.

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mailSendInvitation, normalizeMailImportHtml, type MailCampaignSummary, type MailTemplate } from "../../../api/materialMail";
import { comoArreglar, destinoDelChequeo } from "./comoArreglar";
import { comoSaleEnLaPlataforma } from "./comoSaleEnLaPlataforma";
import {
  camposDeEnlace,
  conDestino,
  conEtiquetaSurveyMonkey,
  etiquetaDeCampo,
  etiquetasDePlataforma,
  motivoSinEtiqueta,
  problemaDeEtiquetas,
  smSugerido,
} from "./dialectos";
import { DialogoImportarHtml, InformeDeImportacion, PieDeImportacion, ROTULO_DEL_INFORME, rotuloDelInforme } from "./DialogoImportarHtml";
import { PanelDestinatarios } from "./PanelDestinatarios";
import { agregarRecordatorio, conApertura, enviosParaGuardar } from "./modeloEnvios";
import { cabeceraSinAlt } from "./modeloCorreo";
import { PanelEnvios } from "./PanelEnvios";
import { PanelMailchimp } from "./PanelMailchimp";
import { DestinatariosEnSurveyMonkey, PanelSurveyMonkey, copiarHtmlParaPegar } from "./PanelSurveyMonkey";
import { envioElegido, hayCambios, useCorreosStore } from "./store";
import { pedidoDelHtmlDeLaPlataforma } from "./useCorreos";
import { asuntoDeLaImportacion, conAsunto, problemaDelAsunto } from "./useImportarHtml";
import { alcanceDelPaqueteSM } from "./modeloTrato";
import { nombreSugerido, problemaDeLaFuente, reducirImportar, estadoInicialImportar } from "./useImportarHtml";

const PLANTILLA: MailTemplate = {
  schema: "collection_mail_template/v2",
  template_id: "arte",
  revision: 1,
  subject: "Invitación",
  preheader: "",
  theme: { accent: "#001f60", band: "acento" },
  header: { kind: "banner", image_ref: "arte1-960" },
  images: { "arte1-960": { alt: "", url: "https://pulsopucp.github.io/correo-/Arte1-960.png" } },
  fields: [
    { key: "enlace", tag: "ENLACE", label: "Enlace a la encuesta", sm: "SurveyLink", destino: "encuesta" },
    { key: "carrera", tag: "CARRERA", label: "Carrera", fallback: "su carrera" },
    { key: "web", tag: "WEB", label: "Página del estudio" },
  ],
  blocks: [
    { block_id: "saludo", type: "greeting", text: "Estimado(a) {{nombre}},", fallback: "Estimado(a)," },
    { block_id: "parrafo-1", type: "paragraph", text: "Usted estudia **{{carrera}}**. Más en [la web]({{web}}).", align: "justify" },
    { block_id: "boton", type: "button", text: "Empezar aquí", url: "{{enlace}}" },
    { block_id: "pie", type: "footer_legal", text: "PULSO PUCP" },
  ],
};

const noop = () => {};

describe("dialectos: cómo sale cada bloque en cada plataforma", () => {
  it("el mismo {{campo}} sale como *|TAG|* o como [sm]", () => {
    const boton = PLANTILLA.blocks[2];
    expect(comoSaleEnLaPlataforma(boton, PLANTILLA, "mailchimp").lineas.find((l) => l.rotulo.startsWith("Enlace"))?.plataforma).toBe("*|ENLACE|*");
    expect(comoSaleEnLaPlataforma(boton, PLANTILLA, "surveymonkey").lineas.find((l) => l.rotulo.startsWith("Enlace"))?.plataforma).toBe("[SurveyLink]");
    const saludoMc = comoSaleEnLaPlataforma(PLANTILLA.blocks[0], PLANTILLA, "mailchimp");
    expect(saludoMc.lineas[0].plataforma).toContain("*|IF:FNAME|*");
    const saludoSm = comoSaleEnLaPlataforma(PLANTILLA.blocks[0], PLANTILLA, "surveymonkey");
    expect(saludoSm.lineas[0].plataforma).toBe("Estimado(a) [FirstName],");
    expect(saludoSm.notas.join(" ")).toMatch(/no tiene respaldo/);
    // Un campo sin etiqueta de SurveyMonkey sale vacío y lo dice.
    const parrafo = comoSaleEnLaPlataforma(PLANTILLA.blocks[1], PLANTILLA, "surveymonkey");
    expect(parrafo.notas.join(" ")).toMatch(/Carrera.*no tiene equivalente/);
    const pie = comoSaleEnLaPlataforma(PLANTILLA.blocks[3], PLANTILLA, "surveymonkey");
    expect(pie.lineas.at(-1)?.plataforma).toContain("[OptOutLink]");
    expect(comoSaleEnLaPlataforma(PLANTILLA.blocks[3], PLANTILLA, "mailchimp").lineas.at(-1)?.plataforma).toContain("*|UNSUB|*");
  });

  it("etiquetas de la tabla y del menú de campos", () => {
    expect(etiquetasDePlataforma(PLANTILLA, "surveymonkey").map((e) => e.plataforma)).toEqual(["[FirstName]", "[SurveyLink]", null, null]);
    expect(etiquetasDePlataforma(PLANTILLA, "mailchimp").map((e) => e.plataforma)).toEqual(["*|FNAME|*", "*|ENLACE|*", "*|CARRERA|*", "*|WEB|*"]);
    expect(etiquetaDeCampo({ key: "x", tag: "X", sm: "CustomData9" }, "surveymonkey")).toBe("[CustomData9]");
    expect(etiquetaDeCampo({ key: "x", tag: "X", sm: "Email" }, "surveymonkey")).toBeNull();
  });

  it("[SurveyLink] sólo para un enlace declarado como la encuesta", () => {
    expect(motivoSinEtiqueta({ destino: "encuesta" }, "SurveyLink")).toBeNull();
    expect(motivoSinEtiqueta({ destino: "otro" }, "SurveyLink")).toMatch(/no lleva a la encuesta/);
    expect(motivoSinEtiqueta({}, "SurveyLink")).toMatch(/Primero di/);
    expect(motivoSinEtiqueta({ destino: "otro" }, "CustomData1")).toBeNull();
    // La sugerencia no adivina por el nombre: con destino sin declarar no propone [SurveyLink].
    const sinDestino = { ...PLANTILLA, fields: [{ key: "enlace", tag: "ENLACE", label: "Enlace" }] };
    expect(smSugerido(sinDestino, "enlace")).toBe("CustomData1");
    expect(smSugerido(conDestino(sinDestino, "enlace", "encuesta"), "enlace")).toBe("SurveyLink");
    expect(smSugerido(conDestino(sinDestino, "enlace", "otro"), "enlace")).toBe("CustomData1");
    // Pasar a «otro» le quita [SurveyLink].
    expect(conDestino(PLANTILLA, "enlace", "otro").fields[0].sm).toBeUndefined();
    expect(camposDeEnlace(PLANTILLA)).toEqual(["enlace", "web"]);
  });

  it("problemas de la correspondencia: repetida, destino otro y tope del plan", () => {
    let t = conEtiquetaSurveyMonkey(PLANTILLA, "carrera", "CustomData1");
    t = conEtiquetaSurveyMonkey(t, "web", "CustomData1");
    expect(problemaDeEtiquetas(t).web).toMatch(/ya es de \{\{carrera\}\}/);
    expect(problemaDeEtiquetas(conEtiquetaSurveyMonkey(PLANTILLA, "carrera", "CustomData7")).carrera).toMatch(/CustomData6/);
    expect(conEtiquetaSurveyMonkey(PLANTILLA, "carrera", "Email").fields[1].sm).toBeUndefined();
    expect(problemaDeEtiquetas({ fields: [{ key: "e", tag: "E", label: "E", sm: "SurveyLink", destino: "otro" }] }).e).toMatch(/no lleva/);
  });
});

describe("«Exportar ▾» por plataforma (F7)", () => {
  it("SurveyMonkey: copiar (principal), paquete, pasos del envío y nota del plan Enterprise", () => {
    const html = renderToStaticMarkup(
      <PanelSurveyMonkey
        envio={{ send_id: "recordatorio-1", kind: "recordatorio", label: "Recordatorio 1", audience: "sin_respuesta", date: "2026-09-08" }}
        revision={null}
        exportacion={null}
        exportando={false}
        ocupado={false}
        onHtml={async () => null}
        onExportar={noop}
        onGuardarJunto={noop}
      />,
    );
    expect(html).toContain("Para SurveyMonkey · Recordatorio 1 · 08/09");
    expect(html).toContain("Copiar HTML para SurveyMonkey");
    expect(html.match(/rec-mail-salida-principal/g)).toHaveLength(1);
    expect(html).toContain("Paquete del envío");
    expect(html).toContain("lo que pegas en el mensaje del recopilador");
    expect(html).toContain("Seguimiento");
    expect(html).toContain("Enviar recordatorio");
    expect(html).toContain("Enterprise");
    // La tabla de etiquetas ya no viaja en la salida: vive en Personas.
    expect(html).not.toContain("Etiqueta de SurveyMonkey para");
    expect(html).not.toContain("Mailchimp");
  });

  it("la tabla {{campo}} → [CustomData] se edita en Personas, con el dialecto de la campaña (F5)", () => {
    const html = renderToStaticMarkup(
      <PanelDestinatarios
        template={PLANTILLA}
        destinatarios={null}
        persona={null}
        ocupado={false}
        dialecto="surveymonkey"
        onEditar={noop}
        onImportar={noop}
        onMapear={noop}
        onOlvidar={noop}
        onVerComo={noop}
      />,
    );
    // {{carrera}} sin etiqueta todavía; [SurveyLink] deshabilitado para {{web}}.
    expect(html).toContain("Etiqueta de SurveyMonkey para {{carrera}}");
    expect(html).toMatch(/<option value="SurveyLink" disabled=""[^>]*>\[SurveyLink\] · no aplica/);
    // {{web}} es un enlace sin destino: se pregunta antes de mapearlo.
    expect(html).toContain("¿Este enlace es la encuesta?");
    expect(html).toContain("[FirstName]");
    expect(html).not.toContain("FNAME");
    expect(html).not.toContain("Mailchimp");
    expect(html).not.toContain("Etiqueta de Mailchimp");
    expect(html).toContain("Opcional: carga la lista");
  });

  it("Mailchimp no cambia y nombra el envío cuando hay más de uno", () => {
    const html = renderToStaticMarkup(
      <PanelMailchimp envio="Recordatorio 1" revision={null} exportacion={null} exportando={null} ocupado={false} htmlActual={null}
        onExportar={noop} onGuardarJunto={noop} />,
    );
    expect(html).toContain("Para Mailchimp · Recordatorio 1");
    expect(html).toContain("Plantilla para importar en Mailchimp");
    const personas = renderToStaticMarkup(
      <PanelDestinatarios template={PLANTILLA} destinatarios={null} persona={null} ocupado={false}
        onEditar={noop} onImportar={noop} onMapear={noop} onOlvidar={noop} onVerComo={noop} />,
    );
    expect(personas).toContain("Etiqueta de Mailchimp de");
    expect(personas).toContain("FNAME");
  });

  it("«Copiar HTML» copia el HTML de export, y pide mode export con el envío del borrador", async () => {
    const writeText = vi.fn(async (_t: string) => {});
    const pedir = vi.fn(async () => '<a href="[SurveyLink]">Empezar aquí</a>');
    expect(await copiarHtmlParaPegar(pedir, { writeText })).toBe("ok");
    expect(writeText).toHaveBeenCalledWith('<a href="[SurveyLink]">Empezar aquí</a>');
    expect(await copiarHtmlParaPegar(async () => null, { writeText })).toBe("error");
    expect(await copiarHtmlParaPegar(pedir, undefined)).toBe("error");
    const { envios, sendId } = agregarRecordatorio([mailSendInvitation()]);
    const pedido = pedidoDelHtmlDeLaPlataforma({ borrador: PLANTILLA, campana: "arte", envios, envio: sendId! });
    expect(pedido).toMatchObject({ mode: "export", campaign_id: "arte", envio: { send: { send_id: sendId } } });
    expect(pedidoDelHtmlDeLaPlataforma({ borrador: null, campana: "arte", envios, envio: "invitacion" })).toBeNull();
  });

  it("Personas con SurveyMonkey ya no es un vacío: la lista es opcional (C8)", () => {
    const html = renderToStaticMarkup(<DestinatariosEnSurveyMonkey />);
    expect(html).toContain("Opcional: carga la lista");
    expect(html).toContain("archivo de contactos con el saludo");
    // La nota no repite el importador: lo pone PanelDestinatarios debajo.
    expect(html).not.toContain('type="file"');
  });

  it("con lista, el paquete de SurveyMonkey es completo; sin ella, la plantilla", () => {
    expect(alcanceDelPaqueteSM("surveymonkey", true)).toBe("completo");
    expect(alcanceDelPaqueteSM("surveymonkey", false)).toBe("plantilla");
    expect(alcanceDelPaqueteSM("mailchimp", true)).toBe("plantilla");
  });
});

describe("panel de envíos", () => {
  it("lista los envíos con su fecha y a quién; el recordatorio se quita, la invitación no", () => {
    const { envios, sendId } = agregarRecordatorio([{ ...mailSendInvitation(), date: "2026-09-02" }]);
    const conTexto = conApertura(envios, sendId!, "Le recordamos…");
    const html = renderToStaticMarkup(
      <PanelEnvios
        envios={conTexto}
        activo={conTexto[1]}
        template={PLANTILLA}
        plataforma="surveymonkey"
        porGuardar
        ocupado={false}
        exportando={false}
        onElegir={noop}
        onAgregar={noop}
        onQuitar={noop}
        onEditar={noop}
        onExportar={noop}
        exportados={{ invitacion: "2026-09-02T15:04:00Z" }}
      />,
    );
    expect(html).toContain('data-qa-geometry-group="material-campo/correo/envios"');
    expect(html.match(/data-qa-geometry-member/g)).toHaveLength(2);
    expect(html).toContain("02/09 · a todos");
    expect(html).toContain("Sin fecha · sin respuesta");
    expect(html).toContain("con apertura");
    // F6: un solo «sin guardar» en la vista, el de la barra; el envío dice que es nuevo.
    expect(html).not.toContain("sin guardar");
    expect(html).toContain(">nuevo<");
    // F16: la fila del envío dice cuándo se exportó.
    expect(html).toContain("exportado 02/09");
    expect(html).toContain('aria-label="Quitar Recordatorio 1"');
    expect(html).not.toContain('aria-label="Quitar Invitación"');
    expect(html).toContain("Recopilador");
    expect(html).toContain("Guardar y exportar Recordatorio 1");
  });
});

describe("la apertura y los envíos en el store", () => {
  beforeEach(() => { useCorreosStore.getState().reiniciar(); });

  it("la capa escribe en send.opening, no en la plantilla, y Guardar los manda juntos", () => {
    const s = useCorreosStore.getState;
    s().cargaLista({
      presets: [],
      plantilla: { state_revision: 1, builtin: false, platform: "surveymonkey", sends: [mailSendInvitation()], template: PLANTILLA, stored_problems: [] },
      destinatarios: { loaded: false, file_name: null, imported_at: null, row_count: 0, encoding: null, columns: [], mapping: null, counts: null, sample: [] },
    });
    expect(s().plataforma).toBe("surveymonkey");
    const out = agregarRecordatorio(s().envios);
    s().editarEnvios(() => out.envios);
    s().setEnvio(out.sendId!);
    s().editarEnvios((l) => conApertura(l, s().envio, "Aún puede **responder**."));
    expect(envioElegido(s()).opening).toBe("Aún puede **responder**.");
    expect(s().borrador).toEqual(PLANTILLA);
    expect(hayCambios(s())).toBe(true);
    const enviados = enviosParaGuardar(s().envios);
    expect(enviados[1]).toMatchObject({ send_id: "", opening: "Aún puede **responder**." });
    s().guardado({
      noop: false, state_revision: 2, template: PLANTILLA, send_warnings: [],
      sends: [mailSendInvitation(), { send_id: "recordatorio-1", kind: "recordatorio", label: "Recordatorio 1", audience: "sin_respuesta", opening: "Aún puede **responder**." }],
    }, s().envios);
    expect(s().envio).toBe("recordatorio-1");
    expect(hayCambios(s())).toBe(false);
  });

  it("reemplazar por la importada entra al historial y se deshace", () => {
    const s = useCorreosStore.getState;
    s().cargaLista({
      presets: [],
      plantilla: { state_revision: 1, builtin: false, platform: "mailchimp", sends: [mailSendInvitation()], template: { ...PLANTILLA, subject: "Viejo" }, stored_problems: [] },
      destinatarios: { loaded: false, file_name: null, imported_at: null, row_count: 0, encoding: null, columns: [], mapping: null, counts: null, sample: [] },
    });
    s().reemplazarPorImportada(PLANTILLA, "imp-1");
    expect(s().borrador?.subject).toBe("Invitación");
    expect(s().importPendiente).toBe("imp-1");
    s().deshacer();
    expect(s().borrador?.subject).toBe("Viejo");
  });
});

/** Los códigos de `.cmail_ih_report` en collection_mail_import_html.R / _zip.R (2026-10-20). */
const CODIGOS_DEL_IMPORTADOR = [
  "block_degraded", "button_without_link", "comments_discarded", "conditional_flattened", "element_discarded",
  "email_tag_removed", "event_handler_discarded", "greeting_trato_detected", "header_missing", "hidden_discarded",
  "hover_ignored", "image_alt_missing", "image_http", "image_needs_upload", "italic_plain", "link_discarded",
  "moved_to_footer", "platform_footer_removed", "platform_link_removed", "platform_mixed", "strike_plain",
  "style_discarded", "subject_missing", "text_degraded", "text_escaped", "unrecognized", "unsafe_link_discarded",
];

const IMPORTADA = normalizeMailImportHtml({
  import_id: "imp-1", sha256: "sha256:x", bytes: 3480, platform_detected: "surveymonkey",
  platform_evidence: { surveymonkey: 4, mailchimp: 0 },
  template: { ...PLANTILLA, title: "Formación General Arte y Diseño" },
  report: [
    { code: "style_discarded", selector: "head > style", excerpt: ".button {…}", reason: "Los estilos los pone la plantilla." },
    { code: "image_alt_missing", excerpt: "Arte1-960.png", reason: "La imagen no trae texto alternativo.", block_id: "__cabecera" },
    { code: "codigo_futuro", excerpt: "", reason: "Algo que esta versión no conoce." },
  ],
  images: [{ id: "arte1-960", url: "https://pulsopucp.github.io/correo-/Arte1-960.png", alt: "", status: "url" }],
  stats: { blocks: 4, dropped_empty: 0, discarded: ["style"] },
});

describe("importar un correo existente", () => {
  it("el reductor: leer, resultado y volver a empezar sin guardar el HTML", () => {
    let e = estadoInicialImportar("mailchimp");
    e = reducirImportar(e, { type: "fuente", fuente: "pegar" });
    e = reducirImportar(e, { type: "texto", texto: "<p>Hola</p>" });
    expect(problemaDeLaFuente(e)).toBeNull();
    e = reducirImportar(e, { type: "leido", resultado: IMPORTADA, nombre: nombreSugerido(IMPORTADA, null), plataforma: "surveymonkey" });
    expect(e.fase).toBe("listo");
    expect(e.nombre).toBe("Formación General Arte y Diseño");
    e = reducirImportar(e, { type: "otra" });
    expect(e.resultado).toBeNull();
    expect(e.texto).toBe("");
    expect(problemaDeLaFuente({ fuente: "archivo", archivo: null, texto: "" })).toMatch(/Elige/);
    expect(problemaDeLaFuente({ fuente: "pegar", archivo: null, texto: "x".repeat(512 * 1024 + 1) })).toMatch(/512 KB/);
    expect(nombreSugerido({ template: { ...PLANTILLA, title: undefined } }, new File([""], "contabilidad-reacreditacion.html"))).toBe("contabilidad reacreditacion");
  });

  it("rótulos del informe en es-PE; un código desconocido no sale crudo (F9)", () => {
    expect(rotuloDelInforme({ code: "image_alt_missing" })).toBe("Imagen sin texto alternativo");
    expect(rotuloDelInforme({ code: "conditional_flattened" })).toBe("Condicional simplificado");
    expect(rotuloDelInforme({ code: "greeting_trato_detected" })).toBe("Saludo por sexo detectado");
    expect(rotuloDelInforme({ code: "codigo_futuro" })).toBe("Aviso de la importación");
    // Todos los códigos que emite el importador del backend (collection_mail_import_*.R) tienen rótulo.
    for (const code of CODIGOS_DEL_IMPORTADOR) expect(ROTULO_DEL_INFORME[code], code).toBeTruthy();
  });

  it("la cabecera importada sin descripción se pide", () => {
    expect(cabeceraSinAlt(IMPORTADA.template)).toBe("arte1-960");
    expect(cabeceraSinAlt({ ...IMPORTADA.template, images: { "arte1-960": { alt: "[Describe la imagen]" } } })).toBe("arte1-960");
    expect(cabeceraSinAlt({ ...IMPORTADA.template, images: { "arte1-960": { alt: "PULSO PUCP" } } })).toBeNull();
  });

  it("el diálogo cerrado no pinta nada; abierto pide el archivo o el código", () => {
    const panel = { abierto: false, abrir: noop, cerrar: noop, alternar: noop, props: { "data-pulso-panel": "correo-importar" } };
    const props = {
      activa: null as MailCampaignSummary | null,
      campanas: [] as MailCampaignSummary[],
      plataformaPorDefecto: "mailchimp" as const,
      conCambios: false,
      ocupado: false,
      onCrear: async () => ({ ok: false as const, mensaje: "" }),
      onReemplazar: noop,
      onAbrir: noop,
    };
    expect(renderToStaticMarkup(<MemoryRouter><DialogoImportarHtml panel={panel} {...props} /></MemoryRouter>)).toBe("");
  });

  it("el informe: plataforma detectada, bloques, y «Ver» sólo donde hay bloque", () => {
    const html = renderToStaticMarkup(<InformeDeImportacion resultado={IMPORTADA} visto="__cabecera" sinUrl={0} onVer={noop} />);
    expect(html).toContain("<b>SurveyMonkey</b>");
    expect(html).toContain("4 de SurveyMonkey · 0 de Mailchimp");
    expect(html).toContain("Estilos descartados");
    expect(html).toContain("Imagen sin texto alternativo");
    expect(html).not.toContain("codigo_futuro");
    expect(html).toContain("Aviso de la importación");
    expect(html).toContain("Algo que esta versión no conoce.");
    expect(html.match(/rec-imp-ver/g)).toHaveLength(1);
    expect(html).toContain("rec-imp-item is-visto");
    const vacio = renderToStaticMarkup(<InformeDeImportacion resultado={{ ...IMPORTADA, report: [] }} visto={null} sinUrl={1} onVer={noop} />);
    expect(vacio).toContain("Nada se descartó");
    expect(vacio).toContain("1 sin URL pública");
  });

  it("el pie: «Crear campaña» siempre; «Reemplazar» sólo con una campaña abierta, y avisa si su plataforma es otra", () => {
    const base = {
      nombre: "Arte", asunto: "Te invitamos", plataforma: "surveymonkey" as const, problemaNombre: null, problemaAsunto: null, error: "", conCambios: true,
      trabajando: false, aplicando: false, onNombre: noop, onAsunto: noop, onPlataforma: noop, onOtra: noop, onReemplazar: noop, onCrear: noop,
    };
    const sinActiva = renderToStaticMarkup(<PieDeImportacion {...base} activa={null} />);
    expect(sinActiva).toContain("Crear campaña");
    expect(sinActiva).not.toContain("Reemplazar la plantilla");
    const activa: MailCampaignSummary = {
      campaign_id: "c", name: "Formación", actor: "", platform: "mailchimp", sends: [], preset_id: null, subject: "",
      blocks: 3, template_revision: 1, template_sha256: null, updated_at: null, recipients_loaded: false,
    };
    const conActiva = renderToStaticMarkup(<PieDeImportacion {...base} activa={activa} />);
    expect(conActiva).toContain("Reemplazar la plantilla de esta campaña");
    expect(conActiva).toContain("sigue saliendo por Mailchimp");
    expect(conActiva).toContain("historial");
    // El asunto se pide a la vista, no se descubre después como error.
    expect(sinActiva).toContain("Asunto del correo");
    const sinAsunto = renderToStaticMarkup(<PieDeImportacion {...base} asunto="" problemaAsunto={problemaDelAsunto("")} activa={null} />);
    expect(sinAsunto).toContain("Escribe el asunto");
    expect(sinAsunto).toMatch(/<button[^>]*disabled[^>]*>(?:(?!<\/button>).)*Crear campaña/);
  });

  it("el asunto de lo importado: el escrito manda, después el del HTML, nunca un marcador", () => {
    expect(asuntoDeLaImportacion("  Escrito  ", { subject: "Del HTML" })).toBe("Escrito");
    expect(asuntoDeLaImportacion("", { subject: "Del HTML" })).toBe("Del HTML");
    expect(asuntoDeLaImportacion("", { subject: "[Asunto del correo]" })).toBe("");
    expect(problemaDelAsunto(" ")).toMatch(/asunto/);
    expect(conAsunto({ subject: "x", title: "t" }, "Nuevo")).toEqual({ subject: "Nuevo", title: "t" });
  });

  it("cómo arreglar cada error, sin inventar para un código desconocido", () => {
    expect(comoArreglar("images_alt")).toMatch(/Describe la imagen/);
    expect(comoArreglar("sm_fields_mapped")).toMatch(/Para SurveyMonkey/);
    expect(comoArreglar("codigo_futuro")).toBeNull();
    // «Ir al bloque»: el bloque señalado; el asunto, al sobre; lo que no está en el correo, a ningún lado.
    expect(destinoDelChequeo({ code: "images_alt", status: "error", targets: [{ block_id: "__cabecera" }] }, "__sobre")).toBe("__cabecera");
    expect(destinoDelChequeo({ code: "subject", status: "error", targets: [] }, "__sobre")).toBe("__sobre");
    expect(destinoDelChequeo({ code: "recipients", status: "error", targets: [] }, "__sobre")).toBeNull();
    expect(destinoDelChequeo({ code: "subject", status: "ok", targets: [] }, "__sobre")).toBeNull();
  });
});
