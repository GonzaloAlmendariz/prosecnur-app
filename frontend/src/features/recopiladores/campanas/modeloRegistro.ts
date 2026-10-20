// modeloRegistro.ts — las campañas de Material de campo sin React (ADR 0111).
//
// Una campaña es la entidad de primer nivel del módulo: tiene un tipo cerrado
// (`aulas`, `territorial`, `correo`), un nombre y sus propios elementos. Aquí
// vive lo que puede equivocarse sin pantalla: qué id tiene cada una, cuáles se
// ven en la lista y cuáles están archivadas, qué tipos se pueden crear y qué
// dice la tarjeta de cada una.

import type { MailCampaignSummary } from "../../../api/materialMail";
import type {
  CampanaMaterial,
  DisponibilidadDeTipo,
  EstadoCampanaCorreo,
  RegistroDeCampanas,
  TipoDeCampana,
} from "../../../api/materialCampanas";
import { NOMBRE_DE_PLATAFORMA } from "../correos/dialectos";

/** La única campaña de aulas mientras `collection_state` sea singular (ADR 0111 §6). */
export const ID_CAMPANA_AULAS = "aulas.principal";
export const NOMBRE_CAMPANA_AULAS = "Campo en aulas";

/** El motivo de `territorial` hasta que exista E2 (`ump_territorial_v1`). */
export const MOTIVO_TERRITORIAL = "Requiere leer las UMP de Hojas de ruta";

export const ROTULO_DEL_TIPO: Readonly<Record<TipoDeCampana, string>> = {
  aulas: "Campo en aulas",
  territorial: "Territorial",
  correo: "Correo",
};

/** Qué es cada tipo, en una línea, para «Nueva campaña». */
export const QUE_ES_EL_TIPO: Readonly<Record<TipoDeCampana, string>> = {
  aulas: "Fichas con QR por curso-horario, accesos, paquetes y entrega a Monitoreo.",
  territorial: "Material por UMP para el recorrido en campo.",
  correo: "Un correo para un grupo, con sus envíos, para Mailchimp o SurveyMonkey.",
};

export function idDeCorreo(campaignId: string): string {
  return `correo.${campaignId}`;
}

/** El `campaign_id` de mail-* que nombra una campaña de correo; `null` si no es de correo. */
export function refDeCorreo(id: string | null | undefined): string | null {
  if (!id || !id.startsWith("correo.")) return null;
  const ref = id.slice("correo.".length);
  return ref ? ref : null;
}

export function tipoDelId(id: string | null | undefined): TipoDeCampana | null {
  const prefijo = (id ?? "").split(".")[0];
  return prefijo === "aulas" || prefijo === "territorial" || prefijo === "correo" ? prefijo : null;
}

/** Las que se ven en la lista: todas menos las archivadas, en el orden del registro. */
export function campanasVisibles(registro: Pick<RegistroDeCampanas, "campaigns">): CampanaMaterial[] {
  return registro.campaigns.filter((c) => !c.archived);
}

export function campanasArchivadas(registro: Pick<RegistroDeCampanas, "campaigns">): CampanaMaterial[] {
  return registro.campaigns.filter((c) => c.archived);
}

export function campanaPorId(registro: Pick<RegistroDeCampanas, "campaigns">, id: string | null | undefined): CampanaMaterial | null {
  if (!id) return null;
  return registro.campaigns.find((c) => c.id === id) ?? null;
}

export function disponibilidadDe(registro: Pick<RegistroDeCampanas, "tipos">, tipo: TipoDeCampana): DisponibilidadDeTipo {
  return registro.tipos.find((t) => t.tipo === tipo) ?? { tipo, disponible: false, motivo: null };
}

/**
 * La campaña de aulas que todavía no existe pero se puede abrir: la que nace
 * al elegir «Nueva campaña › Campo en aulas» y se completa sembrando el plan
 * desde Unidades. Sólo mientras el tipo esté disponible (no hay otra).
 */
export function campanaAulasNaciente(): CampanaMaterial {
  return {
    id: ID_CAMPANA_AULAS,
    tipo: "aulas",
    name: NOMBRE_CAMPANA_AULAS,
    actor: "",
    created_at: null,
    archived: false,
    persisted: false,
    ref: "principal",
    estado: null,
  };
}

// ---------------------------------------------------------------------------
// Los correos vivos
// ---------------------------------------------------------------------------

/** Una campaña de correo proyectada de su resumen de `mail-campaigns`. */
export function campanaDeCorreo(c: MailCampaignSummary): CampanaMaterial {
  return {
    id: idDeCorreo(c.campaign_id),
    tipo: "correo",
    name: c.name,
    actor: c.actor,
    created_at: null,
    archived: false,
    persisted: false,
    ref: c.campaign_id,
    estado: {
      tipo: "correo",
      platform: c.platform,
      envios: c.sends.length,
      bloques: c.blocks,
      recipients_loaded: c.recipients_loaded,
      envios_detalle: c.sends.map((s) => ({ send_id: s.send_id, label: s.label, last_export_at: null, last_export_platform: null })),
    },
  };
}

