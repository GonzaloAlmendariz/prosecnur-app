import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { apiRecopiladoresState, type CollectionArtifactReceipt, type CollectionStatePayload } from "../../api/recopiladores";
import { GlidingTabList } from "../../components/GlidingTabList";
import { ModuleCommandBar } from "../../components/ModuleCommandBar";
import { PageFrame } from "../../components/PageFrame";
import { PROSECNUR_MODULES } from "../../lib/modules";
import { RefreshCw } from "../../vendor/lucide-react";
import { AccessSection } from "./AccessSection";
import { DeliverySection } from "./DeliverySection";
import { MaterialsSection } from "./MaterialsSection";
import { PlanSection } from "./PlanSection";
import {
  PESTANAS_POR_SECCION,
  esDireccionCanonica,
  resolverDireccion,
  type RecopiladoresPestana,
  type RecopiladoresSeccion,
} from "./navegacion";
import "./styles/recopiladores-shell.css";

const MODULE = PROSECNUR_MODULES.find((item) => item.slug === "recopiladores")!;

const SECTION_COPY: Record<RecopiladoresSeccion, { title: string; lead: string }> = {
  "plan-recoleccion": {
    title: "Plan de recolección",
    lead: "Confirma las unidades ya decididas y la revisión local del instrumento.",
  },
  accesos: {
    title: "Accesos",
    lead: "Inspecciona un target existente y prepara accesos sin crear recursos remotos.",
  },
  materiales: {
    title: "Materiales",
    lead: "Edita una receta semántica y renderiza con el compilador autoritativo del backend.",
  },
  "entrega-campo": {
    title: "Entrega a campo",
    lead: "Cierra el deployment con un recibo idempotente para Monitoreo.",
  },
};

function searchFor(
  current: string,
  section: RecopiladoresSeccion,
  tab: RecopiladoresPestana,
) {
  const params = new URLSearchParams(current);
  params.set("seccion", section);
  params.set("pestana", tab);
  return `?${params.toString()}`;
}

export function RecopiladoresShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const direction = resolverDireccion(params.get("seccion"), params.get("pestana"));
  const [payload, setPayload] = useState<CollectionStatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [latestArtifact, setLatestArtifact] = useState<CollectionArtifactReceipt | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPayload(await apiRecopiladoresState());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer Recopiladores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const onSession = () => {
      setPayload(null);
      setLatestArtifact(null);
      void refresh();
    };
    window.addEventListener("pulso:session-changed", onSession);
    return () => window.removeEventListener("pulso:session-changed", onSession);
  }, [refresh]);

  useEffect(() => {
    if (esDireccionCanonica(params.get("seccion"), params.get("pestana"))) return;
    navigate(
      `${location.pathname}${searchFor(location.search, direction.seccion, direction.pestana)}`,
      { replace: true },
    );
  }, [direction.pestana, direction.seccion, location.pathname, location.search, navigate, params]);

  const selectSection = (section: RecopiladoresSeccion) => {
    const tab = PESTANAS_POR_SECCION[section][0] as RecopiladoresPestana;
    navigate(`${location.pathname}${searchFor(location.search, section, tab)}`);
  };
  const selectTab = (tab: RecopiladoresPestana) => {
    navigate(`${location.pathname}${searchFor(location.search, direction.seccion, tab)}`);
  };

  const activeMeta = MODULE.sections.find((section) => section.id === direction.seccion);
  const tabs = activeMeta?.tabs ?? [];
  const copy = SECTION_COPY[direction.seccion];
  const state = payload?.state ?? null;
  const status = state?.deployment?.status ?? (state?.plan ? "sin deployment" : "sin plan");

  const sectionSelector = (
    <GlidingTabList
      className="rec-section-selector"
      activeKey={direction.seccion}
      mode="tabs"
      role="group"
      aria-label="Secciones de Recopiladores"
      onRovingKeyChange={(key) => selectSection(key as RecopiladoresSeccion)}
    >
      {MODULE.sections.map((section) => {
        const active = section.id === direction.seccion;
        const Icon = section.icon;
        return (
          <button
            key={section.id}
            type="button"
            data-gliding-key={section.id}
            aria-pressed={active}
            onClick={() => selectSection(section.id as RecopiladoresSeccion)}
          >
            <Icon size={15} aria-hidden />
            {section.label}
          </button>
        );
      })}
    </GlidingTabList>
  );

  return (
    <PageFrame
      title={copy.title}
      lead={copy.lead}
      layout="workbench"
      scrollOwner="panels"
      bodyMode="fill"
      headerMode="sr-only"
      resetScrollKey={`${direction.seccion}/${direction.pestana}`}
      auditReady={loading ? false : `recopiladores/${direction.seccion}/${direction.pestana}`}
      className="rec-page"
      chrome={(
        <ModuleCommandBar
          modulo="recopiladores"
          contexto={<span className="rec-context">{MODULE.title}</span>}
          secciones={sectionSelector}
          acciones={[{
            id: "refresh",
            label: "Actualizar",
            shortLabel: "Actualizar",
            icon: RefreshCw,
            onSelect: () => { void refresh(); },
            kind: "ghost",
            rank: 2,
            busy: loading,
          }]}
          estado={[{
            id: "deployment-status",
            label: status,
            tone: status === "handed_off" ? "success" : status === "stale" ? "danger" : "neutral",
          }]}
          ariaLabel="Controles de Recopiladores"
        />
      )}
      notices={error ? <div className="rec-notice is-error" role="alert">{error}</div> : null}
    >
      <div className="rec-workbench">
        {tabs.length > 1 ? (
          <GlidingTabList
            className="rec-tab-list"
            activeKey={direction.pestana}
            mode="tabs"
            role="tablist"
            aria-label={`Pestañas de ${copy.title}`}
            onRovingKeyChange={(key) => selectTab(key as RecopiladoresPestana)}
          >
            {tabs.map((tab) => {
              const active = tab.id === direction.pestana;
              return (
                <button
                  key={tab.id}
                  id={`rec-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  data-gliding-key={tab.id}
                  aria-selected={active}
                  aria-controls={active ? "rec-tabpanel" : undefined}
                  tabIndex={active ? 0 : -1}
                  onClick={() => selectTab(tab.id as RecopiladoresPestana)}
                >
                  {tab.label}
                </button>
              );
            })}
          </GlidingTabList>
        ) : null}

        <section
          id="rec-tabpanel"
          className="rec-tab-panel"
          role="tabpanel"
          aria-labelledby={`rec-tab-${direction.pestana}`}
          data-qa-geometry-group={`recopiladores/${direction.seccion}`}
          data-qa-geometry-contract="intrinsic"
        >
          {loading && !state ? (
            <div className="rec-loading" data-qa-geometry-capacity="owned">
              Leyendo el estado del despliegue…
            </div>
          ) : null}
          {!loading && direction.seccion === "plan-recoleccion" ? (
            <PlanSection payload={payload} onState={setPayload} />
          ) : null}
          {!loading && direction.seccion === "accesos" ? (
            <AccessSection payload={payload} activeTab={direction.pestana} onState={setPayload} />
          ) : null}
          {!loading && direction.seccion === "materiales" ? (
            <MaterialsSection
              payload={payload}
              activeTab={direction.pestana}
              onStateRefresh={refresh}
              onArtifact={setLatestArtifact}
            />
          ) : null}
          {!loading && direction.seccion === "entrega-campo" ? (
            <DeliverySection payload={payload} latestArtifact={latestArtifact} onState={setPayload} />
          ) : null}
        </section>
      </div>
    </PageFrame>
  );
}
