# =============================================================================
# graficos_paleta_resolver.R — qué paleta le toca a una lista de opciones (ADR 0097)
# =============================================================================
#
# Un único resolvedor para PPT, miniaturas, Word y consolidado. La paleta de una lista sale, en este orden, de:
#
# (a) su nombre: `paleta_<lista>` en el entorno de paletas, con el singular o plural en s/es (como hacía
#     `.paleta_auto`);
# (b) un vínculo explícito `config.paletas_vinculos[lista] = clave` (sólo decisiones; ausente = sin vínculo);
# (c) su firma: una paleta cuyas etiquetas, sin caja, tildes ni espacios repetidos, son el mismo conjunto que las
#     opciones de la lista (la `acuerdo_4` de un perfil o de otro proyecto sirve a `lst_p14`).
#
# El resolvedor también dice de quién es la paleta: una que es copia de la de un perfil de estilo (`mergePaletas` del
# editor la funde tal cual en `config.paletas`) es «perfil»; cualquier otra, «usuario». Barras y tortas sólo dejan de
# ser monocromas con una paleta del usuario (P2a): el campo `espec$colores` se llena sólo entonces.

.PALETA_ATTRS <- c("paleta_lista", "paleta_origen", "paleta_clave", "paleta_usuario", "paleta_choices")

#' Etiqueta comparable: sin caja, sin tildes y con los espacios colapsados
#' @keywords internal
.paleta_norm_etiqueta <- function(x) {
  x <- as.character(x %||% character(0)); x[is.na(x)] <- ""
  gsub("\\s+", " ", trimws(tolower(.box_norm_etiqueta(x))))
}

#' Gris residual del recetario (`categorias$residual`): el color de una opción que la paleta no nombra (P3a)
#' @keywords internal
.paleta_gris_residual <- function() as.character(.std_paleta("categorias")$residual)

#' Nombres candidatos de una lista: el propio y su singular/plural en s/es
#' @keywords internal
.paleta_candidatos_nombre <- function(ln) {
  ln <- trimws(as.character(ln %||% "")[1])
  if (is.na(ln) || !nzchar(ln)) return(character(0))
  out <- ln
  if (grepl("s$", ln)) out <- c(out, sub("s$", "", ln))
  if (grepl("es$", ln)) out <- c(out, sub("es$", "", ln))
  out <- c(out, paste0(ln, "s"), paste0(ln, "es"))
  unique(out[nzchar(out)])
}

#' La paleta `paleta_<clave>` del entorno si es un vector con nombres; si no, `NULL`
#' @keywords internal
.paleta_obtener <- function(clave, env) {
  clave <- trimws(as.character(clave %||% "")[1])
  if (is.na(clave) || !nzchar(clave)) return(NULL)
  obj <- paste0("paleta_", clave)
  if (!exists(obj, envir = env, inherits = TRUE)) return(NULL)
  pal <- get(obj, envir = env, inherits = TRUE)
  if (!is.atomic(pal) || is.null(names(pal)) || !length(pal)) return(NULL)
  pal
}

#' ¿La paleta de `clave` es del usuario? `FALSE` sólo si el entorno la marca como copia de un perfil
#' @keywords internal
.paleta_clave_es_de_usuario <- function(clave, env) {
  origen <- get0(".paletas_origen", envir = env, inherits = TRUE, ifnotfound = NULL)
  if (is.null(origen) || is.null(clave) || !clave %in% names(origen)) return(TRUE)
  !identical(unname(origen[[clave]]), "perfil")
}

