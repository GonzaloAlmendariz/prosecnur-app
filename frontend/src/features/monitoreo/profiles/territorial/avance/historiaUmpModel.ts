import type { MonitoreoRow, MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { celdaEnFrase, diaYMes, fmt, numeroDeUmp, rotuloDeAplicador } from "../rotulos";
import { construirFaltante } from "./faltanteModel";

/**
 * «Historia de la UMP» (territorial.md §3.16b): una curva escalonada de lo que
 * cuenta frente a la meta, sobre un eje de días a la misma distancia, y los
 * capítulos que la explican en lenguaje llano.
 *
 * Fuentes, todas ya publicadas por el motor:
 * - los formularios del corte (`response_audit`, corte de Validación);
 * - los anulados (`production_annulments.rows`) y la fecha de su anulación
 *   (`production_annulments.entries`);
 * - las subsanaciones aplicadas (`operational_adjustments.applied`, corte de
 *   Avance).
 * El GPS de los anulados no viaja en ninguna: el mapa de la exploración lo
 * necesita de un endpoint propio (pendiente de backend).
 */

export type ResultadoDeFormulario = "cuenta" | "observacion" | "no-cuenta" | "anulado-efectiva" | "anulado-sin-consentimiento";

export type FormularioDeUmp = {
  id: string;
  dia: string;
  aplicador: string;
  idManzana: string;
  resultado: ResultadoDeFormulario;
  /** Contaba para la meta cuando se levantó. */
  contaba: boolean;
};

export type TipoDeCapitulo = "jornada" | "anulacion" | "subsanacion";

export type CapituloDeUmp = {
  numero: number;
  tipo: TipoDeCapitulo;
  dia: string;
  fecha: string;
  texto: string;
  formularios: FormularioDeUmp[];
  /** Lo que cuenta al cerrar el capítulo, frente a la meta. */
  cuentan: number;
};

export type PuntoDeLaCurva = { dia: string; rotulo: string; cuentan: number; capitulo: number | null };

export type HistoriaDeUmp = {
  ump: string;
  meta: number;
  dias: PuntoDeLaCurva[];
  capitulos: CapituloDeUmp[];
  /** La curva termina en lo que el corte dice que cuenta hoy. */
  cuadra: boolean;
  cuentanHoy: number;
};

const ORDEN_DE_TIPO: Record<TipoDeCapitulo, number> = { jornada: 0, anulacion: 1, subsanacion: 2 };

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

/** Día «aaaa-mm-dd» en hora de Lima: una fecha con hora viene en UTC. */
export function claveDeDia(raw: unknown): string {
  const valor = texto(raw);
  if (!valor) return "";
  if (/^\d{4}-\d{2}-\d{2}T/.test(valor)) {
    const fecha = new Date(valor);
    if (!Number.isNaN(fecha.getTime())) {
      return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
    }
  }
  const iso = valor.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : "";
}

function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const inicio = Date.UTC(Number(desde.slice(0, 4)), Number(desde.slice(5, 7)) - 1, Number(desde.slice(8, 10)));
  const fin = Date.UTC(Number(hasta.slice(0, 4)), Number(hasta.slice(5, 7)) - 1, Number(hasta.slice(8, 10)));
  for (let t = inicio; t <= fin && dias.length < 400; t += 86_400_000) {
    dias.push(new Date(t).toISOString().slice(0, 10));
  }
  return dias;
}

function esVerdadero(valor: unknown): boolean {
  return valor === true || /^(true|1|si|sí|yes)$/i.test(texto(valor));
}

function resultadoDelCorte(fila: { advance_valid?: boolean; validation_status?: string; observation_status?: string }): ResultadoDeFormulario {
  if (fila.advance_valid === false || fila.validation_status === "no_defendible") return "no-cuenta";
  return fila.observation_status === "en_observacion" ? "observacion" : "cuenta";
}

function enFrase(n: number, singular: string, plural: string): string {
  return `${fmt(n)} ${n === 1 ? singular : plural}`;
}

