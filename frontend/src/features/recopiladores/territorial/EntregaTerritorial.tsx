// Territorial › Entrega › Plan de campo (ADR 0118 §1): las jornadas por
// encuestador y día con su hoja del día. Reutiliza `PlanCampo` de Hojas de ruta
// tal cual (mismo endpoint, mismos supuestos guardados en el proyecto).
//
// El mapa por encuestador (brecha B20) queda como mejora posterior: aquí sólo
// va la lista por día.
//
// Contrato de Superficie: una tarjeta con título (C1), su vacío propio sin
// muestra (C3) y el scroll del panel de la sección (C4).

import type { HojasRutaPlanSupuestos, HojasRutaState } from "../../../api/hojasRuta";
import type { UnidadesTerritoriales } from "../../../api/materialTerritorial";
import { PlanCampo } from "../../hojasRuta/mapa/seleccion/PlanCampo";
import { BarraAsignacion, useAsignacionEquipo } from "./AsignacionEquipo";
import "./asignacion.css";
import { AvisoDesactualizada, VacioSinFuente } from "./UnidadesTerritoriales";

type Props = {
  unidades: UnidadesTerritoriales | null;
  hojas: HojasRutaState | null;
  onGuardarPlan: (s: HojasRutaPlanSupuestos) => Promise<void>;
};

export function EntregaTerritorial({ unidades, hojas, onGuardarPlan }: Props) {
  // Decisión I3: quién hace cada columna, elegido de la lista de encuestadores de Monitoreo.
  const { cabeza, ...asignacion } = useAsignacionEquipo(unidades?.campaign_id || null);
  if (!unidades) {
    return (
      <div className="rec-terr-seccion" data-qa-geometry-capacity="owned">
        <VacioSinFuente mensaje={null} />
      </div>
    );
  }
  const muestra = hojas?.workspace_outputs?.sample ?? null;
  return (
    <div className="rec-terr-seccion">
      {unidades.stale ? <AvisoDesactualizada enviadoAt={unidades.enviado_at} /> : null}
      <div className="rec-terr-tarjetas" data-qa-geometry-group="material-campo/territorial/entrega" data-qa-geometry-contract="intrinsic">
        <article className="rec-terr-tarjeta rec-terr-plan" data-qa-geometry-member>
          <p className="rec-terr-nota">
            Cada jornada es un día de un encuestador, con titulares cercanas del mismo distrito. Los supuestos se guardan en el
            proyecto y los lee también Hojas de ruta.
          </p>
          {/* Material no lleva costos ni precios: de eso se encarga otra persona (Gonzalo, 2026-10-30). */}
          <BarraAsignacion {...asignacion} />
          <PlanCampo guardados={hojas?.ui_state?.plan_campo} deshabilitado={!muestra} onGuardar={onGuardarPlan} conCostos={false} cabezaEncuestador={cabeza} />
          {!muestra ? <p className="rec-terr-nota">Hojas de ruta no tiene una muestra guardada con la que armar el plan.</p> : null}
        </article>
      </div>
    </div>
  );
}
