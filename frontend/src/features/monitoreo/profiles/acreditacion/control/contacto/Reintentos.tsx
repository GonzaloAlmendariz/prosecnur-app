import { useMemo } from "react";
import { Alert } from "../../../../../../components/Alert";
import type { MonitoreoAcreditacionReports, MonitoreoSource, MonitoreoState } from "../../../../../../api/client";
import { ColaDeInsistencia } from "../../../../core/ColaDeInsistencia";
import { conDiasAlCorte } from "../../../../core/colaDeInsistenciaModel";
import { estadoDeInsistencia, repartoDelEquipo } from "../../../telefonico/control/insistenciaModel";
import { fmt } from "../../formato";

/**
 * Plataforma de las respuestas del barrido, para rotular la efectiva en la
 * cola: la que declaran las fuentes de respuestas del estudio. Si son varias
 * o ninguna, «la encuesta».
 */
export function plataformaDeRespuestas(fuentes: readonly MonitoreoSource[]): string {
  const NOMBRE: Record<string, string> = { surveymonkey: "SurveyMonkey", kobo: "Kobo" };
  const nombres = new Set(
    fuentes
      .filter((fuente) => fuente.enabled && String(fuente.role ?? "") === "respuestas")
      .map((fuente) => NOMBRE[String(fuente.kind ?? "").toLowerCase()])
      .filter((nombre): nombre is string => Boolean(nombre)),
  );
  return nombres.size === 1 ? [...nombres][0] : "la encuesta";
}

function corteDiaMes(valor: string | null | undefined) {
  const fecha = new Date(String(valor ?? ""));
  if (Number.isNaN(fecha.getTime())) return "";
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}`;
}

/** Chips de la cabecera: casos en cola y cuántos ya tienen efectiva en la plataforma. */
export function chipsDeReintentos(reports: MonitoreoAcreditacionReports | null | undefined, plataforma: string): string[] {
  const estado = estadoDeInsistencia(reports);
  if (estado.clave !== "lista") return [];
  const ya = estado.casos.filter((caso) => caso.efectivaKobo).length;
  return [
    `${fmt(estado.casos.length)} ${estado.casos.length === 1 ? "caso" : "casos"} en la cola`,
    ya === 0 ? `Ninguno ya efectivo en ${plataforma}` : `${fmt(ya)} ya ${ya === 1 ? "es efectiva" : "son efectivas"} en ${plataforma}`,
  ];
}

/**
 * Control › Reintentos (ficha Ctl3): en qué casos se sigue insistiendo. Monta
 * la cola común del telefónico con el bloque `cola_insistencia` del barrido de
 * la acreditación. Al frente status, intentos y observación; el supervisor
 * decide si se deja de insistir y la asignación se cambia en la hoja.
 */
export function Reintentos({
  reports,
  state,
  onActualizar,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
  onActualizar?: () => void;
}) {
  const estado = useMemo(() => estadoDeInsistencia(reports), [reports]);
  const casos = useMemo(
    () => (estado.clave === "lista" ? conDiasAlCorte(estado.casos, state?.synced_at) : []),
    [estado, state?.synced_at],
  );
  const plataforma = plataformaDeRespuestas(state?.sources ?? []);

  if (estado.clave === "sin-hoja") {
    return (
      <div className="mon-cola-estado" aria-label="Reintentos">
        <Alert kind="info">Ningún público tiene hoja de barrido conectada. Se conecta en Insumos › Fuentes.</Alert>
      </div>
    );
  }
  if (estado.clave === "preparando") {
    return (
      <div className="mon-cola-estado" aria-label="Reintentos" aria-live="polite">
        <Alert kind="info">Este corte se calculó antes de que existiera la cola de reintentos. Actualizar la arma con la hoja de barrido actual.</Alert>
        {onActualizar ? <button type="button" className="mon-cola-estado-accion" onClick={onActualizar}>Actualizar</button> : null}
      </div>
    );
  }
  return (
    <ColaDeInsistencia
      casos={casos}
      responsables={estado.responsables}
      columnas={{ categoria: "Público", telefono: casos.some((caso) => caso.ordenTelefono != null), plataforma }}
      reparto={repartoDelEquipo(estado.responsables, reports)}
      corte={corteDiaMes(state?.synced_at)}
    />
  );
}
