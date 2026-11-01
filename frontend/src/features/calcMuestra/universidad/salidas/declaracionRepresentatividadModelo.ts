import type { PlannerEstado } from "../../../../api/planner";
import type { VistaPreviaDeRepresentatividad } from "../../../../api/calcMuestraRepresentatividad";

/**
 * «Declarar en el Planner» (ADR 0121 F4, decisión de Meta B 2026-10-31): el
 * escenario dice qué universo y qué variables de cuota usa, y se declaran en el
 * Planner, que es donde el estudio se define una sola vez. Monitoreo los lee de
 * ahí. Las cuotas no se tocan: siguen en el escenario.
 *
 * El estado compara lo que se declararía con lo que el Planner ya declara:
 * - sin-diseno: el escenario todavía no fija metas; no hay qué declarar.
 * - sin-declarar: el Planner no declara la representatividad de aulas.
 * - al-dia: lo declarado coincide con el escenario (universo y variables).
 * - distinto: el Planner declara otra cosa; se dice qué y se ofrece actualizar.
 */

export type EstadoDeDeclaracion = "sin-diseno" | "sin-declarar" | "al-dia" | "distinto";

export type ModeloDeclaracion = {
  estado: EstadoDeDeclaracion;
  universo: string;
  variables: string[];
  /** Lo que difiere del Planner, en una frase; vacío si nada. */
  diferencia: string;
  boton: string | null;
  revision: number;
};

type Declarada = { universo: string; claves: string[] };

function declaradaEnPlanner(planner: PlannerEstado | null): Declarada | null {
  if (!planner || planner.origen.perfiles !== "declarado") return null;
  const aulas = planner.planner.perfiles.find((p) => p.tipo === "aulas");
  const rep = aulas?.poblaciones.find((p) => (p.representatividad?.variables ?? []).length)?.representatividad;
  if (!rep) return null;
  return {
    universo: rep.universo?.etiqueta || rep.universo?.valor || rep.universo?.nivel || "",
    claves: (rep.variables ?? []).map((v) => v.clave),
  };
}

function rotuloDeUniverso(u: { nivel: string; valor: string; etiqueta: string }): string {
  if (u.nivel === "facultad") return `Facultad: ${u.etiqueta || u.valor}`;
  if (u.nivel === "universidad") return u.etiqueta && u.etiqueta !== "Universidad" ? `Universidad: ${u.etiqueta}` : "Toda la universidad";
  return u.etiqueta || u.valor || "Sin universo deducible";
}

export function construirDeclaracion(vista: VistaPreviaDeRepresentatividad | null, planner: PlannerEstado | null): ModeloDeclaracion {
  const revision = planner?.revision ?? 0;
  const rep = vista?.representatividad ?? null;
  if (!vista?.disponible || !rep) {
    return { estado: "sin-diseno", universo: "", variables: [], diferencia: "", boton: null, revision };
  }
  const universo = rotuloDeUniverso(rep.universo);
  const variables = rep.variables.map((v) => v.etiqueta);
  const claves = rep.variables.map((v) => v.clave);
  const declarada = declaradaEnPlanner(planner);
  if (!declarada) {
    return { estado: "sin-declarar", universo, variables, diferencia: "", boton: "Declarar en el Planner", revision };
  }
  const mismasVariables = declarada.claves.join("|") === claves.join("|");
  if (mismasVariables) {
    return { estado: "al-dia", universo, variables, diferencia: "", boton: null, revision };
  }
  return {
    estado: "distinto",
    universo,
    variables,
    diferencia: `El Planner declara ${declarada.claves.join(" × ") || "otras variables"}; el escenario usa ${claves.join(" × ")}.`,
    boton: "Actualizar la declaración",
    revision,
  };
}
