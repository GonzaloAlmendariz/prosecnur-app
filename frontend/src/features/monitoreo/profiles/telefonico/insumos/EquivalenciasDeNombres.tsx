import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "../../../../../vendor/lucide-react";
import { apiMonitoreoConfig } from "../../../../../api/monitoreo";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { filasDeEquivalencia, paresParaGuardar, type Par } from "./equivalenciasModel";

const ROTULO = { confirmada: "Confirmada", sugerida: "Sugerida", sin_pareja: "Sin pareja" } as const;

/**
 * Insumos › Llave y filtros › Enumerador y responsable (P4): el enumerador de
 * Kobo y el responsable de la hoja son la misma persona escrita de dos formas.
 * Cada enumerador sin igual en la hoja trae una sugerencia por parecido; el
 * equipo la confirma o elige otro nombre, y se guarda en el perfil.
 */
export function EquivalenciasDeNombres({
  reports,
  state,
  onStateChange,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const perfil = state?.config?.monitoreo_profile;
  const { filas, responsables, mismoNombre } = useMemo(() => filasDeEquivalencia(reports, perfil), [reports, perfil]);
  const inicial = useMemo(() => filas.map(({ kobo, hoja }) => ({ kobo, hoja })), [filas]);
  const [borrador, setBorrador] = useState<Par[]>(inicial);
  const [envio, setEnvio] = useState<{ guardando: boolean; error: string }>({ guardando: false, error: "" });
  useEffect(() => setBorrador(inicial), [inicial]);
  const guardadas = paresParaGuardar(filas.filter((fila) => fila.estado === "confirmada"));
  const sucio = JSON.stringify(paresParaGuardar(borrador)) !== JSON.stringify(guardadas);

  const guardar = async () => {
    if (!state?.config) return;
    setEnvio({ guardando: true, error: "" });
    try {
      const result = await apiMonitoreoConfig({
        ...state.config,
        monitoreo_profile: { ...state.config.monitoreo_profile, enumerator_equivalences: paresParaGuardar(borrador) },
      });
      onStateChange?.(result.state);
      setEnvio({ guardando: false, error: "" });
    } catch (error) {
      setEnvio({ guardando: false, error: (error as Error).message });
    }
  };

  return (
    <section className="mon-ctl-panel mon-equivalencias" aria-label="Enumerador de Kobo y responsable de la hoja">
      <header className="mon-insumos-cabecera">
        <strong>Enumerador y responsable</strong>
        <span>{filas.length ? `${filas.length} por confirmar o confirmados` : ""}</span>
        {filas.length ? (
          <button
            type="button"
            className="mon-insumos-boton is-primario"
            disabled={!sucio || envio.guardando || !state?.config}
            onClick={() => { void guardar(); }}
          >
            {envio.guardando ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
            <span>{envio.guardando ? "Guardando…" : "Confirmar nombres"}</span>
          </button>
        ) : null}
      </header>
      {envio.error ? <NotaDelModo tono="error" estado className="mon-equivalencias-nota">{envio.error}</NotaDelModo> : null}
      {filas.length ? (
        <table className="mon-ctl-tabla mon-equivalencias-tabla">
          <thead>
            <tr>
              <th scope="col">Enumerador en Kobo</th>
              <th scope="col">Responsable en la hoja</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={fila.kobo}>
                <th scope="row">
                  {fila.kobo}
                  {fila.envios != null ? <small className="mon-equivalencias-envios">{fila.envios.toLocaleString("es-PE")} envíos</small> : null}
                </th>
                <td>
                  <select
                    value={borrador[i]?.hoja ?? ""}
                    aria-label={`Responsable en la hoja para ${fila.kobo}`}
                    onChange={(event) => {
                      const hoja = event.currentTarget.value;
                      setBorrador((actual) => actual.map((par, j) => (j === i ? { ...par, hoja } : par)));
                    }}
                  >
                    <option value="">No es nadie de la hoja</option>
                    {responsables.map((nombre) => <option key={nombre} value={nombre}>{nombre}</option>)}
                  </select>
                </td>
                <td>
                  <span className={`mon-insumos-estado${fila.estado === "confirmada" ? " is-encendido" : ""}`} title={fila.criterio || undefined}>{ROTULO[fila.estado]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <NotaDelModo tono={filas.length ? "info" : "neutro"} className="mon-equivalencias-nota">
        {filas.length
          ? "La misma persona escrita de dos formas. Discrepancias deja de marcarla como otra persona al confirmar."
          : mismoNombre > 0
            ? `Los ${mismoNombre.toLocaleString("es-PE")} enumeradores de Kobo se llaman igual en la hoja.`
            : "Sin enumeradores de Kobo en este corte."}
      </NotaDelModo>
    </section>
  );
}
