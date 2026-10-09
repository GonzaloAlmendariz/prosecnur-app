/**
 * Convierte un embudo medido del backend (EmbudoPaso[]: universo → filtros →
 * resultado) en etapas del FlujoVertical, con la merma (excluidos) calculada
 * entre conteos consecutivos y expuesta en la arista. Lo comparten las pestañas
 * Población y Aulas de Marco para enseñar el embudo canónico completo con sus
 * números, en vez de un flujo colapsado de dos o tres pasos.
 */
import type { EmbudoPaso } from "../../dominio";
import { fmtInt } from "../../sharedCore";
import type { FlujoEtapa } from "../ui";

/**
 * @param pasos     embudo medido (conteo restante por paso, ya ordenado).
 * @param sustantivo etiqueta de la merma ("estudiantes" | "aulas").
 */
export function embudoEtapas(pasos: EmbudoPaso[], sustantivo: string): FlujoEtapa[] {
  return pasos.map((paso, i) => {
    const siguiente = pasos[i + 1];
    // La merma se muestra en la arista que sale de este nodo (drop al siguiente).
    const excluidos = siguiente ? Math.max(0, paso.conteo - siguiente.conteo) : 0;
    // Un paso en 0 se pintaba "pending" —indistinguible de un paso que aún no
    // corrió— y su cifra desaparecía. El criterio que VACÍA el marco es lo
    // contrario de algo pendiente: es el único que decidió. Medido en
    // HSVG26DEF, el cero de `course_level` se leía nueve pasos más abajo.
    const vacia = paso.vaciaMarco === true;
    return {
      id: paso.id,
      label: paso.label,
      valor: paso.conteo > 0 || vacia ? fmtInt(paso.conteo) : undefined,
      estado: paso.conteo > 0 ? "ready" : vacia ? "alerta" : "pending",
      detalle: vacia ? paso.aviso : undefined,
      merma: excluidos > 0 ? { n: excluidos, label: sustantivo } : undefined,
    };
  });
}
