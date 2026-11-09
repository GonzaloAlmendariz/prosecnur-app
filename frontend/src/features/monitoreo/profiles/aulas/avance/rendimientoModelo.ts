import type { MonitoreoAulasDashboard, MonitoreoRow } from "../../../../../api/monitoreo";
import { numeroONulo } from "../avanceCuota";
import { fmt, unDecimalPerfil } from "../kpisDeAulas";
import { readinessDeAulas } from "../navegacion/readinessDeAulas";
import { ejeDe, nombreDelGrupo } from "./resumenAulasModelo";
import { parteDeCampo } from "../parteDeCampo";
import { diaDeSemanaDeAplicacion } from "../rendimientoPorFacultad";
import { rendimientoContraEsperado, textoDeRazon, type GrupoDeRendimiento } from "./rendimientoContraEsperado";
import type { Vacio } from "./porFacultadModelo";

/**
 * Avance › Rendimiento (ficha A4 de `docs/qa/revamp-monitoreo/aulas.md`), listo
 * para pintar. ¿Cuándo y con quién rinde el campo?
 *
 * - «Efectivas por día»: `ritmo_diario.dias`, VOLUMEN (cuánto se consiguió cada
 *   día). No se lee como rendimiento y no se dice «el mejor».
 * - «Hora de aplicación», «Día de la semana» y «Por aplicador»: RENDIMIENTO, la
 *   razón observadas ÷ esperadas de los cursos-horario aplicados en ese grupo
 *   (`rendimientoContraEsperado`), con su número de aulas y la guarda de pocos
 *   casos. Sumar efectivas por día o por hora repetiría la agenda (Gonzalo,
 *   2026-10-31; revisor-metodológico, mismo día).
 * - «Tasa del campo contra la del diseño»: `efectividad_seguimiento.facultades`,
 *   τ prevista y observada con su banda y la señal del motor; ordenada por la
 *   señal, no por la diferencia cruda.
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

/** Una barra de rendimiento: razón contra lo esperado, con su evidencia. */
export type BarraDeRendimiento = {
  clave: string;
  etiqueta: string;
  /** «94 %» de lo esperado. */
  razon: string;
  /** Alto o ancho 0–100 en la escala de 0 a `TOPE_RAZON` (150 %). */
  relleno: number;
  aulas: number;
  /** Menos de 3 cursos-horario: no se compara. */
  pocos: boolean;
  titulo: string;
};
/** La escala de las barras de razón: hasta 150 % de lo esperado. */
export const TOPE_RAZON = 1.5;

export type PorHora =
  | { tipo: "barras"; sub: string; barras: BarraDeRendimiento[]; pie: string | null }
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
  /** Banda del motor (95 %) en la escala; `null` con menos de dos aulas. */
  banda: { x0: number; x1: number } | null;
  aulas: string;
  /** «Bajo lo previsto», «Conforme», «Sobre lo previsto», «Sin banda». */
  senal: string;
  aria: string;
};

export type Tasas =
  | { tipo: "pesas"; escala: string; filas: FilaDeTasa[]; pie: string | null; /** «Facultad», «Nivel»: el eje de la cuota. */ eje: string }
  | { tipo: "vacio"; vacio: Vacio };

export type Semana =
  | { tipo: "barras"; sub: string; filas: BarraDeRendimiento[]; pie: string | null }
  | { tipo: "vacio"; vacio: Vacio };

export type FilaDeAplicador = {
  clave: string;
  aplicador: string;
  aulas: string;
  efectivas: string;
  /** Observadas ÷ esperadas de sus aulas. */
  contraEsperado: string;
  /** Efectivas ÷ asistentes: lo que depende del trabajo en el aula. */
  deAsistentes: string;
  pocos: boolean;
  titulo: string;
};

export type Aplicadores =
  | { tipo: "tabla"; sub: string; filas: FilaDeAplicador[]; pie: string | null }
  | { tipo: "vacio"; vacio: Vacio };

