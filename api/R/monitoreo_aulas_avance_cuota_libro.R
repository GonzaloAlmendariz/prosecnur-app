# El bloque `avance_cuota` del tablero, puesto al alcance de las superficies del
# LIBRO —la hoja «Avance de campo» (xlsx y Sheets), la pantalla de Avance y el
# PDF de avance a cliente—.
#
# POR QUÉ EXISTE
#
# `.calaf_avance_por_facultad()` agrupa el plan por la FACULTAD del aula
# (`u$faculty`) y casa esa clave contra las filas de `design_targets$facultades`.
# Con el eje declarable (ADR 0086) esas filas ya no son facultades: en CCSS
# Perfil 2026-II son los cuatro NIVELES —`faculty_key` `"6"`/`"7"`/`"8"`/`"9"`,
# cuotas 119/122/97/62— mientras las 136 unidades del plan traen todas
# `faculty = "CIENCIAS SOCIALES"`. Ninguna clave casa nunca, y el bloque salió
# publicado el 2026-09-22, con campo corriendo, con Efectivas 0, Avance 0,0 % y
# Aulas planificadas 0 en las cuatro filas, encima de un bloque general que
# decía 50 aulas y al lado de «Rendimiento por facultad» con 72 efectivas.
#
# **La salida NO es un segundo cruce.** El archivo de la tabla ya advierte que
# «dos cruces del mismo dato se separan en cuanto uno cambia», y ese comentario
# se ganó con un bug real. `.monitoreo_aulas_avance_cuota()` ya emite, por celda
# del eje, `cuota`, `respuestas_validas`, `brecha` y `avance_pct`, con la
# atribución por PERSONA —código del alumno contra el padrón— que es la única
# correcta cuando la cuota es por nivel: un aula de nivel 6 tiene alumnos de 5,
# 6 y 7, y atribuir por el nivel del aula es justo lo que los ADR 0086/0088
# existen para impedir. Esta función hace llegar ESE bloque, no otro.
#
# POR QUÉ NO LO PIDE LA TABLA POR SU CUENTA
#
# La tabla recibe `unidades` —el plan ya RECORTADO a lo que entra al libro— y no
# recibe el padrón, que vive sólo en la sesión y viaja por argumento para que la
# purga lo alcance (ADR 0087). El bloque, en cambio, se computa sobre el plan
# ENTERO: toda respuesta recogida cuenta a su celda, incluidas las de reservas y
# banco. Así que lo arma quien tiene las dos cosas —los cuatro llamadores con
# sesión— y la tabla sólo lo consume.

