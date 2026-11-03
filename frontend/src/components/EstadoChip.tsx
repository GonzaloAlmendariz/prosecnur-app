// Estado de una vista en la barra de comandos (P6 de la pasada de formato, 2 nov
// 2026). Un estado no es una acción: lleva un punto del color de su tono, el rótulo
// con mayúscula inicial —los modelos lo entregan en minúscula para usarlo dentro de
// una frase («accesos sin preparar»)— y el detalle en el `title`. Sólo es pulsable
// si trae `onSelect`.
//
// Lo monta `ModuleCommandBar` en su slot de estado (`slotDeEstado`); fuera de la
// barra también sirve para el estado de un bloque.

import type { ChromeStatusTone } from "./ModuleCommandBar";
import "./estado-chip.css";

export function conMayusculaInicial(texto: string): string {
  return texto ? texto.charAt(0).toLocaleUpperCase("es-PE") + texto.slice(1) : texto;
}

export type EstadoChipProps = {
  label: string;
  tone: ChromeStatusTone;
  /** Lo que explica el estado. Va al `title`. */
  detail?: string;
  onSelect?: () => void;
};

export function EstadoChip({ label, tone, detail, onSelect }: EstadoChipProps) {
  const rotulo = conMayusculaInicial(label);
  return (
    <button
      type="button"
      className="pulso-chrome-status-chip pulso-estado-chip"
      data-tone={tone}
      title={detail ?? rotulo}
      onClick={onSelect}
      disabled={!onSelect}
    >
      <span className="pulso-estado-chip-punto" aria-hidden />
      {rotulo}
    </button>
  );
}
