// Menú de las cinco partes del Word (W1 del rediseño, 2026-10-15): lista de pestañas vertical sobre el `foco` de la
// dirección, como las piezas de Identidad (flechas arriba/abajo, Inicio/Fin). Bajo 1280 px se pone en fila (CSS).

import { useRef, type KeyboardEvent } from "react";
import type { ParteWord } from "./modeloPestanaWord";

type Props = { partes: readonly { key: ParteWord; label: string; resumen: string }[]; actual: ParteWord; onElegir: (k: ParteWord) => void; idPanel: string };

export function PartesWord({ partes, actual, onElegir, idPanel }: Props) {
  const lista = useRef<HTMLDivElement>(null);
  const onTecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const paso = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    const extremo = e.key === "Home" ? 0 : e.key === "End" ? partes.length - 1 : null;
    if (!paso && extremo === null) return;
    e.preventDefault();
    const i = partes.findIndex((p) => p.key === actual);
    const j = extremo ?? (i + paso + partes.length) % partes.length;
    onElegir(partes[j].key);
    lista.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[j]?.focus();
  };
  return (
    <div ref={lista} className="pulso-f6-w-partes" role="tablist" aria-orientation="vertical" aria-label="Partes del documento"
      onKeyDown={onTecla} data-qa-geometry-group="graficos/f6-w-partes" data-qa-geometry-contract="equal">
      {partes.map((p) => (
        <button key={p.key} type="button" role="tab" id={`f6-w-parte-${p.key}`} aria-selected={p.key === actual} aria-controls={idPanel} aria-label={`${p.label}. ${p.resumen}`}
          tabIndex={p.key === actual ? 0 : -1} data-qa-geometry-member className={`pulso-f6-w-parte${p.key === actual ? " is-activa" : ""}`}
          onClick={() => onElegir(p.key)}>
          <b>{p.label}</b>
          <small>{p.resumen}</small>
        </button>
      ))}
    </div>
  );
}
