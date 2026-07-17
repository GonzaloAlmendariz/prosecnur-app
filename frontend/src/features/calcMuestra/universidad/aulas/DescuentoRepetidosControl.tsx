/**
 * Control explícito del descuento secuencial de repetidos (reunión Ramiro
 * §10). Regla de la casa: nada de caja negra — el toggle explica qué hace,
 * cuándo surte efecto y, en los engines balanceados, aclara que el descuento
 * del engine opera como auditoría post-selección (discount_mode "post_hoc").
 * Vive junto a las opciones de método porque es una decisión de diseño de la
 * selección, no un ajuste técnico avanzado.
 */
import { isBalancedEngine } from "./descuentoRepetidosModel";
import "./aulas.css";

export function DescuentoRepetidosControl({
  checked,
  selectorEngine,
  onChange,
}: {
  checked: boolean;
  /** Engine activo (config.selector_engine) para condicionar la aclaración post-hoc. */
  selectorEngine: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="cmv2-classroom-toggle cmv2-aulas-descuento-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <span>
        <strong>Descontar estudiantes repetidos al seleccionar</strong>
        <em>
          Al elegir un curso-horario, sus alumnos se descuentan de las candidatas restantes: un aula
          grande cuyos estudiantes ya están cubiertos deja de pesar como grande. Es el flujo
          metodológico correcto y solo surte efecto al ejecutar una selección nueva; la selección
          vigente no cambia sola.
        </em>
        {isBalancedEngine(selectorEngine) && (
          <em>
            En los métodos balanceados (cube y pivotal) el sorteo conserva sus probabilidades de
            diseño: el descuento se calcula como auditoría posterior a la selección (modo «post
            hoc»), no altera el sorteo.
          </em>
        )}
      </span>
    </label>
  );
}
