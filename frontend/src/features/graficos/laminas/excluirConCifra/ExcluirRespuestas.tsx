// «Excluir respuestas» con su cifra (oleada I2, ítem 1): las fichas de SelectorCategorias con el % de cada una en la
// lámina, la base antes y después junto al resumen («Base 412 → 380») y, al pasar el cursor o enfocar una ficha, el
// efecto de alternarla («Sin "No sabe": Sí 58% → 63%»). Las cifras son las del motor, con pesos y filtros
// (modeloExcluir.ts); sin detalle, las fichas quedan como siempre, con su n.

import { useState, type ReactNode } from "react";
import { codigosATexto, textoACodigos } from "../argsDatosGrafico";
import { SelectorCategorias } from "../SelectorCategorias";
import { useCategoriasGrafico } from "../useCategoriasGrafico";
import { rotuloVisible } from "../rotuloCortoDeLista";
import { useRotulosCortos } from "../useRotulosCortos";
import { CifraEstado } from "../cifrasInspector/CifraEstado";
import { pctDe, textoBase } from "../cifrasInspector/modeloCifras";
import { useDetalleCifras } from "../cifrasInspector/useDetalleCifras";
import { ACTUAL, efectoSondeo, SIN, SONDEO, variantesExcluir } from "./modeloExcluir";

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

  const cifraDe = (codigo: string, etiquetaCat: string) => {
    // La excluida dice el % que tendría sin exclusiones; las demás, el de la lámina actual.
    const e = elegidos.includes(codigo) ? sin : actual;
    const texto = e ? pctDe(e.detalle, [etiquetaCat, rotuloVisible(cortos, etiquetaCat).texto, codigo]) : null;
    return texto && e ? { texto, vigente: e.vigente } : null;
  };
  const base = actual && !actual.sinDetalle ? textoBase(elegidos.length ? sin?.detalle ?? null : null, actual.detalle) : null;
  const efecto = sondeada && det[SONDEO]
    ? efectoSondeo(actual?.detalle ?? null, det[SONDEO].detalle, sondeada.etiqueta || sondeada.codigo, yaExcluida)
    : null;

  return (
    <SelectorCategorias id={id} etiqueta={etiqueta} variable={variable} scope={scope} graficador={graficador} valor={valor} modo="excluir"
      textoRespaldo={textoRespaldo} nota={null} onCambio={onCambio} cifraDe={cifraDe} onSondear={setSondeo}
      estado={<CifraEstado texto={base} vigente={!!actual?.vigente && (!elegidos.length || !!sin?.vigente)} esperando={!actual?.sinDetalle && !actual?.vigente} qa="excluir-base" />}
      efecto={sondeada && (efecto || !det[SONDEO]?.sinDetalle)
        ? <CifraEstado texto={efecto} vigente={!!det[SONDEO]?.vigente} qa="excluir-efecto" />
        : null} />
  );
}
