// El arrastre de láminas de la Estructura y de la tira, con el patrón del mazo (useArrastreMazo, anunciosArrastre):
// puntero con 4 px de umbral, teclado con espacio y flechas, anuncios en español con el lugar en el plan, y Escape que
// cancela el arrastre sin cerrar paneles. Soltar escribe el orden con `moveSlideTo`, en un solo paso deshacible.

import { useMemo } from "react";
import { closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { agrupadorDelPlan } from "../historialAgrupado";
import { usePlanStore } from "../store";
import { anunciosArrastre, instruccionesArrastre } from "./mazoResumen/anunciosArrastre";
import { useArrastreMazo } from "./mazoResumen/useArrastreMazo";
import type { LaminaEnEstructura } from "./modeloEstructura";
import { aplicarArrastre } from "./ordenArrastre";

/** «Lámina 3: Satisfacción general» (sin el punto final que a veces trae el título). */
export const nombreParaMover = (l: Pick<LaminaEnEstructura, "posicion" | "titulo">) =>
  `lámina ${l.posicion}: ${l.titulo.replace(/[.\s]+$/, "")}`;

/** Props del `DndContext`: se esparcen tal cual. `laminas` es el plan entero en su orden (`estructura.laminas`). */
export function useOrdenLaminas(laminas: readonly LaminaEnEstructura[]) {
  const { sensores, alEmpezar, alTerminar } = useArrastreMazo();
  const ids = useMemo(() => laminas.map((l) => l.id), [laminas]);
  const porId = useMemo(() => new Map(laminas.map((l) => [l.id, l])), [laminas]);
  const nombre = (id: string) => {
    const l = porId.get(id);
    return l ? nombreParaMover(l) : id;
  };
  const soltar = ({ active, over }: DragEndEvent) => {
    alTerminar();
    aplicarArrastre(usePlanStore.getState(), ids, String(active.id), over ? String(over.id) : null, agrupadorDelPlan.cortar);
  };
  return {
    sensors: sensores,
    collisionDetection: closestCenter,
    onDragStart: alEmpezar,
    onDragEnd: soltar,
    onDragCancel: alTerminar,
    accessibility: {
      // El lugar se cuenta en el plan entero (coincide con el número de la fila), aunque haya nodos plegados.
      announcements: anunciosArrastre({ que: "la lámina", ids, nombre }),
      screenReaderInstructions: instruccionesArrastre("la lámina"),
    },
  };
}
