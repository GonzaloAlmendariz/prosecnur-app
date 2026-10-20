import { describe, expect, test, vi } from "vitest";

import { mailSendInvitation } from "../../../api/materialMail";
import {
  MailApiError,
  type MailCampaign,
  type MailCampaignSummary,
  type MailTemplate,
} from "../../../api/materialMail";
import { CABECERA, SOBRE } from "./modeloCorreo";
import {
  BORRADO_INICIAL,
  ORIGEN_EN_BLANCO,
  avisoDeCampana,
  campanaTrasBorrar,
  conDestinatarios,
  conPlantillaGuardada,
  focoDeSeleccion,
  nombreConfirmado,
  nombreDeCopia,
  nombreLibre,
  parseFocoCorreo,
  plantillaEnBlanco,
  ponerCampana,
  problemaDelActor,
  problemaDelNombre,
  quitarCampana,
  reducirBorrado,
  resumenDeCampana,
  revisionEncadenada,
  rotuloDeCampana,
  seleccionDelFoco,
  type FaseDelBorrado,
} from "./modeloCampanas";
import { crearCampanaEncadenada, type PuertoDeCreacion } from "./useCampanas";

function resumen(id: string, over: Partial<MailCampaignSummary> = {}): MailCampaignSummary {
  return {
    campaign_id: id,
    name: id,
    actor: "",
    platform: "mailchimp",
    sends: [{ send_id: "invitacion", kind: "invitacion", label: "Invitación", audience: "todos" }],
    preset_id: null,
    subject: "",
    blocks: 3,
    template_revision: 1,
    template_sha256: null,
    updated_at: null,
    recipients_loaded: false,
    ...over,
  };
}

const TRES = [resumen("recuperacion"), resumen("invitacion-docentes"), resumen("recordatorio")];

const PLANTILLA: MailTemplate = {
  schema: "collection_mail_template/v1",
  template_id: "recuperacion",
  preset_id: "recuperacion_estudiantes_v1",
  title: "Recuperación de estudiantes",
  revision: 2,
  template_sha256: "sha256:a",
  subject: "Perfil 2026: invitación",
  preheader: "Diez minutos",
  theme: { accent: "#0b1f54" },
  header: { kind: "logos", logo_ids: ["pulso"], background: "dark" },
  images: { pulso: { alt: "Pulso PUCP" } },
  fields: [{ key: "carrera", tag: "CARRERA", label: "Carrera", fallback: "su carrera" }],
  blocks: [
    { block_id: "saludo", type: "greeting", text: "Estimado(a) {{nombre}}:", fallback: "Estimado(a):" },
    { block_id: "p1", type: "paragraph", text: "Hola" },
    { block_id: "accion", type: "button", text: "Acceder", url: "{{enlace}}" },
    { block_id: "firma", type: "signature", closing: "Atentamente,", name: "Pulso PUCP" },
    { block_id: "pie", type: "footer_legal", text: "Recibe este correo…" },
  ],
};

describe("foco de la pestaña Correos", () => {
  test("campaña y bloque se leen con el separador del editor de fichas", () => {
    expect(parseFocoCorreo("invitacion-docentes~accion", TRES)).toEqual({
      campaignId: "invitacion-docentes", blockId: "accion", canonico: "invitacion-docentes~accion", reescribir: false,
    });
    expect(parseFocoCorreo("recordatorio", TRES)).toEqual({
      campaignId: "recordatorio", blockId: null, canonico: "recordatorio", reescribir: false,
    });
  });

  test("vacío, borrado o inventado se reescribe a la primera campaña", () => {
    for (const raw of [null, "", "  ", "ya-no-existe", "ya-no-existe~p1"]) {
      expect(parseFocoCorreo(raw, TRES)).toEqual({
        campaignId: "recuperacion", blockId: null, canonico: "recuperacion", reescribir: true,
      });
    }
  });

  test("`campana~` sin bloque se normaliza a la campaña", () => {
    expect(parseFocoCorreo("recordatorio~", TRES)).toEqual({
      campaignId: "recordatorio", blockId: null, canonico: "recordatorio", reescribir: true,
    });
  });

  test("sin campañas no hay foco: si la URL trae uno, se borra", () => {
    expect(parseFocoCorreo("recuperacion", [])).toEqual({ campaignId: null, blockId: null, canonico: null, reescribir: true });
    expect(parseFocoCorreo(null, [])).toEqual({ campaignId: null, blockId: null, canonico: null, reescribir: false });
  });

  test("lo elegido en el editor se escribe en el foco; el sobre no escribe bloque", () => {
    expect(focoDeSeleccion("recuperacion", SOBRE)).toBe("recuperacion");
    expect(focoDeSeleccion("recuperacion", "p1")).toBe("recuperacion~p1");
    expect(focoDeSeleccion("recuperacion", CABECERA)).toBe(`recuperacion~${CABECERA}`);
  });

  test("el bloque del foco se valida contra la plantilla de esa campaña", () => {
    expect(seleccionDelFoco(null, PLANTILLA)).toBe(SOBRE);
    expect(seleccionDelFoco(CABECERA, PLANTILLA)).toBe(CABECERA);
    expect(seleccionDelFoco("accion", PLANTILLA)).toBe("accion");
    expect(seleccionDelFoco("no-esta", PLANTILLA)).toBeNull();
    expect(seleccionDelFoco("accion", null)).toBeNull();
  });
});

