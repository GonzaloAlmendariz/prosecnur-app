import { useEffect, useState } from "react";
import { Filter, Plus, X as XIcon } from "lucide-react";
import {
  apiV2ExplorarValores,
  type ExplorarValoresResult,
  type ExplorarFiltros,
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

  const candidatas = secciones
    .flatMap((s) => s.variables.map((v) => ({ ...v, seccion: s.nombre })))
    .filter((v) => v.tipo === "so" || v.tipo === "sm")
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
          const vals = filtros[vname];
          // Label humano del variable si existe.
          const found = secciones.flatMap((s) => s.variables).find((v) => v.name === vname);
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
              <span>{vals.length} {vals.length === 1 ? "valor" : "valores"}</span>
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
  onCancel,
}: {
  candidatas: (ExploradorVariable & { seccion: string })[];
  selectedVar: string | null;
  onSelectVar: (v: string | null) => void;
  valores: ExplorarValoresResult | null;
  loading: boolean;
  onConfirm: (values: string[]) => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Reset checked al cambiar de variable.
  useEffect(() => {
    setChecked(new Set());
  }, [selectedVar]);

  function toggleVal(code: string) {
    setChecked((s) => {
      const copy = new Set(s);
      if (copy.has(code)) copy.delete(code);
      else copy.add(code);
      return copy;
    });
  }

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

      {!loading && valores && valores.opciones.length > 0 && (
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

      {!loading && valores && valores.opciones.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
          Esta variable no tiene opciones disponibles.
        </div>
      )}
    </div>
  );
}
