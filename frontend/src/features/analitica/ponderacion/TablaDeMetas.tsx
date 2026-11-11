// Tabla de metas: una cabecera y un grupo por variable. Es una rejilla con roles
// de tabla y no un `<table>` porque sus celdas son campos y barras, y las
// columnas se reparten el ancho del panel en vez de medir un ancho fijo.

import type { ReactNode } from "react";

import { GrupoDeMetas, type GrupoDeMetasProps } from "./GrupoDeMetas";

export type GrupoDeLaTabla = Omit<GrupoDeMetasProps, "modo">;

export function TablaDeMetas({ modo, nombre, grupos, vacio, recalculando = false }: {
  modo: "ajuste" | "estrato";
  /** Nombre accesible de la tabla. */
  nombre: string;
  grupos: readonly GrupoDeLaTabla[];
  /** Lo que ocupa el cuerpo sin grupos: la tabla contiene su propio vacío (C3). */
  vacio?: ReactNode;
  /** Hay un cálculo en curso: muestra y ponderado son del resultado anterior y se atenúan. */
  recalculando?: boolean;
}) {
  return (
    <div
      className="pond-metas"
      role="table"
      aria-label={nombre}
      aria-busy={recalculando || undefined}
      data-modo={modo}
      data-recalculando={recalculando ? "" : undefined}
    >
      <div role="rowgroup">
        <div className="pond-metas-cabecera" role="row">
          <span role="columnheader">Categoría</span>
          {modo === "ajuste" ? (
            <>
              {/* La leyenda de las barras es la cabecera de su columna. */}
              <span className="pond-leyenda" role="columnheader" aria-label="Distribución de la muestra y de la meta">
                <span><i className="pond-barra is-muestra" aria-hidden="true" />Muestra</span>
                <span><i className="pond-barra is-meta" aria-hidden="true" />Meta</span>
              </span>
              <span className="pond-metas-cifra" role="columnheader">Muestra %</span>
              <span className="pond-metas-cifra" role="columnheader">Meta</span>
              <span className="pond-metas-cifra" role="columnheader">Ponderado %</span>
            </>
          ) : (
            <span className="pond-metas-cifra" role="columnheader">Población</span>
          )}
        </div>
      </div>
      {grupos.length === 0 && vacio ? <div className="pond-metas-vacio">{vacio}</div> : null}
      {/* C1: cada variable mide lo que sus categorías; no son marcos pares. */}
      {grupos.length > 0 ? (
        <div className="pond-metas-grupos" data-qa-geometry-group="analitica/ponderacion-variables" data-qa-geometry-contract="intrinsic">
          {grupos.map((g) => <GrupoDeMetas key={g.variable} modo={modo} {...g} />)}
        </div>
      ) : null}
    </div>
  );
}