describe("revisión encadenada", () => {
  test("toma la nueva y nunca baja por una lectura que llegó tarde", () => {
    expect(revisionEncadenada(null, 5)).toBe(5);
    expect(revisionEncadenada(5, 6)).toBe(6);
    expect(revisionEncadenada(7, 6)).toBe(7);
    expect(revisionEncadenada(7, null)).toBe(7);
    expect(revisionEncadenada(null, undefined)).toBeNull();
  });

  test("crear en blanco: la segunda escritura usa la revisión que devolvió la primera", async () => {
    const campana: MailCampaign = {
      campaign_id: "correo-nuevo", name: "Correo nuevo", actor: "", created_at: null, updated_at: null,
      duplicated_from: null, platform: "mailchimp", sends: [], template: { ...PLANTILLA, template_id: "correo-nuevo", revision: 1 },
    };
    const crear = vi.fn<PuertoDeCreacion["crear"]>(async () => ({ state_revision: 42, campaign: campana, recipients_purged_virtual: true }));
    const guardarPlantilla = vi.fn<PuertoDeCreacion["guardarPlantilla"]>(async (input) => ({
      noop: false, state_revision: 43, campaign_id: "correo-nuevo", template: { ...input.template, revision: 2 }, sends: [mailSendInvitation()], send_warnings: [],
    }));
    const anotadas: number[] = [];
    const out = await crearCampanaEncadenada(
      { crear, guardarPlantilla },
      { expected_revision: 41, name: "  Correo nuevo ", actor: "", origen: ORIGEN_EN_BLANCO },
      (r) => anotadas.push(r),
    );
    expect(crear).toHaveBeenCalledWith({ expected_revision: 41, name: "Correo nuevo", actor: "", preset_id: null });
    expect(guardarPlantilla.mock.calls[0][0]).toMatchObject({ expected_revision: 42, campaign_id: "correo-nuevo" });
    expect(anotadas).toEqual([42, 43]);
    expect(out.campana.template?.blocks.map((b) => b.type)).toEqual(["greeting", "paragraph", "signature", "footer_legal"]);
    // La purga de la campaña provisional se avisa.
    expect(out.aviso).toMatch(/destinatarios/);
  });

  test("desde un preset hay una sola escritura y se manda el preset", async () => {
    const campana: MailCampaign = {
      campaign_id: "invitacion", name: "Invitación", actor: "Docentes", created_at: null, updated_at: null,
      duplicated_from: null, platform: "mailchimp", sends: [], template: PLANTILLA,
    };
    const crear = vi.fn<PuertoDeCreacion["crear"]>(async () => ({ state_revision: 9, campaign: campana, recipients_purged_virtual: false }));
    const guardarPlantilla = vi.fn<PuertoDeCreacion["guardarPlantilla"]>();
    const anotadas: number[] = [];
    const out = await crearCampanaEncadenada(
      { crear, guardarPlantilla },
      { expected_revision: 8, name: "Invitación", actor: "Docentes", origen: "invitacion_capacitacion_v1" },
      (r) => anotadas.push(r),
    );
    expect(crear.mock.calls[0][0].preset_id).toBe("invitacion_capacitacion_v1");
    expect(guardarPlantilla).not.toHaveBeenCalled();
    expect(anotadas).toEqual([9]);
    expect(out.aviso).toBeUndefined();
  });

  test("si la plantilla en blanco no se guarda, la revisión de la creación ya quedó anotada", async () => {
    const campana: MailCampaign = {
      campaign_id: "c", name: "C", actor: "", created_at: null, updated_at: null, duplicated_from: null, platform: "mailchimp", sends: [], template: PLANTILLA,
    };
    const anotadas: number[] = [];
    const out = await crearCampanaEncadenada(
      {
        crear: async () => ({ state_revision: 3, campaign: campana, recipients_purged_virtual: false }),
        guardarPlantilla: async () => { throw new MailApiError("E_COLLECTION_STATE_STALE", "stale", 409, null); },
      },
      { expected_revision: 2, name: "C", actor: "", origen: ORIGEN_EN_BLANCO },
      (r) => anotadas.push(r),
    );
    expect(anotadas).toEqual([3]);
    expect(out.campana.template).toBe(PLANTILLA);
    expect(out.aviso).toMatch(/fábrica/);
  });
});

