// Barra extra de UN bloque de la multiapilada (editor «Combinar bloques»): el mismo control de la tarjeta, con el valor
// del bloque (`bloques[j].barra_extra`) y, mientras no declare uno, el que hereda de la lámina o del estilo del informe
// (precedencia bloque > lámina > preset, `barraExtra.ts`). Las categorías de cada box son del bloque.

import { barraExtraDeBloque, mismaBarraExtra, opcionesActivas, type BarraExtra } from "./barraExtra";
import { BarraExtraControl } from "./BarraExtraControl";
import { leerTwoBox, NOTA_BOTTOM_NO_NATIVO } from "./laminas/tarjetaGrafico/twoBox";
import { usePlanStore } from "./store";

type Registro = Record<string, unknown>;

type Props = {
  block: Registro;
  /** Args de la lámina entera: de ahí hereda el bloque mientras no declare su barra. */
  laminaArgs: Registro;
  /** Categorías de la escala de las preguntas del bloque, sin las especiales; vacío si no comparten una escala. */
  categorias: string[];
  onChange: (patch: Registro) => void;
};

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function BarraExtraBloque({ block, laminaArgs, categorias, onChange }: Props) {
  const presets = usePlanStore((s) => s.presets);
  const heredado: BarraExtra = leerTwoBox("p_barras_multiapiladas", laminaArgs, presets)?.valor ?? false;
  const propio = barraExtraDeBloque(block);
  const valor = propio ?? heredado;
  // Si la barra del bloque venía en sus `overrides` (así la deja el motor), se limpia ahí al decidirla: si no, al apagarla
  // (o igualarla a la de la lámina) la de `overrides` la volvía a encender.
  const enOverrides = !!block.overrides && typeof block.overrides === "object" && "barra_extra" in (block.overrides as Registro);
  const fijar = (barra: BarraExtra | null) => onChange(enOverrides ? { barra_extra: barra, overrides: { barra_extra: null } } : { barra_extra: barra });
  const cambiar = (v: BarraExtra) => fijar(mismaBarraExtra(v, heredado) ? null : v === false ? false : [...v]);
  return (
    <BarraExtraControl
      qa="barra-extra-bloque"
      valor={valor}
      onChange={cambiar}
      escala={categorias.length > 0
        ? { fase: "lista", categorias }
        : { fase: "sin_escala", mensaje: "Elige preguntas que compartan una escala con categorías para declarar un Top o Bottom Two Box. Conteos sí está disponible." }}
      etiquetas={{ top2box: lista(block.top2box_labels), bottom2box: lista(block.bottom2box_labels) }}
      onEtiquetas={(caja, etiquetas) => onChange({ [caja === "top2box" ? "top2box_labels" : "bottom2box_labels"]: etiquetas })}
      bottomBloqueado={opcionesActivas(valor).includes("bottom2box") ? undefined : NOTA_BOTTOM_NO_NATIVO}
      heredada={propio === undefined ? "Este bloque usa la barra extra de la lámina." : undefined}
      restablecer={propio !== undefined && !mismaBarraExtra(propio, heredado) ? { rotulo: "Usar la de la lámina", onClick: () => fijar(null) } : undefined}
    />
  );
}
