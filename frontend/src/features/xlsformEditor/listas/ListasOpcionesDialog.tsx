// Diálogo «Listas de opciones» del editor (H7). Direccionable con
// `?panel=listas-opciones` (`useListasOpcionesPanel`).
//
// Geometría: ancho y alto fijos por viewport (rol, no cantidad de listas);
// cabecera fija y un único dueño de scroll, `.pulso-xf-listas-cuerpo`.

import { useLayoutEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "../../../vendor/lucide-react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import type { ControlPanel } from "../../../lib/navegacion/paneles";
import { ListasOpcionesPanel, TEXTO_DIDACTICO_LISTAS } from "./ListasOpcionesPanel";
import { useListasOpciones } from "./useListasOpciones";
import "./listas.css";

/** Disparador del editor, para devolver el foco si el diálogo se abrió por
 *  enlace (`?panel=listas-opciones`) y no hay elemento previo que recordar. */
const SELECTOR_DISPARADOR = ".pulso-xf-cmd-listas";

export type ListasOpcionesDialogProps = {
  /** De `useListasOpcionesPanel()`. */
  panel: ControlPanel;
  workbook: XlsformEditorWorkbook;
  onWorkbookChange: (next: XlsformEditorWorkbook) => void;
};

export function ListasOpcionesDialog({ panel, workbook, onWorkbookChange }: ListasOpcionesDialogProps) {
  // El diálogo se abre por dirección, no con un Dialog.Trigger: Radix no sabe
  // a dónde devolver el foco y caía en <body>. Se recuerda el elemento activo
  // al abrir; el layout effect corre antes de que el portal monte y mueva el foco.
  const previo = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!panel.abierto) return;
    const activo = document.activeElement;
    previo.current = activo instanceof HTMLElement && activo !== document.body ? activo : null;
  }, [panel.abierto]);

  function devolverFoco(event: Event) {
    event.preventDefault();
    const destino = previo.current?.isConnected
      ? previo.current
      : document.querySelector<HTMLElement>(SELECTOR_DISPARADOR);
    previo.current = null;
    destino?.focus();
  }

  return (
    <Dialog.Root open={panel.abierto} onOpenChange={(siguiente) => { if (!siguiente) panel.cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-xf-listas-velo" />
        <Dialog.Content
          className="pulso-xf-listas-dialogo"
          {...panel.props}
          data-audit-ready="true"
          onCloseAutoFocus={devolverFoco}
        >
          <header className="pulso-xf-listas-cabecera">
            <div className="pulso-xf-listas-titular">
              <Dialog.Title className="pulso-xf-listas-titulo">Listas de opciones</Dialog.Title>
              <Dialog.Close className="pulso-xf-listas-cerrar" aria-label="Cerrar">
                <X size={16} aria-hidden="true" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="pulso-xf-listas-descripcion">
              {TEXTO_DIDACTICO_LISTAS}
            </Dialog.Description>
          </header>
          <div className="pulso-xf-listas-cuerpo">
            {panel.abierto ? (
              <ListasOpcionesCuerpo workbook={workbook} onWorkbookChange={onWorkbookChange} />
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ListasOpcionesCuerpo({
  workbook,
  onWorkbookChange,
}: {
  workbook: XlsformEditorWorkbook;
  onWorkbookChange: (next: XlsformEditorWorkbook) => void;
}) {
  const control = useListasOpciones(workbook, onWorkbookChange);
  return <ListasOpcionesPanel workbook={workbook} control={control} />;
}
