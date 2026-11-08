// Letra de las categorías y de las cifras y eje libre de las barras agrupadas (U12 del checklist de mandos del mazo). El
// modelo y por qué van en `overrides` están en letraYEje.ts.

import { useId } from "react";
import { Switch } from "../../../../components/Switch";
import { NumeroDeslizable } from "../NumeroDeslizable";
import { rangoDeslizable } from "../modeloNumeroDeslizable";
import {
  conLetraYEje,
  ETIQUETAS_MAX_PCT,
  ETIQUETAS_MIN_PCT,
  ETIQUETAS_PASO_PCT,
  GRAFICADORES_LETRA_Y_EJE,
  LETRA_MAX_PT,
  LETRA_MIN_PT,
  LETRA_PASO_PT,
  leerLetraYEje,
  type LetraYEje,
} from "./letraYEje";
import { AyudaGlobo } from "../AyudaGlobo";

type Props = { graficador: string; args: Readonly<Record<string, unknown>>; onCambio: (overrides: Record<string, unknown> | null) => void };

// Sin default: vacío, la columna se ajusta sola a los nombres (`.lam_barras_ancho_rotulos`).
const RANGO_LETRA = rangoDeslizable({ name: "size_ejes", min: LETRA_MIN_PT, max: LETRA_MAX_PT, step: LETRA_PASO_PT }) ?? { min: LETRA_MIN_PT, max: LETRA_MAX_PT, paso: LETRA_PASO_PT, grande: 1 };
const RANGO_ETIQUETAS = rangoDeslizable({ name: "canvas_w_etiquetas", min: ETIQUETAS_MIN_PCT, max: ETIQUETAS_MAX_PCT, step: ETIQUETAS_PASO_PCT })
  ?? { min: ETIQUETAS_MIN_PCT, max: ETIQUETAS_MAX_PCT, paso: ETIQUETAS_PASO_PCT, grande: ETIQUETAS_PASO_PCT };

export function LetraYEjeAgrupadas({ graficador, args, onCambio }: Props) {
  const id = useId();
  if (!GRAFICADORES_LETRA_Y_EJE.has(graficador)) return null;
  const actual = leerLetraYEje(args);
  const cambiar = (c: Partial<LetraYEje>) => onCambio(conLetraYEje(args, c));
  return (
    <>
      {/* Ítem 11 (2026-11-08): la letra y el espacio se arrastran; «Auto» vuelve a lo que decide la lámina. */}
      <NumeroDeslizable id={`${id}-rotulo`} rotulo="Letra de las categorías (pt)" qa="letra-categorias" rango={RANGO_LETRA}
        valor={actual.rotuloPt} porDefecto={12} vacio="Auto" onCambio={(v) => cambiar({ rotuloPt: v })} />
      <NumeroDeslizable id={`${id}-cifra`} rotulo="Letra de las cifras (pt)" qa="letra-cifras" rango={RANGO_LETRA}
        valor={actual.cifraPt} porDefecto={actual.rotuloPt ?? 12} vacio="Auto" onCambio={(v) => cambiar({ cifraPt: v })} />
      <NumeroDeslizable id={`${id}-etiquetas`} rotulo="Espacio para las etiquetas (%)" qa="espacio-etiquetas" rango={RANGO_ETIQUETAS}
        valor={actual.etiquetasPct} vacio="Auto" onCambio={(v) => cambiar({ etiquetasPct: v })}
        marcas={<AyudaGlobo id={`${id}-etiquetas-ayuda`} rotulo="Espacio para las etiquetas"
          detalle="La columna con el nombre de cada barra, en % del ancho de la lámina. Auto, se ajusta a los nombres." />} />
      <div className="pulso-f6-dato" data-qa="eje-libre">
        <span className="pulso-f6-dato-rotulo" id={`${id}-eje`}>
          Eje libre<AyudaGlobo rotulo="Eje libre" detalle="La barra mayor llega al borde. Apagado, la escala va de 0 a 100%." />
        </span>
        <Switch checked={actual.ejeLibre} ariaLabel="Eje libre" onToggle={() => cambiar({ ejeLibre: !actual.ejeLibre })} />
      </div>
    </>
  );
}
