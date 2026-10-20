import { afterEach, describe, expect, test, vi } from "vitest";

import { SESSION_KEY } from "./core";
import {
  MailApiError,
  apiMailCampaignCreate,
  apiMailCampaignDelete,
  apiMailExport,
  apiMailRecipients,
  apiMailRecipientsDelete,
  apiMailRecipientsImport,
  normalizeMailCampaignDelete,
  normalizeMailCampaignMeta,
  normalizeMailCampaignWrite,
  normalizeMailCampaigns,
  apiMailTemplatePut,
  normalizeMailTemplatePayload,
  normalizeMailPresets,
  normalizeMailPreview,
  normalizeMailProblems,
  normalizeMailRecipients,
  normalizeMailReview,
  normalizeMailTemplate,
  normalizeMailExport,
  serializeMailTemplate,
  apiMailImportHtml,
  mailSendInvitation,
  normalizeMailImportHtml,
  normalizeMailPlatform,
  normalizeMailSends,
  normalizeMailTemplatePut,
  serializeMailSend,
  type MailTemplate,
} from "./materialMail";

/** Como lo serializa R: escalares de largo uno a veces en vector, `{}` para listas vacías con nombres. */
const PLANTILLA_R = {
  schema: "collection_mail_template/v1",
  template_id: "correo-recuperacion",
  preset_id: "recuperacion_estudiantes_v1",
  title: "Recuperación de estudiantes",
  revision: [2],
  template_sha256: "sha256:abc",
  subject: "Estudio: invitación",
  preheader: "Diez minutos",
  theme: { accent: "#0b1f54" },
  header: { kind: "logos", logo_ids: ["logo-cliente", "pulso"], background: "dark" },
  images: { "logo-cliente": { alt: "[Unidad]" }, pulso: { alt: "Pulso PUCP", url: "https://x.org/p.png" } },
  fields: [
    { key: "carrera", tag: "CARRERA", label: "Carrera", fallback: "su carrera" },
    { key: "enlace", tag: "ENLACE", label: "Enlace" },
  ],
  blocks: [
    { block_id: "saludo", type: "greeting", text: "Estimado(a) {{nombre}}:", fallback: "Estimado(a):" },
    { block_id: "p1", type: "paragraph", text: "Hola **mundo**", align: "justify" },
    { block_id: "accion", type: "button", text: "Acceder", url: "{{enlace}}", note: "ID: 1" },
    { block_id: "imp", type: "callout", variant: "box", title: "Importante:", items: ["a", "b"] },
    { block_id: "lista", type: "list", items: ["uno"], ordered: [true] },
    { block_id: "firma", type: "signature", closing: "Atentamente,", name: "Pulso PUCP", lines: ["L1"], url: "https://pulso.pucp.edu.pe/" },
    { block_id: "pie", type: "footer_legal", text: "Recibe este correo…" },
    { block_id: "raro", type: "html_crudo", text: "<b>x</b>" },
    { block_id: "p1", type: "paragraph", text: "repetido" },
  ],
};

describe("normalizeMailTemplate", () => {
  test("lee la plantilla de R con su registro cerrado de bloques", () => {
    const t = normalizeMailTemplate(PLANTILLA_R);
    expect(t.revision).toBe(2);
    expect(t.header).toEqual({ kind: "logos", logo_ids: ["logo-cliente", "pulso"], background: "dark" });
    expect(t.images.pulso).toEqual({ alt: "Pulso PUCP", url: "https://x.org/p.png" });
    expect(t.images["logo-cliente"]).toEqual({ alt: "[Unidad]" });
    expect(t.fields[1]).toEqual({ key: "enlace", tag: "ENLACE", label: "Enlace" });
    // Un id repetido no entra; un tipo fuera del registro entra opaco.
    expect(t.blocks.map((b) => b.block_id)).toEqual(["saludo", "p1", "accion", "imp", "lista", "firma", "pie", "raro"]);
    expect(t.blocks[7]).toEqual({
      block_id: "raro",
      type: "__no_reconocido",
      original_type: "html_crudo",
      raw: { block_id: "raro", type: "html_crudo", text: "<b>x</b>" },
    });
    // Un vector de largo uno de R se lee como lista.
    expect(t.blocks[2]).toEqual({ block_id: "accion", type: "button", text: "Acceder", url: "{{enlace}}", note: ["ID: 1"] });
    expect(t.blocks[4]).toMatchObject({ type: "list", ordered: true });
  });

  test("`{}` de R en images y una lista vacía de campos", () => {
    const t = normalizeMailTemplate({ ...PLANTILLA_R, images: {}, fields: {} , header: { kind: "banner", image_ref: "banner-mailing" } });
    expect(t.images).toEqual({});
    expect(t.fields).toEqual([]);
    expect(t.header).toEqual({ kind: "banner", image_ref: "banner-mailing" });
  });

  test("rechaza lo que no es una plantilla del contrato", () => {
    expect(() => normalizeMailTemplate({ schema: "otra/v1" })).toThrow(/collection_mail_template\/v1/);
    expect(() => normalizeMailTemplate(null)).toThrow();
  });

  test("lo que vuelve al PUT no trae claves fuera del contrato", () => {
    const t = normalizeMailTemplate(PLANTILLA_R);
    const pie = t.blocks.find((b) => b.type === "footer_legal")!;
    expect(Object.keys(pie).sort()).toEqual(["block_id", "text", "type"]);
    const saludo = t.blocks[0];
    expect(Object.keys(saludo).sort()).toEqual(["block_id", "fallback", "text", "type"]);
  });
});

