import type { AsignacionPlanificada, LecturaDeAsignacion } from "../../../../../api/monitoreoAsignacionPlanificada";

/**
 * La columna «Planificado» de Avance › UMP (B3): a quién le asignó Material la
 * UMP y si las respuestas que llegaron son de esa persona. Solo con la
 * asignación de la MISMA muestra que está en campo; si no, la tabla lo dice en
 * una línea y no pinta la columna.
 */

export type CeldaPlanificada = {
  codigo: string;
  /** «P844 · Ana Ruiz», o el código solo si la lista no trae nombre. */
  rotulo: string;
  lectura: LecturaDeAsignacion;
  texto: string;
  tono: "ok" | "info" | "falta" | "neutro";
  /** Lo que se vio, para el `title`: «P844 (2), P101 (1)». */
  detalle: string;
};

export type ColumnaPlanificada =
  | { tipo: "columna"; porManzana: Map<string, CeldaPlanificada>; resumen: string }
  | { tipo: "aviso"; texto: string }
  | { tipo: "nada" };

const TEXTO: Record<LecturaDeAsignacion, { texto: string; tono: CeldaPlanificada["tono"] }> = {
  coincide: { texto: "Coincide", tono: "ok" },
  coincide_con_otros: { texto: "Con otros", tono: "info" },
  otro_encuestador: { texto: "Otro encuestador", tono: "falta" },
  sin_respuestas: { texto: "Sin respuestas", tono: "neutro" },
};

export function columnaPlanificada(asignacion: AsignacionPlanificada | null): ColumnaPlanificada {
  if (!asignacion) return { tipo: "nada" };
  if (asignacion.estado === "otra_muestra") return { tipo: "aviso", texto: asignacion.motivo || "Asignación de otra muestra." };
  if (asignacion.estado !== "comparable") return { tipo: "nada" };
  const porManzana = new Map<string, CeldaPlanificada>();
  for (const u of asignacion.porUmp) {
    const { texto, tono } = TEXTO[u.lectura];
    porManzana.set(u.idManzana, {
      codigo: u.codigoPlanificado,
      rotulo: u.nombrePlanificado ? `${u.codigoPlanificado} · ${u.nombrePlanificado}` : u.codigoPlanificado,
      lectura: u.lectura,
      texto,
      tono,
      detalle: u.observados.length
        ? `Llegaron: ${u.observados.map((o) => `${o.codigo || "sin código"} (${o.respuestas})`).join(", ")}${u.heredada ? ". Código heredado del titular." : ""}`
        : `Sin respuestas todavía${u.heredada ? ". Código heredado del titular." : ""}`,
    });
  }
  const r = asignacion.resumen;
  const partes = [`${r.coinciden} coinciden`];
  if (r.otroEncuestador) partes.push(`${r.otroEncuestador} con otro encuestador`);
  if (r.coincidenConOtros) partes.push(`${r.coincidenConOtros} con otros además`);
  if (r.sinPlanificar) partes.push(`${r.sinPlanificar} con respuestas sin asignar`);
  return { tipo: "columna", porManzana, resumen: `Planificado en Material: ${partes.join(", ")}.` };
}
