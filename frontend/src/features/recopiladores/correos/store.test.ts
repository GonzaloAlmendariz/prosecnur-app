import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { mailSendInvitation } from "../../../api/materialMail";
import type { MailRecipients, MailTemplate } from "../../../api/materialMail";
import { CABECERA, SOBRE } from "./modeloCorreo";
import { hayCambios, hayQueGuardar, useCorreosStore } from "./store";

function plantilla(over: Partial<MailTemplate> = {}): MailTemplate {
  return {
    schema: "collection_mail_template/v1",
    template_id: "correo",
    revision: 1,
    subject: "Asunto",
    preheader: "",
    theme: { accent: "#0b1f54" },
    header: { kind: "logos", logo_ids: ["pulso"], background: "dark" },
    images: { pulso: { alt: "Pulso" } },
    fields: [],
    blocks: [
      { block_id: "saludo", type: "greeting", text: "Hola {{nombre}}", fallback: "Hola" },
      { block_id: "p", type: "paragraph", text: "Texto" },
    ],
    ...over,
  };
}

function destinatarios(valid: number): MailRecipients {
  return {
    loaded: true,
    file_name: "lista.csv",
    imported_at: "2026-10-16T18:00:00Z",
    row_count: valid,
    encoding: "utf-8",
    columns: ["Correo", "Nombre"],
    mapping: { email_column: "Correo", name_column: "Nombre", name_format: "nombre", fields: {} },
    counts: { total: valid, valid, without_email: 0, invalid_email: 0, duplicated: 0, names_unsplit: 0, duplicated_conflicting: 0, persons_with_any_empty: 0, rows_blank_dropped: 0 },
    sample: [],
  };
}

const SIN_LISTA: MailRecipients = {
  loaded: false, file_name: null, imported_at: null, row_count: 0, encoding: null, columns: [], mapping: null, counts: null, sample: [],
};

const st = () => useCorreosStore.getState();

beforeEach(() => {
  st().reiniciar();
});

