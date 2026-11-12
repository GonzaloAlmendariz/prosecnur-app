/**
 * Los casos del hallazgo (prototipo `selHall` y `pp-v-casos`, `vistas.js:162`):
 * "3 marcados de 7", "Marcar los 7", "Buscar un caso" y la tabla con la marca
 * de cada fila, el caso (que abre el caso completo), las columnas de contexto
 * que el estudio declaró, las preguntas que deciden la regla y, al final, la
 * que falla, resaltada.
 *
 * Es una rejilla con roles de tabla a ancho completo. El scroll vertical es
 * del cuerpo del contenedor; cada columna tiene un ancho mínimo legible y, si
 * no caben, la tabla se desplaza en horizontal con la marca y el caso fijos
 * (`modeloTablaDeCasos`). Con muchas preguntas (una batería) las respuestas
 * van en una fila dentro del caso, en código corto con su etiqueta en el
 * título. Marcar una fila es un botón con `aria-pressed`, no una casilla (K1
 * del kit). Una fila sin identificador en la auditoría no se puede marcar ni
 * abrir.
 */
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Search } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { ColumnaDeCaso, FilaDeCaso } from "../modeloHallazgos";
import { rotuloDeCaso } from "../../rotuloDeCaso";
import {
  CLAVE_LECTURA_DE_FECHAS,
  disposicionDeTabla,
  esFrase,
  lecturaEnUnaLinea,
  rotuloDeRespuestas,
  tituloDeRespuesta,
  valorCorto,
} from "./modeloTablaDeCasos";
import { useDesbordeHorizontal } from "./useDesbordeHorizontal";

