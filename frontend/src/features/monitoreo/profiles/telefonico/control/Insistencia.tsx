import { useMemo } from "react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { ColaDeInsistencia } from "../../../core/ColaDeInsistencia";
import { conDiasAlCorte, telefonosPorCaso, type CasoDeCola } from "../../../core/colaDeInsistenciaModel";
import { nombreDelSegmento, rotuloDelSegmento } from "../segmentoDeCuotas";
import { estadoDeInsistencia, repartoDelEquipo } from "./insistenciaModel";
import { RotuloDePestana, useHayRotulo } from "../navegacion/RotuloDePestana";
import "./controlTelefonico.css";

function corteCorto(valor: string | null | undefined) {
  const fecha = new Date(String(valor ?? ""));
  if (Number.isNaN(fecha.getTime())) return "";
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}`;
}

/** Condicional de Medios de Vida 2026: cuántos teléfonos tiene cada caso en cola. */
function TelefonosPorCaso({ casos }: { casos: readonly CasoDeCola[] }) {
  const reparto = telefonosPorCaso(casos);
  if (!reparto.length) return null;
  const maximo = Math.max(...reparto.map((item) => item.casos));
  return (
    <section className="mon-cola-panel mon-cola-telefonos" aria-label="Teléfonos por caso">
      <header className="mon-cola-panel-cabecera">
        <span className="mon-cola-antetitulo">Teléfonos por caso</span>
        <span className="mon-cola-condicional">Condicional</span>
      </header>
      <ul>
        {reparto.map((item) => (
          <li key={item.telefonos}>
            <span>{item.telefonos.toLocaleString("es-PE")} {item.telefonos === 1 ? "número" : "números"}</span>
            <i aria-hidden="true"><b style={{ width: `${(item.casos / maximo) * 100}%` }} /></i>
            <strong className="is-num">{item.casos.toLocaleString("es-PE")}</strong>
          </li>
        ))}
      </ul>
      <p>De los casos en cola. La hoja anota con qué teléfono va cada caso.</p>
    </section>
  );
}

/**
 * Control › Insistencia del telefónico (ficha «Control, Insistencia»): monta
 * la cola común con lo que trae el bloque `cola_insistencia`. Si el corte
 * guardado es anterior al bloque, dice «Preparando» e invita a actualizar sin
 * vaciar la pantalla.
 */
export function Insistencia({
  reports,
  state,
  onActualizar,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
  onActualizar?: () => void;
}) {
  const estado = useMemo(() => estadoDeInsistencia(reports), [reports]);
  const hayRotulo = useHayRotulo();
  const casos = useMemo(
    () => (estado.clave === "lista" ? conDiasAlCorte(estado.casos, state?.synced_at) : []),
    [estado, state?.synced_at],
  );
  if (estado.clave === "sin-hoja") {
    return (
      <section className="mon-cola-estado" aria-label="Insistencia">
        {hayRotulo ? <RotuloDePestana /> : <span className="mon-cola-antetitulo">Insistencia</span>}
        <strong>Sin hoja de barrido</strong>
        <p>Conecta la hoja de barrido en Insumos, Fuentes.</p>
      </section>
    );
  }
  if (estado.clave === "preparando") {
    return (
      <section className="mon-cola-estado" aria-label="Insistencia" aria-live="polite">
        {hayRotulo ? <RotuloDePestana /> : null}
        <span className="mon-cola-antetitulo">Preparando</span>
        <strong>Este corte todavía no trae la cola de insistencia</strong>
        <p>El proyecto se calculó antes de que existiera. Actualizar la arma con la hoja de barrido actual.</p>
        {onActualizar ? <button type="button" className="mon-cola-estado-accion" onClick={onActualizar}>Actualizar</button> : null}
      </section>
    );
  }
  const variable = rotuloDelSegmento(nombreDelSegmento(casos.map((caso) => caso.variableCuota), "Cuota"));
  const conTelefono = casos.some((caso) => caso.ordenTelefono != null);
  const cola = (
    <ColaDeInsistencia
      casos={casos}
      responsables={estado.responsables}
      columnas={{ categoria: variable, telefono: conTelefono }}
      reparto={repartoDelEquipo(estado.responsables, reports)}
      corte={corteCorto(state?.synced_at)}
      bajoLosResponsables={conTelefono ? <TelefonosPorCaso casos={casos} /> : null}
    />
  );
  if (!hayRotulo) return cola;
  // §2a-bis: el rótulo comparte fila con la barra de filtros de la cola. La
  // cola es común (core/) y no recibe el rótulo: la rejilla de este envoltorio
  // pone el rótulo y la barra en la misma fila, dentro de una sola tarjeta.
  return (
    <div className="mon-tel-insistencia">
      {/* Sin chips: la cola ya dice cuántos casos tiene y cuáles son efectivas en Kobo. */}
      <RotuloDePestana sinChips />
      {cola}
    </div>
  );
}
