import { afterEach, describe, expect, test, vi } from "vitest";

import { SESSION_KEY } from "./core";
import {
  MailApiError,
  apiMailTemplatePut,
  normalizeMailPresets,
  normalizeMailPreview,
  normalizeMailProblems,
  normalizeMailRecipients,
  normalizeMailReview,
  normalizeMailTemplate,
  normalizeMailExport,
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
    // Un tipo fuera del registro y un id repetido no entran.
    expect(t.blocks.map((b) => b.block_id)).toEqual(["saludo", "p1", "accion", "imp", "lista", "firma", "pie"]);
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
    expect(JSON.parse(String(init?.body))).toMatchObject({ expected_revision: 3, template: { schema: "collection_mail_template/v1" } });
  });
});
