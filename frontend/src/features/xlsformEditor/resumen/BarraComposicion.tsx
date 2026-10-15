// Barra apilada de la composición del formulario: un solo sistema de color (pasos tonales del acento del módulo; lo
// que pasa del sexto segmento va en neutro) y una leyenda con número y porcentaje. La barra es decorativa: la
// leyenda dice lo mismo en texto.

import { porcentaje } from "./modeloResumen";

export type SegmentoComposicion = { clave: string; rotulo: string; valor: number; detalle?: string };

const TONOS = 6;

export function BarraComposicion({ titulo, segmentos, total }: {
  titulo: string;
  segmentos: readonly SegmentoComposicion[];
  total: number;
}) {
  const visibles = segmentos.filter((s) => s.valor > 0);
  return (
    <section className="pulso-xf-res-comp" aria-label={titulo} data-qa-geometry-member="">
      <h4 className="pulso-xf-res-comp-titulo">{titulo}</h4>
      <div className="pulso-xf-res-comp-barra" aria-hidden="true">
        {visibles.map((s, i) => (
          <i key={s.clave} className={`is-tono-${Math.min(i, TONOS)}`} style={{ flexGrow: s.valor }} title={`${s.rotulo}: ${s.valor}`} />
        ))}
      </div>
      <ul className="pulso-xf-res-comp-leyenda" data-qa-geometry-group={`xlsform/resumen-${titulo.toLowerCase().replace(/\s+/g, "-")}`} data-qa-geometry-contract="intrinsic">
        {visibles.map((s, i) => (
          <li key={s.clave} data-qa-geometry-member="">
            <span className={`pulso-xf-res-comp-muestra is-tono-${Math.min(i, TONOS)}`} aria-hidden="true" />
            <span className="pulso-xf-res-comp-rotulo" title={s.detalle ?? s.rotulo}>{s.rotulo}</span>
            <span className="pulso-xf-res-comp-num">{s.valor}</span>
            <span className="pulso-xf-res-comp-pct">{porcentaje(s.valor, total)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