export type ModeloRendimiento =
  | { estado: "sin-tablero"; porDia: PorDia; porHora: PorHora; tasas: Tasas; semana: Semana; aplicadores: Aplicadores }
  | { estado: "listo"; porDia: PorDia; porHora: PorHora; tasas: Tasas; semana: Semana; aplicadores: Aplicadores };

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
/** Lunes primero, como lo lee el equipo. */
const ORDEN_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

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
  causa: "Este corte no trae la serie diaria: la publica el motor al actualizar.",
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
    sub: media != null ? `volumen; media de ${unDecimalPerfil(media)} por día con campo` : `volumen de ${fmt(dias.length)} días`,
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

// La hora en que se APLICÓ el aula, del parte: «2026-09-29 9:36» → 9.
/** El horario de clases: fuera de él una hora no se grafica, se declara. */
const HORA_DESDE = 7;
const HORA_HASTA = 22;

/**
 * La hora de aplicación, respetando «am/pm» si el texto lo trae. Una hora
 * fuera del horario de clases no se corrige a ojo: en HSVG llegan «2:10» sin
 * am/pm que casi seguro son de la tarde, pero adivinarlo es inventar el dato.
 * Va al pie como «fuera del horario» (`"fuera"`).
 */
function horaDeAplicacion(valor: unknown): number | "fuera" | null {
  const m = /(\d{1,2}):(\d{2})\s*([ap])?\.?\s*m?/i.exec(texto(valor));
  if (!m) return null;
  let h = Number(m[1]);
  if (!(h >= 0 && h < 24)) return null;
  const sufijo = m[3]?.toLowerCase();
  if (sufijo === "p" && h < 12) h += 12;
  if (sufijo === "a" && h === 12) h = 0;
  return h >= HORA_DESDE && h < HORA_HASTA ? h : "fuera";
}

function partesYPlan(dashboard: MonitoreoAulasDashboard) {
  const agenda = (dashboard.agenda ?? []) as MonitoreoRow[];
  const partes = parteDeCampo((dashboard.partes_campo ?? []) as MonitoreoRow[], agenda).filas as MonitoreoRow[];
  return { partes, agenda };
}

function barra(g: GrupoDeRendimiento, etiqueta: string): BarraDeRendimiento {
  const r = g.razon ?? 0;
  return {
    clave: g.grupo,
    etiqueta,
    razon: textoDeRazon(g.razon),
    relleno: Math.max(0, Math.min(100, (100 * r) / TOPE_RAZON)),
    aulas: g.aulas,
    pocos: g.pocos,
    titulo: `${etiqueta}: ${fmt(g.efectivas)} efectivas de ${fmt(Math.round(g.esperadas))} esperadas en ${fmt(g.aulas)} ${g.aulas === 1 ? "curso-horario" : "cursos-horario"}` +
      (g.pocos ? ". Pocos cursos-horario para comparar." : `; ajustado por evidencia, ${textoDeRazon(g.razonAjustada)}.`),
  };
}

function pieDeExclusiones(sinEsperadas: number, sinCifra: number): string | null {
  const partes: string[] = [];
  if (sinEsperadas) partes.push(`${fmt(sinEsperadas)} ${sinEsperadas === 1 ? "parte sin esperadas en el plan" : "partes sin esperadas en el plan"}`);
  if (sinCifra) partes.push(`${fmt(sinCifra)} ${sinCifra === 1 ? "parte sin cifra de efectivas" : "partes sin cifra de efectivas"}`);
  return partes.length ? `Fuera de la cuenta: ${partes.join(" y ")}.` : null;
}

const SIN_PARTES: Vacio = { clase: "legitimo", causa: "Aún no hay partes de campo con sus efectivas." };

