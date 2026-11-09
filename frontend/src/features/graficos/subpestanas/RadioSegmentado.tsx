// Segmentado de Gráficos sobre el radiogroup del kit (acabado de Láminas, W2-B, 2026-11-08). Reemplaza al Segmentado
// propio de 22 px: GlidingRadioGroup da el patrón WAI-ARIA (un solo punto de tabulación, flechas que mueven y eligen) y
// el pulgar que se desliza. Pulgar BLANCO sobre un riel surface-2, 28 px de alto, el radio único de control; el teal
// sólido queda para la píldora de sección. `ancho` reparte el ancho en partes iguales («Dos bases / Dos grupos»).

import type { ReactNode } from "react";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import "./radioSegmentado.css";

export type OpcionSegmentada<K extends string> = {
  clave: K;
  /** El rótulo admite una cifra dentro (R7-11: «Estándar 99%»). */
  rotulo: ReactNode;
  /** Nombre accesible o tooltip propio cuando el rótulo es corto o lleva cifras. */
  titulo?: string;
  deshabilitada?: boolean;
};

type Props<K extends string> = {
  etiqueta: string;
  opciones: readonly OpcionSegmentada<K>[];
  valor: K;
  onCambiar: (k: K) => void;
  /** A todo el ancho y en partes iguales. Sin esto mide lo que piden sus rótulos. */
  ancho?: boolean;
  /** Un rótulo largo parte línea dentro de su opción en vez de recortarse (C4); el riel crece en alto. */
  multilinea?: boolean;
  /** Las opciones en columna, una por fila a todo el ancho (las flechas arriba/abajo recorren): para rótulos largos en
   *  un ancho angosto, donde partirlos en columnas los cortaría dentro de una palabra (C4). */
  vertical?: boolean;
  deshabilitado?: boolean;
  className?: string;
  /** Grupo de geometría (C1) cuando la superficie lo declara. */
  qaGrupo?: string;
};

export function RadioSegmentado<K extends string>({
  etiqueta, opciones, valor, onCambiar, ancho = false, multilinea = false, vertical = false, deshabilitado = false, className, qaGrupo,
}: Props<K>) {
  return (
    <GlidingRadioGroup
      value={valor}
      options={opciones}
      getOptionValue={(o) => o.clave}
      onValueChange={onCambiar}
      aria-label={etiqueta}
      orientation={vertical ? "vertical" : "horizontal"}
      className={["pulso-f6-segmento", ancho ? "is-ancho" : null, multilinea ? "is-multilinea" : null, vertical ? "is-vertical" : null, className].filter(Boolean).join(" ")}
      data-qa-geometry-group={qaGrupo}
      data-qa-geometry-contract={qaGrupo ? (ancho ? "equal" : "intrinsic") : undefined}
      getOptionProps={(o) => {
        const props: { disabled: boolean; title?: string; "data-qa-geometry-member"?: string } = {
          disabled: deshabilitado || o.deshabilitada === true,
        };
        if (o.titulo) props.title = o.titulo;
        if (qaGrupo) props["data-qa-geometry-member"] = "";
        return props;
      }}
    >
      {(o) => <span className="pulso-f6-segmento-rotulo">{o.rotulo}</span>}
    </GlidingRadioGroup>
  );
}
