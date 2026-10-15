// Estructura lateral del Informe (I4 del rediseño, 2026-10-14): una columna fija con cada bloque y capítulo, su número,
// cuántas láminas tiene y un punto si alguna pide atención; un clic lleva al capítulo dentro del cuerpo (el único dueño
// del desplazamiento, C4). Bajo 1280 px de ancho se oculta (el CSS lo decide): los capítulos ya ocupan todo el ancho.

import type { EstadoTarjeta } from "./estadoTarjetas";
import type { FilaVistaGeneral } from "./modeloVistaGeneral";

type Props = {
  filas: readonly FilaVistaGeneral[];
  estados: ReadonlyMap<string, EstadoTarjeta>;
  onIr: (filaId: string) => void;
};

export function EstructuraLateral({ filas, estados, onIr }: Props) {
  return (
    <nav className="pulso-f6-vg-estructura" aria-label="Estructura del informe">
      <span className="pulso-f6-vg-estructura-lab">Estructura</span>
      {filas.map((f) => {
        const atencion = f.ids.filter((id) => (estados.get(id)?.clave ?? "lista") !== "lista").length;
        return (
          <button key={f.id} type="button" className={`pulso-f6-vg-ol is-${f.clase}`} onClick={() => onIr(f.id)}
            aria-label={`${f.rotulo}: ${f.ids.length} láminas${atencion ? `, ${atencion} ${atencion === 1 ? "pide" : "piden"} atención` : ""}`}>
            {f.clase === "capitulo" && f.numero ? <span className="pulso-f6-vg-ol-n">{f.numero}</span> : null}
            <span className="pulso-f6-vg-ol-t">{f.titulo}</span>
            <span className="pulso-f6-vg-ol-c">{f.ids.length}</span>
            {atencion > 0 && <i className="pulso-f6-vg-ol-punto" aria-hidden="true" />}
          </button>
        );
      })}
    </nav>
  );
}
