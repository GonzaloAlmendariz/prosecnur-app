// Botón «Nuevo filtro» y su diálogo, conectados a la dirección (`?panel=nuevo-filtro`).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { Plus } from "../../../vendor/lucide-react";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { NuevoFiltroDialogo, type PreguntaDestino } from "./NuevoFiltroDialogo";
import { PANEL_NUEVO_FILTRO } from "./panelesFiltros";
import type { PreguntaElegible } from "./SelectorPreguntaFiltro";
import { PulsoButton } from "../../../components/PulsoButton";

type Props = {
  preguntas: readonly PreguntaDestino[];
  candidatasDe: (name: string) => PreguntaElegible[];
  workbook: XlsformEditorWorkbook;
  onCrear: (wb: XlsformEditorWorkbook, pregunta: string) => void;
  onAbrir: (pregunta: string) => void;
};

export function NuevoFiltro({ preguntas, candidatasDe, workbook, onCrear, onAbrir }: Props) {
  const panel = usePanelDireccionable(PANEL_NUEVO_FILTRO);
  // Elegir o crear fija el `foco` (una navegación); cerrar el panel es otra. Las dos leen la dirección del render en
  // curso, así que el cierre espera al render siguiente para no pisar el foco recién escrito.
  const [cerrarDespues, setCerrarDespues] = useState(false);
  const { cerrar } = panel;
  useEffect(() => {
    if (!cerrarDespues) return;
    setCerrarDespues(false);
    cerrar();
  }, [cerrarDespues, cerrar]);
  return (
    <>
      <PulsoButton variant="primary" size="md" aria-haspopup="dialog" onClick={panel.abrir}>
        <Plus size={14} aria-hidden="true" /> Nuevo filtro
      </PulsoButton>
      {panel.abierto && !cerrarDespues && typeof document !== "undefined"
        ? createPortal(
            <div {...panel.props}>
              <NuevoFiltroDialogo
                preguntas={preguntas}
                candidatasDe={candidatasDe}
                workbook={workbook}
                onCerrar={panel.cerrar}
                onAbrir={(n) => { onAbrir(n); setCerrarDespues(true); }}
                onCrear={(wb, n) => { onCrear(wb, n); setCerrarDespues(true); }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
