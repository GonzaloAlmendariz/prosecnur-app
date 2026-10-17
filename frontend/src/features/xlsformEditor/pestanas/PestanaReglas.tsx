import type { ReactNode } from "react";
import { TypeIcon } from "../kit";
import "./pestanas.css";

// Marco común de las pestañas de reglas (Restricciones, Cálculos): lista agrupada a la
// izquierda y el detalle de la elegida a la derecha, todo en contenedores. La selección vive
// en `?foco=` (nombre de la variable): enlazable y sin salir de la pestaña.

export type ReglaListaItem = {
  key: string;
  baseType: string;
  numero: string;
  titulo: string;
  resumen: string;
  aviso?: boolean;
};

export type ReglaListaGrupo = { titulo: string; items: ReglaListaItem[] };

export type PestanaReglasProps = {
  titulo: string;
  total: string;
  grupos: ReglaListaGrupo[];
  seleccionada: string | null;
  onSeleccionar: (key: string) => void;
  vacio: ReactNode;
  /** Lo que ocupa el detalle cuando la lista está vacía: el vacío se explica, no se deja en blanco. */
  vacioDetalle: ReactNode;
  pie?: ReactNode;
  /** Columna derecha opcional (p. ej. el catálogo de funciones de Cálculos). */
  lateral?: ReactNode;
  children: ReactNode;
};

export function PestanaReglas({ titulo, total, grupos, seleccionada, onSeleccionar, vacio, vacioDetalle, pie, lateral, children }: PestanaReglasProps) {
  const hayItems = grupos.some((g) => g.items.length > 0);
  return (
    <div className={lateral ? "xfp-reglas con-lateral" : "xfp-reglas"}>
      <aside className="xfp-reglas__lista" aria-label={titulo}>
        <header className="xfp-reglas__lista-head">
          <span className="xfp-reglas__lista-titulo">{titulo}</span>
          <span className="xfp-reglas__lista-total">{total}</span>
        </header>
        <div className="xfp-reglas__lista-cuerpo" data-qa-geometry-group="xlsform/reglas-grupos" data-qa-geometry-contract="intrinsic">
          {hayItems
            ? grupos.map((g) =>
                g.items.length ? (
                  <section key={g.titulo} className="xfp-grupo">
                    <header className="xfp-grupo__head">
                      <span>{g.titulo}</span>
                      <span className="xfp-grupo__k">{g.items.length}</span>
                    </header>
                    {g.items.map((it, i) => (
                      <button
                        // Clave por posición: los formularios reales repiten nombres de variable (t4_P10 dos veces en el tipo 2).
                        key={`${it.key}-${i}`}
                        type="button"
                        className={it.key === seleccionada ? "xfp-item is-on" : "xfp-item"}
                        aria-current={it.key === seleccionada ? "true" : undefined}
                        onClick={() => onSeleccionar(it.key)}
                      >
                        <TypeIcon baseType={it.baseType} size={13} />
                        <span className="xfp-item__num">{it.numero}</span>
                        <span className="xfp-item__txt">
                          <span className="xfp-item__titulo">{it.titulo}</span>
                          <span className={it.aviso ? "xfp-item__resumen is-aviso" : "xfp-item__resumen"}>{it.resumen}</span>
                        </span>
                      </button>
                    ))}
                  </section>
                ) : null,
              )
            : <div className="xfp-reglas__vacio">{vacio}</div>}
        </div>
        {pie && hayItems ? <footer className="xfp-reglas__lista-pie">{pie}</footer> : null}
      </aside>
      <main className="xfp-reglas__detalle" data-qa-geometry-group="xlsform/reglas-detalle" data-qa-geometry-contract="intrinsic">{hayItems ? children : vacioDetalle}</main>
      {lateral ? <div className="xfp-reglas__lateral">{lateral}</div> : null}
    </div>
  );
}
