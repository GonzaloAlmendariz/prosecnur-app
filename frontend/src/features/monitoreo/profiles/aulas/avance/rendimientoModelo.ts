import type { MonitoreoAulasDashboard, MonitoreoRow } from "../../../../../api/monitoreo";
import { facultadEnPalabras } from "../../../../../lib/nombresDeFacultad";
import { numeroONulo } from "../avanceCuota";
import { fmt, pctPerfil, unDecimalPerfil } from "../kpisDeAulas";
import { readinessDeAulas } from "../navegacion/readinessDeAulas";
import { parteDeCampo } from "../parteDeCampo";
import { partesSinCifraDeEfectivas, rendimientoPorFacultad } from "../rendimientoPorFacultad";
import type { Vacio } from "./porFacultadModelo";

/**
 * Avance › Rendimiento (ficha A4 de `docs/qa/revamp-monitoreo/aulas.md`), listo
 * para pintar. ¿Cuándo y con quién rinde el campo?
 *
 * - «Efectivas por día» y «Día de la semana»: `ritmo_diario.dias` del motor, la
 *   misma serie de Avance › Resumen. El día de la semana es la suma de esa
 *   serie por día, así que las dos cifras no pueden discrepar.
 * - «Hora en que se responde»: `ritmo_diario.por_hora`, de la misma marca local
 *   que fecha el día.
 * - «Tasa del campo contra la del diseño»: `efectividad_seguimiento.facultades`,
 *   τ prevista y observada con la señal del motor; aquí no se recalcula ninguna.
 * - «Por aplicador»: el parte de campo agrupado por `applied_by` con
 *   `rendimientoPorFacultad`, el mismo cálculo del ranking heredado.
 *
 * Un dato que no llega se dice con su causa, nunca como un 0 que parezca medido.
 */

export const MARCA_RENDIMIENTO_AULAS = readinessDeAulas("avance", "rendimiento");

export type BarraDelDia = {
  fecha: string;
  /** Día del mes, el rótulo del eje. */
  etiqueta: string;
  validas: number;
  /** Alto de la barra, 0–100 contra el mejor día. */
  alto: number;
  /** Sábado o domingo: se pinta en el tono secundario (G10). */
  finDeSemana: boolean;
  titulo: string;
};

export type PorDia =
  | { tipo: "barras"; sub: string; barras: BarraDelDia[] }
  | { tipo: "vacio"; vacio: Vacio };

export type BarraDeHora = { hora: number; etiqueta: string; validas: number; alto: number; pico: boolean; titulo: string };

export type PorHora =
  | { tipo: "barras"; sub: string; barras: BarraDeHora[]; pie: string | null }
  | { tipo: "vacio"; vacio: Vacio };

export type FilaDeTasa = {
  clave: string;
  facultad: string;
  diseno: string;
  campo: string;
  /** Posiciones 0–100 dentro de la escala del panel. */
  xDiseno: number;
  xCampo: number;
  /** El campo rinde bajo su τ con evidencia (señal `bajo` del motor). */
  bajo: boolean;
  aria: string;
};

export type Tasas =
  | { tipo: "pesas"; escala: string; filas: FilaDeTasa[]; pie: string | null }
  | { tipo: "vacio"; vacio: Vacio };

export type FilaDeSemana = { clave: string; dia: string; validas: number; relleno: number };

export type Semana =
  | { tipo: "barras"; filas: FilaDeSemana[] }
  | { tipo: "vacio"; vacio: Vacio };

export type FilaDeAplicador = { clave: string; aplicador: string; aulas: string; efectivas: string; tasa: string; tituloTasa: string };

export type Aplicadores =
  | { tipo: "tabla"; sub: string; filas: FilaDeAplicador[]; pie: string | null }
  | { tipo: "vacio"; vacio: Vacio };

