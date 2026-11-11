// Material de campo > Correo > Seguimiento: operaciones del estudio entero sobre
// todas sus campañas de Mailchimp (una por público). Tres pestañas en el rail de
// la casa: Quién respondió, Prueba de horarios y Correo personal (opcional).
// Mismo cromo que la campaña telefónica: secciones del modo en la SectionPillbar
// y el rail de pestañas.
//
// Contrato de Superficie: el panel activo es `material-campo/correo/seguimiento/<pestaña>`
// (intrinsic) y es el único dueño del scroll (`.rec-tab-panel`, No Scroll Jail).

import { useCallback, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { AdaptiveSplitView } from "../../../components/AdaptiveSplitView";
import { ContextTabRail, type ContextTabRailItem } from "../../../components/ContextTabRail";
import { ModuleCommandBar } from "../../../components/ModuleCommandBar";
import { PageFrame } from "../../../components/PageFrame";
import { SectionPillbar } from "../../../components/SectionPillbar";
import { PROSECNUR_MODULES } from "../../../lib/modules";
import { Activity, ArrowLeft, RefreshCw } from "../../../vendor/lucide-react";
import { searchDeCampanas } from "../campanas/direccionDeCampanas";
import { useDensidadDelChrome } from "../useDensidadDelChrome";
import { CabeceraDeSeguimiento } from "./CabeceraDeSeguimiento";
import { CorreoPersonal } from "./CorreoPersonal";
import { SECCION_SEGUIMIENTO, type PestanaDeSeguimiento } from "./navegacionSeguimiento";
import { PruebaDeHorarios } from "./PruebaDeHorarios";
import { QuienRespondio } from "./QuienRespondio";
import { useSeguimientoStore } from "./store";
import "../styles/recopiladores-shell.css";
import "../campanas/campanas.css";
import "../correos/correosSincronizacion.css";
// Los colores de grupo A y B (tokens --pulso-data-brazo-*) viven en tokens-datos.css, que se importa donde se usa.
import "../../../app/tokens-datos.css";
import "./seguimiento.css";

const MODO_CORREO = PROSECNUR_MODULES.find((m) => m.slug === "material-campo")?.modos?.find((m) => m.id === "correo");
const SECCION = MODO_CORREO?.sections.find((s) => s.id === SECCION_SEGUIMIENTO);

const RAIL: readonly ContextTabRailItem<PestanaDeSeguimiento>[] = (SECCION?.tabs ?? []).map((t) => ({
  key: t.id as PestanaDeSeguimiento,
  label: t.label,
  icon: t.icon,
  // El correo personal es una prueba aparte que no todo estudio hace.
  ...(t.id === "correo-personal" ? { grupo: "Opcional" } : {}),
}));

const COPIA: Record<PestanaDeSeguimiento, { title: string; lead: string }> = {
  respondieron: { title: "Quién respondió", lead: "Encuestas completas por campaña de Mailchimp." },
  horarios: { title: "Prueba de horarios", lead: "Grupo A contra grupo B, con recordatorios a horas distintas." },
  "correo-personal": { title: "Correo personal", lead: "Un segundo correo para una parte de quienes no responden." },
};

export function SeguimientoShell({ pestana }: { pestana: PestanaDeSeguimiento }) {
  const densidadChrome = useDensidadDelChrome();
  const location = useLocation();
  const navigate = useNavigate();
  const carga = useSeguimientoStore((s) => s.carga);
  const error = useSeguimientoStore((s) => s.error);

  useEffect(() => {
    const st = useSeguimientoStore.getState();
    void st.cargar({ silencioso: st.estado !== null });
    void st.cargarOpciones();
  }, []);

  const recargar = useCallback(() => {
    const st = useSeguimientoStore.getState();
    void st.cargar();
    void st.cargarOpciones();
  }, []);

  const hrefDe = useCallback((p: PestanaDeSeguimiento) => (
    `${location.pathname}${searchDeCampanas(location.search, { modo: "correo", seccion: SECCION_SEGUIMIENTO, pestana: p })}`
  ), [location.pathname, location.search]);

  const copia = COPIA[pestana];
  const listo = carga === "lista" || carga === "error";

  return (
    <PageFrame
      title={copia.title}
      lead={copia.lead}
      layout="workbench"
      scrollOwner="panels"
      bodyMode="fill"
      headerMode="sr-only"
      resetScrollKey={`seguimiento/${pestana}`}
      auditReady={listo ? `material-campo/correo/seguimiento/${pestana}` : false}
      className="rec-page"
      chrome={(
        <ModuleCommandBar
          densidad={densidadChrome}
          modulo="material-campo"
          contexto={(
            <nav className="rec-campana-cabecera" aria-label="Seguimiento de correos">
              <Link className="rec-campana-volver" to="/material-campo">
                <ArrowLeft size={14} aria-hidden /> <span className="rec-campana-volver-rotulo">Campañas</span>
              </Link>
              <span className="rec-campana-cabecera-sep" aria-hidden>/</span>
              <span className="rec-campana-cabecera-nombre">Correos del estudio</span>
            </nav>
          )}
          secciones={(
            <SectionPillbar
              modulo="material-campo"
              ariaLabel="Secciones del correo"
              seccionActiva={SECCION_SEGUIMIENTO}
              className="rec-section-selector"
              items={(MODO_CORREO?.sections ?? []).map((s) => ({
                id: s.id,
                label: s.label,
                href: s.id === SECCION_SEGUIMIENTO
                  ? hrefDe(pestana)
                  : `${location.pathname}${searchDeCampanas(location.search, { modo: "correo" })}`,
              }))}
            />
          )}
          acciones={[{
            id: "refresh",
            label: "Actualizar",
            icon: RefreshCw,
            onSelect: recargar,
            kind: "ghost",
            rank: 2,
            busy: carga === "cargando",
          }]}
          ariaLabel="Controles del seguimiento de correos"
        />
      )}
      notices={error ? <div className="rec-notice is-error" role="alert">{error}</div> : null}
    >
      <div className="rec-workbench rec-workbench--rail">
        <AdaptiveSplitView
          ariaLabel="Seguimiento de correos"
          railLabel="Pestañas del seguimiento"
          className="rec-workbench-split pulso-context-tab-layout"
          rail={(
            <ContextTabRail
              ariaLabel="Pestañas del seguimiento"
              activeKey={pestana}
              items={RAIL}
              panelId={(key) => `rec-seg-panel-${key}`}
              tabId={(key) => `rec-seg-tab-${key}`}
              onChange={(key) => navigate(hrefDe(key))}
            />
          )}
        >
          <section
            key={pestana}
            id={`rec-seg-panel-${pestana}`}
            className="rec-tab-panel rec-seg"
            role="tabpanel"
            aria-labelledby={`rec-seg-tab-${pestana}`}
            aria-busy={carga === "cargando"}
            data-qa-geometry-group={`material-campo/correo/seguimiento/${pestana}`}
            data-qa-geometry-contract="intrinsic"
          >
            <CabeceraDeSeguimiento
              pestana={pestana}
              titulo={copia.title}
              detalle={copia.lead}
              icono={RAIL.find((t) => t.key === pestana)?.icon ?? Activity}
            />
            {pestana === "respondieron" ? <QuienRespondio /> : null}
            {pestana === "horarios" ? <PruebaDeHorarios /> : null}
            {pestana === "correo-personal" ? <CorreoPersonal /> : null}
          </section>
        </AdaptiveSplitView>
      </div>
    </PageFrame>
  );
}
