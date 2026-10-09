/**
 * Qué capítulos del sustento metodológico se pueden escribir hoy.
 *
 * Vive en Entregables porque es donde alguien pediría el documento, y la
 * pregunta que hay que poder contestar ahí es si el documento estaría completo.
 *
 * No es una barra de progreso: **separa lo que falta por trabajo de lo que
 * falta por depender de otro módulo**. Mezclarlos haría parecer que el
 * documento avanza cuando no puede, que es la forma habitual en que un
 * indicador de cobertura miente.
 */
import { BookOpen, Check, Circle, ExternalLink } from "../../../../vendor/lucide-react";
import { resumenSustento, seccionesSustento } from "./sustentoSecciones";
import type { CalcMuestraAulasState, CalcMuestraEstudio, CalcMuestraWorkspace } from "../../../../api/client";
import "./sustentoCobertura.css";

export function SustentoCoberturaCard({
  estudio,
  workspace,
  aulasState,
}: {
  estudio: CalcMuestraEstudio | null | undefined;
  workspace: CalcMuestraWorkspace | null | undefined;
  aulasState: CalcMuestraAulasState | null | undefined;
}) {
  const secciones = seccionesSustento({ estudio, workspace, aulasState });
  const r = resumenSustento(secciones);

  return (
    <section className="cmv2-panel cmv2-sustento" aria-label="Cobertura del sustento metodológico">
      <div className="cmv2-subhead">
        <strong>El sustento metodológico, capítulo por capítulo</strong>
        <small>qué se puede escribir hoy y qué no</small>
      </div>
      <p className="cmv2-sustento-resumen">
        <b>{r.disponibles} de {r.total}</b> capítulos se pueden escribir con lo que el
        estudio tiene ahora.
        {r.pendientes.length > 0 && <> Faltan <b>{r.pendientes.length}</b> por trabajo del propio módulo.</>}
        {r.externas.length > 0 && <> {r.externas.length === 1 ? "Uno depende" : `${r.externas.length} dependen`} de otro módulo y no se resuelve{r.externas.length === 1 ? "" : "n"} trabajando acá.</>}
      </p>
      <ol className="cmv2-sustento-lista">
        {secciones.map((s) => (
          <li key={s.id} data-estado={s.disponible ? "listo" : s.origen === "externo" ? "externo" : "pendiente"}>
            <span className="cmv2-sustento-marca" aria-hidden="true">
              {s.disponible ? <Check size={13} /> : s.origen === "externo" ? <ExternalLink size={13} /> : <Circle size={13} />}
            </span>
            <span className="cmv2-sustento-titulo">
              <b>{s.numero}.</b> {s.titulo}
            </span>
            {/* La fuente literal, para que quien lo mantenga no la adivine, y el
                motivo cuando falta: un «no disponible» sin razón no sirve. */}
            <small className="cmv2-sustento-detalle">
              {s.disponible ? s.fuente : s.falta}
            </small>
          </li>
        ))}
      </ol>
      <small className="cmv2-sustento-nota">
        <BookOpen size={12} aria-hidden="true" /> El documento no inventa contenido:
        recoge lo que ya calculan el sustento técnico, el relato, la bitácora del
        libro y el propio motor, y lo ordena en el registro de un informe.
      </small>
    </section>
  );
}
