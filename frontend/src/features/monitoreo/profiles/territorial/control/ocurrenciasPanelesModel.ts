import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { buildOccurrenceDistrictSummary, buildOccurrenceRouteUmpRows } from "../../../fieldOccurrences";
import { diaYMes, fechaYHoraDeLima, nombreDeDistrito, pctEntero } from "../rotulos";
import { rotuloCortoDeMotivo } from "./ocurrenciasModel";

/**
 * Control › Ocurrencias › Distritos y Ritmo (ronda 4). Las dos sub-vistas que
 * seguían montando la vista heredada: la cobertura de los partes por distrito
 * (qué UMP tienen su parte y cuáles se trabajaron sin él) y el ritmo diario de
 * los partes con las lecturas de su formulario. Cada cifra va en su celda con
 * su rótulo; nada de cadenas «a · b · c».
 */

function n(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.round(numero) : 0;
}

export type MotivoDelDistrito = { clave: string; rotulo: string; completo: string; total: number };

export type DistritoDePartes = {
  distrito: string;
  intentos: number;
  efectivas: number;
  noEfectivas: number;
  /** Proporción de intentos no efectivos, «87 %». */
  noEfectividad: string;
  umpConParte: number;
  umpTotal: number;
  completasSinParte: number;
  incompletasSinParte: number;
  validasSinParte: number;
  /** Último ingreso de una UMP trabajada sin parte, «dd/mm». */
  ultimoSinParte: string;
  motivos: MotivoDelDistrito[];
};

export type ModeloDistritosDePartes = {
  disponible: boolean;
  distritos: DistritoDePartes[];
  umpConParte: number;
  umpTotal: number;
};

/** Al final los grupos que no son un distrito: «UMP sin cruce…», «Sin distrito». */
function esGrupoSinDistrito(nombre: string): boolean {
  return /^(UMP sin|Sin distrito)/i.test(nombre);
}

export function construirDistritosDePartes(reports: MonitoreoTerritorialDashboard | null | undefined): ModeloDistritosDePartes {
  const tablero = reports?.field_occurrences ?? null;
  if (!tablero || n(tablero.summary?.total_records) <= 0) return { disponible: false, distritos: [], umpConParte: 0, umpTotal: 0 };
  const filas = buildOccurrenceDistrictSummary(tablero, buildOccurrenceRouteUmpRows({ occurrences: tablero }));
  const distritos = filas.map((fila): DistritoDePartes => {
    const efectivas = n(fila.efectivas);
    const noEfectivas = n(fila.no_efectivas);
    const intentos = n(fila.intentos) || efectivas + noEfectivas;
    const umpConParte = n(fila.ump_reportadas);
    return {
      distrito: nombreDeDistrito(fila.distrito),
      intentos,
      efectivas,
      noEfectivas,
      noEfectividad: pctEntero(noEfectivas, intentos),
      umpConParte,
      umpTotal: umpConParte + n(fila.ump_sin_reporte),
      completasSinParte: n(fila.ump_completas_sin_reporte),
      incompletasSinParte: n(fila.ump_incompletas_sin_reporte),
      validasSinParte: n(fila.validas_sin_reporte),
      ultimoSinParte: diaYMes(fila.ultimo_ingreso_sin_reporte),
      motivos: [...(fila.outcomes ?? [])]
        .filter((item) => n(item.total) > 0)
        .sort((a, b) => n(b.total) - n(a.total))
        .slice(0, 3)
        .map((item) => ({
          clave: String(item.key),
          // El chip parte línea: el tope del rótulo corto sólo evita «…».
          rotulo: rotuloCortoDeMotivo(String(item.label || item.key), 48),
          completo: String(item.label || item.key),
          total: n(item.total),
        })),
    };
  }).sort((a, b) => (
    Number(esGrupoSinDistrito(a.distrito)) - Number(esGrupoSinDistrito(b.distrito))
    || a.distrito.localeCompare(b.distrito, "es")
  ));
  return {
    disponible: true,
    distritos,
    umpConParte: distritos.reduce((suma, fila) => suma + fila.umpConParte, 0),
    umpTotal: distritos.reduce((suma, fila) => suma + fila.umpTotal, 0),
  };
}

export type DiaDePartes = {
  fecha: string;
  rotulo: string;
  intentos: number;
  efectivas: number;
  noEfectivas: number;
  /** Efectivas declaradas sobre intentos del día, «13 %». */
  efectividad: string;
};

export type TonoDeLectura = "ok" | "aviso" | "error" | "info";

export type LecturaDePartes = {
  id: string;
  tipo: string;
  estado: string;
  tono: TonoDeLectura;
  cuando: string;
  registros: number;
  mensaje: string;
};

export type ModeloRitmoDePartes = {
  disponible: boolean;
  intentos: number;
  dias: DiaDePartes[];
  pico: { intentos: number; rotulo: string } | null;
  ultimoDia: string;
  lecturas: LecturaDePartes[];
};

const TIPOS: Record<string, string> = {
  sync: "Lectura de partes",
  inspect: "Revisión del formulario",
  xlsform: "Formulario generado",
};
const ESTADOS: Record<string, { rotulo: string; tono: TonoDeLectura }> = {
  ok: { rotulo: "Correcta", tono: "ok" },
  warning: { rotulo: "Con avisos", tono: "aviso" },
  error: { rotulo: "Falló", tono: "error" },
};

function primeraMayuscula(texto: string): string {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}

export function construirRitmoDePartes(reports: MonitoreoTerritorialDashboard | null | undefined): ModeloRitmoDePartes {
  const tablero = reports?.field_occurrences ?? null;
  const dias = [...(tablero?.by_day ?? [])]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((dia): DiaDePartes => {
      const efectivas = n(dia.efectivas);
      const noEfectivas = n(dia.no_efectivas);
      const intentos = n(dia.intentos) || efectivas + noEfectivas;
      return {
        fecha: String(dia.date),
        rotulo: diaYMes(dia.date) || String(dia.date_label || dia.date),
        intentos,
        efectivas,
        noEfectivas,
        efectividad: pctEntero(efectivas, intentos),
      };
    });
  const pico = dias.reduce<DiaDePartes | null>((mayor, dia) => (!mayor || dia.intentos > mayor.intentos ? dia : mayor), null);
  const lecturas = [...(tablero?.history ?? [])]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((entrada): LecturaDePartes => {
      const estado = ESTADOS[String(entrada.status)] ?? { rotulo: primeraMayuscula(String(entrada.status || "Sin estado")), tono: "info" as const };
      return {
        id: String(entrada.id || entrada.created_at),
        tipo: TIPOS[String(entrada.type)] ?? primeraMayuscula(String(entrada.type || "Evento")),
        estado: estado.rotulo,
        tono: estado.tono,
        cuando: fechaYHoraDeLima(entrada.created_at) || "Sin fecha",
        registros: n(entrada.response_count),
        mensaje: String(entrada.message ?? "").trim(),
      };
    });
  const intentosDelResumen = n(tablero?.summary?.intentos) || n(tablero?.summary?.efectivas) + n(tablero?.summary?.no_efectivas);
  return {
    disponible: Boolean(tablero) && n(tablero?.summary?.total_records) > 0,
    intentos: intentosDelResumen || dias.reduce((suma, dia) => suma + dia.intentos, 0),
    dias,
    pico: pico && pico.intentos > 0 ? { intentos: pico.intentos, rotulo: pico.rotulo } : null,
    ultimoDia: dias.at(-1)?.rotulo ?? "",
    lecturas,
  };
}
