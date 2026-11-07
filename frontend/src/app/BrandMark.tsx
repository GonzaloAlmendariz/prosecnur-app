import { IsotipoTrenza } from "./marca/IsotipoTrenza";

/** Isotipo de la app en el header (ADR 0132): la Trenza quieta, en navy de marca y en su variante de cinco hilos.
 *  Su tamaño lo fija `.pulso-brand-mark` en theme.css (24 px; 20 px con el rail de fases). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <IsotipoTrenza
      className={["pulso-brand-mark", className].filter(Boolean).join(" ")}
      fondo="var(--pulso-primary)"
      chica
    />
  );
}
