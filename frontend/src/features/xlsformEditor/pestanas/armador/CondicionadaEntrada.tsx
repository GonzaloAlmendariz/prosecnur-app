// «Cuándo se aplica» la regla de la respuesta (E19 paso 4 editor-conjoint, 2026-11-06): siempre, o sólo cuando se
// cumple una condición sobre otra respuesta. Escribe `if(<condición>, <regla>, true())` con el MISMO armador de
// condiciones que «Cuándo aparece», así la frase con que se lee es la misma con que se arma. Tarjeta sin triángulo (E20).

import { useId, useState } from "react";
import { GitBranch } from "../../../../vendor/lucide-react";
import { LogicBuilder } from "../../inspector/logic/LogicBuilder";
import type { LogicScope } from "../../logic";

type Props = {
  condicion: string;
  scope: LogicScope;
  /** Escribe la condición nueva (vacía = la regla se aplica siempre). */
  onCondicion: (condicion: string) => void;
};

export function CondicionadaEntrada({ condicion, scope, onCondicion }: Props) {
  const tituloId = useId();
  const [soloCuando, setSoloCuando] = useState(Boolean(condicion.trim()));
  return (
    <section className="xfa-bloque" data-testid="regla-condicionada" aria-labelledby={tituloId}>
      <header className="xfa-bloque__cabeza">
        <span className="xfa-bloque__icono" aria-hidden="true"><GitBranch /></span>
        <div className="xfa-bloque__titulos">
          <h4 id={tituloId} className="xfa-bloque__titulo">Condición de la regla</h4>
        </div>
      </header>
      <div className="xfa-cuantas__modos" role="radiogroup" aria-label="Condición de la regla">
        <button
          type="button"
          role="radio"
          aria-checked={!soloCuando}
          className={`xfa-cuantas__modo${!soloCuando ? " is-on" : ""}`}
          onClick={() => { setSoloCuando(false); if (condicion.trim()) onCondicion(""); }}
        >
          Siempre
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={soloCuando}
          className={`xfa-cuantas__modo${soloCuando ? " is-on" : ""}`}
          onClick={() => setSoloCuando(true)}
        >
          Con condición
        </button>
      </div>
      {soloCuando ? (
        <LogicBuilder
          expression={condicion}
          scope={{ ...scope, allowCurrent: false }}
          fieldLabel="Se aplica si"
          targetNoun="esta regla"
          techTerm="constraint"
          chrome="bare"
          vacio="Sin condición todavía."
          onChange={(next) => onCondicion(next)}
        />
      ) : null}
    </section>
  );
}
