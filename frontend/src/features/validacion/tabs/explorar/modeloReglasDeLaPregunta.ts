// "Reglas sobre esta pregunta" en Explorar (plan de fidelidad, rebanada V5),
// leídas del catálogo de reglas (contrato M3). Modelo puro: qué reglas entran,
// en qué orden, qué dice cada una a la derecha y a dónde lleva.
//
// Reglas de lectura:
//   - Entra la regla que lee la pregunta (`variables`), igual que el filtro
//     `?variable=` del catálogo. Se cruza por código, nunca por rótulo.
//   - Primero las que tienen casos por decidir; después las que revisan la
//     pregunta (`variable_revisada`) y al final las que solo la leen en su
//     condición. Dentro de cada grupo, el orden del catálogo.
//   - Una cifra que el motor no da no se escribe como 0.

import type { CatalogoCompleto, ReglaDelCatalogo } from "../../../../api/validacionCatalogo";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { FAMILIA_SIN_EVALUAR } from "../../reglas/lista/modeloCatalogo";

export type TonoDeReglaDeLaPregunta = "neutro" | "listo" | "aviso";

export type ReglaDeLaPregunta = {
  id: string;
  nombre: string;
  /** Lo que dice debajo del nombre: "Sin casos", "4 casos por decidir". */
  estado: string;
  tono: TonoDeReglaDeLaPregunta;
  /** La familia con que se abre su ficha en Reglas (la columna izquierda). */
  familia: string;
};

/** Cuántas reglas se ven antes de "Ver las N reglas". */
export const REGLAS_A_LA_VISTA = 6;

function unidad(regla: ReglaDelCatalogo, n: number): string {
  if (regla.ultima_auditoria?.nivel === "registro") return n === 1 ? "registro" : "registros";
  return n === 1 ? "caso" : "casos";
}

/** Casos de la última auditoría que siguen sin decisión; `null` si la regla no tiene auditoría. */
function porDecidir(regla: ReglaDelCatalogo): number | null {
  const ultima = regla.ultima_auditoria;
  if (!regla.activa || regla.estado_evaluacion === "sin_evaluar" || !ultima || ultima.n_casos === null) return null;
  return Math.max(0, ultima.n_casos - (ultima.n_decididos ?? 0));
}

export function estadoDeLaRegla(regla: ReglaDelCatalogo): { estado: string; tono: TonoDeReglaDeLaPregunta } {
  if (!regla.activa) return { estado: "Desactivada", tono: "neutro" };
  if (regla.estado_evaluacion === "sin_evaluar") return { estado: regla.causa ?? "No se pudo evaluar", tono: "aviso" };
  const ultima = regla.ultima_auditoria;
  if (!ultima || ultima.n_casos === null) return { estado: "Sin auditar", tono: "neutro" };
  if (ultima.n_casos === 0) return { estado: "Sin casos", tono: "listo" };
  const pendientes = porDecidir(regla) ?? 0;
  if (pendientes > 0) {
    return { estado: `${formatoConteo(pendientes)} ${unidad(regla, pendientes)} por decidir`, tono: "aviso" };
  }
  return { estado: `${formatoConteo(ultima.n_casos)} ${unidad(regla, ultima.n_casos)}, todos decididos`, tono: "listo" };
}

/** Las reglas que leen la pregunta, en el orden del panel. */
export function reglasDeLaPregunta(catalogo: CatalogoCompleto, variable: string): ReglaDeLaPregunta[] {
  const leen = catalogo.reglas
    .map((regla, posicion) => ({ regla, posicion }))
    .filter(({ regla }) => regla.variables.includes(variable) || regla.variable_revisada === variable);
  const clave = ({ regla, posicion }: { regla: ReglaDelCatalogo; posicion: number }) => [
    (porDecidir(regla) ?? 0) > 0 ? 0 : 1,
    regla.variable_revisada === variable ? 0 : 1,
    posicion,
  ];
  return leen
    .sort((a, b) => {
      const ka = clave(a);
      const kb = clave(b);
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
    })
    .map(({ regla }) => ({
      id: regla.id,
      nombre: regla.nombre,
      ...estadoDeLaRegla(regla),
      familia: regla.estado_evaluacion === "sin_evaluar" ? FAMILIA_SIN_EVALUAR : regla.familia,
    }));
}
