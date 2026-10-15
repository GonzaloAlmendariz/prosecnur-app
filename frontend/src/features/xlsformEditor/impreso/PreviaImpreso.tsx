// «Así queda»: la previa real del cuestionario impreso, embebida. La genera «Previsualizar» con el mismo job que
// «Exportar PDF»; es la última versión generada, no una vista en vivo, y lo dice cuando las opciones o el formulario
// cambiaron después.

import { AlertTriangle, Check, FileText, Loader2, RotateCcw } from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";
import type { EstadoPrevia } from "./storePrevia";

type Paso = { clave: string; rotulo: string; estado: "hecho" | "en-curso" | "pendiente" };

function pasosDe(previa: Pick<EstadoPrevia, "fase" | "detalle">): Paso[] {
  const generando = previa.fase === "generando";
  return [
    { clave: "pdf", rotulo: generando && previa.detalle ? `Generando el PDF · ${previa.detalle}` : "Generando el PDF", estado: generando ? "en-curso" : "hecho" },
    { clave: "leer", rotulo: "Leyendo el archivo", estado: previa.fase === "descargando" ? "en-curso" : "pendiente" },
  ];
}

export function PreviaImpreso({ previa, vieja, motivo, onGenerar }: {
  previa: EstadoPrevia;
  vieja: boolean;
  /** Si no se puede previsualizar (p. ej. una exportación en curso), por qué. */
  motivo: string | null;
  onGenerar: () => void;
}) {
  const ocupada = previa.fase === "generando" || previa.fase === "descargando";
  return (
    <aside className="pulso-xf-imp-previa" aria-label="Así queda" data-qa-surface="xlsform/impreso-previa">
      <div className="pulso-xf-imp-previa-cabeza">
        <span className="pulso-xf-imp-eyebrow">Así queda</span>
        {previa.fase === "lista" && (
          <PulsoButton variant="ghost" size="sm" onClick={onGenerar} disabled={Boolean(motivo)} title={motivo ?? undefined}>
            <RotateCcw size={13} aria-hidden="true" /> Volver a generar
          </PulsoButton>
        )}
      </div>
      <div className="pulso-xf-imp-previa-marco" data-qa-geometry-capacity="owned">
        {previa.fase === "inactiva" && (
          <div className="pulso-xf-imp-previa-vacia">
            <span className="pulso-xf-imp-previa-icono" aria-hidden="true"><FileText size={22} /></span>
            <strong>Todavía no hay previa</strong>
            <p>«Previsualizar» genera el PDF con estas opciones y lo muestra aquí. Tarda lo mismo que exportar.</p>
            <PulsoButton variant="secondary" size="sm" onClick={onGenerar} disabled={Boolean(motivo)} title={motivo ?? undefined}>
              Previsualizar
            </PulsoButton>
          </div>
        )}
        {ocupada && (
          <ol className="pulso-xf-imp-previa-pasos" role="status" aria-live="polite">
            {pasosDe(previa).map((p) => (
              <li key={p.clave} className={`is-${p.estado}`}>
                <span className="pulso-xf-imp-previa-paso-icono" aria-hidden="true">
                  {p.estado === "hecho" ? <Check size={13} /> : p.estado === "en-curso" ? <Loader2 size={13} className="pulso-xf-imp-gira" /> : null}
                </span>
                {p.rotulo}
              </li>
            ))}
          </ol>
        )}
        {previa.fase === "error" && (
          <div className="pulso-xf-imp-previa-vacia is-error" role="alert">
            <span className="pulso-xf-imp-previa-icono" aria-hidden="true"><AlertTriangle size={20} /></span>
            <strong>No se pudo generar la previa</strong>
            <p>{previa.error}</p>
            <PulsoButton variant="secondary" size="sm" onClick={onGenerar} disabled={Boolean(motivo)}>Reintentar</PulsoButton>
          </div>
        )}
        {previa.fase === "lista" && previa.url && (
          <>
            {vieja && (
              <p className="pulso-xf-imp-previa-vieja" role="status">
                <AlertTriangle size={14} aria-hidden="true" />
                Cambiaste opciones o el formulario después de esta previa: vuelve a generarla para ver lo que saldrá.
              </p>
            )}
            <iframe className="pulso-xf-imp-previa-pdf" src={previa.url} title="Previa del cuestionario impreso (PDF)" />
          </>
        )}
      </div>
    </aside>
  );
}
