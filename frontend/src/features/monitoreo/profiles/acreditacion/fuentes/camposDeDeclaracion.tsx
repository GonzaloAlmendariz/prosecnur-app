// Los dos campos con los que se declara una fuente: de quién es y por dónde va.
//
// Estaban dentro de `AcreditacionMonitoreoPage.tsx`, atados a la ficha de una
// encuesta. Eso los volvía inalcanzables para el bloque de Actores, que
// necesita exactamente los mismos dos controles —nombrar al actor y decir su
// canal— pero sobre otro objeto: el actor mismo, no una de sus encuestas.
//
// Se conservan las clases CSS originales a propósito. La regla de este archivo
// es que la extracción no cambia nada de lo que se ve; lo único que cambia es
// quién puede usarlo.

import { CheckCircle2 } from "../../../../../vendor/lucide-react";
import { normalizeSourceMatch } from "../formato";
import { ACREDITACION_CHANNEL_OPTIONS, channelOptionForValue } from "./canales";

/**
 * Nombre del actor: texto libre con el elenco como atajo.
 *
 * El texto libre no es un descuido — es la vía por la que entra un actor que el
 * estudio no tenía previsto—, pero cuando la fila de chips sale del elenco
 * declarado, escribir a mano deja de ser el camino normal y pasa a ser la
 * excepción que crea uno nuevo.
 */
export function CampoDeActor({
  value,
  options,
  disabled,
  onChange,
  placeholder = "Escribir actor o elegir sugerencia",
  maxOptions = 8,
}: {
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  maxOptions?: number;
}) {
  const currentKey = normalizeSourceMatch(value);
  const visibleOptions = options.slice(0, maxOptions);
  return (
    <div className="mon-acr-actor-field">
      <label>
        <span>Actor</span>
        <input
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      </label>
      {visibleOptions.length ? (
        <div className="mon-acr-actor-choice-row" aria-label="Actores del estudio">
          {visibleOptions.map((actor) => {
            const active = normalizeSourceMatch(actor) === currentKey;
            return (
              <button
                key={actor}
                type="button"
                className={active ? "is-active" : ""}
                onClick={() => onChange(actor)}
                disabled={disabled}
              >
                {active ? <CheckCircle2 size={12} /> : null}
                {actor}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Canal base: la tira de opciones con su ícono, como radiogroup.
 *
 * `label` es parametrizable porque el objeto cambia de nombre según dónde se
 * use: en una encuesta es su «canal base» —el que heredan sus recopiladores—;
 * en un actor es «cómo se le llega».
 */
export function SelectorDeCanalBase({
  value,
  onChange,
  disabled,
  label = "Canal base",
  ariaLabel = "Canal base de la encuesta",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  ariaLabel?: string;
}) {
  const current = channelOptionForValue(value).value;
  return (
    <div className="mon-acr-channel-declare-field">
      <span>{label}</span>
      <div className="mon-acr-channel-choice-strip" role="radiogroup" aria-label={ariaLabel}>
        {ACREDITACION_CHANNEL_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = option.value === current;
          return (
            <button
              key={option.value}
              type="button"
              className={`is-${option.key}${active ? " is-active" : ""}`}
              aria-pressed={active}
              aria-label={option.label}
              title={option.label}
              disabled={disabled}
              onClick={() => onChange(option.value)}
            >
              <Icon size={13} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
