import { describe, expect, it } from "vitest";

import { normalizarRegistroDeCampanas } from "../../../api/materialCampanas";
import { REGISTRO_CRUDO } from "../../../api/materialCampanas.fixture";
import type { MailCampaignSummary } from "../../../api/materialMail";
import type { CollectionStatePayload } from "../../../api/recopiladores";
import { MOTIVO_AULAS_UNICA, registroDerivado } from "./derivacionTemporal";
import {
  campanasArchivadas,
  campanasVisibles,
  cuentaDeCampanas,
  lineaDeEnvios,
  refDeCorreo,
  resumenDeTarjeta,
  tipoDelId,
} from "./modeloRegistro";

const REGISTRO = normalizarRegistroDeCampanas(REGISTRO_CRUDO);

function correo(id: string, extra: Partial<MailCampaignSummary> = {}): MailCampaignSummary {
  return {
    campaign_id: id,
    name: `Correo ${id}`,
    actor: "",
    platform: "mailchimp",
    sends: [{ send_id: "invitacion", kind: "invitacion", label: "Invitación" }],
    preset_id: null,
    subject: "",
    blocks: 5,
    template_revision: 1,
    template_sha256: null,
    updated_at: null,
    recipients_loaded: false,
    ...extra,
  };
}

function estadoConPlan(): CollectionStatePayload {
  return {
    ok: true,
    seed_available: true,
    schema: "collection_state/v1",
    state_revision: 9,
    plan: {
      schema: "collection_plan/v1",
      plan_id: "p",
      adapter: { id: "aulas_v1", version: 1 },
      source_ref: { module: "calc", run_id: "r", fingerprint: "f" },
      instrument_ref: { revision_id: "i", sha256: "s" },
      unit_type: "curso_horario",
      units: [
        { unit_id: "u1", label: "A", role: "titular" },
        { unit_id: "u2", label: "B", role: "titular" },
        { unit_id: "u3", label: "C", role: "reserva" },
      ],
      revision: 1,
      input_fingerprint: "x",
    },
    deployment: null,
    state: {
      schema: "collection_state/v1",
      state_revision: 9,
      plan: null,
      deployment: null,
    },
  } as unknown as CollectionStatePayload;
}

describe("el registro y sus listas", () => {
  it("separa las visibles de las archivadas", () => {
    const conArchivada = { campaigns: REGISTRO.campaigns.map((c, i) => (i === 0 ? { ...c, archived: true } : c)) };
    expect(campanasVisibles(conArchivada).map((c) => c.id)).toEqual(["correo.egresados"]);
    expect(campanasArchivadas(conArchivada).map((c) => c.id)).toEqual(["aulas.principal"]);
  });

  it("lee tipo y ref del id", () => {
    expect(tipoDelId("aulas.principal")).toBe("aulas");
    expect(tipoDelId("panel.x")).toBeNull();
    expect(refDeCorreo("correo.egresados")).toBe("egresados");
    expect(refDeCorreo("aulas.principal")).toBeNull();
    expect(refDeCorreo("correo.")).toBeNull();
  });

  it("cuenta en castellano", () => {
    expect(cuentaDeCampanas(1)).toBe("1 campaña");
    expect(cuentaDeCampanas(3)).toBe("3 campañas");
  });
});

describe("la tarjeta dice lo que la campaña tiene", () => {
  it("aulas: titulares con enlace sobre titulares y el estado de los accesos", () => {
    const r = resumenDeTarjeta(REGISTRO.campaigns[0]);
    expect(r.estado).toBe("Accesos preparados");
    expect(r.avance).toEqual({ actual: 120, total: 175, rotulo: "titulares con enlace" });
    expect(r.hechos).toEqual([]);
    expect(r.cifras).toEqual([
      { valor: 2468, rotulo: "unidades" },
      { valor: 175, rotulo: "titulares" },
      { valor: 120, rotulo: "con enlace" },
    ]);
  });

  it("aulas sin titulares en el plan: el estado y las unidades, sin barra sobre un denominador falso", () => {
    const base = REGISTRO.campaigns[0];
    const r = resumenDeTarjeta({ ...base, estado: { tipo: "aulas", unidades: 2373, titulares: 0, con_enlace: 0, deployment_status: "prepared", plan_desfasado: false } });
    expect(r.avance).toBeNull();
    expect(r.estado).toBe("Accesos preparados");
    // Titulares en 0 por el defecto del motor: sólo la cifra que existe.
    expect(r.cifras).toEqual([{ valor: 2373, rotulo: "unidades" }]);
  });

  it("aulas sin unidades: por iniciar, sin barra inventada", () => {
    const r = resumenDeTarjeta({ ...REGISTRO.campaigns[0], estado: null });
    expect(r.estado).toBe("Por iniciar");
    expect(r.avance).toBeNull();
  });

  it("aulas con el plan desfasado avisa", () => {
    const base = REGISTRO.campaigns[0];
    const r = resumenDeTarjeta({ ...base, estado: { ...(base.estado as Extract<typeof base.estado, { tipo: "aulas" }>), plan_desfasado: true } });
    expect(r.tono).toBe("aviso");
    expect(r.hechos).toContain("El plan no es el del sorteo vigente");
  });

  it("correo: plataforma, envíos, bloques y qué envío ya salió (ADR 0111 §8)", () => {
    const r = resumenDeTarjeta(REGISTRO.campaigns[1]);
    expect(r.estado).toBe("Exportada en parte");
    expect(r.hechos).toEqual(["Sale por Mailchimp · 7 bloques"]);
    expect(r.envios).toEqual([
      { label: "Invitación", exportado: true, texto: "exportado 02/09" },
      { label: "Recordatorio 1", exportado: false, texto: "pendiente" },
    ]);
  });

  it("sin detalle por envío no se inventa la línea", () => {
    expect(lineaDeEnvios({ envios_detalle: [] })).toBeNull();
  });
});

