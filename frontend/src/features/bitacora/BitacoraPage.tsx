import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PARAMS_DIRECCION } from "../../lib/navegacion/direccion";
import {
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  apiBitacoraState,
  apiPlanTrabajoState,
  type DisenoEstudioBitacoraEntry,
  type PlanTrabajoState,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
import { PageFrame } from "../../components/PageFrame";
import { ChromeIndicator, ChromeIndicatorGroup } from "../../components/ChromeIndicator";
import { ModuleCommandBar } from "../../components/ModuleCommandBar";
import { SectionPillbar } from "../../components/SectionPillbar";
import {
  moduleChromeVars,
  PROSECNUR_MODULES,
  type ProsecnurModuleSectionMeta,
} from "../../lib/modules";
import { LogbookSection } from "./LogbookSection";
import { CronogramaSection } from "./CronogramaSection";
import { Calendar } from "./Calendar";
import { CanvasSection } from "./canvas/CanvasSection";
import { PanelImportar } from "./portabilidad/PanelImportar";
import { descargarMapaDelEstudio } from "./portabilidad/descargar";
import { apiBitacoraEstado, type BitacoraEstado } from "../../api/bitacora";
import { PANEL_IMPORTAR } from "../../lib/navegacion/manifiesto";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import "./bitacora.css";

type Tab = "bitacora" | "cronograma" | "calendario" | "canvas";

const BITACORA_MODULE =
  PROSECNUR_MODULES.find((module) => module.slug === "diseno-estudio") ?? PROSECNUR_MODULES[0];

type BitacoraSection = ProsecnurModuleSectionMeta & { id: Tab };

function isBitacoraSection(section: ProsecnurModuleSectionMeta): section is BitacoraSection {
  return (
    section.id === "bitacora" ||
    section.id === "cronograma" ||
    section.id === "calendario" ||
    section.id === "canvas"
  );
}

const BITACORA_SECTIONS = BITACORA_MODULE.sections.filter(isBitacoraSection);

// Bitácora llamaba `tab` a lo que la gramática canónica llama SECCIÓN: sus
// tres destinos son el recorrido del módulo, no pestañas dentro de uno.
// Contrato: `lib/navegacion/direccion.ts`.
function seccionFromSearch(search: string): Tab {
  const params = new URLSearchParams(search);
  const value = params.get(PARAMS_DIRECCION.seccion) ?? params.get("tab");
  if (value === "cronograma" || value === "calendario" || value === "canvas") return value;
  return "bitacora";
}

export default function BitacoraPage() {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => seccionFromSearch(location.search));
  const [plan, setPlan] = useState<PlanTrabajoState | null>(null);
  const [bitacoraEstado, setBitacoraEstado] = useState<BitacoraEstado | null>(null);
  const [entries, setEntries] = useState<DisenoEstudioBitacoraEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const panelImportar = usePanelDireccionable(PANEL_IMPORTAR);

  useEffect(() => {
    setTab(seccionFromSearch(location.search));
  }, [location.search]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [planState, bitacora, consolidado] = await Promise.all([
        apiPlanTrabajoState(),
        apiBitacoraState(),
        apiBitacoraEstado(),
      ]);
      setPlan(planState);
      setEntries(bitacora.bitacora);
      setBitacoraEstado(consolidado);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la bitácora.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function reloadPlan() {
    try {
      setPlan(await apiPlanTrabajoState());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el cronograma.");
    }
  }

  if (loading && !plan) {
    return <LoadingBlock label="Abriendo bitácora..." />;
  }

  return (
    <PageFrame
      auditReady={!loading && !error ? `bitacora-${tab}` : false}
      title="Bitácora"
      headerMode="sr-only"
      layout="workbench"
      bodyMode="fill"
      scrollOwner="panels"
      className="bitacora-frame"
    >
      <div className="bitacora-shell" style={moduleChromeVars(BITACORA_MODULE)}>
        {/* La banda propia de Bitácora pasa al chrome compartido: era su propio
            grid de tres zonas, con el pillbar llevando un ícono por sección y la
            zona de contexto repitiendo el nombre del módulo, que la homepage ya
            dice. En su lugar va el dato que sí se consulta desde acá. */}
        <ModuleCommandBar
          modulo="diseno-estudio"
          ariaLabel="Acciones de la bitácora"
          className="bitacora-commandbar"
          contexto={
            <ChromeIndicatorGroup ariaLabel="Contexto de la bitácora">
              <ChromeIndicator
                label="Entradas"
                value={entries.length ? String(entries.length) : "sin entradas"}
                prioridad="alta"
              />
            </ChromeIndicatorGroup>
          }
          secciones={
            <SectionPillbar
              modulo="diseno-estudio"
              ariaLabel="Secciones de la bitácora"
              seccionActiva={tab}
              items={BITACORA_SECTIONS.map((item) => ({
                id: item.id,
                label: item.label,
                href: item.to,
              }))}
            />
          }
          acciones={[
            {
              id: "actualizar",
              label: "Actualizar",
              rank: 1,
              onSelect: load,
              disabled: loading,
              busy: loading,
            },
            {
              id: "exportar",
              label: "Exportar mapa",
              rank: 3,
              onSelect: () => void descargarMapaDelEstudio(),
            },
            {
              id: "importar",
              label: "Importar mapa",
              rank: 3,
              onSelect: panelImportar.abrir,
            },
          ]}
        />

        {error && <Alert kind="error">{error}</Alert>}

        <div className="bitacora-body">
          {tab === "bitacora" && <LogbookSection entries={entries} onChange={setEntries} />}
          {tab === "cronograma" && plan && (
            <CronogramaSection state={plan} onChange={setPlan} onReload={reloadPlan} />
          )}
          {tab === "calendario" && plan && (
            <Calendar state={plan} onChange={setPlan} />
          )}
          {tab === "canvas" && bitacoraEstado && (
            <CanvasSection estado={bitacoraEstado} onEstado={setBitacoraEstado} />
          )}
        </div>
      </div>

      {panelImportar.abierto && (
        <div {...panelImportar.props}>
          <PanelImportar
            onImportado={(estado) => {
              // El import toca las tres colecciones a la vez. Lo que el panel
              // devuelve rehidrata el estado del lienzo y las entradas; el plan
              // se recarga porque `PlanTrabajoState` trae readiness y sync
              // derivados que el payload consolidado no incluye.
              setBitacoraEstado(estado);
              setEntries(estado.bitacora);
              void reloadPlan();
            }}
            onCerrar={panelImportar.cerrar}
          />
        </div>
      )}
    </PageFrame>
  );
}
