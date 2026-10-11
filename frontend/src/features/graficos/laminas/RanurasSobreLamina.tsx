// Ranuras seleccionables sobre la lámina rasterizada (F6.1, parte 2): cada gráfico de la lámina es un botón encima de
// su zona; seleccionarlo escribe `foco=l-NN:gK` y abre su tarjeta en el inspector. La geometría es la de la plantilla
// (composición efectiva), así que el marco es aproximado al dibujo nativo; sirve para elegir, no para medir. El doble
// clic abre «¿Qué gráfico?» para esa ranura (dirección F6 §4.1); el teclado llega al mismo selector desde su tarjeta.

import type { RanuraSobreLamina } from "./ranurasLamina";
import { ATRIBUTO_RANURA } from "./selectores/focoAlCerrar";

type Props = {
  ranuras: readonly RanuraSobreLamina[];
  activa: number | null;
  /** Nombre de lo que hay en cada ranura, por k: «Barras apiladas · P12». */
  nombre: (k: number) => string;
  onRanura: (k: number) => void;
  onCambiar: (k: number) => void;
};

export function RanurasSobreLamina({ ranuras, activa, nombre, onRanura, onCambiar }: Props) {
  if (!ranuras.length) return null;
  const n = ranuras.length;
  return (
    <div className="pulso-f6-ranuras-capa" role="group" aria-label="Gráficos de la lámina">
      {ranuras.map((r) => {
        const etiqueta = `Gráfico ${r.k} de ${n}: ${nombre(r.k)}`;
        return (
          <button
            key={r.slot}
            type="button"
            className={`pulso-f6-ranura-zona${activa === r.k ? " is-activa" : ""}`}
            style={{
              left: `${r.rect.x * 100}%`,
              top: `${r.rect.y * 100}%`,
              width: `${r.rect.width * 100}%`,
              height: `${r.rect.height * 100}%`,
            }}
            aria-label={etiqueta}
            aria-pressed={activa === r.k}
            {...{ [ATRIBUTO_RANURA]: r.k }}
            onClick={() => onRanura(r.k)}
            onDoubleClick={() => onCambiar(r.k)}
          >
            <span className="pulso-f6-ranura-etiqueta" aria-hidden="true">Gráfico {r.k}</span>
          </button>
        );
      })}
    </div>
  );
}
