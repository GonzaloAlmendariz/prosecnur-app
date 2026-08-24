import { useCallback, useEffect, useMemo, useState } from "react";
import { codigoDeError, esEstadoInicial, vacioSinDatos } from "../estadoEsperado";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Compass,
  ListChecks,
  Loader2,
  Search,
  SlidersHorizontal,
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
import { RepeatGrainNote } from "../../../components/RepeatGrainNote";
import {
  buildExplorerGrain,
  scopeRepeatSections,
  withRepeatIdentityFilter,
  type ProcessingSheetRepeatContext,
} from "../../../lib/rosterExplorer";
import PlotlyView from "../components/PlotlyView";
import VariablePicker from "../components/VariablePicker";
import FiltroCascada from "../components/FiltroCascada";
import CrossBar from "../components/CrossBar";
import RepeatDimensionBar from "../components/RepeatDimensionBar";

// =============================================================================
// ExplorarTab — Sprint 3
// =============================================================================
// Layout 2 columnas:
//   - Left (280px): VariablePicker con buscador + secciones plegables.
//   - Right (flex): vista de la variable seleccionada — KPIs + chart
//     univariado. Debajo, cruce opcional con segunda variable (bivariado).
//
// El deep-link desde Limpieza (prefill.explorar.var) se consume al montar.

