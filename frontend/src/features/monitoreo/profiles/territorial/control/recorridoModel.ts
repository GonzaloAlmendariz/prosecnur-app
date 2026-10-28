import type { MonitoreoTerritorialDashboard, TerritorialResponseAuditRow } from "../../../../../api/client";
import { diaYMes, fmt, nombreDeDistrito, numeroDeUmp, rotuloDeAplicador } from "../rotulos";

/**
 * Control › Recorrido: el camino que registró Kobo. Un aplicador y un día a
 * la vez: sus formularios en orden de hora, cada uno con su GPS y la distancia
 * a SU manzana. Un mismo aplicador puede trabajar varias manzanas (y UMP) en
 * la jornada: la distancia y la línea de cada punto van a la manzana de ese
 * formulario, nunca a una manzana «del aplicador».
 *
 * Sale de `response_audit` del corte de Validación, que trae el GPS efectivo
 * (el que usa el motor tras reclasificar) y su distancia. Kobo sólo registra
 * formularios levantados: los intentos fallidos no tienen GPS aquí.
 */

export type TramoDeDistancia = "cerca" | "revision" | "lejos" | "sin-gps";
export type EstadoDelFormulario = "cuenta" | "observacion" | "no-cuenta";

export const ROTULO_DE_TRAMO: Record<TramoDeDistancia, string> = {
  cerca: "Hasta 150 m",
  revision: "De 150 a 300 m",
  lejos: "Más de 300 m",
  "sin-gps": "Sin GPS",
};

export const ROTULO_DEL_ESTADO: Record<EstadoDelFormulario, string> = {
  cuenta: "Cuenta",
  observacion: "En observación",
  "no-cuenta": "No cuenta",
};

export type FormularioDelRecorrido = {
  id: string;
  /** Orden dentro de la jornada del aplicador (1, 2, …). */
  orden: number;
  aplicador: string;
  fechaIso: string;
  hora: string;
  /** Clave de orden: fecha, hora completa e id. */
  momento: string;
  lat: number | null;
  lon: number | null;
  distanciaM: number | null;
  tramo: TramoDeDistancia;
  estado: EstadoDelFormulario;
  idManzana: string;
  manzana: string;
  zona: string;
  tipoManzana: string;
  ump: string;
  distrito: string;
  ubigeo: string;
  duracionMin: number | null;
};

export type ManzanaDeLaJornada = {
  idManzana: string;
  manzana: string;
  zona: string;
  tipo: string;
  ump: string;
  distrito: string;
  ubigeo: string;
  formularios: number;
};

export type JornadaDelAplicador = {
  fechaIso: string;
  rotulo: string;
  formularios: FormularioDelRecorrido[];
  /** Manzanas distintas que tocó en el día, en el orden en que llegó a cada una. */
  manzanas: ManzanaDeLaJornada[];
};

export type AplicadorDelRecorrido = {
  aplicador: string;
  formularios: number;
  /** Formularios a más de 150 m de su manzana. */
  lejos: number;
  jornadas: JornadaDelAplicador[];
};

export type ModeloRecorrido = {
  disponible: boolean;
  aplicadores: AplicadorDelRecorrido[];
};

