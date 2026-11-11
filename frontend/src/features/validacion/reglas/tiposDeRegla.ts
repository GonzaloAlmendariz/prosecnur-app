/**
 * Tipos de regla propia que ofrece el editor, con lo que cada uno revisa.
 *
 * Salió de `components/ReglaEditor.tsx` sin cambios (rebanada V1 de P6) para
 * que el panel de regla nuevo y el editor viejo lean la misma tabla.
 */
import type { ReglaCustomTipo } from "../types";

export type TipoMeta = {
  key: ReglaCustomTipo;
  label: string;
  descripcion: string;
  nVars: number | [number, number];
  grupo: "respuesta" | "coherencia" | "seleccion";
  pregunta: string;
  ejemplo: string;
  resultado: string;
  variableHint: string;
  badge?: string;
  legacyHidden?: boolean;
};

export const TIPOS: TipoMeta[] = [
  {
    key: "no_nulo",
    label: "Respuesta obligatoria",
    descripcion: "Encuentra respuestas vacías donde esperas una respuesta.",
    nVars: 1,
    grupo: "respuesta",
    pregunta: "¿Esta pregunta debe tener respuesta cuando aplica?",
    ejemplo: "Ej. si la persona aceptó participar, el consentimiento no puede quedar vacío.",
    resultado: "Detecta vacíos para tratamiento posterior.",
    variableHint: "Elige la pregunta que no debería quedar vacía.",
    badge: "Completitud",
    legacyHidden: true,
  },
  {
    key: "rango_num",
    label: "Valor fuera de rango",
    descripcion: "Encuentra números por debajo o por encima de lo permitido.",
    nVars: 1,
    grupo: "respuesta",
    pregunta: "¿Un número debe estar entre un mínimo y un máximo?",
    ejemplo: "Ej. la edad debe estar entre 16 y 25 años, o una entrevista no puede durar 2 minutos.",
    resultado: "Detecta valores fuera del rango definido.",
    variableHint: "Elige la pregunta numérica: edad, duración, conteo.",
    badge: "Rango",
  },
  {
    key: "rango_fecha",
    label: "Fecha fuera del operativo",
    descripcion: "Encuentra fechas que no pertenecen al periodo real de levantamiento.",
    nVars: 1,
    grupo: "respuesta",
    pregunta: "¿La fecha cae fuera de las fechas esperadas del trabajo de campo?",
    ejemplo: "Ej. fecha de encuesta antes del inicio del operativo o después del cierre.",
    resultado: "Detecta fechas fuera del periodo definido.",
    variableHint: "Elige la fecha de entrevista, envío, registro u otra fecha operativa.",
    badge: "Operativo",
  },
  {
    key: "outliers_iqr",
    label: "Outliers (IQR)",
    descripcion: "Alerta valores extremos respecto a la distribución de la variable.",
    nVars: 1,
    grupo: "respuesta",
    pregunta: "¿Qué valores extremos deben aparecer como señal?",
    ejemplo: "Ej. ingresos muy alejados del resto de respuestas.",
    resultado: "Detecta outliers estadísticos para análisis avanzado.",
    variableHint: "Elige una pregunta numérica.",
    legacyHidden: true,
  },
  {
    key: "outliers_z",
    label: "Outliers (Z-score)",
    descripcion: "Alerta valores muy alejados del comportamiento histórico.",
    nVars: 1,
    grupo: "respuesta",
    pregunta: "¿Qué valores con z-score alto deben aparecer como señal?",
    ejemplo: "Ej. conteos muy alejados de la media.",
    resultado: "Detecta outliers estadísticos para análisis avanzado.",
    variableHint: "Elige una pregunta numérica.",
    legacyHidden: true,
  },
  {
    key: "duplicados",
    label: "Duplicados operativos",
    descripcion: "Encuentra personas o casos que parecen repetidos por identificadores prácticos.",
    nVars: [1, 5],
    grupo: "coherencia",
    pregunta: "¿Hay casos que parecen la misma persona, hogar o atención?",
    ejemplo: "Ej. mismo documento, mismo teléfono o misma combinación de identificadores.",
    resultado: "Detecta filas candidatas para excluir o documentar.",
    variableHint: "Elige una o más columnas que juntas identifican un caso.",
    badge: "Duplicados",
  },
  {
    key: "fuera_catalogo",
    label: "Respuesta fuera de lista",
    descripcion: "Encuentra valores que no pertenecen al catálogo permitido.",
    nVars: 1,
    grupo: "respuesta",
    pregunta: "¿La respuesta debe estar dentro de una lista cerrada?",
    ejemplo: "Ej. distrito, estado o código que no existe en el catálogo.",
    resultado: "Detecta valores para recodificar por mapa o corregir.",
    variableHint: "Elige la pregunta con catálogo cerrado.",
    badge: "Catálogo",
    legacyHidden: true,
  },
  {
    key: "coherencia_2v",
    label: "Dos respuestas que deben cuadrar",
    descripcion: "Cruza dos preguntas: si una dice algo, la otra debería ser coherente.",
    nVars: 2,
    grupo: "coherencia",
    pregunta: "Si una respuesta es X, ¿qué debería decir la otra?",
    ejemplo: "Ej. si está cursando estudios superiores, su ocupación no puede ser \"solo trabajo\".",
    resultado: "Detecta registros donde la segunda respuesta no cuadra con la primera.",
    variableHint: "Elige primero la pregunta que pone la condición y luego la que se verifica.",
    badge: "Cruce",
  },
  {
    key: "select_multiple_hierarchy",
    label: "Completar opciones asumidas",
    descripcion: "Encuentra selección múltiple donde falta una opción que debería acompañar a otra.",
    nVars: 1,
    grupo: "seleccion",
    pregunta: "¿Marcar una opción implica que otras también deberían estar marcadas?",
    ejemplo: "Ej. si marcó “Magíster”, quizá también debe marcar “Bachiller” y “Titulado/a”.",
    resultado: "Detecta candidatos para completar jerarquías desde Limpieza.",
    variableHint: "Elige la pregunta de selección múltiple que necesita un mapa manual.",
    badge: "Selección múltiple",
  },
  {
    key: "select_multiple_exclusive",
    label: "Opciones incompatibles",
    descripcion: "Encuentra opciones de selección múltiple que no deberían marcarse juntas.",
    nVars: 1,
    grupo: "seleccion",
    pregunta: "¿Hay opciones que excluyen a las demás?",
    ejemplo: "Ej. “Ninguno” marcado junto con servicios específicos.",
    resultado: "Detecta candidatos para quitar opciones, anular campos o documentar.",
    variableHint: "Elige la pregunta de selección múltiple y luego indica las opciones excluyentes.",
    badge: "Exclusividad",
  },
  {
    key: "select_multiple_cardinality",
    label: "Cantidad de opciones marcada",
    descripcion: "Encuentra respuestas con demasiadas o muy pocas opciones elegidas.",
    nVars: 1,
    grupo: "seleccion",
    pregunta: "¿La persona no debería marcar tantas o tan pocas opciones?",
    ejemplo: "Ej. si fue una sola vez, revisar cuando aparecen 8 servicios marcados.",
    resultado: "Detecta respuestas con demasiadas o muy pocas opciones marcadas.",
    variableHint: "Elige la pregunta de selección múltiple y define mínimo o máximo.",
    badge: "Cantidad",
  },
  {
    key: "select_multiple_selection",
    label: "Opciones esperadas o prohibidas",
    descripcion: "Encuentra respuestas que deberían incluir o evitar ciertas opciones.",
    nVars: 1,
    grupo: "seleccion",
    pregunta: "¿Qué opciones específicas deben generar una señal?",
    ejemplo: "Ej. debe contener “servicio principal” o no debe contener “otro”.",
    resultado: "Detecta registros para ajustar selección múltiple o documentar.",
    variableHint: "Elige la pregunta de selección múltiple y luego indica las opciones.",
    badge: "Opciones",
  },
];
