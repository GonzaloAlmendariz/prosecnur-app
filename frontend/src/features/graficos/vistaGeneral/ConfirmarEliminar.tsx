// Confirmación antes de eliminar láminas desde la Vista general (F6.3). Diálogo de alerta modal (Radix): el foco entra en
// «Cancelar» (la opción segura), Escape y el velo cancelan, y al cerrar el foco vuelve a la tarjeta de origen. No es un
// panel direccionable: confirma una selección efímera que un enlace no puede reproducir.

import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import { Trash2 } from "../../../vendor/lucide-react";

type Props = {
  titulos: string[] | null;
  onConfirmar: () => void;
  onCancelar: () => void;
  /** Adónde vuelve el foco al cerrar. */
  retorno: () => HTMLElement | null;
};

const MAX_LISTADAS = 5;

export function ConfirmarEliminar({ titulos, onConfirmar, onCancelar, retorno }: Props) {
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const abierto = !!titulos && titulos.length > 0;
  const n = titulos?.length ?? 0;
  return (
    <Dialog.Root open={abierto} onOpenChange={(siguiente) => { if (!siguiente) onCancelar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-f6-vg-confirmar-velo" />
        <Dialog.Content
          role="alertdialog"
          className="pulso-f6-vg-confirmar"
          data-qa-surface="graficos/f6-vg-confirmar"
          onOpenAutoFocus={(e) => { e.preventDefault(); cancelarRef.current?.focus({ preventScroll: true }); }}
          onCloseAutoFocus={(e) => { e.preventDefault(); retorno()?.focus({ preventScroll: true }); }}
        >
          <Dialog.Title className="pulso-f6-vg-confirmar-titulo">
            {n === 1 ? "¿Eliminar esta lámina?" : `¿Eliminar ${n} láminas?`}
          </Dialog.Title>
          <Dialog.Description className="pulso-f6-vg-confirmar-texto">
            Se quitan del informe. Puedes deshacerlo justo después con Deshacer o con Ctrl/⌘+Z.
          </Dialog.Description>
          <ul className="pulso-f6-vg-confirmar-lista">
            {(titulos ?? []).slice(0, MAX_LISTADAS).map((t, i) => <li key={`${i}-${t}`}>{t}</li>)}
            {n > MAX_LISTADAS && <li className="is-resto">y {n - MAX_LISTADAS} más</li>}
          </ul>
          <div className="pulso-f6-vg-confirmar-acciones">
            <Dialog.Close ref={cancelarRef} className="pulso-f6-boton">Cancelar</Dialog.Close>
            <button type="button" className="pulso-f6-boton is-peligro" onClick={onConfirmar}>
              <Trash2 size={14} aria-hidden="true" />
              {n === 1 ? "Eliminar" : `Eliminar ${n}`}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
