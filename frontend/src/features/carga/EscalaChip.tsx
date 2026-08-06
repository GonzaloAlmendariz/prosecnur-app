// Chip de escala con su lista desplegable (ADR 0064).
//
// El chip decía la escala entera y la recortaba con puntos suspensivos a 240 px.
// Con cinco opciones —«Totalmente en desacuerdo / En desacuerdo / De acuerdo /
// Totalmente de acuerdo / SIN INF»— deformaba la cabecera de la tarjeta y no
// llegaba a decir la escala: lo que se leía era el principio de la primera
// opción. Aquí el chip dice lo que cabe —la escala corta entera, o cuántas
// opciones son— y el resto se despliega.
//
// El popover va en `position: fixed` y NO absoluto: la tarjeta de diapositiva
// tiene `overflow-x: auto` porque su tabla es más ancha que el contenedor, y
// cualquier hijo posicionado dentro queda recortado por ese contenedor. Fijo y
// anclado al rectángulo del chip es lo único que sobrevive al recorte.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "../../vendor/lucide-react";
import type { OpcionDeEscala } from "../../api/equivalencias";

export type EscalaChipProps = {
  /** Resumen que cabe en el chip. */
  texto: string;
  /** Opciones enteras. Sin ellas el chip no despliega nada y no es un botón. */
  opciones: readonly OpcionDeEscala[];
  /** Qué describe esta escala, para el lector de pantalla. */
  contexto: string;
};

export function EscalaChip({ texto, opciones, contexto }: EscalaChipProps) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ancla = useRef<HTMLButtonElement | null>(null);
  const globo = useRef<HTMLDivElement | null>(null);

  const colocar = useCallback(() => {
    const el = ancla.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Se ancla a la derecha del chip porque el chip vive al final de la cabecera;
    // así el globo crece hacia dentro de la tarjeta y no hacia fuera de la
    // ventana. El clamp deja 8 px de margen en viewports estrechos.
    const ancho = 300;
    const left = Math.min(Math.max(8, r.right - ancho), window.innerWidth - ancho - 8);
    setPos({ top: r.bottom + 6, left });
  }, []);

  useLayoutEffect(() => {
    if (!abierto) return;
    colocar();
  }, [abierto, colocar]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setAbierto(false);
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        ancla.current?.focus();
      }
    };
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!globo.current?.contains(t) && !ancla.current?.contains(t)) setAbierto(false);
    };
    // El globo es fijo: si la página o la tarjeta se desplazan, deja de estar
    // donde su chip. Cerrarlo es más honesto que perseguirlo en cada scroll.
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("mousedown", fuera);
    return () => {
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("mousedown", fuera);
    };
  }, [abierto]);

  if (!texto) return null;

  // Sin opciones que desplegar no hay nada que abrir: se muestra como etiqueta y
  // no como control, para no ofrecer una afordancia que no lleva a ningún sitio.
  if (!opciones.length) {
    return <span className="pulso-equiv-chip-escala">{texto}</span>;
  }

  return (
    <>
      <button
        ref={ancla}
        type="button"
        className={abierto ? "pulso-equiv-chip-escala is-abierto" : "pulso-equiv-chip-escala"}
        aria-expanded={abierto}
        aria-label={`Escala de ${contexto}: ${opciones.length} opciones`}
        onClick={() => setAbierto((v) => !v)}
      >
        <span>{texto}</span>
        <ChevronDown size={11} aria-hidden="true" />
      </button>

      {abierto && pos && (
        <div
          ref={globo}
          className="pulso-equiv-escala-globo"
          role="dialog"
          aria-label={`Opciones de la escala de ${contexto}`}
          style={{ top: pos.top, left: pos.left }}
        >
          <p className="pulso-equiv-escala-globo-head">
            {opciones.length} opciones · {contexto}
          </p>
          <ol className="pulso-equiv-escala-lista">
            {opciones.map((o) => (
              <li key={o.codigo}>
                <span className="pulso-equiv-escala-codigo">{o.codigo}</span>
                <span>{o.etiqueta}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
