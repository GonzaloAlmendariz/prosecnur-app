// P8 (Gonzalo 2026-10-11): «si hay gráficos que aún no tienen paleta configurada cuando deberían […] no se puede
// exportar. Tenemos que asegurar que el usuario tenga todo definido antes de exportar pero también que pueda hacerlo
// fácilmente». Un gráfico que pinta cada respuesta con su color bloquea la exportación mientras a su paleta le falte
// algún color; el arreglo en un clic completa sólo lo que falta con la primera combinación de la marca.

import type { Slide } from "../../../api/graficos";
import type { MapaPaletas } from "../paletasResolver";
import { SLIDE_GRAF_SLOTS } from "../store";
import { GRAFICOS_POR_CATEGORIA, preguntasDelGrafico } from "../laminas/modeloMaqueta";
import { varCalificada } from "../laminas/ordenCategorias";
import type { ListaRespuestas } from "./modeloColoresRespuestas";
import { coloresParaCompletar, conColoresDeFila, paletaDeLaPregunta, type FilaPaleta } from "./modeloPaletasConNombre";

export type ColorPendiente = { slideId: string; numero: number; slot: string; pregunta: string; fila: FilaPaleta };

export function coloresPendientes(
  slides: readonly Pick<Slide, "id" | "tipo" | "payload">[],
  filas: readonly FilaPaleta[],
  baseActiva: string | null | undefined,
  scope: "active" | "consolidated",
): ColorPendiente[] {
  const out: ColorPendiente[] = [];
  slides.forEach((slide, i) => {
    const payload = (slide.payload ?? {}) as Record<string, unknown>;
    for (const slot of SLIDE_GRAF_SLOTS[slide.tipo] ?? []) {
      const ref = payload[slot] as { graficador?: unknown; args?: unknown } | undefined;
      if (!ref || typeof ref.graficador !== "string" || !GRAFICOS_POR_CATEGORIA.has(ref.graficador)) continue;
      const args = (ref.args && typeof ref.args === "object" ? ref.args : {}) as Record<string, unknown>;
      const vistas = new Set<string>();
      for (const pregunta of preguntasDelGrafico(args)) {
        const hallada = paletaDeLaPregunta(filas, varCalificada(pregunta, baseActiva, scope)) ?? paletaDeLaPregunta(filas, pregunta);
        if (!hallada || hallada.fila.faltan === 0 || vistas.has(hallada.fila.id)) continue;
        vistas.add(hallada.fila.id);
        const texto = hallada.grupo.preguntas.find((p) => p.ref.split("$").pop() === pregunta.split("$").pop())?.texto ?? pregunta;
        out.push({ slideId: slide.id, numero: i + 1, slot, pregunta: texto, fila: hallada.fila });
      }
    }
  });
  return out;
}

/** Completa, en cada paleta pendiente, sólo los colores que faltan, con la primera combinación de la marca. */
export function conColoresCompletados(pendientes: readonly ColorPendiente[], listas: readonly ListaRespuestas[], paletas: MapaPaletas): MapaPaletas {
  const filas = new Map(pendientes.map((p) => [p.fila.id, p.fila]));
  let out = paletas;
  for (const fila of filas.values()) out = conColoresDeFila(fila, coloresParaCompletar(fila), listas, out);
  return out;
}
