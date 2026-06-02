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
  apiV2Limpieza,
  type ExplorarBivariadoResult,
  type ExplorarFiltros,
  type ExplorarFuente,
  type ExplorarTextResponseRow,
  type ExplorarUnivariadoResult,
} from "../../../api/client";
import type { ViewDescriptor } from "../types";
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
  // Fuente de los datos que se exploran: "raw" = data cargada original;
  // "final" = data ya procesada por Limpieza (decisiones aplicadas).
  const [fuente, setFuente] = useState<ExplorarFuente>("raw");
  // Si la base tiene Limpieza cerrada, habilitamos el modo "final".
  const [hasFinalizedBase, setHasFinalizedBase] = useState<boolean>(false);
  const [finalizedAt, setFinalizedAt] = useState<string | null>(null);

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

  // Al cambiar de base, reseteamos el modo fuente a "raw".
  useEffect(() => {
    setFuente("raw");
    setSelected(null);
    setUni(null);
    setCruzar(null);
    setBiv(null);
    setFiltros({});
  }, [baseNombre, version]);

  // Chequear si hay base final (Limpieza finalizada) para habilitar el
  // toggle "Data final".
  useEffect(() => {
    let cancel = false;
    apiV2Limpieza(baseNombre)
      .then((l) => {
        if (cancel) return;
        const at = l.artifacts?.finalized_at ?? null;
        setFinalizedAt(at);
        setHasFinalizedBase(!!at);
      })
      .catch(() => {
        if (!cancel) {
          setHasFinalizedBase(false);
          setFinalizedAt(null);
        }
      });
    return () => { cancel = true; };
  }, [baseNombre, version]);

  // Inventario al montar / cambiar base o fuente.
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    apiV2ExplorarVariables(baseNombre, fuente)
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
  }, [baseNombre, version, fuente]);

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
    apiV2ExplorarUnivariado(selected.name, baseNombre, filtros, fuente)
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
  }, [selected, baseNombre, fuente, JSON.stringify(filtros)]);

  // Cargar bivariado cuando el usuario elige "cruzar con" (o cambian filtros).
  useEffect(() => {
    if (!selected || !cruzar) {
      setBiv(null);
      return;
    }
    let cancel = false;
    setBusy(`Cruzando ${selected.name} × ${cruzar}…`);
    apiV2ExplorarBivariado(selected.name, cruzar, baseNombre, filtros, fuente)
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
  }, [selected, cruzar, baseNombre, fuente, JSON.stringify(filtros)]);

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
    <div className="pulso-validacion-explorar-layout">
      {/* --- Sidebar: picker --------------------------------------------- */}
      <aside className="pulso-validacion-explorar-sidebar">
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>
          Variables · {inv.n_variables}
        </div>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5, marginBottom: 10 }}>
          Este explorador muestra <strong>Selección única</strong>, <strong>Selección múltiple</strong>, <strong>numéricas</strong> y <strong>respuestas abiertas</strong>.
        </div>
        <VariablePicker
          secciones={inv.secciones}
          selectedVar={selected?.name ?? null}
          onSelect={onPickVariable}
        />
      </aside>

      {/* --- Vista principal ---------------------------------------------- */}
      <main className="pulso-validacion-explorar-main">
        {/* Toggle de fuente: data cruda vs final (tras Limpieza). */}
        <FuenteToggle
          fuente={fuente}
          onChange={setFuente}
          hasFinal={hasFinalizedBase}
          finalizedAt={finalizedAt}
        />

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
                {uni.chart.kind === "table" && uni.chart.text_rows ? (
                  <TextResponsesView view={uni.chart} rows={uni.chart.text_rows} />
                ) : (
                  <PlotlyView view={uni.chart} />
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

function TextResponsesView({
  view,
  rows,
}: {
  view: ViewDescriptor;
  rows: ExplorarTextResponseRow[];
}) {
  if (!rows.length) {
    return (
      <div
        style={{
          borderRadius: 14,
          border: "1px dashed var(--pulso-border)",
          background: "var(--pulso-surface-2)",
          padding: "28px 18px",
          textAlign: "center",
          color: "var(--pulso-text-soft)",
          fontSize: 12,
        }}
      >
        No hay respuestas abiertas no vacías para esta variable.
      </div>
    );
  }
  return (
    <article
      style={{
        borderRadius: 14,
        border: "1px solid rgba(216, 224, 239, 0.95)",
        background: "linear-gradient(180deg, rgba(248, 250, 255, 0.92) 0%, #ffffff 100%)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--pulso-border)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--pulso-text)" }}>
            {view.title}
          </div>
          {view.subtitle && (
            <div style={{ marginTop: 2, fontSize: 11, color: "var(--pulso-text-soft)" }}>
              {view.subtitle}
            </div>
          )}
        </div>
        <span
          style={{
            flex: "0 0 auto",
            borderRadius: 999,
            border: "1px solid var(--pulso-border)",
            background: "white",
            color: "var(--pulso-text-soft)",
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 8px",
          }}
        >
          {rows.length} respuesta{rows.length === 1 ? "" : "s"}
        </span>
      </header>
      <div style={{ maxHeight: 360, overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: 12,
          }}
        >
          <thead>
            <tr>
              <TextHead style={{ width: 72 }}>Caso</TextHead>
              <TextHead style={{ width: 170 }}>Respondente</TextHead>
              <TextHead>Respuesta</TextHead>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.row}-${idx}`}>
                <TextCell mono>{row.row}</TextCell>
                <TextCell mono>{row.respondent_id}</TextCell>
                <TextCell>{row.response}</TextCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {typeof view.meta?.note === "string" && view.meta.note.trim() && (
        <div
          style={{
            padding: "9px 14px",
            borderTop: "1px solid var(--pulso-border)",
            color: "var(--pulso-text-soft)",
            fontSize: 11,
          }}
        >
          {view.meta.note}
        </div>
      )}
    </article>
  );
}

function TextHead({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1,
        padding: "8px 10px",
        background: "#eef3ff",
        borderBottom: "1px solid var(--pulso-border)",
        color: "var(--pulso-text-soft)",
        fontSize: 10,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        textAlign: "left",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function TextCell({
  children,
  mono = false,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <td
      style={{
        verticalAlign: "top",
        padding: "9px 10px",
        borderBottom: "1px solid rgba(216, 224, 239, 0.7)",
        color: "var(--pulso-text)",
        lineHeight: 1.45,
        fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
        fontSize: mono ? 11 : 12,
        whiteSpace: mono ? "nowrap" : "pre-wrap",
      }}
    >
      {children}
    </td>
  );
}

// -----------------------------------------------------------------------------
// FuenteToggle — selector "data cruda" vs "data final" (tras Limpieza)
// -----------------------------------------------------------------------------
// Segmentado de 2 posiciones. El botón "Data final" queda deshabilitado
// (con tooltip explicativo) hasta que Limpieza se haya finalizado.
// Cuando está activo, un pequeño hint muestra cuándo se cerró la base.
function FuenteToggle({
  fuente,
  onChange,
  hasFinal,
  finalizedAt,
}: {
  fuente: ExplorarFuente;
  onChange: (f: ExplorarFuente) => void;
  hasFinal: boolean;
  finalizedAt: string | null;
}) {
  const finalizedAtText = (() => {
    if (!finalizedAt) return null;
    try {
      const d = new Date(finalizedAt);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return null;
    }
  })();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        borderRadius: 10,
        background: "white",
        border: "1px solid var(--pulso-border)",
        boxShadow: "var(--pulso-shadow-low)",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: "var(--pulso-text-soft)",
        }}
      >
        Fuente
      </span>
      <div
        role="group"
        aria-label="Fuente de datos del explorador"
        style={{
          display: "inline-flex",
          border: "1px solid var(--pulso-border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <FuenteButton
          label="Data cruda"
          hint="Data tal como se cargó. Útil para detectar errores."
          active={fuente === "raw"}
          disabled={false}
          onClick={() => onChange("raw")}
        />
        <FuenteButton
          label="Data final"
          hint={
            hasFinal
              ? "Data tras aplicar todas las decisiones de Limpieza."
              : "Cierra Limpieza primero para habilitar este modo."
          }
          active={fuente === "final"}
          disabled={!hasFinal}
          onClick={() => hasFinal && onChange("final")}
        />
      </div>
      {fuente === "final" && finalizedAtText && (
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
          Cerrada el {finalizedAtText}
        </span>
      )}
      {fuente === "raw" && hasFinal && (
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
          Hay una versión final disponible.
        </span>
      )}
    </div>
  );
}

function FuenteButton({
  label,
  hint,
  active,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      aria-pressed={active}
      style={{
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: 700,
        border: "none",
        background: active
          ? "var(--pulso-primary-soft)"
          : disabled
          ? "var(--pulso-surface-2)"
          : "white",
        color: active
          ? "var(--pulso-primary)"
          : disabled
          ? "var(--pulso-text-soft)"
          : "var(--pulso-text)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
        transition: "background 120ms ease",
      }}
    >
      {label}
    </button>
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
