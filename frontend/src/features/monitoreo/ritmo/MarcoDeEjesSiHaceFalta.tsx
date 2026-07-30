/**
 * Envuelve un gráfico de ritmo en `MarcoDeRitmo` solo cuando hace falta.
 *
 * Con pocos cortes el gráfico cabe y Plotly dibuja sus propios ejes; pasado el
 * mes y medio la columna del gráfico se desplaza y los ejes tienen que salir de
 * ella. Sin este envoltorio, cada vista repetía el mismo ternario alrededor de
 * su `PlotlyChart` —y en un page-file congelado eso son diez líneas duplicadas
 * por gráfico—.
 *
 * Los hijos van dentro de la columna que se desplaza, así que aquí entra también
 * lo que tenga que seguir alineado con las barras: en telefónico, la banda de
 * etiquetas por día es un eje X propio en HTML y si se quedara fuera dejaría de
 * corresponder con su barra al scrollear.
 */

import type { ReactNode } from "react";

import { MarcoDeRitmo } from "./MarcoDeRitmo";

export function MarcoDeEjesSiHaceFalta({
  activo,
  alto,
  margenSuperior = 36,
  margenInferior,
  maximoIzquierdo,
  maximoDerecho,
  tituloIzquierdo,
  tituloDerecho = "Acumulado",
  anchoContenido,
  children,
}: {
  activo: boolean;
  alto: number;
  margenSuperior?: number;
  margenInferior: number;
  maximoIzquierdo: number;
  maximoDerecho: number;
  tituloIzquierdo: string;
  tituloDerecho?: string;
  anchoContenido: number;
  children: ReactNode;
}) {
  if (!activo) return <>{children}</>;
  return (
    <MarcoDeRitmo
      alto={alto}
      margenSuperior={margenSuperior}
      margenInferior={margenInferior}
      ejeIzquierdo={{ titulo: tituloIzquierdo, maximo: maximoIzquierdo }}
      ejeDerecho={{ titulo: tituloDerecho, maximo: maximoDerecho }}
      anchoMinimoContenido={anchoContenido}
    >
      {children}
    </MarcoDeRitmo>
  );
}
