// El título con el que una lámina va a salir, como lo decide el motor: el escrito o, si no hay, el de la pregunta del
// gráfico (`tituloPorDefecto`). Una lámina sin ninguno devuelve "": la maqueta y la Estructura mostraban en su lugar el
// nombre del tipo («Un gráfico») como si fuera su título (recorrido de Arte y Diseño, 2026-10-13).
import type { Slide } from "../../../api/graficos";
import type { VarWithSource } from "../useVariables";
import { tituloDeLamina } from "../rotuloLamina";
import { tituloPorDefecto } from "./contenidoEspecial/modeloContenidoEspecial";

export function tituloQueSale(slide: Slide, variables: readonly VarWithSource[], tipoLabel: string): string {
  const escrito = tituloDeLamina(slide.payload);
  if (escrito) return escrito;
  const inferido = tituloPorDefecto(slide, variables, tipoLabel).placeholder;
  return inferido !== tipoLabel ? inferido : "";
}
