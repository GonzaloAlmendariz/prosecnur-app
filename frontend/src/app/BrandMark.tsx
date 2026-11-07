import { IsotipoTrenza } from "./marca/IsotipoTrenza";

/** Isotipo de la app en el header (ADR 0132): la Trenza quieta, en navy de marca y en su variante de cinco hilos. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <IsotipoTrenza
      className={["pulso-brand-mark", className].filter(Boolean).join(" ")}
      fondo="var(--pulso-primary)"
      chica
      size={28}
    />
  );
}
