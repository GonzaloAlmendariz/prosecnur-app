import type { MonitoreoAulasConfig, MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { fmt } from "../kpisDeAulas";
import { fechaCorta } from "../insumos/fuentesModelo";

/**
 * Control › Distribución (ficha Ctl3, maqueta v3). ¿Quién va a cada cita?
 *
 * El reparto del día por aplicador, sobre la escala de 7:00 a 22:00: su
 * disponibilidad declarada de fondo, cada cita en su hora (fijadas a mano
 * aparte: mandan) y el recojo antes. A la derecha, la hoja que ven los
 * aplicadores con su mecanismo (se siembra la semana una vez, después sólo se
 * agrega lo nuevo y se retiran las cerradas; lo manual manda), el cruce con la
 * agenda y las citas por aplicador.
 */

export const HORA_INICIO = 7;
export const HORA_FIN = 22;
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const ROTULO_DIA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export type Bloque = { izquierda: number; ancho: number };
export type CitaEnLinea = Bloque & { codigo: string; inicio: string; fijada: boolean; advertencia: string; recojo: Bloque | null };
export type FilaDeAplicador = { aplicador: string; semana: number; disponible: Bloque[]; citas: CitaEnLinea[] };
export type DiaDelReparto = { fecha: string; rotulo: string; citas: number };

export type ModeloDistribucion =
  | { estado: "sin-tablero" }
  | { estado: "sin-reparto"; causa: string }
  | {
    estado: "listo";
    rango: string;
    dias: DiaDelReparto[];
    elegido: string;
    filas: FilaDeAplicador[];
    concentrado: boolean;
    cruce: Array<{ clave: string; rotulo: string; valor: number; detalle: string }>;
    equidad: Array<{ aplicador: string; citas: number; ancho: number }>;
    hoja: { conectada: boolean; texto: string; desactualizada: boolean };
    fijadas: number;
  };

function minutos(hhmm: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((hhmm ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function bloque(desde: number, hasta: number): Bloque | null {
  const a = Math.max(desde, HORA_INICIO * 60);
  const b = Math.min(hasta, HORA_FIN * 60);
  if (b <= a) return null;
  const total = (HORA_FIN - HORA_INICIO) * 60;
  return { izquierda: (100 * (a - HORA_INICIO * 60)) / total, ancho: (100 * (b - a)) / total };
}

function sinTilde(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function diaDeSemana(fecha: string): number {
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? -1 : d.getUTCDay();
}

export function construirDistribucion(
  dashboard: MonitoreoAulasDashboard | null,
  config: MonitoreoAulasConfig | null | undefined,
  diaPedido = "",
): ModeloDistribucion {
  if (!dashboard) return { estado: "sin-tablero" };
  const reparto = dashboard.reparto;
  const diasCrudos = (reparto?.dias ?? []).filter((d) => d.fecha);
  if (!reparto || !diasCrudos.length) {
    return {
      estado: "sin-reparto",
      causa: dashboard.disponibilidad?.dias?.length
        ? "Todavía no hay citas pactadas en el rango del reparto."
        : "Sin disponibilidad de los aplicadores no hay reparto: se importa en Insumos › Aplicadores.",
    };
  }
  const dias: DiaDelReparto[] = diasCrudos.map((d) => ({
    fecha: d.fecha.slice(0, 10),
    rotulo: `${ROTULO_DIA[diaDeSemana(d.fecha)] ?? ""} ${Number(d.fecha.slice(8, 10))}`,
    citas: d.asignaciones.length,
  }));
  const masCargado = [...dias].sort((a, b) => b.citas - a.citas)[0];
  const elegido = dias.find((d) => d.fecha === diaPedido)?.fecha ?? masCargado.fecha;
  const delDia = diasCrudos.find((d) => d.fecha.slice(0, 10) === elegido)!;

  // La disponibilidad del día de la semana elegido, por nombre.
  const nombreDia = DIAS_SEMANA[diaDeSemana(elegido)] ?? "";
  const disponible = new Map<string, Bloque[]>();
  for (const dd of dashboard.disponibilidad?.dias ?? []) {
    if (sinTilde(dd.dia) !== nombreDia) continue;
    for (const f of dd.franjas ?? []) {
      const a = minutos(f.inicio); const b = minutos(f.fin);
      if (a == null || b == null) continue;
      const bl = bloque(a, b);
      if (!bl) continue;
      for (const nombre of f.nombres ?? []) {
        const n = nombre.trim();
        if (n) disponible.set(n, [...(disponible.get(n) ?? []), bl]);
      }
    }
  }

  const semana = new Map<string, number>();
  for (const d of diasCrudos) for (const a of d.asignaciones) semana.set(a.aplicador.trim(), (semana.get(a.aplicador.trim()) ?? 0) + 1);

  const porAplicador = new Map<string, CitaEnLinea[]>();
  for (const a of delDia.asignaciones) {
    const ini = minutos(a.inicio); const fin = minutos(a.fin);
    if (ini == null) continue;
    const bl = bloque(ini, fin ?? ini + 60);
    if (!bl) continue;
    const rec = minutos(a.recojo);
    const nombre = a.aplicador.trim();
    porAplicador.set(nombre, [...(porAplicador.get(nombre) ?? []), {
      ...bl, codigo: a.codigo, inicio: a.inicio, fijada: Boolean(a.fijada), advertencia: a.advertencia ?? "",
      recojo: rec != null ? bloque(rec, ini) : null,
    }]);
  }
  // Primero quienes tienen citas ese día; después los demás de la semana.
  const nombres = [...semana.keys()].sort((x, y) =>
    Number(porAplicador.has(y)) - Number(porAplicador.has(x)) || x.localeCompare(y, "es"));
  const filas: FilaDeAplicador[] = nombres.map((aplicador) => ({
    aplicador,
    semana: semana.get(aplicador) ?? 0,
    disponible: disponible.get(aplicador) ?? [],
    citas: (porAplicador.get(aplicador) ?? []).sort((a, b) => a.izquierda - b.izquierda),
  }));

  const dist = reparto.distribucion;
  const cruce = [
    { clave: "sin-aplicador", rotulo: "Agendados sin aplicador", valor: Number(dist?.agendadas_sin_cita) || 0,
      detalle: (dist?.sin_cita ?? []).slice(0, 6).map((c) => c.curso_horario).filter(Boolean).join(", ") },
    { clave: "fijadas-sin-cita", rotulo: "Fijadas sin cita", valor: (reparto.fijadas_sin_cita ?? []).length,
      detalle: (reparto.fijadas_sin_cita ?? []).slice(0, 6).join(", ") },
    { clave: "fuera-de-rango", rotulo: "Citas fuera del rango", valor: (reparto.fuera_de_rango ?? []).reduce((s, f) => s + (f.codigos?.length ?? 0), 0),
      detalle: (reparto.fuera_de_rango ?? []).map((f) => fechaCorta(f.fecha)).join(", ") },
  ];

  const max = Math.max(1, ...(reparto.equidad ?? []).map((e) => e.asignadas));
  const equidad = [...(reparto.equidad ?? [])]
    .sort((a, b) => b.asignadas - a.asignadas)
    .map((e) => ({ aplicador: e.aplicador, citas: e.asignadas, ancho: (100 * e.asignadas) / max }));

  const destino = config?.distribucion_sheets;
  const conectada = Boolean(destino?.spreadsheet_id);
  const desactualizada = conectada && Boolean(dist?.huella) && dist?.huella !== destino?.huella;
  const hoja = !conectada
    ? { conectada, desactualizada: false, texto: "Todavía no hay hoja de los aplicadores: se crea y se siembra con este reparto." }
    : desactualizada
      ? { conectada, desactualizada, texto: `Publicada ${fechaCorta(destino?.updated_at)} con ${fmt(Number(destino?.citas) || 0)} citas; el reparto tiene ${fmt(Number(dist?.citas) || 0)}. Agregar lo nuevo no reescribe lo ajustado a mano.` }
      : { conectada, desactualizada, texto: `Al día: publicada ${fechaCorta(destino?.updated_at)} con el reparto vigente.` };

  return {
    estado: "listo",
    rango: `${fechaCorta(dias[0].fecha)} – ${fechaCorta(dias[dias.length - 1].fecha)}`,
    dias,
    elegido,
    filas,
    concentrado: Boolean(reparto.concentrado),
    cruce,
    equidad,
    hoja,
    fijadas: (reparto.fijadas ?? []).length,
  };
}

export const MARCA_DISTRIBUCION_AULAS = "monitoreo-aulas-control-distribucion";
export function readinessDeDistribucion(cargando: boolean, modelo: ModeloDistribucion | null): string {
  if (cargando || !modelo) return "false";
  return modelo.estado === "listo" ? MARCA_DISTRIBUCION_AULAS : `vacio:${modelo.estado}`;
}