export function TablaDeCasos({
  columnas,
  filas,
  marcados,
  onMarcar,
  onMarcarTodos,
  onAbrirCaso,
  tono,
  marcable,
}: {
  columnas: readonly ColumnaDeCaso[];
  filas: readonly FilaDeCaso[];
  marcados: ReadonlySet<string>;
  onMarcar: (id: string) => void;
  /** `true` marca todos los que se pueden marcar; `false` quita las marcas. */
  onMarcarTodos: (marcar: boolean) => void;
  onAbrirCaso: (id: string) => void;
  /** El tono del valor que falla: rojo en una inconsistencia, ámbar en un caso a revisar. */
  tono: "inconsistencia" | "revisar";
  /** Con "Dejar como está" la decisión cubre la regla entera: no se marcan casos. */
  marcable: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(
      (f) =>
        (f.id ?? "").toLowerCase().includes(q) ||
        (f.id ? rotuloDeCaso(f.id).texto.toLowerCase().includes(q) : false) ||
        Object.values(f.valores).some((v) => v.toLowerCase().includes(q)),
    );
  }, [busqueda, filas]);
  const marcablesN = filas.filter((f) => f.id !== null).length;
  const nMarcados = filas.filter((f) => f.id !== null && marcados.has(f.id)).length;
  const todos = marcablesN > 0 && nMarcados === marcablesN;
  const disposicion = useMemo(() => disposicionDeTabla(columnas), [columnas]);
  const tablaRef = useRef<HTMLDivElement>(null);
  const desborde = useDesbordeHorizontal(tablaRef);
  const conFila = disposicion.enFila.length > 0;
  const plantilla = {
    "--pulso-hz-columnas": disposicion.plantilla,
    "--pulso-hz-ancho-minimo": disposicion.anchoMinimo,
  } as CSSProperties;

  return (
    <div className="pulso-hz-casos">
      <div className="pulso-hz-seleccion">
        <span>
          <b>{formatoConteo(nMarcados)}</b> {nMarcados === 1 ? "marcado" : "marcados"} de {formatoConteo(filas.length)}
        </span>
        {marcable && marcablesN > 0 ? (
          <PulsoButton variant="link" size="sm" onClick={() => onMarcarTodos(!todos)}>
            {todos ? "Quitar las marcas" : `Marcar los ${formatoConteo(marcablesN)}`}
          </PulsoButton>
        ) : null}
        <span className="pulso-hz-seleccion-hueco" />
        <label className="pulso-hz-busca">
          <Search size={14} aria-hidden="true" />
          <PulsoInput
            size="sm"
            type="search"
            value={busqueda}
            placeholder="Buscar un caso"
            aria-label="Buscar un caso"
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
      </div>
      <div
        className="pulso-hz-tabla pulso-hz-tabla--casos"
        role="table"
        aria-label="Casos del hallazgo"
        aria-rowcount={visibles.length + 1}
        style={plantilla}
        data-qa-geometry-group="validacion/hallazgos-casos"
        data-qa-geometry-contract="intrinsic"
        data-con-respuestas={conFila ? "" : undefined}
        data-desborde={desborde === "ninguno" ? undefined : desborde}
        ref={tablaRef}
        tabIndex={0}
      >
        <div className="pulso-hz-tabla-fila pulso-hz-tabla-cabecera" role="row">
          <span role="columnheader"><span className="pulso-sr-only">Marca</span></span>
          <span role="columnheader">Caso</span>
          {disposicion.columnas.map((c) => (
            <span key={c.clave} role="columnheader" data-tipo={c.tipo} data-frase={esFrase(c) ? "" : undefined} title={c.rotulo}>{c.rotulo}</span>
          ))}
          {conFila ? (
            <span role="columnheader" className="pulso-hz-tabla-respuestas">{rotuloDeRespuestas(disposicion.enFila)}</span>
          ) : null}
        </div>
        {visibles.length === 0 ? (
          <div className="pulso-hz-tabla-fila pulso-hz-tabla-vacia" role="row">
            <span role="cell">Ningún caso coincide con la búsqueda.</span>
          </div>
        ) : visibles.map((f) => {
          const marcado = f.id !== null && marcados.has(f.id);
          return (
            <div key={f.clave} className="pulso-hz-tabla-fila" role="row" data-marcada={marcado ? "" : undefined}>
              <span role="cell">
                <button
                  type="button"
                  className="pulso-hz-marca"
                  aria-pressed={marcado}
                  aria-label={f.id ? `Marcar el caso ${rotuloDeCaso(f.id).texto}` : "Caso sin identificador"}
                  disabled={!marcable || f.id === null}
                  onClick={() => f.id && onMarcar(f.id)}
                />
              </span>
              <span role="cell">
                {f.id ? (
                  <button
                    type="button"
                    className="pulso-hz-casoid"
                    title={rotuloDeCaso(f.id).texto === f.id ? "Ver el caso completo" : `Ver el caso completo. ${rotuloDeCaso(f.id).titulo}`}
                    onClick={() => onAbrirCaso(f.id as string)}
                  >
                    {rotuloDeCaso(f.id).texto}
                  </button>
                ) : (
                  <span className="pulso-hz-sin-id">Sin identificador</span>
                )}
              </span>
              {disposicion.columnas.map((c) => (
                <span key={c.clave} role="cell" data-tipo={c.tipo} data-frase={esFrase(c) ? "" : undefined}>
                  {c.tipo === "falla" ? <Falla columna={c} fila={f} tono={tono} /> : f.valores[c.clave]}
                </span>
              ))}
              {conFila ? (
                <span role="cell" className="pulso-hz-tabla-respuestas">
                  <ul className="pulso-hz-respuestas-fila" aria-label={rotuloDeRespuestas(disposicion.enFila)}>
                    {disposicion.enFila.map((c) => {
                      const valor = f.valores[c.clave];
                      const vacia = valor === "Vacía";
                      return (
                        <li key={c.clave} title={tituloDeRespuesta(c, valor)} data-vacia={vacia ? "" : undefined}>
                          <span className="pulso-sr-only">{vacia ? `${c.clave}: Vacía` : `${c.clave}: `}</span>
                          {vacia ? null : valorCorto(valor).corto}
                        </li>
                      );
                    })}
                  </ul>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * El valor que falla. En una regla de fechas, lo leído en una línea
 * ("08.11.2026 → 08/11/2026") y el motivo debajo; el enunciado entero, en el título.
 */
function Falla({ columna, fila, tono }: { columna: ColumnaDeCaso; fila: FilaDeCaso; tono: "inconsistencia" | "revisar" }) {
  const lectura = columna.clave === CLAVE_LECTURA_DE_FECHAS ? lecturaEnUnaLinea(fila.esperado) : null;
  if (lectura) {
    return (
      <>
        <b className="pulso-hz-falla pulso-hz-falla--linea" data-tono={tono} title={fila.valores[columna.clave]}>{lectura.lectura}</b>
        {lectura.motivo ? <small className="pulso-hz-falla-motivo">{lectura.motivo}</small> : null}
      </>
    );
  }
  return <b className="pulso-hz-falla" data-tono={tono} title={fila.esperado?.hecho ?? undefined}>{fila.valores[columna.clave]}</b>;
}
