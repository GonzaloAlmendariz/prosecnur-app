// H4: índice de la tarjeta del gráfico. Las secciones que ese tipo de gráfico no tiene se ocultan por CSS, con la misma
// regla que oculta la sección vacía (datosGrafico.css).

import type { RefObject } from "react";
import { useLaminasUi } from "../laminasStore";
import { esSeccionTarjeta, ROTULO_INDICE, SECCIONES_TARJETA, TITULO_GRUPO } from "../gruposTarjeta";
import { IndicePlegables } from "./IndicePlegables";

const ENTRADAS = SECCIONES_TARJETA.map((s) => ({ clave: s, rotulo: ROTULO_INDICE[s], titulo: TITULO_GRUPO[s] }));

export function IndiceSecciones({ tarjeta }: { tarjeta: RefObject<HTMLElement> }) {
  const abrir = useLaminasUi((s) => s.abrirSeccionTarjeta);
  return (
    <IndicePlegables tarjeta={tarjeta} entradas={ENTRADAS} etiqueta="Secciones del gráfico"
      onAbrir={(c) => { if (esSeccionTarjeta(c)) abrir(c); }} />
  );
}
