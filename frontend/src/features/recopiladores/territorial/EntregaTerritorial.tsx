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
import { CalendarDays, Users } from "../../../vendor/lucide-react";
import { Link } from "react-router-dom";
import { serializarDireccion } from "../../../lib/navegacion/direccion";

import type { UnidadesTerritoriales } from "../../../api/materialTerritorial";
import { apiMaterialTerritorialHojaDia, apiMaterialTerritorialPlan } from "../../../api/materialTerritorialPlan";
import { PlanCampo, type FuenteDelPlan } from "../../hojasRuta/mapa/seleccion/PlanCampo";
import { BarraAsignacion, useAsignacionEquipo } from "./AsignacionEquipo";
import "./asignacion.css";
import { AvisoDesactualizada, VacioSinFuente } from "./UnidadesTerritoriales";
import { Panel } from "../../../components/Panel";
import { TableroDeEntrega } from "./TableroDeEntrega";
import { armarTablero } from "./modeloTablero";
import { ZonasAsignadas } from "./ZonasAsignadas";
import "./paquetes.css";
import "./tableroEntrega.css";
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
  const tablero = useMemo(() => armarTablero(unidades, asignacion.datos), [unidades, asignacion.datos]);
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
      {/* Vista faro (2 nov 2026): la entrega se lee como un tablero —cifras, reparto por distrito y equipo—
          y cada parte vive en su tarjeta con cabecera. */}
      {!enCuotas && conFoto ? <TableroDeEntrega tablero={tablero} /> : null}
      <div className="rec-terr-tarjetas" data-qa-geometry-group="material-campo/territorial/entrega" data-qa-geometry-contract="intrinsic">
        {/* R15 del mapa de responsabilidades (2 nov 2026): en territorial no hay Sheets de por medio; Monitoreo
            consulta esta asignación guardada (asignacion-planificada) y la cruza con lo que llega del campo. */}
        <Panel
          data-qa-geometry-member
          title={<><Users size={16} aria-hidden /> Asignación del equipo</>}
          hint={<>Es la que Monitoreo compara con lo que llega del campo, en <Link to={A_MONITOREO_EQUIPO}>Control › Equipo</Link>.</>}
        >
          {/* Material no lleva costos ni precios: de eso se encarga otra persona (Gonzalo, 2026-10-30). */}
          <BarraAsignacion {...asignacion} unidad={enCuotas ? "zona" : "ump"} />
        </Panel>
        <Panel
          className="rec-terr-plan"
          data-qa-geometry-member
          title={<><CalendarDays size={16} aria-hidden /> Plan de campo</>}
          hint={enCuotas
            ? "El plan por jornadas se arma con UMP; para una muestra por cuotas todavía no existe."
            : "Cada jornada es un día de un encuestador, con titulares cercanas del mismo distrito."}
        >
          {/* Revamp v5: el plan por jornadas se arma con UMP; para cuotas no se inventa (coordinación, 2 nov 2026):
              en cuotas ya no se pinta el formulario apagado, basta la línea de la cabecera. */}
          {!enCuotas ? (
            <PlanCampo guardados={hojas?.ui_state?.plan_campo} deshabilitado={!conFoto} onGuardar={onGuardarPlan} conCostos={false} cabezaEncuestador={cabeza} fuente={fuente} />
          ) : null}
          {!enCuotas && !conFoto ? <p className="rec-terr-nota">La muestra enviada no trae UMP con las que armar el plan.</p> : null}
        </Panel>
      </div>
    </div>
  );
}
