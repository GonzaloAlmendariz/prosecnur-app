import { ChevronDown, Layers } from "lucide-react";

import type { EstudioPayload } from "../../api/client";
import { BaseSelectorTrigger, BasesInspectorMenu, basesDesdeEstudio } from "../../components/BasesInspectorMenu";
import { processingBaseScopePresentation } from "../procesamiento/baseScopeModel";

// =============================================================================
// BaseSelector — la base activa, como desplegable
// =============================================================================
// Antes era una lista de chips segmentados, uno por base, dentro de la banda del
// módulo: con dos bases ya ocupaba ~380px y cada base nueva le comía más ancho al
// rail de secciones. Y encima duplicaba información con el resumen «N bases» que
// el shell dibuja del otro lado.
//
// Ahora es un disparador de ancho fijo que abre el desglose compartido, que además
// de dejar elegir muestra el instrumento y la base de datos de cada una — que es
// lo que de verdad hay que poder auditar en un estudio multibase.
//
// Single-base: no se dibuja. Ofrecer un selector de una sola opción es ruido.

type Props = {
  estudio: EstudioPayload | null;
  selected: string | null;
  onChange: (nombre: string) => void;
  disabled?: boolean;
  className?: string;
};

export default function BaseSelector({ estudio, selected, onChange, disabled, className }: Props) {
  const alcance = processingBaseScopePresentation(
    estudio?.processing_mode ?? null,
    estudio?.n_bases ?? 0,
  );

  if (!estudio || estudio.n_bases <= 1) return null;

  const bases = Object.values(estudio.bases);
  const activeKey = selected ?? bases[0]?.nombre ?? null;
  const activa = bases.find((b) => b.nombre === activeKey) ?? bases[0];
  const etiqueta = activa
    ? activa.source_alias || activa.source_title || activa.nombre
    : "Elegir base";

  return (
    <BasesInspectorMenu
      bases={basesDesdeEstudio(estudio)}
      activa={activeKey}
      onSeleccionar={onChange}
      deshabilitado={disabled}
      modo={alcance.summaryLabel}
      disparador={<BaseSelectorTrigger etiqueta={etiqueta} total={estudio.n_bases} />}
    />
  );
}
