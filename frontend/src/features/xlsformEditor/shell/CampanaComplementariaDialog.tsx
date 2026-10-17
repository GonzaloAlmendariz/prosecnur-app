// Diálogo «Agregar campaña complementaria» de la tarjeta de formulario
// (ADR 0101). Direccionable con `?panel=campana-complementaria&foco=<id>`.
//
// Geometría (Contrato de Superficie):
// - C2: ancho y ALTO fijos por viewport (rol, no cantidad): el marco no salta
//   entre «sin elegir», «catálogo» y «vista previa»; 0 o 70 preguntas no lo
//   mueven. La variación se resuelve dentro del cuerpo, y el vacío lo posee la
//   sección de coincidencia (C3).
// - C4: un único dueño de scroll, `.pulso-xf-campana-cuerpo`; cabecera y pie fijos.

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, X } from "../../../vendor/lucide-react";
import type { CampanaDeclararResultado } from "../../../api/xlsformCampanas";
import { CampanaComplementariaPanel } from "./CampanaComplementariaPanel";
import "../styles/xfCampana";

export type CampanaComplementariaDialogProps = {
  abierto: boolean;
  formId: string;
  formName: string;
  encuestaPrincipal: string | null;
  /** Título de la encuesta principal, si la procedencia lo guarda. */
  encuestaPrincipalTitulo?: string | null;
  campanasDeclaradas: readonly string[];
  /** Cierra el diálogo y abre la importación (salida del bloqueo < 80 %). */
  onImportarComoFormulario?: () => void;
  importarBloqueadoPor?: string | null;
  panelProps: { "data-pulso-panel": string };
  onCerrar: () => void;
  onDeclarada: (resultado: CampanaDeclararResultado) => void;
};

export function CampanaComplementariaDialog({
  abierto,
  formId,
  formName,
  encuestaPrincipal,
  encuestaPrincipalTitulo,
  campanasDeclaradas,
  onImportarComoFormulario,
  importarBloqueadoPor = null,
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
        >
          <header className="pulso-xf-campana-cabecera">
            <div className="pulso-xf-campana-titular-fila">
              <Dialog.Title className="pulso-xf-campana-titulo">Agregar campaña complementaria</Dialog.Title>
              <Dialog.Close className="pulso-xf-campana-cerrar" aria-label="Cerrar">
                <X size={16} aria-hidden="true" />
              </Dialog.Close>
            </div>
            {/* Sin `id` propio: Radix enlaza `aria-describedby` con el suyo y
                avisaba de una descripción ausente cuando se lo pisábamos. */}
            <Dialog.Description className="pulso-xf-campana-descripcion">
              Otra encuesta de SurveyMonkey con este mismo instrumento (p. ej., un envío por correo).
              No crea un formulario: sus respuestas se leen con las preguntas de este.
            </Dialog.Description>
            <p className="pulso-xf-campana-contexto">
              <span className="pulso-xf-campana-contexto-form" title={formName}>{formName}</span>
              {encuestaPrincipal ? (
                <span className="pulso-xf-campana-contexto-principal">
                  Principal: {encuestaPrincipalTitulo && encuestaPrincipalTitulo !== formName
                    ? `${encuestaPrincipalTitulo} · `
                    : ""}
                  <CopiarId id={encuestaPrincipal} />
                </span>
              ) : null}
            </p>
          </header>
          {/* `key` reinicia el contenido si la dirección cambia de formulario. */}
          <CampanaComplementariaPanel
            key={formId}
            formId={formId}
            formName={formName}
            encuestaPrincipal={encuestaPrincipal}
            campanasDeclaradas={campanasDeclaradas}
            onImportarComoFormulario={onImportarComoFormulario}
            importarBloqueadoPor={importarBloqueadoPor}
            elegirEncuesta
            onCancelar={onCerrar}
            onDeclarada={onDeclarada}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** ID como dato secundario, con copia explícita. */
function CopiarId({ id }: { id: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className="pulso-xf-campana-copiar"
      aria-label={copiado ? `ID ${id} copiado` : `Copiar el ID ${id}`}
      title="Copiar el ID de SurveyMonkey"
      onClick={() => {
        void navigator.clipboard?.writeText(id).then(() => {
          setCopiado(true);
          window.setTimeout(() => setCopiado(false), 1600);
        // Sin permiso de portapapeles el ID sigue visible y seleccionable.
        }).catch(() => undefined);
      }}
    >
      ID {id}
      {copiado ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
    </button>
  );
}
