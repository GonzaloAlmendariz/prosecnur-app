import type { VistaPreviaDeRepresentatividad } from "../../../../api/calcMuestraRepresentatividad";

/**
 * Representatividad del estudio (ADR 0121; ADR 0123 Q1): el escenario dice qué
 * universo y qué variables de cuota usa, y Cálculo las guarda en su propia clave.
 * Monitoreo las recibe en la foto del plan al importarlo. Las cuotas no se tocan:
 * siguen en el escenario.
 *
 * El estado compara lo que se guardaría con lo que Cálculo ya guardó:
 * - sin-diseno: el escenario todavía no fija metas; no hay qué guardar.
 * - sin-declarar: Cálculo todavía no guardó la representatividad.
 * - al-dia: lo guardado coincide con el escenario (variables).
 * - distinto: lo guardado es otra cosa; se dice qué y se ofrece actualizar.
 */

export type EstadoDeDeclaracion = "sin-diseno" | "sin-declarar" | "al-dia" | "distinto";

export type ModeloDeclaracion = {
  estado: EstadoDeDeclaracion;
  universo: string;
  variables: string[];
  /** Lo que difiere de lo guardado, en una frase; vacío si nada. */
  diferencia: string;
  /** Lo guardado todavía no viaja en la foto del plan que mide Monitoreo. */
  reimportar: boolean;
  boton: string | null;
};

function rotuloDeUniverso(u: { nivel: string; valor: string; etiqueta: string }): string {
  if (u.nivel === "facultad") return `Facultad: ${u.etiqueta || u.valor}`;
  if (u.nivel === "universidad") return u.etiqueta && u.etiqueta !== "Universidad" ? `Universidad: ${u.etiqueta}` : "Toda la universidad";
  return u.etiqueta || u.valor || "Sin universo deducible";
}

export function construirDeclaracion(vista: VistaPreviaDeRepresentatividad | null): ModeloDeclaracion {
  const rep = vista?.representatividad ?? null;
  if (!vista?.disponible || !rep) {
    return { estado: "sin-diseno", universo: "", variables: [], diferencia: "", boton: null, reimportar: false };
  }
  const universo = rotuloDeUniverso(rep.universo);
  const variables = rep.variables.map((v) => v.etiqueta);
  const claves = rep.variables.map((v) => v.clave);
  const declarada = vista.declarada ?? null;
  if (!declarada) {
    return { estado: "sin-declarar", universo, variables, diferencia: "", boton: "Guardar en Cálculo", reimportar: false };
  }
  if (vista.sorteoVigente === false) {
    return {
      estado: "distinto", universo, variables, reimportar: false,
      diferencia: "Lo guardado es de un sorteo anterior; Monitoreo mide otro.",
      boton: "Actualizar lo guardado",
    };
  }
  const guardadas = declarada.variables.map((v) => v.clave);
  if (guardadas.join("|") === claves.join("|")) {
    return { estado: "al-dia", universo, variables, diferencia: "", boton: null, reimportar: !vista.enLaFoto };
  }
  return {
    estado: "distinto",
    universo,
    variables,
    diferencia: `Lo guardado reparte por ${guardadas.join(" × ") || "otras variables"}; el escenario usa ${claves.join(" × ")}.`,
    boton: "Actualizar lo guardado",
    reimportar: false,
  };
}
