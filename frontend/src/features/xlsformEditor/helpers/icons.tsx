// =============================================================================
// helpers/icons.tsx — icono por tipo XLSForm
// =============================================================================
// Desde «Señales» (2026-10-17) el ícono de cada tipo es el SELLO del kit (`kit/Sello.tsx`): la silueta del glifo
// sobre el color de su familia. Esta fachada devuelve un componente que se usa igual que un ícono lucide
// (`<Icon size={14} />`), así los consumidores no cambian. Un componente por tipo, siempre el mismo objeto: si se
// creara uno nuevo en cada render, React desmontaría el ícono cada vez.
// =============================================================================

import type { ComponentType } from "react";
import type { LucideProps } from "../../../vendor/lucide-react";
import { Sello } from "../kit/Sello";
import { selloDesdeIcono } from "../kit/TypeIcon";
import { tipoPregunta } from "../kit/tiposPregunta";

export type IconoTipo = ComponentType<LucideProps>;

const POR_TIPO = new Map<string, IconoTipo>();

function lado(size: LucideProps["size"]): number {
  const n = typeof size === "number" ? size : Number.parseFloat(size ?? "");
  return selloDesdeIcono(Number.isFinite(n) && n > 0 ? n : 14);
}

/** Componente del sello de un tipo base, con la firma de un ícono. `color` y `strokeWidth` se ignoran: el tono es el de la familia. */
export function iconForType(baseType: string): IconoTipo {
  const base = tipoPregunta(baseType).base;
  const previo = POR_TIPO.get(base);
  if (previo) return previo;
  function IconoSello({ size, className, style }: LucideProps) {
    return <Sello baseType={base} size={lado(size)} className={className} style={style} />;
  }
  IconoSello.displayName = `Sello(${base})`;
  POR_TIPO.set(base, IconoSello);
  return IconoSello;
}