export type ModeloRendimiento =
  | { estado: "sin-tablero"; porDia: PorDia; porHora: PorHora; tasas: Tasas; semana: Semana; aplicadores: Aplicadores }
  | { estado: "listo"; porDia: PorDia; porHora: PorHora; tasas: Tasas; semana: Semana; aplicadores: Aplicadores };

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
/** Lunes primero, como lo lee el equipo; el domingo sólo si tuvo campo. */
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

function texto(valor: unknown): string {
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return "";
}

function diaDeLaSemana(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(`${m[0]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.getUTCDay();
}

function diasDe(dashboard: MonitoreoAulasDashboard): Array<{ fecha: string; validas: number }> | null {
  const ritmo = dashboard.ritmo_diario ?? null;
  if (!ritmo || !Array.isArray(ritmo.dias)) return null;
  return ritmo.dias
    .map((d) => ({ fecha: texto(d?.fecha), validas: Math.max(0, numeroONulo(d?.validas) ?? 0) }))
    .filter((d) => d.fecha);
}

const SIN_SERIE: Vacio = {
  clase: "desconexion",
  causa: "Este corte no trae la serie diaria: la publica el motor al traer respuestas.",
};
const SIN_DIAS: Vacio = { clase: "legitimo", causa: "Aún no hay efectivas con fecha de envío." };

function porDiaDe(dashboard: MonitoreoAulasDashboard): PorDia {
  const dias = diasDe(dashboard);
  if (!dias) return { tipo: "vacio", vacio: SIN_SERIE };
  if (!dias.some((d) => d.validas > 0)) return { tipo: "vacio", vacio: SIN_DIAS };
  const techo = Math.max(...dias.map((d) => d.validas));
  const media = numeroONulo(dashboard.ritmo_diario?.media_diaria);
  return {
    tipo: "barras",
    sub: media != null ? `media de ${unDecimalPerfil(media)} por día con campo` : `${fmt(dias.length)} días`,
    barras: dias.map((d) => {
      const dia = diaDeLaSemana(d.fecha);
      const nombre = dia == null ? "" : DIAS_CORTOS[dia];
      return {
        fecha: d.fecha,
        etiqueta: fmt(Number(d.fecha.slice(8, 10))),
        validas: d.validas,
        alto: (100 * d.validas) / techo,
        finDeSemana: dia === 0 || dia === 6,
        titulo: `${nombre} ${fmt(Number(d.fecha.slice(8, 10)))}: ${fmt(d.validas)} efectivas`.trim(),
      };
    }),
  };
}

function porHoraDe(dashboard: MonitoreoAulasDashboard): PorHora {
  const ritmo = dashboard.ritmo_diario ?? null;
  if (!ritmo || !Array.isArray(ritmo.por_hora)) {
    return {
      tipo: "vacio",
      vacio: {
        clase: "desconexion",
        causa: "Este corte se calculó antes de que el motor publicara la hora de cada respuesta. Actualizar la trae.",
      },
    };
  }
  const horas = new Map<number, number>();
  for (const h of ritmo.por_hora) {
    const hora = numeroONulo(h?.hora);
    const validas = numeroONulo(h?.validas);
    if (hora == null || validas == null || hora < 0 || hora > 23) continue;
    horas.set(Math.trunc(hora), (horas.get(Math.trunc(hora)) ?? 0) + Math.max(0, validas));
  }
  if (!horas.size) return { tipo: "vacio", vacio: SIN_DIAS };
  const claves = [...horas.keys()];
  const desde = Math.min(...claves);
  const hasta = Math.max(...claves);
  const techo = Math.max(...horas.values());
  const pico = claves.find((h) => horas.get(h) === techo)!;
  const barras: BarraDeHora[] = [];
  for (let h = desde; h <= hasta; h += 1) {
    const validas = horas.get(h) ?? 0;
    barras.push({
      hora: h,
      etiqueta: String(h),
      validas,
      alto: techo ? (100 * validas) / techo : 0,
      pico: h === pico,
      titulo: `De ${h}:00 a ${h}:59: ${fmt(validas)} efectivas`,
    });
  }
  const suma = [...horas.values()].reduce((a, b) => a + b, 0);
  const totalDias = (diasDe(dashboard) ?? []).reduce((a, d) => a + d.validas, 0);
  const sinHora = totalDias - suma;
  return {
    tipo: "barras",
    sub: `pico a las ${pico}:00`,
    barras,
    pie: sinHora > 0 ? `${fmt(sinHora)} efectivas sin hora legible no entran en ninguna barra.` : null,
  };
}

/** τ en proporción; si el motor la mandara en porcentaje, se lleva a proporción. */
function proporcion(valor: unknown): number | null {
  const n = numeroONulo(valor);
  if (n == null) return null;
  return n > 1 ? n / 100 : n;
}

function tasasDe(dashboard: MonitoreoAulasDashboard): Tasas {
  const bloque = dashboard.efectividad_seguimiento ?? null;
  if (!bloque || !Array.isArray(bloque.facultades)) {
    return {
      tipo: "vacio",
      vacio: { clase: "desconexion", causa: "Este corte no trae el seguimiento de la tasa: lo publica el motor al traer respuestas." },
    };
  }
  const medibles = bloque.facultades
    .map((f) => ({ f, diseno: proporcion(f.tau_previsto), campo: proporcion(f.tau_observado) }))
    .filter((x): x is { f: typeof x.f; diseno: number; campo: number } => x.diseno != null && x.campo != null);
  if (!medibles.length) {
    const sinDiseno = bloque.facultades.every((f) => proporcion(f.tau_previsto) == null);
    return {
      tipo: "vacio",
      vacio: sinDiseno
        ? { clase: "legitimo", causa: "El diseño no declaró una tasa por facultad contra la que medir el campo." }
        : { clase: "legitimo", causa: "Ninguna facultad tiene todavía cursos-horario aplicados con elegibles." },
    };
  }
  const valores = medibles.flatMap((x) => [x.diseno, x.campo]);
  const piso = Math.max(0, Math.floor(Math.min(...valores) * 10) / 10);
  const techo = Math.min(1, Math.ceil(Math.max(...valores) * 10) / 10);
  const rango = techo - piso || 1;
  const x = (p: number) => (100 * (p - piso)) / rango;
  const pct = (p: number) => `${fmt(Math.round(p * 100))} %`;
  const filas = medibles
    .sort((a, b) => (a.campo - a.diseno) - (b.campo - b.diseno) || a.f.facultad.localeCompare(b.f.facultad, "es"))
    .map(({ f, diseno, campo }) => {
      const nombre = facultadEnPalabras(f.facultad) || texto(f.facultad);
      return {
        clave: texto(f.faculty_key) || nombre,
        facultad: nombre,
        diseno: pct(diseno),
        campo: pct(campo),
        xDiseno: x(diseno),
        xCampo: x(campo),
        bajo: f.senal === "bajo",
        aria: `${nombre}: diseño ${pct(diseno)}, campo ${pct(campo)}`,
      };
    });
  const sinCampo = bloque.facultades.length - medibles.length;
  return {
    tipo: "pesas",
    escala: `Del ${fmt(Math.round(piso * 100))} % al ${fmt(Math.round(techo * 100))} %`,
    filas,
    pie: sinCampo > 0
      ? `${fmt(sinCampo)} ${sinCampo === 1 ? "facultad queda" : "facultades quedan"} fuera por no tener cursos-horario aplicados o tasa del diseño.`
      : null,
  };
}

function semanaDe(dashboard: MonitoreoAulasDashboard): Semana {
  const dias = diasDe(dashboard);
  if (!dias) return { tipo: "vacio", vacio: SIN_SERIE };
  const suma = new Map<number, number>();
  for (const d of dias) {
    const dia = diaDeLaSemana(d.fecha);
    if (dia == null) continue;
    suma.set(dia, (suma.get(dia) ?? 0) + d.validas);
  }
  if (![...suma.values()].some((v) => v > 0)) return { tipo: "vacio", vacio: SIN_DIAS };
  const techo = Math.max(...suma.values());
  return {
    tipo: "barras",
    filas: ORDEN_SEMANA
      .filter((dia) => dia !== 0 || (suma.get(0) ?? 0) > 0)
      .map((dia) => {
        const validas = suma.get(dia) ?? 0;
        return { clave: String(dia), dia: DIAS_CORTOS[dia], validas, relleno: techo ? (100 * validas) / techo : 0 };
      }),
  };
}

function aplicadoresDe(dashboard: MonitoreoAulasDashboard): Aplicadores {
  const partes = (dashboard.partes_campo ?? []) as MonitoreoRow[];
  if (!partes.length) {
    return { tipo: "vacio", vacio: { clase: "legitimo", causa: "Aún no hay partes de campo." } };
  }
  const agenda = (dashboard.agenda ?? []) as MonitoreoRow[];
  const conFacultad = parteDeCampo(partes, agenda).filas as MonitoreoRow[];
  const grupos = rendimientoPorFacultad(conFacultad, agenda, "applied_by")
    .sort((a, b) => b.efectivas - a.efectivas || a.facultad.localeCompare(b.facultad, "es"));
  if (!grupos.length) {
    return { tipo: "vacio", vacio: { clase: "legitimo", causa: "Ningún parte trae todavía su cifra de efectivas." } };
  }
  const conAplicador = grupos.filter((g) => g.facultad !== "Sin aplicador").length;
  const sinCifra = partesSinCifraDeEfectivas(conFacultad);
  return {
    tipo: "tabla",
    sub: `${fmt(conAplicador)} con partes`,
    filas: grupos.map((g) => ({
      clave: g.facultad,
      aplicador: g.facultad,
      aulas: fmt(g.aulas),
      efectivas: fmt(g.efectivas),
      tasa: g.delPotencial != null ? pctPerfil(g.delPotencial) : "—",
      tituloTasa: g.delPotencial != null
        ? `${fmt(g.efectivas)} efectivas de ${fmt(g.elegibles)} elegibles`
        : "El plan no trae los elegibles de sus cursos-horario.",
    })),
    pie: sinCifra > 0
      ? `${fmt(sinCifra)} ${sinCifra === 1 ? "parte sin cifra de efectivas no entra" : "partes sin cifra de efectivas no entran"} en la tabla.`
      : null,
  };
}

export function construirRendimiento(dashboard: MonitoreoAulasDashboard | null): ModeloRendimiento {
  if (!dashboard) {
    const vacio: Vacio = { clase: "desconexion", causa: "Sin tablero." };
    return {
      estado: "sin-tablero",
      porDia: { tipo: "vacio", vacio },
      porHora: { tipo: "vacio", vacio },
      tasas: { tipo: "vacio", vacio },
      semana: { tipo: "vacio", vacio },
      aplicadores: { tipo: "vacio", vacio },
    };
  }
  return {
    estado: "listo",
    porDia: porDiaDe(dashboard),
    porHora: porHoraDe(dashboard),
    tasas: tasasDe(dashboard),
    semana: semanaDe(dashboard),
    aplicadores: aplicadoresDe(dashboard),
  };
}

/**
 * La marca de readiness: `false` sólo mientras carga, la dirección cuando pintó
 * (también con vacíos declarados dentro de cada panel) y `vacio:<estado>` sin
 * tablero.
 */
export function readinessDeRendimiento(modelo: ModeloRendimiento | null, cargando: boolean): string {
  if (cargando || !modelo) return "false";
  if (modelo.estado === "listo") return MARCA_RENDIMIENTO_AULAS;
  return `vacio:${modelo.estado}`;
}
