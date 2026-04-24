import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Compass,
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
import CrossBar from "../components/CrossBar";

// =============================================================================
// ExplorarTab — Sprint 3
// =============================================================================
// Layout 2 columnas:
//   - Left (280px): VariablePicker con buscador + secciones plegables.
//   - Right (flex): vista de la variable seleccionada — KPIs + chart
//     univariado. Debajo, cruce opcional con segunda variable (bivariado).
//
// El deep-link desde Limpieza (prefill.explorar.var) se consume al montar.

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

  // Keyboard shortcuts: ← / → iteran variables mientras no haya foco en
  // un input/textarea (para no pisar la edición de filtros).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
      }
      if (event.key === "ArrowLeft" && prevVar) {
        event.preventDefault();
        setSelected(prevVar);
      } else if (event.key === "ArrowRight" && nextVar) {
        event.preventDefault();
        setSelected(nextVar);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevVar, nextVar]);

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
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5, marginBottom: 10 }}>
          Este explorador muestra solo <strong>Selección única</strong>, <strong>Selección múltiple</strong> y <strong>numéricas</strong>.
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
            {/* Header unificado: nav ← →, datos de la variable, cruce co-ubicado */}
            <VariableHeader
              uni={uni}
              currentIdx={currentIdx}
              totalVars={flatVars.length}
              onPrev={prevVar ? () => setSelected(prevVar) : undefined}
              onNext={nextVar ? () => setSelected(nextVar) : undefined}
              prevName={prevVar?.name ?? null}
              nextName={nextVar?.name ?? null}
            />

            {/* Barra de cruce: siempre visible, arriba de los charts. */}
            <CrossBar
              secciones={inv.secciones}
              selfVar={selected.name}
              selfSeccion={findSeccionOf(selected.name, inv)}
              cruzar={cruzar}
              onChange={setCruzar}
            />

            {/* KPIs a todo el ancho (no se parten con el cruce). */}
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

            {/* Chart principal: cuando hay cruce activo, el biv REEMPLAZA al
                univariado (no se muestran lado a lado — la comparación en
                sí contiene la distribución marginal). Cuando no hay cruce,
                se ve el univariado a todo el ancho. */}
            {cruzar && biv ? (
              <ChartPanel
                title={`${selected.name} × ${cruzar}`}
                tone="cross"
              >
                <PlotlyView view={biv.view} />
              </ChartPanel>
            ) : (
              <ChartPanel
                title={`Distribución de ${selected.name}`}
                tone="self"
              >
                <PlotlyView view={uni.chart} />
                {uni.chart.kind === "table" &&
                  uni.chart.samples &&
                  uni.chart.samples.length > 0 && (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 11,
                        color: "var(--pulso-text-soft)",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        Muestra de respuestas
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
                        {uni.chart.samples.slice(0, 12).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </ChartPanel>
            )}
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
// VariableHeader — título + tipo + label + navegación ← → + contador
// -----------------------------------------------------------------------------
function VariableHeader({
  uni,
  currentIdx,
  totalVars,
  onPrev,
  onNext,
  prevName,
  nextName,
}: {
  uni: ExplorarUnivariadoResult;
  currentIdx: number;
  totalVars: number;
  onPrev: (() => void) | undefined;
  onNext: (() => void) | undefined;
  prevName: string | null;
  nextName: string | null;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "14px 18px",
        borderRadius: 10,
        background: "var(--pulso-primary-soft)",
        border: "1px solid var(--pulso-primary-border)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "var(--pulso-primary)",
              padding: "2px 8px",
              borderRadius: 999,
              background: "white",
              border: "1px solid var(--pulso-primary-border)",
            }}
          >
            {uni.tipo.toUpperCase()}
          </span>
          <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 16, fontWeight: 700, color: "var(--pulso-text)" }}>
            {uni.var}
          </code>
        </div>
        {uni.label && uni.label !== uni.var && (
          <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
            {uni.label}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontFamily: "ui-monospace, monospace" }}>
          {currentIdx + 1} / {totalVars}
          {uni.filtros_aplicados > 0 && (
            <span style={{ marginLeft: 8, color: "var(--pulso-primary)", fontWeight: 700 }}>
              · {uni.n_tras_filtro} / {uni.n_total} tras filtros
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={onPrev}
            disabled={!onPrev}
            title={prevName ? `Anterior: ${prevName} (←)` : "Ya estás en la primera variable"}
            style={navBtnStyle(!!onPrev)}
          >
            <ChevronLeft size={12} />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!onNext}
            title={nextName ? `Siguiente: ${nextName} (→)` : "Ya estás en la última variable"}
            style={navBtnStyle(!!onNext)}
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </header>
  );
}

function navBtnStyle(enabled: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    padding: 0,
    border: "1px solid var(--pulso-primary-border)",
    background: "white",
    color: "var(--pulso-primary)",
    borderRadius: 6,
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.4,
  } as const;
}

// -----------------------------------------------------------------------------
// ChartPanel — wrapper unificado para charts: borde sutil + título + tono
// "self" (variable principal) o "cross" (bivariado).
// -----------------------------------------------------------------------------
function ChartPanel({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "self" | "cross";
  children: React.ReactNode;
}) {
  const isCross = tone === "cross";
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "14px 16px 16px",
        borderRadius: 12,
        background: "white",
        border: `1px solid ${isCross ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
        boxShadow: "var(--pulso-shadow-low)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: isCross ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
        }}
      >
        {isCross ? "Cruce" : "Distribución"}
        <span style={{ color: "var(--pulso-text-soft)", fontWeight: 600, textTransform: "none", letterSpacing: 0, fontFamily: "ui-monospace, monospace" }}>
          {title}
        </span>
      </div>
      {children}
    </section>
  );
}

// Busca la sección donde vive una variable — para alimentar las sugerencias
// del CrossBar.
function findSeccionOf(
  varName: string,
  inv: ExploradorVariablesList,
): string | null {
  for (const sec of inv.secciones) {
    if (sec.variables.some((v) => v.name === varName)) return sec.nombre;
  }
  return null;
}
