import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Eye,
  Filter as FilterIcon,
  Hash,
  Pencil,
  Save,
  X as XIcon,
} from "lucide-react";
import type { ReglaInstrumento } from "../../../api/client";
import DrilldownTable from "./DrilldownTable";

// =============================================================================
// ReglaDrillPanel — drill enriquecido de una regla (Sprint 2.5)
// =============================================================================
// Muestra:
//   - Header: id_regla + toggle activa/ignorada + botón editar atributos.
//   - Cuerpo: nombre humano, objetivo, chips de tipo/sección/categoría, chips
//     de variables involucradas, expresión R (colapsable).
//   - Tabla de casos inconsistentes con columna UUID destacada.
//
// Acciones:
//   - onToggleActiva(activa: bool) → llama PATCH .../regla/:id/activa.
//   - onPatchAtributos(patch) → llama PATCH .../regla/:id/atributos.
// Ambas invalidan la evaluación; el tab padre debe advertir que hay que
// re-correr auditoría.

type Props = {
  regla: ReglaInstrumento;
  casos: Array<Record<string, unknown>>;
  uuidCol: string | null;
  onToggleActiva: (activa: boolean) => Promise<void>;
  onPatchAtributos: (patch: Record<string, string>) => Promise<void>;
  onClose: () => void;
  invalidatedHint?: string;
  startEditingToken?: number;
};

