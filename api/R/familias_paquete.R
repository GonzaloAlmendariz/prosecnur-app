# Familias funcionales del paquete prosecnur
#
# Convencion de organizacion por archivo:
# - validacion_*
# - codificacion_*
# - reporte_*
# - graficador_*
# - interactivo_*
# - surveymonkey_*
# - indicador_*
#
# Nota: esta definicion es interna y no cambia la API publica.

.familias_prosecnur <- list(
  validacion = "Reglas, auditoria, lectura y plan de limpieza",
  codificacion = "Flujo de codificacion y adaptaciones de instrumento/data",
  reporte = "Entregables SAV, PPT, Excel, Word y produccion de encuestadores",
  graficador = "Graficos reutilizables para reportes y tableros",
  interactivo = "Dashboard y modulos interactivos",
  surveymonkey = "Traduccion y adaptacion de exportaciones SurveyMonkey",
  indicador = "Definicion de indicadores y puntajes (0-100)"
)