/**
 * El registro con los correos que el store tiene AHORA.
 *
 * Los dos leen la misma fuente (`mail_campaigns`), pero el store se escribe en
 * el acto al crear, duplicar, renombrar o borrar, y el registro se relee
 * después. Sin esto, abrir el correo recién creado caería en la lista porque
 * el registro todavía no lo conoce. Del registro se conserva lo que sólo él
 * sabe: la fecha de creación y la última exportación de cada envío.
 */
export function conCorreosVivos(registro: RegistroDeCampanas, correos: readonly MailCampaignSummary[]): RegistroDeCampanas {
  const vivos = new Map(correos.map((c) => [idDeCorreo(c.campaign_id), c]));
  const vistos = new Set<string>();
  const campaigns: CampanaMaterial[] = [];
  for (const campana of registro.campaigns) {
    if (campana.tipo !== "correo") {
      campaigns.push(campana);
      continue;
    }
    const vivo = vivos.get(campana.id);
    if (!vivo) continue;
    vistos.add(campana.id);
    const proyectada = campanaDeCorreo(vivo);
    const previo = campana.estado?.tipo === "correo" ? campana.estado.envios_detalle : [];
    const detalle = new Map(previo.map((e) => [e.send_id, e]));
    campaigns.push({
      ...campana,
      name: vivo.name,
      actor: vivo.actor,
      estado: proyectada.estado && proyectada.estado.tipo === "correo"
        ? {
          ...proyectada.estado,
          envios_detalle: proyectada.estado.envios_detalle.map((e) => {
            const anterior = detalle.get(e.send_id);
            return anterior ? { ...e, last_export_at: anterior.last_export_at, last_export_platform: anterior.last_export_platform } : e;
          }),
        }
        : proyectada.estado,
    });
  }
  for (const c of correos) {
    const id = idDeCorreo(c.campaign_id);
    if (!vistos.has(id)) campaigns.push(campanaDeCorreo(c));
  }
  return { ...registro, campaigns };
}

/** El registro con una campaña recién escrita por el servidor (reemplaza o agrega). */
export function ponerEnRegistro(registro: RegistroDeCampanas, campana: CampanaMaterial, registryRevision: number | null): RegistroDeCampanas {
  const existe = registro.campaigns.some((c) => c.id === campana.id);
  const campaigns = existe ? registro.campaigns.map((c) => (c.id === campana.id ? campana : c)) : [...registro.campaigns, campana];
  const tipos = campana.tipo === "aulas"
    ? registro.tipos.map((t) => (t.tipo === "aulas" ? { ...t, disponible: false, motivo: t.motivo ?? "El proyecto ya tiene su campaña de aulas." } : t))
    : registro.tipos;
  return { ...registro, campaigns, tipos, registry_revision: registryRevision ?? registro.registry_revision };
}

/** Cuándo se exportó cada envío de un correo (`send_id` → ISO); vacío si no es un correo (F16). */
export function exportadosDe(campana: CampanaMaterial): Record<string, string> {
  if (campana.estado?.tipo !== "correo") return {};
  return Object.fromEntries(
    campana.estado.envios_detalle.flatMap((e) => (e.last_export_at ? [[e.send_id, e.last_export_at] as const] : [])),
  );
}

