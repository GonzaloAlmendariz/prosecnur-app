// Resumen vivo de lo que un nodo del lienzo referencia (ADR 0047).
//
// El nodo guarda solo `{target_type, target_id}`. El contenido se resuelve acá,
// en cada render, contra el estado que la página ya tiene cargado. Por eso
// editar un hito cambia lo que su nodo muestra sin sincronizar nada.
//
// Resolver en el cliente y no leer `vinculos.resumenes` del servidor es
// deliberado: ese índice se arma desde los vínculos PERSISTIDOS, así que un
// nodo recién insertado —o uno cuyo autosave todavía no salió— se leería como
// huérfano y ofrecería convertirse en nota. El aviso de destino perdido tiene
// que significar «lo borraron», nunca «todavía no guardaste».

import type { BitacoraEstado, BitacoraResumenDestino } from "../../../api/bitacora";
import type { BitacoraTipoDestino } from "../../../api/planTrabajo";
import { diaLocal } from "../diaLocal";

const AUSENTE: BitacoraResumenDestino = {
  existe: false,
  tipo: "",
  id: "",
  titulo: "",
  detalle: "",
  estado: "",
  fase: "",
  fecha: "",
};

/** El vocabulario real de `PlanTrabajoTaskStatus`, no uno inventado. */
const ESTADOS: Record<string, string> = {
  planned: "Planificado",
  active: "En curso",
  done: "Hecho",
  blocked: "Bloqueado",
  risk: "En riesgo",
};

/**
 * Un destino de tipo `modulo` no pasa por acá: su identidad la resuelve
 * `identidadDeDestino` contra `lib/modules.ts`, que es donde vive el catálogo.
 */
export function resumenVivo(
  estado: BitacoraEstado,
  ref: { target_type: BitacoraTipoDestino; target_id: string } | null,
): BitacoraResumenDestino {
  if (!ref?.target_id) return AUSENTE;

  if (ref.target_type === "tarea") {
    const tarea = estado.plan?.tasks?.find((t) => t.id === ref.target_id);
    if (!tarea) return { ...AUSENTE, tipo: "tarea", id: ref.target_id };
    return {
      existe: true,
      tipo: "tarea",
      id: tarea.id,
      titulo: tarea.activity,
      detalle: tarea.responsible ?? "",
      estado: ESTADOS[tarea.status] ?? "",
      fase: tarea.fase ?? "",
      fecha: rangoDeFechas(tarea.start_date, tarea.end_date),
    };
  }

  if (ref.target_type === "entrada") {
    const entrada = estado.bitacora?.find((e) => e.id === ref.target_id);
    if (!entrada) return { ...AUSENTE, tipo: "entrada", id: ref.target_id };
    return {
      existe: true,
      tipo: "entrada",
      id: entrada.id,
      titulo: entrada.title,
      detalle: entrada.body ?? "",
      estado: entrada.tone ?? "",
      fase: entrada.module_id ?? "",
      fecha: diaLocal(entrada.occurred_at ?? ""),
    };
  }

  return { ...AUSENTE, tipo: ref.target_type, id: ref.target_id };
}

/**
 * Una fase se lee «inicio → fin»; un entregable, con una sola fecha.
 *
 * Una fase recién sembrada todavía no tiene fechas, y ahí el nodo lo dice en
 * vez de dejar el hueco: un espacio en blanco no distingue «sin fechas» de
 * «no cargó».
 */
function rangoDeFechas(inicio?: string, fin?: string): string {
  const a = (inicio ?? "").slice(0, 10);
  const b = (fin ?? "").slice(0, 10);
  if (a && b && a !== b) return `${a} → ${b}`;
  return a || b || "Sin fechas";
}
