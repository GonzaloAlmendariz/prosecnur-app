import type { MonitoreoInternalQueryIssue } from "../../../../../../api/client";

/**
 * Los casos que el motor marca en `internal_queries.issues`, repartidos como
 * los lee el supervisor (`acreditacion.md`, Ctl5 y A1):
 *
 * - **Esperan decisión**: el supervisor busca a mano a la persona del padrón y
 *   asigna o descarta (procedimientos respondidos). Llave fuera de base,
 *   respuesta sin llave, conflicto telefónico y parcial no identificable.
 * - **Decididos**: los que el supervisor ya asignó con salvedad.
 * - **Resueltos por regla**: duplicados, parciales identificables y rechazos de
 *   plataforma; la regla del motor ya los ubicó.
 *
 * La cifra de cada tipo es la suma de `count` del motor (una fila puede contar
 * varios casos), igual que hoy en Consultas › Subsanación.
 */

export type GrupoDeCaso = "espera" | "decidido" | "regla";

export const TIPOS_QUE_ESPERAN_DECISION: readonly string[] = [
  "fuera_base",
  "sin_llave",
  "conflicto_telefonico",
  "parcial_no_identificable",
];

const TIPOS_DECIDIDOS: readonly string[] = ["incluido_con_salvedad"];

/** Rótulo de respaldo cuando el motor no trae `label`. Nunca se pinta la clave. */
const ROTULO_DE_TIPO: Record<string, string> = {
  fuera_base: "Llave fuera de base",
  sin_llave: "Respuesta sin llave",
  conflicto_telefonico: "Conflicto telefónico",
  parcial_no_identificable: "Parcial no identificable",
  duplicado_caso: "Caso duplicado",
  parcial_identificable: "Parcial identificable",
  rechazo_plataforma: "Rechazo de plataforma",
  incluido_con_salvedad: "Asignadas por el supervisor",
};

export type TipoDeCaso = {
  tipo: string;
  etiqueta: string;
  grupo: GrupoDeCaso;
  casos: number;
};

export type CasosDelCorte = {
  esperan: number;
  porTipo: TipoDeCaso[];
};

function normalizar(valor: unknown) {
  return String(valor ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function grupoDeTipo(tipo: string): GrupoDeCaso {
  if (TIPOS_QUE_ESPERAN_DECISION.includes(tipo)) return "espera";
  if (TIPOS_DECIDIDOS.includes(tipo)) return "decidido";
  return "regla";
}

/** «Respuesta_sin_llave» → «Respuesta sin llave»: último recurso si el tipo es nuevo. */
function rotuloLegible(tipo: string) {
  const texto = tipo.replace(/[_-]+/g, " ").trim();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "Otro caso";
}

export function etiquetaDeTipo(tipo: string, etiquetaDelMotor?: string) {
  if (TIPOS_DECIDIDOS.includes(tipo)) return ROTULO_DE_TIPO[tipo];
  const delMotor = String(etiquetaDelMotor ?? "").trim();
  if (delMotor && !/[_]/.test(delMotor)) return delMotor;
  return ROTULO_DE_TIPO[tipo] ?? rotuloLegible(tipo);
}

/** Cuántos casos hay de cada tipo, opcionalmente de un solo público. */
export function casosDelCorte(
  issues: readonly MonitoreoInternalQueryIssue[],
  publico?: (actor: string) => boolean,
): CasosDelCorte {
  const porTipo = new Map<string, TipoDeCaso>();
  for (const issue of issues) {
    if (publico && !publico(String(issue.actor ?? ""))) continue;
    const tipo = normalizar(issue.issue_type);
    if (!tipo) continue;
    const casos = Number.isFinite(Number(issue.count)) && Number(issue.count) > 0 ? Number(issue.count) : 1;
    const previo = porTipo.get(tipo);
    if (previo) previo.casos += casos;
    else porTipo.set(tipo, { tipo, etiqueta: etiquetaDeTipo(tipo, issue.label), grupo: grupoDeTipo(tipo), casos });
  }
  const orden: Record<GrupoDeCaso, number> = { espera: 0, decidido: 1, regla: 2 };
  const lista = [...porTipo.values()].sort((a, b) => (
    orden[a.grupo] - orden[b.grupo]
    || (a.grupo === "espera"
      ? TIPOS_QUE_ESPERAN_DECISION.indexOf(a.tipo) - TIPOS_QUE_ESPERAN_DECISION.indexOf(b.tipo)
      : b.casos - a.casos)
  ));
  return {
    esperan: lista.filter((item) => item.grupo === "espera").reduce((suma, item) => suma + item.casos, 0),
    porTipo: lista,
  };
}

/** Cuántos casos esperan decisión en cada público, de más a menos. */
export function esperanPorPublico(issues: readonly MonitoreoInternalQueryIssue[]): Array<{ actor: string; esperan: number }> {
  const porActor = new Map<string, number>();
  for (const issue of issues) {
    const tipo = normalizar(issue.issue_type);
    if (grupoDeTipo(tipo) !== "espera") continue;
    const actor = String(issue.actor ?? "").trim() || "Sin público";
    const casos = Number.isFinite(Number(issue.count)) && Number(issue.count) > 0 ? Number(issue.count) : 1;
    porActor.set(actor, (porActor.get(actor) ?? 0) + casos);
  }
  return [...porActor].map(([actor, esperan]) => ({ actor, esperan })).sort((a, b) => b.esperan - a.esperan || a.actor.localeCompare(b.actor, "es"));
}
