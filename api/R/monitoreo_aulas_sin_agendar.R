# =============================================================================
# monitoreo_aulas_sin_agendar.R — a qué clase se puede entrar sin cita
# =============================================================================
#
# Gonzalo, 2026-09-21: «el despliegue de las semanas [debe incluir] al lado una
# tabla con los cursos-horario no agendados que se podrían ir a aplicar, pero
# deben estar ordenados por fecha y por día (repetirse si toman más de un día)
# para que los aplicadores tengan la opción de aplicar a esa sin agendar de ser
# posible; sólo tendrían que tener bien clara la hora de inicio y fin de la
# clase y el aula donde se dan».
#
# El operativo tiene dos velocidades. La cita pactada es la que manda y la que
# reparte el motor. Pero un aplicador que termina a las 10:00 y no tiene nada
# hasta las 15:00 no puede hacer nada con esas cinco horas, y al lado hay 108
# cursos-horario del plan que NO están agendados y cuya clase se dicta igual:
# el catálogo dice qué día, a qué hora y en qué aula. Ir a pedir permiso en
# la puerta es una aplicación más, y hoy esa información no llegaba a nadie.
#
# **La unidad de esta tabla es (curso-horario, DÍA), no el curso-horario.** Un
# curso que se dicta «MAR y JUE 08:00-10:00» son dos oportunidades distintas en
# la semana y se repite, porque quien la lee está mirando un día concreto: una
# fila por curso obligaría a cada aplicador a releer la cadena de días y
# decidir si le toca, que es exactamente el trabajo que la tabla viene a
# quitar.
#
# **Lo que NO se ofrece**, con el mismo vocabulario que el resto del perfil:
# las retiradas, las que el docente ya rechazó (`sample_status`) y las que ya
# se aplicaron de hecho. Ofrecer un aula rechazada es mandar a alguien a que le
# digan que no por segunda vez.
#
# La que no tiene sesiones legibles NO se descarta en silencio: viaja en
# `sin_horario` con su motivo, porque es una fila del plan a la que le falta el
# dato y alguien tiene que poder ir a buscarlo.
# =============================================================================

# Los campos que describen la clase, con sus alias. `venue` es el aula legible
# («E309»); `classroom_id` es el identificador interno del marco («1fin06_0722»)
# y NO sirve para pararse en una puerta.
#
# **El aula de un día NO se puede deducir cuando hay varias, y no se inventa.**
# El catálogo entrega los días y las aulas en dos campos construidos por
# funciones distintas: el horario lo agrupa `.cm_aulas_agrupar_horario()`, que
# REORDENA los días a orden de calendario, y el aula la une
# `.cm_aulas_sesiones_unir()`, que respeta el orden de entrada y DEDUPLICA.
# Emparejar «el día i con el aula i» sería apoyarse en una coincidencia que el
# código no promete.
#
# Medido sobre los 108 sin cita de CCSS Perfil 2026-II: de los 29 que se dictan
# dos días, 23 traen UNA sola aula —el dedupe colapsó dos iguales, y esa es la
# respuesta correcta para los dos días— y sólo 6 traen dos. Así que la regla
# honesta cubre casi todo: **una aula, esa aula; varias, se enseñan todas y se
# dice que hay que confirmar cuál toca ese día.**
.masa_texto <- function(fila, campos) {
  for (campo in campos) {
    v <- trimws(.monitoreo_scalar(fila[[campo]], ""))
    if (nzchar(v) && !is.na(v)) return(v)
  }
  ""
}

