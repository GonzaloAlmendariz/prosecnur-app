import type {
  MonitoreoAulasConfig,
  MonitoreoAulasDashboard,
  MonitoreoAulasRepartoAsignacion,
} from "../../../../../api/monitoreo";
import { fmt } from "../kpisDeAulas";
import { fechaCorta } from "./fuentesModelo";

/**
 * Insumos › Aplicadores (ficha I3), sobre el mecanismo REAL de asignación.
 *
 * Gonzalo, 2026-10-31: la maqueta de «disponibilidad declarada» no respetaba
 * cómo se asigna. El operativo trabaja por TRAMO (semana): la app siembra la
 * pestaña de la semana una vez con el reparto equitativo, después sólo agrega
 * filas por lo nuevo agendado y retira las cerradas, y lo que el equipo fija a
 * mano manda (`monitoreo_aulas_reparto.R`, `_distribucion_semanas.R`,
 * `_distribucion_retirar_cerradas.R`). Por eso esta vista es por tramo y dice,
 * por aplicador, cuánto le tocó, cuánto fijó el equipo, en cuántos viajes y si
 * pasa el tope blando de cuatro por viaje; y de la distribución publicada, si
 * el Sheets que ven los aplicadores está al día con el reparto vigente.
 */

/** Tope blando de cursos-horario en un mismo viaje al campus (dictado 2026-09-04). */
export const TOPE_POR_VIAJE = 4;
export const HORA_INICIO = 7;
export const HORA_FIN = 22;

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] as const;
export const ROTULO_DIA: Record<(typeof DIAS)[number], string> = {
  lunes: "Lun", martes: "Mar", miercoles: "Mié", jueves: "Jue", viernes: "Vie", sabado: "Sáb",
};

export type Segmento = { izquierda: number; ancho: number };

export type FilaDeAplicador = {
  nombre: string;
  /** Su semana declarada, día por día, en % de 7:00 a 22:00. */
  semana: Record<(typeof DIAS)[number], Segmento[]>;
  horas: number;
  citas: number;
  fijadas: number;
  dias: number;
  maxPorDia: number;
  sobreTope: boolean;
  aplicadas: number;
  sinDisponibilidad: boolean;
};

export type TramoDeLaVista = {
  nombre: string;
  rango: string;
  citas: number;
  aplicadas: number;
  vigente: boolean;
  elegido: boolean;
  desde: string;
  hasta: string;
};

export type EstadoDeDistribucion = {
  estado: "sin-destino" | "al-dia" | "desactualizada";
  texto: string;
};

export type ModeloAplicadores =
  | { estado: "sin-datos"; causa: string }
  | {
    estado: "listo";
    tramos: TramoDeLaVista[];
    elegido: TramoDeLaVista | null;
    filas: FilaDeAplicador[];
    distribucion: EstadoDeDistribucion;
    pie: string;
  };

