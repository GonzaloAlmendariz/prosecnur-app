import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Compass,
  X as XIcon,
} from "lucide-react";
import {
  apiV2ExplorarBivariado,
  apiV2ExplorarUnivariado,
  apiV2ExplorarVariables,
  type ExplorarBivariadoResult,
  type ExplorarFiltros,
  type ExplorarUnivariadoResult,
} from "../../../api/client";
import type { ExploradorVariable, ExploradorVariablesList } from "../types";
import { useValidacionStore } from "../store";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import PlotlyView from "../components/PlotlyView";
import VariablePicker from "../components/VariablePicker";
import FiltroCascada from "../components/FiltroCascada";

// =============================================================================
// ExplorarTab — Sprint 3
// =============================================================================
// Layout 2 columnas:
//   - Left (280px): VariablePicker con buscador + secciones plegables.
//   - Right (flex): vista de la variable seleccionada — KPIs + chart
//     univariado. Debajo, cruce opcional con segunda variable (bivariado).
//
// El deep-link desde Panorama (prefill.explorar.var) se consume al montar.

const SIDEBAR_WIDTH = 300;

export default function ExplorarTab() {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const prefill = useValidacionStore((s) => s.prefill.explorar);
  const clearPrefill = useValidacionStore((s) => s.clearPrefill);

  const [inv, setInv] = useState<ExploradorVariablesList | null>(null);
  const [selected, setSelected] = useState<ExploradorVariable | null>(null);
  const [uni, setUni] = useState<ExplorarUnivariadoResult | null>(null);
  const [cruzar, setCruzar] = useState<string | null>(null);
  const [biv, setBiv] = useState<ExplorarBivariadoResult | null>(null);
  const [filtros, setFiltros] = useState<ExplorarFiltros>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Lista plana de variables (orden del inventario) — usada para iterar
  // con ←/→.
  const flatVars = useMemo<ExploradorVariable[]>(() => {
    if (!inv) return [];
    return inv.secciones.flatMap((s) => s.variables);
  }, [inv]);

  const currentIdx = useMemo(() => {
    if (!selected) return -1;
    return flatVars.findIndex((v) => v.name === selected.name);
  }, [flatVars, selected]);

  const prevVar = currentIdx > 0 ? flatVars[currentIdx - 1] : null;
  const nextVar = currentIdx >= 0 && currentIdx < flatVars.length - 1 ? flatVars[currentIdx + 1] : null;

  // Inventario al montar / cambiar base.
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setSelected(null);
    setUni(null);
    setCruzar(null);
    setBiv(null);
    setFiltros({});
    apiV2ExplorarVariables(baseNombre)
      .then((i) => {
        if (!cancel) setInv(i);
      })
      .catch((e) => {
        if (!cancel) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [baseNombre, version]);

  // Consumir prefill deep-link: abre la variable indicada al cargar.
  useEffect(() => {
    if (!inv || !prefill?.var) return;
    const found = inv.secciones
      .flatMap((s) => s.variables)
      .find((v) => v.name === prefill.var);
    if (found) {
      setSelected(found);
      if (prefill.cruzar_con) setCruzar(prefill.cruzar_con);
    }
    clearPrefill("explorar");
  }, [inv, prefill, clearPrefill]);

  // Cargar univariado al seleccionar variable o cambiar filtros.
  useEffect(() => {
    if (!selected) return;
    let cancel = false;
    setBusy(`Cargando ${selected.name}…`);
    setError("");
    setUni(null);
    apiV2ExplorarUnivariado(selected.name, baseNombre, filtros)
      .then((u) => {
        if (!cancel) setUni(u);
      })
      .catch((e) => {
        if (!cancel) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancel) setBusy("");
      });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, baseNombre, JSON.stringify(filtros)]);

  // Cargar bivariado cuando el usuario elige "cruzar con" (o cambian filtros).
  useEffect(() => {
    if (!selected || !cruzar) {
      setBiv(null);
      return;
    }
    let cancel = false;
    setBusy(`Cruzando ${selected.name} × ${cruzar}…`);
    apiV2ExplorarBivariado(selected.name, cruzar, baseNombre, filtros)
      .then((b) => {
        if (!cancel) setBiv(b);
      })
      .catch((e) => {
        if (!cancel) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancel) setBusy("");
      });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, cruzar, baseNombre, JSON.stringify(filtros)]);

  const onPickVariable = useCallback((v: ExploradorVariable) => {
    setSelected(v);
    setCruzar(null);
  }, []);

  if (loading) return <LoadingBlock label="Inventariando variables…" />;
  if (error && !inv) {
    return (
      <EmptyState
        icon={<AlertTriangle size={20} />}
        title="No se pudo cargar el explorador"
        hint={error}
      />
    );
  }
  if (!inv || inv.n_variables === 0) {
    return (
      <EmptyState
        icon={<Compass size={20} />}
        title="Sin variables para explorar"
        hint="La base no tiene columnas reconocibles. Revisa la carga en la Fase 1."
      />
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${SIDEBAR_WIDTH}px 1fr`,
        gap: 20,
        alignItems: "start",
      }}
    >
      {/* --- Sidebar: picker --------------------------------------------- */}
      <aside
        style={{
          background: "white",
          border: "1px solid var(--pulso-border)",
          borderRadius: 10,
          padding: 14,
          boxShadow: "var(--pulso-shadow-low)",
          position: "sticky",
          top: 16,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>
          Variables · {inv.n_variables}
        </div>
        <VariablePicker
          secciones={inv.secciones}
          selectedVar={selected?.name ?? null}
          onSelect={onPickVariable}
        />
      </aside>

      {/* --- Vista principal ---------------------------------------------- */}
      <main style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        {/* Filtros cascada (siempre visibles arriba cuando hay inventario) */}
        <FiltroCascada
          secciones={inv.secciones}
          filtros={filtros}
          onChange={setFiltros}
          baseNombre={baseNombre}
        />

        {!selected && (
          <EmptyState
            icon={<Compass size={20} />}
            title="Elige una variable"
            hint="Selecciona una variable del panel izquierdo para ver su distribución, resumen y cruces."
          />
        )}

        {selected && uni && (
          <>
            {/* Controles de iteración */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "6px 2px",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontFamily: "ui-monospace, monospace" }}>
                Variable {currentIdx + 1} / {flatVars.length}
                {uni.filtros_aplicados > 0 && (
                  <span style={{ marginLeft: 10, color: "var(--pulso-primary)", fontWeight: 600 }}>
                    · {uni.n_tras_filtro} / {uni.n_total} casos tras filtros
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => prevVar && setSelected(prevVar)}
                  disabled={!prevVar}
                  title={prevVar ? `Anterior: ${prevVar.name}` : "Ya estás en la primera variable"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    padding: "5px 10px",
                    border: "1px solid var(--pulso-border)",
                    background: "white",
                    borderRadius: 6,
                    cursor: prevVar ? "pointer" : "not-allowed",
                    opacity: prevVar ? 1 : 0.45,
                  }}
                >
                  <ChevronLeft size={11} /> Anterior
                </button>
                <button
                  type="button"
                  onClick={() => nextVar && setSelected(nextVar)}
                  disabled={!nextVar}
                  title={nextVar ? `Siguiente: ${nextVar.name}` : "Ya estás en la última variable"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    padding: "5px 10px",
                    border: "1px solid var(--pulso-border)",
                    background: "white",
                    borderRadius: 6,
                    cursor: nextVar ? "pointer" : "not-allowed",
                    opacity: nextVar ? 1 : 0.45,
                  }}
                >
                  Siguiente <ChevronRight size={11} />
                </button>
              </div>
            </div>

            {/* Header de la variable */}
            <header
              style={{
                padding: "14px 18px",
                borderRadius: 10,
                background: "var(--pulso-primary-soft)",
                border: "1px solid var(--pulso-primary-border)",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-primary)" }}>
                Variable · {uni.tipo.toUpperCase()}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--pulso-text)", marginTop: 2 }}>
                <code style={{ fontFamily: "ui-monospace, monospace" }}>{uni.var}</code>
              </div>
              {uni.label && uni.label !== uni.var && (
                <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", marginTop: 4, lineHeight: 1.4 }}>
                  {uni.label}
                </div>
              )}
            </header>

            {/* KPIs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {uni.kpis.map((k, i) => (
                <PlotlyView key={i} view={k} />
              ))}
            </div>

            {/* Chart principal */}
            <PlotlyView view={uni.chart} />

            {/* Samples de texto, si aplica */}
            {uni.chart.kind === "table" && uni.chart.samples && uni.chart.samples.length > 0 && (
              <section
                style={{
                  padding: "14px 18px",
                  borderRadius: 10,
                  background: "white",
                  border: "1px solid var(--pulso-border)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                  Muestra de respuestas
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.5, color: "var(--pulso-text)" }}>
                  {uni.chart.samples.slice(0, 20).map((s, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {s}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Cruzar con otra variable */}
            <CruceControl
              inv={inv}
              selfVar={selected.name}
              cruzar={cruzar}
              onChange={setCruzar}
            />

            {biv && <PlotlyView view={biv.view} />}
          </>
        )}

        {busy && (
          <div style={{ marginTop: 4 }}>
            <LoadingBlock variant="inline" label={busy} />
          </div>
        )}
        {error && <ErrorBlock label="Error" detail={error} />}
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------------
function CruceControl({
  inv,
  selfVar,
  cruzar,
  onChange,
}: {
  inv: ExploradorVariablesList;
  selfVar: string;
  cruzar: string | null;
  onChange: (v: string | null) => void;
}) {
  // Soportamos cruces cuando la variable base es SO; la otra puede ser
  // SO, SM o NUM. Si la base es SM/NUM, aún no soportamos.
  const all = inv.secciones
    .flatMap((s) => s.variables)
    .filter((v) => v.name !== selfVar)
    .filter((v) => v.tipo === "so" || v.tipo === "sm" || v.tipo === "num");

  return (
    <section
      style={{
        padding: "12px 16px",
        borderRadius: 10,
        background: "var(--pulso-surface-2)",
        border: "1px dashed var(--pulso-border)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: "var(--pulso-text-soft)",
        }}
      >
        Cruzar con
      </label>
      <select
        value={cruzar ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        style={{
          fontSize: 12,
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid var(--pulso-border)",
          background: "white",
          minWidth: 240,
        }}
      >
        <option value="">— Ninguna —</option>
        {all.map((v) => (
          <option key={v.name} value={v.name}>
            {v.name} {v.label && v.label !== v.name ? `· ${v.label}` : ""}
          </option>
        ))}
      </select>
      {cruzar && (
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid var(--pulso-border)",
            background: "white",
            cursor: "pointer",
          }}
        >
          <XIcon size={11} /> Quitar cruce
        </button>
      )}
      <span
        style={{
          fontSize: 10,
          color: "var(--pulso-text-soft)",
          lineHeight: 1.4,
          marginLeft: 6,
        }}
      >
        SO × SO (barras apiladas) · SO × SM (comparación por opción) · SO × NUM (boxplot)
      </span>
    </section>
  );
}