describe("bloques que este cliente no conoce", () => {
  test("vuelven al backend intactos, en su lugar", () => {
    const nuevo = { block_id: ["video"], type: "video_embed", src: "https://x.org/v", poster: { w: 600 } };
    const t = normalizeMailTemplate({ ...PLANTILLA_R, blocks: [PLANTILLA_R.blocks[0], nuevo, PLANTILLA_R.blocks[1]] });
    expect(t.blocks.map((b) => b.type)).toEqual(["greeting", "__no_reconocido", "paragraph"]);
    const ida = serializeMailTemplate(t) as { blocks: unknown[] };
    expect(ida.blocks[1]).toEqual(nuevo);
    expect(ida.blocks[0]).toEqual(t.blocks[0]);
    // Ida y vuelta: leer lo que se mandó da la misma plantilla.
    expect(normalizeMailTemplate(ida)).toEqual(t);
  });

  test("sin type no es un bloque", () => {
    const t = normalizeMailTemplate({ ...PLANTILLA_R, blocks: [{ block_id: "x", text: "y" }] });
    expect(t.blocks).toEqual([]);
  });
});

describe("plantilla guardada inválida", () => {
  test("se lee igual con sus problemas, para poder reemplazarla", () => {
    const p = normalizeMailTemplatePayload({
      state_revision: 4,
      builtin: false,
      template: { ...PLANTILLA_R, schema: "collection_mail_template/v0" },
      stored_problems: [{ path: "template.blocks[2].url", code: "missing_text", detail: "Falta el enlace." }],
    });
    expect(p.stored_problems).toEqual([{ path: "template.blocks[2].url", code: "missing_text", detail: "Falta el enlace." }]);
    expect(p.template.schema).toBe("collection_mail_template/v2");
    expect(p.template.blocks.length).toBeGreaterThan(0);
  });

  test("sin stored_problems, un schema ajeno sigue siendo un error", () => {
    expect(() => normalizeMailTemplatePayload({ template: { ...PLANTILLA_R, schema: "otra/v1" } })).toThrow();
    expect(normalizeMailTemplatePayload({ template: PLANTILLA_R }).stored_problems).toEqual([]);
  });
});

describe("normalizeMailPresets", () => {
  test("descarta presets sin plantilla válida y repetidos", () => {
    const p = normalizeMailPresets({
      schema: "collection_mail_template/v1",
      reserved_tags: ["EMAIL", "FNAME"],
      block_types: ["greeting", "paragraph", "inventado"],
      presets: [
        { preset_id: "recuperacion_estudiantes_v1", title: "Recuperación", template: PLANTILLA_R },
        { preset_id: "recuperacion_estudiantes_v1", title: "Otra vez", template: PLANTILLA_R },
        { preset_id: "roto", title: "Roto", template: { schema: "x" } },
      ],
    });
    expect(p.presets.map((x) => x.preset_id)).toEqual(["recuperacion_estudiantes_v1"]);
    expect(p.block_types).toEqual(["greeting", "paragraph"]);
    expect(p.reserved_tags).toEqual(["EMAIL", "FNAME"]);
  });
});

describe("normalizeMailPreview", () => {
  test("lee el destinatario importado o el de ejemplo", () => {
    const p = normalizeMailPreview({
      ok: true, mode: "preview", html: "<html></html>", subject: "S", preheader: "P", bytes: 1200,
      recipient: { source: "imported", index: 3, nombre: "Andrea", fields: { carrera: "Sociología" } },
    });
    expect(p.recipient).toEqual({ source: "imported", index: 3, nombre: "Andrea", fields: { carrera: "Sociología" } });
    const sint = normalizeMailPreview({ html: "<p>x</p>", recipient: { source: "synthetic", nombre: "Ana", fields: {} } });
    expect(sint.recipient.source).toBe("synthetic");
    expect(sint.recipient.index).toBeNull();
  });

  test("sin HTML no hay vista previa", () => {
    expect(() => normalizeMailPreview({ html: "" })).toThrow(/HTML/);
  });
});

