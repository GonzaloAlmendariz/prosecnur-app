import { useEffect, useState } from "react";
import { Filter, Plus, X as XIcon } from "lucide-react";
import {
  apiV2ExplorarValores,
  type ExplorarValoresResult,
  type ExplorarFiltros,
  type FiltroRango,
} from "../../../api/client";
import type { ExploradorSeccion, ExploradorVariable } from "../types";

// =============================================================================
// FiltroCascada — permite agregar filtros que segmentan la data antes de
// graficar (Sprint 3.5)
// =============================================================================
// Modelo: `filtros = { var1: [val1, val2], var2: [val3] }` — se envía al
// backend en cada llamada univariado/bivariado. El componente muestra los
// filtros activos como chips; agregar uno abre un popover con selector de
// variable + checklist de valores (carga on-demand desde
// /api/validacion/v2/explorar/valores).
//
// Solo ofrecemos variables SO/SM como candidatas a filtro (num/fecha/texto
// quedan fuera por ahora — rango slider es stretch).

type Props = {
  secciones: ExploradorSeccion[];
  filtros: ExplorarFiltros;
  onChange: (filtros: ExplorarFiltros) => void;
  baseNombre: string | null;
};

export default function FiltroCascada({
  secciones,
  filtros,
  onChange,
  baseNombre,
}: Props) {
  const [picking, setPicking] = useState(false);
  const [selectedVar, setSelectedVar] = useState<string | null>(null);
  const [valores, setValores] = useState<ExplorarValoresResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Ampliamos candidatas: SO/SM (listas de valores) + num/fecha (rango).
  const candidatas = secciones
    .flatMap((s) => s.variables.map((v) => ({ ...v, seccion: s.nombre })))
    .filter((v) =>
      v.tipo === "so" || v.tipo === "sm" || v.tipo === "num" || v.tipo === "fecha",
    )
    .filter((v) => !filtros[v.name]);

  // Cargar valores al elegir una variable.
  useEffect(() => {
    if (!selectedVar) {
      setValores(null);
      return;
    }
    let cancel = false;
    setLoading(true);
    apiV2ExplorarValores(selectedVar, baseNombre)
      .then((r) => {
        if (!cancel) setValores(r);
      })
      .catch(() => {
        if (!cancel) setValores(null);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [selectedVar, baseNombre]);

  function addFiltro(values: string[]) {
    if (!selectedVar || values.length === 0) return;
    onChange({ ...filtros, [selectedVar]: values });
    setSelectedVar(null);
    setValores(null);
    setPicking(false);
  }

  function addFiltroRango(rango: FiltroRango) {
    if (!selectedVar) return;
    onChange({ ...filtros, [selectedVar]: rango });
    setSelectedVar(null);
    setValores(null);
    setPicking(false);
  }

  function removeFiltro(varName: string) {
    const copy = { ...filtros };
    delete copy[varName];
    onChange(copy);
  }

  function clearAll() {
    onChange({});
  }

  const activeKeys = Object.keys(filtros);

  return (
    <section
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: activeKeys.length > 0 ? "var(--pulso-primary-soft)" : "var(--pulso-surface-2)",
        border: `1px solid ${activeKeys.length > 0 ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            color: activeKeys.length > 0 ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
          }}
        >
          <Filter size={12} /> Filtros
          {activeKeys.length > 0 && ` · ${activeKeys.length}`}
        </span>

        {activeKeys.map((vname) => {
          const f = filtros[vname];
          const found = secciones.flatMap((s) => s.variables).find((v) => v.name === vname);
          const isRange = !Array.isArray(f);
          const resumen = isRange
            ? `${(f as FiltroRango).min ?? "−∞"} — ${(f as FiltroRango).max ?? "+∞"}`
            : `${(f as string[]).length} ${(f as string[]).length === 1 ? "valor" : "valores"}`;
          return (
            <span
              key={vname}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 8px",
                borderRadius: 999,
                background: "white",
                border: "1px solid var(--pulso-primary-border)",
                color: "var(--pulso-primary)",
              }}
              title={found?.label ?? vname}
            >
              <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 10 }}>
                {vname}
              </code>
              <span style={{ color: "var(--pulso-text-soft)" }}>·</span>
              <span>{resumen}</span>
              <button
                type="button"
                onClick={() => removeFiltro(vname)}
                aria-label={`Quitar filtro ${vname}`}
                style={{
                  marginLeft: 2,
                  background: "transparent",
                  border: "none",
                  color: "var(--pulso-text-soft)",
                  cursor: "pointer",
                  display: "inline-flex",
                  padding: 2,
                }}
              >
                <XIcon size={11} />
              </button>
            </span>
          );
        })}

        {!picking && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            disabled={candidatas.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px dashed var(--pulso-primary-border)",
              background: "transparent",
              color: "var(--pulso-primary)",
              cursor: candidatas.length === 0 ? "not-allowed" : "pointer",
              opacity: candidatas.length === 0 ? 0.55 : 1,
            }}
          >
            <Plus size={11} /> Agregar filtro
          </button>
        )}

        {activeKeys.length > 1 && (
          <button
            type="button"
            onClick={clearAll}
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 4,
              background: "transparent",
              color: "var(--pulso-text-soft)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Limpiar todo
          </button>
        )}
      </div>

      {picking && (
        <FiltroPicker
          candidatas={candidatas}
          selectedVar={selectedVar}
          onSelectVar={setSelectedVar}
          valores={valores}
          loading={loading}
          onConfirm={addFiltro}
          onConfirmRango={addFiltroRango}
          onCancel={() => {
            setPicking(false);
            setSelectedVar(null);
            setValores(null);
          }}
        />
      )}
    </section>
  );
}

// -----------------------------------------------------------------------------
function FiltroPicker({
  candidatas,
  selectedVar,
  onSelectVar,
  valores,
  loading,
  onConfirm,
  onConfirmRango,
  onCancel,
}: {
  candidatas: (ExploradorVariable & { seccion: string })[];
  selectedVar: string | null;
  onSelectVar: (v: string | null) => void;
  valores: ExplorarValoresResult | null;
  loading: boolean;
  onConfirm: (values: string[]) => void;
  onConfirmRango: (rango: FiltroRango) => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [rangoMin, setRangoMin] = useState<string>("");
  const [rangoMax, setRangoMax] = useState<string>("");

  // Reset al cambiar de variable.
  useEffect(() => {
    setChecked(new Set());
    setRangoMin("");
    setRangoMax("");
  }, [selectedVar]);

  // Cuando llegan los valores, si es num/fecha prefill con min/max.
  useEffect(() => {
    if (valores?.rango) {
      setRangoMin(String(valores.rango.min));
      setRangoMax(String(valores.rango.max));
    }
  }, [valores]);

  function toggleVal(code: string) {
    setChecked((s) => {
      const copy = new Set(s);
      if (copy.has(code)) copy.delete(code);
      else copy.add(code);
      return copy;
    });
  }

  const esRango = !!valores?.rango && (valores.tipo === "num" || valores.tipo === "fecha");

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "white",
        border: "1px solid var(--pulso-primary)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4, flexShrink: 0 }}>
          Variable
        </label>
        <select
          value={selectedVar ?? ""}
          onChange={(e) => onSelectVar(e.target.value || null)}
          style={{
            flex: 1,
            fontSize: 12,
            padding: "5px 8px",
            borderRadius: 6,
            border: "1px solid var(--pulso-border)",
            background: "white",
          }}
        >
          <option value="">— Elegir —</option>
          {candidatas.map((v) => (
            <option key={v.name} value={v.name}>
              {v.seccion} · {v.name}
              {v.label && v.label !== v.name ? ` · ${v.label.slice(0, 60)}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            border: "1px solid var(--pulso-border)",
            background: "white",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>

      {loading && (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
          Cargando opciones…
        </div>
      )}

      {!loading && esRango && valores?.rango && (
        <RangoPicker
          tipo={valores.tipo as "num" | "fecha"}
          rango={valores.rango}
          min={rangoMin}
          max={rangoMax}
          onMin={setRangoMin}
          onMax={setRangoMax}
          onConfirm={() => {
            const r: FiltroRango = {};
            if (rangoMin !== "") r.min = valores.tipo === "num" ? Number(rangoMin) : rangoMin;
            if (rangoMax !== "") r.max = valores.tipo === "num" ? Number(rangoMax) : rangoMax;
            if (r.min != null || r.max != null) onConfirmRango(r);
          }}
        />
      )}

      {!loading && !esRango && valores && valores.opciones.length > 0 && (
        <>
          <div
            style={{
              maxHeight: 220,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "6px 0",
            }}
          >
            {valores.opciones.map((op) => (
              <label
                key={op.code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 6px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked.has(op.code)}
                  onChange={() => toggleVal(op.code)}
                />
                <span style={{ flex: 1, color: "var(--pulso-text)" }}>{op.label}</span>
                <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", fontFamily: "ui-monospace, monospace" }}>
                  n={op.n}
                </span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="pulso-primary"
              onClick={() => onConfirm(Array.from(checked))}
              disabled={checked.size === 0}
              style={{
                fontSize: 12,
                padding: "6px 14px",
                opacity: checked.size === 0 ? 0.55 : 1,
              }}
            >
              Aplicar filtro ({checked.size})
            </button>
          </div>
        </>
      )}

      {!loading && !esRango && valores && valores.opciones.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
          Esta variable no tiene opciones disponibles.
        </div>
      )}
    </div>
  );
}

// =============================================================================
// RangoPicker — para variables num/fecha. Slider dual manual (inputs con
// rango propuesto como min/max, p1/p99 como atajos, y dos range sliders
// sincronizados con los inputs para que el usuario pueda elegir
// visualmente).
// =============================================================================
function RangoPicker({
  tipo,
  rango,
  min,
  max,
  onMin,
  onMax,
  onConfirm,
}: {
  tipo: "num" | "fecha";
  rango: NonNullable<ExplorarValoresResult["rango"]>;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  onConfirm: () => void;
}) {
  const isFecha = tipo === "fecha";
  const fullMin = Number(rango.min);
  const fullMax = Number(rango.max);
  const step = isFecha ? 1 : (fullMax - fullMin) / 1000 || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
        Rango detectado: <strong>{String(rango.min)}</strong> → <strong>{String(rango.max)}</strong>
        {" "}· n={rango.n_validos}
        {tipo === "num" && rango.q1 != null && rango.q3 != null && (
          <> · Q1 = {rango.q1.toFixed(2)} · Mediana = {rango.mediana?.toFixed(2)} · Q3 = {rango.q3.toFixed(2)}</>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 600, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Mínimo
          </span>
          <input
            type={isFecha ? "date" : "number"}
            step={isFecha ? undefined : step}
            value={min}
            onChange={(e) => onMin(e.target.value)}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              border: "1px solid var(--pulso-border)",
              borderRadius: 6,
            }}
          />
        </label>
        <label style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 600, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Máximo
          </span>
          <input
            type={isFecha ? "date" : "number"}
            step={isFecha ? undefined : step}
            value={max}
            onChange={(e) => onMax(e.target.value)}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              border: "1px solid var(--pulso-border)",
              borderRadius: 6,
            }}
          />
        </label>
      </div>

      {!isFecha && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="range"
            min={fullMin}
            max={fullMax}
            step={step}
            value={min === "" ? fullMin : Number(min)}
            onChange={(e) => onMin(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            type="range"
            min={fullMin}
            max={fullMax}
            step={step}
            value={max === "" ? fullMax : Number(max)}
            onChange={(e) => onMax(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      )}

      {/* Atajos: p1-p99 y Q1-Q3 */}
      {tipo === "num" && rango.p1 != null && rango.p99 != null && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              onMin(String(rango.p1));
              onMax(String(rango.p99));
            }}
            style={atajoBtnStyle}
          >
            Percentil 1 – 99
          </button>
          <button
            type="button"
            onClick={() => {
              onMin(String(rango.q1));
              onMax(String(rango.q3));
            }}
            style={atajoBtnStyle}
          >
            IQR (Q1 – Q3)
          </button>
          <button
            type="button"
            onClick={() => {
              onMin(String(rango.min));
              onMax(String(rango.max));
            }}
            style={atajoBtnStyle}
          >
            Todo el rango
          </button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="pulso-primary"
          onClick={onConfirm}
          disabled={min === "" && max === ""}
          style={{ fontSize: 12, padding: "6px 14px", opacity: min === "" && max === "" ? 0.55 : 1 }}
        >
          Aplicar rango
        </button>
      </div>
    </div>
  );
}

const atajoBtnStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: "4px 8px",
  borderRadius: 4,
  border: "1px solid var(--pulso-border)",
  background: "white",
  color: "var(--pulso-text-soft)",
  cursor: "pointer",
};
