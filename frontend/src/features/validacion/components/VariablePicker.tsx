import { useId, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "../../../vendor/lucide-react";
import { PulsoInput } from "../../../components/PulsoInput";
import type { ExploradorSeccion, ExploradorVariable } from "../types";
import ChipsTipo from "../tabs/explorar/ChipsTipo";
import InsigniaTipo from "../tabs/explorar/InsigniaTipo";
import {
  UMBRAL_COMPLETITUD,
  coincide,
  completitud,
  conteoPorFamilia,
  enFamilia,
  type FamiliaTipo,
} from "../tabs/explorar/tiposVariable";
import { formatoConteo } from "../../../lib/formatoNumero";

// =============================================================================
// VariablePicker — lista de variables del explorador (E1, revamp 2026-11-02)
// =============================================================================
// Texto de la pregunta primero y el código en mono debajo; el tipo como
// etiqueta con el tono de su tipo; a la derecha, la completitud (casos con
// dato / casos) en una barra que se pone ámbar bajo el 80 %. Arriba, un
// buscador (texto o código, sin tildes) y chips de tipo con su conteo.

type Props = {
  secciones: ExploradorSeccion[];
  selectedVar: string | null;
  onSelect: (v: ExploradorVariable) => void;
  repeatCode?: string | null;
  repeatLabel?: string | null;
  /** Título de la lista («Variables», «Preguntas para …»). */
  titulo?: string;
  /** Control extra en la cabecera (p. ej. plegar la lista mientras se cruza). */
  accion?: ReactNode;
  /** Enfoca el buscador al montar (al desplegar desde el riel). */
  autoFocusBusqueda?: boolean;
};

export default function VariablePicker({
  secciones,
  selectedVar,
  onSelect,
  repeatCode = null,
  repeatLabel = null,
  titulo = "Variables",
  accion = null,
  autoFocusBusqueda = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [familia, setFamilia] = useState<FamiliaTipo>("todas");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const listId = useId();

  const todas = useMemo(() => secciones.flatMap((s) => s.variables), [secciones]);
  const conteo = useMemo(() => conteoPorFamilia(todas), [todas]);

  const filteredSecs = useMemo(
    () =>
      secciones
        .map((s) => ({ ...s, variables: s.variables.filter((v) => enFamilia(v, familia) && coincide(v, query)) }))
        .filter((s) => s.variables.length > 0),
    [secciones, query, familia],
  );
  const filtrando = query.trim() !== "" || familia !== "todas";

  if (!secciones.length) {
    return (
      <div className="pulso-variable-picker" role="status">
        <p className="vx-barra-nota">Sin preguntas o campos en esta base.</p>
      </div>
    );
  }

  return (
    <div className="pulso-variable-picker">
      <div className="vx-lista-cab">
        <strong>{titulo}</strong>
        <span>
          {formatoConteo(todas.length)} en {formatoConteo(secciones.length)} {secciones.length === 1 ? "sección" : "secciones"}
        </span>
        {accion}
      </div>
      <PulsoInput
        size="sm"
        type="search"
        aria-label="Buscar preguntas y campos"
        aria-controls={listId}
        placeholder="Buscar por texto o código"
        value={query}
        autoFocus={autoFocusBusqueda}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ChipsTipo valor={familia} conteo={conteo} onCambio={setFamilia} etiqueta="Filtrar la lista por tipo" />

      <div className="pulso-variable-picker-list" id={listId}>
        {filteredSecs.length === 0 && filtrando && (
          <p role="status" className="vx-barra-nota">
            {query.trim()
              ? `No hay preguntas o campos que coincidan con «${query.trim()}».`
              : "No hay preguntas de este tipo."}
          </p>
        )}
        {filteredSecs.map((sec, sectionIndex) => {
          const isCollapsed = !filtrando && !!collapsed[sec.nombre];
          const sectionId = `${listId}-section-${sectionIndex}`;
          return (
            <div key={sec.nombre}>
              <button
                type="button"
                className="vx-seccion-btn"
                aria-expanded={!isCollapsed}
                aria-controls={sectionId}
                onClick={() => setCollapsed((c) => ({ ...c, [sec.nombre]: !c[sec.nombre] }))}
              >
                <span>
                  {isCollapsed ? <ChevronRight size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
                  {sec.nombre}
                </span>
                <span>{formatoConteo(sec.variables.length)}</span>
              </button>
              <div id={sectionId} hidden={isCollapsed}>
                {sec.variables.map((v) => (
                  <VariableRow
                    key={v.name}
                    v={v}
                    selected={v.name === selectedVar}
                    onClick={() => onSelect(v)}
                    repeatCode={repeatCode}
                    repeatLabel={repeatLabel}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VariableRow({
  v,
  selected,
  onClick,
  repeatCode,
  repeatLabel,
}: {
  v: ExploradorVariable;
  selected: boolean;
  onClick: () => void;
  repeatCode: string | null;
  repeatLabel: string | null;
}) {
  const frac = completitud(v);
  const pct = frac === null ? null : Math.round(frac * 100);
  const baja = frac !== null && frac < UMBRAL_COMPLETITUD;
  const texto = v.label || v.name;
  return (
    <button
      type="button"
      className="vx-fila-var"
      aria-current={selected ? "true" : undefined}
      onClick={onClick}
      title={texto}
    >
      <InsigniaTipo tipo={v.tipo} />
      <span className="vx-fila-var-texto">
        <span>{texto}</span>
        {texto !== v.name && <span className="vx-mono">{v.name}</span>}
        {v.repeat_scope === "conditional" && (
          <span
            className="pulso-variable-repeat-scope"
            title={repeatCode && repeatLabel ? `Variable específica de ${repeatLabel}` : "Variable condicional según el servicio"}
          >
            Específica
          </span>
        )}
      </span>
      {pct !== null && (
        <span
          className={`vx-completitud${baja ? " is-baja" : ""}`}
          aria-label={`${pct}% de casos con dato`}
        >
          {pct}%
          <i aria-hidden>
            <b style={{ width: `${pct}%` }} />
          </i>
        </span>
      )}
    </button>
  );
}
