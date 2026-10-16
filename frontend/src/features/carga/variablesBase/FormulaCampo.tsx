// Regla «fórmula» de una variable calculada (ADR 0106): la expresión y un
// buscador que inserta el nombre de una pregunta de la base. Bajo el campo, las
// variables que la fórmula usa, con su etiqueta, para leer qué se está
// calculando sin descifrar códigos. La sintaxis la valida el backend.

import type { VariableDeBase } from "../../../api/equivalencias";
import { etiquetaLegible } from "../preguntaEquivalenteModel";
import { BuscadorPreguntas } from "./SelectorPreguntas";
import { insertarEnFormula, variablesDeFormula } from "./variablesBaseModel";

export function FormulaCampo({
  expresion,
  opciones,
  onCambio,
}: {
  expresion: string;
  opciones: readonly VariableDeBase[];
  onCambio: (valor: string) => void;
}) {
  const usadas = variablesDeFormula(expresion);
  const etiquetaDe = (nombre: string) => etiquetaLegible(opciones.find((o) => o.name === nombre)?.label);
  return (
    <div className="pulso-vb-bloque" role="group" aria-label="Fórmula">
      <label className="pulso-compuesto-campo">
        <span>Fórmula</span>
        <input
          className="pulso-vb-mono"
          value={expresion}
          placeholder="Por ejemplo: 2026 - P8"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onCambio(e.target.value)}
        />
      </label>
      <p className="pulso-armon-ayuda">
        Números, variables de la base, + − × ÷ y paréntesis. Un 88, 98 o 99 de una pregunta con lista de
        respuestas cuenta como sin dato.
      </p>
      <BuscadorPreguntas
        opciones={opciones}
        elegidas={usadas}
        etiqueta="Insertar una pregunta en la fórmula"
        onElegir={(nombre) => onCambio(insertarEnFormula(expresion, nombre))}
      />
      {usadas.length > 0 && (
        <ul className="pulso-vb-formula-usadas" aria-label="Variables que usa la fórmula">
          {usadas.map((v) => {
            const etiqueta = etiquetaDe(v);
            return (
              <li key={v}>
                <code>{v}</code>
                {etiqueta ? <span>{etiqueta}</span> : <span className="pulso-armon-tenue">no está en la base</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