describe("normalizeMailReview", () => {
  test("ready se recalcula desde los chequeos y los items conservan su forma", () => {
    const r = normalizeMailReview({
      ok: true,
      template_sha256: "sha256:1",
      ready: true,
      errors: 0,
      warnings: 0,
      checks: [
        { code: "subject", status: "ok", value: 22, detail: "Asunto presente." },
        { code: "images_available", status: "error", value: 1, detail: "Faltan", items: ["logo-cliente"] },
        { code: "tags_have_columns", status: "ok", value: 0, detail: "", items: [{ key: "carrera", tag: "CARRERA", column: "Carrera" }] },
        { code: "fields_empty", status: "warning", value: [2], detail: "", items: [{ tag: "CARRERA", empty: 2, fallback: "su carrera" }] },
        { status: "ok" },
      ],
    });
    expect(r.ready).toBe(false);
    expect(r.errors).toBe(1);
    expect(r.warnings).toBe(1);
    expect(r.checks).toHaveLength(4);
    expect(r.checks[1].items).toEqual(["logo-cliente"]);
    expect(r.checks[2].items).toEqual([{ key: "carrera", tag: "CARRERA", column: "Carrera" }]);
    expect(r.checks[3].value).toBe(2);
  });

  test("duplicates_conflicting y fields_empty con usos: las listas de texto se conservan", () => {
    const r = normalizeMailReview({
      checks: [
        { code: "duplicates_conflicting", status: "error", value: 1, detail: "1 correo repetido…", items: [{ row: 5, first_row: 2, tags: ["ENLACE"] }] },
        { code: "fields_empty", status: "error", value: 1, detail: "ENLACE va dentro de un enlace…", items: [
          { tag: "ENLACE", key: "enlace", empty: 1, uses: ["url"], in_url: true, fallback_covers: false },
          { tag: "CARRERA", key: "carrera", empty: 0, uses: ["cuerpo", "asunto"], in_url: false, fallback_covers: true, fallback: "su carrera" },
        ] },
      ],
    });
    expect(r.errors).toBe(2);
    expect(r.ready).toBe(false);
    expect(r.checks[0].items).toEqual([{ row: 5, first_row: 2, tags: ["ENLACE"] }]);
    expect(r.checks[1].items[0]).toEqual({ tag: "ENLACE", key: "enlace", empty: 1, uses: ["url"], in_url: true, fallback_covers: false });
    expect(r.checks[1].items[1]).toMatchObject({ uses: ["cuerpo", "asunto"] });
  });

  test("un chequeo de un contrato más nuevo se conserva con su detalle", () => {
    const r = normalizeMailReview({
      checks: [
        { code: "subject", status: "ok", value: 22, detail: "" },
        { code: "dmarc_alignment", status: "error", value: { dominio: "x" }, detail: "El remitente no está alineado.", items: [{ anidado: { a: 1 } }, "pucp.edu.pe"] },
        { code: "spam_words", status: "info", detail: "Dos palabras de riesgo." },
      ],
    });
    expect(r.checks.map((c) => c.code)).toEqual(["subject", "dmarc_alignment", "spam_words"]);
    expect(r.checks[1]).toMatchObject({ status: "error", value: null, detail: "El remitente no está alineado." });
    // Una fila sin nada legible no se convierte en un renglón vacío.
    expect(r.checks[1].items).toEqual(["pucp.edu.pe"]);
    // Un estado que no se conoce no bloquea, pero tampoco se calla.
    expect(r.checks[2].status).toBe("warning");
    expect(r.errors).toBe(1);
    expect(r.ready).toBe(false);
  });
});

