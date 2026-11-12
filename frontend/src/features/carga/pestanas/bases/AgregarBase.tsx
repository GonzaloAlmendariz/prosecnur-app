// "Agregar base" (Carga › Bases, R2): un recorrido de dos pasos, origen y
// datos, abierto por `panel=agregar-base`. Cada origen monta la pieza que ya
// lo resolvía: las tarjetas de subida de la carga simple, el catálogo de
// plataforma, Monitoreo, la base .sav, el formulario publicado y los
// asistentes de varias fuentes o varias encuestas a la vez, sin rediseñarlos.

import { useEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiEstudioGet, type EstudioPayload } from "../../../../api/estudio";
import { Dialog } from "../../../../components/Dialog";
import { ErrorBlock } from "../../../../components/States";
import { StageStepper } from "../../../../components/StageStepper";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { Plus } from "../../../../vendor/lucide-react";
import { BaseSavPanel } from "../../BaseSavPanel";
import { opcionesCanonicas } from "../../opcionesCanonicas";
import { CargaManualBaseLanes } from "../../CargaManualBaseLanes";
import { EntradasPrevistas } from "./EntradasPrevistas";
import { ICONO_DE_ALTA } from "./OrigenesALaVista";
import { AvisoFormularioPublicado } from "../../fuentes/AvisoFormularioPublicado";
import { NuevaBaseArchivos } from "../../fuentes/NuevaBaseArchivos";
import { NuevaBaseFormularioPublicado } from "../../fuentes/NuevaBaseFormularioPublicado";
import { useFormulariosPublicados } from "../../fuentes/useFormulariosPublicados";
import { IndependentSiblingsSurveyMonkeyWizard } from "../../independiente/IndependentSiblingsWizard";
import { IntegratedInstrumentsWizard } from "../../IntegratedInstrumentsWizard";
import { PANEL_AGREGAR_BASE } from "../../panelesCarga";
import type { MultiBaseStrategy } from "../../store";
import {
  origenDeLaDireccion,
  origenesDeAlta,
  previstasVisibles,
  searchConAgregarBase,
  searchSinPanelNiFoco,
  type OrigenDeAlta,
} from "./agregarBaseModel";

export type AgregarBaseProps = {
  varias: boolean;
  estrategia: MultiBaseStrategy;
  estudio: EstudioPayload | null;
  /** Con una base que ya existe el recorrido cambia su fuente: no agrega otra. */
  cambiaFuente: boolean;
  ocupado: boolean;
  /** La página prepara lo suyo para el origen (proveedor del catálogo, modo de carga). */
  onOrigen: (origen: OrigenDeAlta) => void;
  panelPlataforma: ReactNode;
  panelMonitoreo: ReactNode;
  subidaDeUnaBase: ReactNode;
  onEstudioCambiado: (payload: EstudioPayload) => Promise<void>;
  onBaseSavRegistrada: () => void;
  entradasPrevistas: number;
  /** Las entradas que ya existen: el número previsto no baja de ahí. */
  entradasMinimas: number;
  onEntradasPrevistas: (valor: number) => void;
  hayFormularioDeSesion: boolean;
  /**
   * El error de la última operación de carga. Se dibuja dentro del diálogo: en
   * la pila de avisos de la página quedaba detrás del velo y no se veía.
   */
  errorDeCarga?: string;
};

export function AgregarBase(props: AgregarBaseProps) {
  const panel = usePanelDireccionable(PANEL_AGREGAR_BASE);
  const location = useLocation();
  const navigate = useNavigate();
  const cerrar = () => navigate({ pathname: location.pathname, search: searchSinPanelNiFoco(location.search) }, { replace: true });
  // El paso "Origen" es una lista fija de orígenes: el diálogo abraza su
  // contenido. El paso "Datos" monta asistentes que cambian de contenido: alto
  // fijo con el cuerpo dueño del scroll (política de `Dialog`, C2).
  const enOrigen = origenDeLaDireccion(location.search) === null;
  return (
    <Dialog
      open={panel.abierto}
      onOpenChange={(abierto) => { if (!abierto) cerrar(); }}
      size="lg"
      alto={enOrigen ? "contenido" : "fijo"}
      title={props.cambiaFuente ? "Cambiar la fuente" : "Agregar base"}
      icon={<Plus size={16} aria-hidden="true" />}
      closeLabel="Cerrar el recorrido para agregar una base"
      className="pulso-bases-agregar"
    >
      {panel.abierto ? <Recorrido {...props} onCerrar={cerrar} /> : null}
    </Dialog>
  );
}