#' Paleta de una lista de opciones: por nombre, por vínculo o por firma
#'
#' @param list_name Nombre de la lista del instrumento.
#' @param opciones Etiquetas de las opciones de la lista (para la firma y para saber cuáles no tienen color).
#' @param env Entorno de paletas (`.graficos_palette_env()`): objetos `paleta_<clave>`, `.paletas_vinculos` y
#'   `.paletas_origen`.
#' @return `list(colores, origen, desconocidas, clave, usuario)`: `colores` es el vector `c(rotulo = hex)` o `NULL`,
#'   `origen` es `"nombre"`, `"vinculo"`, `"firma"` o `NULL`, y `desconocidas` las opciones que la paleta no nombra.
#' @keywords internal
.paleta_resolver <- function(list_name, opciones = NULL, env = parent.frame()) {
  vacio <- list(colores = NULL, origen = NULL, desconocidas = character(0), clave = NULL, usuario = FALSE)
  if (!is.environment(env)) return(vacio)
  ln <- trimws(as.character(list_name %||% "")[1]); if (is.na(ln)) ln <- ""
  opciones <- as.character(opciones %||% character(0))
  opciones <- unique(trimws(opciones[!is.na(opciones) & nzchar(trimws(opciones))]))
  hit <- NULL
  for (cand in .paleta_candidatos_nombre(ln)) {
    pal <- .paleta_obtener(cand, env)
    if (!is.null(pal)) { hit <- list(pal = pal, origen = "nombre", clave = cand); break }
  }
  if (is.null(hit) && nzchar(ln)) {
    vinc <- get0(".paletas_vinculos", envir = env, inherits = TRUE, ifnotfound = NULL)
    clave <- if (is.list(vinc) || is.character(vinc)) as.character(vinc[[ln]] %||% "")[1] else ""
    pal <- .paleta_obtener(clave, env)
    if (!is.null(pal)) hit <- list(pal = pal, origen = "vinculo", clave = clave)
  }
  if (is.null(hit) && length(opciones)) hit <- .paleta_por_firma(opciones, env)
  if (is.null(hit)) return(vacio)
  conocidas <- .paleta_norm_etiqueta(names(hit$pal))
  list(colores = hit$pal, origen = hit$origen, desconocidas = opciones[!.paleta_norm_etiqueta(opciones) %in% conocidas],
       clave = hit$clave, usuario = .paleta_clave_es_de_usuario(hit$clave, env))
}

#' La paleta del entorno cuyas etiquetas son el mismo conjunto que `opciones`; con varias, primero las del usuario
#' y luego por clave, para que el resultado no dependa del orden en que se guardaron
#' @keywords internal
.paleta_por_firma <- function(opciones, env) {
  firma <- unique(.paleta_norm_etiqueta(opciones)); firma <- firma[nzchar(firma)]
  if (!length(firma)) return(NULL)
  claves <- sort(sub("^paleta_", "", ls(env, pattern = "^paleta_", all.names = FALSE)))
  claves <- claves[order(!vapply(claves, .paleta_clave_es_de_usuario, logical(1), env = env))]
  for (clave in claves) {
    pal <- .paleta_obtener(clave, env)
    if (is.null(pal)) next
    et <- unique(.paleta_norm_etiqueta(names(pal))); et <- et[nzchar(et)]
    if (length(et) && setequal(et, firma)) return(list(pal = pal, origen = "firma", clave = clave))
  }
  NULL
}

#' Los colores que resuelve una lista, con su procedencia en atributos (`paleta_lista`, `paleta_origen`,
#' `paleta_clave`, `paleta_usuario`), o `NULL`
#'
#' Es lo que devuelve `.paleta_auto()` del motor: los graficadores reciben el vector tal cual y la espec nativa lee
#' los atributos para saber si la paleta es del usuario.
#' @keywords internal
.paleta_resolver_colores <- function(list_name, opciones = NULL, env = parent.frame()) {
  res <- .paleta_resolver(list_name, opciones, env)
  if (is.null(res$colores)) return(NULL)
  pal <- res$colores
  attr(pal, "paleta_lista") <- trimws(as.character(list_name %||% "")[1])
  attr(pal, "paleta_origen") <- res$origen
  attr(pal, "paleta_clave") <- res$clave
  attr(pal, "paleta_usuario") <- isTRUE(res$usuario)
  # Las choices de la lista (código y etiqueta): una espec rotulada con códigos casa igual con la paleta por etiqueta.
  ch <- attr(opciones, "choices", exact = TRUE)
  if (is.data.frame(ch) && nrow(ch)) attr(pal, "paleta_choices") <- ch
  pal
}

#' Copia los atributos de procedencia de `de` a `a` (los que el reparto por nivel crea de cero)
#' @keywords internal
.paleta_heredar_attrs <- function(a, de) {
  if (is.null(a) || is.null(de)) return(a)
  for (k in .PALETA_ATTRS) {
    v <- attr(de, k, exact = TRUE)
    if (!is.null(v)) attr(a, k) <- v
  }
  a
}

