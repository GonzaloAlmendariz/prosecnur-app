// «Obligatoria» en tres modos (E19-1 editor-conjoint, 2026-11-06): siempre, nunca o «sólo si …». El editor ya leía
// `required` con una expresión («Obligatoria si ‹P› es Sí») pero sólo dejaba prenderla o apagarla. El modo «sólo si»
// usa el MISMO armador de condiciones que «Cuándo aparece», así la frase con que se lee es la misma con que se arma.

import { useState } from "react";
import { lecturaRequired } from "../../parsing/parseType";
import { LogicBuilder } from "../../inspector/logic/LogicBuilder";
import type { LogicScope } from "../../logic";

export type ModoObligatoria = "siempre" | "nunca" | "expresion";

/** Valor de la columna `required` para un modo; la expresión sólo cuenta en «sólo si». */
export function requiredDe(modo: ModoObligatoria, expresion: string): string {
  if (modo === "siempre") return "yes";
  if (modo === "nunca") return "";
  return expresion.trim();
}

const MODOS: { modo: ModoObligatoria; nombre: string; detalle: string }[] = [
  { modo: "nunca", nombre: "Opcional", detalle: "Puede quedar vacía." },
  { modo: "siempre", nombre: "Obligatoria", detalle: "No se finaliza sin respuesta." },
  { modo: "expresion", nombre: "Obligatoria con condición", detalle: "Según otra respuesta." },
];

export function ObligatoriaSegun({ requiredRaw, scope, onCambio }: {
  requiredRaw: string;
  scope: LogicScope;
  /** Escribe la columna `required`. */
  onCambio: (raw: string) => void;
}) {
  const actual = lecturaRequired(requiredRaw);
  const [modo, setModo] = useState<ModoObligatoria>(actual);
  const expresion = actual === "expresion" ? requiredRaw : "";
  return (
    <div className="xfh-oblig">
      <div className="xfh-oblig__modos" role="radiogroup" aria-label="Cuándo es obligatoria">
        {MODOS.map((m) => (
          <button
            key={m.modo}
            type="button"
            role="radio"
            aria-checked={modo === m.modo}
            className={`xfh-oblig__modo${modo === m.modo ? " is-on" : ""}`}
            onClick={() => {
              setModo(m.modo);
              if (m.modo !== "expresion") onCambio(requiredDe(m.modo, ""));
            }}
          >
            <strong>{m.nombre}</strong>
            <span>{m.detalle}</span>
          </button>
        ))}
      </div>
      {modo === "expresion" ? (
        <LogicBuilder
          expression={expresion}
          scope={scope}
          fieldLabel="Obligatoria si"
          targetNoun="esta pregunta"
          techTerm="required"
          chrome="bare"
          vacio="Sin condición todavía."
          onChange={(next) => onCambio(requiredDe("expresion", next))}
        />
      ) : null}
    </div>
  );
}