export function construirHistoriaDeUmp(
  avance: MonitoreoTerritorialDashboard | null | undefined,
  validacion: MonitoreoTerritorialDashboard | null | undefined,
  umpPedida: string | null | undefined,
): HistoriaDeUmp | null {
  const ump = numeroDeUmp(umpPedida);
  const fila = ump ? construirFaltante(avance).filas.find((item) => item.ump === ump) : undefined;
  if (!fila) return null;
  const bloques = [fila.bloque, ...fila.otras];
  const manzanas = new Set(bloques.map((bloque) => bloque.id_manzana));
  const tipoDeManzana = new Map(bloques.map((bloque) => [
    bloque.id_manzana,
    `${texto(bloque.tipo_manzana).toLowerCase() === "reemplazo" ? "de reemplazo" : "titular"} ${texto(bloque.manzana)}`.trim(),
  ]));

  const delCorte: FormularioDeUmp[] = (validacion?.response_audit ?? [])
    .filter((item) => manzanas.has(texto(item.advance_block_id)))
    .map((item) => {
      const resultado = resultadoDelCorte(item);
      return {
        id: texto(item.response_id) || String(item.row_index),
        dia: claveDeDia(item.submission_date_iso || item.submission_datetime),
        aplicador: rotuloDeAplicador(item.responsible_display || item.pulso_code),
        idManzana: texto(item.advance_block_id),
        resultado,
        contaba: resultado !== "no-cuenta",
      };
    });

  const anulaciones = avance?.production_annulments ?? validacion?.production_annulments;
  const anulados: FormularioDeUmp[] = (anulaciones?.rows ?? [])
    .filter((item: MonitoreoRow) => manzanas.has(texto(item.advance_block_id)) || numeroDeUmp(item.advance_ump_label) === ump)
    .map((item: MonitoreoRow) => {
      const efectiva = esVerdadero(item.source_effective);
      return {
        id: texto(item.response_id),
        dia: claveDeDia(item.submission_date_iso),
        aplicador: rotuloDeAplicador(item.responsible_display || item.pulso_code),
        idManzana: texto(item.advance_block_id),
        resultado: efectiva ? "anulado-efectiva" : "anulado-sin-consentimiento",
        contaba: efectiva && texto(item.validation_status) !== "no_defendible",
      };
    });

  type Evento = { tipo: TipoDeCapitulo; dia: string; formularios: FormularioDeUmp[]; delta: number; texto: string };
  const eventos: Evento[] = [];

  const jornadas = new Map<string, FormularioDeUmp[]>();
  for (const formulario of [...delCorte, ...anulados]) {
    if (!formulario.dia) continue;
    const clave = `${formulario.dia}|${formulario.aplicador}|${formulario.idManzana}`;
    jornadas.set(clave, [...(jornadas.get(clave) ?? []), formulario]);
  }
  for (const formularios of jornadas.values()) {
    const [primero] = formularios;
    const cuentan = formularios.filter((item) => item.contaba).length;
    eventos.push({
      tipo: "jornada",
      dia: primero.dia,
      formularios,
      delta: cuentan,
      texto: `${primero.aplicador} levanta ${enFrase(formularios.length, "formulario", "formularios")} en la manzana ${tipoDeManzana.get(primero.idManzana) ?? ""}: ${enFrase(cuentan, "cuenta", "cuentan")}.`,
    });
  }

  const idsAnulados = new Set(anulados.map((item) => item.id));
  for (const entrada of anulaciones?.entries ?? []) {
    if (texto(entrada.status) !== "active") continue;
    const propios = anulados.filter((item) => {
      if (entrada.scope === "response") return item.id === texto(entrada.response_id);
      return idsAnulados.has(item.id) && (!entrada.responsible_label || item.aplicador === rotuloDeAplicador(entrada.responsible_label));
    });
    if (!propios.length) continue;
    const contaban = propios.filter((item) => item.contaba).length;
    eventos.push({
      tipo: "anulacion",
      dia: claveDeDia(entrada.created_at),
      formularios: propios,
      delta: -contaban,
      texto: `Se anula la producción de ${rotuloDeAplicador(entrada.responsible_label)}: salen ${enFrase(propios.length, "formulario", "formularios")}, ${enFrase(contaban, "que contaba", "que contaban")}.`,
    });
  }

  for (const ajuste of avance?.operational_adjustments?.applied ?? []) {
    if (texto(ajuste.status || "active") !== "active") continue;
    if (!manzanas.has(texto(ajuste.target_block_id)) && numeroDeUmp(ajuste.target_ump) !== ump) continue;
    const cantidad = Math.max(1, Math.round(Number(ajuste.count) || 1));
    const celda = [texto(ajuste.sex) ? celdaEnFrase(ajuste.sex) : "", texto(ajuste.age_group) ? celdaEnFrase(ajuste.age_group) : ""]
      .filter(Boolean).join(" de ");
    eventos.push({
      tipo: "subsanacion",
      dia: claveDeDia(ajuste.created_at),
      formularios: [],
      delta: cantidad,
      texto: `Una subsanación trae ${enFrase(cantidad, "caso", "casos")}${celda ? ` (${celda})` : ""} desde la UMP ${numeroDeUmp(ajuste.source_ump)}.`,
    });
  }

  const ordenados = eventos
    .filter((evento) => evento.dia)
    .sort((a, b) => a.dia.localeCompare(b.dia) || ORDEN_DE_TIPO[a.tipo] - ORDEN_DE_TIPO[b.tipo]);
  let acumulado = 0;
  const capitulos: CapituloDeUmp[] = ordenados.map((evento, indice) => {
    acumulado += evento.delta;
    return {
      numero: indice + 1,
      tipo: evento.tipo,
      dia: evento.dia,
      fecha: diaYMes(evento.dia),
      texto: evento.texto,
      formularios: evento.formularios,
      cuentan: acumulado,
    };
  });

  const dias: PuntoDeLaCurva[] = [];
  if (capitulos.length) {
    let enCurso = 0;
    for (const dia of diasEntre(capitulos[0].dia, capitulos.at(-1)!.dia)) {
      const delDia = capitulos.filter((capitulo) => capitulo.dia === dia);
      if (delDia.length) enCurso = delDia.at(-1)!.cuentan;
      dias.push({ dia, rotulo: diaYMes(dia), cuentan: enCurso, capitulo: delDia.at(-1)?.numero ?? null });
    }
  }

  return {
    ump,
    meta: fila.meta,
    dias,
    capitulos,
    cuadra: acumulado === fila.logrado,
    cuentanHoy: fila.logrado,
  };
}
