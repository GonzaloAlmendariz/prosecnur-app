// Letra de las categorías y de las cifras y eje libre de las barras agrupadas (U12 del checklist de mandos del mazo). El
// modelo y por qué van en `overrides` están en letraYEje.ts.

import { useId } from "react";
import type { ArgMetadata } from "../../../../api/graficos";
import { Switch } from "../../../../components/Switch";
import { NumeroAcotado } from "../NumeroAcotado";
import {
  conLetraYEje,
  GRAFICADORES_LETRA_Y_EJE,
  LETRA_MAX_PT,
  LETRA_MIN_PT,
  LETRA_PASO_PT,
  leerLetraYEje,
  type LetraYEje,
} from "./letraYEje";

type Props = { graficador: string; args: Readonly<Record<string, unknown>>; onCambio: (overrides: Record<string, unknown> | null) => void };

const letra = (name: string, label: string, porDefecto: number): ArgMetadata => ({
  name, label, tipo_input: "number", grupo: "estilo", min: LETRA_MIN_PT, max: LETRA_MAX_PT, step: LETRA_PASO_PT, default: porDefecto,
});

export function LetraYEjeAgrupadas({ graficador, args, onCambio }: Props) {
  const id = useId();
  if (!GRAFICADORES_LETRA_Y_EJE.has(graficador)) return null;
  const actual = leerLetraYEje(args);
  const cambiar = (c: Partial<LetraYEje>) => onCambio(conLetraYEje(args, c));
  return (
    <>
      <div className="pulso-f6-dato" data-qa="letra-categorias">
        <label className="pulso-f6-dato-rotulo" htmlFor={`${id}-rotulo`}>Letra de las categorías (pt)</label>
        <NumeroAcotado id={`${id}-rotulo`} rotulo="Letra de las categorías" arg={letra("size_ejes", "Letra de las categorías", 12)}
          valor={actual.rotuloPt} placeholder="Auto" onCambio={(v) => cambiar({ rotuloPt: v })} />
      </div>
      <div className="pulso-f6-dato" data-qa="letra-cifras">
        <label className="pulso-f6-dato-rotulo" htmlFor={`${id}-cifra`}>Letra de las cifras (pt)</label>
        <NumeroAcotado id={`${id}-cifra`} rotulo="Letra de las cifras" arg={letra("size_texto_barras", "Letra de las cifras", actual.rotuloPt ?? 12)}
          valor={actual.cifraPt} placeholder="Auto" onCambio={(v) => cambiar({ cifraPt: v })} />
      </div>
      <div className="pulso-f6-dato" data-qa="eje-libre">
        <span className="pulso-f6-dato-rotulo" id={`${id}-eje`}>Eje libre</span>
        <Switch checked={actual.ejeLibre} ariaLabel="Eje libre" onToggle={() => cambiar({ ejeLibre: !actual.ejeLibre })} />
        <span className="pulso-f6-dato-ayuda">La barra mayor llega al borde. Apagado, la escala va de 0 a 100%.</span>
      </div>
    </>
  );
}
