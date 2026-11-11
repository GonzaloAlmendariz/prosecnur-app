import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Compass, Database } from "../../vendor/lucide-react";
import { apiEstudioGet, EstudioPayload } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { repeatContextFromBase } from "../../lib/rosterExplorer";
import { Alert } from "../../components/Alert";
import { PageFrame } from "../../components/PageFrame";
import { ChromeSlotPortal } from "../../app/ModuleChromeSlots";
import { ChromeBaseSelector } from "../../components/ChromeBaseSelector";
import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { EmptyState, ErrorBlock } from "../../components/States";
import { ContextTabRail } from "../../components/ContextTabRail";
import { PROCESAMIENTO_PESTANAS } from "../../lib/navegacion/catalogos/procesamiento";
import PestanaExplorar from "./pestanas/PestanaExplorar";
import PestanaReglas from "./pestanas/PestanaReglas";
import PestanaHallazgos from "./pestanas/PestanaHallazgos";
import PestanaCierre from "./pestanas/PestanaCierre";
import { useValidacionStore } from "./store";
import { usePestanaValidacion } from "./pestanaDireccionable";
import type { ValidacionTabId } from "./types";
import "./validacion-v2.css";
import "./pestanas/marcoDePestanas.css";

// =============================================================================
// Validación (shell)
// =============================================================================
// Antes de avanzar a Codificación, acá se revisa que la data cumple lo que el
// formulario promete, se definen reglas propias, se decide cada hallazgo y se
// cierra la base.
//
// Estructura (ADR 0142, rebanada V2 de P6):
//   - PageFrame compacto con scroll interno.
//   - Selector de base común de Procesamiento (`ChromeBaseSelector`) en la
//     zona de contexto de la banda; solo se ve con dos bases o más.
//   - Riel con cuatro pestañas: Explorar, Reglas, Hallazgos y Cierre. Cada una
//     vive en `./pestanas/*` y por ahora monta las piezas de V1 sin rehacerlas.
//   - Cada pestaña monta su cabecera (`pestanas/CabeceraDeTransicion`, plan de
//     fidelidad, rebanada V0): la página ya no la pinta.
//
// Estado "pesado" (plan, evaluación, reglas custom) vive en el backend
// scoped por base. Acá sólo manejamos la base vía zustand (ver ./store.ts);
// la pestaña la dice la URL (ver ./pestanaDireccionable.ts).

const TABS = PROCESAMIENTO_PESTANAS.validacion;

