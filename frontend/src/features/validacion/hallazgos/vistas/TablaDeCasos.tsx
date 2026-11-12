/**
 * Los casos del hallazgo (prototipo `selHall` y `pp-v-casos`, `vistas.js:162`):
 * "3 marcados de 7", "Marcar los 7", "Buscar un caso" y la tabla con la marca
 * de cada fila, el caso (que abre el caso completo), las columnas de contexto
 * que el estudio declaró, las preguntas que deciden la regla y, al final, la
 * que falla, resaltada.
 *
 * Es una rejilla con roles de tabla: ancho completo, sin scroll propio (el
 * dueño del scroll es el cuerpo del contenedor). Marcar una fila es un botón
 * con `aria-pressed`, no una casilla (K1 del kit). Una fila sin identificador
 * en la auditoría no se puede marcar ni abrir.
 */
import { useMemo, useState, type CSSProperties } from "react";
import { Search } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { ColumnaDeCaso, FilaDeCaso } from "../modeloHallazgos";
import { rotuloDeCaso } from "../../rotuloDeCaso";

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
  const plantilla = {
    "--pulso-hz-columnas": `44px minmax(96px, 0.8fr) ${columnas.map((c) => (c.tipo === "falla" ? "minmax(96px, 0.9fr)" : "minmax(0, 1.2fr)")).join(" ")}`,
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
        className="pulso-hz-tabla"
        role="table"
        aria-label="Casos del hallazgo"
        aria-rowcount={visibles.length + 1}
        style={plantilla}
        data-qa-geometry-group="validacion/hallazgos-casos"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="pulso-hz-tabla-fila pulso-hz-tabla-cabecera" role="row">
          <span role="columnheader"><span className="pulso-sr-only">Marca</span></span>
          <span role="columnheader">Caso</span>
          {columnas.map((c) => (
            <span key={c.clave} role="columnheader" data-tipo={c.tipo} title={c.rotulo}>{c.rotulo}</span>
          ))}
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
              {columnas.map((c) => (
                <span key={c.clave} role="cell" data-tipo={c.tipo}>
                  {c.tipo === "falla" ? (
                    <b className="pulso-hz-falla" data-tono={tono} title={f.esperado?.hecho ?? undefined}>{f.valores[c.clave]}</b>
                  ) : (
                    f.valores[c.clave]
                  )}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
