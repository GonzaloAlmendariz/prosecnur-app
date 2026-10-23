/**
 * Familia de cada status de la hoja según el vocabulario que declaró el
 * proyecto (`operational_model.state_rules`), con el mismo emparejamiento que
 * el motor (`monitoreo_status_reglas.R`: clave sin acentos, sin signos).
 *
 * Familias del lenguaje común: Efectiva, Parcial, Rechazo, Reintentable y
 * Terminal. Lo que la regla deja seguir en cola (`pending`, `non_effective`)
 * es Reintentable, igual que la cola de insistencia; lo que cierra
 * (`stop_contact`, `excluded`) es Terminal. Un status sin regla se ubica por su
 * nombre y lleva la marca «sin regla»: el cliente lo escribió y nadie lo ha
 * declarado todavía.
 */

import type { MonitoreoStateRule } from "../../../../../api/client";

export type FamiliaDelCliente = "efectiva" | "parcial" | "rechazo" | "reintentable" | "terminal" | "sin-llamar";

export const FAMILIAS_DEL_CLIENTE: ReadonlyArray<{ id: FamiliaDelCliente; etiqueta: string }> = [
  { id: "efectiva", etiqueta: "Efectiva" },
  { id: "parcial", etiqueta: "Parcial" },
  { id: "rechazo", etiqueta: "Rechazo" },
  { id: "reintentable", etiqueta: "Reintentable" },
  { id: "terminal", etiqueta: "Terminal" },
  { id: "sin-llamar", etiqueta: "Sin llamar" },
];

export function claveDeStatus(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function familiaDeRegla(regla: MonitoreoStateRule): FamiliaDelCliente | null {
  if (regla.stop_contact) return "terminal";
  switch (regla.final_state) {
    case "complete": return "efectiva";
    case "partial": return "parcial";
    case "refusal": return "rechazo";
    case "pending":
    case "non_effective": return "reintentable";
    case "excluded": return "terminal";
    default: return null;
  }
}

/** Ubicación por nombre cuando no hay regla; se marca «sin regla». */
function familiaPorNombre(clave: string): FamiliaDelCliente {
  if (clave === "no barrido" || clave.includes("por barrer")) return "sin-llamar";
  if (/(^| )(no|sin) (efectiv|benefici|elegib)/.test(clave)) return "terminal";
  if (clave.includes("efectiv") || clave.includes("complet")) return "efectiva";
  if (clave.includes("parcial")) return "parcial";
  if (clave.includes("rechaz")) return "rechazo";
  if (/(no existe|incorrect|suspendid|equivocad|fuera de servicio|fallecid)/.test(clave)) return "terminal";
  return "reintentable";
}

export type ClasificacionDeStatus = { familia: FamiliaDelCliente; conRegla: boolean };

export function clasificadorDeStatus(reglas: readonly MonitoreoStateRule[]) {
  const porClave = new Map<string, FamiliaDelCliente>();
  [...reglas]
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
    .forEach((regla) => {
      const familia = familiaDeRegla(regla);
      if (!familia) return;
      (regla.outcome_values ?? []).forEach((valor) => {
        const clave = claveDeStatus(valor);
        if (clave && !porClave.has(clave)) porClave.set(clave, familia);
      });
    });
  return (status: string): ClasificacionDeStatus => {
    const clave = claveDeStatus(status);
    if (clave === "no barrido") return { familia: "sin-llamar", conRegla: true };
    const declarada = porClave.get(clave);
    return declarada ? { familia: declarada, conRegla: true } : { familia: familiaPorNombre(clave), conRegla: false };
  };
}
