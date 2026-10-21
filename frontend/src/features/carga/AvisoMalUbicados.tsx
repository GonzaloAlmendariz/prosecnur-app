// Checklist A5: en el editor de una base, el código que va a una categoría
// pareciéndose más a otra. Sólo con mapa identidad: un mapa declarado código por
// código ya es una decisión (`codigosMalUbicadosModel.ts`).

import type { CategoriaEscalaComun } from "../../api/equivalencias";
import { malUbicadosEnMapa } from "./codigosMalUbicadosModel";

export function AvisoMalUbicados({
  base,
  codigos,
  escala,
  explicito,
}: {
  base: string;
  codigos: readonly { codigo: string; etiqueta: string | null; destino: string | null }[];
  escala: readonly CategoriaEscalaComun[];
  explicito: boolean;
}) {
  if (explicito) return null;
  const mal = malUbicadosEnMapa(base, codigos, escala);
  if (mal.length === 0) return null;
  const resto = mal.length - 1;
  return (
    <p className="pulso-armon-aviso" role="status">
      {`«${mal[0].etiqueta}» se cuenta como «${mal[0].etiquetaDestino}», pero se parece más a «${mal[0].sugerida}»${resto > 0 ? ` (y ${resto} ${resto === 1 ? "código más" : "códigos más"})` : ""}. Si la lista de ${base} está en otro orden, usa «Convertir en mapa por etiqueta».`}
    </p>
  );
}
