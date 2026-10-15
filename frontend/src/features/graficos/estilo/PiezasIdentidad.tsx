// Columna de piezas de Identidad (ID2 del rediseño, 2026-10-14): cada pieza con lo que tiene ahora y un estado de un
// vistazo, y debajo «A qué salida llega» (PPT / Word). Es la navegación de la pestaña: una lista de pestañas vertical
// (flechas arriba/abajo, Inicio/Fin) sobre el `foco` de la dirección, como las subpestañas que reemplaza.

import { Blocks, Image, Layers, Palette, Type } from "../../../vendor/lucide-react";
import { MenuLateral } from "../subpestanas/MenuLateral";

export type ClavePieza = "linea" | "colores" | "logos" | "letra" | "iconos";
export type TonoEstado = "ok" | "aviso" | "neutro";
export type Pieza = { clave: ClavePieza; titulo: string; resumen: string; estado: { texto: string; tono: TonoEstado } };

/** Qué pieza llega a qué salida. ID9 (d589311b3): logos y letra llegan también al PPT (decisión D5). */
export const SALIDAS: readonly { clave: ClavePieza; titulo: string; ppt: boolean; word: boolean }[] = [
  { clave: "linea", titulo: "Línea visual", ppt: true, word: true },
  { clave: "colores", titulo: "Colores", ppt: true, word: true },
  { clave: "logos", titulo: "Logos", ppt: true, word: true },
  { clave: "letra", titulo: "Letra", ppt: true, word: true },
  { clave: "iconos", titulo: "Íconos", ppt: true, word: true },
];

type Props = { piezas: readonly Pieza[]; actual: ClavePieza; onElegir: (k: ClavePieza) => void; idPanel: string };

const ICONOS = { linea: Layers, colores: Palette, logos: Image, letra: Type, iconos: Blocks } as const;

export function PiezasIdentidad({ piezas, actual, onElegir, idPanel }: Props) {
  return (
    <aside className="pulso-f6-id-piezas">
      {/* Mismo menú que las partes del Word (MenuLateral); el estado de cada pieza va como dato a la derecha. */}
      <MenuLateral items={piezas.map((p) => ({ clave: p.clave, titulo: p.titulo, resumen: p.resumen, icono: ICONOS[p.clave], dato: p.estado }))}
        actual={actual} onElegir={onElegir} idPanel={idPanel} etiqueta="Piezas de la identidad" idDe={(k) => `f6-id-pieza-${k}`}
        grupoQa="graficos/f6-id-piezas" contratoQa="equal" />
      <div className="pulso-f6-id-salidas" role="table" data-qa-geometry-group="graficos/f6-id-salidas" data-qa-geometry-contract="intrinsic" aria-label="A qué salida llega cada pieza">
        <span className="pulso-f6-id-salidas-lab" aria-hidden="true">A qué salida llega</span>
        <span className="pulso-f6-id-salidas-fila is-cabecera" role="row">
          <span role="columnheader"><span className="pulso-sr-only">Pieza</span></span>
          <b role="columnheader">PPT</b><b role="columnheader">Word</b>
        </span>
        {SALIDAS.map((s) => (
          <span key={s.clave} className="pulso-f6-id-salidas-fila" role="row" data-qa-geometry-group="graficos/f6-id-salidas-fila" data-qa-geometry-contract="intrinsic">
            <span role="rowheader">{s.titulo}</span>
            <i role="cell" data-qa-geometry-capacity="owned" className={s.ppt ? "is-si" : ""} aria-label={s.ppt ? "Llega al PPT" : "No llega al PPT"} />
            <i role="cell" data-qa-geometry-capacity="owned" className={s.word ? "is-si" : ""} aria-label={s.word ? "Llega al Word" : "No llega al Word"} />
          </span>
        ))}
        <p className="pulso-f6-id-salidas-nota">Con una plantilla de cliente que trae su propia portada, los logos propios no se ponen en ella.</p>
      </div>
    </aside>
  );
}
