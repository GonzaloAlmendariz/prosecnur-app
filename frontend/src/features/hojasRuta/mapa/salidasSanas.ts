import type { HojasRutaWorkspaceOutputs } from "../../../api/hojasRuta";

/**
 * Las salidas del estado tal como las usa la página. R serializa una muestra vaciada como `{}` (sin `blocks`):
 * pasó en vivo al guardar el N con distritos nuevos de otras ciudades, y la página se caía al contar
 * `sample.blocks.length`. Una muestra sin su lista de titulares no es una muestra: se lee como «no hay», y a una
 * que sí tiene titulares le falta como mucho la lista de reemplazos, que se lee vacía.
 */
export function salidasSanas(outputs: HojasRutaWorkspaceOutputs | null | undefined): HojasRutaWorkspaceOutputs | undefined {
  if (!outputs) return undefined;
  const sample = outputs.sample;
  if (!sample) return outputs;
  if (!Array.isArray(sample.blocks)) return { ...outputs, sample: null };
  if (!Array.isArray(sample.replacement_blocks)) return { ...outputs, sample: { ...sample, replacement_blocks: [] } };
  return outputs;
}