describe("nombre y actor", () => {
  test("el nombre es obligatorio, acotado y sin forma de correo; el aviso no repite el valor", () => {
    expect(problemaDelNombre("Invitación docentes")).toBeNull();
    expect(problemaDelNombre("   ")).toMatch(/Escribe/);
    expect(problemaDelNombre("x".repeat(81))).toMatch(/80/);
    const conCorreo = problemaDelNombre("ana.perez@pucp.edu.pe");
    expect(conCorreo).toMatch(/correo/);
    expect(conCorreo).not.toContain("ana.perez");
    expect(problemaDelActor("")).toBeNull();
    expect(problemaDelActor("x".repeat(61))).toMatch(/60/);
    expect(problemaDelActor("docente@unsa.edu.pe")).not.toContain("docente@");
  });

  test("rótulo con actor y nombres que no se repiten", () => {
    expect(rotuloDeCampana({ name: "Recuperación estudiantes", actor: "Estudiantes" })).toBe("Recuperación estudiantes · Estudiantes");
    expect(rotuloDeCampana({ name: "Recuperación", actor: " " })).toBe("Recuperación");
    const lista = [resumen("a", { name: "Correo nuevo" }), resumen("b", { name: "Correo nuevo (2)" })];
    expect(nombreLibre("Correo nuevo", lista)).toBe("Correo nuevo (3)");
    expect(nombreLibre("Otro", lista)).toBe("Otro");
    expect(nombreDeCopia("Invitación", [resumen("i", { name: "Invitación" })])).toBe("Invitación (copia)");
    expect(nombreLibre("x".repeat(90), []).length).toBe(80);
  });

  test("el aviso de un rechazo de campaña dice qué hacer y nunca el valor", () => {
    const error = new MailApiError("E_COLLECTION_MAIL_CAMPAIGN_NAME", "name: ana@x.pe no es válido", 422, null);
    const aviso = avisoDeCampana(error, "No se pudo");
    expect(aviso).not.toContain("ana@x.pe");
    expect(avisoDeCampana(new MailApiError("E_COLLECTION_MAIL_CAMPAIGN_LIMIT", "", 409, null), "x")).toMatch(/20/);
    expect(avisoDeCampana(new Error(""), "No se pudo")).toBe("No se pudo");
  });
});