describe("normalizeMailRecipients", () => {
  test("vacía es loaded=false sin mapeo ni conteos", () => {
    const r = normalizeMailRecipients({ ok: true, loaded: false, row_count: 0, columns: [], mapping: null, counts: null, sample: [] });
    expect(r).toMatchObject({ loaded: false, mapping: null, counts: null, sample: [] });
  });

  test("nunca deja pasar un correo a la vista, aunque llegue", () => {
    const r = normalizeMailRecipients({
      ok: true,
      loaded: true,
      file_name: "lista.csv",
      row_count: 3,
      columns: ["Correo", "Nombre", "Carrera"],
      mapping: { email_column: "Correo", name_column: "Nombre", name_format: "nombre", fields: { carrera: "Carrera" } },
      counts: { total: 3, valid: 2, without_email: 1, invalid_email: 0, duplicated: 0, names_unsplit: 0 },
      sample: [
        { index: 1, nombre: "Andrea", fields: { carrera: "Sociología", correo: "andrea@ejemplo.org" } },
        { index: 2, nombre: "luis@ejemplo.org", fields: {} },
      ],
    });
    expect(r.mapping).toEqual({ email_column: "Correo", name_column: "Nombre", name_format: "nombre", fields: { carrera: "Carrera" } });
    expect(r.counts?.valid).toBe(2);
    expect(r.sample[0].fields).toEqual({ carrera: "Sociología" });
    expect(r.sample[1].nombre).toBe("");
    expect(JSON.stringify(r)).not.toMatch(/@ejemplo\.org/);
  });

  test("conteos nuevos del backend no rompen la lectura", () => {
    const r = normalizeMailRecipients({
      loaded: true,
      columns: ["a"],
      mapping: { email_column: "a", fields: {} },
      counts: { total: [5], valid: 4, without_email: 1, bounced_before: 2, by_reason: { x: 1 }, names_unsplit: "0" },
      sample: [],
    });
    expect(r.counts).toEqual({
      total: 5, valid: 4, without_email: 1, invalid_email: 0, duplicated: 0, names_unsplit: 0,
      duplicated_conflicting: 0, persons_with_any_empty: 0, rows_blank_dropped: 0,
    });
    expect(r.encoding).toBeNull();
  });

  test("contrato aditivo: codificación del CSV, conflictos, vacíos y filas descartadas", () => {
    const r = normalizeMailRecipients({
      loaded: true,
      encoding: "windows-1252",
      columns: ["Correo", "Nombre"],
      mapping: { email_column: "Correo", fields: {} },
      counts: { total: 4, valid: 3, duplicated: 1, duplicated_conflicting: [1], persons_with_any_empty: 2, rows_blank_dropped: 5 },
      sample: [{ index: 1, nombre: "Andrea", fields: { contacto: "[correo oculto]" } }],
    });
    expect(r.encoding).toBe("windows-1252");
    expect(r.counts).toMatchObject({ duplicated_conflicting: 1, persons_with_any_empty: 2, rows_blank_dropped: 5 });
    expect(r.sample[0].fields.contacto).toBe("[correo oculto]");
    expect(normalizeMailRecipients({ loaded: true, encoding: "latin9" }).encoding).toBeNull();
  });

  test("`{}` en fields del mapeo", () => {
    const r = normalizeMailRecipients({
      loaded: true, columns: ["a"], mapping: { email_column: "a", fields: {} }, counts: { total: 1, valid: 1 }, sample: [],
    });
    expect(r.mapping).toEqual({ email_column: "a", name_column: null, name_format: "nombre", fields: {} });
  });
});

describe("normalizeMailExport", () => {
  test("toma el ZIP del campo zip o del artefacto deliverable", () => {
    const art = { file_id: "f1", role: "deliverable", filename: "correo_mailchimp.zip", media_type: "application/zip", size_bytes: 2048, sha256: "sha256:z", audience: "client", sensitivity: "personal_data" };
    const e = normalizeMailExport({ ok: true, artifacts: [art, { ...art, file_id: "f2", role: "manifest" }], manifest: {}, review: { ready: true, errors: 0, warnings: 1 } });
    expect(e.zip?.file_id).toBe("f1");
    expect(e.artifacts).toHaveLength(2);
    expect(e.review).toEqual({ ready: true, errors: 0, warnings: 1 });
  });
});

describe("problemas del contrato", () => {
  test("objetos {path, code, detail} y la forma vieja en texto", () => {
    expect(normalizeMailProblems({
      problems: [
        { path: "template.blocks[2].text", code: "html_not_allowed", detail: "No admite HTML." },
        "template.subject [missing_text]: Falta el texto.",
      ],
    })).toEqual([
      { path: "template.blocks[2].text", code: "html_not_allowed", detail: "No admite HTML." },
      { path: "template.subject", code: "missing_text", detail: "Falta el texto." },
    ]);
  });
});

describe("errores HTTP", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  function sesion() {
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k === SESSION_KEY ? "sid-1" : null),
      setItem: () => {},
      removeItem: () => {},
    });
  }

  function responde(status: number, body: unknown) {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  test("exportar manda siempre expected_revision", async () => {
    sesion();
    const fetchMock = responde(200, { artifacts: [], manifest: {} });
    await apiMailExport({ expected_revision: 9 });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ expected_revision: 9 });
  });

  test("un archivo ilegible no muestra el motivo interno, sí la referencia", async () => {
    sesion();
    responde(422, { error: {
      code: "E_COLLECTION_MAIL_RECIPIENTS_UNREADABLE",
      message: "No se pudo leer el archivo de destinatarios.",
      details: { reason: "parse_warning", error_id: "err-77" },
    } });
    const error = await apiMailRecipientsImport(new File(["x"], "lista.csv")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MailApiError);
    const mail = error as MailApiError;
    expect(mail.message).toContain("No se pudo leer el archivo de destinatarios.");
    expect(mail.message).toContain("err-77");
    expect(mail.message).not.toContain("parse_warning");
  });

  test("un 422 trae sus problemas por ruta y la petición lleva la sesión", async () => {
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k === SESSION_KEY ? "sid-1" : null),
      setItem: () => {},
      removeItem: () => {},
    });
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({
      error: {
        code: "E_COLLECTION_MAIL_TEMPLATE_INVALID",
        message: "La plantilla no cumple collection_mail_template/v1.",
        details: { problems: [{ path: "template.blocks[1].text", code: "missing_text", detail: "Falta el texto." }] },
      },
    }), { status: 422, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const template = normalizeMailTemplate(PLANTILLA_R) as MailTemplate;
    const error = await apiMailTemplatePut({ template, expected_revision: 3 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MailApiError);
    const mail = error as MailApiError;
    expect(mail.code).toBe("E_COLLECTION_MAIL_TEMPLATE_INVALID");
    expect(mail.status).toBe(422);
    expect(mail.problems).toEqual([{ path: "template.blocks[1].text", code: "missing_text", detail: "Falta el texto." }]);
    expect(mail.message).toBe("La plantilla no cumple collection_mail_template/v1. · E_COLLECTION_MAIL_TEMPLATE_INVALID");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/recopiladores\/mail-template$/);
    expect(init?.method).toBe("PUT");
    expect((init?.headers as Record<string, string>)["X-Pulso-Session"]).toBe("sid-1");
    const body = JSON.parse(String(init?.body)) as { expected_revision: number; template: { schema: string; blocks: unknown[] } };
    expect(body).toMatchObject({ expected_revision: 3, template: { schema: "collection_mail_template/v2" } });
    // El bloque que el cliente no conoce viaja tal como llegó.
    expect(body.template.blocks).toContainEqual({ block_id: "raro", type: "html_crudo", text: "<b>x</b>" });
    expect(JSON.stringify(body)).not.toContain("__no_reconocido");
  });
});

