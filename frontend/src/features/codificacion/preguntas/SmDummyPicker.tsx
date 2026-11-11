// Pareja de opción múltiple: cuál de sus opciones es "Otros, especifique".
// La regla es la de siempre (elegir una opción la guarda, volver a pulsarla la quita, la que el motor
// reconoce como "Otros" va marcada mientras no haya ninguna elegida); aquí solo cambia la presentación.
// Sin elegir es lo que falta decidir: se listan todas las opciones. Ya elegida, la sección queda compacta
// (la opción elegida y "Cambiar", que vuelve a abrir la lista).

import { useState } from "react";
import type { OpcionSM, PreguntaAbierta } from "../../../api/codificacion";
import { EstadoChip } from "../../../components/EstadoChip";
import { PulsoButton } from "../../../components/PulsoButton";
import { Check } from "../../../vendor/lucide-react";

export function SmDummyPicker({ padre, opciones, busy, selectedCol, onSelect }: {
  padre: PreguntaAbierta;
  opciones: OpcionSM[];
  busy: boolean;
  selectedCol: string;
  onSelect: (col: string) => void;
}) {
  const [cambiando, setCambiando] = useState(false);
  const elegida = opciones.find((o) => o.col_dummy !== "" && o.col_dummy === selectedCol) ?? null;
  const hasSelection = !!selectedCol;
  const compacta = elegida !== null && !cambiando;
  const visibles = compacta ? [elegida] : opciones;

  return (
    <section className="pulso-preg-insp-seccion" aria-label={`Opción "Otros" de ${padre.parent}`} data-compacta={compacta ? "" : undefined}>
      <div className="pulso-preg-insp-rotulo-fila">
        <h4 className="pulso-preg-insp-rotulo">Opción "Otros, especifique"</h4>
        {hasSelection ? null : <EstadoChip label="Sin elegir" tone="warn" detail="Falta indicar cuál de las opciones abre el texto." />}
        {compacta ? (
          <PulsoButton variant="link" size="sm" disabled={busy} onClick={() => setCambiando(true)}>
            Cambiar
          </PulsoButton>
        ) : null}
      </div>
      {compacta ? null : <p className="pulso-preg-insp-ayuda">Los textos se codifican para quien marcó esta opción.</p>}
      <ul className="pulso-preg-otros">
        {visibles.map((o) => {
          const isSelected = selectedCol === o.col_dummy && o.col_dummy !== "";
          const disabled = busy || !o.col_dummy;
          const sugerida = o.es_otros_sugerido && !hasSelection;
          const title = !o.col_dummy
            ? "Esta opción no puede marcarse con la base actual"
            : isSelected
            ? "Quitar la selección"
            : undefined;
          return (
            <li key={o.codigo}>
              <button
                type="button"
                className="pulso-preg-otros-opcion"
                disabled={disabled}
                onClick={() => {
                  setCambiando(false);
                  onSelect(o.col_dummy);
                }}
                aria-pressed={isSelected}
                title={title}
              >
                <span className="pulso-preg-otros-marca" aria-hidden="true">
                  {isSelected ? <Check size={11} /> : null}
                </span>
                <code className="pulso-preg-otros-codigo">{o.codigo}</code>
                <span className="pulso-preg-otros-texto">{o.label}</span>
                {sugerida ? <EstadoChip label="Sugerida" tone="info" detail={'El formulario la rotula como "Otros".'} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