# ¿Esta fila del plan se puede ofrecer? Mismo vocabulario que `dos_tasas` y
# `ventanas`: si allí no cuenta, aquí no se ofrece.
#
# **Sólo TITULARES.** Gonzalo, 2026-09-21: «ojo, son las titulares no agendadas
# por agendar, no todas; o sea no reemplazos ni extras». Un reemplazo existe
# para ocupar el sitio de un titular que cayó, y una extra para cuando la
# cadena se agota: ofrecerlos como «entra si puedes» los activaría por la
# puerta de atrás, sin que nadie decidiera que el titular ya no va. En CCSS
# Perfil 2026-II eso son 84 `chain_reserve` y 1 `extra_reserve_pool` de los 108
# sin cita — la tabla pasa de 108 candidatos a los 23 que de verdad están «por
# agendar».
.masa_ofrecible <- function(fila) {
  if (!identical(tolower(trimws(.monitoreo_scalar(fila[["sample_role"]], ""))), "titular")) {
    return(FALSE)
  }
  if (nzchar(trimws(.monitoreo_scalar(fila[["scheduled_date"]], "")))) return(FALSE)
  estado <- .monitoreo_scalar(fila[["operational_status"]], "")
  if (identical(.madt_balde(estado), "retirada")) return(FALSE)
  if (identical(.madt_balde(estado), "contrastada")) return(FALSE)
  if (.madt_rechazada(fila)) return(FALSE)
  if (.madt_aplicada_de_hecho(fila)) return(FALSE)
  TRUE
}

#' La ventana que el despliegue está enseñando.
#'
#' No es la misma que `.madm_ventana_del_reparto()`, que devuelve el rango
#' DECLARADO y vacío cuando no hay ninguno. Para las agendadas sin cita eso es
#' correcto —sin rango no hay tanda de la que faltar—, pero esta tabla se lee al
#' lado de unos días concretos: sin rango declarado el reparto enseña TODO su
#' horizonte, y la tabla tiene que cubrir esos mismos días o llega vacía justo
#' cuando el usuario no ha filtrado nada. Medido el 2026-09-21: el bloque
#' viajaba con `total = 0` sobre un plan con 23 titulares por agendar.
#'
#' @param rep un reparto (`monitoreo_aulas_reparto()`).
#' @return lista `{desde, hasta}` en ISO; puntas vacías si no hay ni rango ni
#'   días fechados.
#' @keywords internal
.masa_ventana_visible <- function(rep) {
  r <- if (is.list(rep)) (rep[["rango"]] %||% list()) else list()
  desde <- .monitoreo_scalar(r[["desde"]], "")
  hasta <- .monitoreo_scalar(r[["hasta"]], "")
  if (nzchar(desde) && nzchar(hasta)) return(list(desde = desde, hasta = hasta))
  fechas <- vapply((if (is.list(rep)) rep[["dias"]] else NULL) %||% list(),
                   function(d) .monitoreo_scalar(d[["fecha"]], ""), character(1))
  fechas <- fechas[grepl("^\\d{4}-\\d{2}-\\d{2}$", fechas)]
  if (!length(fechas)) return(list(desde = "", hasta = ""))
  list(desde = min(fechas), hasta = max(fechas))
}

