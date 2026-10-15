// Menú lateral de Gráficos: las piezas de Identidad y las partes del Word (pedido de Gonzalo, 2026-10-15: «a eso le hace
// falta verse más profesional y uniforme»). Antes eran dos listas con estados, alturas y tipografías distintas; ahora
// una sola: ícono en su recuadro, título, resumen en una línea y, si hay, un dato a la derecha con su punto de color.
// Es una lista de pestañas vertical (flechas, Inicio/Fin) sobre el `foco` de la dirección.

import { useRef, type KeyboardEvent } from "react";
import type { LucideIcon } from "../../../vendor/lucide-react";
import "./menuLateral.css";

export type TonoDato = "ok" | "aviso" | "neutro";
export type ItemMenu<K extends string> = {
  clave: K;
  titulo: string;
  resumen: string;
  icono: LucideIcon;
  dato?: { texto: string; tono: TonoDato };
};

type Props<K extends string> = {
  items: readonly ItemMenu<K>[];
  actual: K;
  onElegir: (k: K) => void;
  idPanel: string;
  etiqueta: string;
  /** Id de cada pestaña, que el panel cita en `aria-labelledby`. */
  idDe: (k: K) => string;
  className?: string;
  grupoQa: string;
  contratoQa: "equal" | "intrinsic";
};

export function MenuLateral<K extends string>({ items, actual, onElegir, idPanel, etiqueta, idDe, className, grupoQa, contratoQa }: Props<K>) {
  const lista = useRef<HTMLDivElement>(null);
  const onTecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const paso = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    const extremo = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : null;
    if (!paso && extremo === null) return;
    e.preventDefault();
    const i = items.findIndex((x) => x.clave === actual);
    const j = extremo ?? (i + paso + items.length) % items.length;
    onElegir(items[j].clave);
    lista.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[j]?.focus();
  };
  return (
    <div ref={lista} className={`pulso-f6-menu${className ? ` ${className}` : ""}`} role="tablist" aria-orientation="vertical" aria-label={etiqueta}
      onKeyDown={onTecla} data-qa-geometry-group={grupoQa} data-qa-geometry-contract={contratoQa}>
      {items.map(({ clave, titulo, resumen, icono: Icono, dato }) => {
        const activa = clave === actual;
        return (
          <button key={clave} type="button" role="tab" id={idDe(clave)} aria-selected={activa} aria-controls={idPanel}
            tabIndex={activa ? 0 : -1} data-qa-geometry-member className={`pulso-f6-menu-item${activa ? " is-activa" : ""}`}
            onClick={() => onElegir(clave)}>
            <span className="pulso-f6-menu-icono" aria-hidden="true"><Icono size={15} strokeWidth={1.8} /></span>
            <span className="pulso-f6-menu-texto">
              <b>{titulo}</b>
              <small title={resumen}>{resumen}</small>
            </span>
            {dato && <span className={`pulso-f6-menu-dato is-${dato.tono}`}>{dato.texto}</span>}
          </button>
        );
      })}
    </div>
  );
}