#' ¿El vector de colores es una paleta que el usuario definió para la lista?
#' @keywords internal
.paleta_es_de_usuario <- function(colores) isTRUE(attr(colores, "paleta_usuario", exact = TRUE))

#' ¿El vector de colores salió del resolvedor (cualquier procedencia)?
#' @keywords internal
.paleta_es_resuelta <- function(colores) !is.null(attr(colores, "paleta_origen", exact = TRUE))

#' Opciones (etiquetas) de una lista en los instrumentos del estudio, para la firma
#'
#' En multibase la misma lista puede traer opciones distintas en cada base: se unen, y una firma que no calza con la
#' unión no resuelve (antes que aplicar la de la primera base a todas).
#' @return Etiquetas únicas, con atributo `choices` (`list_name`, `name`, `label`) para mapear códigos.
#' @keywords internal
.paleta_opciones_de_lista <- function(list_name, inst_sources) {
  ln <- trimws(as.character(list_name %||% "")[1])
  if (is.na(ln) || !nzchar(ln) || !is.list(inst_sources)) return(character(0))
  fuentes <- if (!is.null(inst_sources$choices)) list(inst_sources) else inst_sources
  niveles <- do.call(rbind, lapply(fuentes, function(src) {
    .reporte_plan_choice_levels_for_list(ln, if (is.list(src)) src$choices else NULL)
  }))
  if (is.null(niveles) || !nrow(niveles)) return(character(0))
  out <- unique(niveles$label[!is.na(niveles$label) & nzchar(niveles$label)])
  niveles <- unique(niveles)
  attr(out, "choices") <- data.frame(list_name = ln, name = niveles$code, label = niveles$label, stringsAsFactors = FALSE)
  out
}

#' Colores por rótulo que la espec nativa lleva cuando la paleta es del usuario (`NULL` si no lo es)
#'
#' La opción que la paleta no nombra sale gris residual con su aviso (`.reporte_plan_palette_for_levels`).
#' @keywords internal
.paleta_colores_para <- function(rotulos, colores) {
  if (!.paleta_es_de_usuario(colores) || !length(rotulos)) return(NULL)
  rot <- as.character(rotulos)
  out <- .reporte_plan_palette_for_levels(attr(colores, "paleta_lista", exact = TRUE) %||% "", rot,
                                          choices_use = attr(colores, "paleta_choices", exact = TRUE), palette = colores)
  if (is.null(out) || !length(out)) return(NULL)
  stats::setNames(as.character(unname(out[rot])), rot)
}

#' La espec con `colores` (rótulo = hex) si la paleta es del usuario; si no, tal cual
#' @keywords internal
.espec_con_colores <- function(espec, colores, rotulos = espec$rotulos) {
  if (is.null(espec) || !is.list(espec)) return(espec)
  cols <- .paleta_colores_para(rotulos, colores)
  if (!is.null(cols)) espec$colores <- cols
  espec
}

#' Lo que devuelve un graficador, con la espec nativa coloreada si la paleta de su lista es del usuario
#' @keywords internal
.paleta_en_espec <- function(p, colores) {
  espec <- attr(p, "pulso_espec", exact = TRUE)
  if (is.null(espec) || is.null(espec$rotulos) || !.paleta_es_de_usuario(colores)) return(p)
  attr(p, "pulso_espec") <- .espec_con_colores(espec, colores)
  p
}

#' Color de cada rótulo en una espec, o `NULL` si la espec no trae `colores` (la lámina usa el recetario)
#' @keywords internal
.espec_colores_de <- function(espec, rotulos = espec$rotulos) {
  cols <- espec$colores
  if (is.null(cols) || !length(cols) || is.null(names(cols)) || !length(rotulos)) return(NULL)
  out <- unname(cols[as.character(rotulos)])
  out[is.na(out) | !nzchar(out)] <- .paleta_gris_residual()
  out
}

