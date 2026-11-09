// «Respuestas bajo el enunciado» (D3 de checklist-poblacion-y-filtro; Gonzalo, 2026-10-14: «que cada gráfico pueda permitir
// si incluye o no su base»). En una lámina de varios gráficos, cada panel puede decir «172 respuestas» bajo su pregunta,
// como el recetario. Sin decidir, la regla G9: se omite cuando todos los gráficos tienen el mismo n que la base de la
// lámina. Se guarda en `overrides.mostrar_publico` (lamina_mixtas.R).

import { useId } from "react";
import type { GraficadorRef } from "../../../api/graficos";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../store";
import { AyudaGlobo } from "./AyudaGlobo";
import { segmentacionFija, type Segmentacion } from "./opcionesEnSegmentado";
import { FilaSegmentada } from "./tarjetaGrafico/FilaSegmentada";

type Valor = "auto" | "si" | "no";

/**
 * Ítem 9 (2026-11-08): la opción automática dice qué rige, la regla G9: sale sólo si el n del gráfico es otro que el de
 * la lámina. R9-17: «Si el n cambia» a secas; «Automático (si el n cambia)» partía en dos renglones el pulgar.
 */
export const OPCIONES_PUBLICO: readonly { value: Valor; label: string }[] = [
  { value: "auto", label: "Si el n cambia" },
  { value: "si", label: "Mostrar" },
  { value: "no", label: "Ocultar" },
];
const SEGMENTOS_PUBLICO: Segmentacion = segmentacionFija(OPCIONES_PUBLICO);
const AYUDA_PUBLICO = '"Si el n cambia": "172 respuestas" sale bajo el enunciado sólo si el gráfico no tiene el mismo público y el mismo n que la lámina.';

export function PublicoGrafico({ slideId, slot, valor }: { slideId: string; slot: string; valor: GraficadorRef }) {
  const id = useId();
  const tipo = usePlanStore((s) => s.plan?.slides?.find((x) => x.id === slideId)?.tipo);
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  // La cifra destacada ya dice su base en el detalle y no tiene enunciado bajo el cual ponerla.
  if (!tipo || (SLIDE_GRAF_SLOTS[tipo] ?? []).length < 2 || valor.graficador === "p_cifra") return null;
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const ov = args.overrides && typeof args.overrides === "object" ? (args.overrides as Record<string, unknown>) : {};
  const actual: Valor = ov.mostrar_publico === true ? "si" : ov.mostrar_publico === false ? "no" : "auto";
  const cambiar = (v: Valor) => {
    const siguiente: Record<string, unknown> = { ...ov };
    if (v === "auto") delete siguiente.mostrar_publico; else siguiente.mostrar_publico = v === "si";
    updateSlotArgs(slideId, slot, { overrides: siguiente });
  };
  return (
    <FilaSegmentada id={id} rotulo="Respuestas bajo el enunciado" segmentos={SEGMENTOS_PUBLICO} valor={actual} qa="publico-grafico"
      marcas={<AyudaGlobo id={`${id}-ayuda`} rotulo="Respuestas bajo el enunciado" detalle={AYUDA_PUBLICO} />}
      onCambio={(v) => cambiar(v === "si" || v === "no" ? v : "auto")} />
  );
}
