import { useEffect, useMemo, useState } from "react";
import { Search, RotateCcw, PencilLine, Sparkles, X } from "lucide-react";
import {
  apiAnaliticaBasesMetadata,
  BasesMetadataVariable,
  MeasureSpss,
} from "../../api/client";
import { useAnaliticaStore } from "./store";

// Editor visible de la inferencia SPSS. Solo la **medida** (nominal /
// ordinal / escala) es editable por el analista — el formato SPSS
// (F8.0, A40, DATE10, …) lo infiere el sistema automáticamente desde
// el tipo de la columna y no tiene sentido que el usuario lo toque
// (riesgo alto de invalidar el .sav).
//
// Solo afecta al export .sav; CSV y XLSX ignoran measure + format.

const MEASURE_COPY: Record<MeasureSpss, { label: string; color: string; bg: string; border: string }> = {
  nominal: { label: "Nominal", color: "var(--tipo-so-fg)",  bg: "var(--tipo-so-bg)",  border: "var(--tipo-so-border)" },
  ordinal: { label: "Ordinal", color: "var(--tipo-int-fg)", bg: "var(--tipo-int-bg)", border: "var(--tipo-int-border)" },
  scale:   { label: "Escala",  color: "var(--tipo-sm-fg)",  bg: "var(--tipo-sm-bg)",  border: "var(--tipo-sm-border)" },
};

export function MetadatosEditor() {
  const overrides = useAnaliticaStore((s) => s.config.bases.overrides);
  const setOverride = useAnaliticaStore((s) => s.setBasesOverride);
  const clearOverride = useAnaliticaStore((s) => s.clearBasesOverride);
  const clearAll = useAnaliticaStore((s) => s.clearAllBasesOverrides);

  const [variables, setVariables] = useState<BasesMetadataVariable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await apiAnaliticaBasesMetadata();
        if (!cancelled) setVariables(r.variables);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Contamos solo overrides de measure — el format ya no es editable
  // desde UI aunque el backend mantenga el campo para backcompat.
  const overrideCount = useMemo(
    () => Object.values(overrides).filter((ov) => ov?.measure !== undefined).length,
    [overrides],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return variables;
    return variables.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.label ?? "").toLowerCase().includes(q),
    );
  }, [variables, query]);

  if (loading) {
    return (
      <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", padding: "12px 0" }}>
        Cargando metadatos…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontSize: 12, color: "#b91c1c", padding: "12px 0" }}>
        Error cargando metadatos: {error}
      </div>
    );
  }

  if (variables.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", padding: "12px 0" }}>
        No hay variables que mostrar. ¿Ya se preparó la data?
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Resumen + acciones */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5, flex: 1, minWidth: 240 }}>
          {overrideCount === 0 ? (
            <>
              Inferencia automática activa sobre <strong>{variables.length} variables</strong>. El formato SPSS se elige por el sistema; solo la medida (nominal/ordinal/escala) es editable.
            </>
          ) : (
            <>
              <strong>{overrideCount} {overrideCount === 1 ? "medida editada" : "medidas editadas"}</strong>
              {" · "}
              <span style={{ color: "var(--pulso-text-soft)" }}>
                el resto usa la inferencia automática.
              </span>
            </>
          )}
        </div>
        {overrideCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            style={{
              fontSize: 11, padding: "4px 10px",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <RotateCcw size={11} /> Restaurar todas
          </button>
        )}
      </div>

      {/* Search */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 6,
          border: "1px solid var(--pulso-border)",
          background: "white",
        }}
      >
        <Search size={13} color="var(--pulso-text-soft)" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o etiqueta…"
          style={{
            flex: 1, border: "none", outline: "none",
            fontSize: 12, padding: "2px 0",
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="pulso-icon"
            aria-label="Limpiar búsqueda"
            style={{ minWidth: 20, minHeight: 20 }}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Tabla */}
      <div
        style={{
          maxHeight: 420, overflow: "auto",
          border: "1px solid var(--pulso-border)",
          borderRadius: 6,
          background: "white",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr
              style={{
                position: "sticky", top: 0, zIndex: 1,
                background: "var(--pulso-surface)",
                borderBottom: "1px solid var(--pulso-border)",
              }}
            >
              <Th>Variable</Th>
              <Th style={{ width: 140 }}>Tipo XLSForm</Th>
              <Th style={{ width: 190 }}>Medida SPSS</Th>
              <Th style={{ width: 100 }}>Formato</Th>
              <Th style={{ width: 40 }}></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const ov = overrides[v.name] ?? {};
              const hasMeasureOverride = ov.measure !== undefined;
              return (
                <VariableRow
                  key={v.name}
                  v={v}
                  overrideMeasure={ov.measure}
                  hasOverride={hasMeasureOverride}
                  onChangeMeasure={(m) => setOverride(v.name, { measure: m })}
                  onReset={() => clearOverride(v.name)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", textAlign: "center", padding: "8px 0" }}>
          No hay variables que coincidan con "{query}".
        </div>
      )}
    </div>
  );
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "8px 10px",
        fontSize: 10, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: 0.3,
        color: "var(--pulso-text-soft)",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function VariableRow({
  v,
  overrideMeasure,
  hasOverride,
  onChangeMeasure,
  onReset,
}: {
  v: BasesMetadataVariable;
  overrideMeasure?: MeasureSpss;
  hasOverride: boolean;
  onChangeMeasure: (m: MeasureSpss | undefined) => void;
  onReset: () => void;
}) {
  const [hover, setHover] = useState(false);
  const effectiveMeasure = overrideMeasure ?? v.inferred_measure;

  const rowBg = hasOverride
    ? "var(--pulso-primary-soft)"
    : hover
    ? "var(--pulso-surface)"
    : "white";

  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderBottom: "1px solid var(--pulso-border)",
        background: rowBg,
        transition: "background 120ms ease",
      }}
    >
      {/* Variable name + label */}
      <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <code
            style={{
              fontFamily: "monospace", fontSize: 11, fontWeight: 600,
              color: "var(--pulso-text)",
            }}
          >
            {v.name}
          </code>
          {v.label && (
            <div
              style={{ fontSize: 10, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}
              title={v.label}
            >
              {truncate(v.label, 60)}
            </div>
          )}
        </div>
      </td>

      {/* Tipo XLSForm */}
      <td style={{ padding: "8px 10px", verticalAlign: "top", fontSize: 10, color: "var(--pulso-text-soft)" }}>
        {v.tipo_xlsform ? (
          <code style={{ fontFamily: "monospace" }}>{v.tipo_xlsform}</code>
        ) : (
          <span style={{ fontStyle: "italic" }}>—</span>
        )}
        {v.has_labels && (
          <div style={{ fontSize: 9, color: "var(--pulso-text-soft)", marginTop: 2 }}>
            con value-labels
          </div>
        )}
      </td>

      {/* Measure (editable) */}
      <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
        <MeasureSelector
          value={effectiveMeasure}
          inferred={v.inferred_measure}
          isOverride={hasOverride}
          onChange={(m) => onChangeMeasure(m === v.inferred_measure ? undefined : m)}
        />
      </td>

      {/* Formato (read-only) */}
      <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
        <FormatBadge value={v.inferred_format_spss} />
      </td>

      {/* Reset per-row */}
      <td style={{ padding: "8px 10px", verticalAlign: "top", textAlign: "center" }}>
        {hasOverride && (
          <button
            type="button"
            onClick={onReset}
            className="pulso-icon"
            aria-label={`Restaurar inferencia de ${v.name}`}
            title="Restaurar a la inferencia automática"
            style={{ minWidth: 22, minHeight: 22 }}
          >
            <RotateCcw size={12} />
          </button>
        )}
      </td>
    </tr>
  );
}

