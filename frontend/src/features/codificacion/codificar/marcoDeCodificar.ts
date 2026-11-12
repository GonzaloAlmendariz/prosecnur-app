// El marco de la pestaña Codificar: la cabecera con sus cifras y la mesa de tres columnas. Lo arma la
// pestaña (`CodificarWizard`), que conoce las preguntas; la mesa de cada pregunta le pasa sus cifras, sus
// acciones y sus dos columnas (Respuestas y Códigos). Así la cabecera y la mesa son una sola pieza para
// todas las formas de codificar (texto, numérica, agrupar categorías) y para los estados de carga y error.

import type { ReactElement, ReactNode } from "react";
import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";

export type PartesDeMesa = {
  /** Las cifras de la pregunta en curso, después de las del estudio. */
  cifras?: readonly CifraDePestana[];
  /** Las acciones de la pregunta en curso: guardado, deshacer y la vista. */
  acciones?: ReactNode;
  /** Lo que la cabecera todavía no puede decir, con su causa. */
  pendientes?: string;
  /** Las columnas que siguen a la de preguntas: dos contenedores, o uno que ocupa las dos. */
  columnas: ReactNode;
};

export type MarcoDeCodificar = (partes: PartesDeMesa) => ReactElement;