describe("campañas de correo (E1h)", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  function captura(body: unknown) {
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k === SESSION_KEY ? "sid-1" : null),
      setItem: () => {},
      removeItem: () => {},
    });
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), {
      status: 200, headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  test("la lista se lee con la forma de R y sin repetidos", () => {
    const out = normalizeMailCampaigns({
      ok: true,
      state_revision: [41],
      legacy_migrated: [true],
      campaigns: [
        { campaign_id: "recuperacion", name: "Recuperación", actor: "Estudiantes", preset_id: "recuperacion_estudiantes_v1",
          subject: "Asunto", blocks: [9], template_revision: 3, template_sha256: "sha256:x", updated_at: "2026-10-20T11:00:00Z",
          recipients_loaded: [true] },
        { campaign_id: "recuperacion", name: "repetida" },
        { name: "sin id" },
      ],
    });
    expect(out.state_revision).toBe(41);
    expect(out.legacy_migrated).toBe(true);
    expect(out.campaigns).toEqual([{
      campaign_id: "recuperacion", name: "Recuperación", actor: "Estudiantes", preset_id: "recuperacion_estudiantes_v1",
      subject: "Asunto", blocks: 9, template_revision: 3, template_sha256: "sha256:x", updated_at: "2026-10-20T11:00:00Z",
      recipients_loaded: true,
      // Sin plataforma ni envíos (campaña anterior a E1j/E1k): Mailchimp y sólo la invitación.
      platform: "mailchimp",
      sends: [{ send_id: "invitacion", kind: "invitacion", label: "Invitación", audience: "todos" }],
    }]);
    // Un único objeto donde se esperaba una lista (unboxing de R).
    expect(normalizeMailCampaigns({ state_revision: 1, campaigns: { campaign_id: "sola", name: "Sola" } }).campaigns).toHaveLength(1);
  });

  test("crear, renombrar y borrar: revisión, campaña y aviso aditivo", () => {
    const creada = normalizeMailCampaignWrite({
      ok: true, state_revision: 42,
      campaign: { campaign_id: "invitacion", name: "Invitación", actor: "Docentes", created_at: "a", updated_at: "b", template: PLANTILLA_R },
    });
    expect(creada.state_revision).toBe(42);
    expect(creada.campaign.template?.blocks.length).toBeGreaterThan(0);
    expect(creada.recipients_purged_virtual).toBe(false);
    expect(normalizeMailCampaignWrite({ state_revision: 1, campaign: { campaign_id: "c" }, recipients_purged_virtual: true })
      .recipients_purged_virtual).toBe(true);
    const meta = normalizeMailCampaignMeta({ ok: true, noop: false, state_revision: 44, campaign: { campaign_id: "c", name: "C" } });
    expect(meta.campaign.template).toBeNull();
    expect(normalizeMailCampaignDelete({ state_revision: 45, deleted: "c", recipients_purged: true }))
      .toEqual({ state_revision: 45, deleted: "c", recipients_purged: true });
    expect(() => normalizeMailCampaignDelete({ state_revision: 45 })).toThrow();
  });

  test("campaign_id va por consulta en GET/DELETE y en el cuerpo en POST/PUT", async () => {
    const vacia = { loaded: false };
    let fetchMock = captura(vacia);
    await apiMailRecipients("invitacion-docentes");
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/mail-recipients\?campaign_id=invitacion-docentes$/);
    await apiMailRecipientsDelete("invitacion-docentes");
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/mail-recipients\?campaign_id=invitacion-docentes$/);
    expect(fetchMock.mock.calls[1][1]?.method).toBe("DELETE");

    fetchMock = captura({ artifacts: [] });
    await apiMailExport({ expected_revision: 9, campaign_id: "recordatorio" });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ expected_revision: 9, campaign_id: "recordatorio" });

    fetchMock = captura({ ok: true, state_revision: 45, deleted: "recordatorio", recipients_purged: true });
    await apiMailCampaignDelete({ expected_revision: 44, campaign_id: "recordatorio", confirm_name: "Recordatorio directores" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/mail-campaigns\/delete$/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      expected_revision: 44, campaign_id: "recordatorio", confirm_name: "Recordatorio directores",
    });

    fetchMock = captura({ ok: true, state_revision: 42, campaign: { campaign_id: "x", template: PLANTILLA_R } });
    await apiMailCampaignCreate({ expected_revision: 41, name: "X" });
    // Sin preset no se manda: el backend parte del de fábrica.
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ expected_revision: 41, name: "X", actor: "" });
  });

  test("el import manda la campaña como parte del multipart", async () => {
    const fetchMock = captura({ loaded: false });
    await apiMailRecipientsImport(new File(["a"], "lista.csv"), null, "recuperacion");
    const fd = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(fd.get("campaign_id")).toBe("recuperacion");
  });
});