function numero(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

export function tramoDeDistancia(metros: number | null, conGps: boolean): TramoDeDistancia {
  if (!conGps || metros == null) return "sin-gps";
  if (metros <= 150) return "cerca";
  if (metros <= 300) return "revision";
  return "lejos";
}

function estadoDe(fila: TerritorialResponseAuditRow): EstadoDelFormulario {
  if (fila.advance_valid === false || fila.validation_status === "no_defendible") return "no-cuenta";
  if (fila.observation_status === "en_observacion") return "observacion";
  return "cuenta";
}

function fechaDe(fila: TerritorialResponseAuditRow): string {
  return texto(fila.submission_date_iso) || texto(fila.submission_time).slice(0, 10);
}

function horaDe(fila: TerritorialResponseAuditRow): string {
  const cruda = texto(fila.submission_hour) || (texto(fila.submission_time).match(/(\d{1,2}:\d{2})/)?.[1] ?? "");
  const partes = cruda.match(/^(\d{1,2}):(\d{2})/);
  return partes ? `${partes[1].padStart(2, "0")}:${partes[2]}` : "";
}

function formularioDe(fila: TerritorialResponseAuditRow): Omit<FormularioDelRecorrido, "orden"> {
  const lat = numero(fila.gps_effective_lat ?? fila.lat);
  const lon = numero(fila.gps_effective_lon ?? fila.lon);
  const conGps = lat != null && lon != null;
  const distanciaM = numero(fila.gps_effective_distance_m ?? fila.distance_m);
  const distrito = texto(fila.advance_block_distrito) || texto(fila.distrito);
  const duracion = numero(fila.duration_seconds);
  return {
    id: texto(fila.response_id) || String(fila.row_index),
    aplicador: rotuloDeAplicador(fila.responsible_display || fila.pulso_code || fila.submitted_by),
    fechaIso: fechaDe(fila),
    hora: horaDe(fila),
    // La hora normalizada va antes que `submission_time`, cuyo formato varía
    // entre fuentes («11:44» quedaba antes que «07:49» al ordenar el texto crudo).
    momento: `${fechaDe(fila)} ${horaDe(fila).padStart(5, "0")} ${texto(fila.submission_time)} ${texto(fila.response_id)}`,
    lat: conGps ? lat : null,
    lon: conGps ? lon : null,
    distanciaM,
    tramo: tramoDeDistancia(distanciaM, conGps),
    estado: estadoDe(fila),
    idManzana: texto(fila.advance_block_id),
    manzana: texto(fila.advance_block_manzana),
    zona: texto(fila.advance_block_zona),
    tipoManzana: texto(fila.advance_block_type),
    ump: numeroDeUmp(fila.advance_block_ump || fila.declared_ump_normalized),
    distrito: distrito ? nombreDeDistrito(distrito) : "Sin distrito",
    ubigeo: texto(fila.advance_block_ubigeo) || texto(fila.ubigeo),
    duracionMin: duracion != null && duracion > 0 ? duracion / 60 : null,
  };
}

export function construirRecorrido(validacion: MonitoreoTerritorialDashboard | null | undefined): ModeloRecorrido {
  const filas = validacion?.response_audit ?? [];
  const porAplicador = new Map<string, Map<string, Array<Omit<FormularioDelRecorrido, "orden">>>>();
  for (const fila of filas) {
    const formulario = formularioDe(fila);
    if (!formulario.fechaIso) continue;
    const dias = porAplicador.get(formulario.aplicador) ?? new Map<string, Array<Omit<FormularioDelRecorrido, "orden">>>();
    dias.set(formulario.fechaIso, [...(dias.get(formulario.fechaIso) ?? []), formulario]);
    porAplicador.set(formulario.aplicador, dias);
  }

  const aplicadores: AplicadorDelRecorrido[] = [...porAplicador.entries()].map(([aplicador, dias]) => {
    const jornadas: JornadaDelAplicador[] = [...dias.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([fechaIso, delDia]) => {
        const formularios = [...delDia]
          .sort((a, b) => a.momento.localeCompare(b.momento))
          .map((formulario, indice) => ({ ...formulario, orden: indice + 1 }));
        const manzanas = new Map<string, ManzanaDeLaJornada>();
        for (const formulario of formularios) {
          const clave = formulario.idManzana || `sin-manzana:${formulario.ump}`;
          const previa = manzanas.get(clave);
          if (previa) previa.formularios += 1;
          else manzanas.set(clave, {
            idManzana: formulario.idManzana,
            manzana: formulario.manzana,
            zona: formulario.zona,
            tipo: formulario.tipoManzana,
            ump: formulario.ump,
            distrito: formulario.distrito,
            ubigeo: formulario.ubigeo,
            formularios: 1,
          });
        }
        return { fechaIso, rotulo: diaYMes(fechaIso) || fechaIso, formularios, manzanas: [...manzanas.values()] };
      });
    const todos = jornadas.flatMap((jornada) => jornada.formularios);
    return {
      aplicador,
      formularios: todos.length,
      lejos: todos.filter((formulario) => formulario.tramo === "revision" || formulario.tramo === "lejos").length,
      jornadas,
    };
  }).sort((a, b) => b.lejos - a.lejos || b.formularios - a.formularios || a.aplicador.localeCompare(b.aplicador, "es"));

  return { disponible: aplicadores.length > 0, aplicadores };
}

export type ResumenDeJornada = {
  formularios: number;
  manzanas: number;
  conGps: number;
  fuera: number;
  medianaM: number | null;
  desde: string;
  hasta: string;
};

export function resumirJornada(jornada: JornadaDelAplicador): ResumenDeJornada {
  const distancias = jornada.formularios
    .filter((formulario) => formulario.tramo !== "sin-gps" && formulario.distanciaM != null)
    .map((formulario) => formulario.distanciaM as number)
    .sort((a, b) => a - b);
  const mitad = Math.floor(distancias.length / 2);
  const mediana = distancias.length ? (distancias.length % 2 ? distancias[mitad] : (distancias[mitad - 1] + distancias[mitad]) / 2) : null;
  const horas = jornada.formularios.map((formulario) => formulario.hora).filter(Boolean);
  return {
    formularios: jornada.formularios.length,
    manzanas: jornada.manzanas.length,
    conGps: jornada.formularios.filter((formulario) => formulario.tramo !== "sin-gps").length,
    fuera: jornada.formularios.filter((formulario) => formulario.tramo === "revision" || formulario.tramo === "lejos").length,
    medianaM: mediana,
    desde: horas[0] ?? "",
    hasta: horas.at(-1) ?? "",
  };
}

export function textoDeDistanciaDeFormulario(formulario: Pick<FormularioDelRecorrido, "distanciaM" | "tramo">): string {
  if (formulario.tramo === "sin-gps" || formulario.distanciaM == null) return "Sin GPS";
  const metros = formulario.distanciaM;
  return metros >= 1000
    ? `${(metros / 1000).toLocaleString("es-PE", { maximumFractionDigits: 1 })} km de su manzana`
    : `${fmt(Math.round(metros))} m de su manzana`;
}

export function rotuloDeManzana(formulario: Pick<FormularioDelRecorrido, "ump" | "manzana" | "tipoManzana">): string {
  const tipo = formulario.tipoManzana ? formulario.tipoManzana.toLowerCase() : "";
  return [formulario.ump ? `UMP ${formulario.ump}` : "", formulario.manzana ? `manzana ${tipo ? `${tipo} ` : ""}${formulario.manzana}` : ""]
    .filter(Boolean)
    .join(", ") || "Sin manzana";
}
