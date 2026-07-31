import { Search, XCircle } from "../../../../vendor/lucide-react";

/**
 * Barra de filtros de «Efectivas Kobo» en el perfil telefónico.
 *
 * Vive fuera de `TelefonicoMonitoreoPage.tsx` porque ese archivo está congelado
 * a crecimiento (`agentic/manifest.json`) y esta reparación necesitaba enhebrar
 * una prop nueva por tres firmas. Sacar la barra entera paga el peaje con
 * holgura.
 *
 * La reparación es la decisión 5a del goal visual: **«Sede» no se hardcodea
 * nunca**. El resto de la vista de cuotas ya leía el nombre del segmento del
 * estudio (`segmentoDeCuotas.ts`), pero este filtro se había quedado atrás y
 * seguía llamando sede a lo que en PDM MedVida es un actor.
 */

export type OpcionDeFiltro = { value: string; label: string; count: number };

export type FiltrosDeEfectivas = {
  search: string;
  actor: string;
  date: string;
  source: string;
  collector: string;
};

export function CapsulaDeFiltro({
  label,
  value,
  options,
  allLabel,
  onChange,
  formatOptionLabel,
}: {
  label: string;
  value: string;
  options: OpcionDeFiltro[];
  allLabel: string;
  onChange: (value: string) => void;
  formatOptionLabel: (option: OpcionDeFiltro) => string;
}) {
  return (
    <label className={`mon-acr-base-filter-pill${value ? " is-active" : ""}`}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {formatOptionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TelefonicoEffectiveConsultedFilters({
  filters,
  segmento,
  actorOptions,
  dateOptions,
  sourceOptions,
  collectorOptions,
  activeFilters,
  formatOptionLabel,
  onFilter,
  onClear,
}: {
  filters: Pick<FiltrosDeEfectivas, "search" | "actor" | "date" | "source" | "collector">;
  /** Cómo llama ESTE estudio al segmento de cuotas: «Actor», «Sede», «Distrito». */
  segmento: string;
  actorOptions: OpcionDeFiltro[];
  dateOptions: OpcionDeFiltro[];
  sourceOptions: OpcionDeFiltro[];
  collectorOptions: OpcionDeFiltro[];
  activeFilters: boolean;
  formatOptionLabel: (option: OpcionDeFiltro) => string;
  onFilter: (patch: Partial<FiltrosDeEfectivas>) => void;
  onClear: () => void;
}) {
  return (
    <div className="mon-phone-consulted-filters" aria-label="Filtros de efectivas Kobo">
      <label className={`mon-acr-base-search-pill${filters.search ? " is-active" : ""}`}>
        <Search size={14} />
        <input
          value={filters.search}
          onChange={(event) => onFilter({ search: event.target.value })}
          // Sin el verbo: la lupa al lado ya dice que esto busca, y con
          // «Buscar» delante el texto se recortaba 1,9 px a 1440. El placeholder
          // sirve para decir POR QUÉ se puede buscar, no qué hace el control.
          placeholder="CodPulso, responsable o encuesta"
        />
      </label>
      <CapsulaDeFiltro
        label={segmento}
        value={filters.actor}
        options={actorOptions}
        // «Todos» a secas y no «todas las sedes»: el género del nombre lo pone
        // el estudio y no hay forma fiable de derivarlo. El filtro de
        // Responsable, al lado, ya resuelve lo mismo igual.
        allLabel="Todos"
        onChange={(actor) => onFilter({ actor })}
        formatOptionLabel={formatOptionLabel}
      />
      <CapsulaDeFiltro
        label="Fecha"
        value={filters.date}
        options={dateOptions}
        allLabel="Todas las fechas"
        onChange={(date) => onFilter({ date })}
        formatOptionLabel={formatOptionLabel}
      />
      <CapsulaDeFiltro
        label="Encuesta"
        value={filters.source}
        options={sourceOptions}
        allLabel="Todas las encuestas"
        onChange={(source) => onFilter({ source })}
        formatOptionLabel={formatOptionLabel}
      />
      <CapsulaDeFiltro
        label="Responsable"
        value={filters.collector}
        options={collectorOptions}
        allLabel="Todos"
        onChange={(collector) => onFilter({ collector })}
        formatOptionLabel={formatOptionLabel}
      />
      <button type="button" className="mon-acr-base-clear-pill" onClick={onClear} disabled={!activeFilters} title="Limpiar filtros">
        <XCircle size={14} />
        <span>Limpiar</span>
      </button>
    </div>
  );
}
