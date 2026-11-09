// «Destacar»: las respuestas que la lámina viene a comentar. Se eligen entre las respuestas de la pregunta, no se teclean.
// - Ranking con puntos (I4 del catálogo del recetario): `resaltar`, en el color de énfasis (lamina_categorica.R compara por
//   rótulo).
// - Barras agrupadas y categóricas (D1 de checklist-poblacion-y-filtro, Gonzalo 2026-10-14: «mantener un solo color por
//   defecto y tener la posibilidad de resaltar alguna opción si se desea»): `overrides.resaltar_opciones`; las elegidas en
//   azul con su rótulo en negrita y las demás en tenue, como el realce del recetario. Sin ninguna, un solo color.
// - Ítem 10 de la oleada del inspector (2026-11-08): en esas dos, «La más alta» es la primera ficha; reemplaza al
//   interruptor «Resaltar la barra más alta» y es excluyente con las respuestas (realce.ts).
// - Oleada I2, ítem 3: cada ficha lleva su % en la lámina y «La más alta» nombra la barra («La más alta (Sí, 62%)»),
//   leídos del detalle del motor (cifrasInspector/). Sin detalle, las fichas quedan sin cifra.

import { useId } from "react";
import type { GraficadorRef } from "../../../api/graficos";
import { usePlanStore } from "../store";
import { parseVarRef, useVariables } from "../useVariables";
import { rotuloVisible } from "./rotuloCortoDeLista";
import { useRotulosCortos } from "./useRotulosCortos";
import { conMayorAlternada, conRespuestasDestacadas, GRAFICOS_CON_RESALTE, mayorActiva } from "./realce";
import { useDetalleCifras } from "./cifrasInspector/useDetalleCifras";
import { mayorDe, pctDe, textoPct } from "./cifrasInspector/modeloCifras";
import "./cifrasInspector/cifrasInspector.css";
import { formatoConteo } from "../../../lib/formatoNumero";
import { ChipSeleccion } from "../../../components/ChipSeleccion";

/** Dónde guarda cada gráfico lo que se destaca. */
const DONDE: Readonly<Record<string, "arg" | "override">> = {
  p_lollipop: "arg",
  p_barras_agrupadas: "override",
  p_barras_categoricas: "override",
};
export const GRAFICOS_CON_DESTACADAS = new Set(Object.keys(DONDE));

const lista = (x: unknown): string[] =>
  (Array.isArray(x) ? x : typeof x === "string" ? x.split(",") : []).map((t) => String(t).trim()).filter(Boolean);

/** Lo destacado de un gráfico, venga del argumento o de los overrides. */
export function destacadasDe(graficador: string, args: Readonly<Record<string, unknown>>): string[] {
  if (DONDE[graficador] === "arg") return lista(args.resaltar);
  const ov = args.overrides && typeof args.overrides === "object" ? (args.overrides as Record<string, unknown>) : {};
  return lista(ov.resaltar_opciones);
}

/**
 * R6-6: la línea de estado bajo las fichas, siempre presente (antes sólo sin elegir, y la fila pasaba de 117 a 99 px al
 * elegir la primera). Dice qué pinta la lámina con lo elegido.
 */
export function estadoDestacar(donde: "arg" | "override", elegidas: number, mayor: boolean): string {
  const cuantas = elegidas === 1 ? "1 destacada" : `${formatoConteo(elegidas)} destacadas`;
  if (donde === "arg") return elegidas ? `${cuantas} en el color de énfasis.` : "Sin elegir, ninguna se destaca.";
  if (mayor) return "La más alta, resaltada; las demás, en tenue.";
  return elegidas ? `${cuantas}; las demás, en tenue.` : "Sin elegir, todas van del mismo color.";
}

export function DestacarRespuestas({ slideId, slot, valor, scope = "active" }: {
  slideId: string; slot: string; valor: GraficadorRef; scope?: "active" | "consolidated";
}) {
  const id = useId();
  const argsDet = (valor.args ?? {}) as Record<string, unknown>;
  const det = useDetalleCifras(DONDE[valor.graficador] ? valor.graficador : "", scope, [{ clave: "actual", args: argsDet }]).actual;
  const { variables } = useVariables();
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  const cortos = useRotulosCortos();
  const donde = DONDE[valor.graficador];
  if (!donde) return null;
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const ref = typeof args.var === "string" ? parseVarRef(args.var) : null;
  const variable = ref ? variables.find((v) => v.name === ref.name && (!ref.source || v.source === ref.source)) : undefined;
  const respuestas = (variable?.choices ?? []).map((c) => String(c.label ?? c.name)).filter(Boolean);
  const conMayor = GRAFICOS_CON_RESALTE.has(valor.graficador);
  if (!respuestas.length && !conMayor) return null;
  const guardadas = destacadasDe(valor.graficador, args);
  const elegidas = new Set(guardadas);
  const mayor = conMayor && mayorActiva(args, guardadas);
  const detalle = det?.detalle ?? null;
  const cifraMayor = mayorDe(detalle);
  const anterior = Boolean(det && !det.vigente);
  const alternar = (r: string) => {
    const siguiente = respuestas.filter((x) => (x === r ? !elegidas.has(x) : elegidas.has(x)));
    if (donde === "arg") {
      updateSlotArgs(slideId, slot, { resaltar: siguiente.length ? siguiente : null });
      return;
    }
    updateSlotArgs(slideId, slot, { overrides: conRespuestasDestacadas(args, siguiente) });
  };
  return (
    <div className="pulso-f6-dato is-apilado" data-qa="destacar-respuestas">
      <span className="pulso-f6-dato-rotulo" id={id}>Destacar</span>
      <div className="pulso-f6-destacar" role="group" aria-labelledby={id}>
        {/* W3: las fichas son ChipSeleccion del kit, con el % de la lámina en la cola y su tono de «anterior». */}
        {conMayor && (
          <ChipSeleccion etiqueta="La más alta" activo={mayor} data-qa="resaltar-mayor" className="pulso-f6-destacar-mayor"
            onAlternar={() => updateSlotArgs(slideId, slot, { overrides: conMayorAlternada(args, guardadas) })}
            cifra={cifraMayor && detalle ? `(${cifraMayor.clave}, ${textoPct(cifraMayor.valor, detalle.redondeo.decimales)})` : undefined}
            cifraAnterior={anterior} cifraQa="cifra-mayor" />
        )}
        {respuestas.map((r) => {
          // U14: se ve el corto del estudio; lo que se guarda sigue siendo el rótulo completo.
          const v = rotuloVisible(cortos, r);
          const pct = pctDe(detalle, [r, v.texto]);
          return (
            <ChipSeleccion key={r} etiqueta={v.texto} activo={elegidas.has(r)} title={v.completo ?? undefined}
              onAlternar={() => alternar(r)} cifra={pct || undefined} cifraAnterior={anterior} cifraQa="cifra-ficha" />
          );
        })}
      </div>
      <span className="pulso-f6-dato-ayuda" data-qa="destacar-estado">{estadoDestacar(donde, elegidas.size, mayor)}</span>
    </div>
  );
}
