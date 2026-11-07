// Tarjeta de un tipo de lámina en «¿Qué lámina?» (F6.2): la composición dibujada con los gráficos de la lámina actual
// acomodados («así quedaría»), el nombre, cuántos gráficos admite y para qué se usa. Es un radio: las flechas recorren
// las tarjetas, Enter o el doble clic aplican.

import type { KeyboardEvent } from "react";
import type { SlideType } from "../../../../api/graficos";
import { ComposicionLamina } from "../../iconos/ComposicionLamina";
import { GlifoGrafico } from "../../iconos/GlifoGrafico";
import { SLIDE_GRAF_SLOTS } from "../../store";
import { ROTULO_CLASE, type ClaseTarjeta } from "./intencionesContar";

type Props = {
  nombreGrupo: string;
  /** La tarjeta: el tipo o el tipo con su payload de partida (`p_slide_hallazgos:resumen`, opcionesLamina.ts). */
  opcion: string;
  tipo: SlideType;
  nombre: string;
  /** «Gráfico», «Lámina» o «Lámina de resumen» (ADR 0135 §1): la clase es de la tarjeta. */
  clase: ClaseTarjeta;
  /** Cuántos gráficos admite (vacío en las tarjetas por intención, que traen su gráfico). */
  meta: string;
  uso: string;
  /** Con un gráfico de partida, la miniatura es su glifo en vez de la composición. */
  glifo?: string;
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
  nombreGrupo, opcion, tipo, nombre, clase, meta, uso, glifo, graficos, variante, elegida, actual, sobrantes, onElegir, onAplicar,
}: Props) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    onAplicar();
  };
  return (
    <label className="pulso-f6-tarjeta-tipo" onDoubleClick={onAplicar} data-tipo-lamina={tipo} data-opcion-lamina={opcion} data-clase-tarjeta={clase}>
      <input
        type="radio"
        className="pulso-f6-radio-oculto"
        name={nombreGrupo}
        value={opcion}
        checked={elegida}
        onChange={onElegir}
        onKeyDown={onKeyDown}
      />
      <span className={glifo ? "pulso-f6-tarjeta-lienzo is-grafico" : "pulso-f6-tarjeta-lienzo"}>
        {glifo
          ? <GlifoGrafico tipo={glifo} />
          : <ComposicionLamina tipo={tipo} slots={SLIDE_GRAF_SLOTS[tipo] ?? []} graficos={graficos} variante={variante} />}
      </span>
      {/* Nombre y para qué sirve se leen enteros (pueden ocupar dos renglones; nunca «…»). Cuántos gráficos admite va
          al pie de la tarjeta: la grilla iguala el alto de todas (C1 `equal`) y ese renglón queda alineado entre
          vecinas sin importar cuántas líneas tome el texto de cada una. */}
      <span className="pulso-f6-tarjeta-cuerpo">
        <span className="pulso-f6-tarjeta-nombre">{nombre}</span>
        {uso && <span className="pulso-f6-tarjeta-uso">{uso}</span>}
        <span className="pulso-f6-tarjeta-admite">
          <span className="pulso-f6-tarjeta-clase">{ROTULO_CLASE[clase]}</span>
          {meta && <span>{meta}</span>}
        </span>
      </span>
      {(actual || sobrantes > 0) && (
        <span className="pulso-f6-tarjeta-chips">
          {actual && <span className="pulso-f6-chip is-actual">Actual</span>}
          {sobrantes > 0 && (
            <span className="pulso-f6-chip is-aviso" title={sobrantes === 1 ? "El gráfico de esta lámina no tiene lugar en la nueva" : "Los gráficos de esta lámina no tienen lugar en la nueva"}>
              {sobrantes === 1 ? "Quita 1 gráfico" : `Quita ${sobrantes} gráficos`}
            </span>
          )}
        </span>
      )}
    </label>
  );
}
