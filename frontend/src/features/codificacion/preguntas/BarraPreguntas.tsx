import { FilterChip } from "../../../components/FilterChip";
import { CheckCircle2, LayoutGrid, MessageSquareText, PencilLine, Search, X } from "../../../vendor/lucide-react";
import type { ConteosDeFiltro, FiltroPreguntas } from "./modeloUnidades";

export type BarraPreguntasProps = {
  filtro: FiltroPreguntas;
  conteos: ConteosDeFiltro;
  consulta: string;
  onFiltro: (filtro: FiltroPreguntas) => void;
  onBuscar: (consulta: string) => void;
};

/**
 * Filtros y buscador de la lista, en una sola barra. Los conteos de los filtros son la única aparición de
 * esas cifras en la pantalla: cada uno cuenta las filas que se ven al elegirlo. "Con texto" es lo que se
 * codifica (pares y preguntas abiertas); las cerradas sin texto solo aparecen en "Todas". Una pareja no
 * necesita filtro: se ve por su forma.
 */
export function BarraPreguntas({ filtro, conteos, consulta, onFiltro, onBuscar }: BarraPreguntasProps) {
  return (
    <div className="pulso-preg-barra">
      <div role="group" aria-label="Filtrar preguntas" className="pulso-preg-filtros">
        <FilterChip
          label="Con texto" count={conteos["con-texto"]}
          icon={MessageSquareText} tone="primary"
          active={filtro === "con-texto"} onClick={() => onFiltro("con-texto")}
        />
        <FilterChip
          label="Sin decidir" count={conteos["por-codificar"]}
          icon={PencilLine} tone="warn"
          active={filtro === "por-codificar"} onClick={() => onFiltro("por-codificar")}
        />
        <FilterChip
          label="Codificadas" count={conteos.codificadas}
          icon={CheckCircle2} tone="success"
          active={filtro === "codificadas"} onClick={() => onFiltro("codificadas")}
        />
        <FilterChip
          label="Todas" count={conteos.todas}
          icon={LayoutGrid} tone="neutral"
          active={filtro === "todas"} onClick={() => onFiltro("todas")}
        />
      </div>
      <div className="pulso-cv2-search pulso-preg-buscador">
        <Search size={14} className="pulso-cv2-search-icon" aria-hidden="true" />
        <input
          type="search"
          value={consulta}
          onChange={(evento) => onBuscar(evento.target.value)}
          placeholder="Buscar pregunta"
          aria-label="Buscar preguntas por nombre, etiqueta o sección"
          className="pulso-cv2-search-input"
        />
        {consulta ? (
          <button type="button" onClick={() => onBuscar("")} className="pulso-icon" aria-label="Limpiar búsqueda" title="Limpiar">
            <X size={12} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
