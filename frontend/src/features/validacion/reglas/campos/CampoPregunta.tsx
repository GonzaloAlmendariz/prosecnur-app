/**
 * La pregunta de una fila del panel de regla: el selector con búsqueda
 * (`BuscadorDePregunta`, ítem 9) con el punto de color de su tipo, su código y
 * su texto (prototipo `pp-cond-preg`). Escribir busca por código y por texto;
 * en una batería se ve el ítem y, debajo, el enunciado común.
 */
import type { ExploradorVariable } from "../../types";
import { BuscadorDePregunta } from "./BuscadorDePregunta";

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
    <BuscadorDePregunta
      variables={variables}
      valor={valor}
      onCambio={onCambio}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      className={comparada ? "pulso-regla-pregunta pulso-regla-pregunta--comparada" : "pulso-regla-pregunta"}
    />
  );
}
