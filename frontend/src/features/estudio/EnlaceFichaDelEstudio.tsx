import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { useRutaFichaDelEstudio } from "./useRutaFichaDelEstudio";

/** Abre la Ficha del estudio sobre la vista actual (ADR 0124). */
export function EnlaceFichaDelEstudio({ children, className }: { children: ReactNode; className?: string }) {
  const ficha = useRutaFichaDelEstudio();
  return <Link className={className} to={ficha}>{children}</Link>;
}
