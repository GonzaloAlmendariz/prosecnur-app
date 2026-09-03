# monitoreo_aulas_cache.R — cache del dashboard de cursos-horario.
#
# **Aulas era la unica familia de Monitoreo que reconstruia su dashboard en
# CADA request de state.** En el mismo punto del router, territorial pasa por
# `.monitoreo_territorial_map_cache_meta`, acreditacion y telefonico por
# `.monitoreo_acreditacion_repair_cached_dashboard`, y aulas llamaba a
# `monitoreo_aulas_dashboard()` a pelo — fuera del `if (should_build_dashboard)`
# que gobierna la cache del tablero, asi que se reconstruia **incluso cuando el
# dashboard general venia de cache**.
#
# Medido el 2026-08-24 sobre el estudio de 2.616 cursos-horario:
#
#   df -> lista (2.616)   0,9 s
#   normalize_plan        2,1 s
#   dashboard             3,6 s
#   ----------------------------
#   por request           6,6 s
#
# y una apertura de proyecto dispara **6 requests de state** —`include_reports=0`
# dos veces, y los scopes `source`, `advance_summary`, `queries_summary` y
# `validation_summary`—, o sea **~40 s** de los 48 que el backend pasa al 100 %
# de CPU con Plumber bloqueado en un solo hilo. Ese es el «Preparando proyecto
# 86 %» que se queda clavado.
#
# Este archivo existe aparte porque `router_monitoreo.R` esta congelado a
# crecimiento: el router llama con una linea. Mismo motivo y mismo patron que
# `monitoreo_territorial_cache.R` y `monitoreo_acreditacion_cache.R`.
#
# **Cache en memoria del proceso, no en la sesion.** El caso que duele son seis
# requests seguidos en pocos segundos, y para eso no hace falta persistir nada:
# persistirlo obligaria a censar claves nuevas en `session_schema.R` y
# engordaria el `.pulso` con un derivado recalculable. Una entrada por `sid`,
# reemplazada en cuanto cambia el token.

.mac_dashboard_env <- new.env(parent = emptyenv())

# --- B29: disponibilidad de aplicadores en el conversar del dashboard ---------
#
# Patrón DAA (monitoreo_aulas_publicar_libro.R:599): quien carga la
# disponibilidad hace `session_set(sid, "monitoreo_aulas_disponibilidad", x)`
# con la salida de `carga_disponibilidad_aplicadores()`. Este archivo es el
# único punto con `sid` y dashboard a la vez (`router_monitoreo.R` está
# congelado a crecimiento), así que el mount vive aquí: CON la clave el payload
# publica `disponibilidad` (bloque de la vista) y su gemelo `reparto`
# (recomputado con el plan vigente en cada construcción — «que pueda ir
# actualizándose con el paso de los días»); SIN la clave, ambos ausentes sin
# error.

# La disponibilidad vigente de la sesión. `[[` y no `$` (el `$`
# parcial-matchea), y `required = FALSE`: un sid que no es sesión real (la
# suite de cache usa "s1"/"s2") simplemente no tiene disponibilidad.
.mac_disponibilidad_sesion <- function(sid) {
  if (!nzchar(sid)) return(NULL)
  s <- session_get(sid, required = FALSE)
  if (!is.list(s)) return(NULL)
  disp <- s[["monitoreo_aulas_disponibilidad"]]
  if (is.list(disp) && length(disp)) disp else NULL
}

# La marca de contenido de la disponibilidad para el token de frescura. A
# diferencia del libro, esta clave no lleva sello de importación, así que la
# marca ES el contenido (nombres, días y bloques): editarla invalida aunque el
# tamaño no cambie — la misma lección que los partes y el control.
.mac_disponibilidad_marca <- function(disponibilidad) {
  if (!is.list(disponibilidad) || !length(disponibilidad)) return("0")
  partes <- vapply(disponibilidad, function(a) {
    if (!is.list(a)) return("")
    dias <- a[["dias"]]
    dias <- if (is.list(dias)) dias else list()
    claves <- names(dias) %||% character(0)
    cuerpo <- vapply(claves, function(d) {
      bloques <- dias[[d]]
      if (!is.list(bloques) || !length(bloques)) return(d)
      paste0(d, "=", paste(vapply(bloques, function(b) {
        paste0(as.character(b[["inicio"]] %||% ""), "-",
               as.character(b[["fin"]] %||% ""))
      }, character(1)), collapse = ","))
    }, character(1))
    paste0(as.character(a[["nombre"]] %||% ""), ":",
           paste(cuerpo, collapse = ";"))
  }, character(1))
  paste0(length(disponibilidad), "~", paste(partes, collapse = "&"))
}