export default function ValidacionPage() {
  const { sessionId, state } = useSession();
  // La pestaña activa es la que dice la URL (`?pestana=`), no un estado del
  // store: toda vista es enlazable — ver ./pestanaDireccionable.ts.
  const { pestana: activeTab, irAPestana } = usePestanaValidacion();
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const setBaseNombre = useValidacionStore((s) => s.setBaseNombre);
  const version = useValidacionStore((s) => s.version);
  const resetForSession = useValidacionStore((s) => s.resetForSession);

  const [estudio, setEstudio] = useState<EstudioPayload | null>(null);
  const [loadError, setLoadError] = useState<string>("");
  const lastSessionRef = useRef(sessionId);
  const basesSignature = useMemo(
    () => `${state?.session_id ?? sessionId}|${state?.n_bases ?? 0}|${state?.active_base ?? ""}|${(state?.bases_nombres ?? []).join("|")}`,
    [sessionId, state?.session_id, state?.n_bases, state?.active_base, state?.bases_nombres],
  );

  useEffect(() => {
    if (!sessionId || lastSessionRef.current === sessionId) return;
    lastSessionRef.current = sessionId;
    setEstudio(null);
    setLoadError("");
    resetForSession();
  }, [sessionId, resetForSession]);

  // Cargar el estudio para poblar el BaseSelector (si multi-base).
  useEffect(() => {
    let cancel = false;
    setEstudio(null);
    setLoadError("");
    apiEstudioGet()
      .then((p) => {
        if (cancel) return;
        setEstudio(p);
        const activeFromBackend = p.active_base || state?.active_base || null;
        // Si todavía no hay base seleccionada y el estudio tiene bases,
        // preseleccionamos la activa del backend o la primera.
        if (!baseNombre && p.n_bases > 0) {
          const first = activeFromBackend || Object.keys(p.bases)[0];
          if (first) setBaseNombre(first);
        }
        // Caso borde: base guardada en store ya no existe en el estudio
        // (puede pasar tras quitar una base en Fase 1).
        if (baseNombre && !p.bases[baseNombre]) {
          const first = activeFromBackend || Object.keys(p.bases)[0] || null;
          setBaseNombre(first);
        } else if (activeFromBackend && activeFromBackend !== baseNombre && p.bases[activeFromBackend]) {
          setBaseNombre(activeFromBackend);
        }
      })
      .catch((e) => {
        if (!cancel) setLoadError((e as Error).message);
      });
    return () => {
      cancel = true;
    };
  }, [baseNombre, setBaseNombre, basesSignature, state?.active_base]);

  const prereqsOk = !!state?.xlsform && !!state?.data;
  const independentSiblings = estudio?.processing_mode === "independent_siblings" || state?.estudio_processing_mode === "independent_siblings";
  const showBaseSelector = prereqsOk && !!estudio && estudio.n_bases > 1 && !independentSiblings;
  const selectedBase = baseNombre && estudio?.bases ? estudio.bases[baseNombre] : null;
  // Con bases hermanas independientes no hay selector común (cada base se
  // procesa por su cuenta): el nombre de la base activa va en la zona de
  // contexto, donde el prototipo pone la base. Con una sola base no se repite.
  const baseSinSelector = prereqsOk && !!estudio && estudio.n_bases > 1 && independentSiblings && !!selectedBase;
  const displayBaseName = selectedBase?.source_alias || selectedBase?.source_title || baseNombre || "";
  const activePanelScope = { activeTab, baseNombre, version } as const;

  // El selector común cambia la base por la API y avisa con
  // `pulso:active-base-changed`; aquí solo se mueve la base del store, que
  // remonta la pestaña activa con la base nueva.
  useEffect(() => {
    const alCambiar = (evento: Event) => {
      const activa = (evento as CustomEvent<{ active?: unknown }>).detail?.active;
      if (typeof activa !== "string" || !activa) return;
      if (activa !== useValidacionStore.getState().baseNombre) setBaseNombre(activa);
    };
    window.addEventListener("pulso:active-base-changed", alCambiar);
    return () => window.removeEventListener("pulso:active-base-changed", alCambiar);
  }, [setBaseNombre]);

  return (
    <PageFrame
      title="Validación"
      lead="Explora las respuestas, valida contra el formulario, afina criterios y cierra la limpieza."
      className="pulso-validacion-frame"
      density="compact"
      headerMode="sr-only"
      bodyMode="fill"
      layout="workbench"
      scrollOwner="panels"
      resetScrollKey={`${activeTab}:${baseNombre ?? ""}`}
      notices={
        <>
          {!prereqsOk && (
            <Alert kind="warn">
              <strong>Faltan insumos.</strong>{" "}
              Para revisar consistencias necesitas un formulario y respuestas cargadas en la Fase 1.
            </Alert>
          )}

          {loadError && <ErrorBlock label="No se pudo cargar el estudio" detail={loadError} />}
        </>
      }
    >
      {/* El contexto de la página sube a la banda del shell en vez de dibujar una
          segunda banda debajo. Antes eran dos: la del shell con el rail de
          secciones y esta, con el resumen y el selector de base. */}
      {/* Sin chips de estado en la banda: "Insumos" y "Lista para auditar" repiten
          lo que el rail de secciones ya marca como completado. Queda el selector de
          base, que sí se opera. */}
      <ChromeSlotPortal zona="contexto">
        {showBaseSelector && <ChromeBaseSelector />}
        {baseSinSelector && (
          <span className="pulso-validacion-base-current" title="Base activa">
            <Database size={12} aria-hidden="true" />
            {displayBaseName}
          </span>
        )}
      </ChromeSlotPortal>

      <AdaptiveSplitView
        ariaLabel="Mesa de trabajo de validación"
        railLabel="Pestañas de validación"
        className={`pulso-validacion-shell pulso-context-tab-layout${!prereqsOk ? " is-empty" : ""}`}
        rail={(
          <ValidacionModeSidebar
            active={activeTab}
            onChange={(tab) => irAPestana(tab)}
            disabled={!prereqsOk}
          />
        )}
      >
        <main
          key={`${activePanelScope.activeTab}:${activePanelScope.baseNombre ?? ""}:${activePanelScope.version}`}
          id="validacion-panel"
          className="pulso-validacion-content pulso-content-area"
          role="tabpanel"
          aria-labelledby={`validacion-tab-${activeTab}`}
          data-audit-ready={!prereqsOk && estudio !== null && !loadError ? `validacion-${activeTab}` : undefined}
        >
          {!prereqsOk ? (
            <EmptyState
              icon={<Compass size={18} />}
              title="Carga insumos para validar"
              hint="La validación se habilita cuando la sesión tiene un formulario y respuestas cargadas."
              cta={<Link className="pulso-empty-cta" to="/carga">Ir a Carga</Link>}
            />
          ) : (
            // La cabecera la monta cada pestaña (rebanada V0 del plan de fidelidad).
            <div className="pulso-validacion-panel-body">
              {activeTab === "explorar" && <PestanaExplorar repeat={repeatContextFromBase(selectedBase)} />}
              {activeTab === "reglas" && <PestanaReglas />}
              {activeTab === "hallazgos" && <PestanaHallazgos />}
              {activeTab === "cierre" && <PestanaCierre />}
            </div>
          )}
        </main>
      </AdaptiveSplitView>
    </PageFrame>
  );
}



function ValidacionModeSidebar({
  active,
  onChange,
  disabled,
}: {
  active: ValidacionTabId;
  onChange: (tab: ValidacionTabId) => void;
  disabled: boolean;
}) {
  return (
    <ContextTabRail
      ariaLabel="Pestañas de validación"
      activeKey={active}
      items={TABS}
      panelId="validacion-panel"
      tabId={(key) => `validacion-tab-${key}`}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
