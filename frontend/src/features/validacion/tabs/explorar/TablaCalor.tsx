import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { estiloConVariables } from "./estiloConVariables";
import { fmtN, type CeldaCalor, type LecturaCalor, type ModeloCalor } from "./explorarModelo";

export const LECTURAS_CALOR: readonly { valor: LecturaCalor; etiqueta: string }[] = [
  { valor: "columna", etiqueta: "% por columna" },
  { valor: "fila", etiqueta: "% por fila" },
  { valor: "n", etiqueta: "n" },
];

/** Selector de lectura de la tabla (kit: GlidingRadioGroup). */
export function LecturaCalorSelector({ valor, onCambio }: { valor: LecturaCalor; onCambio: (l: LecturaCalor) => void }) {
  return (
    <GlidingRadioGroup
      value={valor}
      options={LECTURAS_CALOR}
      getOptionValue={(o) => o.valor}
      onValueChange={onCambio}
      className="vx-seg"
      aria-label="Cómo leer la tabla"
    >
      {(o) => <span>{o.etiqueta}</span>}
    </GlidingRadioGroup>
  );
}

const ANCHO_ROTULO = 230;
const ANCHO_CELDA = 80;

function Celda({ c, total = false, columna, fila }: { c: CeldaCalor; total?: boolean; columna: string; fila: string }) {
  const oscura = !total && c.peso > 0.58;
  const clase = [
    "vx-calor-celda",
    total ? "is-total" : null,
    oscura ? "is-oscura" : null,
    c.marca ? `is-${c.marca}` : null,
  ].filter(Boolean).join(" ");
  const sentido =
    c.dif === null || c.marca === null
      ? ""
      : ` · ${Math.abs(c.dif).toFixed(1)} puntos ${c.marca === "arriba" ? "por encima" : "por debajo"} del total`;
  return (
    <div
      role="cell"
      className={clase}
      title={`${fila} × ${columna}: ${c.texto} (n = ${fmtN(c.n)})${sentido}`}
      style={total ? undefined : estiloConVariables({ "--vx-peso": `${Math.round(8 + 82 * c.peso)}%` })}
    >
      {c.texto}
      {c.marca && (
        <i aria-hidden>{c.marca === "arriba" ? "▲" : "▼"}</i>
      )}
      {c.marca && <span className="vx-oculto">{sentido}</span>}
    </div>
  );
}

/**
 * E9 — tabla de calor del cruce categórico. El tono marca el peso de la celda
 * (color-mix sobre el acento del módulo); ▲▼ y contorno, una diferencia de 5
 * puntos o más frente al total. Total aparte. Tabla semántica con roles ARIA
 * sobre una rejilla CSS: el desplazamiento horizontal vive en su propia caja.
 */
export default function TablaCalor({
  modelo,
  rotuloFilas,
}: {
  modelo: ModeloCalor;
  rotuloFilas: string;
}) {
  const nc = modelo.columnas.length;
  const conColTotal = modelo.filas.some((f) => f.total);
  const columnas = `minmax(160px, ${ANCHO_ROTULO}px) repeat(${nc}, minmax(${ANCHO_CELDA - 8}px, 1fr))${conColTotal ? ` minmax(${ANCHO_CELDA - 8}px, 1fr)` : ""}`;
  const estilo = estiloConVariables({
    "--vx-calor-cols": columnas,
    "--vx-calor-min": `${ANCHO_ROTULO + (nc + (conColTotal ? 1 : 0)) * ANCHO_CELDA}px`,
  });
  const totalTexto = `n = ${fmtN(modelo.totalGeneral)}`;
  return (
    <>
    <div className="vx-calor-caja" role="region" tabIndex={0} aria-label="Tabla del cruce (se desplaza a los lados si no cabe)">
      <div className="vx-calor" role="table" aria-label={modelo.titulo} style={estilo}>
        <div className="vx-calor-fila" role="row">
          <div className="vx-calor-cabeza is-rotulo" role="columnheader">
            <span>{rotuloFilas}</span>
          </div>
          {modelo.columnas.map((col, c) => (
            <div key={`${col.etiqueta}-${c}`} className="vx-calor-cabeza" role="columnheader">
              <span>{col.etiqueta}</span>
              <span>n = {fmtN(col.n)}</span>
            </div>
          ))}
          {conColTotal && (
            <div className="vx-calor-cabeza is-col-total" role="columnheader">
              <span>Total</span>
              <span>{totalTexto}</span>
            </div>
          )}
        </div>
        {modelo.filas.map((f, r) => (
          <div key={`${f.etiqueta}-${r}`} className="vx-calor-fila" role="row">
            <div className="vx-calor-rotulo" role="rowheader">
              <span>{f.etiqueta}</span>
              {f.n !== null && <small>n = {fmtN(f.n)}</small>}
            </div>
            {f.celdas.map((c, i) => (
              <Celda key={i} c={c} columna={modelo.columnas[i].etiqueta} fila={f.etiqueta} />
            ))}
            {f.total && (
              <div className="is-col-total" role="presentation">
                <Celda c={f.total} total columna="Total" fila={f.etiqueta} />
              </div>
            )}
          </div>
        ))}
        {modelo.filaTotal && (
          <div className="vx-calor-fila is-fila-total" role="row">
            <div className="vx-calor-rotulo" role="rowheader">Total</div>
            {modelo.filaTotal.map((c, i) => (
              <Celda key={i} c={c} total columna={modelo.columnas[i].etiqueta} fila="Total" />
            ))}
            {conColTotal && <div className="is-col-total" role="presentation"><Celda c={modelo.esquina} total columna="Total" fila="Total" /></div>}
          </div>
        )}
      </div>
    </div>
    {modelo.nota && <p className="vx-pie vx-calor-nota">{modelo.nota}</p>}
    </>
  );
}
