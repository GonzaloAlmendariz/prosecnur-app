// «Aplicar a las campañas hermanas» (GOAL editor de correos, L16): simular y
// aplicar, con la revisión global del store. Al aplicar se relee la lista de
// campañas (sus asuntos cambiaron) y, si una hermana es la que el editor tenía
// cargada, se olvida para que al abrirla se lea de nuevo.

import { useCallback } from "react";

import { apiMailApplySiblings, type MailHermana, type ParteHermana } from "../../../api/materialMailHermanas";
import { avisoDeCampana, hayQueReleerCampanas } from "./modeloCampanas";
import { hayCambios, useCorreosStore } from "./store";

export type ResultadoDeHermanas = { ok: true; hermanas: MailHermana[]; variantesOrigen: number } | { ok: false; mensaje: string };

/** Simula o aplica; sin React, para probarlo con la API doblada. */
export async function simularOAplicarHermanas(
  input: { origen: string; destinos: string[]; partes: ParteHermana[]; simular: boolean },
  cargarCampanas: () => Promise<void>,
  onEscrito?: () => void,
  api: typeof apiMailApplySiblings = apiMailApplySiblings,
): Promise<ResultadoDeHermanas> {
  const { origen, destinos, partes, simular } = input;
  const s = useCorreosStore.getState();
  if (s.stateRevision === null) await cargarCampanas();
  const revision = useCorreosStore.getState().stateRevision;
  if (revision === null) return { ok: false, mensaje: "No se sabe qué versión del módulo está guardada. Vuelve a cargar." };
  // Una hermana cargada en el editor con cambios sin guardar no se pisa en silencio.
  const cargada = useCorreosStore.getState();
  if (!simular && cargada.campana && destinos.includes(cargada.campana) && hayCambios(cargada)) {
    return { ok: false, mensaje: "Una de las campañas elegidas tiene cambios sin guardar en el editor: guárdala o descártalos antes de aplicar." };
  }
  try {
    const out = await api({ expected_revision: revision, campaign_id: origen, target_ids: destinos, partes, dry_run: simular });
    if (!simular) {
      useCorreosStore.getState().anotarRevision(out.state_revision);
      const abierta = useCorreosStore.getState().campana;
      if (abierta && destinos.includes(abierta)) useCorreosStore.getState().reiniciarCampana(null);
      onEscrito?.();
      void cargarCampanas();
    }
    return { ok: true, hermanas: out.hermanas, variantesOrigen: out.variantes_origen };
  } catch (cause) {
    if (hayQueReleerCampanas(cause)) void cargarCampanas();
    return { ok: false, mensaje: avisoDeCampana(cause, "No se pudo aplicar a las campañas hermanas.") };
  }
}

export function useHermanas(cargarCampanas: () => Promise<void>, onEscrito?: () => void) {
  return useCallback(
    (origen: string, destinos: string[], partes: ParteHermana[], simular: boolean) =>
      simularOAplicarHermanas({ origen, destinos, partes, simular }, cargarCampanas, onEscrito),
    [cargarCampanas, onEscrito],
  );
}
