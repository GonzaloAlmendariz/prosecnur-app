import { TIPO_ETIQUETA, TIPO_TONO, type TipoVariable } from "./tiposVariable";

/** El tipo de la pregunta en su chip teñido (`--tipo-*`), como el prototipo. */
export default function ChipTipo({ tipo }: { tipo: TipoVariable }) {
  const etiqueta = TIPO_ETIQUETA[tipo] ?? TIPO_ETIQUETA.mixto;
  return <span className="vx-tipo-chip" data-tono={TIPO_TONO[tipo] ?? "neutro"}>{etiqueta.larga}</span>;
}