describe("plantilla v2 (E1g)", () => {
  test("lee v1 y v2, conserva los bloques y estilos nuevos y deja opaco lo desconocido", () => {
    const t = normalizeMailTemplate({
      ...PLANTILLA_R,
      schema: "collection_mail_template/v2",
      theme: { accent: "#0b1f54", link: "#123456" },
      blocks: [
        { block_id: "t", type: "heading", text: "Sesiones", level: "subtitulo", align: "center" },
        { block_id: "p", type: "paragraph", text: "Hola", size: "pequeno", tone: "suave" },
        { block_id: "b", type: "button", text: "Ir", url: "https://x.pe", align: "left", size: "grande", fill: "contorno" },
        { block_id: "c", type: "callout", items: ["a"], variant: "tinte" },
        { block_id: "d", type: "divider", style: "espacio", size: "l" },
        { block_id: "i", type: "image", image_ref: "linea-cierre", alt: "Gracias", width: [600], align: "center", bleed: [true] },
        { block_id: "x", type: "columnas", cols: 2 },
      ],
    });
    expect(t.schema).toBe("collection_mail_template/v2");
    expect(t.theme).toEqual({ accent: "#0b1f54", link: "#123456" });
    expect(t.blocks).toEqual([
      { block_id: "t", type: "heading", text: "Sesiones", level: "subtitulo", align: "center" },
      { block_id: "p", type: "paragraph", text: "Hola", size: "pequeno", tone: "suave" },
      { block_id: "b", type: "button", text: "Ir", url: "https://x.pe", align: "left", size: "grande", fill: "contorno" },
      { block_id: "c", type: "callout", items: ["a"], variant: "tinte" },
      { block_id: "d", type: "divider", style: "espacio", size: "l" },
      { block_id: "i", type: "image", image_ref: "linea-cierre", alt: "Gracias", width: 600, align: "center", bleed: true },
      { block_id: "x", type: "__no_reconocido", original_type: "columnas", raw: { block_id: "x", type: "columnas", cols: 2 } },
    ]);
    expect(() => normalizeMailTemplate({ ...PLANTILLA_R, schema: "collection_mail_template/v9" })).toThrow();
  });

  test("los chequeos traen dónde se ven y la exportación su alcance", () => {
    const review = normalizeMailReview({ ready: false, checks: [{
      code: "accent_contrast", status: "warning", value: 3.9, detail: "x",
      targets: [{ block_id: "accion", prop: "fill" }, { block_id: "__cabecera" }, { prop: "sin bloque" }],
    }] });
    expect(review.checks[0].targets).toEqual([{ block_id: "accion", prop: "fill" }, { block_id: "__cabecera" }]);
    const exp = normalizeMailExport({ scope: "plantilla", artifacts: [], import_zip: { size_bytes: 1200, entries: ["c.html", "logo.png"], html: "c.html" } });
    expect(exp.scope).toBe("plantilla");
    expect(exp.import_zip).toEqual({ size_bytes: 1200, entries: ["c.html", "logo.png"], html: "c.html" });
  });
});

