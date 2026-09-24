import { MapPinned } from "lucide-react";

/**
 * Modo `territorial-handoff`: esta mesa no calcula ni reporta, sólo deriva a
 * Hojas de Ruta, que es donde viven zonas, manzanas, viviendas y reemplazos.
 * Por eso la barra de comandos no ofrece Calcular ni Reporte aquí.
 */
export function TerritorialHandoff({ onOpen, onBack }: { onOpen: () => void; onBack: () => void }) {
  return (
    <section className="cmv2-handoff" aria-labelledby="cmv2-handoff-titulo" data-qa-geometry-group="calc-muestra/territorial-handoff" data-qa-geometry-contract="intrinsic">
      <div className="cmv2-handoff-icon" aria-hidden="true"><MapPinned size={26} /></div>
      <span className="cmv2-eyebrow">Territorial / hogares</span>
      <h2 id="cmv2-handoff-titulo" data-qa-geometry-member>Este marco se diseña mejor en Hojas de Ruta</h2>
      <p data-qa-geometry-member>
        Si el estudio depende de territorio, zonas, manzanas, viviendas o rutas de campo, el cálculo necesita cartografía, selección de zonas, reemplazos y salida operativa. Esa mesa ya existe en Hojas de Ruta.
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