function Recorrido({
  varias,
  estrategia,
  estudio,
  cambiaFuente,
  ocupado,
  onOrigen,
  panelPlataforma,
  panelMonitoreo,
  subidaDeUnaBase,
  onEstudioCambiado,
  onBaseSavRegistrada,
  entradasPrevistas,
  entradasMinimas,
  onEntradasPrevistas,
  hayFormularioDeSesion,
  errorDeCarga,
  onCerrar,
}: AgregarBaseProps & { onCerrar: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Con una base el recorrido no ofrece "Formulario publicado": no se pide el catálogo.
  const publicados = useFormulariosPublicados(varias);
  const opciones = origenesDeAlta({ varias, estrategia, hayPublicados: publicados.formularios.length > 0 });
  const pedido = origenDeLaDireccion(location.search);
  // Un origen que esta relación no ofrece (un enlace viejo) vuelve al primer paso.
  const origen = pedido && opciones.some((o) => o.id === pedido) ? pedido : null;
  const ir = (siguiente: OrigenDeAlta | null) =>
    navigate({ pathname: location.pathname, search: searchConAgregarBase(location.search, siguiente) }, { replace: true });

  // Solo al cambiar de origen: `onOrigen` es una función nueva en cada render de la página.
  const avisarOrigen = useRef(onOrigen);
  avisarOrigen.current = onOrigen;
  useEffect(() => {
    if (origen) avisarOrigen.current(origen);
  }, [origen]);

  const opcion = opciones.find((o) => o.id === origen) ?? null;
  const bases = estudio ? Object.values(estudio.bases ?? {}) : [];
  const previstas = previstasVisibles({ estrategia, previstas: entradasPrevistas, existentes: entradasMinimas });

  return (
    <div className="pulso-bases-recorrido">
      <StageStepper
          ariaLabel={cambiaFuente ? "Pasos para cambiar la fuente" : "Pasos para agregar una base"}
          stages={[
            { key: "origen", label: "Origen", description: opcion?.rotulo, completed: Boolean(opcion) },
            { key: "datos", label: "Datos", disabled: !opcion, disabledReason: "Elige primero el origen" },
          ]}
          currentStage={opcion ? "datos" : "origen"}
          onStageChange={(paso) => { if (paso === "origen") ir(null); }}
      />
      {errorDeCarga ? <ErrorBlock label="No se pudo completar la carga" detail={errorDeCarga} /> : null}
      {cambiaFuente ? (
        <p className="pulso-bases-dato">Lo que traigas reemplaza el formulario o las respuestas que tiene la base.</p>
      ) : null}
      {opcion === null ? (
        <ul className="pulso-bases-origenes" aria-label={cambiaFuente ? "Origen de la base" : "Origen de la base nueva"}>
          {opciones.map((o) => {
            const Icono = ICONO_DE_ALTA[o.id];
            return (
              <li key={o.id}>
                <button type="button" className="pulso-bases-origen" data-origen={o.id} onClick={() => ir(o.id)}>
                  <span className="pulso-bases-tesela"><Icono size={16} aria-hidden="true" /></span>
                  <span className="pulso-bases-origen-texto">
                    <strong>{o.rotulo}</strong>
                    <small>{o.ayuda}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="pulso-bases-recorrido-datos" data-origen={opcion.id}>
          {opcion.id === "formulario" && estudio ? (
            <NuevaBaseFormularioPublicado
              estudio={estudio}
              formularios={publicados.formularios}
              onCreada={async () => { await onEstudioCambiado(await apiEstudioGet()); onCerrar(); }}
            />
          ) : opcion.id === "surveymonkey" || opcion.id === "kobo" ? (
            panelPlataforma
          ) : opcion.id === "monitoreo" ? (
            panelMonitoreo
          ) : opcion.id === "sav" ? (
            <BaseSavPanel embebido disabled={ocupado} onRegistrada={() => { onBaseSavRegistrada(); onCerrar(); }} />
          ) : opcion.id === "archivos" ? (
            varias && estudio ? (
              <>
                <AvisoFormularioPublicado cuantos={publicados.formularios.length} onUsar={() => ir("formulario")} />
                <NuevaBaseArchivos estudio={estudio} onCambio={onEstudioCambiado} />
              </>
            ) : (
              subidaDeUnaBase
            )
          ) : opcion.id === "varias" && estudio ? (
            <>
            <EntradasPrevistas
              estrategia={estrategia}
              valor={previstas.valor}
              minimo={previstas.minimo}
              existentes={entradasMinimas}
              ocupado={ocupado}
              onCambio={onEntradasPrevistas}
            />
            {estrategia === "integrated" ? (
              <IntegratedInstrumentsWizard
                canonicalOptions={opcionesCanonicas(bases, hayFormularioDeSesion)}
                plannedInputCount={entradasPrevistas}
                disabled={ocupado}
                onImported={async (payload) => { await onEstudioCambiado(payload); onCerrar(); }}
              />
            ) : estrategia === "independent" ? (
              <IndependentSiblingsSurveyMonkeyWizard
                estudio={estudio}
                plannedInputCount={entradasPrevistas}
                canonicalOptions={opcionesCanonicas(bases, hayFormularioDeSesion)}
                disabled={ocupado}
                onImported={async (payload) => {
                  await onEstudioCambiado(payload);
                  window.dispatchEvent(new Event("pulso:session-changed"));
                  window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
                    detail: { active: payload.active_base, processing_mode: payload.processing_mode },
                  }));
                }}
              />
            ) : (
              <CargaManualBaseLanes
                plannedInputCount={previstas.valor}
                bases={bases}
                disabled={ocupado || estudio.n_bases >= estudio.max_bases}
                onChanged={onEstudioCambiado}
              />
            )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