export default function ReglaDrillPanel({
  regla,
  casos,
  uuidCol,
  onToggleActiva,
  onPatchAtributos,
  onClose,
  invalidatedHint,
  startEditingToken,
}: Props) {
  const [expandProc, setExpandProc] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    nombre: regla.nombre ?? "",
    objetivo: regla.objetivo ?? "",
    tipo_observacion: regla.tipo_observacion ?? "",
    categoria: regla.categoria ?? "",
  });

  // Filtros por columna sobre la tabla de casos. Map: colName → Set
  // de valores ACEPTADOS. Si una col no está en el map (o su set es
  // undefined), no se filtra por esa col. Si el set está vacío, NO
  // hay filas que matcheen (el usuario deseleccionó todas) → filtra
  // todo. Arrancamos sin filtros.
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if ((startEditingToken ?? 0) > 0) {
      setEditing(true);
    }
  }, [startEditingToken]);

  // Columnas candidatas a filtrar: las variables declaradas por la
  // regla (excluye el UUID que es alta cardinalidad y no da valor).
  const filterableCols = useMemo(
    () => regla.variables.filter((c) => c !== uuidCol),
    [regla.variables, uuidCol]
  );

  // Valores distinct por columna. Los toString para manejar numéricos.
  const distinctByCol = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const col of filterableCols) {
      const seen = new Set<string>();
      for (const row of casos) {
        const v = row[col];
        if (v === null || v === undefined || v === "") continue;
        seen.add(String(v));
      }
      out[col] = Array.from(seen).sort();
    }
    return out;
  }, [casos, filterableCols]);

  const filteredCasos = useMemo(() => {
    const active = Object.entries(filters).filter(([, s]) => s);
    if (!active.length) return casos;
    return casos.filter((row) =>
      active.every(([col, set]) => {
        const v = row[col];
        if (v === null || v === undefined || v === "") return false;
        return set!.has(String(v));
      })
    );
  }, [casos, filters]);

  function toggleFilterValue(col: string, value: string) {
    setFilters((prev) => {
      const next = { ...prev };
      const cur = next[col];
      if (!cur) {
        // Primera selección: set con todos los distinct - el que desmarcó.
        const all = new Set(distinctByCol[col] ?? []);
        all.delete(value);
        next[col] = all;
      } else {
        const copy = new Set(cur);
        if (copy.has(value)) copy.delete(value);
        else copy.add(value);
        next[col] = copy;
      }
      return next;
    });
  }

  function clearFilterCol(col: string) {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[col];
      return next;
    });
  }

  function clearAllFilters() {
    setFilters({});
  }

  const nActiveFilters = Object.values(filters).filter((s) => !!s).length;
  const isFiltered = filteredCasos.length !== casos.length;

  async function handleSave() {
    setSaving(true);
    try {
      const patch: Record<string, string> = {};
      if (draft.nombre !== (regla.nombre ?? "")) patch.nombre = draft.nombre;
      if (draft.objetivo !== (regla.objetivo ?? "")) patch.objetivo = draft.objetivo;
      if (draft.tipo_observacion !== (regla.tipo_observacion ?? "")) patch.tipo_observacion = draft.tipo_observacion;
      if (draft.categoria !== (regla.categoria ?? "")) patch.categoria = draft.categoria;
      if (Object.keys(patch).length) await onPatchAtributos(patch);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      style={{
        padding: "18px 20px",
        background: regla.activa ? "white" : "var(--pulso-surface-2)",
        border: `1px solid ${regla.activa ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
        borderRadius: 12,
        boxShadow: "var(--pulso-shadow-low)",
        opacity: regla.activa ? 1 : 0.75,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            padding: "3px 8px",
            borderRadius: 6,
            background: "var(--pulso-primary-soft)",
            color: "var(--pulso-primary)",
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {regla.id}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              type="text"
              value={draft.nombre}
              onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
              style={{
                width: "100%",
                fontSize: 14,
                fontWeight: 700,
                padding: "6px 10px",
                border: "1px solid var(--pulso-primary-border)",
                borderRadius: 6,
                outline: "none",
              }}
            />
          ) : (
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--pulso-text)", lineHeight: 1.3 }}>
              {regla.nombre}
            </div>
          )}
          {!regla.activa && (
            <span
              style={{
                display: "inline-block",
                marginTop: 4,
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 999,
                background: "var(--pulso-warn-bg)",
                color: "var(--pulso-warn-fg)",
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              Ignorada
            </span>
          )}
        </div>
        {/* Acciones */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {editing ? (
            <>
              <button
                type="button"
                className="pulso-primary"
                onClick={() => void handleSave()}
                disabled={saving}
                style={{ fontSize: 11, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Save size={11} /> Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft({
                    nombre: regla.nombre ?? "",
                    objetivo: regla.objetivo ?? "",
                    tipo_observacion: regla.tipo_observacion ?? "",
                    categoria: regla.categoria ?? "",
                  });
                }}
                disabled={saving}
                style={{ fontSize: 11, padding: "6px 10px" }}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                title="Editar atributos humanos"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  padding: "6px 10px",
                  border: "1px solid var(--pulso-border)",
                  background: "white",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                <Pencil size={11} /> Editar
              </button>
              <button
                type="button"
                onClick={() => void onToggleActiva(!regla.activa)}
                title={regla.activa ? "Ignorar esta regla en la próxima auditoría" : "Reactivar esta regla"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  padding: "6px 10px",
                  border: "1px solid var(--pulso-border)",
                  background: regla.activa ? "white" : "var(--pulso-success-bg)",
                  color: regla.activa ? "var(--pulso-text-soft)" : "var(--pulso-success-fg)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {regla.activa ? <EyeOff size={11} /> : <Eye size={11} />}
                {regla.activa ? "Ignorar" : "Reactivar"}
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Cerrar drill"
                style={{
                  fontSize: 11,
                  padding: "6px 10px",
                  border: "1px solid var(--pulso-border)",
                  background: "white",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </>
          )}
        </div>
      </div>

      {invalidatedHint && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            fontSize: 11,
            color: "var(--pulso-warn-fg)",
            background: "var(--pulso-warn-bg)",
            border: "1px solid var(--pulso-warn-border)",
            borderRadius: 6,
            lineHeight: 1.4,
          }}
        >
          {invalidatedHint}
        </div>
      )}

      {/* Atributos humanos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        <AttrRow label="Objetivo">
          {editing ? (
            <textarea
              value={draft.objetivo}
              onChange={(e) => setDraft((d) => ({ ...d, objetivo: e.target.value }))}
              rows={2}
              style={{
                width: "100%",
                fontSize: 12,
                padding: "6px 10px",
                border: "1px solid var(--pulso-border)",
                borderRadius: 6,
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          ) : (
            <span style={{ fontSize: 12, color: "var(--pulso-text)", lineHeight: 1.5 }}>
              {regla.objetivo || <em style={{ color: "var(--pulso-text-soft)" }}>— sin objetivo definido —</em>}
            </span>
          )}
        </AttrRow>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {editing ? (
            <>
              <AttrInline label="Tipo de observación">
                <input
                  type="text"
                  value={draft.tipo_observacion}
                  onChange={(e) => setDraft((d) => ({ ...d, tipo_observacion: e.target.value }))}
                  style={inlineInputStyle}
                />
              </AttrInline>
              <AttrInline label="Categoría">
                <input
                  type="text"
                  value={draft.categoria}
                  onChange={(e) => setDraft((d) => ({ ...d, categoria: e.target.value }))}
                  style={inlineInputStyle}
                />
              </AttrInline>
            </>
          ) : (
            <>
              {regla.tipo_observacion && (
                <Chip label={regla.tipo_observacion} color="primary" icon={<Check size={10} />} />
              )}
              {regla.seccion && <Chip label={regla.seccion} color="neutral" />}
              {regla.categoria && <Chip label={regla.categoria} color="neutral" />}
              {regla.tabla && regla.tabla !== "principal" && (
                <Chip label={`Tabla: ${regla.tabla}`} color="neutral" />
              )}
              {regla.n_inconsistencias != null && (
                <Chip
                  label={`${regla.n_inconsistencias} caso${regla.n_inconsistencias === 1 ? "" : "s"}`}
                  color={regla.n_inconsistencias > 0 ? "warn" : "success"}
                />
              )}
            </>
          )}
        </div>

        {regla.variables.length > 0 && (
          <div>
            <div style={sublabelStyle}>Variables involucradas</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {regla.variables.map((v) => (
                <code
                  key={v}
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 11,
                    padding: "3px 8px",
                    background: "var(--pulso-surface-2)",
                    border: "1px solid var(--pulso-border)",
                    borderRadius: 4,
                    color: "var(--pulso-text)",
                  }}
                >
                  {v}
                </code>
              ))}
            </div>
          </div>
        )}

        {regla.procesamiento && (
          <div>
            <button
              type="button"
              onClick={() => setExpandProc((x) => !x)}
              style={{
                ...sublabelStyle,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {expandProc ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              Expresión evaluada
            </button>
            {expandProc && (
              <pre
                style={{
                  marginTop: 6,
                  padding: "10px 12px",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: "ui-monospace, monospace",
                  overflow: "auto",
                  lineHeight: 1.5,
                  maxHeight: 200,
                }}
              >
                {regla.procesamiento}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Tabla de casos */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <Hash size={12} color="var(--pulso-text-soft)" />
          <span style={{ fontSize: 12, fontWeight: 700 }}>
            Casos inconsistentes ({isFiltered ? `${filteredCasos.length} de ${casos.length}` : casos.length})
          </span>
          {uuidCol && (
            <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", fontFamily: "ui-monospace, monospace" }}>
              · UUID: {uuidCol}
            </span>
          )}

          {filterableCols.length > 0 && (
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              style={{
                marginLeft: "auto",
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 6,
                border: `1px solid ${nActiveFilters > 0 ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                background: nActiveFilters > 0 ? "var(--pulso-primary-soft)" : "white",
                color: nActiveFilters > 0 ? "var(--pulso-primary)" : "var(--pulso-text)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
              }}
            >
              <FilterIcon size={11} />
              {filtersOpen ? "Ocultar filtros" : "Filtros"}
              {nActiveFilters > 0 && (
                <span style={{
                  background: "var(--pulso-primary)",
                  color: "white",
                  borderRadius: 999,
                  padding: "0 6px",
                  fontSize: 10,
                  fontWeight: 700,
                }}>
                  {nActiveFilters}
                </span>
              )}
            </button>
          )}
          {nActiveFilters > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              style={{
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--pulso-border)",
                background: "white",
                color: "var(--pulso-text-soft)",
                cursor: "pointer",
              }}
            >
              Limpiar
            </button>
          )}
        </div>

        {filtersOpen && filterableCols.length > 0 && (
          <div
            style={{
              marginBottom: 10,
              padding: 10,
              borderRadius: 6,
              border: "1px solid var(--pulso-border)",
              background: "var(--pulso-surface)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {filterableCols.map((col) => {
              const distinct = distinctByCol[col] ?? [];
              if (!distinct.length) return null;
              const activeSet = filters[col];
              const allShown = !activeSet;
              return (
                <div key={col}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text)" }}>
                      {col}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--pulso-text-soft)" }}>
                      · {distinct.length} {distinct.length === 1 ? "valor" : "valores"}
                    </span>
                    {!allShown && (
                      <button
                        type="button"
                        onClick={() => clearFilterCol(col)}
                        style={{
                          marginLeft: "auto",
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 4,
                          border: "1px solid var(--pulso-border)",
                          background: "white",
                          color: "var(--pulso-text-soft)",
                          cursor: "pointer",
                        }}
                      >
                        Todos
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {distinct.map((val) => {
                      const included = allShown || activeSet!.has(val);
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => toggleFilterValue(col, val)}
                          style={{
                            fontSize: 10,
                            padding: "3px 8px",
                            borderRadius: 999,
                            border: `1px solid ${included ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                            background: included ? "var(--pulso-primary-soft)" : "white",
                            color: included ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
                            cursor: "pointer",
                            fontFamily: "ui-monospace, monospace",
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={val}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DrilldownTable
          rows={filteredCasos}
          preferredOrder={uuidCol ? [uuidCol, ...regla.variables] : regla.variables}
          emptyHint={isFiltered ? "Ningún caso matchea los filtros actuales." : "Sin casos inconsistentes."}
        />
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
const sublabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--pulso-text-soft)",
};

const inlineInputStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "4px 8px",
  border: "1px solid var(--pulso-border)",
  borderRadius: 4,
  outline: "none",
  minWidth: 160,
};

function AttrRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={sublabelStyle}>{label}</div>
      <div style={{ marginTop: 2 }}>{children}</div>
    </div>
  );
}

function AttrInline({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span style={sublabelStyle}>{label}</span>
      {children}
    </label>
  );
}

const CHIP_COLORS: Record<string, { bg: string; fg: string }> = {
  primary: { bg: "var(--pulso-primary-soft)", fg: "var(--pulso-primary)" },
  neutral: { bg: "var(--pulso-surface-2)", fg: "var(--pulso-text-soft)" },
  warn: { bg: "var(--pulso-warn-bg)", fg: "var(--pulso-warn-fg)" },
  success: { bg: "var(--pulso-success-bg)", fg: "var(--pulso-success-fg)" },
};

function Chip({
  label,
  color = "neutral",
  icon,
}: {
  label: string;
  color?: keyof typeof CHIP_COLORS;
  icon?: React.ReactNode;
}) {
  const c = CHIP_COLORS[color];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
      }}
    >
      {icon}
      {label}
    </span>
  );
}