function MeasureSelector({
  value,
  inferred,
  isOverride,
  onChange,
}: {
  value: MeasureSpss;
  inferred: MeasureSpss;
  isOverride: boolean;
  onChange: (m: MeasureSpss) => void;
}) {
  const info = MEASURE_COPY[value];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as MeasureSpss)}
        aria-label="Nivel de medida SPSS"
        style={{
          fontSize: 11, padding: "5px 8px", borderRadius: 4,
          border: `1px solid ${isOverride ? "var(--pulso-primary)" : info.border}`,
          background: info.bg,
          color: info.color,
          fontWeight: 600,
          cursor: "pointer",
          minHeight: 26,
          transition: "border-color 120ms ease",
        }}
      >
        {(Object.keys(MEASURE_COPY) as MeasureSpss[]).map((m) => (
          <option key={m} value={m}>{MEASURE_COPY[m].label}</option>
        ))}
      </select>
      <div style={{ fontSize: 9, color: "var(--pulso-text-soft)", display: "flex", alignItems: "center", gap: 3 }}>
        {isOverride ? (
          <>
            <PencilLine size={9} />
            <span>editado · auto: {MEASURE_COPY[inferred].label.toLowerCase()}</span>
          </>
        ) : (
          <>
            <Sparkles size={9} />
            <span>inferido</span>
          </>
        )}
      </div>
    </div>
  );
}

// Formato SPSS mostrado como badge no-interactivo. Un tooltip explica
// qué significa cada preset para el analista que quiera entender la
// inferencia. "auto" = dejamos que haven elija el A<w> real (caso texto
// libre) — esto evita el bug de corrupción con strings > 255 chars.
function FormatBadge({ value }: { value: string }) {
  const description =
    value === "auto"       ? "Ancho auto-detectado por haven al escribir (p. ej. texto libre)."
    : value.startsWith("F") ? "Numérico SPSS."
    : value.startsWith("A") ? "String de ancho fijo SPSS."
    : value === "DATE10"   ? "Fecha (dd/mm/yyyy)."
    : value === "TIME10"   ? "Hora (hh:mm:ss)."
    : value === "DATETIME20" ? "Fecha-hora SPSS."
    : "Formato SPSS inferido.";
  return (
    <span
      title={description}
      style={{
        display: "inline-flex", alignItems: "center",
        padding: "3px 8px", borderRadius: 4,
        background: "var(--pulso-surface)",
        border: "1px solid var(--pulso-border)",
        fontFamily: "monospace",
        fontSize: 10, fontWeight: 600,
        color: "var(--pulso-text-soft)",
        cursor: "help",
      }}
    >
      {value}
    </span>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
