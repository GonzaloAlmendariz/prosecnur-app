import { useId } from "react";

import "./controlUmbral.css";

/**
 * F120 · El nivelador de un criterio de umbral o de proporción.
 *
 * Gonzalo: «el criterio de umbral y el de proporción no son criterios que se
 * puedan establecer únicamente con switcher; al activar el switcher, justo
 * abajo hay un pequeño espacio vacío, y allí puede ir algún tipo de nivelador,
 * algo que nos permita modificar un valor continuo. En Ingeniería quiero
 * establecer un mínimo y ser capaz de modificarlo: quizás 15, quizás 20; igual
 * con la prevalencia, quizás la suba a 60 % o a 80 %».
 *
 * Dos controles sobre el mismo valor, y no es redundancia:
 *
 * - **El deslizador** sirve para *buscar*. Con el gráfico al lado, arrastrarlo
 *   es recorrer la distribución viendo qué recorta cada posición — que es
 *   exactamente la decisión que se está tomando.
 * - **El campo numérico** sirve para *fijar*. Un mínimo de 20 se escribe; con
 *   el deslizador cuesta clavarlo, y peor cuanto más ancho es el rango.
 *
 * Quitar cualquiera de los dos deja media tarea sin herramienta.
 */
/**
 * Acota un valor a su rango.
 *
 * Se exporta para poder probarlo: la primera versión de su test comprobaba una
 * copia local de esta función, así que habría pasado aunque el control no
 * acotara nada. Un test que reimplementa lo que juzga no juzga nada.
 */
export function acotarUmbral(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function ControlUmbral({
  valor,
  min,
  max,
  paso = 1,
  sufijo,
  etiqueta,
  descripcion,
  deshabilitado = false,
  alineadoConEje = false,
  onCambio,
}: {
  valor: number;
  min: number;
  max: number;
  paso?: number;
  /** «%» en una proporción; vacío en un conteo. */
  sufijo?: string;
  /** Qué se está fijando. Va en el control, no en una nota aparte. */
  etiqueta: string;
  /** Consecuencia del valor actual, publicada por el motor. Opcional. */
  descripcion?: string;
  deshabilitado?: boolean;
  /**
   * G31 · La pista comparte recorrido con el eje del gráfico.
   *
   * Cuando el control vive junto a la distribución que recorta, alinear su pista
   * con la escala convierte arrastrar la manija en **mover el corte sobre el
   * gráfico**. Sin alinear, el usuario traduce «un tercio de la barra» a «un
   * tercio del eje», y las dos barras ni siquiera medían lo mismo.
   */
  alineadoConEje?: boolean;
  onCambio: (valor: number) => void;
}) {
  const id = useId();

  // El valor se acota al rango antes de salir: un umbral fuera de escala se
  // dibuja fuera del gráfico, y ese es el caso que menos se ve (F117).
  const acotar = (v: number) => acotarUmbral(v, min, max);

  return (
    <div
      className="cmv2-umbral-control"
      data-deshabilitado={deshabilitado || undefined}
      data-alineado={alineadoConEje || undefined}
    >
      <label className="cmv2-umbral-etiqueta" htmlFor={`${id}-n`}>
        {etiqueta}
      </label>
      <div className="cmv2-umbral-fila">
        {/* El deslizador busca; el campo fija. Comparten valor y rango, así que
            mover uno mueve el otro y ninguno puede quedar en un estado que el
            otro no admita. */}
        <input
          className="cmv2-umbral-rango"
          type="range"
          id={`${id}-r`}
          min={min}
          max={max}
          step={paso}
          value={valor}
          disabled={deshabilitado}
          aria-label={`${etiqueta} — deslizador`}
          onChange={(e) => onCambio(acotar(Number(e.currentTarget.value)))}
        />
        <span className="cmv2-umbral-campo">
          <input
            type="number"
            id={`${id}-n`}
            min={min}
            max={max}
            step={paso}
            value={valor}
            disabled={deshabilitado}
            onChange={(e) => {
              const v = Number(e.currentTarget.value);
              if (Number.isFinite(v)) onCambio(acotar(v));
            }}
          />
          {sufijo ? <em aria-hidden="true">{sufijo}</em> : null}
        </span>
      </div>
      {/* La consecuencia del valor, cuando el motor la publica. Es lo único que
          justifica ocupar una línea más: dice qué pasa si se deja aquí. */}
      {descripcion ? <p className="cmv2-umbral-efecto">{descripcion}</p> : null}
      <p className="cmv2-umbral-rango-nota" aria-hidden="true">
        <span>{min}{sufijo}</span>
        <span>{max}{sufijo}</span>
      </p>
    </div>
  );
}
