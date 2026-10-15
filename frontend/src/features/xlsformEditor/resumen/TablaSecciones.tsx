// Secciones del formulario como tabla: peso en el instrumento, preguntas, obligatorias, con condiciones, minutos y
// tipo predominante. Ordenable por columna; cada fila abre su sección en el Constructor. La tabla es dueña de su
// scroll dentro del panel, con cabecera fija.

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Folder, Repeat } from "../../../vendor/lucide-react";
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

export function TablaSecciones({ filas, kindDe, onAbrir }: {
  filas: readonly FilaSeccion[];
  kindDe: (id: string) => "section" | "repeat" | "root";
  onAbrir: (fila: FilaSeccion) => void;
}) {
  const [orden, setOrden] = useState<Orden>({ columna: "orden", descendente: false });
  const ordenadas = useMemo(() => ordenarSecciones(filas, orden), [filas, orden]);
  const maxPeso = Math.max(0.0001, ...filas.map((f) => f.peso));
  const pesadas = filas.filter((f) => f.pesada).length;
  const cambiar = (c: ColumnaOrden) => setOrden((o) => siguienteOrden(o, c));

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
                {COLUMNAS.map((c) => <Encabezado key={c.columna} {...c} orden={orden} onOrden={cambiar} />)}
                <th scope="col" className="is-tipo">Tipo predominante</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((f) => {
                const Icono = kindDe(f.id) === "repeat" ? Repeat : Folder;
                return (
                  <tr key={f.id} className={f.pesada ? "is-pesada" : undefined} onClick={() => onAbrir(f)}>
                    <th scope="row" className="is-seccion">
                      <button type="button" className="pulso-xf-res-seccion" onClick={(e) => { e.stopPropagation(); onAbrir(f); }}
                        aria-label={`Abrir ${f.rotulo} en el Constructor`} disabled={!f.name}>
                        <Icono size={14} aria-hidden="true" />
                        <span className="pulso-xf-res-seccion-texto">
                          <span title={f.rotulo}>{f.rotulo}</span>
                          <small>{f.tipoPredominante ?? "Sin preguntas"}</small>
                        </span>
                        {f.pesada && <span className="pulso-xf-res-pesada">Pesada</span>}
                      </button>
                    </th>
                    <td className="is-peso">
                      <span className="pulso-xf-res-peso" aria-hidden="true">
                        <i style={{ width: `${Math.max(2, (f.peso / maxPeso) * 100)}%` }} />
                      </span>
                      <span className="pulso-xf-res-peso-pct">{Math.round(f.peso * 100)} %</span>
                    </td>
                    <td className="is-num">{f.preguntas}</td>
                    <td className="is-num">{f.obligatorias}</td>
                    <td className="is-num">{f.conCondiciones}</td>
                    <td className="is-num">{minutos(f.segundos)}</td>
                    <td className="is-tipo" title={f.tipoPredominante ?? ""}>{f.tipoPredominante ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="pulso-xf-res-criterio">
        Duración: {CRITERIO_DURACION} Pesada: {Math.round(UMBRAL_SECCION_PESADA * 100)} % o más de las preguntas.
      </p>
    </section>
  );
}
