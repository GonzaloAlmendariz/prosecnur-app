// Columna de piezas de Identidad (ID2 del rediseño, 2026-10-14): cada pieza con lo que tiene ahora y un estado de un
// vistazo, y debajo «A qué salida llega» (PPT / Word). Es la navegación de la pestaña: una lista de pestañas vertical
// (flechas arriba/abajo, Inicio/Fin) sobre el `foco` de la dirección, como las subpestañas que reemplaza.

import { useRef, type KeyboardEvent } from "react";

export type ClavePieza = "linea" | "colores" | "logos" | "letra" | "iconos";
export type TonoEstado = "ok" | "aviso" | "neutro";
export type Pieza = { clave: ClavePieza; titulo: string; resumen: string; estado: { texto: string; tono: TonoEstado } };

/** Qué pieza llega a qué salida. Logos y letra llegan al PPT con la decisión D5 (ID9); hasta entonces, sólo al Word. */
export const SALIDAS: readonly { clave: ClavePieza; titulo: string; ppt: boolean; word: boolean }[] = [
  { clave: "linea", titulo: "Línea visual", ppt: true, word: true },
  { clave: "colores", titulo: "Colores", ppt: true, word: true },
  { clave: "logos", titulo: "Logos", ppt: false, word: true },
  { clave: "letra", titulo: "Letra", ppt: false, word: true },
  { clave: "iconos", titulo: "Íconos", ppt: true, word: true },
];

type Props = { piezas: readonly Pieza[]; actual: ClavePieza; onElegir: (k: ClavePieza) => void; idPanel: string };

export function PiezasIdentidad({ piezas, actual, onElegir, idPanel }: Props) {
  const lista = useRef<HTMLDivElement>(null);
  const onTecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const paso = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    const extremo = e.key === "Home" ? 0 : e.key === "End" ? piezas.length - 1 : null;
    if (!paso && extremo === null) return;
    e.preventDefault();
    const i = piezas.findIndex((p) => p.clave === actual);
    const j = extremo ?? (i + paso + piezas.length) % piezas.length;
    onElegir(piezas[j].clave);
    lista.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[j]?.focus();
  };
  return (
    <aside className="pulso-f6-id-piezas">
      <div ref={lista} role="tablist" aria-orientation="vertical" aria-label="Piezas de la identidad" onKeyDown={onTecla}
        data-qa-geometry-group="graficos/f6-id-piezas" data-qa-geometry-contract="equal">
        {piezas.map((p) => (
          <button key={p.clave} type="button" role="tab" id={`f6-id-pieza-${p.clave}`} aria-selected={p.clave === actual}
            aria-controls={idPanel} tabIndex={p.clave === actual ? 0 : -1} data-qa-geometry-member
            className={`pulso-f6-id-pieza${p.clave === actual ? " is-activa" : ""}`} onClick={() => onElegir(p.clave)}>
            <span className="pulso-f6-id-pieza-texto">
              <b>{p.titulo}</b>
              <small>{p.resumen}</small>
            </span>
            <span className={`pulso-f6-id-pill is-${p.estado.tono}`}>{p.estado.texto}</span>
          </button>
        ))}
      </div>
      <div className="pulso-f6-id-salidas" role="table" aria-label="A qué salida llega cada pieza">
        <span className="pulso-f6-id-salidas-lab" aria-hidden="true">A qué salida llega</span>
        <span className="pulso-f6-id-salidas-fila is-cabecera" role="row">
          <span role="columnheader"><span className="pulso-sr-only">Pieza</span></span>
          <b role="columnheader">PPT</b><b role="columnheader">Word</b>
        </span>
        {SALIDAS.map((s) => (
          <span key={s.clave} className="pulso-f6-id-salidas-fila" role="row">
            <span role="rowheader">{s.titulo}</span>
            <i role="cell" className={s.ppt ? "is-si" : ""} aria-label={s.ppt ? "Llega al PPT" : "No llega al PPT"} />
            <i role="cell" className={s.word ? "is-si" : ""} aria-label={s.word ? "Llega al Word" : "No llega al Word"} />
          </span>
        ))}
        <p className="pulso-f6-id-salidas-nota">Logos y letra llegarán también al PPT (decisión D5).</p>
      </div>
    </aside>
  );
}
