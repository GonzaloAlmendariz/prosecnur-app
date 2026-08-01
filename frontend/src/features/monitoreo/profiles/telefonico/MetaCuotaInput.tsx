import { useEffect, useRef, useState } from "react";

/**
 * El campo de meta de una cuota telefónica.
 *
 * Por qué existe como componente y no como `<input>` suelto: escribir una meta
 * de dos cifras era imposible. El input estaba atado al estado del servidor
 * (`value={row.meta ?? 0}`) y cada pulsación llamaba `updateMeta`, que persiste
 * la config entera y recalcula universo, brecha, tasa requerida y reserva. Dos
 * efectos, los dos medidos en PDM Medios de Vida 2026:
 *
 *  - `Number("") || 0` convierte el campo vacío en `0` en el mismo golpe de
 *    tecla, así que borrar para reescribir devolvía un `0` y el cursor saltaba.
 *  - para llegar a «80» había que pasar por «8», y ese `8` intermedio se
 *    guardaba y recalculaba como si fuera la meta querida.
 *
 * La regla acá es que **escribir no es decidir**: el texto vive local mientras
 * el campo tiene el foco y solo se confirma al salir (blur) o con Enter. Escape
 * descarta y vuelve al valor guardado, que es lo que la tecla promete en el
 * resto de la app.
 *
 * El input queda no controlado respecto del servidor mientras se edita: sin eso
 * un recálculo en vuelo —el sync de otra fuente, por ejemplo— pisaría lo que la
 * persona está tecleando.
 */
/**
 * Qué meta deja un texto al confirmarlo, contra la meta ya guardada.
 *
 * Vive aparte del componente para poder fijarla con un test: es la regla que
 * antes estaba escrita como `Number(event.target.value) || 0` en el `onChange`,
 * donde convertía el vacío en cero mientras se tecleaba.
 *
 * `null` significa «no hay nada que guardar»: texto vacío, basura, negativo, o
 * un valor que coincide con el guardado. En los tres primeros el campo vuelve a
 * mostrar lo guardado; en el último no hace falta persistir nada.
 */
export function metaConfirmada(texto: string, guardado: number): number | null {
  const limpio = texto.trim();
  if (limpio === "") return null;
  const numero = Number(limpio);
  if (!Number.isFinite(numero) || numero < 0) return null;
  const meta = Math.round(numero);
  return meta === guardado ? null : meta;
}

export function MetaCuotaInput({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number | null | undefined;
  onCommit: (meta: number) => void;
  ariaLabel?: string;
}) {
  const guardado = String(value ?? 0);
  const [texto, setTexto] = useState(guardado);
  const editando = useRef(false);

  // Mientras se edita, el valor del servidor no toca el campo. Al soltarlo, el
  // campo vuelve a reflejar lo guardado —incluido el caso en que el backend
  // normalizó la meta a algo distinto de lo tecleado.
  useEffect(() => {
    if (!editando.current) setTexto(guardado);
  }, [guardado]);

  const confirmar = () => {
    editando.current = false;
    const meta = metaConfirmada(texto, Number(guardado));
    if (meta == null) {
      setTexto(guardado);
      return;
    }
    setTexto(String(meta));
    onCommit(meta);
  };

  return (
    <input
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      aria-label={ariaLabel}
      value={texto}
      onFocus={() => {
        editando.current = true;
      }}
      onChange={(event) => {
        editando.current = true;
        setTexto(event.currentTarget.value);
      }}
      onBlur={confirmar}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          editando.current = false;
          setTexto(guardado);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