# La marca de contenido de las fijaciones (B36) para el token: código→
# aplicador, claves ordenadas. Fijar o soltar UNA cita invalida aunque el
# conteo no cambie — la misma lección A15 que la disponibilidad.
.mac_fijadas_marca <- function(fijadas) {
  if (!is.list(fijadas) || !length(fijadas)) return("0")
  claves <- sort(names(fijadas) %||% character(0), method = "radix")
  claves <- claves[nzchar(claves)]
  if (!length(claves)) return("0")
  paste0(length(claves), "~", paste(vapply(claves, function(k) {
    paste0(k, "=", as.character(fijadas[[k]] %||% "")[1])
  }, character(1)), collapse = "&"))
}

# Publica los dos bloques B29 sobre el dashboard ya construido. Sin
# disponibilidad no toca nada: ausencia declarada, no un bloque vacío.
.mac_publicar_disponibilidad <- function(dashboard, plan, disponibilidad,
                                         fijadas = list(),
                                         duracion_min = NULL,
                                         rango = NULL) {
  if (is.null(disponibilidad) || !is.list(dashboard)) return(dashboard)
  dashboard[["disponibilidad"]] <- monitoreo_aulas_disponibilidad_bloque(disponibilidad)
  # B70/B75: el reparto respeta la duración y el rango del config; sin
  # declarar caen al default del motor (30, todo el horizonte).
  dashboard[["reparto"]] <- if (is.null(duracion_min)) {
    monitoreo_aulas_reparto(plan, disponibilidad, fijadas, rango = rango)
  } else {
    monitoreo_aulas_reparto(plan, disponibilidad, fijadas,
                            duracion_min = duracion_min, rango = rango)
  }
  dashboard
}

#' El token de frescura del dashboard de aulas.
#'
#' Parte del token general del tablero —que ya cubre data, `synced_at` y la
#' particion del config que afecta a los reportes— y le suma **lo que el router
#' anade a `aulas_cfg` DESPUES de calcularlo**: el plan, el control del libro,
#' el recibo de la importacion y los partes de campo. Sin esa parte, importar un
#' libro no invalidaria la cache y la pantalla seguiria enseñando el estado
#' anterior, que es peor que ir lento.
#'
#' @param base token del tablero (`.monitoreo_dashboard_cache_token`).
#' @param plan filas del plan de aulas.
#' @param cfg config de aulas ya enriquecida.
#' @param scope el `report_scope` del request.
#' @param disponibilidad la disponibilidad de aplicadores vigente (B29), si el
#'   llamador la tiene a mano. El router congelado no la pasa: para él la
#'   completa `monitoreo_aulas_dashboard_cached`, el único punto sid-aware,
#'   con este mismo componente.
#' @return cadena.
#' @export
monitoreo_aulas_cache_token <- function(base, plan, cfg, scope = "full",
                                        disponibilidad = NULL) {
  largo <- function(x) if (is.data.frame(x)) nrow(x) else if (is.list(x)) length(x) else 0L
  # Los partes y el control se comparan por tamaño Y por su marca de lectura: el
  # numero de filas solo no distingue una correccion a mano en el Excel, que es
  # justo el caso que el operativo tiene declarado como posible.
  paste(
    as.character(base %||% ""),
    as.character(scope %||% "full"),
    largo(plan),
    largo(cfg$control),
    largo(cfg$partes_campo),
    # `importado_en` es el nombre que sella el importador (carga_aulas_libro.R);
    # la linea leia `leido_en`/`imported_at`, que NADIE escribe, y la marca
    # entraba siempre vacia: corregir una celda a mano y reimportar con los
    # mismos conteos servia el tablero anterior (A15, 2026-09-01).
    as.character((cfg$libro$importado_en %||% "")[1]),
    as.character((cfg$agenda_actualizada_en %||% "")[1]),
    # B29 (decisión del lead): cambiar la disponibilidad de aplicadores
    # invalida el dashboard — su reparto viaja dentro del payload cacheado.
    .mac_disponibilidad_marca(disponibilidad),
    # B36: las fijaciones del reparto viven en el config de aulas y su
    # reparto viaja en el payload — fijar o soltar invalida.
    .mac_fijadas_marca(if (is.list(cfg)) cfg[["reparto_fijado"]] else NULL),
    # B70: la duración de la aplicación reescribe ventanas, franjas y
    # reparto — mover el slider invalida el dashboard cacheado (lección A15:
    # una clave de config que afecta al payload y no marca el token sirve el
    # tablero anterior).
    as.character((if (is.list(cfg)) cfg[["duracion_aplicacion_min"]] else NULL) %||% ""),
    # B75: el rango de despliegue re-particiona el reparto — declararlo o
    # moverlo invalida (misma lección A15 que la duración).
    paste(
      as.character((if (is.list(cfg)) cfg[["reparto_rango"]][["desde"]] else NULL) %||% ""),
      as.character((if (is.list(cfg)) cfg[["reparto_rango"]][["hasta"]] else NULL) %||% ""),
      sep = ".."
    ),
    sep = "|"
  )
}