describe("plataforma, envíos e importación (E1j·E1k·E1l)", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  function sesionYRespuesta(status: number, body: unknown) {
    vi.stubGlobal("localStorage", { getItem: (k: string) => (k === SESSION_KEY ? "sid-1" : null), setItem: () => {}, removeItem: () => {} });
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  test("la plataforma desconocida o ausente es Mailchimp", () => {
    expect(normalizeMailPlatform("surveymonkey")).toBe("surveymonkey");
    expect(normalizeMailPlatform(["surveymonkey"])).toBe("surveymonkey");
    expect(normalizeMailPlatform(undefined)).toBe("mailchimp");
    expect(normalizeMailPlatform("constant_contact")).toBe("mailchimp");
  });

  test("los envíos: la invitación siempre primera, sin repetidos, con valores por defecto", () => {
    expect(normalizeMailSends(undefined)).toEqual([mailSendInvitation()]);
    const sends = normalizeMailSends([
      { send_id: "recordatorio-1", kind: "recordatorio", label: "", audience: "otra", date: "2026-9-8", opening: "Aún puede **responder**." },
      { send_id: "recordatorio-1", kind: "recordatorio", label: "Repetido" },
      { send_id: "invitacion", kind: "invitacion", label: "Tarde" },
    ]);
    expect(sends.map((s) => s.send_id)).toEqual(["invitacion", "recordatorio-1"]);
    expect(sends[1]).toEqual({ send_id: "recordatorio-1", kind: "recordatorio", label: "Recordatorio 1", audience: "sin_respuesta", opening: "Aún puede **responder**." });
    // Un único objeto (unboxing de R).
    expect(normalizeMailSends({ send_id: "invitacion", kind: "invitacion", label: "Invitación", audience: "todos", date: "2026-09-02" })[0].date).toBe("2026-09-02");
  });

  test("serializar un envío omite vacíos y el id de uno sin guardar", () => {
    expect(serializeMailSend({ send_id: "", kind: "recordatorio", label: "Recordatorio 1", audience: "ambos", subject: "  ", opening: "Hola" }))
      .toEqual({ kind: "recordatorio", label: "Recordatorio 1", audience: "ambos", opening: "Hola" });
  });

  test("la plantilla conserva theme.band y fields[].destino/sm", () => {
    const t = normalizeMailTemplate({
      ...PLANTILLA_R,
      theme: { accent: "#001f60", band: "acento" },
      fields: [{ key: "enlace", tag: "ENLACE", label: "Enlace", sm: "SurveyLink", destino: "encuesta" }, { key: "web", tag: "WEB", label: "Web", destino: "raro" }],
    });
    expect(t.theme.band).toBe("acento");
    expect(t.fields[0]).toMatchObject({ sm: "SurveyLink", destino: "encuesta" });
    expect(t.fields[1].destino).toBeUndefined();
  });

  test("GET y PUT de la plantilla traen plataforma, envíos y avisos de fechas", () => {
    const get = normalizeMailTemplatePayload({ state_revision: 5, platform: "surveymonkey", sends: [{ send_id: "invitacion", kind: "invitacion", label: "Invitación" }], template: PLANTILLA_R });
    expect(get.platform).toBe("surveymonkey");
    expect(get.sends).toHaveLength(1);
    const put = normalizeMailTemplatePut({
      noop: false, state_revision: 6, template: PLANTILLA_R,
      sends: [{ send_id: "invitacion", kind: "invitacion", label: "Invitación" }, { send_id: "recordatorio-3", kind: "recordatorio", label: "Recordatorio 1" }],
      send_warnings: [{ code: "send_dates", send_id: "recordatorio-3", detail: "Recordatorio 1 tiene fecha…" }, { code: "x" }],
    });
    expect(put.sends[1].send_id).toBe("recordatorio-3");
    expect(put.send_warnings).toEqual([{ code: "send_dates", send_id: "recordatorio-3", detail: "Recordatorio 1 tiene fecha…" }]);
  });

  test("vista previa, revisión, exportación y meta leen plataforma, envío y purga", () => {
    const prev = normalizeMailPreview({ mode: "export", platform: "surveymonkey", dialect: "surveymonkey", send: { send_id: "recordatorio-1", kind: "recordatorio", label: "R1", audience: "parcial" }, html: "<p/>" });
    expect(prev).toMatchObject({ mode: "export", platform: "surveymonkey", dialect: "surveymonkey", send: { send_id: "recordatorio-1", audience: "parcial" } });
    expect(normalizeMailReview({ platform: "surveymonkey", send_id: "invitacion", checks: [] })).toMatchObject({ platform: "surveymonkey", send_id: "invitacion" });
    const exp = normalizeMailExport({ platform: "surveymonkey", send_id: "recordatorio-1", scope: "plantilla", html: { name: "a-r1.html", bytes: 3400 }, artifacts: [] });
    expect(exp).toMatchObject({ platform: "surveymonkey", send_id: "recordatorio-1", html: { name: "a-r1.html", bytes: 3400 } });
    expect(normalizeMailCampaignMeta({ state_revision: 3, campaign: { campaign_id: "c", platform: "surveymonkey" }, recipients_purged: true }))
      .toMatchObject({ recipients_purged: true, campaign: { platform: "surveymonkey" } });
  });

  test("un chequeo nuevo del backend se conserva con su detalle", () => {
    const r = normalizeMailReview({ checks: [{ code: "reminder_audience", status: "warning", value: 12, detail: "Mailchimp no sabe quién respondió." }] });
    expect(r.checks[0]).toMatchObject({ code: "reminder_audience", value: 12, detail: "Mailchimp no sabe quién respondió." });
  });

  test("la importación: nulos omitidos, códigos desconocidos conservados, plantilla válida", () => {
    const imp = normalizeMailImportHtml({
      ok: true, import_id: "imp-abc", sha256: "sha256:1", bytes: 3480,
      platform_evidence: { surveymonkey: 4 },
      template: PLANTILLA_R,
      report: [
        { code: "style_discarded", selector: "head > style", excerpt: ".button {…}", reason: "Los estilos los pone la plantilla." },
        { code: "codigo_nuevo", excerpt: "x", reason: "Algo nuevo", block_id: "p1" },
        {},
      ],
      images: [{ id: "arte1-960", url: "https://x.github.io/a.png", alt: "PULSO", status: "url" }, { id: "logo", alt: "", status: "needs_upload" }],
      stats: { blocks: 9, dropped_empty: 0, discarded: ["style", "title"] },
    });
    expect(imp.platform_detected).toBeNull();
    expect(imp.platform_evidence).toEqual({ mailchimp: 0, surveymonkey: 4 });
    expect(imp.report).toHaveLength(2);
    expect(imp.report[0].block_id).toBeNull();
    expect(imp.report[1]).toMatchObject({ code: "codigo_nuevo", block_id: "p1" });
    expect(imp.images.map((i) => i.status)).toEqual(["url", "needs_upload"]);
    expect(imp.stats.discarded).toEqual(["style", "title"]);
    expect(() => normalizeMailImportHtml({ template: PLANTILLA_R })).toThrow();
  });

  test("PUT manda plantilla y envíos juntos, e import_id si lo hay", async () => {
    const fetchMock = sesionYRespuesta(200, { noop: false, state_revision: 2, template: PLANTILLA_R, sends: [] });
    await apiMailTemplatePut({
      template: normalizeMailTemplate(PLANTILLA_R), expected_revision: 1, campaign_id: "c",
      sends: [mailSendInvitation(), { send_id: "", kind: "recordatorio", label: "Recordatorio 1", audience: "sin_respuesta" }],
      import_id: "imp-1",
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.sends).toEqual([
      { send_id: "invitacion", kind: "invitacion", label: "Invitación", audience: "todos" },
      { kind: "recordatorio", label: "Recordatorio 1", audience: "sin_respuesta" },
    ]);
    expect(body).toMatchObject({ import_id: "imp-1", campaign_id: "c", expected_revision: 1 });
  });

  test("crear con plantilla importada no manda preset_id; exportar manda send_id", async () => {
    const fetchMock = sesionYRespuesta(200, { state_revision: 2, campaign: { campaign_id: "c" } });
    await apiMailCampaignCreate({ expected_revision: 1, name: "Arte", platform: "surveymonkey", template: normalizeMailTemplate(PLANTILLA_R), preset_id: "x", import_id: "imp-1" });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.preset_id).toBeUndefined();
    expect(body).toMatchObject({ platform: "surveymonkey", import_id: "imp-1" });
    expect(body.template.schema).toBe("collection_mail_template/v2");
    const exp = sesionYRespuesta(200, { artifacts: [] });
    await apiMailExport({ expected_revision: 3, campaign_id: "c", scope: "plantilla", send_id: "recordatorio-1" });
    expect(JSON.parse(String(exp.mock.calls[0][1]?.body))).toEqual({ expected_revision: 3, campaign_id: "c", scope: "plantilla", send_id: "recordatorio-1" });
  });

  test("leer un HTML va en JSON (pegado) o multipart (archivo)", async () => {
    const r = { import_id: "imp-1", template: PLANTILLA_R };
    const json = sesionYRespuesta(200, r);
    await apiMailImportHtml({ html: "<p>Hola</p>", file_name: "a.html", subject: " Asunto " });
    expect(JSON.parse(String(json.mock.calls[0][1]?.body))).toEqual({ html: "<p>Hola</p>", file_name: "a.html", subject: "Asunto" });
    const multi = sesionYRespuesta(200, r);
    await apiMailImportHtml({ file: new File(["<p/>"], "arte.html", { type: "text/html" }) });
    expect(multi.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
  });

  test("el 413 del importador llega como MailApiError con su código", async () => {
    sesionYRespuesta(413, { error: { code: "E_COLLECTION_MAIL_IMPORT_HTML_TOO_LARGE", message: "El HTML supera 512 KB." } });
    const e = await apiMailImportHtml({ html: "x", file_name: "a.html" }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(MailApiError);
    expect((e as MailApiError).code).toBe("E_COLLECTION_MAIL_IMPORT_HTML_TOO_LARGE");
    expect((e as MailApiError).status).toBe(413);
  });
});
