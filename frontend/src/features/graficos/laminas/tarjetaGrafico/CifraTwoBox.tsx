// «Top Two Box 62%» bajo el control de la barra extra (oleada I2, ítem 2), en vivo al marcar o desmarcar categorías:
// el motor suma las cifras rotuladas de las elegidas (modeloCifraTwoBox.ts). Sin detalle, no pinta nada.

import { CifraEstado } from "../cifrasInspector/CifraEstado";
import { useDetalleCifras } from "../cifrasInspector/useDetalleCifras";
import { cifraCaja, textoTwoBox, variantesTwoBox, type CajaTwoBox } from "./modeloCifraTwoBox";

type Props = {
  graficador: string;
  scope: "active" | "consolidated";
  args: Readonly<Record<string, unknown>>;
  /** Las categorías de cada caja encendida. */
  cajas: Readonly<Partial<Record<CajaTwoBox, readonly string[]>>>;
};

export function CifraTwoBox({ graficador, scope, args, cajas }: Props) {
  const variantes = variantesTwoBox(args, cajas);
  const det = useDetalleCifras(graficador, scope, variantes);
  if (!variantes.length) return null;
  const estados = variantes.map((v) => ({ caja: v.clave as CajaTwoBox, e: det[v.clave] }));
  const texto = textoTwoBox(estados.map(({ caja, e }) => ({ caja, cifra: cifraCaja(e?.detalle ?? null) })));
  const vigente = estados.every(({ e }) => e?.vigente);
  const esperando = estados.some(({ e }) => e && !e.vigente);
  return <CifraEstado texto={texto} vigente={vigente} esperando={esperando} qa="twobox-cifra" />;
}
