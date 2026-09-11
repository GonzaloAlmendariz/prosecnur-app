import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * **Qué fue de los refuerzos que la app marcó.**
 *
 * Gonzalo, 2026-09-11: «¿la app sabe reconocer cuándo pasó de su estado especial
 * a estar en contacto o incluso agendado o aplicado?».
 *
 * Sabe, y no hace falta guardar una lista aparte: al marcar, el motor escribe
 * `activation_origin` —«refuerzo» o «complemento»— y `activated_at`, y **esos
 * dos campos no los toca el equipo**. El estado de muestra sí se mueve —el
 * agendador teclea EN CONTACTO, luego AGENDADA— así que la pareja de campos
 * dice *que la app la pidió* y el estado dice *dónde está ahora*.
 *
 * Sin esto, marcar era un acto sin vuelta: se perdía de la lista de candidatas y
 * no aparecía en ninguna otra, así que no había forma de saber si la gestión
 * avanzó, se atascó o se cayó.
 */

const texto = (v: unknown) => (v == null ? "" : String(v).trim());
const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Los orígenes que escribe la app al marcar. Los de `activar-reemplazo` son otros. */
const ORIGENES_DE_LA_APP = new Set(["refuerzo", "complemento"]);

export type PasoDelRefuerzo =
  | "por_contactar" | "en_gestion" | "con_fecha" | "aplicado" | "rechazado" | "otro";

export type RefuerzoSeguido = {
  codigo: string;
  facultad: string;
  docente: string;
  /** «refuerzo» (C) o «complemento» (B). */
  origen: string;
  /** A quién ayuda: una facultad en C, un curso-horario en B. */
  para: string;
  /** Cuándo lo marcó la app, tal como lo selló el motor. */
  desde: string;
  paso: PasoDelRefuerzo;
  /** Respuestas válidas que ya trajo. */
  validas: number;
};

export type SeguimientoDeRefuerzos = {
  pedidos: RefuerzoSeguido[];
  /** El reparto por paso, que es la lectura de una línea. */
  cuenta: Record<PasoDelRefuerzo, number>;
  /** Los que ya no dependen de nadie: con fecha o aplicados. */
  avanzaron: number;
  /** Los que siguen esperando una llamada. */
  esperando: number;
};

/**
 * En qué punto está un refuerzo pedido.
 *
 * El orden importa y es el de siempre en este perfil: **el hecho antes que el
 * verbo**. Si ya trajo respuestas, está aplicado diga lo que diga su estado —el
 * eje de muestra lo teclea una persona y llega tarde—.
 */
export function pasoDelRefuerzo(fila: MonitoreoAulasPlanRow): PasoDelRefuerzo {
  if (numero(fila.respuestas_validas) > 0) return "aplicado";
  const op = texto(fila.operational_status).toLowerCase();
  if (["aplicada", "cerrada", "parcial"].includes(op)) return "aplicado";
  const sm = texto(fila.sample_status).toLowerCase();
  if (sm === "refuerzo_por_contactar") return "por_contactar";
  if (sm === "en_contacto") return "en_gestion";
  if (sm === "agendada" || sm === "reagendada") return "con_fecha";
  if (sm === "rechazo") return "rechazado";
  return "otro";
}

export function seguimientoDeRefuerzos(
  plan: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
): SeguimientoDeRefuerzos {
  const cuenta: Record<PasoDelRefuerzo, number> = {
    por_contactar: 0, en_gestion: 0, con_fecha: 0, aplicado: 0, rechazado: 0, otro: 0,
  };
  const pedidos: RefuerzoSeguido[] = [];

  for (const f of plan ?? []) {
    if (!ORIGENES_DE_LA_APP.has(texto(f.activation_origin).toLowerCase())) continue;
    const paso = pasoDelRefuerzo(f);
    cuenta[paso] += 1;
    pedidos.push({
      codigo: texto(f.operational_code),
      facultad: texto(f.faculty),
      docente: texto(f.teacher),
      origen: texto(f.activation_origin).toLowerCase(),
      para: texto((f as { activated_for?: unknown }).activated_for),
      desde: texto((f as { activated_at?: unknown }).activated_at),
      paso,
      validas: numero(f.respuestas_validas),
    });
  }

  // Primero lo que sigue esperando, que es lo único accionable; lo aplicado va al
  // final porque es registro.
  const ORDEN: Record<PasoDelRefuerzo, number> = {
    por_contactar: 0, en_gestion: 1, rechazado: 2, con_fecha: 3, aplicado: 4, otro: 5,
  };
  pedidos.sort((a, b) => ORDEN[a.paso] - ORDEN[b.paso] || a.codigo.localeCompare(b.codigo, "es"));

  return {
    pedidos,
    cuenta,
    avanzaron: cuenta.con_fecha + cuenta.aplicado,
    esperando: cuenta.por_contactar + cuenta.en_gestion,
  };
}