describe("derivación temporal (mientras no exista GET campaigns)", () => {
  it("sin plan ni correos: lista vacía, aulas y correo creables, territorial con su motivo", () => {
    const r = registroDerivado({ estado: null, correos: [], revisionDeCorreos: 3 });
    expect(r.campaigns).toEqual([]);
    expect(r.state_revision).toBe(3);
    expect(r.tipos).toEqual([
      { tipo: "aulas", disponible: true, motivo: null },
      { tipo: "territorial", disponible: false, motivo: "Requiere leer las UMP de Hojas de ruta" },
      { tipo: "correo", disponible: true, motivo: null },
    ]);
  });

  it("con plan: `aulas.principal` con su avance y el tipo aulas deja de estar disponible", () => {
    const payload = estadoConPlan();
    payload.state = {
      ...payload.state,
      plan: (payload as unknown as { plan: CollectionStatePayload["state"]["plan"] }).plan,
      deployment: { status: "prepared", bindings: [{ unit_id: "u1" }, { unit_id: "u3" }] } as unknown as CollectionStatePayload["state"]["deployment"],
    };
    const r = registroDerivado({ estado: payload, correos: [correo("a")], revisionDeCorreos: null });
    expect(r.campaigns.map((c) => c.id)).toEqual(["aulas.principal", "correo.a"]);
    expect(r.campaigns[0].estado).toEqual({
      tipo: "aulas", unidades: 3, titulares: 2, con_enlace: 1, deployment_status: "prepared", plan_desfasado: false,
    });
    expect(r.tipos[0]).toEqual({ tipo: "aulas", disponible: false, motivo: MOTIVO_AULAS_UNICA });
    expect(r.state_revision).toBe(9);
  });

  it("un correo se proyecta con sus envíos y sin exportación inventada", () => {
    const r = registroDerivado({
      estado: null,
      correos: [correo("egresados", { platform: "surveymonkey", recipients_loaded: true })],
      revisionDeCorreos: 1,
    });
    expect(r.campaigns[0]).toMatchObject({
      id: "correo.egresados",
      tipo: "correo",
      ref: "egresados",
      estado: { platform: "surveymonkey", envios: 1, bloques: 5, recipients_loaded: true, envios_detalle: [{ send_id: "invitacion", label: "Invitación", last_export_at: null, last_export_platform: null }] },
    });
  });

  it("con 20 correos el tipo correo se cierra con su motivo", () => {
    const r = registroDerivado({ estado: null, correos: Array.from({ length: 20 }, (_, i) => correo(`c${i}`)), revisionDeCorreos: 1 });
    expect(r.tipos[2].disponible).toBe(false);
    expect(r.tipos[2].motivo).toContain("20");
  });
});

describe("la miniatura del correo es su imagen real", () => {
  it("el banner con URL pública; si no, la primera imagen del cuerpo; si no, nada", async () => {
    const { miniaturaDeLaPlantilla } = await import("./miniaturaDeCorreo");
    const base = { blocks: [], images: { b: { alt: "Banner", url: "https://x.org/b.png" } } };
    expect(miniaturaDeLaPlantilla({ ...base, header: { kind: "banner", image_ref: "b" } })).toEqual({ url: "https://x.org/b.png", alt: "Banner" });
    expect(miniaturaDeLaPlantilla({
      header: { kind: "logos", logo_ids: [], background: "light" },
      images: { i: { alt: "Foto", url: "https://x.org/i.png" } },
      blocks: [{ block_id: "img", type: "image", image_ref: "i" } as never],
    })?.url).toBe("https://x.org/i.png");
    // Sin URL pública (imagen por subir) no se inventa una miniatura.
    expect(miniaturaDeLaPlantilla({ header: { kind: "banner", image_ref: "b" }, images: { b: { alt: "x" } }, blocks: [] })).toBeNull();
  });
});
