// Secciones del formulario como tabla: peso en el instrumento, preguntas, obligatorias, con condiciones, minutos y
// tipo predominante. Ordenable por columna. El clic en una fila la despliega ahí mismo con sus preguntas (una a la
// vez; la abierta es el `foco` de la dirección) y cada pregunta lleva un «Editar» discreto, la única salida al
// Constructor (ítem 50). Un tramo del «Recorrido en el tiempo» resalta su fila y la trae a la vista. La tabla es
// dueña de su scroll dentro del panel, con cabecera fija.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Folder, Repeat } from "../../../vendor/lucide-react";
import { tituloTecnico } from "../cuestionario/modeloCuestionario";
import { EditarEnConstructor } from "../shell/EditarEnConstructor";
import { claveSeccion, type PreguntaDeSeccion } from "./preguntasDeSeccion";
import {
  CRITERIO_DURACION,
  UMBRAL_SECCION_PESADA,
  minutos,
  ordenarSecciones,
  siguienteOrden,
  type ColumnaOrden,
  type FilaSeccion,
  type Orden,
} from "./modeloResumen";

const COLUMNAS: readonly { columna: ColumnaOrden; rotulo: string; clase: string }[] = [
  { columna: "preguntas", rotulo: "Preguntas", clase: "is-num" },
  { columna: "obligatorias", rotulo: "Obligatorias", clase: "is-num" },
  { columna: "conCondiciones", rotulo: "Con condición", clase: "is-num" },
  { columna: "segundos", rotulo: "Minutos", clase: "is-num" },
];

function Encabezado({ columna, rotulo, clase, orden, onOrden }: {
  columna: ColumnaOrden; rotulo: string; clase?: string; orden: Orden; onOrden: (c: ColumnaOrden) => void;
}) {
  const activa = orden.columna === columna;
  const Icono = !activa ? ArrowUpDown : orden.descendente ? ArrowDown : ArrowUp;
  return (
    <th scope="col" className={clase} aria-sort={activa ? (orden.descendente ? "descending" : "ascending") : "none"}>
      <button type="button" className={`pulso-xf-res-orden${activa ? " is-activa" : ""}`} onClick={() => onOrden(columna)}>
        {rotulo}
        <Icono size={12} aria-hidden="true" />
      </button>
    </th>
  );
}

function minutosDePregunta(segundos: number): string {
  return `${(segundos / 60).toLocaleString("es-PE", { maximumFractionDigits: 1 })} min`;
}

function PreguntasDesplegadas({ preguntas, onEditar }: {
  preguntas: readonly PreguntaDeSeccion[];
  onEditar: (name: string) => void;
}) {
  if (preguntas.length === 0) {
    return <p className="pulso-xf-ficha-nota">Esta sección no tiene preguntas propias: sólo notas, cálculos o subsecciones.</p>;
  }
  return (
    <ol className="pulso-xf-res-preguntas">
      {preguntas.map((p) => (
        <li key={p.rowIndex}>
          <span className="pulso-xf-res-preg-num">P{p.numero}</span>
          <span className="pulso-xf-res-preg-texto" title={p.enunciado}>{p.enunciado}</span>
          <span className="pulso-xf-res-preg-tipo">{p.tipo}</span>
          <span className="pulso-xf-res-preg-min">{minutosDePregunta(p.segundos)}</span>
          <EditarEnConstructor discreto que={`la pregunta ${p.numero}`} onEditar={() => onEditar(p.name)} />
        </li>
      ))}
    </ol>
  );
}

