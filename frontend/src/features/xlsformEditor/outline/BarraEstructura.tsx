// Barra de la Estructura (C21, 2026-10-17): buscar por texto o código, un filtro rápido por marca y plegar o
// desplegar todas las secciones. Con un criterio activo muestra «N de M» y cómo volver a ver todo.

import { useId, type ReactNode } from "react";
import { ChevronsDownUp, ChevronsUpDown, Search, X } from "../../../vendor/lucide-react";
import { FILTROS_RAPIDOS, type FiltroRapido } from "./modeloEstructura";

export type BarraEstructuraProps = {
  consulta: string;
  filtro: FiltroRapido;
  conteos: Readonly<Record<FiltroRapido, number>>;
  activo: boolean;
  coinciden: number;
  total: number;
  /** Hay un filtro rápido: el estado dice «N con aviso» (líneas marcadas) en vez de «N de M». */
  porMarca?: boolean;
  hayPlegadas: boolean;
  haySecciones: boolean;
  onConsulta: (v: string) => void;
  onFiltro: (f: FiltroRapido) => void;
  onLimpiar: () => void;
  onPlegarTodo: () => void;
  onDesplegarTodo: () => void;
  /** Flecha abajo desde el buscador: pasa a la primera línea de la lista. */
  onIrALista: () => void;
  /** Acción extra al final de la fila (la página pone «Añadir pieza» para pantallas bajas, donde su cabecera se
   * esconde). */
  accion?: ReactNode;
};

export function BarraEstructura({
  consulta,
  filtro,
  conteos,
  activo,
  coinciden,
  total,
  porMarca = false,
  hayPlegadas,
  haySecciones,
  onConsulta,
  onFiltro,
  onLimpiar,
  onPlegarTodo,
  onDesplegarTodo,
  onIrALista,
  accion,
}: BarraEstructuraProps) {
  const idEstado = useId();
  const plegar = !hayPlegadas;
  return (
    <div className="xfe-barra" role="search" aria-label="Buscar en la estructura">
      <div className="xfe-barra__fila">
        <label className="xfe-buscar">
          <Search size={13} aria-hidden="true" />
          <input
            type="search"
            value={consulta}
            placeholder="Buscar"
            title="Busca por texto o código · Esc limpia"
            aria-label="Buscar por texto o código"
            aria-describedby={activo ? idEstado : undefined}
            onChange={(e) => onConsulta(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && consulta) {
                e.preventDefault();
                e.stopPropagation();
                onConsulta("");
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                onIrALista();
              }
            }}
          />
        </label>
        <select
          className="xfe-filtro"
          value={filtro}
          aria-label="Filtrar por marca"
          title="Filtrar por marca"
          data-activo={filtro !== "todas" ? "true" : undefined}
          onChange={(e) => onFiltro(e.currentTarget.value as FiltroRapido)}
        >
          {FILTROS_RAPIDOS.map((f) => (
            <option key={f.id} value={f.id} title={f.titulo}>
              {f.id === "todas" ? "Todas" : `${f.rotulo} (${conteos[f.id]})`}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="xfe-barra__icono"
          disabled={!haySecciones || activo}
          onClick={plegar ? onPlegarTodo : onDesplegarTodo}
          aria-label={plegar ? "Plegar todas las secciones" : "Desplegar todas las secciones"}
          title={activo ? "Con la búsqueda activa se ven todas abiertas" : plegar ? "Plegar todo" : "Desplegar todo"}
        >
          {plegar ? <ChevronsDownUp size={14} aria-hidden="true" /> : <ChevronsUpDown size={14} aria-hidden="true" />}
        </button>
        {accion}
      </div>
      {activo ? (
        <div className="xfe-barra__estado" id={idEstado} role="status">
          <span>
            {porMarca ? (
              <>
                <b>{coinciden}</b> {FILTROS_RAPIDOS.find((f) => f.id === filtro)?.frase}
                {consulta.trim() ? " que casan" : ""}
              </>
            ) : (
              <>
                <b>{coinciden}</b> de {total}
              </>
            )}
          </span>
          <button type="button" className="xfe-barra__limpiar" onClick={onLimpiar}>
            <X size={11} aria-hidden="true" />
            Ver todo
          </button>
        </div>
      ) : null}
    </div>
  );
}
