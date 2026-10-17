// Tipos de pregunta del Resumen con la maqueta de cada uno (F3, 2026-10-16): en vez de una muestra de color en la
// leyenda, el dibujo de cómo se ve el tipo, su nombre, cuántas preguntas y qué parte del formulario son.

import { MaquetaTipo } from "../kit";
import { porcentaje } from "./modeloResumen";
import "./tiposConMaqueta.css";

export type TipoResumen = { base: string; rotulo: string; preguntas: number };

export function TiposConMaqueta({ tipos, total }: { tipos: readonly TipoResumen[]; total: number }) {
  const visibles = tipos.filter((t) => t.preguntas > 0);
  return (
    <section className="pulso-xf-res-comp" aria-label="Tipos de pregunta" data-qa-geometry-member="">
      <h4 className="pulso-xf-res-comp-titulo">Tipos de pregunta</h4>
      <ul className="xfr-tipos" data-qa-geometry-group="xlsform/resumen-tipos" data-qa-geometry-contract="intrinsic">
        {visibles.map((t) => (
          <li key={t.base} className="xfr-tipo" data-qa-geometry-member="">
            <MaquetaTipo baseType={t.base} ancho={30} />
            <span className="xfr-tipo__rot" title={t.rotulo}>{t.rotulo}</span>
            <span className="xfr-tipo__n">{t.preguntas}</span>
            <span className="xfr-tipo__pct">{porcentaje(t.preguntas, total)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
