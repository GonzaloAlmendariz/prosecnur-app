import { useId, useState } from "react";
import { Check, Lightbulb } from "lucide-react";
import type { ReglaSemilla } from "../types";

// =============================================================================
// SemillasPanel — criterios que Prosecnur propone a partir de la base
// =============================================================================
// Los criterios de revisión cubren lo que el instrumento no puede prever, pero
// exigen que alguien sepa que debe escribirlos: la capacidad existe y la
// cobertura no. El sembrado cierra esa distancia proponiendo criterios ya
// formados, con el motivo a la vista.
//
// El panel PROPONE. Nada se guarda hasta que la persona adopta, y adoptar es
// una acción por criterio: sembrar no debe poder llenar la lista sin que nadie
// haya leído lo que entra.
//
// Accesibilidad: cuatro botones que dicen "Adoptar" suenan idénticos en un
// lector de pantalla. Cada uno nombra su criterio en `aria-label`, se describe
// con su propio motivo, y el resultado de adoptar se anuncia en una región
// viva — sin eso, quien no ve la pantalla no sabe si su clic hizo algo.

type Props = {
  semillas: ReglaSemilla[];
  onAdoptar: (semilla: ReglaSemilla) => Promise<void>;
  disabled?: boolean;
};

export default function SemillasPanel({ semillas, onAdoptar, disabled }: Props) {
  const [adoptando, setAdoptando] = useState<string>("");
  const [anuncio, setAnuncio] = useState<string>("");
  const baseId = useId();

  if (!semillas.length) return null;

  async function adoptar(s: ReglaSemilla) {
    setAdoptando(s.nombre);
    setAnuncio(`Adoptando ${s.nombre}…`);
    try {
      await onAdoptar(s);
      setAnuncio(`${s.nombre}: criterio adoptado. Ya se puede ejecutar.`);
    } catch {
      setAnuncio(`No se pudo adoptar ${s.nombre}.`);
    } finally {
      setAdoptando("");
    }
  }

  return (
    <section
      className="pulso-criterios-semillas"
      data-audit-ready="validacion-semillas"
      aria-labelledby={`${baseId}-titulo`}
    >
      <header className="pulso-criterios-semillas-head">
        <Lightbulb size={14} aria-hidden="true" focusable="false" />
        <div>
          <h3 id={`${baseId}-titulo`}>
            {semillas.length === 1
              ? "Hay 1 criterio sugerido para esta base"
              : `Hay ${semillas.length} criterios sugeridos para esta base`}
          </h3>
          <p>
            Salen de mirar la base, no el formulario. Revísalos y adopta los que
            correspondan; mientras no los adoptes, no se guardan ni se ejecutan.
          </p>
        </div>
      </header>

      <ul className="pulso-criterios-semillas-lista">
        {semillas.map((s, i) => {
          const n = s.semilla?.n_casos_afectados;
          const ocupado = adoptando === s.nombre;
          const motivoId = `${baseId}-motivo-${i}`;
          return (
            <li key={`${s.tipo}:${s.variables.join(",")}`}>
              <div className="pulso-criterios-semilla-cuerpo">
                <div className="pulso-criterios-semilla-titulo">
                  <span>{s.nombre}</span>
                  {typeof n === "number" && n > 0 && (
                    <span className="pulso-criterios-semilla-chip">
                      {n} caso{n === 1 ? "" : "s"}
                      <span className="pulso-sr-only"> afectado{n === 1 ? "" : "s"}</span>
                    </span>
                  )}
                </div>
                <p className="pulso-criterios-semilla-porque" id={motivoId}>
                  {s.semilla?.porque}
                </p>
              </div>
              <button
                type="button"
                className="pulso-secondary"
                onClick={() => void adoptar(s)}
                disabled={disabled || ocupado}
                aria-label={`Adoptar el criterio ${s.nombre}`}
                aria-describedby={motivoId}
                aria-busy={ocupado || undefined}
              >
                <Check size={12} aria-hidden="true" focusable="false" />{" "}
                {ocupado ? "Adoptando…" : "Adoptar"}
              </button>
            </li>
          );
        })}
      </ul>

      {/* El resultado de adoptar cambia la lista de arriba y la de abajo; sin
          anuncio, un lector de pantalla no reporta nada tras el clic. */}
      <p aria-live="polite" className="pulso-sr-only">
        {anuncio}
      </p>
    </section>
  );
}
