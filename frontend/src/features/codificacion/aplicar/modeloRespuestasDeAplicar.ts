// Codificación, Aplicar: la pestaña "Respuestas" del detalle (prototipo): cada texto distinto de la
// pregunta con sus veces y el código con que entra a la base. Puro. Sale de lo mismo que lee Codificar
// (`/api/codificacion/respuestas`), con las claves alineadas como en el motor (`clavesDeGrupo.ts`).

import type { Grupo, RespuestaUnica } from "../../../api/codificacion";
import { displayRespuestaLabel } from "../codificacionLabels";
import { alinearClavesConRespuestas } from "../codificar/clavesDeGrupo";

export type FilaDeRespuestaAplicada = {
  clave: string;
  texto: string;
  titulo: string;
  veces: number;
  /** "12. Espacios públicos"; vacío si la respuesta entra sin código. */
  codigos: string[];
};

export function respuestasAplicadas(respuestas: readonly RespuestaUnica[], grupos: readonly Grupo[]): FilaDeRespuestaAplicada[] {
  const alineados = alinearClavesConRespuestas(grupos, respuestas);
  const porClave = new Map<string, string[]>();
  for (const g of alineados) {
    const rotulo = g.etiqueta?.trim() ? `${g.codigo}. ${g.etiqueta.trim()}` : g.codigo;
    for (const clave of g.respuestas) porClave.set(clave, [...(porClave.get(clave) ?? []), rotulo]);
  }
  return respuestas
    .map((r) => {
      const d = displayRespuestaLabel(r.texto, r.label);
      return { clave: r.texto_normalizado, texto: d.label, titulo: d.title, veces: r.frecuencia ?? 0, codigos: porClave.get(r.texto_normalizado) ?? [] };
    })
    .sort((a, b) => b.veces - a.veces || a.texto.localeCompare(b.texto, "es"));
}
