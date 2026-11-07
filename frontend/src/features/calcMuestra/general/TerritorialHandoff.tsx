import { MapPinned } from "lucide-react";

/**
 * Modo `territorial-handoff`: esta mesa no calcula ni reporta, sólo deriva a
 * Hojas de Ruta. Por la regla de Gonzalo (2026-11-02), Cálculo de muestra es
 * «de todo menos de territorial aleatorio»: ése vive sólo en Hojas de Ruta.
 * Por eso la barra de comandos no ofrece Calcular ni Reporte aquí.
 */
export function TerritorialHandoff({ onOpen, onBack }: { onOpen: () => void; onBack: () => void }) {
  return (
    <section className="cmv2-handoff" aria-labelledby="cmv2-handoff-titulo" data-qa-geometry-group="calc-muestra/territorial-handoff" data-qa-geometry-contract="intrinsic">
      <div className="cmv2-handoff-icon" aria-hidden="true"><MapPinned size={26} /></div>
      <span className="cmv2-eyebrow">Territorial / hogares</span>
      <h2 id="cmv2-handoff-titulo" data-qa-geometry-member>El territorial aleatorio se diseña en Hojas de Ruta</h2>
      <p data-qa-geometry-member>
        Cálculo de muestra cubre todo menos el territorial aleatorio. Si el estudio se sortea sobre territorio —zonas, manzanas, viviendas o rutas de campo—, su muestra, sus reemplazos y su salida operativa se hacen en Hojas de Ruta.
      </p>
      <div className="cmv2-inline-actions" data-qa-geometry-member>
        <button type="button" className="cmv2-primary" onClick={onOpen}>
          <MapPinned size={14} aria-hidden="true" /> Abrir Hojas de Ruta
        </button>
        <button type="button" className="cmv2-ghost" onClick={onBack}>
          Volver a marcos
        </button>
      </div>
    </section>
  );
}
