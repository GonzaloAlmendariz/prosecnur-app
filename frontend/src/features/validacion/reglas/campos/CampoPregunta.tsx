/**
 * La pregunta de una fila del panel de regla: un desplegable del kit con el
 * punto de color de su tipo, su código y su etiqueta (prototipo `pp-cond-preg`).
 * Escribir dentro busca por código y por etiqueta.
 */
import { PulsoSelect, type PulsoSelectOption } from "../../../../components/PulsoSelect";
import type { ExploradorVariable } from "../../types";
import { tipoDeFicha } from "./tipoDeFicha";

export function opcionesDePregunta(variables: readonly ExploradorVariable[], actual?: string): PulsoSelectOption[] {
  const opciones = variables.map((v) => ({
    value: v.name,
    textValue: `${v.name} ${v.label ?? ""}`,
    label: (
      <span className="pulso-regla-pregunta-opcion">
        <i className="pulso-regla-punto" data-tipo={tipoDeFicha(v.tipo)} aria-hidden="true" />
        <code>{v.name}</code>
        <span>{v.label && v.label !== v.name ? v.label : ""}</span>
      </span>
    ),
  }));
  // Una pregunta guardada que ya no está en la base se sigue viendo: no se pierde al abrir la regla.
  if (actual && !variables.some((v) => v.name === actual)) {
    opciones.unshift({
      value: actual,
      textValue: actual,
      label: (
        <span className="pulso-regla-pregunta-opcion">
          <i className="pulso-regla-punto" aria-hidden="true" />
          <code>{actual}</code>
          <span>No está en esta base</span>
        </span>
      ),
    });
  }
  return opciones;
}

export function CampoPregunta({
  variables,
  valor,
  onCambio,
  ariaLabel,
  placeholder = "Elegir pregunta",
  comparada = false,
}: {
  variables: readonly ExploradorVariable[];
  valor: string;
  onCambio: (variable: string) => void;
  ariaLabel: string;
  placeholder?: string;
  /** La otra pregunta de una comparación: se tiñe con el acento. */
  comparada?: boolean;
}) {
  return (
    <PulsoSelect
      value={valor}
      onValueChange={onCambio}
      options={opcionesDePregunta(variables, valor)}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      className={comparada ? "pulso-regla-pregunta pulso-regla-pregunta--comparada" : "pulso-regla-pregunta"}
    />
  );
}