export default function ExplorarTab({
  repeat = null,
}: {
  /** Contexto relacional cuando la base explorada es una hija repeat (Fase 5). */
  repeat?: ProcessingSheetRepeatContext | null;
}) {
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
  // Corte estructural del repeat. Vive sólo en Explorar y no se mezcla con
  // los chips de filtros manuales.
  const [repeatCode, setRepeatCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [errorCode, setErrorCode] = useState<string>("");
  // Fuente de los datos que se exploran: "raw" = data cargada original;
  // "final" = data ya procesada por Limpieza (decisiones aplicadas).
  const [fuente, setFuente] = useState<ExplorarFuente>("raw");
  // Si la base tiene Limpieza cerrada, habilitamos el modo "final".
  const [hasFinalizedBase, setHasFinalizedBase] = useState<boolean>(false);
  const [finalizedAt, setFinalizedAt] = useState<string | null>(null);

  const repeatContext = inv?.repeat_context ?? null;
  const selectedRepeatOption = repeatCode
    ? repeatContext?.options.find((option) => option.code === repeatCode) ?? null
    : null;
  const selectedRepeatIsEmpty = !!selectedRepeatOption && selectedRepeatOption.n_instancias === 0;

  const scopedSections = useMemo(
    () => scopeRepeatSections(inv?.secciones ?? [], repeatCode),
    [inv, repeatCode],
  );
  const scopedInv = useMemo<ExploradorVariablesList | null>(() => {
    if (!inv) return null;
    return {
      ...inv,
      secciones: scopedSections,
      n_variables: scopedSections.reduce((total, section) => total + section.variables.length, 0),
    };
  }, [inv, scopedSections]);

  const effectiveFiltros = useMemo<ExplorarFiltros>(
    () => withRepeatIdentityFilter(filtros, repeatContext, repeatCode),
    [filtros, repeatContext, repeatCode],
  );

  // Lista plana del contexto activo — gobierna sidebar, navegación y cruces.
  const flatVars = useMemo<ExploradorVariable[]>(() => {
    return scopedSections.flatMap((s) => s.variables);
  }, [scopedSections]);

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
    setRepeatCode(null);
  }, [baseNombre, version]);

  // Si cambia el inventario (p.ej. raw → final) y el código ya no existe,
  // volvemos a Todos en vez de sostener un filtro invisible.
  useEffect(() => {
    if (!repeatCode || !repeatContext) return;
    if (!repeatContext.options.some((option) => option.code === repeatCode)) {
      setRepeatCode(null);
    }
  }, [repeatCode, repeatContext]);

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
    setError("");
    apiV2ExplorarVariables(baseNombre, fuente)
      .then((i) => {
        if (!cancel) setInv(i);
      })
      .catch((e) => {
        if (cancel) return;
        setError((e as Error).message);
        // El CODIGO, no solo el mensaje: hay estados esperados que llegan como
        // error HTTP —«todavia no hay data»— y merecen otra pantalla que una
        // averia. Sin esto, el unico dato disponible era el texto, que ademas
        // arrastra el codigo pegado («… · E_NO_DATA_INST»).
        setErrorCode(codigoDeError(e));
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

  // Si el explorador ya tiene inventario y no viene un deep-link, abrir la
  // primera variable evita que la mesa arranque vacía pese a tener datos.
  useEffect(() => {
    if (!scopedInv || selected || prefill?.var) return;
    const first = pickInitialVariable(scopedInv);
    if (first) setSelected(first);
  }, [scopedInv, selected, prefill?.var]);

  // Al cambiar de servicio, conserva la variable si sigue siendo aplicable y
  // adopta sus conteos segmentados; si no, elige la primera variable útil.
  useEffect(() => {
    if (!scopedInv) return;
    const nextSelected = selected
      ? flatVars.find((variable) => variable.name === selected.name) ?? null
      : null;
    if (selected && !nextSelected) {
      setSelected(pickInitialVariable(scopedInv));
    } else if (selected && nextSelected && nextSelected !== selected) {
      setSelected(nextSelected);
    }
    if (cruzar && !flatVars.some((variable) => variable.name === cruzar)) {
      setCruzar(null);
    }
    const applicableNames = new Set(flatVars.map((variable) => variable.name));
    const nextFiltros = Object.fromEntries(
      Object.entries(filtros).filter(([name]) => applicableNames.has(name)),
    );
    if (Object.keys(nextFiltros).length !== Object.keys(filtros).length) {
      setFiltros(nextFiltros);
    }
  }, [scopedInv, flatVars, selected, cruzar, filtros]);

  // Cargar univariado al seleccionar variable o cambiar filtros.
  useEffect(() => {
    if (!selected || selectedRepeatIsEmpty) {
      setUni(null);
      setBusy("");
      return;
    }
    let cancel = false;
    setBusy(`Cargando ${selected.name}…`);
    setError("");
    setUni(null);
    apiV2ExplorarUnivariado(selected.name, baseNombre, effectiveFiltros, fuente)
      .then((u) => {
        if (!cancel) setUni(u);
      })
      .catch((e) => {
        if (cancel) return;
        // Aqui NO se toca `errorCode`: este error es de una variable concreta
        // que el usuario acaba de pedir, no del estado del proyecto, y marcarlo
        // cambiaria la pantalla entera por un fallo de una sola consulta.
        setError((e as Error).message);
      })
      .finally(() => {
        if (!cancel) setBusy("");
      });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, baseNombre, fuente, selectedRepeatIsEmpty, JSON.stringify(effectiveFiltros)]);

  // Cargar bivariado cuando el usuario elige "cruzar con" (o cambian filtros).
  useEffect(() => {
    if (!selected || !cruzar || selectedRepeatIsEmpty) {
      setBiv(null);
      if (selectedRepeatIsEmpty) setBusy("");
      return;
    }
    let cancel = false;
    // Retira el cruce anterior antes de pedir el nuevo corte; evita mostrar
    // una matriz de otro servicio mientras llega la respuesta actual.
    setBiv(null);
    setBusy(`Cruzando ${selected.name} × ${cruzar}…`);
    apiV2ExplorarBivariado(selected.name, cruzar, baseNombre, effectiveFiltros, fuente)
      .then((b) => {
        if (!cancel) setBiv(b);
      })
      .catch((e) => {
        if (cancel) return;
        setError((e as Error).message);
        // El CODIGO, no solo el mensaje: hay estados esperados que llegan como
        // error HTTP —«todavia no hay data»— y merecen otra pantalla que una
        // averia. Sin esto, el unico dato disponible era el texto, que ademas
        // arrastra el codigo pegado («… · E_NO_DATA_INST»).
        setErrorCode(codigoDeError(e));
      })
      .finally(() => {
        if (!cancel) setBusy("");
      });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, cruzar, baseNombre, fuente, selectedRepeatIsEmpty, JSON.stringify(effectiveFiltros)]);

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

  // Banner de grano cuando la base explorada es una hija repeat: recuerda que
  // los denominadores de las distribuciones son instancias del roster, no
  // personas (varias filas pueden ser de una misma persona).
  const rosterGrain = repeat
    ? buildExplorerGrain({
        grain: repeat.grain,
        nInstancias: repeat.nInstancias,
        nPersonas: repeat.grain?.n_personas ?? null,
        repeatGroup: repeat.repeatGroup,
        parentBase: repeat.parentBase,
      })
    : null;

  if (loading) return <ExplorarLoadingPanel />;
  // **«Todavia no hay data» no es «no se pudo cargar».**
  //
  // El backend responde 409 `E_NO_DATA_INST` cuando el proyecto aun no tiene
  // base ni instrumento para esta pestaña, que es el estado NORMAL de un
  // estudio recien abierto. Caia en la rama de averia: visto en pantalla el
  // 2026-08-23 sobre un proyecto sin cargar, «No se pudo cargar el explorador ·
  // No hay data o instrumento cargado para esta base. · E_NO_DATA_INST».
  //
  // Tres cosas mal a la vez: el titulo dice que algo fallo, el texto ensena un
  // codigo tecnico, y ninguno dice donde se resuelve. Un vacio esperado que
  // parece una averia hace que la gente busque el problema donde no esta.
  if (esEstadoInicial(errorCode) && !inv) {
    return <EmptyState icon={<Compass size={20} />} {...vacioSinDatos("que explorar")} />;
  }
  if (error && !inv) {
    return (
      <EmptyState
        icon={<AlertTriangle size={20} />}
        title="No se pudo cargar el explorador"
        hint={error}
      />
    );
  }
  if (!inv) {
    return (
      <EmptyState
        icon={<Compass size={20} />}
        title="Sin preguntas o campos para explorar"
        hint="La base no tiene columnas reconocibles. Revisa la carga en la Fase 1."
      />
    );
  }
  if (inv.n_variables === 0) {
    return (
      <div data-audit-ready="validacion-explorar" style={{ display: "contents" }}>
        <EmptyState
          icon={<Compass size={20} />}
          title="Sin preguntas o campos para explorar"
          hint="La base no tiene columnas reconocibles. Revisa la carga en la Fase 1."
        />
      </div>
    );
  }

  const panelContent = (
    <>
      {/* --- Sidebar: picker --------------------------------------------- */}
      <aside className="pulso-validacion-explorar-sidebar">
        <div className="pulso-validacion-explorar-picker-head">
          <div>
            <span>{selectedRepeatOption ? `Preguntas para ${selectedRepeatOption.label}` : "Preguntas y campos"}</span>
            <strong>{scopedInv?.n_variables ?? inv.n_variables}</strong>
          </div>
          <p>{selectedRepeatOption ? `${selectedRepeatOption.n_instancias.toLocaleString("es-PE")} instancias` : "Única · Múltiple · Numérica · Abierta"}</p>
        </div>
        <VariablePicker
          secciones={scopedSections}
          selectedVar={selected?.name ?? null}
          onSelect={onPickVariable}
          repeatCode={repeatCode}
          repeatLabel={selectedRepeatOption?.label ?? null}
        />
      </aside>

      {/* --- Vista principal ---------------------------------------------- */}
      <main className="pulso-validacion-explorar-main">
        {rosterGrain && (
          <RepeatGrainNote grain={rosterGrain} className="pulso-validacion-explorar-repeat" />
        )}

        {repeatContext && repeatContext.options.length > 0 && (
          <RepeatDimensionBar
            context={repeatContext}
            selectedCode={repeatCode}
            onChange={setRepeatCode}
          />
        )}

        {/* Toggle de momento: respuestas cargadas vs versión final tras Limpieza. */}
        <FuenteToggle
          fuente={fuente}
          onChange={setFuente}
          hasFinal={hasFinalizedBase}
          finalizedAt={finalizedAt}
        />

        {/* Filtros cascada (siempre visibles arriba cuando hay inventario) */}
        <FiltroCascada
          secciones={scopedSections}
          filtros={filtros}
          onChange={setFiltros}
          baseNombre={baseNombre}
        />

        {selectedRepeatIsEmpty ? (
          <EmptyState
            icon={<Compass size={20} />}
            title={`Sin respuestas para ${selectedRepeatOption?.label ?? "este servicio"}`}
            hint="El servicio está declarado en el formulario, pero esta base no contiene instancias para analizar."
          />
        ) : !selected && (
          <EmptyState
            icon={<Compass size={20} />}
            title="Elige una pregunta o campo"
            hint="Selecciona un elemento del panel izquierdo para ver su distribución, resumen y cruces."
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
              repeatLabel={selectedRepeatOption?.label ?? null}
              repeatInstances={selectedRepeatOption?.n_instancias ?? null}
            />

            {/* Barra de cruce: siempre visible, arriba de los charts. */}
            <CrossBar
              secciones={scopedSections}
              selfVar={selected.name}
              selfSeccion={scopedInv ? findSeccionOf(selected.name, scopedInv) : null}
              cruzar={cruzar}
              onChange={setCruzar}
            />

            {/* KPIs a todo el ancho (no se parten con el cruce). */}
            <div
              className="pulso-validacion-kpi-grid"
              data-qa-geometry-group="validacion/explorar-kpis"
              data-qa-geometry-contract="equal"
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
                title={`${selected.name} × ${cruzar}${selectedRepeatOption ? ` · ${selectedRepeatOption.label}` : ""}`}
                tone="cross"
              >
                <PlotlyView view={biv.view} />
              </ChartPanel>
            ) : (
              <ChartPanel
                title={`Distribución de ${selected.name}${selectedRepeatOption ? ` · ${selectedRepeatOption.label}` : ""}`}
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
    </>
  );

  const scopedInventoryEmpty = (scopedInv?.n_variables ?? inv.n_variables) === 0;
  const primaryResultPending =
    !scopedInventoryEmpty &&
    (
      !selected ||
      (!selectedRepeatIsEmpty && (!uni || uni.var !== selected.name)) ||
      (!!cruzar && !biv)
    );

  if (busy || error || primaryResultPending) {
    return <div className="pulso-validacion-explorar-layout">{panelContent}</div>;
  }

  return (
    <div
      className="pulso-validacion-explorar-layout"
      data-audit-ready="validacion-explorar"
    >
      {panelContent}
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
// FuenteToggle — selector de momento de revisión
// -----------------------------------------------------------------------------
// Segmentado de 2 posiciones. El botón "Después de limpieza" queda deshabilitado
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
        Momento
      </span>
      <div
        role="group"
        aria-label="Momento de respuestas del explorador"
        className="pulso-vv2-segmented"
      >
        <FuenteButton
          label="Antes de limpieza"
          hint="Respuestas tal como se cargaron. Útil para detectar errores."
          active={fuente === "raw"}
          disabled={false}
          onClick={() => onChange("raw")}
        />
        <FuenteButton
          label="Después de limpieza"
          hint={
            hasFinal
              ? "Respuestas tras aplicar todas las decisiones de Limpieza."
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
          Hay una versión posterior a limpieza disponible.
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
      className={`pulso-vv2-seg-btn${active ? " is-active" : ""}`}
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
  repeatLabel,
  repeatInstances,
}: {
  uni: ExplorarUnivariadoResult;
  currentIdx: number;
  totalVars: number;
  onPrev: (() => void) | undefined;
  onNext: (() => void) | undefined;
  prevName: string | null;
  nextName: string | null;
  repeatLabel: string | null;
  repeatInstances: number | null;
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
          {repeatLabel && (
            <span className="pulso-repeat-variable-context">
              Servicio · {repeatLabel}
              {repeatInstances != null && ` · ${repeatInstances.toLocaleString("es-PE")} instancias`}
            </span>
          )}
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
            className="pulso-vv2-iconbtn"
            style={navBtnStyle(!!onPrev)}
          >
            <ChevronLeft size={12} />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!onNext}
            title={nextName ? `Siguiente: ${nextName} (→)` : "Ya estás en la última variable"}
            className="pulso-vv2-iconbtn"
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

function ExplorarLoadingPanel() {
  const steps = [
    { label: "Preguntas y campos", hint: "Ordenando secciones del formulario", icon: ListChecks },
    { label: "Distribuciones", hint: "Preparando lectura inicial", icon: Compass },
    { label: "Filtros", hint: "Detectando cortes disponibles", icon: SlidersHorizontal },
  ];

  return (
    <section className="pulso-validacion-explorar-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="pulso-validacion-explorar-loading-head">
        <span className="pulso-validacion-explorar-loading-icon" aria-hidden="true">
          <Loader2 size={20} className="pulso-spin" />
        </span>
        <div>
          <span className="pulso-section-eyebrow">Explorador de respuestas</span>
          <h3>Inventariando variables</h3>
          <p>Estamos organizando preguntas, campos y cortes para abrir la primera vista de revisión.</p>
        </div>
      </div>

      <div className="pulso-validacion-explorar-loading-steps" aria-label="Tareas en preparación">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div className="pulso-validacion-explorar-loading-step" key={step.label}>
              <span aria-hidden="true"><Icon size={15} /></span>
              <strong>{step.label}</strong>
              <small>{step.hint}</small>
            </div>
          );
        })}
      </div>

      <div className="pulso-validacion-explorar-loading-body" aria-hidden="true">
        <aside className="pulso-validacion-explorar-loading-sidebar">
          <div className="pulso-validacion-explorar-loading-search">
            <Search size={14} />
            <i />
          </div>
          {[0, 1, 2, 3, 4].map((row) => (
            <div className="pulso-validacion-explorar-loading-row" key={row}>
              <span />
              <i />
            </div>
          ))}
        </aside>
        <main className="pulso-validacion-explorar-loading-preview">
          <div className="pulso-validacion-explorar-loading-line is-title" />
          <div className="pulso-validacion-explorar-loading-metrics">
            <i />
            <i />
            <i />
          </div>
          <div className="pulso-validacion-explorar-loading-chart">
            {[0, 1, 2, 3, 4].map((bar) => (
              <span key={bar} style={{ width: `${92 - bar * 12}%` }} />
            ))}
          </div>
        </main>
      </div>
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

function pickInitialVariable(inv: ExploradorVariablesList): ExploradorVariable | null {
  const variables = inv.secciones.flatMap((section) => section.variables);
  if (!variables.length) return null;
  const usefulTypes = new Set<ExploradorVariable["tipo"]>(["so", "sm", "num", "fecha"]);
  const isOperational = (variable: ExploradorVariable) => {
    const name = variable.name.toLowerCase();
    const label = variable.label.toLowerCase();
    return (
      /^(collector|source|survey|response|respondent|case|date|email|first|last|ip|phone|form|campaign|campania|device)/.test(name) ||
      /(^|_)(id|uuid|enumerador|enumerator|respondent|response)(_|$)/.test(name) ||
      /(^|_)(ip|email|correo|mail|first_name|last_name|nombre|apellido|phone|telefono|collector|source|campaign|campania|form|formulario|device|date|time)(_|$)/.test(name) ||
      /id de respuesta|direcci[oó]n ip|correo|email|nombre|apellido|tel[eé]fono|enumerador|respondente|recopilador|fuente|campa[ñn]a|formulario|dispositivo|fecha|hora/.test(label)
    );
  };
  return (
    variables.find((variable) => usefulTypes.has(variable.tipo) && !isOperational(variable)) ??
    variables.find((variable) => !isOperational(variable)) ??
    variables[0]
  );
}
