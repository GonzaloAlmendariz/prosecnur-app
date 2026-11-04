import { formatoDecimal } from "../../../../../lib/formatoNumero";
import type { MonitoreoAulasDashboard, MonitoreoRow } from "../../../../../api/monitoreo";
import { fmt } from "../kpisDeAulas";

/**
 * Control › Registro de campo (ficha Ctl4), con el contrato del 31 de octubre
 * (P5: «manda la hoja»). El parte se lee del libro —hoja «Aulas Aplicadas
 * (Campo)»— y se corrige allí; aquí se ve, se cuenta contra sí mismo y contra
 * Kobo. Lo único que se declara en la app es el caso B o C de una reserva que
 * entró sin que cayera su titular.
 */

export type FiltroDePartes = "todos" | "con" | "sin";

export type ItemDeParte = {
  codigo: string;
  facultad: string;
  conParte: boolean;
  /** «Cuadra», «Faltan 3», «Sin parte»… */
  lectura: string;
  tono: "ok" | "aviso" | "riesgo" | "neutro";
};

export type ParteLeido = {
  codigo: string;
  facultad: string;
  curso: string;
  franja: Array<{ rotulo: string; valor: string }>;
  campos: Array<{ rotulo: string; valor: string }>;
  cuadre: { texto: string; tono: "ok" | "aviso" | "neutro" };
};

export type ReservaSinCaso = {
  codigo: string;
  facultad: string;
  /** El titular que completaría como B (su `replacement_for`). */
  titular: string;
  estado: string;
};

export type ModeloRegistro =
  | { estado: "sin-tablero" }
  | {
    estado: "listo";
    items: ItemDeParte[];
    elegido: ParteLeido | null;
    sinCaso: ReservaSinCaso[];
    cuentas: Record<FiltroDePartes, number>;
  };

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}

function numero(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cifra(v: unknown): string {
  const n = numero(v);
  return n == null ? "—" : fmt(n);
}

/** «2026-09-10 10:58» (hora del libro) → «10/09 10:58», como el resto de la app. */
export function fechaDelParte(raw: unknown): string {
  const valor = texto(raw);
  const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?/);
  if (!m) return valor;
  return m[4] ? `${m[3]}/${m[2]} ${m[4]}` : `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}

function lecturaDe(p: MonitoreoRow): Pick<ItemDeParte, "lectura" | "tono"> {
  const dif = numero(p.diferencia);
  if (p.cuadra === true) return { lectura: "Cuadra", tono: "ok" };
  if (p.cuadra === false && dif != null) {
    const k = Math.abs(dif);
    return { lectura: dif < 0 ? `${k === 1 ? "Falta" : "Faltan"} ${fmt(k)}` : `${k === 1 ? "Sobra" : "Sobran"} ${fmt(k)}`, tono: "aviso" };
  }
  return { lectura: "Sin datos para cuadrar", tono: "neutro" };
}

export function construirRegistro(
  dashboard: MonitoreoAulasDashboard | null,
  filtro: FiltroDePartes = "todos",
  pedido = "",
): ModeloRegistro {
  if (!dashboard) return { estado: "sin-tablero" };
  const partes = (dashboard.partes_campo ?? []) as MonitoreoRow[];
  const plan = (dashboard.agenda ?? []) as MonitoreoRow[];
  const planDe = new Map(plan.map((f) => [texto(f.operational_code), f]));
  const parteDe = new Map(partes.map((p) => [texto(p.operational_code), p]));

  const con: ItemDeParte[] = partes.map((p) => {
    const codigo = texto(p.operational_code);
    return { codigo, facultad: texto(planDe.get(codigo)?.faculty ?? p.faculty), conParte: true, ...lecturaDe(p) };
  });
  // Sin parte: tiene respuestas en Kobo y el libro todavía no trae su parte.
  const sin: ItemDeParte[] = plan
    .filter((f) => (numero(f.respuestas_validas) ?? 0) > 0 && !parteDe.has(texto(f.operational_code)))
    .map((f) => ({ codigo: texto(f.operational_code), facultad: texto(f.faculty), conParte: false, lectura: "Sin parte en el libro", tono: "riesgo" as const }));
  const todos = [...sin, ...con].sort((a, b) =>
    Number(a.tono === "ok") - Number(b.tono === "ok") || a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  const items = filtro === "con" ? todos.filter((i) => i.conParte) : filtro === "sin" ? todos.filter((i) => !i.conParte) : todos;

  const codigo = items.find((i) => i.codigo === pedido)?.codigo ?? items[0]?.codigo ?? "";
  const p = parteDe.get(codigo);
  const f = planDe.get(codigo);
  const elegido: ParteLeido | null = codigo ? {
    codigo,
    facultad: texto(f?.faculty ?? p?.faculty),
    curso: texto(f?.course_name),
    franja: [
      { rotulo: "Elegibles", valor: cifra(f?.eligible_n) },
      { rotulo: "Esperadas", valor: numero(f?.expected_valid) == null ? "—" : formatoDecimal(numero(f?.expected_valid), 1) },
      { rotulo: "Efectivas en Kobo", valor: cifra(f?.respuestas_validas) },
    ],
    campos: p ? [
      { rotulo: "Estado", valor: texto(p.application_status) || "—" },
      { rotulo: "Aula real", valor: texto(p.actual_room) || "—" },
      { rotulo: "Aplicador", valor: texto(p.applied_by) || "—" },
      { rotulo: "Fecha y hora", valor: fechaDelParte(p.applied_at) || "—" },
      { rotulo: "Asistentes", valor: cifra(p.observed_students) },
      { rotulo: "Rechazos", valor: cifra(p.refusals) },
      { rotulo: "Ya habían respondido", valor: cifra(p.duplicates) },
      { rotulo: "Encuestas aplicadas", valor: cifra(p.effective_surveys) },
      { rotulo: "Observaciones", valor: texto(p.notes ?? p.observations) || "—" },
    ] : [],
    cuadre: !p
      ? { texto: "El libro todavía no trae el parte de este curso-horario.", tono: "aviso" }
      : p.cuadra === true
        ? { texto: "El parte cuadra: asistentes menos rechazos y duplicados dan lo que el parte declara.", tono: "ok" }
        : p.cuadra === false
          ? { texto: `El parte no cuadra: ${lecturaDe(p).lectura.toLowerCase()}. Se corrige en la hoja del libro.`, tono: "aviso" }
          : { texto: "Al parte le falta una cifra para cuadrar.", tono: "neutro" },
  } : null;

  // Reservas que entraron sin que cayera su titular y no declaran B ni C.
  const activadas = ((dashboard.refuerzos as { activadas?: unknown } | null)?.activadas ?? []) as Array<Record<string, unknown>>;
  const sinCaso: ReservaSinCaso[] = activadas
    .filter((a) => texto(a.clase) === "adicional" && !texto(a.caso))
    .map((a) => {
      const cod = texto(a.codigo);
      const fila = planDe.get(cod);
      return {
        codigo: cod,
        facultad: texto(a.facultad),
        titular: texto(fila?.replacement_for ?? fila?.titular_operational_code),
        estado: texto(a.estado),
      };
    });

  return { estado: "listo", items, elegido, sinCaso, cuentas: { todos: todos.length, con: con.length, sin: sin.length } };
}

export const MARCA_REGISTRO_AULAS = "monitoreo-aulas-control-registro";
export function readinessDeRegistro(cargando: boolean, dashboard: MonitoreoAulasDashboard | null): string {
  if (cargando) return "false";
  return dashboard ? MARCA_REGISTRO_AULAS : "vacio:sin-tablero";
}