/** Marca la exportación de un envío en la tarjeta, sin releer el registro (`export_recorded`). */
export function conExportacion(
  registro: RegistroDeCampanas,
  campanaId: string,
  envio: { send_id: string; last_export_at: string | null; last_export_platform: EstadoCampanaCorreo["envios_detalle"][number]["last_export_platform"] },
): RegistroDeCampanas {
  return {
    ...registro,
    campaigns: registro.campaigns.map((c) => {
      if (c.id !== campanaId || c.estado?.tipo !== "correo") return c;
      return {
        ...c,
        estado: {
          ...c.estado,
          envios_detalle: c.estado.envios_detalle.map((e) => (e.send_id === envio.send_id
            ? { ...e, last_export_at: envio.last_export_at, last_export_platform: envio.last_export_platform }
            : e)),
        },
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// La tarjeta
// ---------------------------------------------------------------------------

export type TonoDeCampana = "neutral" | "activo" | "listo" | "aviso";

export type ResumenDeTarjeta = {
  /** «En preparación», «Entregada a Monitoreo», «Exportada»… */
  estado: string;
  tono: TonoDeCampana;
  /** Barra de avance cuando el tipo tiene un denominador honesto. */
  avance: { actual: number; total: number; rotulo: string } | null;
  /** Los hechos que la barra no dice, uno por línea corta. */
  hechos: string[];
  /** Cifras grandes del dato real (aulas); una cifra sin dato no se pinta. */
  cifras: { valor: number; rotulo: string }[];
  /** Cada envío en su línea, con su estado (correo). */
  envios: { label: string; exportado: boolean; texto: string }[];
};

/** «20/10»: día y mes con dos cifras, sin depender del ICU del entorno. */
function fechaCorta(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}`;
}

const formato = new Intl.NumberFormat("es-PE");

/** El estado del despliegue dicho como avance de la campaña, no como estado del motor. */
const ESTADO_DE_LOS_ACCESOS: Readonly<Record<string, string>> = {
  draft: "Accesos en borrador",
  prepared: "Accesos preparados",
  handed_off: "Entregada a Monitoreo",
  stale: "Accesos desactualizados",
};

/**
 * «Invitación exportada 02/09 · Recordatorio 1 pendiente» (ADR 0111 §8): cada
 * envío dice si ya salió de la app. Sin detalle por envío no se inventa nada.
 */
export function lineaDeEnvios(estado: Pick<EstadoCampanaCorreo, "envios_detalle">): string | null {
  if (!estado.envios_detalle.length) return null;
  return estado.envios_detalle
    .map((e) => {
      const cuando = e.last_export_at ? fechaCorta(e.last_export_at) : null;
      return cuando ? `${e.label} exportada ${cuando}` : `${e.label} pendiente`;
    })
    .join(" · ");
}

export function resumenDeTarjeta(campana: CampanaMaterial): ResumenDeTarjeta {
  const estado = campana.estado;
  if (campana.tipo === "aulas") {
    if (!estado || estado.tipo !== "aulas" || estado.unidades === 0) {
      return { estado: "Por iniciar", tono: "neutral", avance: null, hechos: ["Siembra las unidades desde la muestra decidida"], cifras: [], envios: [] };
    }
    // El avance se mide sobre titulares, como en el inicio del proyecto. Sin
    // titulares en el plan no hay denominador honesto: no se dibuja barra.
    const total = estado.titulares;
    const status = estado.deployment_status;
    const entregada = status === "handed_off";
    const tono: TonoDeCampana = estado.plan_desfasado || status === "stale"
      ? "aviso"
      : entregada ? "listo" : "activo";
    // Las unidades van como cifra; aquí sólo lo que la cifra no dice.
    const hechos = estado.plan_desfasado ? ["El plan no es el del sorteo vigente"] : [];
    // Titulares y con enlace sólo con titulares de verdad: un 0 por defecto
    // del motor no es una cifra (y «0 con enlace» sobre él sería falso).
    const cifras = [
      { valor: estado.unidades, rotulo: "unidades" },
      ...(total > 0 ? [{ valor: total, rotulo: "titulares" }, { valor: Math.min(estado.con_enlace, total), rotulo: "con enlace" }] : []),
    ];
    return {
      cifras,
      envios: [],
      estado: ESTADO_DE_LOS_ACCESOS[status] ?? "Accesos sin preparar",
      tono,
      avance: total > 0 ? { actual: Math.min(estado.con_enlace, total), total, rotulo: "titulares con enlace" } : null,
      hechos,
    };
  }
  if (campana.tipo === "correo") {
    if (!estado || estado.tipo !== "correo") {
      return { estado: "En preparación", tono: "activo", avance: null, hechos: [], cifras: [], envios: [] };
    }
    const exportados = estado.envios_detalle.filter((e) => e.last_export_at).length;
    const todos = estado.envios_detalle.length > 0 && exportados === estado.envios_detalle.length;
    // Los envíos van uno por línea con su estado; aquí, la salida y el tamaño.
    const hechos = [`Sale por ${NOMBRE_DE_PLATAFORMA[estado.platform]} · ${estado.bloques} ${estado.bloques === 1 ? "bloque" : "bloques"}`];
    const envios = estado.envios_detalle.map((e) => {
      const cuando = e.last_export_at ? fechaCorta(e.last_export_at) : null;
      return { label: e.label, exportado: Boolean(cuando), texto: cuando ? `exportado ${cuando}` : "pendiente" };
    });
    return {
      cifras: [],
      envios,
      estado: todos ? "Exportada" : exportados ? "Exportada en parte" : "En preparación",
      tono: todos ? "listo" : "activo",
      avance: null,
      hechos,
    };
  }
  return { estado: "No disponible", tono: "neutral", avance: null, hechos: [], cifras: [], envios: [] };
}

/** «3 campañas», «1 campaña», para el contexto de la barra. */
export function cuentaDeCampanas(n: number): string {
  return `${formato.format(n)} ${n === 1 ? "campaña" : "campañas"}`;
}
