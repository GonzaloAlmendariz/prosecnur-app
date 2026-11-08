// Columna Top Two Box del «Mapa de calor por cruce» en la sección Cálculo de la tarjeta (ADR 0137). Un segmentado
// Automática / Sí / No y, salvo con «No», las categorías que suma como fichas de la pregunta (por su rótulo exacto, que
// es lo que el motor compara). Todo vive en `overrides` (modeloTopTwoBoxCruce.ts). Superficie intrínseca: crece con sus
// fichas y el scroll es del cuerpo del inspector (C4); sin pregunta elegida, las fichas dicen su propio vacío (C3).

import { AyudaGlobo } from "../AyudaGlobo";
import { SelectorCategorias } from "../SelectorCategorias";
import { FilaSegmentada } from "../tarjetaGrafico/FilaSegmentada";
import { segmentacionFija } from "../opcionesEnSegmentado";
import {
  estadoTopTwoBoxCruce,
  leerTopTwoBoxCruce,
  parcheTopTwoBoxCruce,
  type ModoTopTwoBoxCruce,
} from "./modeloTopTwoBoxCruce";

type Props = {
  id: string;
  args: Readonly<Record<string, unknown>>;
  /** Pregunta calificada (`base$var`), o vacía si aún no se eligió. */
  variable: string;
  scope: "active" | "consolidated";
  onCambio: (patch: Record<string, unknown>) => void;
};

const MODOS = segmentacionFija([
  { value: "auto", label: "Automática" },
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
]);

const AYUDA = "Automática: sale si la escala es ordinal de cuatro puntos o más. Va al final de la tabla, en verde, y no entra a la escala de color.";

const esModo = (v: string): v is ModoTopTwoBoxCruce => v === "auto" || v === "si" || v === "no";

export function TopTwoBoxCruce({ id, args, variable, scope, onCambio }: Props) {
  const actual = leerTopTwoBoxCruce(args);
  const estado = estadoTopTwoBoxCruce(actual);
  return (
    <div className="pulso-f6-twobox" data-qa="heatmap-cruce-top2box"
      data-qa-geometry-group="graficos/f6-heatmap-top2box" data-qa-geometry-contract="intrinsic">
      <FilaSegmentada id={`${id}-modo`} rotulo="Columna Top Two Box"
        marcas={<AyudaGlobo id={`${id}-ayuda`} rotulo="Columna Top Two Box" detalle={AYUDA} />}
        segmentos={MODOS} valor={actual.modo}
        onCambio={(v) => { if (esModo(v)) onCambio(parcheTopTwoBoxCruce(args, { modo: v })); }} />
      {actual.modo !== "no" && (
        <SelectorCategorias id={`${id}-categorias`} etiqueta={<span className="pulso-f6-dato-rotulo">Categorías del Top Two Box</span>}
          variable={variable} scope={scope} graficador="p_heatmap_cruce" valor={actual.etiquetas} modo="elegir" porEtiqueta
          nota={estado ? <span className="pulso-f6-dato-ayuda is-aviso" role="status">{estado}</span> : null}
          textoRespaldo={<div className="pulso-f6-dato is-apilado"><span className="pulso-f6-dato-rotulo">Categorías del Top Two Box</span><span className="pulso-f6-dato-ayuda">La pregunta no tiene categorías que sumar.</span></div>}
          onCambio={(etiquetas) => onCambio(parcheTopTwoBoxCruce(args, { etiquetas }))} />
      )}
    </div>
  );
}
