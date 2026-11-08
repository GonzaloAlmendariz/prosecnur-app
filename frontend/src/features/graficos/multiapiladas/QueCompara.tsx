// G12 parte 2 (Gonzalo aprobó la maqueta docs/qa/maqueta-editor-multiapiladas-2026-10-13.html): «Qué compara» pasa de
// cinco tarjetas grandes a una fila de opciones con una línea que describe la elegida.
//
// 2026-10-14 (Gonzalo, sobre esa línea: «hace falta explicar mucho mejor qué hace cada uno, hasta ahora no se entiende
// casi nada»): debajo de la fila va una explicación corta de la opción elegida —un boceto de cómo sale el gráfico, qué
// es cada barra y un ejemplo—, no un párrafo más.

import { RadioSegmentado } from "../subpestanas/RadioSegmentado";

/** Boceto de la opción: bloques (con título o sin él) y, en cada uno, los rótulos de sus barras. */
export type BocetoQueCompara = { bloques: { titulo?: string; filas: string[] }[] };

export type OpcionQueCompara = {
  key: string;
  titulo: string;
  descripcion: string;
  /** Qué es cada barra (y cada bloque) del gráfico que sale. */
  cadaBarra?: string;
  ejemplo?: string;
  boceto?: BocetoQueCompara;
  deshabilitada?: string | null;
};

/** Anchos fijos del boceto: una escala de cuatro tramos que se lee como «acuerdo», sin datos reales. */
const TRAMOS = [
  [12, 22, 40, 26],
  [8, 30, 38, 24],
  [18, 26, 34, 22],
];

function Boceto({ boceto }: { boceto: BocetoQueCompara }) {
  let fila = 0;
  return (
    <div className="pulso-mapi-boceto" aria-hidden="true">
      {boceto.bloques.map((b, i) => (
        <div key={i} className="pulso-mapi-boceto-bloque">
          {b.titulo && <span className="pulso-mapi-boceto-titulo">{b.titulo}</span>}
          {b.filas.map((rotulo) => {
            const tramos = TRAMOS[fila++ % TRAMOS.length];
            return (
              <div key={rotulo} className="pulso-mapi-boceto-fila">
                <span className="pulso-mapi-boceto-rotulo">{rotulo}</span>
                <span className="pulso-mapi-boceto-barra">
                  {tramos.map((w, k) => <span key={k} className={`is-t${k + 1}`} style={{ width: `${w}%` }} />)}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function QueCompara({ opciones, activa, onElegir }: { opciones: readonly OpcionQueCompara[]; activa: string; onElegir: (key: string) => void }) {
  const actual = opciones.find((o) => o.key === activa);
  return (
    <div className="pulso-mapi-quecompara">
      <span className="pulso-mapi-rotulo" aria-hidden="true">Qué compara</span>
      {/* R9-1: el segmentado del kit (RadioSegmentado), en partes iguales a todo el ancho; un rótulo largo parte línea. */}
      <RadioSegmentado
        etiqueta="Qué compara"
        ancho
        multilinea
        valor={activa}
        onCambiar={onElegir}
        qaGrupo="graficos/mapi-que-compara"
        opciones={opciones.map((o) => ({ clave: o.key, rotulo: o.titulo, titulo: o.deshabilitada ?? o.descripcion, deshabilitada: !!o.deshabilitada }))}
      />
      {actual && (
        <div className="pulso-mapi-explica">
          {actual.boceto && <Boceto boceto={actual.boceto} />}
          <div className="pulso-mapi-explica-texto">
            <p className="pulso-mapi-desc">{actual.descripcion}</p>
            {actual.cadaBarra && <p className="pulso-mapi-explica-linea"><strong>Cómo sale:</strong> {actual.cadaBarra}</p>}
            {actual.ejemplo && <p className="pulso-mapi-explica-linea"><strong>Ejemplo:</strong> {actual.ejemplo}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