#' Likert del recetario para una escala sin paleta (P4a), también cuando sus pasos son sólo números
#'
#' `.graficos_paleta_likert()` es conservadora (cada paso nombra el eje); si no reconoce la escala, la rampa es la
#' misma del recetario, con el negativo primero salvo que la última opción sea el polo negativo, y lo especial gris.
#' @keywords internal
.paleta_likert_recetario <- function(levels) {
  levels <- as.character(levels)
  lk <- .graficos_paleta_likert(levels)
  if (!is.null(lk)) return(lk)
  n <- .paleta_norm_etiqueta(levels)
  especial <- grepl(.DIVERGENTES_ESPECIAL, levels, ignore.case = TRUE) | grepl(.PALETA_ESCALA_ESPECIAL_EXTRA, n)
  k <- sum(!especial); base <- unname(.std_paleta("likert"))
  rampa <- if (k == 4L) base[1:4] else if (k == 5L) unname(.std_paleta("likert_neutro"))[1:5] else
    grDevices::colorRampPalette(base[1:4])(max(k, 1L))[seq_len(k)]
  pasos <- n[!especial]
  if (k >= 2L && grepl(.PALETA_ESCALA_NEGATIVO, pasos[k]) && !grepl(.PALETA_ESCALA_NEGATIVO, pasos[1])) rampa <- rev(rampa)
  vals <- character(length(levels)); vals[!especial] <- rampa; vals[especial] <- base[5]
  stats::setNames(vals, levels)
}

#' Origen de cada paleta guardada: «perfil» si es copia de la de un perfil de estilo, «usuario» si no
#'
#' El editor funde la paleta del perfil en `config.paletas` (`mergePaletas`), así que en el backend sólo se reconoce
#' por contenido: la paleta de la lista `ln` es del perfil si un perfil define `ln` y cada color guardado es el del
#' perfil para esa etiqueta. Una etiqueta de más o un color cambiado la hacen del usuario.
#' @param paletas `config.paletas` normalizado (`list_name → {etiqueta: hex}`).
#' @return Vector con nombres `c(lista = "usuario" | "perfil")`.
#' @keywords internal
.paleta_origenes <- function(paletas) {
  if (!is.list(paletas) || !length(paletas) || is.null(names(paletas))) return(character(0))
  perfiles <- tryCatch(.ppt_style_profiles_payload()$style_profiles, error = function(e) list())
  de_perfil <- lapply(perfiles, function(p) tryCatch(.std_migrar_paletas(p$paletas %||% list())$paletas, error = function(e) p$paletas))
  hex <- function(x) toupper(trimws(as.character(unlist(x, use.names = FALSE))))
  es_copia <- function(ln, pal) {
    vals <- unlist(pal, use.names = TRUE)
    if (!length(vals) || is.null(names(vals))) return(FALSE)
    any(vapply(de_perfil, function(pp) {
      ref <- unlist(pp[[ln]] %||% list(), use.names = TRUE)
      if (!length(ref) || is.null(names(ref))) return(FALSE)
      idx <- match(.paleta_norm_etiqueta(names(vals)), .paleta_norm_etiqueta(names(ref)))
      !anyNA(idx) && identical(hex(vals), hex(ref[idx]))
    }, logical(1)))
  }
  nms <- names(paletas)
  stats::setNames(vapply(nms, function(ln) if (es_copia(ln, paletas[[ln]])) "perfil" else "usuario", character(1)), nms)
}

#' `config.paletas_vinculos` normalizado: `list_name → clave de paleta`, sólo pares no vacíos y sin auto-vínculos
#' @return Lista con nombres (vacía si no hay vínculos).
#' @keywords internal
.graficos_normalize_paletas_vinculos <- function(x) {
  if (is.null(x) || !length(x) || (!is.list(x) && !is.character(x))) return(list())
  nms <- names(x)
  if (is.null(nms)) return(list())
  out <- list()
  for (i in seq_along(x)) {
    ln <- trimws(as.character(nms[[i]] %||% "")[1])
    v <- x[[i]]
    clave <- if ((is.character(v) || is.list(v)) && length(v)) trimws(as.character(unlist(v))[1]) else ""
    if (is.na(ln) || is.na(clave) || !nzchar(ln) || !nzchar(clave) || identical(ln, clave)) next
    out[[ln]] <- clave
  }
  out
}
