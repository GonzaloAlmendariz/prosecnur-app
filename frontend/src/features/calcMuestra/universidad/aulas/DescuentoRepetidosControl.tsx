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
        {/* Último reducto de jerga de la pestaña, medido el 2026-08-22: cinco
            términos sin glosa en dos frases —«engine», «cube», «pivotal», «post
            hoc», «conserva probabilidades, calibración y orden»— y encima con
            los nombres de método que dejaron de existir en pantalla al
            unificarse (07d90ab1). Lo que decía sigue siendo verdad; lo que
            cambia es que ahora se entiende sin saber muestreo. */}
        <em>
          Se aplica a la próxima selección. La que está vigente no cambia sola: conserva el modo
          con el que se sorteó.
        </em>
        {behavior === "sequential" && (
          <em>
            Con este método el descuento cambia el sorteo mientras ocurre: cada vez que entra un
            aula, las siguientes se eligen mirando a los alumnos que todavía no están cubiertos.
          </em>
        )}
        {behavior === "post_hoc" && (
          <em>
            Con este método el descuento no cambia el sorteo: se calcula después, para contar
            cuántos alumnos quedaron repetidos entre aulas. El sorteo mantiene intactas sus
            probabilidades, así que los pesos siguen siendo válidos.
          </em>
        )}
        {behavior === "unknown" && (
          <em>
            La corrida dirá si el descuento cambió el sorteo mientras ocurría o si sólo contó los
            repetidos después.
          </em>
        )}
      </span>
    </label>
  );
}
