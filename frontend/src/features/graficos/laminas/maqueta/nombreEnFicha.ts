// F1 de la ronda 4: la ficha de una lámina que insertó el mazo nombraba el tipo de su gráfico («Escala con Sin información
// aparte») y no el nombre con que el mazo la guardó en `meta.nombre` («Escala bajo 60%, Docentes»). Ese nombre manda,
// como en la Estructura (nombreSinTitulo), cuando la lámina tiene un solo gráfico: el nombre es de la lámina, no de
// cada ranura. La Dicotómica conserva su nombre porque de él sale su ícono (FichaRanura). Pura: sin React.
import type { Slide } from "../../../../api/graficos";
import { leerSlideMeta } from "../../slideMeta";
import { nombreSinTitulo } from "../tituloQueSale";

export function nombreTipoEnFicha(slide: Slide, nombreTipo: string | null, graficosEnLamina: number): string | null {
  if (!nombreTipo || nombreTipo === "Dicotómica" || graficosEnLamina !== 1) return nombreTipo;
  const meta = leerSlideMeta(slide).nombre;
  if (typeof meta !== "string" || !meta.trim()) return nombreTipo;
  return nombreSinTitulo(slide) || nombreTipo;
}
