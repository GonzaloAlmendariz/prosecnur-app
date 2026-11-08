// «Excluir respuestas» con su cifra (oleada I2, ítem 1): las fichas de SelectorCategorias con el % de cada una en la
// lámina, la base antes y después junto al resumen («Base 412 → 380») y, al pasar el cursor o enfocar una ficha, el
// efecto de alternarla («Sin "No sabe": Sí 58% → 63%»). Las cifras son las del motor, con pesos y filtros
// (modeloExcluir.ts); sin detalle, las fichas quedan como siempre, con su n.

import { useState, type ReactNode } from "react";
import { codigosATexto, textoACodigos } from "../argsDatosGrafico";
import { SelectorCategorias, SIN_CASOS } from "../SelectorCategorias";
import { useCategoriasGrafico } from "../useCategoriasGrafico";
import { rotuloVisible } from "../rotuloCortoDeLista";
import { useRotulosCortos } from "../useRotulosCortos";
import { CifraEstado } from "../cifrasInspector/CifraEstado";
import { pctDe, textoBase } from "../cifrasInspector/modeloCifras";
import { useDetalleCifras } from "../cifrasInspector/useDetalleCifras";
import { ACTUAL, efectoSondeo, EXCLUIDA, SIN, SONDEO, variantesExcluir } from "./modeloExcluir";
import "./excluirRespuestas.css";

type Props = {
  id: string;
  etiqueta: ReactNode;
  variable: string;
  scope: "active" | "consolidated";
  graficador: string;
  args: Readonly<Record<string, unknown>>;
  argName: string;
  valor: unknown;
  onCambio: (codigos: string[]) => void;
  textoRespaldo: ReactNode;
};

export function ExcluirRespuestas({ id, etiqueta, variable, scope, graficador, args, argName, valor, onCambio, textoRespaldo }: Props) {
  const cats = useCategoriasGrafico(variable, scope, graficador);
  const cortos = useRotulosCortos();
  const [sondeo, setSondeo] = useState<string | null>(null);
  const elegidos = textoACodigos(codigosATexto(valor));
  const lista = cats.fase === "lista" ? cats.datos.categorias : [];
  const claves = lista.map((c) => c.codigo);
  const det = useDetalleCifras(graficador, scope, variantesExcluir(args, argName, elegidos, sondeo, claves));
  const actual = det[ACTUAL];
  const sin = det[SIN];
  const sondeada = sondeo ? lista.find((c) => c.codigo === sondeo) : undefined;
  const yaExcluida = !!sondeo && elegidos.includes(sondeo);

  const cifraDe = (codigo: string, etiquetaCat: string, n: number) => {
    // R7-12: la excluida dice «Excluida» (su % sobre la base anterior confundía); sin casos, «0 casos»; las demás, el %
    // de la lámina actual con los decimales del gráfico (los del detalle del motor).
    if (!actual || actual.sinDetalle) return null;
    if (elegidos.includes(codigo)) return { texto: EXCLUIDA, vigente: true };
    if (n === 0) return { texto: SIN_CASOS, vigente: true };
    const texto = pctDe(actual.detalle, [etiquetaCat, rotuloVisible(cortos, etiquetaCat).texto, codigo]);
    return texto ? { texto, vigente: actual.vigente } : null;
  };
  const base = actual && !actual.sinDetalle ? textoBase(elegidos.length ? sin?.detalle ?? null : null, actual.detalle) : null;
  // R7-4: el efecto sólo con las dos cifras al día; mientras llega, silueta. Nunca la cifra de la ficha anterior con el
  // rótulo de la nueva.
  const sondeoListo = !!det[SONDEO]?.vigente && !!actual?.vigente;
  const efecto = sondeada && sondeoListo && det[SONDEO]
    ? efectoSondeo(actual?.detalle ?? null, det[SONDEO].detalle, sondeada.etiqueta || sondeada.codigo, yaExcluida)
    : null;
  // W2-B (contrato C5): la línea del efecto sólo se monta con una ficha sondeada; vacía no existe (antes se montaba vacía
  // y la ocultaba un :empty). Con contenido se dibuja en el renglón de la cabecera (datosGrafico.css): no empuja nada.
  const conEfecto = !!actual && !actual.sinDetalle && !!sondeada && !det[SONDEO]?.sinDetalle;

  return (
    <SelectorCategorias id={id} etiqueta={etiqueta} variable={variable} scope={scope} graficador={graficador} valor={valor} modo="excluir"
      textoRespaldo={textoRespaldo} nota={null} onCambio={onCambio} cifraDe={cifraDe} onSondear={setSondeo}
      estado={<CifraEstado texto={base} vigente={!!actual?.vigente && (!elegidos.length || !!sin?.vigente)} esperando={!actual?.sinDetalle && !actual?.vigente} qa="excluir-base" />}
      efecto={conEfecto ? (
        <span className="pulso-f6-excluir-efecto" data-qa="excluir-efecto-linea">
          <CifraEstado texto={efecto} vigente={sondeoListo} esperando={!sondeoListo} qa="excluir-efecto" />
        </span>
      ) : null} />
  );
}