describe("store del editor de correos", () => {
  test("la carga deja borrador = guardada y elige a la primera persona si hay lista", () => {
    st().cargaLista({ presets: [], plantilla: { state_revision: 7, builtin: false, platform: "mailchimp", sends: [mailSendInvitation()], template: plantilla(), stored_problems: [] }, destinatarios: destinatarios(3) });
    expect(st().carga).toBe("lista");
    expect(st().stateRevision).toBe(7);
    expect(st().persona).toBe(1);
    expect(hayCambios(st())).toBe(false);

    st().cargaLista({ presets: [], plantilla: { state_revision: 7, builtin: true, platform: "mailchimp", sends: [mailSendInvitation()], template: plantilla(), stored_problems: [] }, destinatarios: SIN_LISTA });
    expect(st().persona).toBeNull();
  });

  test("editar marca cambios y descarta la exportación anterior", () => {
    st().cargaLista({ presets: [], plantilla: { state_revision: 1, builtin: false, platform: "mailchimp", sends: [mailSendInvitation()], template: plantilla(), stored_problems: [] }, destinatarios: SIN_LISTA });
    st().setExportacion({ platform: "mailchimp", send_id: null, html: null, artifacts: [], zip: null, review: null, manifest: null });
    st().editar((t) => ({ ...t, subject: "Otro" }));
    expect(hayCambios(st())).toBe(true);
    expect(st().exportacion).toBeNull();
  });

  test("guardar adopta lo que devolvió el backend y conserva lo editado mientras tanto", () => {
    st().cargaLista({ presets: [], plantilla: { state_revision: 1, builtin: true, platform: "mailchimp", sends: [mailSendInvitation()], template: plantilla(), stored_problems: [] }, destinatarios: SIN_LISTA });
    const enviado = { ...plantilla(), subject: "Nuevo" };
    st().editar(() => enviado);
    st().guardado({ noop: false, sends: [mailSendInvitation()], send_warnings: [], state_revision: 2, template: { ...enviado, revision: 2, template_sha256: "sha256:n" } });
    expect(st().stateRevision).toBe(2);
    expect(st().builtin).toBe(false);
    expect(hayCambios(st())).toBe(false);

    // Si se siguió escribiendo durante el PUT, eso no se pierde.
    st().editar((t) => ({ ...t, subject: "Nuevo y más" }));
    st().guardado({ noop: false, sends: [mailSendInvitation()], send_warnings: [], state_revision: 3, template: { ...enviado, revision: 3 } });
    expect(st().borrador?.subject).toBe("Nuevo y más");
    expect(st().borrador?.revision).toBe(3);
    expect(hayCambios(st())).toBe(true);
  });

  test("guardar sin editar durante el PUT deja el correo guardado aunque el backend normalice (F6)", () => {
    st().cargaLista({ presets: [], plantilla: { state_revision: 1, builtin: false, platform: "surveymonkey", sends: [mailSendInvitation()], template: plantilla(), stored_problems: [] }, destinatarios: SIN_LISTA });
    // El saludo por sexo se escribe con sus claves en un orden; el backend lo devuelve en otro y con su ranura.
    const enviada = plantilla({ blocks: [{ block_id: "saludo", type: "greeting", text: "Estimado(a) {{nombre}}", trato: { modo: "por_sexo", masculino: "Estimado", femenino: "Estimada", respaldo: "Estimado(a)", columna: "sexo" } }] });
    st().editar(() => enviada);
    expect(hayCambios(st())).toBe(true);
    const devuelta = plantilla({ revision: 2, blocks: [{ type: "greeting", text: "Estimado(a) {{nombre}}", block_id: "saludo", trato: { columna: "sexo", respaldo: "Estimado(a)", femenino: "Estimada", masculino: "Estimado", modo: "por_sexo", sm: "CustomData1" } }] });
    st().guardado({ noop: false, sends: [mailSendInvitation()], send_warnings: [], state_revision: 2, template: devuelta }, [mailSendInvitation()], enviada);
    expect(hayCambios(st())).toBe(false);
    expect(st().borrador).toEqual(devuelta);
  });

  test("siguiente persona da la vuelta y no se mueve sin lista", () => {
    st().cargaLista({ presets: [], plantilla: { state_revision: 1, builtin: false, platform: "mailchimp", sends: [mailSendInvitation()], template: plantilla(), stored_problems: [] }, destinatarios: SIN_LISTA });
    st().siguientePersona();
    expect(st().persona).toBeNull();
    st().setDestinatarios(destinatarios(2));
    expect(st().persona).toBe(1);
    st().siguientePersona();
    expect(st().persona).toBe(2);
    st().siguientePersona();
    expect(st().persona).toBe(1);
  });

  test("una lista más corta reubica a la persona; olvidarla vuelve al ejemplo", () => {
    st().cargaLista({ presets: [], plantilla: { state_revision: 1, builtin: false, platform: "mailchimp", sends: [mailSendInvitation()], template: plantilla(), stored_problems: [] }, destinatarios: destinatarios(5) });
    st().setPersona(5);
    st().setDestinatarios(destinatarios(2));
    expect(st().persona).toBe(1);
    st().setDestinatarios(SIN_LISTA);
    expect(st().persona).toBeNull();
  });

  test("reemplazar el borrador por un preset conserva una selección que siga existiendo", () => {
    st().cargaLista({ presets: [], plantilla: { state_revision: 1, builtin: false, platform: "mailchimp", sends: [mailSendInvitation()], template: plantilla(), stored_problems: [] }, destinatarios: SIN_LISTA });
    st().seleccionar("p");
    st().reemplazarBorrador(plantilla({ blocks: [{ block_id: "otro", type: "paragraph", text: "x" }] }));
    expect(st().seleccion).toBe(SOBRE);
    st().seleccionar(CABECERA);
    st().reemplazarBorrador(plantilla());
    expect(st().seleccion).toBe(CABECERA);
  });

  test("una vista previa correcta limpia los problemas; una fallida los conserva", () => {
    st().setProblemas([{ path: "template.subject", code: "missing_text", detail: "Falta" }]);
    st().vistaPreviaFallo("422");
    expect(st().problemas).toHaveLength(1);
    st().vistaPreviaLista({
      mode: "preview", platform: "mailchimp", dialect: "mailchimp", send: null, html: "<p/>", subject: "", preheader: "", bytes: 4,
      recipient: { source: "synthetic", index: null, nombre: "Ana", fields: {} },
    });
    expect(st().problemas).toHaveLength(0);
    expect(st().vistaPreviaError).toBe("");
  });

  test("reiniciar olvida los destinatarios: nada sobrevive a la vista", () => {
    st().setDestinatarios(destinatarios(4));
    st().reiniciar();
    expect(st().destinatarios).toBeNull();
    expect(st().persona).toBeNull();
  });

  test("subir una imagen pide de nuevo la vista previa", () => {
    const antes = st().refresco;
    st().recordarImagen("pulso", "blob:1");
    expect(st().refresco).toBe(antes + 1);
    expect(st().imagenesLocales.pulso).toBe("blob:1");
  });

  describe("URLs locales de las imágenes", () => {
    afterEach(() => { vi.restoreAllMocks(); });

    test("reemplazar la imagen de un id revoca la anterior; salir de la vista revoca todas", () => {
      const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
      st().recordarImagen("pulso", "blob:a");
      st().recordarImagen("logo", "blob:b");
      expect(revoke).not.toHaveBeenCalled();
      st().recordarImagen("pulso", "blob:c");
      expect(revoke).toHaveBeenCalledWith("blob:a");
      st().reiniciar();
      expect(revoke).toHaveBeenCalledWith("blob:b");
      expect(revoke).toHaveBeenCalledWith("blob:c");
      expect(revoke).toHaveBeenCalledTimes(3);
      expect(st().imagenesLocales).toEqual({});
    });

    test("sólo se revoca lo que es un blob:", () => {
      const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
      st().recordarImagen("pulso", "https://x.org/p.png");
      st().reiniciar();
      expect(revoke).not.toHaveBeenCalled();
    });

    test("refrescar pide de nuevo la vista previa sin tocar las imágenes", () => {
      const antes = st().refresco;
      st().refrescar();
      expect(st().refresco).toBe(antes + 1);
    });
  });

  test("una plantilla guardada inválida pide guardar aunque el borrador no cambie", () => {
    st().cargaLista({
      presets: [],
      plantilla: { state_revision: 2, builtin: false, platform: "mailchimp", sends: [mailSendInvitation()], template: plantilla(), stored_problems: [{ path: "template.blocks[1].text", code: "missing_text", detail: "Falta." }] },
      destinatarios: SIN_LISTA,
    });
    expect(hayCambios(st())).toBe(false);
    expect(hayQueGuardar(st())).toBe(true);
    expect(st().problemas).toHaveLength(1);
    st().guardado({ noop: false, sends: [mailSendInvitation()], send_warnings: [], state_revision: 3, template: plantilla() });
    expect(hayQueGuardar(st())).toBe(false);
  });
});

