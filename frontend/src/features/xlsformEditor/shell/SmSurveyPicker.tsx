import { useMemo, useState } from "react";
import { Check, Search } from "../../../vendor/lucide-react";
import type { SurveyMonkeyListItem } from "../../../api/multiIntegrado";
import { smSurveyMatchesQuery, smSurveyMetaParts, smSurveyTitle } from "./surveyMonkeySurveySearch";
import "../styles/xfSmImport";

// Buscador del catálogo SurveyMonkey. Cada fila trae respuestas, preguntas y
// fecha en tipografía secundaria (U5): así se distinguen dos encuestas
// hermanas del mismo instrumento. Sin scroll propio: se muestran las primeras
// coincidencias y el resto se pide; el cuerpo del diálogo es el único dueño
// del scroll. C1: `xlsform-import-sm-encuestas`, `equal`.

const PRIMERAS = 12;

export type SmSurveyMeta = {
  totalRecent: number;
  months: number;
  fromCache: boolean;
};

export function SmSurveyPicker({
  surveys,
  meta,
  totalCuenta = null,
  selectedId,
  disabled,
  onSelect,
}: {
  surveys: SurveyMonkeyListItem[];
  meta: SmSurveyMeta | null;
  /** Encuestas visibles en la cuenta según la prueba de conexión, si se conoce. */
  totalCuenta?: number | null;
  selectedId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [todas, setTodas] = useState(false);
  const visibles = useMemo(
    () => surveys.filter((item) => smSurveyMatchesQuery(item, query)),
    [surveys, query],
  );
  const mostradas = todas ? visibles : visibles.slice(0, PRIMERAS);
  const ocultas = visibles.length - mostradas.length;
  const meses = meta?.months ?? 6;

  return (
    <div className="pulso-xf-smi-picker">
      <div className="pulso-xf-smi-picker-cabecera">
        <label className="pulso-sm-search">
          <Search size={14} aria-hidden />
          <input
            aria-label="Filtrar encuestas por nombre o ID"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setTodas(false);
            }}
            placeholder="Filtrar por nombre o ID"
            disabled={disabled}
          />
        </label>
        <span className="pulso-xf-smi-picker-caption" aria-live="polite">
          Mostrando {Math.min(mostradas.length, visibles.length)} de {visibles.length === surveys.length ? meta?.totalRecent ?? surveys.length : visibles.length} modificadas en los últimos {meses} meses
          {typeof totalCuenta === "number" && totalCuenta >= 0 ? ` · ${totalCuenta} en la cuenta` : ""}
          {meta?.fromCache ? " · lista guardada en este equipo" : ""}
        </span>
      </div>
      {mostradas.length ? (
        <ul
          className="pulso-xf-smi-encuestas"
          aria-label="Encuestas de SurveyMonkey"
          data-qa-geometry-group="xlsform-import-sm-encuestas"
          data-qa-geometry-contract="equal"
        >
          {mostradas.map((item) => {
            const selected = item.id === selectedId.trim();
            const title = smSurveyTitle(item);
            const partes = smSurveyMetaParts(item);
            return (
              <li key={item.id} data-qa-geometry-member="">
                <button
                  type="button"
                  className={`pulso-xf-smi-encuesta${selected ? " is-selected" : ""}`}
                  onClick={() => onSelect(item.id)}
                  disabled={disabled}
                  title={title}
                  aria-pressed={selected}
                >
                  <span className="pulso-xf-smi-encuesta-titulo">{title}</span>
                  <span className="pulso-xf-smi-encuesta-meta">
                    {partes.map((parte) => <span key={parte}>{parte}</span>)}
                    <span className="is-id">ID {item.id}</span>
                  </span>
                  <span className="pulso-xf-smi-encuesta-estado" aria-hidden>
                    {selected ? <><Check size={12} /> Elegida</> : "Elegir"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="pulso-xf-smi-vacio">Ninguna encuesta coincide con «{query}».</p>
      )}
      {ocultas > 0 ? (
        <button type="button" className="pulso-xf-smi-mas" onClick={() => setTodas(true)}>
          Mostrar {ocultas} más
        </button>
      ) : null}
    </div>
  );
}
