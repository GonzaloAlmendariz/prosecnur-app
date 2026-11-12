import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import "./kit-table.css";

// PulsoTable (L28, maqueta m/L28-tabla-inspector): la tabla del kit.
//
// Lo que las tablas a mano resolvían cada una a su manera, y casi siempre mal:
//  - cada columna DECLARA su ancho; la tabla es `table-layout: fixed` y una
//    celda nunca empuja a sus vecinas (el «dato recortado» del censo venía de
//    anchos que dependían del contenido);
//  - una línea por celda, con el texto completo en `title` cuando no cabe;
//  - las cifras a la derecha y en `tabular-nums`;
//  - la cabecera pegada al hacer scroll;
//  - densidad cómoda o compacta;
//  - una fila elegida es la del inspector: la tabla no guarda la selección,
//    la recibe (el consumidor la lleva en `?foco=`, nunca en un useState);
//  - con muchas filas, sólo se pintan las visibles (react-virtual).

export type PulsoTableColumna<T> = {
  id: string;
  encabezado: string;
  /** Ancho en px. Declarado siempre: es lo que impide que una columna se coma a la otra. */
  ancho: number;
  /** `cifra`: a la derecha y en tabular-nums. */
  tipo?: "texto" | "cifra";
  celda: (fila: T) => ReactNode;
  /** Texto de la celda para `title` y para ordenar; sin él la columna no ordena. */
  valor?: (fila: T) => string | number | null;
};

export type PulsoTableDensidad = "comoda" | "compacta";

export type PulsoTableProps<T> = {
  columnas: readonly PulsoTableColumna<T>[];
  filas: readonly T[];
  idDeFila: (fila: T) => string;
  ariaLabel: string;
  densidad?: PulsoTableDensidad;
  /** La fila del inspector, si la hay. */
  seleccionada?: string | null;
  onSeleccionar?: (id: string) => void;
  /** Alto máximo del área con scroll; la cabecera queda pegada arriba. */
  altoMaximo?: number;
  /** Lo que se ve si no hay filas: la tabla contiene su propio vacío (C3). */
  vacio?: ReactNode;
};

/** A partir de cuántas filas se virtualiza: por debajo, pintarlas todas es más simple y igual de rápido. */
export const PULSO_TABLE_UMBRAL_VIRTUAL = 80;

/** Lo mismo que `--pulso-density-row` (app/tipografia.css): la virtualización necesita el número. */
export const PULSO_TABLE_ALTO_FILA: Record<PulsoTableDensidad, number> = { comoda: 36, compacta: 30 };

/** Ancho total declarado: la tabla mide eso y no se estira a costa de una columna. */
export function anchoDeclarado<T>(columnas: readonly PulsoTableColumna<T>[]): number {
  return columnas.reduce((total, columna) => total + columna.ancho, 0);
}

