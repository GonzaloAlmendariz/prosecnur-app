// Diálogo «Agregar campaña complementaria» de la tarjeta de formulario
// (ADR 0101). Direccionable con `?panel=campana-complementaria&foco=<id>`.
//
// Geometría (Contrato de Superficie):
// - C2: ancho fijo por viewport y alto tope de la ventana; 0 o 70 preguntas
//   listadas no lo mueven. La variación se resuelve dentro del cuerpo.
// - C4: un único dueño de scroll, `.pulso-xf-campana-cuerpo`; cabecera y pie fijos.

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "../../../vendor/lucide-react";
import type { CampanaDeclararResultado } from "../../../api/xlsformCampanas";
import { CampanaComplementariaPanel } from "./CampanaComplementariaPanel";
import "../styles/xf-campana.css";

export type CampanaComplementariaDialogProps = {
  abierto: boolean;
  formId: string;
  formName: string;
  encuestaPrincipal: string | null;
  campanasDeclaradas: readonly string[];
  panelProps: { "data-pulso-panel": string };
  onCerrar: () => void;
  onDeclarada: (resultado: CampanaDeclararResultado) => void;
};

export function CampanaComplementariaDialog({
  abierto,
  formId,
  formName,
  encuestaPrincipal,
  campanasDeclaradas,
  panelProps,
  onCerrar,
  onDeclarada,
}: CampanaComplementariaDialogProps) {
  return (
    <Dialog.Root open={abierto} onOpenChange={(siguiente) => { if (!siguiente) onCerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-xf-campana-velo" />
        <Dialog.Content
          className="pulso-xf-campana"
          {...panelProps}
          // Siempre medible: las cargas son acciones del analista, no de la vista.
          data-audit-ready="true"
          aria-describedby="pulso-xf-campana-descripcion"
        >
          <header className="pulso-xf-campana-cabecera">
            <div className="pulso-xf-campana-titular-fila">
              <Dialog.Title className="pulso-xf-campana-titulo">Agregar campaña complementaria</Dialog.Title>
              <Dialog.Close className="pulso-xf-campana-cerrar" aria-label="Cerrar">
                <X size={16} aria-hidden="true" />
              </Dialog.Close>
            </div>
            <Dialog.Description id="pulso-xf-campana-descripcion" className="pulso-xf-campana-descripcion">
              Formulario «{formName}»
              {encuestaPrincipal ? ` · encuesta principal ${encuestaPrincipal}` : ""}
            </Dialog.Description>
          </header>
          {/* `key` reinicia el contenido si la dirección cambia de formulario. */}
          <CampanaComplementariaPanel
            key={formId}
            formId={formId}
            formName={formName}
            encuestaPrincipal={encuestaPrincipal}
            campanasDeclaradas={campanasDeclaradas}
            elegirEncuesta
            onCancelar={onCerrar}
            onDeclarada={onDeclarada}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