#' El dashboard de aulas, reusando el de esta sesion si nada cambio.
#'
#' @param sid id de sesion; con `""` no se cachea (no hay a quien atribuirlo).
#' @param plan filas del plan.
#' @param data respuestas.
#' @param cfg config de aulas.
#' @param token lo que devuelve `monitoreo_aulas_cache_token()`.
#' @return lista con `dashboard` y `hit`.
#' @export
monitoreo_aulas_dashboard_cached <- function(sid, plan, data, cfg, token) {
  sid <- as.character(sid %||% "")[1]
  token <- as.character(token %||% "")[1]
  disponibilidad <- .mac_disponibilidad_sesion(sid)
  # B29 + decisión del lead sobre el hueco de cache: el router (congelado)
  # deriva el token sin ver la sesión, y la disponibilidad vive SOLO en la
  # sesión. Este es el único punto sid-aware, así que aquí se completa el
  # token con el mismo componente que `monitoreo_aulas_cache_token` declara:
  # cambiar la disponibilidad invalida la cache del dashboard.
  if (nzchar(token) && !is.null(disponibilidad)) {
    token <- paste(token, .mac_disponibilidad_marca(disponibilidad), sep = "|")
  }
  construir <- function() {
    .mac_publicar_disponibilidad(
      monitoreo_aulas_dashboard(plan, data, cfg), plan, disponibilidad,
      fijadas = (if (is.list(cfg)) cfg[["reparto_fijado"]] else NULL) %||% list(),
      duracion_min = if (is.list(cfg)) cfg[["duracion_aplicacion_min"]] else NULL,
      rango = if (is.list(cfg)) cfg[["reparto_rango"]] else NULL
    )
  }
  if (!nzchar(sid) || !nzchar(token)) {
    return(list(dashboard = construir(), hit = FALSE))
  }
  guardado <- if (exists(sid, envir = .mac_dashboard_env, inherits = FALSE)) {
    get(sid, envir = .mac_dashboard_env, inherits = FALSE)
  } else NULL
  if (is.list(guardado) && identical(guardado$token, token) && is.list(guardado$dashboard)) {
    return(list(dashboard = guardado$dashboard, hit = TRUE))
  }
  dashboard <- construir()
  # UNA entrada por sesion: la anterior se reemplaza. Guardar por token dejaria
  # el environment creciendo con cada sync de un operativo largo.
  assign(sid, list(token = token, dashboard = dashboard), envir = .mac_dashboard_env)
  list(dashboard = dashboard, hit = FALSE)
}

#' Olvida el dashboard cacheado de una sesion.
#'
#' Lo llama la invalidacion general de caches de Monitoreo. Sin esto, un
#' `.pulso` recien abierto sobre un `sid` reusado leeria el dashboard del
#' proyecto anterior — que es el peor fallo posible de una cache y el mas dificil
#' de ver, porque las cifras son plausibles.
#'
#' @param sid id de sesion. Vacio o `NULL` limpia todo.
#' @return `invisible(NULL)`.
#' @export
monitoreo_aulas_cache_invalidate <- function(sid = "") {
  sid <- as.character(sid %||% "")[1]
  if (!nzchar(sid)) {
    rm(list = ls(envir = .mac_dashboard_env, all.names = TRUE), envir = .mac_dashboard_env)
    return(invisible(NULL))
  }
  if (exists(sid, envir = .mac_dashboard_env, inherits = FALSE)) {
    rm(list = sid, envir = .mac_dashboard_env)
  }
  invisible(NULL)
}