describe("campañas en el store (E1h)", () => {
  test("la revisión que devuelve cada escritura no baja con una lectura tardía", () => {
    st().campanasLista([], 10);
    st().anotarRevision(12);
    st().cargaLista({ presets: [], plantilla: { state_revision: 11, builtin: false, platform: "mailchimp", sends: [mailSendInvitation()], template: plantilla(), stored_problems: [] }, destinatarios: SIN_LISTA });
    expect(st().stateRevision).toBe(12);
    st().guardado({ noop: false, sends: [mailSendInvitation()], send_warnings: [], state_revision: 13, template: plantilla({ revision: 2 }) });
    expect(st().stateRevision).toBe(13);
  });

  test("cambiar de campaña olvida la anterior y conserva lista, presets y revisión", () => {
    const campanas = [
      { campaign_id: "a", name: "A", actor: "", platform: "mailchimp" as const, sends: [], preset_id: null, subject: "", blocks: 2, template_revision: 1, template_sha256: null, updated_at: null, recipients_loaded: true },
    ];
    st().campanasLista(campanas, 20);
    st().reiniciarCampana("a");
    st().cargaLista({ presets: [], plantilla: { state_revision: 20, builtin: false, platform: "mailchimp", sends: [mailSendInvitation()], template: plantilla(), stored_problems: [] }, destinatarios: destinatarios(4) });
    st().editar((t) => ({ ...t, subject: "Sin guardar" }));
    st().seleccionar("p");
    st().setVista("telefono");
    st().setAvisoCampanas({ tono: "ok", texto: "Campaña creada." });

    st().reiniciarCampana("b");
    expect(st().campana).toBe("b");
    expect(st().borrador).toBeNull();
    expect(st().destinatarios).toBeNull();
    expect(st().seleccion).toBe(SOBRE);
    expect(st().carga).toBe("inicial");
    expect(st().campanas).toEqual(campanas);
    expect(st().stateRevision).toBe(20);
    expect(st().vista).toBe("telefono");
    expect(st().avisoCampanas?.texto).toBe("Campaña creada.");
  });
});
