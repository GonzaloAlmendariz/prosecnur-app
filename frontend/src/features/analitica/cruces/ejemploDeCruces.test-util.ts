// Dobles de la vista previa de Cruces para las pruebas (contrato v2). Las tres
// respuestas de `ejemplos/` son las REALES de `POST /api/analitica/cruces/preview`
// (oleada 10, H), copiadas sin tocar: acnur_acg sin pesos y con calibración por
// M3_edu (filas D1_information y E6_impact contra M5_district y E2_sex, con
// "Otro" de E2_sex excluido) y acnur_pdm en la base hija `rep_servicios`
// (registros), con una variable de cruce que sale frente al resto.
//
// Las variantes que esas respuestas no traen (flechas, letras por rótulo,
// casos sin columna, filas omitidas, avisos) se arman abajo a mano y lo dicen.
//
// No es una prueba ni se importa desde la app.

import {
  normalizarCrucesPreview,
  type CrucesPreview,
  type CrucesPreviewAviso,
  type CrucesPreviewTabla,
} from "../../../api/analitica";
import BASE_HIJA from "./ejemplos/base-hija.json";
import CON_PESOS from "./ejemplos/con-pesos.json";
import SIN_PESOS from "./ejemplos/sin-pesos.json";

/** Copia profunda: cada prueba recibe su propia respuesta. */
const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export const crudaSinPesos = (): unknown => copia(SIN_PESOS);
export const crudaConPesos = (): unknown => copia(CON_PESOS);
export const crudaBaseHija = (): unknown => copia(BASE_HIJA);

export const respuestaSinPesos = (): CrucesPreview => normalizarCrucesPreview(crudaSinPesos());
export const respuestaConPesos = (): CrucesPreview => normalizarCrucesPreview(crudaConPesos());
export const respuestaBaseHija = (): CrucesPreview => normalizarCrucesPreview(crudaBaseHija());

/** Una tabla de una respuesta, por su variable de fila. */
export function tablaDe(preview: CrucesPreview, variable: string): CrucesPreviewTabla {
  const t = preview.tablas.find((x) => x.variable === variable);
  if (!t) throw new Error(`La respuesta no trae la tabla ${variable}`);
  return copia(t);
}

/** Respuesta sin tablas con un aviso del servicio (a mano: no hay ejemplo real). */
export function respuestaSinVariablesDeCruce(): CrucesPreview {
  return {
    ...respuestaSinPesos(),
    cruces: [],
    exclusiones: [],
    significancia_regla: null,
    total_variables: 0,
    total_en_archivo: 0,
    devueltas: 0,
    recortado: false,
    tablas: [],
    sin_tabla: [],
    avisos: [{ codigo: "sin_variables_de_cruce", mensaje: "No hay tablas porque no hay variables de cruce configuradas." }],
  };
}

/** Con un aviso más (a mano). */
export function conAviso(preview: CrucesPreview, aviso: CrucesPreviewAviso): CrucesPreview {
  return { ...preview, avisos: [...preview.avisos, aviso] };
}

/** Recortada: 20 de 26 tablas (a mano sobre la respuesta sin pesos). */
export function respuestaRecortada(): CrucesPreview {
  return { ...respuestaSinPesos(), total_variables: 26, total_en_archivo: 27, devueltas: 2, limite: 20, recortado: true };
}