#' El bloque de avance contra la cuota, computado para el libro.
#'
#' Devuelve `NULL` —y el consumidor se queda **exactamente** como estaba— cuando
#' el eje del estudio se atribuye al AULA. Ésa es la vara de aceptación de este
#' satélite: HSVG2026 y todo estudio con eje en facultad no pagan ni el cálculo
#' ni un byte de diferencia.
#'
#' @param plan el plan ENTERO del estudio (lista de filas o `data.frame`), no el
#'   recorte que entra al libro.
#' @param responses respuestas sincronizadas.
#' @param cfg config de aulas universitarias.
#' @param padron el padrón que traduce código de alumno → valor del eje. Viaja
#'   por argumento y no por `cfg` (ADR 0087). Sin él, el bloque lo declara en su
#'   `aviso_eje` en vez de suplirlo.
#' @return la lista de `.monitoreo_aulas_avance_cuota()`, o `NULL`.
#' @keywords internal
monitoreo_aulas_avance_cuota_del_plan <- function(plan = list(), responses = NULL,
                                                  cfg = list(), padron = NULL) {
  # **El guard primero, y barato.** Leer el eje del cfg crudo cuesta un `[[`;
  # normalizar la config y convertir el plan cuesta segundos sobre un operativo
  # de mil aulas. Un estudio con eje en aula sale por aquí sin tocar nada.
  if (!identical(.monitoreo_scalar(monitoreo_aulas_eje(cfg)[["atribucion"]], "aula"), "persona")) {
    return(NULL)
  }
  cfg <- monitoreo_aulas_normalize_config(cfg)
  plan_df <- .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(plan %||% list()), "plan")
  if (!is.data.frame(plan_df) || !nrow(plan_df)) return(NULL)

  valid_response <- .monitoreo_aulas_valid_response(responses, cfg)
  response_classroom <- .monitoreo_aulas_response_classroom(responses, cfg)

  # **El mismo `tracked_df` que el tablero**, y por el mismo motivo: fuera el
  # banco —los extras no reemplazan a nadie— y fuera los eslabones dormidos de
  # cada cadena, que contarían el mismo slot tantas veces como respaldos tenga.
  # Sólo lo usa el respaldo del denominador (`fuente = "plan"`), pero derivarlo
  # distinto aquí dejaría dos definiciones de «aula en juego» en el paquete.
  rol <- as.character(plan_df[["sample_role"]] %||% rep("", nrow(plan_df)))
  rol[is.na(rol)] <- ""
  seguidas <- plan_df[rol != "extra_reserve_pool", , drop = FALSE]
  if (!nrow(seguidas)) seguidas <- plan_df
  tracked_df <- seguidas[monitoreo_aulas_en_juego(seguidas), , drop = FALSE]
  if (!nrow(tracked_df)) tracked_df <- seguidas

  # Las celdas de sexo, con el mismo insumo que el tablero: la brecha de una
  # celda es la suma de las suyas y no la resta de su total (ADR 0079). Un
  # estudio cuya cuota es sólo por el eje no declara ninguna y la lista sale
  # vacía, que es lo que hace que la brecha sea el neto.
  celdas_sexo <- .monitoreo_aulas_cuotas_sexo_celdas(
    plan_df, tracked_df, responses, cfg, valid_response, response_classroom)

  .monitoreo_aulas_avance_cuota(
    plan_df, tracked_df, responses, cfg, valid_response, response_classroom,
    celdas_sexo = celdas_sexo, padron = padron)
}

#' Las celdas del bloque, indexadas por su clave, para la tabla del libro.
#'
#' `NULL` cuando el bloque no es consumible, y entonces la tabla se comporta
#' como el día que no existía. Tres condiciones, todas necesarias:
#'
#' * **el eje se atribuye por PERSONA**: con el eje en aula la tabla ya casa sus
#'   claves y no hay nada que sustituir;
#' * **el bloque trae metas del DISEÑO** (`fuente == "design_targets"`): con el
#'   denominador degradado al plan, sus filas son claves del plan y no las
#'   celdas de `cuotas$facultades` que la tabla recorre — cruzar dos juegos de
#'   claves distintos es volver al defecto de origen;
#' * **y trae filas**.
#'
#' **La atribución se lee del BLOQUE, no del `cfg` del consumidor.** El bloque
#' declara su propio eje (`monitoreo_aulas_eje_declaracion()`) justamente para
#' que nadie tenga que adivinar de qué son sus celdas, y los cuatro llamadores
#' no reciben todos la misma config: el publicador a Sheets pasa a la tabla su
#' `config_reparto`, que es otra variable aunque hoy apunte al mismo objeto.
#' Preguntarle al `cfg` del consumidor sería una segunda lectura del mismo hecho
#' que se puede separar de la primera con un solo renombre.
#'
#' @param avance_cuota el bloque de [monitoreo_aulas_avance_cuota_del_plan()].
#' @return lista con nombre por `faculty_key`, o `NULL`.
#' @keywords internal
.maacl_celdas_por_clave <- function(avance_cuota) {
  if (!is.list(avance_cuota)) return(NULL)
  eje <- avance_cuota[["eje"]] %||% list()
  if (!identical(.monitoreo_scalar(eje[["atribucion"]] %||% "aula", "aula"), "persona")) {
    return(NULL)
  }
  if (!identical(.monitoreo_scalar(avance_cuota$fuente, ""), "design_targets")) return(NULL)
  filas <- avance_cuota$facultades %||% list()
  if (!length(filas)) return(NULL)
  claves <- vapply(filas, function(f) .monitoreo_scalar((f %||% list())[["faculty_key"]], ""), character(1))
  ok <- nzchar(claves) & !duplicated(claves)
  if (!any(ok)) return(NULL)
  stats::setNames(filas[ok], claves[ok])
}