export function TablaSecciones({ filas, kindDe, abierta, onAlternar, resaltada, preguntasDe, onEditarPregunta }: {
  filas: readonly FilaSeccion[];
  kindDe: (id: string) => "section" | "repeat" | "root";
  /** Clave (`claveSeccion`) de la fila desplegada, o null. */
  abierta: string | null;
  onAlternar: (clave: string) => void;
  /** Clave de la fila que pidió un tramo del recorrido: se resalta y se trae a la vista. */
  resaltada: string | null;
  preguntasDe: (seccionId: string) => PreguntaDeSeccion[];
  onEditarPregunta: (name: string) => void;
}) {
  const [orden, setOrden] = useState<Orden>({ columna: "orden", descendente: false });
  const filasRef = useRef(new Map<string, HTMLTableRowElement>());
  useEffect(() => {
    const el = resaltada ? filasRef.current.get(resaltada) : null;
    if (!el) return;
    const quieto = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: quieto ? "auto" : "smooth" });
  }, [resaltada]);
  const ordenadas = useMemo(() => ordenarSecciones(filas, orden), [filas, orden]);
  const maxPeso = Math.max(0.0001, ...filas.map((f) => f.peso));
  const pesadas = filas.filter((f) => f.pesada).length;
  const cambiar = (c: ColumnaOrden) => setOrden((o) => siguienteOrden(o, c));
  // Una columna toda en cero es ruido: se oculta y se dice en una línea.
  const sinCondiciones = filas.every((f) => f.conCondiciones === 0);
  const columnas = sinCondiciones ? COLUMNAS.filter((c) => c.columna !== "conCondiciones") : COLUMNAS;
  const totalColumnas = columnas.length + 3;

  return (
    <section className="pulso-xf-res-panel pulso-xf-res-secciones" aria-labelledby="xf-res-secciones-titulo" data-qa-geometry-member="">
      <header className="pulso-xf-res-panel-cabeza">
        <h3 id="xf-res-secciones-titulo">Secciones</h3>
        <span className="pulso-xf-res-panel-nota">
          {filas.length} {filas.length === 1 ? "sección" : "secciones"}
          {pesadas ? ` · ${pesadas} ${pesadas === 1 ? "pesada" : "pesadas"}` : ""}
        </span>
      </header>
      {filas.length === 0 ? (
        <p className="pulso-xf-res-vacio">El formulario no tiene secciones: todas sus preguntas van en un solo bloque.</p>
      ) : (
        <div className="pulso-xf-res-tabla-marco" data-qa-scroll-owner="resumen-secciones" tabIndex={0} aria-label="Tabla de secciones">
          <table className="pulso-xf-res-tabla">
            <thead>
              <tr>
                <Encabezado columna="orden" rotulo="Sección" clase="is-seccion" orden={orden} onOrden={cambiar} />
                <th scope="col" className="is-peso">Peso</th>
                {columnas.map((c) => <Encabezado key={c.columna} {...c} orden={orden} onOrden={cambiar} />)}
                <th scope="col" className="is-tipo">Tipo predominante</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((f) => {
                const Icono = kindDe(f.id) === "repeat" ? Repeat : Folder;
                const clave = claveSeccion(f);
                const desplegada = abierta === clave;
                const idDetalle = `xf-res-seccion-${clave.replace(/[^A-Za-z0-9_-]/g, "_")}`;
                const clases = [f.pesada && "is-pesada", desplegada && "is-desplegada", resaltada === clave && "is-resaltada"]
                  .filter(Boolean).join(" ");
                return (
                  <Fragment key={f.id}>
                  <tr className={clases || undefined} onClick={() => onAlternar(clave)}
                    ref={(el) => { if (el) filasRef.current.set(clave, el); else filasRef.current.delete(clave); }}>
                    <th scope="row" className="is-seccion">
                      <button type="button" className="pulso-xf-res-seccion" onClick={(e) => { e.stopPropagation(); onAlternar(clave); }}
                        aria-expanded={desplegada} aria-controls={desplegada ? idDetalle : undefined}>
                        <ChevronRight size={13} aria-hidden="true" className="pulso-xf-res-seccion-chevron" />
                        <Icono size={14} aria-hidden="true" />
                        <span className="pulso-xf-res-seccion-texto">
                          <span title={f.rotulo} className={tituloTecnico(f.rotulo, f.name) ? "is-tecnico" : undefined}>{f.rotulo}</span>
                          <small>{f.tipoPredominante ?? "Sin preguntas"}</small>
                        </span>
                        {f.pesada && <span className="pulso-xf-res-pesada">Pesada</span>}
                      </button>
                    </th>
                    <td className="is-peso" title={`${Math.round(f.peso * 100)} % de las preguntas`}>
                      <span className="pulso-xf-res-peso" aria-hidden="true">
                        <i style={{ width: `${Math.max(2, (f.peso / maxPeso) * 100)}%` }} />
                      </span>
                      <span className="pulso-xf-res-peso-pct">{Math.round(f.peso * 100)} %</span>
                    </td>
                    <td className="is-num">{f.preguntas}</td>
                    <td className="is-num">{f.obligatorias}</td>
                    {!sinCondiciones && <td className="is-num">{f.conCondiciones}</td>}
                    <td className="is-num">{minutos(f.segundos)}</td>
                    <td className="is-tipo" title={f.tipoPredominante ?? ""}>{f.tipoPredominante ?? "—"}</td>
                  </tr>
                  {desplegada && (
                    <tr className="pulso-xf-res-desplegada">
                      <td colSpan={totalColumnas}>
                        <div id={idDetalle} className="pulso-xf-ficha pulso-xf-res-ficha" role="region" aria-labelledby={`${idDetalle}-titulo`}>
                          <h4 id={`${idDetalle}-titulo`} className="pulso-xf-ficha-titulo">Preguntas de {f.rotulo}</h4>
                          <PreguntasDesplegadas preguntas={preguntasDe(f.id)} onEditar={onEditarPregunta} />
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="pulso-xf-res-criterio">
        {sinCondiciones && filas.length > 0 ? "Ninguna sección tiene condiciones todavía. " : ""}
        Duración: {CRITERIO_DURACION} Pesada: {Math.round(UMBRAL_SECCION_PESADA * 100)} % o más de las preguntas.
      </p>
    </section>
  );
}
