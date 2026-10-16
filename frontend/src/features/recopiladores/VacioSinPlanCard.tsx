import type { ReactNode } from "react";

import { EstadoVacio } from "../../components/EstadoVacio";
import { PulsoButton } from "../../components/PulsoButton";
import { ArrowRight, Loader2 } from "../../vendor/lucide-react";
import type { VacioSinPlan } from "./vacioSinPlan";

type Props = {
  vacio: VacioSinPlan;
  icono: ReactNode;
  /** Navega a la dirección que resuelve el vacío. Sin él, la acción no se pinta. */
  onIr?: (to: string) => void;
  /**
   * Acción propia que reemplaza a la navegación: en Unidades, adaptar la
   * semilla que el proyecto ya conserva resuelve el vacío ahí mismo.
   */
  accionPropia?: { label: string; icono: ReactNode; ocupado: boolean; onSelect: () => void };
  /** Texto que reemplaza la descripción cuando la acción propia está disponible. */
  descripcion?: string;
  children?: ReactNode;
};

/**
 * Vacío de una sección de Material de campo sin plan: título, una línea de
 * qué falta y una sola acción. Alto intrínseco (C3): no estira una caja
 * punteada hasta el fondo de la pantalla para una frase.
 */
export function VacioSinPlanCard({ vacio, icono, onIr, accionPropia, descripcion, children }: Props) {
  const accion = accionPropia ? (
    <PulsoButton variant="primary" size="sm" onClick={accionPropia.onSelect} disabled={accionPropia.ocupado}>
      {accionPropia.ocupado ? <Loader2 size={14} className="pulso-spin" /> : accionPropia.icono}
      {accionPropia.label}
    </PulsoButton>
  ) : onIr ? (
    <PulsoButton variant="secondary" size="sm" onClick={() => onIr(vacio.accion.to)}>
      {vacio.accion.label}
      <ArrowRight size={14} aria-hidden />
    </PulsoButton>
  ) : null;

  return (
    <div className="rec-vacio-sin-plan" data-qa-geometry-capacity="owned">
      <EstadoVacio
        tamano="normal"
        icono={icono}
        titulo={vacio.titulo}
        descripcion={descripcion ?? vacio.descripcion}
        accion={accion}
      />
      {children}
    </div>
  );
}
