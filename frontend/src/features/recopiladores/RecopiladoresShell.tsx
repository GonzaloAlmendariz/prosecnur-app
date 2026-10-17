import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { apiRecopiladoresState, type CollectionArtifactReceipt, type CollectionStatePayload } from "../../api/recopiladores";
import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { ChromeIndicator, ChromeIndicatorGroup } from "../../components/ChromeIndicator";
import { ContextTabRail, type ContextTabRailItem } from "../../components/ContextTabRail";
import { ModuleCommandBar } from "../../components/ModuleCommandBar";
import { PageFrame } from "../../components/PageFrame";
import { SectionPillbar } from "../../components/SectionPillbar";
import { PROSECNUR_MODULES } from "../../lib/modules";
import { RefreshCw } from "../../vendor/lucide-react";
import { AccessSection } from "./AccessSection";
import { CatalogoTipos } from "./catalogo/CatalogoTipos";
import { CorreosEditor } from "./correos/CorreosEditor";
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
import { deploymentStatusLabel } from "./providerRules";
import { origenDelPlan } from "./vacioSinPlan";
import { TIPO_DE_UNIDAD } from "./tipoDeUnidad";
import { useProjectModules } from "../project/ProjectModulesContext";
import "./styles/recopiladores-shell.css";

const MODULE = PROSECNUR_MODULES.find((item) => item.slug === "material-campo")!;

/**
 * Qué hace cada sección, en el idioma de quien la usa.
 *
 * Los cuatro subtítulos hablaban en lenguaje de implementación —«inspecciona un
 * target existente y prepara accesos sin crear recursos remotos», «renderiza con
 * el compilador autoritativo del backend», «cierra el deployment con un recibo
 * idempotente»—. Quien prepara una salida a campo no sabe qué es un recibo
 * idempotente, y el módulo entero se lee como si no fuera para él.
 *
 * Las garantías técnicas que decían no se pierden, se dicen en castellano: que
 * Accesos no toca nada en la plataforma, y que la entrega se puede repetir sin
 * duplicar lo entregado.
 *
 * El referente es Cálculo de cursos-horario, cuyos subtítulos son «Cuotas y
 * cursos-horario necesarios» o «nombre, cliente y alcance»: el dominio, no la
 * arquitectura. Ver `docs/qa/roles-del-operativo-de-aulas-2026-08-22.md`.
 */
export { TIPO_DE_UNIDAD } from "./tipoDeUnidad";

