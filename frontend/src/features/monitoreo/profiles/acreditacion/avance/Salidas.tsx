import { useEffect, type ReactNode } from "react";
import { ExternalLink, FileCheck2 } from "lucide-react";
import { Alert } from "../../../../../components/Alert";
import type { MonitoreoAcreditacion, MonitoreoLastSheetsPublication } from "../../../../../api/client";
import { usePanelDireccionable, type PanelDeclarado } from "../../../../../lib/navegacion/paneles";
import { corteCorto } from "../../../core/barraComun";
import { useResumenDelCorte } from "../navegacion/resumenDelCorte";
import { DialogoCerrarCampo } from "./DialogoCerrarCampo";
import { estadoDelCierre, publicacionesFrenteAlCorte, type EstadoDelCierre, type PublicacionFrenteAlCorte } from "./salidasModelo";
import "./avance.css";
import "./salidasEntregables.css";
import "../insumos/insumos.css";
import "../insumos/reglas/reglas.css";
import { CabeceraDeTarjeta } from "../navegacion/rotuloDePestana";

/** El cierre del campo es un diálogo direccionable: `panel=cerrar-campo`. */
export const PANEL_CERRAR_CAMPO: PanelDeclarado = { id: "cerrar-campo", label: "Cerrar campo", clase: "dialogo" };

type PropsDeVista = {
  corte: string | null;
  publicaciones: readonly PublicacionFrenteAlCorte[];
  cierre: EstadoDelCierre;
  onAbrirCierre?: () => void;
  /** Las tarjetas de salida de siempre (Sheets, PDF, entrega a Procesamiento). */
  salidas?: ReactNode;
};

export function SalidasVista({ corte, publicaciones, cierre, onAbrirCierre, salidas }: PropsDeVista) {
  return (
    <div className="acr-sa">
      {/* Una sola franja arriba (Gonzalo, 29/10): «Publicaciones frente al corte» repetía el
          estado de Sheets que ya dicen el cierre y la tarjeta de Google Sheets de abajo. */}
      <section className="acr-av-panel" aria-label="Cierre del campo">
        <CabeceraDeTarjeta primera>
          <h3>Cierre del campo <span className="acr-av-tenue">{corte ? `Corte ${corteCorto(corte)}` : "Sin corte"}</span></h3>
          {cierre.cerrado ? null : (
            <button type="button" className="acr-av-boton is-primario" onClick={onAbrirCierre} disabled={!onAbrirCierre}>
              <FileCheck2 size={14} aria-hidden="true" /> Cerrar campo
            </button>
          )}
        </CabeceraDeTarjeta>
        <div className="acr-sa-cuerpo">
          {cierre.cerrado ? <Alert kind="info">{`Campo cerrado${cierre.cierreAt ? ` el ${corteCorto(cierre.cierreAt)}` : ""}.`}</Alert> : null}
          <ul className="acr-sa-puntos is-franja" data-qa-geometry-group="acreditacion-avance-salidas" data-qa-geometry-contract="equal">
            {cierre.puntos.map((punto) => {
              const enlace = punto.rotulo === "Sheets del cliente" ? publicaciones.find((item) => item.salida === "Sheets del cliente")?.enlace : null;
              return (
                <li key={punto.rotulo} className={punto.estado === "ok" ? "is-ok" : "is-pendiente"} data-qa-geometry-member>
                  <span>{enlace ? <a href={enlace} target="_blank" rel="noreferrer" className="acr-in-enlace">{punto.rotulo} <ExternalLink size={12} aria-hidden="true" /></a> : punto.rotulo}</span>
                  <b>{punto.valor}</b>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      {salidas}
    </div>
  );
}

/**
 * Avance › Salidas (ficha A5): las publicaciones frente al corte y el cierre
 * del campo arriba; debajo, las tarjetas de salida de siempre. «Cerrar campo»
 * abre un diálogo con confirmación en vez del «Marcar cierre» suelto.
 */
export function Salidas({
  corte,
  clienteSheets,
  internoSheets,
  acreditacion,
  guardando,
  error,
  onCerrarCampo,
  salidas,
}: {
  corte: string | null;
  clienteSheets: MonitoreoLastSheetsPublication | null | undefined;
  internoSheets: MonitoreoLastSheetsPublication | null | undefined;
  acreditacion: MonitoreoAcreditacion | null | undefined;
  guardando: boolean;
  error?: string | null;
  onCerrarCampo?: (planDeRefuerzo: string, aprobacion: boolean) => Promise<void>;
  salidas?: ReactNode;
}) {
  const avance = useResumenDelCorte((estado) => estado.avance);
  const casos = useResumenDelCorte((estado) => estado.casos);
  const panel = usePanelDireccionable(PANEL_CERRAR_CAMPO);
  const publicaciones = publicacionesFrenteAlCorte(corte, clienteSheets, internoSheets);
  const cierre = estadoDelCierre({ tarjetas: avance?.tarjetas ?? [], esperan: casos?.esperan ?? null, publicaciones, acreditacion });
  // Cerrado el campo, el diálogo ya no tiene nada que confirmar: sale de la dirección.
  const { abierto, cerrar } = panel;
  useEffect(() => {
    if (cierre.cerrado && abierto) cerrar();
  }, [cierre.cerrado, abierto, cerrar]);
  return (
    <>
      <SalidasVista corte={corte} publicaciones={publicaciones} cierre={cierre} onAbrirCierre={onCerrarCampo ? panel.abrir : undefined} salidas={salidas} />
      {panel.abierto && onCerrarCampo && !cierre.cerrado ? (
        <DialogoCerrarCampo
          cierre={cierre}
          planInicial={acreditacion?.plan_refuerzo ?? ""}
          aprobacionInicial={Boolean(acreditacion?.aprobacion_metodologica)}
          guardando={guardando}
          error={error}
          onCerrar={panel.cerrar}
          panelId={PANEL_CERRAR_CAMPO.id}
          onCerrarCampo={(plan, aprobacion) => { void onCerrarCampo(plan, aprobacion); }}
        />
      ) : null}
    </>
  );
}
