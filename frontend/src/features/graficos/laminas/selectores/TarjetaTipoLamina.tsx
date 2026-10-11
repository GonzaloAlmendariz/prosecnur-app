// Tarjeta de un tipo de lámina en «¿Qué lámina?» (F6.2): la composición dibujada con los gráficos de la lámina actual
// acomodados («así quedaría»), el nombre, cuántos gráficos admite y para qué se usa. Es un radio: las flechas recorren
// las tarjetas, Enter o el doble clic aplican.

import type { KeyboardEvent } from "react";
import type { SlideType } from "../../../../api/graficos";
import { ComposicionLamina } from "../../iconos/ComposicionLamina";
import { SLIDE_GRAF_SLOTS } from "../../store";

type Props = {
  nombreGrupo: string;
  tipo: SlideType;
  nombre: string;
  meta: string;
  uso: string;
  graficos: Readonly<Record<string, string>>;
  variante: string | null;
  elegida: boolean;
  actual: boolean;
  /** Gráficos que no cabrían en esta composición. */
  sobrantes: number;
  onElegir: () => void;
  onAplicar: () => void;
};

export function TarjetaTipoLamina({
  nombreGrupo, tipo, nombre, meta, uso, graficos, variante, elegida, actual, sobrantes, onElegir, onAplicar,
}: Props) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    onAplicar();
  };
  return (
    <label className="pulso-f6-tarjeta-tipo" title={uso || undefined} onDoubleClick={onAplicar} data-tipo-lamina={tipo}>
      <input
        type="radio"
        className="pulso-f6-radio-oculto"
        name={nombreGrupo}
        value={tipo}
        checked={elegida}
        onChange={onElegir}
        onKeyDown={onKeyDown}
      />
      <span className="pulso-f6-tarjeta-lienzo">
        <ComposicionLamina tipo={tipo} slots={SLIDE_GRAF_SLOTS[tipo] ?? []} graficos={graficos} variante={variante} />
      </span>
      <span className="pulso-f6-tarjeta-nombre">{nombre}</span>
      {/* Dos renglones independientes (cuántos gráficos admite · para qué se usa): cada uno mide su línea, sin heredar
          el alto del otro (C1 intrínseco). El marco de la tarjeta lo fija la grilla, no estos renglones. */}
      <span className="pulso-f6-tarjeta-metas" data-qa-geometry-group="graficos/f6-tarjeta-lamina-meta" data-qa-geometry-contract="intrinsic">
        <span className="pulso-f6-tarjeta-meta" data-qa-geometry-member>{meta}</span>
        <span className="pulso-f6-tarjeta-meta" data-qa-geometry-member>{uso}</span>
      </span>
      {(actual || sobrantes > 0) && (
        <span className="pulso-f6-tarjeta-chips">
          {actual && <span className="pulso-f6-chip is-actual">Actual</span>}
          {sobrantes > 0 && (
            <span className="pulso-f6-chip is-aviso">{sobrantes === 1 ? "1 no cabe" : `${sobrantes} no caben`}</span>
          )}
        </span>
      )}
    </label>
  );
}