export function PulsoTable<T>({
  columnas,
  filas,
  idDeFila,
  ariaLabel,
  densidad = "comoda",
  seleccionada = null,
  onSeleccionar,
  altoMaximo = 520,
  vacio = "Sin filas para mostrar.",
}: PulsoTableProps<T>) {
  const [orden, setOrden] = useState<SortingState>([]);
  const definiciones = useMemo<ColumnDef<T>[]>(
    () =>
      columnas.map((columna) => ({
        id: columna.id,
        header: columna.encabezado,
        size: columna.ancho,
        enableSorting: Boolean(columna.valor),
        accessorFn: columna.valor ? (fila: T) => columna.valor?.(fila) ?? "" : undefined,
        cell: (contexto) => columna.celda(contexto.row.original),
      })),
    [columnas],
  );
  const tabla = useReactTable({
    data: filas as T[],
    columns: definiciones,
    state: { sorting: orden },
    onSortingChange: setOrden,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (fila) => idDeFila(fila),
  });
  const filasVisibles = tabla.getRowModel().rows;
  const contenedor = useRef<HTMLDivElement>(null);
  const virtualiza = filasVisibles.length > PULSO_TABLE_UMBRAL_VIRTUAL;
  const altoFila = PULSO_TABLE_ALTO_FILA[densidad];
  const virtualizador = useVirtualizer({
    count: virtualiza ? filasVisibles.length : 0,
    getScrollElement: () => contenedor.current,
    estimateSize: () => altoFila,
    overscan: 8,
  });
  const items = virtualiza ? virtualizador.getVirtualItems() : [];
  const relleno = virtualiza && items.length
    ? { arriba: items[0].start, abajo: virtualizador.getTotalSize() - items[items.length - 1].end }
    : { arriba: 0, abajo: 0 };
  const pintadas = virtualiza ? items.map((item) => filasVisibles[item.index]) : filasVisibles;
  const porId = new Map(columnas.map((columna) => [columna.id, columna]));

  return (
    <div
      ref={contenedor}
      className="pulso-table-scroll"
      data-density={densidad}
      style={{ maxHeight: altoMaximo }}
    >
      <table className="pulso-table" aria-label={ariaLabel} aria-rowcount={filasVisibles.length + 1} style={{ width: anchoDeclarado(columnas) }}>
        <colgroup>
          {columnas.map((columna) => <col key={columna.id} style={{ width: columna.ancho }} />)}
        </colgroup>
        <thead>
          {tabla.getHeaderGroups().map((grupo) => (
            <tr key={grupo.id}>
              {grupo.headers.map((cabecera) => {
                const columna = porId.get(cabecera.column.id);
                const sentido = cabecera.column.getIsSorted();
                const ordena = cabecera.column.getCanSort();
                return (
                  <th
                    key={cabecera.id}
                    scope="col"
                    data-tipo={columna?.tipo ?? "texto"}
                    aria-sort={sentido === "asc" ? "ascending" : sentido === "desc" ? "descending" : undefined}
                  >
                    {ordena ? (
                      <button type="button" className="pulso-table-orden" onClick={cabecera.column.getToggleSortingHandler()}>
                        {flexRender(cabecera.column.columnDef.header, cabecera.getContext())}
                        <span aria-hidden="true">{sentido === "asc" ? "↑" : sentido === "desc" ? "↓" : ""}</span>
                      </button>
                    ) : (
                      flexRender(cabecera.column.columnDef.header, cabecera.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {filasVisibles.length === 0 ? (
            <tr>
              <td className="pulso-table-vacio" colSpan={columnas.length}>{vacio}</td>
            </tr>
          ) : null}
          {relleno.arriba > 0 && <tr aria-hidden="true" style={{ height: relleno.arriba }} />}
          {pintadas.map((fila) => {
            const elegida = fila.id === seleccionada;
            return (
              <tr
                key={fila.id}
                data-selected={elegida ? "true" : undefined}
                aria-selected={onSeleccionar ? elegida : undefined}
                tabIndex={onSeleccionar ? 0 : undefined}
                onClick={onSeleccionar ? () => onSeleccionar(fila.id) : undefined}
                onKeyDown={onSeleccionar ? (evento) => {
                  // Sólo la fila misma: una celda puede llevar un input o un
                  // interruptor, y su Espacio o su Enter son del control.
                  if (evento.target !== evento.currentTarget) return;
                  if (evento.key === "Enter" || evento.key === " ") {
                    evento.preventDefault();
                    onSeleccionar(fila.id);
                  }
                } : undefined}
              >
                {fila.getVisibleCells().map((celda) => {
                  const columna = porId.get(celda.column.id);
                  const valor = columna?.valor?.(fila.original);
                  return (
                    <td key={celda.id} data-tipo={columna?.tipo ?? "texto"} title={valor == null ? undefined : String(valor)}>
                      {/* La celda se pinta llamando a `celda` y no con flexRender: flexRender monta la función de la
                          definición como componente, y como las definiciones se rehacen cuando cambian las columnas
                          (un arreglo nuevo en cada render del dueño), React veía otro componente y volvía a montar la
                          celda. Un campo editable perdía el foco con cada tecla (Cálculo de muestra, 2026-11-12). */}
                      {columna ? columna.celda(fila.original) : flexRender(celda.column.columnDef.cell, celda.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {relleno.abajo > 0 && <tr aria-hidden="true" style={{ height: relleno.abajo }} />}
        </tbody>
      </table>
    </div>
  );
}
