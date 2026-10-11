// Vista previa del estilo en el Word: regenera el documento con el estilo que se está viendo (mismo job que «Exportar
// Word») y lo convierte en páginas con el visor (`/api/graficos/word/visor`). Se muestran la portada y la contraportada,
// que es donde van los logos. Honesta con el tiempo (dirección F6 §1.5): dice que es la última versión generada, no una
// vista en vivo. Dos marcos fijos (C2) con su vacío propio (C3).

import { apiGraficosWord } from "../../../api/graficos";
import { apiGraficosWordVisor, normalizarVisorWord } from "../../../api/graficosRecursos";
import { JobProgress } from "../../../components/JobProgress";
import { PulsoButton } from "../../../components/PulsoButton";
import { FileText } from "../../../vendor/lucide-react";
import { buildGraficosConfigFromStore } from "../configSnapshot";
import { usePlanStore } from "../store";
import { motivoSinVistaPrevia } from "./disponibilidadEstilo";
import { useEstiloUi } from "./estiloUiStore";

type WordExportado = { file_id?: string };

function mensajeDe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "No se pudo generar el Word.";
}

export function VistaPreviaWord({ prepOk }: { prepOk: boolean }) {
  const laminas = usePlanStore((s) => s.plan.slides.length);
  const vista = useEstiloUi((s) => s.vistaPrevia);
  const setVista = useEstiloUi((s) => s.setVistaPrevia);
  const ocupado = vista.fase === "exportando" || vista.fase === "convirtiendo";
  const motivo = motivoSinVistaPrevia({ prepOk, laminas, ocupado });

  const regenerar = async () => {
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
    const fileId = typeof data.file_id === "string" ? data.file_id : "";
    setVista({ fase: "convirtiendo", jobId: null });
    try {
      const job = await apiGraficosWordVisor(fileId || undefined);
      setVista({ jobId: job.job_id });
    } catch (error) {
      setVista({ fase: "error", jobId: null, mensaje: mensajeDe(error) });
    }
  };

  const mostrar = (raw: unknown) => {
    const visor = normalizarVisorWord(raw);
    const paginas = visor.paginas;
    setVista({
      fase: "lista",
      jobId: null,
      portada: paginas[0] ?? null,
      contraportada: paginas.length > 1 ? paginas[paginas.length - 1] : null,
      exportado: visor.exportado,
      mensaje: paginas.length === 0 ? "El visor no devolvió páginas: abre el Word exportado para revisarlo." : "",
    });
  };

  const fallo = (mensaje: string) => setVista({ fase: "error", jobId: null, mensaje: mensaje || "No se pudo generar el Word." });
  const cancelado = () => setVista({ fase: "inactiva", jobId: null });

  return (
    <section className="pulso-f6-estilo-previa" aria-labelledby="f6-estilo-previa-titulo">
      <header className="pulso-f6-estilo-seccion-cabecera">
        <h3 id="f6-estilo-previa-titulo">Así queda en el Word</h3>
      </header>
      <p className="pulso-f6-estilo-ayuda">
        Genera el Word con este estilo y muestra su portada y su contraportada. Es la última versión generada, no una vista
        en vivo: tarda lo mismo que exportarlo.
      </p>
      <PulsoButton
        variant="primary"
        size="sm"
        disabled={!!motivo}
        aria-describedby={motivo ? "f6-estilo-previa-motivo" : undefined}
        onClick={() => void regenerar()}
      >
        <FileText size={14} aria-hidden="true" />
        {vista.fase === "lista" || vista.fase === "error" ? "Volver a generar el Word" : "Generar el Word con este estilo"}
      </PulsoButton>
      {motivo && !ocupado ? <p id="f6-estilo-previa-motivo" className="pulso-f6-estilo-tenue">{motivo}</p> : null}

      {vista.jobId && vista.fase === "exportando" ? (
        <JobProgress<WordExportado> label="Generando el Word" jobId={vista.jobId} onDone={(d) => void convertir(d)} onError={fallo} onCancelled={cancelado} />
      ) : null}
      {vista.jobId && vista.fase === "convirtiendo" ? (
        <JobProgress<unknown> label="Preparando las páginas" jobId={vista.jobId} onDone={mostrar} onError={fallo} onCancelled={cancelado} />
      ) : null}
      {vista.fase === "error" && vista.mensaje ? <p className="pulso-f6-estilo-error" role="alert">{vista.mensaje}</p> : null}

      <div className="pulso-f6-estilo-paginas" data-qa-geometry-group="graficos/f6-estilo-paginas" data-qa-geometry-contract="equal">
        {(["portada", "contraportada"] as const).map((cual) => {
          const src = vista[cual];
          const nombre = cual === "portada" ? "Portada" : "Contraportada";
          return (
            <figure key={cual} className="pulso-f6-estilo-pagina" data-qa-geometry-member>
              <div className="pulso-f6-estilo-pagina-hoja" data-qa-geometry-capacity="owned">
                {src
                  ? <img src={src} alt={`${nombre} del Word generado con este estilo`} />
                  : <span className="pulso-f6-estilo-tenue">{ocupado ? "Generando…" : "Todavía sin generar"}</span>}
              </div>
              <figcaption>{nombre}</figcaption>
            </figure>
          );
        })}
      </div>
      {vista.fase === "lista" && vista.mensaje ? <p className="pulso-f6-estilo-tenue">{vista.mensaje}</p> : null}
    </section>
  );
}
