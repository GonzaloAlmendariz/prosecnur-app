// W8 del rediseño (2026-10-15): Previsualizar el Word real. Genera el documento con el mismo job que Exportar y lo pasa
// por el visor (`/api/graficos/word/visor`), que devuelve sus páginas como imágenes. Es la última versión generada, no
// una vista en vivo: tarda lo mismo que exportar. Panel direccionable (`?panel=previa-word`); al abrirse sin páginas,
// genera. La lógica viene del antiguo `estilo/VistaPreviaWord.tsx`, que sólo mostraba portada y contraportada.

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect } from "react";
import { apiGraficosWord } from "../../../api/graficos";
import { apiGraficosWordVisor, normalizarVisorWord } from "../../../api/graficosRecursos";
import { JobProgress } from "../../../components/JobProgress";
import { PulsoButton } from "../../../components/PulsoButton";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { RotateCcw, X } from "../../../vendor/lucide-react";
import { buildGraficosConfigFromStore } from "../configSnapshot";
import { motivoSinVistaPrevia } from "../estilo/disponibilidadEstilo";
import { useEstiloUi } from "../estilo/estiloUiStore";
import { PANEL_PREVIA_WORD } from "../panelesGraficos";
import { usePlanStore } from "../store";

type WordExportado = { file_id?: string };
const mensajeDe = (e: unknown) => (e instanceof Error && e.message ? e.message : "No se pudo generar el Word.");

/** Botón de la cabecera y el panel. `prepOk`: la analítica está lista (sin ella no hay Word que generar). */
export function PreviaWord({ prepOk }: { prepOk: boolean }) {
  const panel = usePanelDireccionable(PANEL_PREVIA_WORD);
  const laminas = usePlanStore((s) => s.plan.slides.length);
  const vista = useEstiloUi((s) => s.vistaPrevia);
  const setVista = useEstiloUi((s) => s.setVistaPrevia);
  const ocupado = vista.fase === "exportando" || vista.fase === "convirtiendo";
  const motivo = motivoSinVistaPrevia({ prepOk, laminas, ocupado: false });

  const generar = async () => {
    setVista({ fase: "exportando", jobId: null, mensaje: "" });
    try {
      const config = buildGraficosConfigFromStore();
      const job = await apiGraficosWord(config.plan, config.presets, config.w_presets, config);
      setVista({ jobId: job.job_id });
    } catch (error) {
      setVista({ fase: "error", jobId: null, mensaje: mensajeDe(error) });
    }
  };
  const convertir = async (data: WordExportado) => {
    setVista({ fase: "convirtiendo", jobId: null });
    try {
      const job = await apiGraficosWordVisor(typeof data.file_id === "string" && data.file_id ? data.file_id : undefined);
      setVista({ jobId: job.job_id });
    } catch (error) {
      setVista({ fase: "error", jobId: null, mensaje: mensajeDe(error) });
    }
  };
  const mostrar = (raw: unknown) => {
    const visor = normalizarVisorWord(raw);
    setVista({ fase: "lista", jobId: null, paginas: visor.paginas, exportado: visor.exportado,
      mensaje: visor.paginas.length ? "" : "El visor no devolvió páginas. Abre el Word exportado para revisarlo." });
  };
  const fallo = (m: string) => setVista({ fase: "error", jobId: null, mensaje: m || "No se pudo generar el Word." });
  const cancelado = () => setVista({ fase: "inactiva", jobId: null });

  // Abrir sin páginas genera; con páginas, muestra las últimas (y deja volver a generar).
  useEffect(() => {
    if (panel.abierto && vista.fase === "inactiva" && !motivo) void generar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel.abierto]);

  return (
    <>
      <PulsoButton variant="secondary" size="sm" onClick={panel.abrir} disabled={!!motivo} title={motivo ?? undefined}>
        Previsualizar
      </PulsoButton>
      <Dialog.Root open={panel.abierto} onOpenChange={(a) => { if (!a) panel.cerrar(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="pulso-f6-pw-velo" />
          <Dialog.Content className="pulso-f6-pw" aria-describedby="f6-pw-nota" {...panel.props} data-qa-surface="graficos/f6-previa-word">
            <header className="pulso-f6-pw-cabeza">
              <Dialog.Title className="pulso-f6-pw-titulo">Vista previa del Word</Dialog.Title>
              <span className="pulso-f6-pw-acciones">
                {(vista.fase === "lista" || vista.fase === "error") && (
                  <PulsoButton variant="ghost" size="sm" onClick={() => void generar()}><RotateCcw size={14} aria-hidden="true" />Volver a generar</PulsoButton>
                )}
                <Dialog.Close asChild><PulsoButton variant="icon" size="sm" aria-label="Cerrar la vista previa"><X size={16} aria-hidden="true" /></PulsoButton></Dialog.Close>
              </span>
            </header>
            <p id="f6-pw-nota" className="pulso-f6-pw-nota">Es la última versión generada, con sus cifras. Tarda lo mismo que exportar.</p>
            <div className="pulso-f6-pw-cuerpo" data-qa-scroll-owner="previa-word">
              {vista.jobId && vista.fase === "exportando" && (
                <JobProgress<WordExportado> label="Generando el Word" jobId={vista.jobId} onDone={(d) => void convertir(d)} onError={fallo} onCancelled={cancelado} />
              )}
              {vista.jobId && vista.fase === "convirtiendo" && (
                <JobProgress<unknown> label="Preparando las páginas" jobId={vista.jobId} onDone={mostrar} onError={fallo} onCancelled={cancelado} />
              )}
              {ocupado && !vista.jobId && <p className="pulso-f6-pw-estado" role="status">Preparando el documento</p>}
              {vista.fase === "error" && <p className="pulso-f6-pw-estado is-error" role="alert">{vista.mensaje}</p>}
              {vista.fase === "lista" && vista.mensaje && <p className="pulso-f6-pw-estado">{vista.mensaje}</p>}
              {vista.paginas.length > 0 && (
                <div className={`pulso-f6-pw-paginas${ocupado ? " is-vieja" : ""}`} data-qa-geometry-group="graficos/f6-pw-paginas" data-qa-geometry-contract="equal">
                  {vista.paginas.map((src, i) => (
                    <figure key={i} className="pulso-f6-pw-pagina" data-qa-geometry-member>
                      <img src={src} alt={`Página ${i + 1} del Word`} loading="lazy" />
                      <figcaption>{i + 1}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
