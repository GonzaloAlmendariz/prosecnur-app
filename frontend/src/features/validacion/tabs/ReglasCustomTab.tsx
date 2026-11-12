import { useCallback, useEffect, useMemo, useState } from "react";
import { codigoDeError, esEstadoInicial, vacioSinDatos } from "../estadoEsperado";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Pencil,
  PieChart,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import {
  apiV2ReglasCustomCreate,
  apiV2ReglasCustomDelete,
  apiV2ReglasCustomEjecutar,
  apiV2ReglasCustomList,
  apiV2ReglasCustomSemillas,
  apiV2ReglasCustomUpdate,
} from "../../../api/client";
import { apiAuditar } from "../../../api/validacionAuditoria";
import type {
  ExploradorVariable,
  ExploradorVariablesList,
  ReglaCustom,
  ReglaSemilla,
  ReglasCustomList,
} from "../types";
import { useValidacionStore } from "../store";
import { pedirInventario } from "../inventarioDeBase";
import { searchDePestana, usePestanaValidacion } from "../pestanaDireccionable";
import { useLocation, useNavigate } from "react-router-dom";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { JobProgress } from "../../../components/JobProgress";
import { PanelRegla, type AlGuardarRegla } from "../reglas/panel/PanelRegla";
import { FOCO_NUEVA, searchConPanelRegla, searchSinPanelRegla, usePanelRegla } from "../reglas/panel/usePanelRegla";
import { preguntasDelCatalogo, useCatalogoDeReglas } from "../reglas/panel/useCatalogoDeReglas";
import { esAliasDelDetalleDeRegla } from "../pestanaValidacion";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import { comoCuerpoDelCliente, comoReglaPropia } from "../reglas/tiposDelMotor";
import SemillasPanel from "../components/SemillasPanel";
import { RuleNarrative } from "../components/v2";
import type { VariableHoverData } from "../components/v2";
import { customRuleToRule } from "../customRuleNarrative";
import { formatoConteo } from "../../../lib/formatoNumero";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { VacioListo } from "../components/VacioListo";
import { Panel } from "../../../components/Panel";

// =============================================================================
// ReglasCustomTab — Sprint 4
// =============================================================================
// Lista de reglas custom con toggle activa, editar, eliminar y botón
// "Ejecutar reglas activas" que corre un job async. El resultado queda
// guardado como `evaluacion` en el scope: el usuario puede ir a Hallazgos
// para ver KPIs / heatmap con las reglas custom mezcladas.
//
// Rebanada V2 del plan de fidelidad: crear y editar ya no abren el asistente
// en línea, sino el panel de regla por la dirección (`panel=regla&foco=nueva`
// o `foco=<id>`). Es un puente hasta que V1 rehaga Reglas con su catálogo.
// "Guardar y auditar" guarda, lanza la auditoría y, al terminar, lleva a
// Hallazgos.