describe("la lista después de cada escritura", () => {
  test("crear agrega al final, renombrar reemplaza en su sitio y conserva lo que la respuesta no trae", () => {
    const creada: MailCampaign = {
      campaign_id: "nueva", name: "Nueva", actor: "Directores", created_at: null, updated_at: "2026-10-20T11:00:00Z",
      duplicated_from: null, platform: "mailchimp", sends: [], template: PLANTILLA,
    };
    const conNueva = ponerCampana(TRES, resumenDeCampana(creada));
    expect(conNueva.map((c) => c.campaign_id)).toEqual(["recuperacion", "invitacion-docentes", "recordatorio", "nueva"]);
    expect(conNueva[3]).toMatchObject({ subject: PLANTILLA.subject, blocks: 5, template_revision: 2, recipients_loaded: false });

    const previo = resumen("recordatorio", { subject: "Asunto", blocks: 7, recipients_loaded: true });
    const renombrada = resumenDeCampana({ ...creada, campaign_id: "recordatorio", name: "Recordatorio directores", template: null }, previo);
    expect(renombrada).toMatchObject({ name: "Recordatorio directores", subject: "Asunto", blocks: 7, recipients_loaded: true });
    expect(ponerCampana(TRES, renombrada).map((c) => c.campaign_id)).toEqual(["recuperacion", "invitacion-docentes", "recordatorio"]);
  });

  test("guardar la plantilla y cargar destinatarios actualizan sólo su campaña", () => {
    const guardada = conPlantillaGuardada(TRES, "recordatorio", { ...PLANTILLA, subject: "Otro", revision: 4 });
    expect(guardada[2]).toMatchObject({ subject: "Otro", template_revision: 4, blocks: 5 });
    expect(guardada[0]).toBe(TRES[0]);
    expect(conDestinatarios(TRES, "recuperacion", true)[0].recipients_loaded).toBe(true);
    expect(quitarCampana(TRES, "invitacion-docentes").map((c) => c.campaign_id)).toEqual(["recuperacion", "recordatorio"]);
  });

  test("tras borrar la abierta se mira la de al lado; si no, la misma", () => {
    expect(campanaTrasBorrar(TRES, "invitacion-docentes", "invitacion-docentes")).toBe("recordatorio");
    expect(campanaTrasBorrar(TRES, "recordatorio", "recordatorio")).toBe("invitacion-docentes");
    expect(campanaTrasBorrar(TRES, "recordatorio", "recuperacion")).toBe("recuperacion");
    expect(campanaTrasBorrar([resumen("sola")], "sola", "sola")).toBeNull();
  });

  test("la plantilla en blanco conserva identidad, firma y pie; no hereda el preset", () => {
    const blanco = plantillaEnBlanco(PLANTILLA, "Correo nuevo");
    expect(blanco.preset_id).toBeUndefined();
    expect(blanco.title).toBe("Correo nuevo");
    expect(blanco.header).toEqual(PLANTILLA.header);
    expect(blanco.fields).toEqual(PLANTILLA.fields);
    expect(blanco.blocks.map((b) => b.block_id)).toEqual(["saludo", "mensaje", "firma", "pie"]);
    // Un saludo sin campo no necesita respaldo.
    expect(blanco.blocks[0]).toEqual({ block_id: "saludo", type: "greeting", text: "Estimado(a):" });
  });
});

describe("borrar en dos pasos", () => {
  test("paso 1 avisa; paso 2 sólo habilita con el nombre exacto", () => {
    let fase: FaseDelBorrado = BORRADO_INICIAL;
    expect(nombreConfirmado(fase, "Recuperación")).toBe(false);
    // En el paso 1 no se puede enviar ni escribir.
    expect(reducirBorrado(fase, { type: "enviar" })).toBe(fase);
    expect(reducirBorrado(fase, { type: "escribir", texto: "x" })).toBe(fase);

    fase = reducirBorrado(fase, { type: "continuar" });
    expect(fase).toEqual({ paso: "nombre", escrito: "", error: "" });
    for (const casi of ["recuperación", "Recuperacion", "Recuperación ", ""]) {
      expect(nombreConfirmado(reducirBorrado(fase, { type: "escribir", texto: casi }), "Recuperación")).toBe(false);
    }
    fase = reducirBorrado(fase, { type: "escribir", texto: "Recuperación" });
    expect(nombreConfirmado(fase, "Recuperación")).toBe(true);

    fase = reducirBorrado(fase, { type: "enviar" });
    expect(fase).toEqual({ paso: "borrando", escrito: "Recuperación" });
    // Mientras borra, el botón no vuelve a habilitarse.
    expect(nombreConfirmado(fase, "Recuperación")).toBe(false);

    // El backend rechaza (confirm_name distinto): vuelve al paso 2 con lo escrito y el aviso.
    fase = reducirBorrado(fase, { type: "fallo", mensaje: "El nombre escrito no coincide." });
    expect(fase).toEqual({ paso: "nombre", escrito: "Recuperación", error: "El nombre escrito no coincide." });
    // Escribir limpia el aviso; «Atrás» vuelve al paso 1; cerrar reinicia.
    expect(reducirBorrado(fase, { type: "escribir", texto: "R" })).toEqual({ paso: "nombre", escrito: "R", error: "" });
    expect(reducirBorrado(fase, { type: "volver" })).toBe(BORRADO_INICIAL);
    expect(reducirBorrado(fase, { type: "reiniciar" })).toBe(BORRADO_INICIAL);
  });
});
