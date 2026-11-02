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
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { serializarDireccion } from "../../../lib/navegacion/direccion";

import type { UnidadesTerritoriales } from "../../../api/materialTerritorial";
import { apiMaterialTerritorialHojaDia, apiMaterialTerritorialPlan } from "../../../api/materialTerritorialPlan";
import { PlanCampo, type FuenteDelPlan } from "../../hojasRuta/mapa/seleccion/PlanCampo";
import { BarraAsignacion, useAsignacionEquipo } from "./AsignacionEquipo";
import "./asignacion.css";
import { AvisoDesactualizada, VacioSinFuente } from "./UnidadesTerritoriales";
import { ZonasAsignadas } from "./ZonasAsignadas";
import "./paquetes.css";
import "./unidades.css";

/** Donde Monitoreo cruza lo asignado con lo observado. */
const A_MONITOREO_EQUIPO = serializarDireccion({ modulo: "monitoreo", modo: "territorial", seccion: "control", pestana: "equipo" });

type Props = {
  unidades: UnidadesTerritoriales | null;
  hojas: HojasRutaState | null;
  onGuardarPlan: (s: HojasRutaPlanSupuestos) => Promise<void>;
};

export function EntregaTerritorial({ unidades, hojas, onGuardarPlan }: Props) {
  // Decisión I3: quién hace cada columna, elegido de la lista de encuestadores de Monitoreo.
  const { cabeza, ...asignacion } = useAsignacionEquipo(unidades?.campaign_id || null);
  // P6: el plan y la hoja del día salen de la foto enviada, no de la muestra viva.
  const campaignId = unidades?.campaign_id || "";
  const fuente = useMemo<FuenteDelPlan>(() => ({
    plan: (s) => apiMaterialTerritorialPlan(campaignId, s),
    hojaDia: (jornada, s) => apiMaterialTerritorialHojaDia(campaignId, jornada, s),
  }), [campaignId]);
  if (!unidades) {
    return (
      <div className="rec-terr-seccion" data-qa-geometry-capacity="owned">
        <VacioSinFuente mensaje={null} />
      </div>
    );
  }
  const conFoto = unidades.units.length > 0;
  const enCuotas = unidades.kind === "cuotas";
  return (
    <div className="rec-terr-seccion">
      {unidades.stale ? <AvisoDesactualizada enviadoAt={unidades.enviado_at} /> : null}
      {enCuotas ? <ZonasAsignadas zonas={unidades.zonas} asignacion={asignacion.datos} /> : null}
      <div className="rec-terr-tarjetas" data-qa-geometry-group="material-campo/territorial/entrega" data-qa-geometry-contract="intrinsic">
        <article className="rec-terr-tarjeta rec-terr-plan" data-qa-geometry-member>
          {!enCuotas ? (
            <p className="rec-terr-nota">
              Cada jornada es un día de un encuestador, con titulares cercanas del mismo distrito, armadas con la muestra enviada.
              Los supuestos se guardan en el proyecto y los lee también Hojas de ruta.
            </p>
          ) : null}
          {/* Material no lleva costos ni precios: de eso se encarga otra persona (Gonzalo, 2026-10-30). */}
          <BarraAsignacion {...asignacion} unidad={enCuotas ? "zona" : "ump"} />
          {/* R15 del mapa de responsabilidades (2 nov 2026): en territorial no hay Sheets de por medio; Monitoreo
              consulta esta asignación guardada (asignacion-planificada) y la cruza con lo que llega del campo. */}
          <p className="rec-terr-nota">
            La asignación que se guarda aquí es la que Monitoreo compara con lo que llega del campo, en{" "}
            <Link to={A_MONITOREO_EQUIPO}>Control › Equipo</Link>.
          </p>
          <PlanCampo guardados={hojas?.ui_state?.plan_campo} deshabilitado={!conFoto} onGuardar={onGuardarPlan} conCostos={false} cabezaEncuestador={cabeza} fuente={fuente} />
          {/* Revamp v5: el plan por jornadas se arma con UMP; para cuotas todavía no existe y no se inventa
              (coordinación, 2 nov 2026). Se deja como está y se dice. */}
          {!conFoto ? <p className="rec-terr-nota">{enCuotas ? "El plan por jornadas todavía no existe para muestras por cuotas." : "La muestra enviada no trae UMP con las que armar el plan."}</p> : null}
        </article>
      </div>
    </div>
  );
}
