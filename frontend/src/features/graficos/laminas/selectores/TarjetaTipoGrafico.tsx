// Tarjeta de un tipo de gráfico en «¿Qué gráfico?» (F6.2; dirección F6 §4.4): el glifo propio con la paleta vigente, el
// nombre, para qué sirve y la marca de cómo sale cuando no es nativa. Una variante del catálogo (ADR 0139) es una tarjeta
// propia con el glifo de su graficador. Si el tipo no se puede usar aquí, la línea de la tarjeta dice por qué. Radio:
// flechas recorren, Enter o doble clic usan.

import type { KeyboardEvent } from "react";
import { GlifoGrafico } from "../../iconos/GlifoGrafico";
import type { SalidaGrafico } from "../../iconos/catalogoTipos.generated";
import { ETIQUETA_SALIDA } from "./tiposGrafico";

type Props = {
  nombreGrupo: string;
  /** La entrada del catálogo: el graficador o el id de la variante. */
  entrada: string;
  /** El graficador, para el glifo. */
  tipo: string;
  nombre: string;
  descripcion: string;
  salida: SalidaGrafico;
  /** Motivo por el que no se puede usar aquí (no disponible, no cabe en la ranura…). */
  bloqueo: string | null;
  elegida: boolean;
  actual: boolean;
  onElegir: () => void;
  onAplicar: () => void;
};

export function TarjetaTipoGrafico({ nombreGrupo, entrada, tipo, nombre, descripcion, salida, bloqueo, elegida, actual, onElegir, onAplicar }: Props) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    onAplicar();
  };
  return (
    <label
      className="pulso-f6-tarjeta-tipo"
      title={bloqueo ?? (descripcion || undefined)}
      onDoubleClick={onAplicar}
      data-tipo-grafico={tipo}
      data-entrada-catalogo={entrada}
      data-bloqueo={bloqueo ? "" : undefined}
    >
      <input
        type="radio"
        className="pulso-f6-radio-oculto"
        name={nombreGrupo}
        value={entrada}
        checked={elegida}
        onChange={onElegir}
        onKeyDown={onKeyDown}
      />
      <span className="pulso-f6-tarjeta-lienzo is-grafico">
        <GlifoGrafico tipo={tipo} />
      </span>
      <span className="pulso-f6-tarjeta-nombre">{nombre}</span>
      <span className={`pulso-f6-tarjeta-meta${bloqueo ? " is-bloqueo" : ""}`}>{bloqueo ?? descripcion}</span>
      {(actual || salida !== "nativa" || bloqueo) && (
        <span className="pulso-f6-tarjeta-chips">
          {actual && <span className="pulso-f6-chip is-actual">Actual</span>}
          {salida !== "nativa" && <span className="pulso-f6-chip is-aviso">{ETIQUETA_SALIDA[salida].corto}</span>}
        </span>
      )}
    </label>
  );
}
