// Si las preguntas de un gráfico cuentan para el resumen ejecutivo (H14): la lámina del store, el gráfico y su Top Two
// Box tal como lo dibuja el motor (leerTwoBox: la lámina o el estilo del informe). El modelo es motivoNoCuenta.

import { usePlanStore } from "../../store";
import { leerTwoBox } from "../tarjetaGrafico/twoBox";
import { esGraficoDeResumen, motivoNoCuenta, type MotivoNoCuenta } from "./modeloPreguntasClave";

export function useMotivoNoCuenta(slideId: string, graficador: string, args: Readonly<Record<string, unknown>>): MotivoNoCuenta | null {
  const tipoLamina = usePlanStore((s) => s.plan.slides.find((x) => x.id === slideId)?.tipo ?? "");
  const presets = usePlanStore((s) => s.presets) as Record<string, Record<string, unknown>>;
  const conTwoBox = (leerTwoBox(graficador, args, presets)?.top.etiquetas.length ?? 0) > 0;
  return motivoNoCuenta({ tipoLamina, graficador, args, conTwoBox });
}

/** R6-14: ¿el gráfico es de una lámina del resumen ejecutivo? (entonces no hay pregunta clave que marcar). */
export function useEsGraficoDeResumen(slideId: string, graficador: string, args: Readonly<Record<string, unknown>>): boolean {
  const origen = usePlanStore((s) => s.plan.slides.find((x) => x.id === slideId)?.origen ?? null);
  return esGraficoDeResumen({ origen, graficador, args });
}