#' Los cursos-horario sin cita, repartidos por el día en que se dictan.
#'
#' Una fila por (curso-horario, día de sesión) dentro del rango: el que se
#' dicta dos días sale dos veces, que es lo que pide quien está mirando UN día.
#'
#' El orden es fecha → hora de inicio → código, y es total: dos corridas sobre
#' el mismo plan dan el mismo documento.
#'
#' @param plan filas del plan (lista o data.frame).
#' @param desde,hasta rango ISO inclusive. Sin rango legible no hay tabla: una
#'   clase semanal sólo se vuelve una oportunidad cuando se le pone una fecha.
#' @return lista `{dias, total, sin_horario}`. `dias` es una lista de
#'   `{fecha, dia, cursos}`; cada curso trae `codigo`, `curso`, `docente`,
#'   `inicio`, `fin`, `modalidad`, `elegibles` y el aula: `aula` con el nombre
#'   cuando es una sola, o `aula` vacía con `aulas` y `aula_incierta = TRUE`
#'   cuando el catálogo trae varias y no se puede decir cuál toca ese día.
#'   `sin_horario` son las sin cita cuyo horario no se puede leer, declaradas
#'   con su motivo.
#' @export
monitoreo_aulas_sin_agendar_por_dia <- function(plan = list(), desde = "", hasta = "") {
  d1 <- trimws(.monitoreo_scalar(desde, ""))
  d2 <- trimws(.monitoreo_scalar(hasta, ""))
  vacio <- list(dias = list(), total = 0L, sin_horario = list())
  if (!grepl("^\\d{4}-\\d{2}-\\d{2}$", d1) || !grepl("^\\d{4}-\\d{2}-\\d{2}$", d2)) return(vacio)
  if (d2 < d1) { tmp <- d1; d1 <- d2; d2 <- tmp }
  f1 <- suppressWarnings(as.Date(d1)); f2 <- suppressWarnings(as.Date(d2))
  if (is.na(f1) || is.na(f2)) return(vacio)
  # Un rango absurdo no se recorta en silencio: se acota a lo que cabe en una
  # tabla que alguien va a leer de un vistazo.
  if (as.integer(f2 - f1) > 62L) f2 <- f1 + 62L

  filas <- .madt_filas(plan)
  sin_horario <- list()
  # fecha -> lista de cursos
  por_fecha <- list()
  for (fila in filas) {
    if (!.masa_ofrecible(fila)) next
    codigo <- .masa_texto(fila, c("operational_code", "classroom_id"))
    if (!nzchar(codigo)) next
    sesiones <- .mav_sesiones(.monitoreo_scalar(fila[["sesiones_dia_hora"]], ""))
    if (!length(sesiones)) {
      sin_horario[[length(sin_horario) + 1L]] <- list(
        codigo = codigo,
        curso = .masa_texto(fila, c("course_name", "label")),
        motivo = "El catálogo no dice qué día ni a qué hora se dicta."
      )
      next
    }
    # El AULA legible, nunca el id del marco. Ver la nota de arriba.
    aulas <- trimws(unlist(strsplit(
      .masa_texto(fila, c("venue", "scheduled_venue", "actual_room", "aula_utilizada")),
      "<br[[:space:]]*/?>|·", perl = TRUE)))
    aulas <- aulas[nzchar(aulas)]
    base <- list(
      codigo = codigo,
      curso = .masa_texto(fila, c("course_name", "label")),
      docente = .masa_texto(fila, c("teacher")),
      modalidad = .masa_texto(fila, c("modality")),
      elegibles = .monitoreo_num(fila[["eligible_n"]], NA_real_),
      # `aula` sólo se llena cuando NO hay duda; con varias va vacía y manda
      # `aulas`, para que ninguna vista pueda pintar una de las dos como si
      # fuera la del día.
      aula = if (length(aulas) == 1L) aulas[[1L]] else "",
      aulas = as.list(aulas),
      aula_incierta = length(aulas) > 1L
    )
    for (f in seq.int(0L, as.integer(f2 - f1))) {
      fecha <- f1 + f
      iso <- format(fecha, "%Y-%m-%d")
      token <- .mav_dia_token(iso)
      for (s in sesiones) {
        if (!(token %in% s$dias)) next
        por_fecha[[iso]] <- c(por_fecha[[iso]], list(c(base, list(
          inicio = .mav_hhmm(s$ini), fin = .mav_hhmm(s$fin),
          .orden_ini = s$ini
        ))))
      }
    }
  }

  # `sort(character(0), method = "radix")` LANZA; un plan sin nada que ofrecer
  # es un caso normal, no un error.
  fechas <- if (length(por_fecha)) sort(names(por_fecha), method = "radix") else character(0)
  dias <- list()
  total <- 0L
  for (iso in fechas) {
    cursos <- por_fecha[[iso]]
    orden <- order(
      vapply(cursos, function(c) as.numeric(c[[".orden_ini"]]), numeric(1)),
      vapply(cursos, function(c) as.character(c[["codigo"]]), character(1)),
      method = "radix"
    )
    cursos <- lapply(cursos[orden], function(c) { c[[".orden_ini"]] <- NULL; c })
    total <- total + length(cursos)
    dias[[length(dias) + 1L]] <- list(fecha = iso, dia = .mav_dia_token(iso), cursos = cursos)
  }
  if (length(sin_horario) > 1L) {
    sin_horario <- sin_horario[order(
      vapply(sin_horario, function(x) x$codigo, character(1)), method = "radix")]
  }
  list(dias = dias, total = total, sin_horario = sin_horario)
}
