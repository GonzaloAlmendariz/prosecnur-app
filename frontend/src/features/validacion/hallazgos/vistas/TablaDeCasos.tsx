/**
 * Los casos del hallazgo (prototipo `selHall` y `pp-v-casos`, `vistas.js:162`):
 * "3 marcados de 7", "Marcar los 7", "Buscar un caso" y la tabla con la marca
 * de cada fila, el caso (el N.º de encuesta si el estudio lo declaró, que abre
 * el caso completo), las columnas de contexto, las preguntas que deciden la
 * regla y, al final, la que falla.
 *
 * Cada cosa se dice una vez (`compactarTabla`, ítem 37): el motivo común de lo
 * que falla va bajo su encabezado y una columna igual en todos los casos sale
 * de la tabla y se dice encima. La fila lleva solo lo que cambia, sin pastilla
 * de color: el estado del caso lo dice la marca.
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
  compactarTabla,
  disposicionDeTabla,
  esFrase,
  rotuloDeRespuestas,
  tituloDeRespuesta,
  valorCorto,
  type CeldaDeCaso,
  type ColumnaDeTabla,
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
  const tabla = useMemo(() => compactarTabla(columnas, filas), [columnas, filas]);
  const disposicion = useMemo(() => disposicionDeTabla(tabla.columnas), [tabla.columnas]);
  const detalleDe = (c: ColumnaDeCaso) => tabla.columnas.find((x) => x.clave === c.clave)?.detalle ?? null;
  const columnaNeutra = (clave: string) => columnas.some((c) => c.clave === clave && c.neutra);
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
            {todos ? (marcablesN === 1 ? "Quitar la marca" : "Quitar las marcas") : marcablesN === 1 ? "Marcar el caso" : `Marcar los ${formatoConteo(marcablesN)}`}
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
      {tabla.comunes.length > 0 ? (
        <div className="pulso-hz-comunes">
          <span className="pulso-hz-comunes-titulo">Común a los {formatoConteo(filas.length)} casos</span>
          <dl>
            {tabla.comunes.map((c) => (
              <div key={c.clave}>
                <dt>{c.rotulo}</dt>
                <dd data-falla={c.falla && !columnaNeutra(c.clave) ? tono : undefined}><Celda celda={c.celda} /></dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
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
          <span role="columnheader">{tabla.columnaDelCaso?.rotulo ?? "Caso"}</span>
          {disposicion.columnas.map((c) => (
            <Encabezado key={c.clave} columna={c} detalle={detalleDe(c)} tono={tono} />
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
          const celdas = tabla.celdas.get(f.clave) ?? {};
          const numero = tabla.columnaDelCaso ? f.valores[tabla.columnaDelCaso.clave] : undefined;
          const nombre = f.id ? (numero && numero !== "Sin dato" ? numero : rotuloDeCaso(f.id).texto) : null;
          return (
            <div key={f.clave} className="pulso-hz-tabla-fila" role="row" data-marcada={marcado ? "" : undefined}>
              <span role="cell">
                <button
                  type="button"
                  className="pulso-hz-marca"
                  aria-pressed={marcado}
                  aria-label={nombre ? `Marcar el caso ${nombre}` : "Caso sin identificador"}
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
                    {nombre}
                  </button>
                ) : (
                  <span className="pulso-hz-sin-id">Sin identificador</span>
                )}
              </span>
              {disposicion.columnas.map((c) => (
                <span key={c.clave} role="cell" data-tipo={c.tipo} data-frase={esFrase(c) ? "" : undefined}>
                  <Celda celda={celdas[c.clave]} falla={c.tipo === "falla" && !c.neutra} />
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

function Encabezado({ columna, detalle, tono }: { columna: ColumnaDeTabla | ColumnaDeCaso; detalle: string | null; tono: "inconsistencia" | "revisar" }) {
  return (
    <span
      role="columnheader"
      data-tipo={columna.tipo}
      data-frase={esFrase(columna) ? "" : undefined}
      data-falla={columna.tipo === "falla" && !columna.neutra ? tono : undefined}
      title={detalle ? `${columna.rotulo}. ${detalle}` : columna.rotulo}
    >
      <span className="pulso-hz-cabecera-rotulo">{columna.rotulo}</span>
      {detalle ? <span className="pulso-hz-cabecera-detalle">{detalle}</span> : null}
    </span>
  );
}

/** Una celda: el valor y, en gris en la misma línea, el original registrado y lo que cambia por fila. */
function Celda({ celda, falla = false }: { celda: CeldaDeCaso | undefined; falla?: boolean }) {
  if (!celda) return null;
  return (
    <span className="pulso-hz-celda" title={celda.titulo ?? (celda.fueraDeLista ? `${celda.valor}: no está entre las opciones de la pregunta` : undefined)}>
      <span className="pulso-hz-celda-valor" data-falla={falla ? "" : undefined}>{celda.valor}</span>
      {celda.fueraDeLista ? <span className="pulso-hz-fuera-de-lista">Fuera de la lista</span> : null}
      {celda.original ? <span className="pulso-hz-celda-gris">{celda.original}</span> : null}
      {celda.nota ? <span className="pulso-hz-celda-gris">{celda.nota}</span> : null}
    </span>
  );
}
