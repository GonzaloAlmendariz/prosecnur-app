/**
 * Campo numérico que confirma al SALIR, no en cada tecla.
 *
 * Los dos controles de la mesa —`ControlUmbral` y `ControlRango`— emitían en
 * `onChange`, es decir en cada pulsación, y acotaban o reordenaban el valor
 * intermedio. Eso hace imposible teclear un número de dos dígitos:
 *
 * - Con el mínimo en 10, teclear «20» empieza por «2», que se acota a 10; la
 *   siguiente tecla compone «100» y el campo salta al máximo. Es el «agrego un
 *   valor y me agrega ceros» que Gonzalo reportó el 2026-08-25 sobre el mínimo
 *   de elegibles.
 * - En un rango 2–12, teclear «10» en el extremo alto empieza por «1», que es
 *   menor que 2, y `ordenarRango` INTERCAMBIA los extremos; la segunda tecla ya
 *   opera sobre otro estado.
 * - Y borrar el campo para reescribirlo produce `""`, que `Number("")` convierte
 *   en `0` —un cero que `Number.isFinite` acepta como válido y se emite.
 *
 * Aquí el texto tecleado vive en el campo hasta que el usuario termina: se
 * confirma con Enter o al perder el foco, se cancela con Escape, y un campo
 * vacío o ilegible revierte al valor vigente en vez de inventar un cero. El
 * deslizador sigue emitiendo en vivo, que ahí es lo correcto: cada arrastre es
 * un valor completo, no un estado a medio escribir.
 */
import { useEffect, useRef, useState } from "react";

/**
 * Qué hacer con el texto al terminar de escribirlo: `null` significa REVERTIR
 * al valor vigente, no emitir.
 *
 * El caso que obliga a distinguirlos es el campo vacío. `Number("")` es `0` y
 * `Number.isFinite(0)` es cierto, así que borrar el campo para reescribirlo
 * emitía un cero perfectamente válido —y en un mínimo de elegibles, un cero
 * silencioso deja pasar todas las aulas—. Vaciar un campo no es pedir cero: es
 * no haber terminado.
 */
export function numeroConfirmable(texto: string): number | null {
  if (texto.trim() === "") return null;
  const v = Number(texto);
  return Number.isFinite(v) ? v : null;
}

export function CampoNumero({
  valor,
  min,
  max,
  paso = 1,
  id,
  sufijo,
  ariaLabel,
  deshabilitado = false,
  onConfirmar,
}: {
  /** Valor vigente. Manda cuando el campo no se está editando. */
  valor: number;
  min: number;
  max: number;
  paso?: number;
  id?: string;
  /** «%» en una proporción; vacío en un conteo. */
  sufijo?: string;
  ariaLabel?: string;
  deshabilitado?: boolean;
  /** Se llama con el número tecleado, ya completo. Acotar es del llamador. */
  onConfirmar: (valor: number) => void;
}) {
  const [texto, setTexto] = useState(() => String(valor));
  const editando = useRef(false);

  // Mientras se teclea manda el texto; el resto del tiempo manda el valor. Sin
  // esto, mover el deslizador no actualizaría el número de al lado.
  useEffect(() => {
    if (!editando.current) setTexto(String(valor));
  }, [valor]);

  function confirmar() {
    editando.current = false;
    const v = numeroConfirmable(texto);
    if (v === null) setTexto(String(valor));
    else onConfirmar(v);
  }

  function cancelar() {
    editando.current = false;
    setTexto(String(valor));
  }

  return (
    <span className="cmv2-umbral-campo">
      <input
        type="number"
        id={id}
        min={min}
        max={max}
        step={paso}
        value={texto}
        disabled={deshabilitado}
        aria-label={ariaLabel}
        onFocus={() => { editando.current = true; }}
        onChange={(e) => { editando.current = true; setTexto(e.currentTarget.value); }}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmar();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelar();
          }
        }}
      />
      {sufijo ? <em aria-hidden="true">{sufijo}</em> : null}
    </span>
  );
}
