import { Fragment, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { CifraFila, CifraMotor } from "../universidad/ui";
import type { CifraBanda } from "./bandaDisenoModelo";
import "./mesa.css";

/**
 * Banda «Diseño vigente»: la cadena del diseño en una línea y sus cifras con
 * procedencia (`CifraMotor`, la misma pieza que aulas). Sólo publica lo que ya
 * existe; una cifra sin dato dice «—» y el detalle explica por qué.
 */
export function BandaDiseno({
  grupo,
  cadena,
  cifras,
  children,
}: {
  /** Nombre del grupo de geometría (C1). */
  grupo: string;
  cadena: readonly string[];
  cifras: readonly CifraBanda[];
  children?: ReactNode;
}) {
  return (
    <section
      className="cmg-banda"
      aria-labelledby="cmg-banda-titulo"
      data-qa-geometry-group={grupo}
      data-qa-geometry-contract="intrinsic"
    >
      <div className="cmg-banda-head" data-qa-geometry-member>
        <h3 id="cmg-banda-titulo" className="cmg-banda-titulo">Diseño vigente</h3>
        <p className="cmg-banda-cadena">
          {cadena.map((paso, i) => (
            <Fragment key={`${i}-${paso}`}>
              {i > 0 && <ChevronRight size={12} aria-hidden="true" className="cmg-banda-flecha" />}
              {i > 0 && <span className="pulso-sr-only">, </span>}
              <span>{paso}</span>
            </Fragment>
          ))}
        </p>
      </div>
      <div className="cmg-banda-cifras cmv2-uni-stagger" data-qa-geometry-member>
        <CifraFila>
          {cifras.map((c) => (
            <CifraMotor
              key={c.clave}
              label={c.label}
              value={c.value}
              detalle={c.detalle}
              origen={c.origen}
              hero={c.hero}
              tono={c.tono}
              monospace={c.monospace}
            />
          ))}
        </CifraFila>
      </div>
      {children}
    </section>
  );
}