function porHoraDe(dashboard: MonitoreoAulasDashboard): PorHora {
  const { partes, agenda } = partesYPlan(dashboard);
  const r = rendimientoContraEsperado(partes, agenda, (p) => {
    const h = horaDeAplicacion(p.applied_at ?? p.applied_time);
    return h == null ? "" : String(h);
  });
  const conHora = r.grupos.filter((g) => g.grupo !== "" && g.grupo !== "fuera");
  if (!conHora.length) return { tipo: "vacio", vacio: SIN_PARTES };
  const horas = conHora.map((g) => Number(g.grupo));
  const porHora = new Map(conHora.map((g) => [Number(g.grupo), g]));
  const barras: BarraDeRendimiento[] = [];
  for (let h = Math.min(...horas); h <= Math.max(...horas); h += 1) {
    const g = porHora.get(h);
    barras.push(g
      ? barra(g, `${h}:00`)
      : { clave: String(h), etiqueta: `${h}:00`, razon: "—", relleno: 0, aulas: 0, pocos: true, titulo: `${h}:00: sin cursos-horario aplicados a esa hora` });
  }
  const sinHora = r.grupos.find((g) => g.grupo === "")?.aulas ?? 0;
  const fuera = r.grupos.find((g) => g.grupo === "fuera")?.aulas ?? 0;
  const pie = [
    pieDeExclusiones(r.sinEsperadas, r.sinCifra),
    sinHora ? `${fmt(sinHora)} sin hora de aplicación.` : null,
    fuera ? `${fmt(fuera)} con hora fuera de ${HORA_DESDE}:00–${HORA_HASTA}:00, probablemente sin "am/pm": no se grafican.` : null,
  ].filter(Boolean).join(" ");
  return {
    tipo: "barras",
    sub: `efectivas contra lo esperado de los cursos-horario aplicados a esa hora; 100 % es lo previsto`,
    barras,
    pie: pie || null,
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
      vacio: { clase: "desconexion", causa: "Este corte no trae el seguimiento de la tasa: lo publica el motor al actualizar." },
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
  const banda = (f: (typeof medibles)[number]["f"]) => {
    const b0 = proporcion(f.banda_bajo);
    const b1 = proporcion(f.banda_alto);
    return b0 != null && b1 != null ? { b0, b1 } : null;
  };
  const valores = medibles.flatMap((x) => {
    const b = banda(x.f);
    return [x.diseno, x.campo, ...(b ? [b.b0, b.b1] : [])];
  });
  const piso = Math.max(0, Math.floor(Math.min(...valores) * 10) / 10);
  const techo = Math.min(1, Math.ceil(Math.max(...valores) * 10) / 10);
  // (la banda entra en la escala para que nunca se salga del riel)
  const rango = techo - piso || 1;
  const x = (p: number) => (100 * (p - piso)) / rango;
  const pct = (p: number) => `${fmt(Math.round(p * 100))} %`;
  // El grupo es un valor del EJE de la cuota que declara el estudio: una
  // facultad en HSVG, un nivel en CCSS. Nunca «facultad» fijo.
  const eje = ejeDe(dashboard);
  // Primero lo que el motor señala con evidencia; dentro, por la diferencia.
  // Una facultad sin banda (menos de dos aulas) no encabeza nada.
  const RANGO_SENAL: Record<string, number> = { bajo: 0, sobre: 1, conforme: 2, sin_banda: 3, sin_previsto: 4 };
  const SENAL: Record<string, string> = { bajo: "Bajo lo previsto", sobre: "Sobre lo previsto", conforme: "Conforme", sin_banda: "Sin banda", sin_previsto: "Sin previsto" };
  const filas = medibles
    .sort((a, b) => (RANGO_SENAL[a.f.senal] ?? 5) - (RANGO_SENAL[b.f.senal] ?? 5)
      || (a.campo - a.diseno) - (b.campo - b.diseno) || a.f.facultad.localeCompare(b.f.facultad, "es"))
    .map(({ f, diseno, campo }) => {
      const nombre = nombreDelGrupo(texto(f.facultad), eje);
      const b = banda(f);
      const aulas = numeroONulo(f.aulas_aplicadas) ?? 0;
      return {
        clave: texto(f.faculty_key) || nombre,
        facultad: nombre,
        diseno: pct(diseno),
        campo: pct(campo),
        xDiseno: x(diseno),
        xCampo: x(campo),
        bajo: f.senal === "bajo",
        banda: b ? { x0: x(b.b0), x1: x(b.b1) } : null,
        aulas: fmt(aulas),
        senal: SENAL[f.senal] ?? f.senal,
        aria: `${nombre}: diseño ${pct(diseno)}, campo ${pct(campo)} en ${fmt(aulas)} cursos-horario; ${(SENAL[f.senal] ?? f.senal).toLocaleLowerCase("es")}`,
      };
    });
  const sinCampo = bloque.facultades.length - medibles.length;
  const grupo = sinCampo === 1 ? eje.etiqueta.toLocaleLowerCase("es") : eje.plural.toLocaleLowerCase("es");
  return {
    tipo: "pesas",
    eje: eje.etiqueta,
    escala: `Del ${fmt(Math.round(piso * 100))} % al ${fmt(Math.round(techo * 100))} %`,
    filas,
    pie: sinCampo > 0
      ? `${fmt(sinCampo)} ${grupo} ${sinCampo === 1 ? "queda" : "quedan"} fuera por no tener cursos-horario aplicados o tasa del diseño.`
      : null,
  };
}

function semanaDe(dashboard: MonitoreoAulasDashboard): Semana {
  const { partes, agenda } = partesYPlan(dashboard);
  const r = rendimientoContraEsperado(partes, agenda, (p) => diaDeSemanaDeAplicacion(p.applied_at ?? p.applied_date));
  const conDia = r.grupos.filter((g) => ORDEN_DIAS.includes(g.grupo));
  if (!conDia.length) return { tipo: "vacio", vacio: SIN_PARTES };
  // Sólo los días con campo: un día sin aulas aplicadas no es un cero.
  const filas = ORDEN_DIAS
    .map((dia) => conDia.find((g) => g.grupo === dia))
    .filter((g): g is GrupoDeRendimiento => Boolean(g))
    .map((g) => barra(g, g.grupo.slice(0, 3)));
  return {
    tipo: "barras",
    sub: "efectivas contra lo esperado de los cursos-horario aplicados ese día",
    filas,
    pie: pieDeExclusiones(r.sinEsperadas, r.sinCifra),
  };
}

function aplicadoresDe(dashboard: MonitoreoAulasDashboard): Aplicadores {
  const { partes, agenda } = partesYPlan(dashboard);
  if (!partes.length) return { tipo: "vacio", vacio: { clase: "legitimo", causa: "Aún no hay partes de campo." } };
  const r = rendimientoContraEsperado(partes, agenda, (p) => texto(p.applied_by) || "Sin aplicador");
  if (!r.grupos.length) return { tipo: "vacio", vacio: SIN_PARTES };
  // Los que tienen evidencia, de mejor a peor por la razón ajustada; los de
  // pocos cursos-horario, al final y sin orden de mérito. Juzga personas: la
  // guarda no es opcional.
  const ordenados = [...r.grupos].sort((a, b) =>
    Number(a.pocos) - Number(b.pocos)
    || (a.pocos ? a.grupo.localeCompare(b.grupo, "es") : (b.razonAjustada ?? 0) - (a.razonAjustada ?? 0)));
  const conEvidencia = r.grupos.filter((g) => !g.pocos && g.grupo !== "Sin aplicador").length;
  return {
    tipo: "tabla",
    sub: `${fmt(conEvidencia)} con ${fmt(3)} o más cursos-horario; los demás, al final`,
    filas: ordenados.map((g) => ({
      clave: g.grupo,
      aplicador: g.grupo,
      aulas: fmt(g.aulas),
      efectivas: fmt(g.efectivas),
      contraEsperado: textoDeRazon(g.razon),
      deAsistentes: g.deAsistentes == null ? "—" : `${Math.round(g.deAsistentes * 100)} %`,
      pocos: g.pocos,
      titulo: `${fmt(g.efectivas)} efectivas de ${fmt(Math.round(g.esperadas))} esperadas y ${fmt(g.asistentes)} asistentes` +
        (g.pocos ? ". Pocos cursos-horario para comparar." : `; ajustado por evidencia, ${textoDeRazon(g.razonAjustada)}.`),
    })),
    pie: pieDeExclusiones(r.sinEsperadas, r.sinCifra),
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
