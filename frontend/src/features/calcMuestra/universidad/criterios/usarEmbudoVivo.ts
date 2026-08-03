import { useEffect, useRef, useState } from "react";

/**
 * F121 · El embudo vivo: qué cifras cambiaron al confirmar el criterio anterior.
 *
 * Gonzalo: «estos criterios, estos gráficos, de forma animada y fluida tienen
 * que actualizarse conforme vayamos confirmando cada uno de los criterios
 * previos».
 *
 * El movimiento aquí **no adorna: señala**. Cuando se confirma un criterio, los
 * siguientes recalculan y sus cifras se mueven; sin una marca, el usuario tiene
 * que recordar los números anteriores para saber qué pasó. Este hook compara el
 * valor con el que tenía y devuelve `true` durante un instante para las que se
 * movieron — sólo para ésas.
 *
 * **Nada que codifique un valor se anima con `transform`** (patrón 12 del ADR
 * 0057). En F55 una animación `scaleX` dejó la barra intercuartílica clavada en
 * su primer fotograma: 3 px renderizados con 154,7 px computados, y el ancho de
 * esa barra ES el dato. El realce entra por color y opacidad, que no pueden
 * mentir sobre una magnitud.
 */
const DURACION_MS = 900;

export function usarCambioReciente(valor: number | null | undefined, duracion = DURACION_MS): boolean {
  const previo = useRef(valor);
  const [reciente, setReciente] = useState(false);

  useEffect(() => {
    // El primer render no es un cambio: si lo fuera, la superficie entera
    // parpadearía al abrir y el realce dejaría de significar «esto se movió».
    if (previo.current === valor) return;
    const habiaValor = previo.current !== undefined;
    previo.current = valor;
    if (!habiaValor) return;

    setReciente(true);
    const t = setTimeout(() => setReciente(false), duracion);
    return () => clearTimeout(t);
  }, [valor, duracion]);

  return reciente;
}

/**
 * Estado de un criterio dentro de la cascada.
 *
 * `espera` es el que hace falta nombrar: no significa «sin dato», significa
 * **dato de antes del cambio**. Un criterio que no puede recalcularse hasta que
 * se confirme el anterior sigue teniendo cifras en pantalla, y presentarlas con
 * la misma firmeza que las confirmadas es el defecto que este estado evita.
 */
export type EstadoCascada = "confirmado" | "editando" | "espera";

/**
 * Reparte los estados de una lista de criterios en orden de embudo.
 *
 * Todo lo anterior al que se está editando está confirmado; todo lo posterior
 * queda en espera. No hay un cuarto caso: el orden del embudo es el del ADR y
 * no se reordena.
 */
export function estadosCascada(total: number, indiceEditando: number | null): EstadoCascada[] {
  return Array.from({ length: total }, (_, i) => {
    if (indiceEditando == null) return "confirmado";
    if (i < indiceEditando) return "confirmado";
    if (i === indiceEditando) return "editando";
    return "espera";
  });
}
