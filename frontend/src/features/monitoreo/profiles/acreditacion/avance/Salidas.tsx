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
import "../insumos/insumos.css";
import "../insumos/reglas/reglas.css";

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
      <div className="acr-sa-arriba" data-qa-geometry-group="acreditacion-avance-salidas" data-qa-geometry-contract="equal">
        <section className="acr-av-panel" aria-label="Publicaciones frente al corte" data-qa-geometry-member>
          <header className="acr-av-panel-cabecera">
            <h3>Publicaciones frente al corte <span className="acr-av-tenue">{corte ? `Corte ${corteCorto(corte)}` : "Sin corte"}</span></h3>
          </header>
          <ul className="acr-sa-puntos acr-sa-cuerpo">
            {publicaciones.map((item) => (
              <li key={item.salida} className={item.alDia ? "is-ok" : "is-pendiente"}>
                <span>
                  {item.enlace
                    ? <a href={item.enlace} target="_blank" rel="noreferrer" className="acr-in-enlace">{item.salida} <ExternalLink size={12} aria-hidden="true" /></a>
                    : item.salida}
                </span>
                <b>{item.fecha ? `${corteCorto(item.fecha)}, ${item.alDia ? "al día" : item.alDia === false ? "anterior al corte" : "sin corte para comparar"}` : "Sin publicar"}</b>
              </li>
            ))}
          </ul>
        </section>
        <section className="acr-av-panel" aria-label="Cierre del campo" data-qa-geometry-member>
          <header className="acr-av-panel-cabecera">
            <h3>Cierre del campo</h3>
            {cierre.cerrado ? null : (
              <button type="button" className="acr-av-boton is-primario" onClick={onAbrirCierre} disabled={!onAbrirCierre}>
                <FileCheck2 size={14} aria-hidden="true" /> Cerrar campo
              </button>
            )}
          </header>
          <div className="acr-sa-cuerpo">
            {cierre.cerrado ? <Alert kind="info">{`Campo cerrado${cierre.cierreAt ? ` el ${corteCorto(cierre.cierreAt)}` : ""}.`}</Alert> : null}
            <ul className="acr-sa-puntos">
              {cierre.puntos.map((punto) => (
                <li key={punto.rotulo} className={punto.estado === "ok" ? "is-ok" : "is-pendiente"}><span>{punto.rotulo}</span><b>{punto.valor}</b></li>
              ))}
            </ul>
          </div>
        </section>
      </div>
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
