/**
 * Control explícito del descuento secuencial de repetidos (reunión Ramiro
 * §10). Regla de la casa: nada de caja negra — el toggle explica qué hace,
 * cuándo surte efecto y, en los engines balanceados, aclara que el descuento
 * del engine opera como auditoría post-selección (discount_mode "post_hoc").
 * Vive junto a las opciones de método porque es una decisión de diseño de la
 * selección, no un ajuste técnico avanzado.
 */
import { discountBehaviorForEngine } from "./descuentoSecuencialNarrativaModel";
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
  const behavior = discountBehaviorForEngine(selectorEngine);
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
          Activa la política para la próxima selección. La selección vigente no cambia sola y la
          corrida acreditada conserva el modo que realmente aplicó el engine.
        </em>
        {behavior === "sequential" && (
          <em>
            Con este método el descuento sí interviene en la secuencia del sorteo: sistemático,
            estratificado y pool ponderan la siguiente candidata con los alumnos aún no cubiertos.
          </em>
        )}
        {behavior === "post_hoc" && (
          <em>
            Con cube, pivotal o selección manual el descuento es una auditoría post hoc: conserva
            probabilidades, calibración y orden; nunca se presenta como causa del sorteo.
          </em>
        )}
        {behavior === "unknown" && <em>La corrida acreditada indicará si el engine aplicó secuencia o auditoría post hoc.</em>}
      </span>
    </label>
  );
}
