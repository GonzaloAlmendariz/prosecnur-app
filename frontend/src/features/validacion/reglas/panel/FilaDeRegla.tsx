/**
 * Una fila de la caja "Condiciones" del panel de regla (prototipo
 * `pp-rg-fila`): rótulo, campos y, si se puede quitar, la X. La usan
 * `Condiciones` y los campos de cada tipo que viven en su propio archivo.
 */
import type { ReactNode } from "react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { X } from "../../../../vendor/lucide-react";

/** Una fila de la caja: rótulo, campos y, si se puede quitar, la X. */
export function Fila({
  rotulo,
  children,
  quitar,
  variante = "condicion",
  clase,
}: {
  rotulo: ReactNode;
  children: ReactNode;
  quitar?: { etiqueta: string; onQuitar: () => void };
  variante?: "condicion" | "campo";
  clase?: string;
}) {
  return (
    <div className={[`pulso-regla-fila pulso-regla-fila--${variante}`, clase].filter(Boolean).join(" ")} data-qa-geometry-member="">
      <span className="pulso-regla-rotulo">{rotulo}</span>
      {children}
      {quitar ? (
        <PulsoButton variant="icon" size="sm" intent="remove" aria-label={quitar.etiqueta} onClick={quitar.onQuitar}>
          <X size={13} aria-hidden="true" />
        </PulsoButton>
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}
