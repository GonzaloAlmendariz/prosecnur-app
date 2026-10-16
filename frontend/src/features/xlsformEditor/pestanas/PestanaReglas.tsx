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
  pie?: ReactNode;
  children: ReactNode;
};

export function PestanaReglas({ titulo, total, grupos, seleccionada, onSeleccionar, vacio, pie, children }: PestanaReglasProps) {
  const hayItems = grupos.some((g) => g.items.length > 0);
  return (
    <div className="xfp-reglas">
      <aside className="xfp-reglas__lista" aria-label={titulo}>
        <header className="xfp-reglas__lista-head">
          <span className="xfp-reglas__lista-titulo">{titulo}</span>
          <span className="xfp-reglas__lista-total">{total}</span>
        </header>
        <div className="xfp-reglas__lista-cuerpo">
          {hayItems
            ? grupos.map((g) =>
                g.items.length ? (
                  <section key={g.titulo} className="xfp-grupo">
                    <header className="xfp-grupo__head">
                      <span>{g.titulo}</span>
                      <span className="xfp-grupo__k">{g.items.length}</span>
                    </header>
                    {g.items.map((it) => (
                      <button
                        key={it.key}
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
        {pie ? <footer className="xfp-reglas__lista-pie">{pie}</footer> : null}
      </aside>
      <main className="xfp-reglas__detalle">{children}</main>
    </div>
  );
}