export default function ReglasCustomTab() {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const bumpVersion = useValidacionStore((s) => s.bumpVersion);
  const { irAPestana } = usePestanaValidacion();
  const panel = usePanelRegla();
  const location = useLocation();
  const navigate = useNavigate();
  const setPrefill = useValidacionStore((s) => s.setPrefill);

  const [list, setList] = useState<ReglasCustomList | null>(null);
  const [inv, setInv] = useState<ExploradorVariablesList | null>(null);
  const [semillas, setSemillas] = useState<ReglaSemilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  // El CODIGO ademas del mensaje: `E_NO_DATA_INST` es "todavia no hay base", un
  // estado esperado, y sin el codigo no se puede distinguir de una averia.
  const [errorCode, setErrorCode] = useState<string>("");
  const [jobId, setJobId] = useState<string | null>(null);
  // La auditoría lanzada desde "Guardar y auditar": al terminar, lleva a Hallazgos.
  const [auditoriaDelPanel, setAuditoriaDelPanel] = useState(false);
  const [runSummary, setRunSummary] = useState<{ total: number | null; nCustom: number | null } | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    setErrorCode("");
    try {
      const [l, i, sem] = await Promise.all([
        apiV2ReglasCustomList(baseNombre),
        // Sin respuestas el inventario responde 409 `E_NO_DATA_INST`: es un
        // estado, no una avería, y las reglas propias igual se pueden armar
        // (el panel toma las preguntas del catálogo de reglas).
        pedirInventario(baseNombre).catch((e: unknown) => {
          if (esEstadoInicial(codigoDeError(e))) return null;
          throw e;
        }),
        // El sembrado es una ayuda, no un requisito: si falla, la pestaña
        // sigue funcionando sin propuestas.
        apiV2ReglasCustomSemillas(baseNombre).catch(() => null),
      ]);
      setList(l);
      setInv(i);
      setSemillas(sem?.semillas ?? []);
      if (!i) setErrorCode("E_NO_DATA_INST");
    } catch (e) {
      setError((e as Error).message);
      setErrorCode(codigoDeError(e));
    } finally {
      setLoading(false);
    }
  }, [baseNombre]);

  useEffect(() => {
    void refetch();
    setJobId(null);
  }, [refetch, version]);

  // IMPORTANTE: este useMemo va arriba de los early returns. Si vive
  // después de `if (loading) return ...` los hooks se llaman
  // condicionalmente entre renders → React #310 ("Rendered more hooks
  // than during the previous render") y la app se cae con pantalla
  // gris al cambiar `loading` de true a false.
  const flatVars: VarWithSection[] = useMemo(() => {
    if (!inv) return [];
    const out: VarWithSection[] = [];
    for (const sec of inv.secciones) {
      for (const v of sec.variables) out.push({ ...v, seccion: sec.nombre });
    }
    return out;
  }, [inv]);

  // Sin respuestas, las preguntas salen del catálogo de reglas (M3).
  const catalogo = useCatalogoDeReglas(panel.abierto && !loading && !inv, baseNombre);

  // El enlace viejo al detalle de una regla (`pestana=instrumento&panel=regla&foco=<id>`):
  // si el foco es una regla propia, se abre en el panel con la dirección limpia.
  // Si es una regla del formulario, la dirección sigue como está: su ficha es de V1.
  const direccion = useDireccion();
  const focoDelAlias = esAliasDelDetalleDeRegla(direccion?.pestana, direccion?.panel) ? direccion?.foco ?? null : null;
  useEffect(() => {
    if (!focoDelAlias || !list?.reglas.some((r) => r.id === focoDelAlias)) return;
    navigate({ pathname: location.pathname, search: searchConPanelRegla(location.search, focoDelAlias) }, { replace: true });
  }, [focoDelAlias, list, location.pathname, location.search, navigate]);

  const handleSubmit: AlGuardarRegla = async (cuerpo, { auditar }) => {
    const payload = comoCuerpoDelCliente(cuerpo);
    setBusy("Guardando regla…");
    setRunSummary(null);
    try {
      if (payload.id) {
        await apiV2ReglasCustomUpdate(payload.id, payload, baseNombre);
      } else {
        await apiV2ReglasCustomCreate(payload, baseNombre);
      }
      if (auditar) {
        const out = await apiAuditar(baseNombre);
        setAuditoriaDelPanel(true);
        setJobId(out.job_id);
      }
      panel.cerrar();
      await refetch();
    } finally {
      setBusy("");
    }
  };

  async function handleAdoptar(s: ReglaSemilla) {
    setRunSummary(null);
    try {
      await apiV2ReglasCustomCreate(s, baseNombre);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleToggle(r: ReglaCustom) {
    setBusy(r.activa ? "Quitando de la ejecución…" : "Incluyendo en la ejecución…");
    setRunSummary(null);
    try {
      await apiV2ReglasCustomUpdate(r.id, { activa: !r.activa }, baseNombre);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function handleDelete(r: ReglaCustom) {
    if (!window.confirm(`¿Eliminar la regla "${r.nombre}"? No se puede deshacer.`)) return;
    setBusy("Eliminando…");
    setRunSummary(null);
    try {
      await apiV2ReglasCustomDelete(r.id, baseNombre);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function handleEjecutar() {
    setBusy("Lanzando ejecución…");
    setError("");
    setRunSummary(null);
    try {
      const out = await apiV2ReglasCustomEjecutar(baseNombre);
      setJobId(out.job_id);
      setRunSummary({ total: null, nCustom: out.n_custom ?? nActivas });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  // El panel de regla: nueva (`foco=nueva`) o la regla del foco. Cerrado no
  // pinta nada ni pide nada.
  // Se arma antes de los estados de carga y de "sin respuestas": el panel se
  // abre también ahí (variante "vacía" del prototipo).
  const reglasDelPanel = list?.reglas ?? [];
  const enEdicion = panel.abierto && panel.foco && panel.foco !== FOCO_NUEVA
    ? reglasDelPanel.find((r) => r.id === panel.foco) ?? null
    : null;
  const variablesDelPanel = inv ? flatVars : preguntasDelCatalogo(catalogo);
  const panelDeRegla = (
    <PanelRegla
      abierto={panel.abierto}
      onCerrar={panel.cerrar}
      inicial={enEdicion ? comoReglaPropia(enEdicion) : null}
      focoInexistente={!loading && list && panel.abierto && panel.foco && panel.foco !== FOCO_NUEVA && !enEdicion ? panel.foco : null}
      cargandoPreguntas={loading}
      tipoElegido={panel.tipo}
      pregunta={panel.pregunta}
      onElegirTipo={panel.elegirTipo}
      variables={variablesDelPanel}
      baseNombre={baseNombre}
      semillas={semillas}
      onGuardar={handleSubmit}
      onVerEnExplorar={(variable) => {
        // A Explorar sin el panel ni lo que solo él usa (`tipo`, `pregunta`).
        setPrefill("explorar", { var: variable });
        navigate({ pathname: location.pathname, search: searchDePestana(searchSinPanelRegla(location.search), "explorar") });
      }}
      panelProps={panel.props}
      onVerSinEvaluar={() =>
        navigate({
          pathname: location.pathname,
          search: searchDePestana(searchSinPanelRegla(location.search), "reglas", { familia: "sin-evaluar" }),
        })
      }
    />
  );

  // Montada dentro de Reglas (rebanada V2 de P6), junto al plan del formulario:
  // mientras carga, la carga de bloque del kit impide que la pestaña se dé por lista.
  if (loading) return <><CargaDeBloque label="Cargando reglas propias" />{panelDeRegla}</>;
  // **Tres cosas distintas que caian en el mismo cartel de averia.**
  //
  // La condicion era `!list || !inv` con el mensaje del error o "Estado
  // desconocido", y mezclaba: (1) el proyecto aun no tiene base —el estado
  // NORMAL de un estudio recien creado, que el backend responde como 409
  // `E_NO_DATA_INST`—, (2) una averia de verdad, y (3) un caso que no deberia
  // ocurrir. Medido en pantalla el 2026-08-23 sobre un proyecto sin cargar:
  // "No se pudo cargar · No hay data o instrumento cargado para esta base. ·
  // E_NO_DATA_INST", con el codigo tecnico a la vista.
  if (esEstadoInicial(errorCode)) {
    return (
      <>
        <VacioListo marca="validacion-reglas">
          <EmptyState
            icon={<AlertTriangle size={20} />}
            {...vacioSinDatos("para revisar")}
            cta={
              <button type="button" className="pulso-primary pulso-criterios-accion" onClick={() => panel.abrirNueva()}>
                <Plus size={12} /> Nuevo criterio
              </button>
            }
          />
        </VacioListo>
        {panelDeRegla}
      </>
    );
  }
  if (!list || !inv) {
    return (
      <>
        <VacioListo marca="validacion-reglas">
          <EmptyState
            icon={<AlertTriangle size={20} />}
            title="No se pudo cargar"
            hint={error || "Estado desconocido."}
          />
        </VacioListo>
        {panelDeRegla}
      </>
    );
  }

  const reglas = list.reglas;
  const nActivas = reglas.filter((r) => r.activa).length;
  // (flatVars se calcula arriba, antes de los early returns, para
  // mantener el orden de hooks estable entre renders.)

  const panelContent = (
    <>
      {/* Header + acciones */}
      <Panel
        className="pulso-criterios-toolbar"
        aria-labelledby="pulso-criterios-titulo"
        title={
          <span id="pulso-criterios-titulo">
            {formatoConteo(reglas.length)} criterio{reglas.length === 1 ? "" : "s"} de revisión
            {nActivas !== reglas.length && (
              <span className="pulso-criterios-activas">
                ({formatoConteo(nActivas)} se ejecuta{nActivas === 1 ? "" : "n"})
              </span>
            )}
          </span>
        }
        hint="Configura señales adicionales sobre la base y envía los registros detectados a Hallazgos."
        actions={
          <>
            <button
              type="button"
              onClick={() => panel.abrirNueva()}
              className="pulso-primary pulso-criterios-accion"
              disabled={!!busy || !!jobId}
            >
              <Plus size={12} /> Nuevo criterio
            </button>
            <button
              type="button"
              className="pulso-secondary pulso-criterios-accion"
              onClick={() => void handleEjecutar()}
              disabled={!!busy || !!jobId || nActivas === 0}
              title={nActivas === 0 ? "No hay criterios incluidos para ejecutar" : undefined}
            >
              <Play size={12} /> Ejecutar{nActivas > 0 ? ` (${formatoConteo(nActivas)})` : ""}
            </button>
          </>
        }
      >
        {null}
      </Panel>

      <SemillasPanel
        semillas={semillas}
        onAdoptar={handleAdoptar}
        disabled={!!busy || !!jobId}
      />

      {jobId && (
        <JobProgress
          label={auditoriaDelPanel ? "Auditando la base" : "Ejecutando criterios de revisión"}
          jobId={jobId}
          onDone={(data: { total_inconsistencias?: number | null }) => {
            setJobId(null);
            if (auditoriaDelPanel) {
              setAuditoriaDelPanel(false);
              bumpVersion();
              irAPestana("hallazgos", { source: "reglas_custom", at: Date.now() });
              return;
            }
            setRunSummary({
              total: typeof data?.total_inconsistencias === "number" ? data.total_inconsistencias : null,
              nCustom: runSummary?.nCustom ?? nActivas,
            });
            bumpVersion();
            void refetch();
          }}
          onError={(msg) => { setError(msg); setJobId(null); setAuditoriaDelPanel(false); }}
          onCancelled={() => { setJobId(null); setAuditoriaDelPanel(false); }}
        />
      )}

      {runSummary && !jobId && (
        <div className="pulso-criterios-run-summary">
          <div>
            <strong>Criterios ejecutados.</strong>
            <span>
              {runSummary.total == null
                ? "La revisión terminó y actualizó los hallazgos disponibles."
                : `${runSummary.total} hallazgo${runSummary.total === 1 ? "" : "s"} disponible${runSummary.total === 1 ? "" : "s"} para revisar en Hallazgos.`}
            </span>
          </div>
          <button
            type="button"
            className="pulso-secondary pulso-criterios-summary-action"
            onClick={() => irAPestana("hallazgos", { source: "reglas_custom", at: Date.now() })}
          >
            Ver en Hallazgos <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Lista */}
      {reglas.length === 0 && (
        <EstadoVacio
          tamano="normal"
          icono={<PieChart size={20} />}
          titulo="Sin criterios de revisión todavía"
          descripcion="Crea señales para duración corta, coherencias de campo, duplicados operativos o patrones de selección múltiple."
        />
      )}

      {reglas.length > 0 && (
        <div
          className="pulso-criterios-list"
          // C1: cada regla es una fila de alto propio (su frase ocupa una o más líneas).
          data-qa-geometry-group="validacion/reglas-propias"
          data-qa-geometry-contract="intrinsic"
        >
          {reglas.map((r) => (
            <ReglaRow
              key={r.id}
              regla={r}
              flatVars={flatVars}
              onToggle={() => handleToggle(r)}
              onEdit={() => panel.abrirRegla(r.id)}
              onDelete={() => handleDelete(r)}
              busy={!!busy}
            />
          ))}
        </div>
      )}

      {busy && <LoadingBlock variant="inline" label={busy} />}
      {error && <ErrorBlock label="Error" detail={error} />}
    </>
  );

  const rootClassName = "pulso-criterios-tab";
  if (error) {
    return <div className={rootClassName}>{panelContent}{panelDeRegla}</div>;
  }

  return (
    <div className={rootClassName} data-audit-ready="validacion-reglas">
      {panelContent}
      {panelDeRegla}
    </div>
  );
}

// Inventario de una variable con la sección de origen añadida.
type VarWithSection = ExploradorVariable & { seccion: string };

// =============================================================================
// Row — RuleNarrative compact + chip con id + acciones a la derecha.
// Las reglas inactivas se ven atenuadas (opacidad + surface distinto) pero
// mantienen el narrative legible.
// =============================================================================
function ReglaRow({
  regla,
  flatVars,
  onToggle,
  onEdit,
  onDelete,
  busy,
}: {
  regla: ReglaCustom;
  flatVars: VarWithSection[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const rule = useMemo(() => customRuleToRule(regla), [regla]);
  const hoverLookup = useMemo(
    () => buildVarHoverLookup(flatVars),
    [flatVars],
  );
  const labelLookup = useMemo(
    () => (v: string) => flatVars.find((x) => x.name === v)?.label ?? null,
    [flatVars],
  );

  return (
    <div className={`pulso-criterio-row${regla.activa ? " is-included" : " is-omitted"}`}>
      {/* Narrativa ocupa todo lo que pueda */}
      <div className="pulso-criterio-main">
        <RuleNarrative
          rule={rule}
          variant="compact"
          variableHoverLookup={hoverLookup}
          labelLookup={labelLookup}
          // Hovercards desactivados en la lista: con muchas reglas, los
          // portals + listeners de scroll se acumulaban y crasheaban la
          // app. El detalle por variable se ve en el editor (preview
          // narrativo) cuando se hace click en "Editar".
          disableVariableHover
        />
        <div className="pulso-criterio-treatment">
          <span>Tratamiento</span>
          <strong>{plannedActionLabel(plannedActionValue(regla))}</strong>
          <em>{plannedScopeLabel(regla.recommended_scope, regla)}</em>
        </div>
      </div>

      {/* Columna lateral: id chip arriba + acciones abajo */}
      <div className="pulso-criterio-side">
        <div className={`pulso-criterio-state${regla.activa ? " is-active" : " is-muted"}`}>
          <span className="pulso-criterio-state-icon">
            {regla.activa ? <CheckCircle2 size={14} /> : <CircleOff size={14} />}
          </span>
          <span className="pulso-criterio-state-copy">
            <strong>{regla.activa ? "Se ejecuta" : "No se ejecuta"}</strong>
            <small>{regla.activa ? "Incluido al ejecutar" : "Omitido por ahora"}</small>
          </span>
          {regla.origen === "sembrado" && (
            <span
              className="pulso-criterio-origen"
              title={regla.semilla?.porque ?? "Criterio sugerido por la app y adoptado desde el panel de sugerencias"}
            >
              Sugerido
              {/* `title` no llega a un lector de pantalla ni al teclado; el
                  origen del criterio se dice en texto. */}
              <span className="pulso-sr-only">
                : criterio sugerido por la app y adoptado desde el panel de sugerencias
              </span>
            </span>
          )}
          <span className="pulso-criterio-id">{regla.id}</span>
        </div>
        <div className="pulso-criterio-actions">
          <RowActionButton
            onClick={onToggle}
            disabled={busy}
            icon={regla.activa ? <CircleOff size={14} /> : <CheckCircle2 size={14} />}
            label={regla.activa ? "Omitir de ejecución" : "Incluir en ejecución"}
            title={regla.activa ? "No ejecutar este criterio" : "Incluir al ejecutar"}
            tone={regla.activa ? "neutral" : "primary"}
          />
          <RowActionButton onClick={onEdit} disabled={busy} icon={<Pencil size={14} />} label="Editar" title="Editar criterio" />
          <RowActionButton onClick={onDelete} disabled={busy} icon={<Trash2 size={14} />} label="Eliminar" title="Eliminar criterio" tone="danger" />
        </div>
      </div>
    </div>
  );
}

// Hover lookup genérico desde el inventario — label + sección.
function buildVarHoverLookup(
  flatVars: VarWithSection[],
): (varName: string) => VariableHoverData | undefined {
  const byName = new Map<string, VarWithSection>();
  for (const v of flatVars) byName.set(v.name, v);
  return (varName: string): VariableHoverData | undefined => {
    if (!varName) return undefined;
    const v = byName.get(varName);
    if (!v) return undefined;
    return {
      label: v.label ?? null,
      seccion: v.seccion ?? null,
    };
  };
}

function RowActionButton({
  onClick,
  disabled,
  icon,
  label,
  title,
  tone = "neutral",
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  title: string;
  tone?: "neutral" | "primary" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`pulso-criterio-action is-${tone}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function plannedActionLabel(value: ReglaCustom["planned_action_type"]) {
  switch (value) {
    case "replace_value":
      return "Corregir valor";
    case "set_value":
      return "Asignar valor";
    case "recode_map":
      return "Recodificar";
    case "complete_select_multiple_hierarchy":
      return "Completar selección";
    case "adjust_select_multiple":
      return "Ajustar selección";
    case "nullify_fields":
      return "Anular campos";
    case "exclude_cases":
      return "Excluir registros";
    case "ignore_rule":
    default:
      return "Registrar";
  }
}

function plannedActionValue(regla: ReglaCustom): ReglaCustom["planned_action_type"] {
  if (regla.planned_action_type) return regla.planned_action_type;
  switch (regla.tipo) {
    case "select_multiple_hierarchy":
      return "complete_select_multiple_hierarchy";
    case "select_multiple_exclusive":
    case "select_multiple_cardinality":
    case "select_multiple_selection":
      return "adjust_select_multiple";
    case "duplicados":
      return "exclude_cases";
    case "fuera_catalogo":
      return "recode_map";
    case "no_nulo":
      return "set_value";
    default:
      return "ignore_rule";
  }
}

function plannedScopeLabel(value: ReglaCustom["recommended_scope"], regla?: ReglaCustom) {
  const resolved = value ?? defaultScopeForRule(regla);
  switch (resolved) {
    case "all":
      return "todos";
    case "selected":
      return "selección";
    case "single":
      return "uno por uno";
    default:
      return "definible en Limpieza";
  }
}

function defaultScopeForRule(regla?: ReglaCustom): ReglaCustom["recommended_scope"] {
  switch (regla?.tipo) {
    case "select_multiple_hierarchy":
    case "fuera_catalogo":
      return "all";
    case "select_multiple_exclusive":
    case "select_multiple_cardinality":
    case "select_multiple_selection":
    case "duplicados":
    case "no_nulo":
      return "selected";
    case "rango_num":
    case "rango_fecha":
    case "coherencia_2v":
      return "single";
    default:
      return undefined;
  }
}