function sinTilde(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function minutos(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function segmento(inicio: string, fin: string): Segmento | null {
  const a = minutos(inicio);
  const b = minutos(fin);
  if (a == null || b == null || b <= a) return null;
  const desde = HORA_INICIO * 60;
  const total = (HORA_FIN - HORA_INICIO) * 60;
  const ia = Math.max(a, desde) - desde;
  const ib = Math.min(b, HORA_FIN * 60) - desde;
  if (ib <= ia) return null;
  return { izquierda: (100 * ia) / total, ancho: (100 * (ib - ia)) / total };
}

function semanaVacia(): FilaDeAplicador["semana"] {
  return { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [] };
}

/**
 * La disponibilidad viene por franja de media hora con los nombres que caben:
 * se reconstruye la semana de cada aplicador juntando franjas contiguas.
 */
function semanasDeclaradas(dashboard: MonitoreoAulasDashboard): Map<string, { semana: FilaDeAplicador["semana"]; horas: number }> {
  const porNombre = new Map<string, { semana: FilaDeAplicador["semana"]; horas: number; tramos: Record<string, Array<[number, number]>> }>();
  for (const dia of dashboard.disponibilidad?.dias ?? []) {
    const clave = sinTilde(dia.dia) as (typeof DIAS)[number];
    if (!DIAS.includes(clave)) continue;
    for (const f of dia.franjas ?? []) {
      const a = minutos(f.inicio);
      const b = minutos(f.fin);
      if (a == null || b == null) continue;
      for (const nombre of f.nombres ?? []) {
        const n = nombre.trim();
        if (!n) continue;
        const reg = porNombre.get(n) ?? { semana: semanaVacia(), horas: 0, tramos: {} };
        (reg.tramos[clave] ??= []).push([a, b]);
        porNombre.set(n, reg);
      }
    }
  }
  const salida = new Map<string, { semana: FilaDeAplicador["semana"]; horas: number }>();
  for (const [nombre, reg] of porNombre) {
    let horas = 0;
    for (const dia of DIAS) {
      const tramos = (reg.tramos[dia] ?? []).sort((x, y) => x[0] - y[0]);
      const unidos: Array<[number, number]> = [];
      for (const t of tramos) {
        const ultimo = unidos[unidos.length - 1];
        if (ultimo && t[0] <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], t[1]);
        else unidos.push([t[0], t[1]]);
      }
      for (const [a, b] of unidos) {
        horas += (b - a) / 60;
        const hh = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
        const s = segmento(hh(a), hh(b));
        if (s) reg.semana[dia].push(s);
      }
    }
    salida.set(nombre, { semana: reg.semana, horas });
  }
  return salida;
}

function dentro(fecha: string, desde: string, hasta: string): boolean {
  const f = fecha.slice(0, 10);
  return Boolean(f) && (!desde || f >= desde.slice(0, 10)) && (!hasta || f <= hasta.slice(0, 10));
}

function estadoDeDistribucion(dashboard: MonitoreoAulasDashboard, config: MonitoreoAulasConfig | null | undefined): EstadoDeDistribucion {
  const destino = config?.distribucion_sheets;
  if (!destino?.spreadsheet_id) {
    return {
      estado: "sin-destino",
      texto: "Todavía no hay Sheets de distribución: se crea y se siembra desde Control › Distribución.",
    };
  }
  const vigente = dashboard.reparto?.distribucion;
  const publicadas = Number(destino.citas) || 0;
  const delReparto = Number(vigente?.citas) || 0;
  const cuando = fechaCorta(destino.updated_at);
  if (vigente?.huella && destino.huella && vigente.huella === destino.huella) {
    return { estado: "al-dia", texto: `Al día: publicada ${cuando} con las ${fmt(publicadas)} citas del reparto vigente.` };
  }
  const diferencia = delReparto - publicadas;
  return {
    estado: "desactualizada",
    texto: `Publicada ${cuando} con ${fmt(publicadas)} citas; el reparto vigente tiene ${fmt(delReparto)}${diferencia > 0 ? `: la próxima publicación agrega ${fmt(diferencia)} filas a su semana` : ""}. Lo que el equipo ajustó a mano no se reescribe.`,
  };
}

export function construirAplicadores(
  dashboard: MonitoreoAulasDashboard | null,
  config: MonitoreoAulasConfig | null | undefined,
  tramoPedido = "",
): ModeloAplicadores {
  if (!dashboard) return { estado: "sin-datos", causa: "Sin tablero todavía." };
  const declaradas = semanasDeclaradas(dashboard);
  const asignaciones: Array<MonitoreoAulasRepartoAsignacion & { fecha: string }> = [];
  for (const d of dashboard.reparto?.dias ?? []) {
    for (const a of d.asignaciones ?? []) asignaciones.push({ ...a, fecha: d.fecha });
  }
  if (!declaradas.size && !asignaciones.length) {
    return { estado: "sin-datos", causa: "No hay disponibilidad declarada: importa la de los aplicadores para que el reparto pueda asignarles citas." };
  }

  const tramos: TramoDeLaVista[] = (dashboard.tramos ?? []).map((t) => ({
    nombre: t.nombre,
    rango: [fechaCorta(t.desde), fechaCorta(t.hasta)].filter(Boolean).join(" – "),
    citas: Number(t.citas) || 0,
    aplicadas: Number(t.aplicadas) || 0,
    vigente: Boolean(t.vigente),
    elegido: false,
    desde: t.desde,
    hasta: t.hasta,
  }));
  const elegido = tramos.find((t) => t.nombre === tramoPedido)
    ?? tramos.find((t) => t.vigente)
    ?? tramos[tramos.length - 1]
    ?? null;
  if (elegido) elegido.elegido = true;

  const enTramo = elegido ? asignaciones.filter((a) => dentro(a.fecha, elegido.desde, elegido.hasta)) : asignaciones;
  const partes = (dashboard.partes_campo ?? []) as Array<Record<string, unknown>>;
  const nombres = new Set<string>([...declaradas.keys(), ...enTramo.map((a) => a.aplicador.trim())]);

  const filas: FilaDeAplicador[] = [...nombres].filter(Boolean).map((nombre) => {
    const suyas = enTramo.filter((a) => a.aplicador.trim() === nombre);
    const porDia = new Map<string, number>();
    for (const a of suyas) porDia.set(a.fecha, (porDia.get(a.fecha) ?? 0) + 1);
    const maxPorDia = Math.max(0, ...porDia.values());
    const aplicadas = partes.filter((p) => String(p.applied_by ?? "").trim() === nombre
      && (!elegido || dentro(String(p.applied_at ?? p.applied_date ?? ""), elegido.desde, elegido.hasta))).length;
    const decl = declaradas.get(nombre);
    return {
      nombre,
      semana: decl?.semana ?? semanaVacia(),
      horas: decl?.horas ?? 0,
      citas: suyas.length,
      fijadas: suyas.filter((a) => a.fijada).length,
      dias: porDia.size,
      maxPorDia,
      sobreTope: maxPorDia > TOPE_POR_VIAJE,
      aplicadas,
      sinDisponibilidad: !decl,
    };
  }).sort((a, b) => b.citas - a.citas || a.nombre.localeCompare(b.nombre, "es"));

  const sinCitas = filas.filter((f) => !f.citas && !f.sinDisponibilidad).length;
  const pie = [
    `${fmt(declaradas.size)} con disponibilidad declarada`,
    sinCitas ? `${fmt(sinCitas)} sin citas en este tramo` : null,
    filas.some((f) => f.sinDisponibilidad) ? `${fmt(filas.filter((f) => f.sinDisponibilidad).length)} con citas pero sin disponibilidad declarada` : null,
  ].filter(Boolean).join(" · ");

  return { estado: "listo", tramos, elegido, filas, distribucion: estadoDeDistribucion(dashboard, config), pie };
}

export const MARCA_APLICADORES_AULAS = "monitoreo-aulas-insumos-aplicadores";
export function readinessDeAplicadores(cargando: boolean, modelo: ModeloAplicadores | null): string {
  if (cargando || !modelo) return "false";
  return modelo.estado === "listo" ? MARCA_APLICADORES_AULAS : "vacio:sin-disponibilidad";
}
