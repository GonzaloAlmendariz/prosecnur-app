// La cabecera de Ponderación con la forma común del kit (`CabeceraDePestana`):
// el estado en palabra y las cifras de lo declarado. Las cuatro cifras del
// resultado viven en el panel "Efecto de ponderar" y aquí no se repiten
// (plan 8.2, "una cifra aparece una sola vez por pantalla").
//
// Aquí no se calcula nada: las cifras son las de `cifrasDeLaBanda`, con el
// rótulo que pide la tira del kit (número arriba, lo que cuenta debajo).

import type { PonderPreview } from "../../../api/analitica";
import type { EstadoDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";
import type { PonderacionConfig } from "../store";
import type { LecturaDelEfecto } from "./calculoDePonderacion";
import { cifrasDeLaBanda } from "./cifrasDePonderacion";

const ROTULOS: Record<string, { rotulo: string; titulo?: string }> = {
  "variables-de-ajuste": { rotulo: "variables de ajuste", titulo: "Variables con al menos una meta: una variable sin metas no cambia ningún peso." },
  // No se llama "población": la población censada del bloque del censo es otra cifra, con otra fuente.
  "suma-de-pesos": { rotulo: "suma de pesos", titulo: "Con pesos de expansión, los pesos suman la población que representan." },
};

/** Las cifras de la cabecera: lo declarado, nunca el resultado. Con el peso de una columna no hay ninguna. */
export function cifrasDeLaCabecera(pond: PonderacionConfig, preview: PonderPreview | null): CifraDePestana[] {
  if (!pond.enabled || pond.modo === "columna") return [];
  return cifrasDeLaBanda(pond, preview).map((c) => {
    const clave = c.clave ?? c.etiqueta;
    const rotulo = ROTULOS[clave] ?? { rotulo: c.etiqueta.toLowerCase() };
    return { clave, valor: String(c.valor), rango: clave === "variables-de-ajuste" ? 1 : 2, ...rotulo };
  });
}

/**
 * El hueco declarado de la cabecera: lo que el prototipo dibuja y el motor no
 * publica. No se pinta; queda en el marcado para la tabla de fidelidad.
 */
export const CIFRAS_PENDIENTES_DE_LA_CABECERA =
  "Población total con pesos de media 1: el motor solo la publica con pesos de expansión (total_poblacion).";

/** El estado de la pestaña, dicho en palabra. */
export function estadoDePonderacion(pond: PonderacionConfig, lectura: LecturaDelEfecto): EstadoDePestana {
  if (!pond.enabled) return { tono: "neutro", texto: "Apagada" };
  if (lectura.tipo === "error") return { tono: "atencion", texto: "Sin calcular" };
  if (lectura.tipo === "sin-efecto") return { tono: "parcial", texto: "Incompleta" };
  return { tono: "listo", texto: "Activa" };
}
