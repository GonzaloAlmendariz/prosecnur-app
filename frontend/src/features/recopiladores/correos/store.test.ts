import { beforeEach, describe, expect, test } from "vitest";

import type { MailRecipients, MailTemplate } from "../../../api/materialMail";
import { CABECERA, SOBRE } from "./modeloCorreo";
import { hayCambios, useCorreosStore } from "./store";

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
    columns: ["Correo", "Nombre"],
    mapping: { email_column: "Correo", name_column: "Nombre", name_format: "nombre", fields: {} },
    counts: { total: valid, valid, without_email: 0, invalid_email: 0, duplicated: 0, names_unsplit: 0 },
    sample: [],
  };
}

const SIN_LISTA: MailRecipients = {
  loaded: false, file_name: null, imported_at: null, row_count: 0, columns: [], mapping: null, counts: null, sample: [],
};

const st = () => useCorreosStore.getState();

beforeEach(() => {
  st().reiniciar();
});

describe("store del editor de correos", () => {
  test("la carga deja borrador = guardada y elige a la primera persona si hay lista", () => {
    st().cargaLista({ presets: [], plantilla: { state_revision: 7, builtin: false, template: plantilla() }, destinatarios: destinatarios(3) });
    expect(st().carga).toBe("lista");
    expect(st().stateRevision).toBe(7);
    expect(st().persona).toBe(1);
    expect(hayCambios(st())).toBe(false);

    st().cargaLista({ presets: [], plantilla: { state_revision: 7, builtin: true, template: plantilla() }, destinatarios: SIN_LISTA });
    expect(st().persona).toBeNull();
  });

  test("editar marca cambios y descarta la exportación anterior", () => {
    st().cargaLista({ presets: [], plantilla: { state_revision: 1, builtin: false, template: plantilla() }, destinatarios: SIN_LISTA });
    st().setExportacion({ artifacts: [], zip: null, review: null, manifest: null });
    st().editar((t) => ({ ...t, subject: "Otro" }));
    expect(hayCambios(st())).toBe(true);
    expect(st().exportacion).toBeNull();
  });

  test("guardar adopta lo que devolvió el backend y conserva lo editado mientras tanto", () => {
    st().cargaLista({ presets: [], plantilla: { state_revision: 1, builtin: true, template: plantilla() }, destinatarios: SIN_LISTA });
    const enviado = { ...plantilla(), subject: "Nuevo" };
    st().editar(() => enviado);
    st().guardado({ noop: false, state_revision: 2, template: { ...enviado, revision: 2, template_sha256: "sha256:n" } });
    expect(st().stateRevision).toBe(2);
    expect(st().builtin).toBe(false);
    expect(hayCambios(st())).toBe(false);

    // Si se siguió escribiendo durante el PUT, eso no se pierde.
    st().editar((t) => ({ ...t, subject: "Nuevo y más" }));
    st().guardado({ noop: false, state_revision: 3, template: { ...enviado, revision: 3 } });
    expect(st().borrador?.subject).toBe("Nuevo y más");
    expect(st().borrador?.revision).toBe(3);
    expect(hayCambios(st())).toBe(true);
  });

  test("siguiente persona da la vuelta y no se mueve sin lista", () => {
    st().cargaLista({ presets: [], plantilla: { state_revision: 1, builtin: false, template: plantilla() }, destinatarios: SIN_LISTA });
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
    st().cargaLista({ presets: [], plantilla: { state_revision: 1, builtin: false, template: plantilla() }, destinatarios: destinatarios(5) });
    st().setPersona(5);
    st().setDestinatarios(destinatarios(2));
    expect(st().persona).toBe(1);
    st().setDestinatarios(SIN_LISTA);
    expect(st().persona).toBeNull();
  });

  test("reemplazar el borrador por un preset conserva una selección que siga existiendo", () => {
    st().cargaLista({ presets: [], plantilla: { state_revision: 1, builtin: false, template: plantilla() }, destinatarios: SIN_LISTA });
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
      mode: "preview", html: "<p/>", subject: "", preheader: "", bytes: 4,
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
});
