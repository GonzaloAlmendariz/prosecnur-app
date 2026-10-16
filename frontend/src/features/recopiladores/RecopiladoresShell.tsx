import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { apiRecopiladoresState, type CollectionArtifactReceipt, type CollectionStatePayload } from "../../api/recopiladores";
import { ChromeIndicator, ChromeIndicatorGroup } from "../../components/ChromeIndicator";
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
import { deploymentStatusLabel } from "./providerRules";
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
/**
 * El tipo de unidad, dicho como se dice.
 *
 * La barra enseñaba `classroom_course_schedule` —la clave del adaptador— junto a
 * «TIPO». Es el nombre con el que el motor distingue una familia de plan, no
 * algo que nadie diga: en la app, en el libro y en campo son «cursos-horario».
 *
 * Una clave que no esté aquí se muestra tal cual: inventarle un nombre sería
 * peor que enseñar la clave, porque el lector no podría contrastarla con nada.
 */
export const TIPO_DE_UNIDAD: Record<string, string> = {
  classroom_course_schedule: "Cursos-horario",
  household: "Viviendas",
  person: "Personas",
};

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
    title: "Entrega a campo",
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
  // El siguiente paso es el primero que falta. Con todos dados no se marca
  // ninguno: el recorrido terminó y señalar uno inventaría trabajo.
  const siguientePaso = (MODULE.sections
    .map((s) => s.id as RecopiladoresSeccion)
    .find((id) => !pasosHechos[id])) ?? null;

  // **Las píldoras de fase compartidas, no un selector propio.**
  //
  // Esto dibujaba botones planos con `rec-section-selector` y su propio CSS,
  // mientras Cálculo de muestra, Hojas de ruta y Monitoreo usan
  // `pulso-phase-pillbar` de `theme.css`: mismo alto, mismo número en su
  // círculo, mismo relieve en la activa y los mismos estados. Tres módulos con
  // un lenguaje y éste con otro es justo lo que hace que Recopiladores «se vea
  // peor» al lado de los demás (Gonzalo, 2026-08-28).
  //
  // La semántica de pasos que ya tenía —hecho / es lo siguiente— mapea sin
  // traducción a `is-done` / `is-next`, así que no se pierde nada: el avance del
  // recorrido se sigue viendo, ahora con la misma señal que el resto de la app.
  const sectionSelector = (
    <GlidingTabList
      className="pulso-phase-pillbar rec-section-selector"
      activeKey={direction.seccion}
      mode="tabs"
      role="group"
      aria-label="Secciones de Material de campo"
      onRovingKeyChange={(key) => selectSection(key as RecopiladoresSeccion)}
    >
      <ol className="pulso-phase-pill-list">
        {MODULE.sections.map((section, index) => {
          const id = section.id as RecopiladoresSeccion;
          const active = section.id === direction.seccion;
          const hecho = pasosHechos[id];
          const siguiente = section.id === siguientePaso;
          const estado = hecho ? "hecho" : siguiente ? "es lo siguiente" : "";
          return (
            <li key={section.id} className="pulso-phase-pill-item">
              <button
                type="button"
                data-gliding-key={section.id}
                className={`pulso-phase-pill${active ? " is-active" : ""}${hecho ? " is-done" : ""}${siguiente ? " is-next" : ""}`}
                aria-pressed={active}
                // El estado va en el `title` y en el nombre accesible, no sólo
                // en el color del círculo: un tinte no es una señal accesible.
                title={estado ? `${section.label} · ${estado}` : section.label}
                onClick={() => selectSection(id)}
              >
                <span className="pulso-phase-pill-number" aria-hidden="true">{index + 1}</span>
                <span className="pulso-phase-pill-stack">
                  <span className="pulso-phase-pill-label">{section.label}</span>
                </span>
                {estado ? <span className="pulso-sr-only"> · {estado}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
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
                  aria-controls={`rec-tab-panel-${tab.id}`}
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
            <PlanSection payload={payload} onState={aplicarMutacion} />
          ) : null}
          {!loading && direction.seccion === "accesos" ? (
            <AccessSection payload={payload} activeTab={direction.pestana} onState={aplicarMutacion} />
          ) : null}
          {!loading && (direction.seccion === "catalogo" || direction.seccion === "paquetes") ? (
            <MaterialsSection
              payload={payload}
              activeTab={direction.pestana}
              onStateRefresh={refreshSilent}
              onArtifact={setLatestArtifact}
              onCargando={setSeccionCargando}
            />
          ) : null}
          {!loading && direction.seccion === "entrega" ? (
            <DeliverySection payload={payload} latestArtifact={latestArtifact} onState={aplicarMutacion} />
          ) : null}
        </section>
      </div>
    </PageFrame>
  );
}
