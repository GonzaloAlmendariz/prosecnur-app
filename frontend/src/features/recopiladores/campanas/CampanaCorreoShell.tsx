// La campaña de correo abierta (ADR 0111 §3): una sección —el correo— con dos
// pestañas en el rail de la casa: el editor (identidad, destinatarios,
// plataforma, envíos, revisión e importar son sus paneles) y los contactos
// (ADR 0112 §4: la lista, el tablero por perfil y el enlace personal). La miga
// de la campaña vive en la barra de cada pestaña (pedido de Gonzalo,
// 2026-10-20); la barra del módulo lleva sólo las secciones del modo correo,
// Correo y Seguimiento (D8, 11 nov 2026).
//
// El editor sigue montado —oculto— mientras se miran los contactos: su
// borrador sin guardar vive en él y volver al editor no lo relee del backend.

import { useCallback, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AdaptiveSplitView } from "../../../components/AdaptiveSplitView";
import { ContextTabRail, type ContextTabRailItem } from "../../../components/ContextTabRail";
import { ModuleCommandBar } from "../../../components/ModuleCommandBar";
import { PageFrame } from "../../../components/PageFrame";
import { SectionPillbar } from "../../../components/SectionPillbar";
import { PROSECNUR_MODULES } from "../../../lib/modules";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import { ContactosVista } from "../correos/contactos/ContactosVista";
import { CorreosEditor } from "../correos/CorreosEditor";
import { PANEL_CORREO_DESTINATARIOS } from "../correos/panelesCorreos";
import type { AccionesDeCampanas } from "../correos/useCampanas";
import { searchDeCampanas } from "./direccionDeCampanas";
import { refDeCorreo } from "./modeloRegistro";
import { SECCION_SEGUIMIENTO } from "../seguimiento/navegacionSeguimiento";
import { useDensidadDelChrome } from "../useDensidadDelChrome";
import "../styles/recopiladores-shell.css";

type PestanaDelCorreo = "editor" | "contactos";

const SECCIONES_DEL_CORREO = PROSECNUR_MODULES.find((m) => m.slug === "material-campo")?.modos
  ?.find((modo) => modo.id === "correo")?.sections ?? [];

const PESTANAS: readonly ContextTabRailItem<PestanaDelCorreo>[] = (
  SECCIONES_DEL_CORREO.find((s) => s.id === "correo")?.tabs ?? []
).map((tab) => ({ key: tab.id as PestanaDelCorreo, label: tab.label, icon: tab.icon }));

type Props = {
  /** Id del registro (`correo.<campaign_id>`). */
  campana: string;
  nombre: string;
  cabecera: ReactNode;
  campanasAcc: AccionesDeCampanas;
  onStateRefresh: () => void | Promise<void>;
  /** Cuándo se exportó cada envío (`send_id` → ISO), del registro (F16). */
  exportados?: Readonly<Record<string, string>>;
};

export function CampanaCorreoShell({ campana, nombre, cabecera, campanasAcc, onStateRefresh, exportados }: Props) {
  const [cargandoEditor, setCargandoEditor] = useState(true);
  const [cargandoContactos, setCargandoContactos] = useState(true);
  const direccion = useDireccion();
  const location = useLocation();
  const navigate = useNavigate();
  const pestana: PestanaDelCorreo = direccion?.pestana === "contactos" ? "contactos" : "editor";
  const cargando = pestana === "contactos" ? cargandoContactos : cargandoEditor;

  const irA = useCallback((siguiente: PestanaDelCorreo, panel?: string) => {
    const search = searchDeCampanas(location.search, {
      modo: "correo",
      campana,
      seccion: "correo",
      pestana: siguiente,
      ...(panel ? { panel } : {}),
      ...(direccion?.foco ? { foco: direccion.foco } : {}),
    });
    navigate({ pathname: location.pathname, search });
  }, [campana, direccion?.foco, location.pathname, location.search, navigate]);

  const irAImportar = useCallback(() => irA("editor", PANEL_CORREO_DESTINATARIOS.id), [irA]);
  const densidadChrome = useDensidadDelChrome();

  // D8: las secciones del modo correo, la misma barra que Seguimiento. "Correo" es esta campaña;
  // "Seguimiento" es del estudio entero y su dirección no lleva `campana`.
  const secciones = (
    <SectionPillbar
      modulo="material-campo"
      ariaLabel="Secciones del correo"
      seccionActiva="correo"
      className="rec-section-selector"
      items={SECCIONES_DEL_CORREO.map((s) => ({
        id: s.id,
        label: s.label,
        href: s.id === SECCION_SEGUIMIENTO
          ? `${location.pathname}${searchDeCampanas(location.search, { modo: "correo", seccion: SECCION_SEGUIMIENTO })}`
          : `${location.pathname}${searchDeCampanas(location.search, { modo: "correo", campana, seccion: "correo", pestana })}`,
      }))}
    />
  );

  return (
    <PageFrame
      title={`Correo · ${nombre}`}
      lead="El correo de la campaña, sus contactos, sus envíos y su salida para la plataforma."
      layout="workbench"
      scrollOwner="panels"
      bodyMode="fill"
      headerMode="sr-only"
      resetScrollKey={`correo/${pestana}`}
      auditReady={cargando ? false : `material-campo/correo/${pestana}`}
      className="rec-page"
      chrome={(
        <ModuleCommandBar
          densidad={densidadChrome}
          modulo="material-campo"
          secciones={secciones}
          ariaLabel="Controles del correo"
        />
      )}
    >
      <div className="rec-workbench rec-workbench--rail">
        <AdaptiveSplitView
          ariaLabel={`Correo ${nombre}`}
          railLabel="Pestañas del correo"
          className="rec-workbench-split pulso-context-tab-layout"
          rail={(
            <ContextTabRail
              ariaLabel="Pestañas del correo"
              activeKey={pestana}
              items={PESTANAS}
              panelId={(key) => `rec-correo-panel-${key}`}
              tabId={(key) => `rec-correo-tab-${key}`}
              onChange={(key) => irA(key)}
            />
          )}
        >
          <div className="rec-correo-pestanas">
            <section
              id="rec-correo-panel-editor"
              className="rec-tab-panel"
              role="tabpanel"
              aria-labelledby="rec-correo-tab-editor"
              hidden={pestana !== "editor"}
              data-qa-geometry-group="material-campo/correo"
              data-qa-geometry-contract="intrinsic"
            >
              <CorreosEditor
                onCargando={setCargandoEditor}
                onStateRefresh={onStateRefresh}
                campanasAcc={campanasAcc}
                cabecera={pestana === "editor" ? cabecera : null}
                exportados={exportados}
              />
            </section>
            {pestana === "contactos" ? (
              <section
                id="rec-correo-panel-contactos"
                className="rec-tab-panel"
                role="tabpanel"
                aria-labelledby="rec-correo-tab-contactos"
                data-qa-geometry-group="material-campo/correo"
                data-qa-geometry-contract="intrinsic"
              >
                <ContactosVista
                  campaignId={refDeCorreo(campana)}
                  cabecera={cabecera}
                  onCargando={setCargandoContactos}
                  onIrAImportar={irAImportar}
                />
              </section>
            ) : null}
          </div>
        </AdaptiveSplitView>
      </div>
    </PageFrame>
  );
}
