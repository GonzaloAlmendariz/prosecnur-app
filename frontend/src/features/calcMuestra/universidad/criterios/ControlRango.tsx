import { useId } from "react";

import { acotarUmbral } from "./ControlUmbral";
import "./controlUmbral.css";

/**
 * F121 · Rango de dos cortes, con dos manijas y la banda entre ellas.
 *
 * Decisión de Gonzalo: «el rango con dos manijas». Es la lectura correcta —lo
 * que se elige es un tramo, no dos números sueltos— y la banda lo dice sin
 * explicarlo.
 *
 * **Dos `<input type="range">` superpuestos**, no un widget propio. Cada manija
 * es un control nativo de verdad: se opera con teclado, la anuncia un lector de
 * pantalla y respeta las preferencias del sistema. Un deslizador dibujado a
 * mano con `pointerdown` se ve igual y no hace nada de eso.
 *
 * Los dos se cruzan a propósito: mover el inferior por encima del superior
 * **los intercambia** en vez de bloquear. Bloquear obliga a soltar, mover el
 * otro y volver; intercambiar hace lo que la mano estaba pidiendo.
 */
/**
 * Ordena y acota un tramo.
 *
 * Cruzar las manijas **las intercambia** en vez de bloquear: bloquear obliga a
 * soltar, mover la otra y volver; intercambiar hace lo que la mano pedía.
 *
 * Se exporta para poder probarlo. La primera tanda de mutaciones descubrió que
 * este comportamiento estaba documentado y **no tenía prueba** — quitarlo no
 * rompía nada.
 */
export function ordenarRango(a: number, b: number, min: number, max: number): { desde: number; hasta: number } {
  const x = acotarUmbral(a, min, max);
  const y = acotarUmbral(b, min, max);
  return x <= y ? { desde: x, hasta: y } : { desde: y, hasta: x };
}

export function ControlRango({
  desde,
  hasta,
  min,
  max,
  paso = 1,
  sufijo,
  etiqueta,
  descripcion,
  deshabilitado = false,
  umbralSospecha = 40,
  onCambio,
}: {
  desde: number;
  hasta: number;
  min: number;
  max: number;
  paso?: number;
  sufijo?: string;
  etiqueta: string;
  descripcion?: string;
  deshabilitado?: boolean;
  /**
   * Cuántos valores distintos dejan de ser plausibles para este criterio.
   * `null` desactiva el aviso — no todo rango es ordinal.
   */
  umbralSospecha?: number | null;
  onCambio: (rango: { desde: number; hasta: number }) => void;
}) {
  const id = useId();

  const emitir = (d: number, h: number) => onCambio(ordenarRango(d, h, min, max));

  /*
   * No es una validación: es una lectura. Un criterio ordinal con cientos de
   * valores distintos casi nunca es ordinal — suele ser un identificador que
   * cayó en el rol equivocado. Se declara la sospecha y se deja decidir; el
   * motor puede tener razón y este control no es quién para bloquear.
   */
  const avisoDominio =
    umbralSospecha != null && max - min + 1 > umbralSospecha
      ? `El rango va de ${min} a ${max}: son ${max - min + 1} valores distintos. Si esto debería ser un nivel o un ciclo, revisa a qué columna está mapeado en Datos › Variables.`
      : null;

  const span = max - min;
  const pct = (v: number) => (span > 0 ? ((v - min) / span) * 100 : 0);

  return (
    <div className="cmv2-umbral-control" data-deshabilitado={deshabilitado || undefined}>
      <span className="cmv2-umbral-etiqueta">{etiqueta}</span>

      <div className="cmv2-rango-pistas">
        {/* La banda es la lectura: el tramo que entra. Va detrás de las manijas
            y no recibe puntero — mover el rango es mover una manija. */}
        <i className="cmv2-rango-banda" style={{ left: `${pct(desde)}%`, width: `${Math.max(0, pct(hasta) - pct(desde))}%` }} />
        <input
          className="cmv2-rango-manija"
          type="range"
          id={`${id}-d`}
          min={min}
          max={max}
          step={paso}
          value={desde}
          disabled={deshabilitado}
          aria-label={`${etiqueta} — desde`}
          onChange={(e) => emitir(Number(e.currentTarget.value), hasta)}
        />
        <input
          className="cmv2-rango-manija"
          type="range"
          id={`${id}-h`}
          min={min}
          max={max}
          step={paso}
          value={hasta}
          disabled={deshabilitado}
          aria-label={`${etiqueta} — hasta`}
          onChange={(e) => emitir(desde, Number(e.currentTarget.value))}
        />
      </div>

      <div className="cmv2-rango-campos">
        <span className="cmv2-umbral-campo">
          <input
            type="number" min={min} max={max} step={paso} value={desde} disabled={deshabilitado}
            aria-label={`${etiqueta} — desde, valor exacto`}
            onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) emitir(v, hasta); }}
          />
          {sufijo ? <em aria-hidden="true">{sufijo}</em> : null}
        </span>
        <span className="cmv2-rango-guion" aria-hidden="true">–</span>
        <span className="cmv2-umbral-campo">
          <input
            type="number" min={min} max={max} step={paso} value={hasta} disabled={deshabilitado}
            aria-label={`${etiqueta} — hasta, valor exacto`}
            onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) emitir(desde, v); }}
          />
          {sufijo ? <em aria-hidden="true">{sufijo}</em> : null}
        </span>
      </div>

      {descripcion ? <p className="cmv2-umbral-efecto">{descripcion}</p> : null}

      {/* G17 · Un dominio implausiblemente ancho delata un mapeo equivocado.
          Medido en la app: «Nivel del curso» ofrecía un rango de 1 a 852 porque
          el proyecto lo mapeó a la columna del CÓDIGO de curso. El motor obedece
          —un mapeo manual gana por diseño, y eso está bien— así que el sitio
          donde el error se puede ver es aquí, cuando se ofrece elegir sobre él.

          Con dos `<select>` de 852 opciones esto pasaba inadvertido; con una
          barra, el rango se lee de un vistazo. Decirlo cuesta una línea. */}
      {avisoDominio ? (
        <p className="cmv2-umbral-sospecha" role="note">{avisoDominio}</p>
      ) : null}
    </div>
  );
}