const SECTION_COPY: Record<RecopiladoresSeccion, { title: string; lead: string }> = {
  unidades: {
    title: "Unidades",
    lead: "Las aulas que entran a campo y con qué versión del cuestionario se aplican.",
  },
  accesos: {
    title: "Accesos",
    lead: "El enlace por el que responde cada aula. Se prepara sobre un formulario que ya existe, sin tocar nada en la plataforma.",
  },
  catalogo: {
    title: "Catálogo",
    lead: "La ficha que se imprime y se lleva al aula: código, QR, horario, salón y docente.",
  },
  paquetes: {
    title: "Paquetes",
    lead: "Las fichas de todas las unidades, agrupadas para el reparto en campo.",
  },
  entrega: {
    title: "Entrega",
    lead: "Cierra el plan y deja constancia de qué se entregó. Repetirla no duplica nada, y Monitoreo la lee de ahí.",
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
  const { overview, addedSlugs } = useProjectModules();
  // De dónde sale la lista de unidades: el destino del vacío de Unidades.
  const origen = useMemo(
    () => origenDelPlan({ modoDelCalculo: overview?.facts.calc.mode, modulos: addedSlugs }),
    [overview?.facts.calc.mode, addedSlugs],
  );
  const irA = useCallback((to: string) => navigate(to), [navigate]);
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const direction = resolverDireccion(params.get("seccion"), params.get("pestana"));
  const [payload, setPayload] = useState<CollectionStatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  // Una sección puede seguir cargando lo suyo cuando el shell ya tiene el plan.
  // `auditReady` prometía que la vista era juzgable y no lo era: el QA visual de
  // Materiales llevaba midiendo su esqueleto de carga —124 px de vacío y el
  // texto «Leyendo plantilla semántica…»— en cada corrida.
  const [seccionCargando, setSeccionCargando] = useState(false);
  const [error, setError] = useState("");
  const [latestArtifact, setLatestArtifact] = useState<CollectionArtifactReceipt | null>(null);
  const [sinCambios, setSinCambios] = useState(false);

  // Vara V3: el motor ya declara `noop` cuando una mutación no cambió nada
  // —guardar un plan idéntico, preparar un deployment que ya estaba— y ese
  // campo llegaba tipado y normalizado hasta acá sin que nadie lo leyera.
  // Guardar y que no pase nada se veía igual que guardar.
  //
  // Va sólo en este embudo, que es por donde pasan las cuatro mutaciones. El
  // GET también devuelve `noop: true` —leer nunca cambia nada— así que leerlo
  // en la carga mostraría el aviso siempre.
  const aplicarMutacion = useCallback((next: CollectionStatePayload) => {
    setPayload(next);
    setSinCambios(next.noop === true);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    setSinCambios(false);
    try {
      setPayload(await apiRecopiladoresState());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer Material de campo.");
    } finally {
      setLoading(false);
    }
  }, []);

  // `refresh()` alterna `loading`, y `!loading` desmonta la sección activa
  // (abajo). Para un refresco que dispara la sección misma —terminó un
  // render de Materiales, no cambió de proyecto— desmontarla le borra su
  // propio estado (jobId, renderResult, instancias) a mitad de mostrar el
  // resultado. `refreshSilent` actualiza `payload` sin tocar `loading`.
  const refreshSilent = useCallback(async () => {
    try {
      setPayload(await apiRecopiladoresState());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer Material de campo.");
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

  const selectTab = (tab: RecopiladoresPestana) => {
    navigate(`${location.pathname}${searchFor(location.search, direction.seccion, tab)}`);
  };

  const activeMeta = MODULE.sections.find((section) => section.id === direction.seccion);
  const tabs = activeMeta?.tabs ?? [];
  const conRail = tabs.length > 1;
  const railItems: readonly ContextTabRailItem<RecopiladoresPestana>[] = tabs.map((tab) => ({
    key: tab.id as RecopiladoresPestana,
    label: tab.label,
    icon: tab.icon,
  }));
  const copy = SECTION_COPY[direction.seccion];
  const state = payload?.state ?? null;
  // «sin deployment» es la palabra del motor para «los accesos todavía no están
  // preparados». En la barra de un módulo que usa quien sale a campo, no dice
  // nada.
  const status = state?.deployment?.status
    ?? (state?.plan ? "accesos sin preparar" : "sin plan de recolección");

  /**
   * Qué pasos del recorrido ya están dados.
   *
   * Las cuatro secciones **son** una secuencia —el plan entra, se preparan los
   * accesos, se generan los materiales y se entrega— y el selector las pintaba
   * como cuatro botones intercambiables. Quien abre el módulo a mitad de trabajo
   * no sabía qué falta para poder salir a campo.
   *
   * Es el patrón «estás aquí» de Cálculo de cursos-horario, cuyo recorrido marca
   * el paso en curso con un badge. Aquí basta con un punto: el selector es
   * navegación y no debe convertirse en un panel.
   */
  const pasosHechos: Record<RecopiladoresSeccion, boolean> = {
    unidades: Boolean(state?.plan?.units?.length),
    accesos: Boolean(state?.deployment?.bindings?.length),
    // Un material renderizado deja su recibo: es la prueba de que existe algo
    // que llevar, no de que se haya elegido una plantilla. Catálogo y Paquetes
    // eran una sola sección y comparten esa prueba hasta que el catálogo tenga
    // la suya (ADR 0108, E1).
    catalogo: Boolean(state?.artifact_receipts?.length),
    paquetes: Boolean(state?.artifact_receipts?.length),
    entrega: Boolean(payload?.handoff ?? state?.deployment?.handoff),
  };
  // **El rail de secciones compartido, sin numeral.** Material de campo
  // dibujaba su propio `<ol>` de píldoras con número (1 Unidades, 2 Accesos…)
  // y estado «hecho / es lo siguiente», cuando el resto de los módulos ya usaba
  // `SectionPillbar` limpio: «ahora las secciones ya no vienen numeradas en
  // ningún módulo» (Gonzalo, 2026-10-16). El componente es navegación —cada
  // sección es un enlace con `aria-current="page"`— y su dirección es la
  // canónica de siempre (`?seccion=…&pestana=…`).
  //
  // De la señal de avance queda `done`, que el componente admite como marca no
  // numérica; «es lo siguiente» no tiene sitio en él y se retira.
  const sectionSelector = (
    <SectionPillbar
      modulo="material-campo"
      ariaLabel="Secciones de Material de campo"
      seccionActiva={direction.seccion}
      className="rec-section-selector"
      items={MODULE.sections.map((section) => {
        const id = section.id as RecopiladoresSeccion;
        return {
          id,
          label: section.label,
          href: `${location.pathname}${searchFor(location.search, id, PESTANAS_POR_SECCION[id][0] as RecopiladoresPestana)}`,
          done: pasosHechos[id],
        };
      })}
    />
  );

  const panel = (
    <section
      id={tabs.length > 1 ? `rec-tab-panel-${direction.pestana}` : undefined}
      className="rec-tab-panel"
      role={tabs.length > 1 ? "tabpanel" : undefined}
      aria-labelledby={tabs.length > 1 ? `rec-tab-${direction.pestana}` : undefined}
      data-qa-geometry-group={`material-campo/${direction.seccion}`}
      data-qa-geometry-contract="intrinsic"
    >
      {loading && !state ? (
        <div className="rec-loading" data-qa-geometry-capacity="owned">
          Leyendo el estado del despliegue…
        </div>
      ) : null}
      {sinCambios ? (
        <div
          data-testid="recopiladores-sin-cambios"
          role="status"
          className="rec-sin-cambios"
          data-qa-geometry-capacity="owned"
        >
          No había nada que guardar: lo que enviaste es igual a lo que ya estaba.
        </div>
      ) : null}
      {!loading && direction.seccion === "unidades" ? (
        <PlanSection payload={payload} onState={aplicarMutacion} origen={origen} onIr={irA} />
      ) : null}
      {!loading && direction.seccion === "accesos" ? (
        <AccessSection payload={payload} activeTab={direction.pestana} onState={aplicarMutacion} onIr={irA} />
      ) : null}
      {!loading && direction.seccion === "catalogo" && direction.pestana === "tipos" ? (
        <CatalogoTipos
          payload={payload}
          onStateRefresh={refreshSilent}
          onCargando={setSeccionCargando}
          onIr={irA}
        />
      ) : null}
      {!loading && direction.seccion === "catalogo" && direction.pestana === "correos" ? (
        <CorreosEditor onCargando={setSeccionCargando} />
      ) : null}
      {!loading && ((direction.seccion === "catalogo" && direction.pestana === "editor") || direction.seccion === "paquetes") ? (
        <MaterialsSection
          payload={payload}
          activeTab={direction.pestana}
          onStateRefresh={refreshSilent}
          onArtifact={setLatestArtifact}
          onCargando={setSeccionCargando}
          onIr={irA}
        />
      ) : null}
      {!loading && direction.seccion === "entrega" ? (
        <DeliverySection payload={payload} latestArtifact={latestArtifact} onState={aplicarMutacion} onIr={irA} />
      ) : null}
    </section>
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
      auditReady={loading || seccionCargando ? false : `material-campo/${direction.seccion}/${direction.pestana}`}
      className="rec-page"
      chrome={(
        <ModuleCommandBar
          modulo="material-campo"
          contexto={state?.plan ? (
            // La zona de contexto lleva el dato, no el nombre del módulo: eso ya
            // lo dice el ícono activo del rail y repetirlo desperdicia el único
            // hueco donde los demás módulos ponen su cifra —Bitácora pone
            // entradas, Hojas de ruta distritos, Cálculo la mesa—. Aquí el dato
            // es la forma del plan: cuántas unidades y de qué tipo.
            <ChromeIndicatorGroup ariaLabel="Contexto de Material de campo">
              {/* Los cursos-horario que hay que visitar, no el total de filas
                  del plan. Decía «2 468 unidades» mientras el resumen de abajo
                  decía «175 cursos-horario»: la diferencia son las reservas y el
                  banco, que no son visitas. Dos cifras para lo mismo en la misma
                  pantalla es justo lo que este módulo lleva corrigiendo. */}
              <ChromeIndicator
                label="Cursos-horario"
                value={String(
                  state.plan.units.filter((u) => (u.role ?? "") === "titular").length
                  || state.plan.units.length,
                )}
                prioridad="alta"
              />
              {state.plan.unit_type ? (
                <ChromeIndicator
                  label="Tipo"
                  value={TIPO_DE_UNIDAD[state.plan.unit_type] ?? state.plan.unit_type}
                />
              ) : null}
            </ChromeIndicatorGroup>
          ) : null}
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
            label: deploymentStatusLabel(status),
            tone: status === "handed_off" ? "success" : status === "stale" ? "danger" : "neutral",
          }]}
          ariaLabel="Controles de Material de campo"
        />
      )}
      notices={error ? <div className="rec-notice is-error" role="alert">{error}</div> : null}
    >
      <div className={`rec-workbench${conRail ? " rec-workbench--rail" : ""}`}>
        {conRail ? (
          // **El rail de la casa, no píldoras propias.** Toda sección con dos o
          // más pestañas las lleva en el rail de íconos compartido, igual que
          // Carga, Gráficos y Cálculo de muestra. Una sección de una sola
          // pestaña no dibuja rail: un ítem no es una elección.
          <AdaptiveSplitView
            ariaLabel={`Mesa de ${copy.title}`}
            railLabel={`Pestañas de ${copy.title}`}
            className="rec-workbench-split pulso-context-tab-layout"
            rail={(
              <ContextTabRail
                ariaLabel={`Pestañas de ${copy.title}`}
                activeKey={direction.pestana}
                items={railItems}
                panelId={(key) => `rec-tab-panel-${key}`}
                tabId={(key) => `rec-tab-${key}`}
                onChange={selectTab}
              />
            )}
          >
            {panel}
          </AdaptiveSplitView>
        ) : panel}
      </div>
    </PageFrame>
  );
}
