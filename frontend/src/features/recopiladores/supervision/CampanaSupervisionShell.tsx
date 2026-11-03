// La campaña de supervisión abierta (ADR 0125 A3): Columnas y Entrega sobre el lote que armó Monitoreo.
// Mismo cromo que la telefónica: secciones en la SectionPillbar y una pestaña por sección, sin rail.
//
// Contrato de Superficie: el panel activo es `material-campo/supervision/<sección>` (intrinsic) y es el
// único dueño del scroll (`.rec-tab-panel`, No Scroll Jail).

import { useCallback, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import type { CampanaMaterial } from "../../../api/materialCampanas";
import { ChipDeEntrada } from "../campanas/ChipDeEntrada";
import { ModuleCommandBar } from "../../../components/ModuleCommandBar";
import { PageFrame } from "../../../components/PageFrame";
import { SectionPillbar } from "../../../components/SectionPillbar";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import { RefreshCw } from "../../../vendor/lucide-react";
import { searchDeCampanas } from "../campanas/direccionDeCampanas";
import { useDensidadDelChrome } from "../useDensidadDelChrome";
import { PESTANAS_SUPERVISION, SECCIONES_SUPERVISION, resolverSeccionSupervision, type SeccionSupervision } from "./navegacionSupervision";
import { ColumnasSupervision, EntregaSupervision } from "./SeccionesSupervision";
import { useColumnasSupervision } from "./useColumnasSupervision";
import "../styles/recopiladores-shell.css";
import "../territorial/territorial.css";
import "../telefonica/telefonica.css";
import { CargaDeBloque } from "../../../components/CargaDeBloque";

const COPIA: Record<SeccionSupervision, { title: string; lead: string }> = {
  columnas: { title: "Columnas", lead: "Qué lleva la base: del barrido, de los resultados y las tres de la supervisión." },
  entrega: { title: "Entrega", lead: "La base del lote, una fila por caso, y lo que lee Monitoreo." },
};

type Props = { campana: CampanaMaterial; cabecera?: ReactNode };

export function CampanaSupervisionShell({ campana, cabecera = null }: Props) {
  const densidadChrome = useDensidadDelChrome();
  const location = useLocation();
  const direccion = useDireccion();
  const { seccion, pestana } = resolverSeccionSupervision(direccion?.seccion);
  const datos = useColumnasSupervision(campana.id);
  const { columnas, cargando, guardando, error, recargar, guardar } = datos;
  const estado = campana.estado?.tipo === "supervision" ? campana.estado : null;
  const casos = estado?.casos ?? 0;

  const hrefDe = useCallback((s: SeccionSupervision) => (
    `${location.pathname}${searchDeCampanas(location.search, { modo: "supervision", campana: campana.id, seccion: s, pestana: PESTANAS_SUPERVISION[s][0] })}`
  ), [campana.id, location.pathname, location.search]);
  const copia = COPIA[seccion];
  const listo = Boolean(columnas) || Boolean(error);

  return (
    <PageFrame
      title={copia.title}
      lead={copia.lead}
      layout="workbench"
      scrollOwner="panels"
      bodyMode="fill"
      headerMode="sr-only"
      resetScrollKey={`supervision/${seccion}/${pestana}`}
      auditReady={listo ? `material-campo/supervision/${seccion}/${pestana}` : false}
      className="rec-page"
      chrome={(
        <ModuleCommandBar
          densidad={densidadChrome}
          modulo="material-campo"
          contexto={(
            <>
              {cabecera}
              {estado ? (
                <ChipDeEntrada
                  origen="monitoreo"
                  rotulo={estado.lote_id.replace(/^ronda-/, "Lote ")}
                  dato={`${casos.toLocaleString("es-PE")} ${casos === 1 ? "caso" : "casos"}`}
                  aviso={Boolean(estado.sin_lote)}
                  detalle={estado.sin_lote ? "Monitoreo ya no tiene este lote" : "Lote que calculó Monitoreo con el avance de la campaña telefónica"}
                />
              ) : null}
            </>
          )}
          secciones={(
            <SectionPillbar
              modulo="material-campo"
              ariaLabel="Secciones de la supervisión"
              seccionActiva={seccion}
              className="rec-section-selector"
              items={SECCIONES_SUPERVISION.map((s) => ({ id: s.id, label: s.label, href: hrefDe(s.id as SeccionSupervision) }))}
            />
          )}
          acciones={[{ id: "refresh", label: "Actualizar", icon: RefreshCw, onSelect: () => { void recargar(); }, kind: "ghost", rank: 2, busy: cargando }]}
          estado={estado?.sin_lote ? [{ id: "supervision-lote", label: "Sin lote", tone: "warn" }] : []}
          ariaLabel="Controles de la supervisión"
        />
      )}
    >
      <div className="rec-workbench">
        <section key={seccion} className="rec-tab-panel rec-terr" aria-busy={cargando}>
          <div className="rec-terr-seccion">
            {error ? <p className="rec-terr-error" role="alert">{error}</p> : null}
            <div className="rec-terr-tarjetas" data-qa-geometry-group={`material-campo/supervision/${seccion}`} data-qa-geometry-contract="intrinsic">
              {!columnas ? (cargando ? <CargaDeBloque label="Leyendo las columnas…" /> : null) : seccion === "columnas" ? (
                <ColumnasSupervision columnas={columnas} guardando={guardando} onGuardar={(e) => void guardar(e)} />
              ) : (
                <EntregaSupervision campaignId={campana.id} columnas={columnas} casos={casos} sinLote={Boolean(estado?.sin_lote)} loteId={estado?.lote_id ?? ""} />
              )}
            </div>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
