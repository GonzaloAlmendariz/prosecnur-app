# =============================================================================
# Monitoreo — calidad del trabajo de campo
# =============================================================================
# Las siete alertas del motor miden avance contra meta: brecha, objetivo,
# cuotas, benchmark, mínimo estadístico. Ninguna mira CÓMO se está recolectando.
#
# El caso que abrió el GOAL: una encuestadora trabajó casi seis horas con una
# versión desactualizada del formulario mientras sus compañeros usaban la
# corregida. Seis encuestas salieron con saltos y catálogos viejos, y nadie se
# enteró hasta Validación — cuando lo único que quedaba era corregir el dato.
#
# `monitoreo_engine.R` está congelado a crecimiento, así que esto vive aparte y
# el motor lo llama. Doc vivo: docs/qa/goal-monitoreo-calidad-campo-2026-08-13.md
#
# Dos límites que este archivo no cruza:
#   - No nombra variables de ningún proyecto. El agente llega del rol declarado
#     en `operational_config$identity$agent_variable`, el mismo que usa
#     Validación — no se inventa uno propio ni se adivina la columna.
#   - No frena el campo. Avisar fuerte es su techo; parar es del coordinador.
# =============================================================================

#' Variable declarada como agente que recolecta
#'
#' Lee el rol de `operational_config`, que el analista declara una sola vez en
#' Validación y sirve para todo el proyecto. Devuelve `""` cuando el estudio no
#' lo declaró: sin esa declaración, ninguna señal de calidad de campo puede
#' existir sin hardcodear un nombre de columna.
#'
#' No confundir con el roster de encuestadores del perfil territorial
#' (`monitoreo_territorial_enumerator_roster_from_excel()`, códigos PXXX): ese
#' dice **quién debería trabajar** y este **quién trabajó**. Son preguntas
#' distintas y ambas se conservan.
#'
#' @param sid sesión.
#' @param base_nombre base del estudio; por defecto la activa.
#' @return nombre de la variable, o `""`.
#' @family monitoreo
#' @export
monitoreo_agente_declarado <- function(sid, base_nombre = NULL) {
  s <- tryCatch(session_get(sid), error = function(e) NULL)
  if (is.null(s)) return("")
  base <- base_nombre %||% tryCatch(codif_source_active(sid), error = function(e) NULL)
  cfg <- NULL
  if (!is.null(base) && nzchar(base)) {
    cfg <- ((s$estudio %||% list())$bases %||% list())[[base]]$validacion$operational_config
  }
  # Legacy sin estudio: la config vive suelta en la sesión.
  cfg <- cfg %||% s$validacion$operational_config %||% NULL
  if (is.null(cfg)) return("")
  cfg <- tryCatch(normalize_validation_operational_config(cfg), error = function(e) NULL)
  if (is.null(cfg)) return("")
  as.character((cfg$identity %||% list())$agent_variable %||% "")[1]
}

# Cuántos casos con una versión no vigente bastan para nombrar a un agente. Uno
# solo puede ser un envío rezagado que ya se corrigió; dos o más indican que
# siguió trabajando sin actualizar.
.MONITOREO_PROCEDENCIA_MINIMO <- 2L

.mcc_chr <- function(x) {
  v <- trimws(as.character(x))
  v[is.na(v)] <- ""
  v
}

#' Alertar qué agentes están enviando con una versión vieja del formulario
#'
#' Es la única señal de este GOAL que produce datos **irrecuperables**: una
#' encuesta hecha con el formulario anterior no se arregla después. Por eso sale
#' con severidad alta y con nombre — el resto de las señales informan.
#'
#' Devuelve una alerta por agente, con la forma que ya usa el motor
#' (`severidad`, `componente_id`, `actor`, `tipo`, `mensaje`) más los datos que
#' la vuelven accionable: cuántos casos, desde cuándo y qué preguntar.
#'
#' @param data data.frame de la base recolectada.
#' @param agent_var variable declarada como agente (ver
#'   `monitoreo_agente_declarado()`). Sin ella no hay alerta: la versión vieja
#'   se sabría, pero no a quién llamar.
#' @param fecha_var columna con la marca temporal del envío, para decir desde
#'   cuándo. Opcional.
#' @param minimo cuántos casos hacen falta para nombrar a un agente.
#' @return lista de alertas; vacía si no hay nada que avisar.
#' @family monitoreo
#' @export
monitoreo_alertas_procedencia <- function(data, agent_var = "",
                                          fecha_var = "",
                                          minimo = .MONITOREO_PROCEDENCIA_MINIMO) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  agent_var <- as.character(agent_var %||% "")[1]
  if (is.na(agent_var) || !nzchar(agent_var) || !(agent_var %in% names(data))) return(list())

  det <- tryCatch(detectar_versiones_formulario(data), error = function(e) NULL)
  if (is.null(det)) return(list())

  ver <- .mcc_chr(data[[det$columna]])
  agente <- .mcc_chr(data[[agent_var]])
  desactualizado <- nzchar(ver) & ver != det$vigente & nzchar(agente)
  if (!any(desactualizado)) return(list())

  fecha_var <- as.character(fecha_var %||% "")[1]
  tiene_fecha <- !is.na(fecha_var) && nzchar(fecha_var) && fecha_var %in% names(data)

  out <- list()
  for (a in unique(agente[desactualizado])) {
    idx <- which(desactualizado & agente == a)
    if (length(idx) < minimo) next
    n_total_agente <- sum(agente == a)
    desde <- if (tiene_fecha) {
      f <- .mcc_chr(data[[fecha_var]][idx])
      f <- f[nzchar(f)]
      if (length(f)) min(f) else ""
    } else ""

    mensaje <- sprintf(
      "%s envió %d de sus %d encuestas con una versión anterior del formulario%s. Sus saltos y catálogos son los de esa versión, y eso no se corrige después: conviene confirmar hoy que ya actualizó.",
      a, length(idx), n_total_agente,
      if (nzchar(desde)) sprintf(", desde %s", substr(desde, 1, 16)) else ""
    )
    out[[length(out) + 1L]] <- list(
      severidad = "bloqueante",
      componente_id = NA_character_,
      actor = a,
      tipo = "formulario_desactualizado",
      mensaje = mensaje,
      # Lo que vuelve accionable la alerta: a quién llamar y qué preguntarle.
      detalle = list(
        agente = a,
        n_casos = length(idx),
        n_casos_agente = as.integer(n_total_agente),
        version_usada = unique(ver[idx]),
        version_vigente = det$vigente,
        desde = desde,
        pregunta = sprintf(
          "¿%s ya actualizó el formulario en su equipo? Si sigue con el anterior, cada encuesta nueva se pierde igual.", a
        )
      )
    )
  }
  # Primero quien más casos arrastra: es a quien hay que llamar antes.
  out[order(-vapply(out, function(x) x$detalle$n_casos, numeric(1)))]
}
