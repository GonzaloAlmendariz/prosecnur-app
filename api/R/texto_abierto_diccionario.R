# Diccionario del proyecto por pregunta abierta (TXT-6 + TXT-7, plan-texto-abierto-ccss-2026-10-24, contrato congelado).
#
#   s$texto_abierto_diccionario[[base]][[variable]] = list(
#     equivalencias = list(list(mostrar = "estudiantes", formas = c("alumnos", "estudiantes"))),
#     excluir       = c("ciencias sociales"),
#     frases        = c("ciencias sociales")
#   )
#
# No hay sinónimos de fábrica: el diccionario lo arma el usuario desde la lista de palabras reconocidas. Es del
# proyecto (viaja en state.rds) y lo leen la nube, la sugerencia de módulo y las citas. Un override del plan gana.
#
# Semántica que aplican los motores:
#   - equivalencias: cada forma se lleva a su raíz (la de la nube limpia) y todas las raíces del grupo cuentan como la
#     de `mostrar`, que es la palabra que se dibuja. Una persona que usa dos formas del grupo cuenta una vez.
#   - frases: se unen aunque no lleguen a 3 personas y entran a la nube aunque no lleguen a `min_personas`. Como la
#     frase automática, no le quitan la persona a sus palabras.
#   - excluir: un término de una palabra sale de la nube, del ranking y del vocabulario de la sugerencia. Uno de varias
#     palabras sale con sus palabras: donde aparece «ciencias sociales», ni la frase ni «sociales» suelto cuentan. No sale
#     de las citas, que son textuales.
#
# Camino al render (worker callr incluido): `.txt_dic_adjuntar_fuentes()` cuelga el diccionario de cada base en su
# instrumento (`inst$texto_abierto_diccionario[[variable]]`) dentro de `.graficos_processing_sources()`. El instrumento
# ya viaja por RDS al worker y llega intacto a `ctx$instrumento` del motor, así que la firma del worker no cambia.

.TXT_DIC_CLAVE_SESION <- "texto_abierto_diccionario"

#' Término limpio: texto, sin espacios repetidos ni en los bordes
#' @keywords internal
.txt_dic_termino <- function(x) trimws(gsub("\\s+", " ", enc2utf8(as.character(x)), perl = TRUE))

#' Clave de comparación de un término: minúsculas y sin tildes
#' @keywords internal
.txt_dic_clave <- function(x) .txt_sin_tildes(tolower(.txt_dic_termino(x)))

#' Diccionario vacío
#' @keywords internal
.txt_dic_vacio <- function() list(equivalencias = list(), excluir = character(0), frases = character(0))

#' ¿El diccionario no dice nada?
#' @keywords internal
.txt_dic_es_vacio <- function(d) {
  is.null(d) || (!length(d$equivalencias) && !length(d$excluir) && !length(d$frases))
}

#' Vector de términos de un campo del JSON (lista o vector), validando que ninguno quede vacío
#' @keywords internal
.txt_dic_terminos <- function(x, campo) {
  if (is.null(x) || !length(x)) return(character(0))
  if (is.list(x) && !all(vapply(x, function(v) is.null(v) || (is.atomic(v) && length(v) <= 1L), logical(1)))) {
    stop_api(422, "E_TXT_DICCIONARIO_INVALIDO", sprintf("«%s» debe ser una lista de términos.", campo))
  }
  v <- vapply(x, function(t) if (is.null(t) || !length(t) || is.na(t)) "" else .txt_dic_termino(t), character(1), USE.NAMES = FALSE)
  if (any(!nzchar(v))) {
    stop_api(422, "E_TXT_DICCIONARIO_INVALIDO", sprintf("«%s» tiene un término vacío.", campo))
  }
  v[!duplicated(.txt_dic_clave(v))]
}

#' Diccionario validado y normalizado a la forma de almacenamiento
#'
#' Valida: términos no vacíos; cada grupo con `mostrar` y al menos dos formas de una palabra; `mostrar` entre sus
#' formas; ninguna forma repetida entre grupos (sin distinguir mayúsculas ni tildes).
#' @param raw lista con `equivalencias`, `excluir` y `frases` (del JSON del PUT o de la sesión).
#' @return lista de almacenamiento (`equivalencias` como lista de `list(mostrar, formas)`, el resto como character).
#' @keywords internal
.txt_dic_normalizar <- function(raw) {
  if (is.null(raw) || !length(raw)) return(.txt_dic_vacio())
  if (!is.list(raw)) stop_api(422, "E_TXT_DICCIONARIO_INVALIDO", "El diccionario debe ser un objeto con equivalencias, excluir y frases.")
  eq_raw <- raw$equivalencias %||% list()
  if (!is.list(eq_raw)) {
    stop_api(422, "E_TXT_DICCIONARIO_INVALIDO", "«equivalencias» debe ser una lista de grupos {mostrar, formas}.")
  }
  vistas <- character(0)
  equivalencias <- lapply(seq_along(eq_raw), function(i) {
    g <- eq_raw[[i]]
    if (!is.list(g) || is.null(g$formas)) {
      stop_api(422, "E_TXT_DICCIONARIO_INVALIDO", sprintf("El grupo %d de «equivalencias» debe traer «mostrar» y «formas».", i))
    }
    formas <- .txt_dic_terminos(g$formas, "formas")
    mostrar <- .txt_dic_termino(unlist(g$mostrar %||% "")[1] %||% "")
    if (is.na(mostrar) || !nzchar(mostrar)) {
      stop_api(422, "E_TXT_DICCIONARIO_INVALIDO", sprintf("El grupo %d de «equivalencias» no dice qué palabra se muestra.", i))
    }
    if (length(formas) < 2L) {
      stop_api(422, "E_TXT_DICCIONARIO_INVALIDO", sprintf("El grupo «%s» une menos de dos palabras.", mostrar))
    }
    if (any(grepl(" ", formas, fixed = TRUE))) {
      stop_api(422, "E_TXT_DICCIONARIO_INVALIDO",
               sprintf("El grupo «%s» une frases: una equivalencia une palabras; las frases se fijan en «frases».", mostrar))
    }
    if (!.txt_dic_clave(mostrar) %in% .txt_dic_clave(formas)) {
      stop_api(422, "E_TXT_MOSTRAR_FUERA_DE_FORMAS", sprintf("«%s» no está entre las palabras de su grupo.", mostrar),
               details = list(mostrar = mostrar, formas = as.list(formas)))
    }
    rep_ <- intersect(.txt_dic_clave(formas), vistas)
    if (length(rep_)) {
      stop_api(422, "E_TXT_FORMA_REPETIDA", sprintf("«%s» está en dos grupos de equivalencias.", rep_[[1]]),
               details = list(forma = rep_[[1]]))
    }
    vistas <<- c(vistas, .txt_dic_clave(formas))
    list(mostrar = formas[match(.txt_dic_clave(mostrar), .txt_dic_clave(formas))], formas = formas)
  })
  list(equivalencias = equivalencias, excluir = .txt_dic_terminos(raw$excluir, "excluir"),
       frases = .txt_dic_terminos(raw$frases, "frases"))
}

#' Valida contra el corpus: dos formas distintas con la misma raíz no pueden ir en grupos distintos
#' @keywords internal
.txt_dic_validar_corpus <- function(d, textos) {
  if (length(d$equivalencias) < 2L) return(invisible(d))
  voc <- .txt_dic_vocabulario_contenido(textos)
  raices <- lapply(d$equivalencias, function(g) unique(unname(.txt_raiz(g$formas, vocabulario = voc))))
  vistas <- character(0)
  for (i in seq_along(raices)) {
    rep_ <- intersect(raices[[i]], vistas)
    if (length(rep_)) {
      stop_api(422, "E_TXT_FORMA_REPETIDA",
               sprintf("El grupo «%s» comparte la raíz «%s» con otro grupo: son la misma palabra.", d$equivalencias[[i]]$mostrar, rep_[[1]]),
               details = list(raiz = rep_[[1]]))
    }
    vistas <- c(vistas, raices[[i]])
  }
  invisible(d)
}

#' Palabras de contenido del corpus (las que deciden los infinitivos de `.txt_raiz`)
#' @keywords internal
.txt_dic_vocabulario_contenido <- function(textos, min_chars = 3L) {
  voc <- unique(unlist(.txt_tokens(textos)))
  voc[nchar(voc, type = "chars") >= min_chars & !.txt_sin_tildes(voc) %in% .txt_vacias_limpias()]
}

# ---------------------------------------------------------------------------
# Aplicación en los motores
# ---------------------------------------------------------------------------

#' Mapa de equivalencias: clave de cada forma → clave de `mostrar`, y clave de `mostrar` → palabra que se dibuja
#'
#' Acepta los grupos del diccionario (`list(list(mostrar, formas))`) o el vector con nombre raíz → raíz de antes.
#' `clave_de` lleva palabras a su clave (la raíz con lematizar; minúsculas sin tilde sin él).
#' @keywords internal
.txt_dic_mapa <- function(equivalencias, clave_de) {
  vacio <- list(mapa = stats::setNames(character(0), character(0)), mostrar = stats::setNames(character(0), character(0)))
  if (is.null(equivalencias) || !length(equivalencias)) return(vacio)
  grupos <- is.list(equivalencias) && all(vapply(equivalencias, function(g) is.list(g) && !is.null(g$formas), logical(1)))
  if (!grupos) {
    eq <- unlist(equivalencias)
    if (!length(eq) || is.null(names(eq))) return(vacio)
    return(list(mapa = stats::setNames(.txt_sin_tildes(tolower(as.character(eq))), .txt_sin_tildes(tolower(names(eq)))),
                mostrar = vacio$mostrar))
  }
  mapa <- character(0); mostrar <- character(0)
  for (g in equivalencias) {
    formas <- .txt_dic_termino(unlist(g$formas)); formas <- formas[nzchar(formas)]
    m <- .txt_dic_termino(unlist(g$mostrar %||% formas[1])[1])
    if (!length(formas) || !nzchar(m)) next
    destino <- unname(clave_de(tolower(m)))
    claves <- unname(clave_de(tolower(formas)))
    mapa[claves] <- destino
    mostrar[destino] <- m
  }
  list(mapa = mapa, mostrar = mostrar)
}

#' Patrones de varias palabras (frases fijas o términos excluidos), como tokens normalizados
#' @keywords internal
.txt_dic_patrones <- function(terminos) {
  terminos <- .txt_dic_termino(unlist(terminos %||% character(0)))
  terminos <- terminos[!is.na(terminos) & nzchar(terminos)]
  tok <- .txt_tokens(terminos)
  keep <- lengths(tok) >= 2L
  list(texto = terminos[keep], tokens = tok[keep])
}

#' Largo del patrón que calza en la posición `j` (0 si ninguno); compara la clave de cada token
#' @keywords internal
.txt_dic_calza <- function(claves, j, patrones_claves) {
  n <- length(claves)
  for (k in seq_along(patrones_claves)) {
    p <- patrones_claves[[k]]; m <- length(p)
    if (j + m - 1L <= n && identical(claves[j:(j + m - 1L)], p)) return(c(k, m))
  }
  c(0L, 0L)
}

#' Diccionario de una pregunta colgado del instrumento de su base (lo que ve el motor del render)
#'
#' `ctx` es el contexto de `.resolve_ref()`: busca por la variable pedida y, si el motor la llevó a su `_recod`, por la
#' variable de texto original.
#' @keywords internal
.txt_dic_de_ctx <- function(ctx) {
  por_var <- (ctx$instrumento %||% list())$texto_abierto_diccionario
  if (!is.list(por_var) || !length(por_var)) return(NULL)
  cand <- unique(c(sub("^.*\\$", "", as.character(ctx$var_requested %||% character(0))), as.character(ctx$var %||% character(0))))
  cand <- unique(c(cand, sub("_recod$", "", cand)))
  for (v in cand) if (!is.null(por_var[[v]])) return(por_var[[v]])
  NULL
}

#' Argumentos de la nube que salen del diccionario, sin los que el plan ya decide (el plan gana)
#'
#' Decide el plan cuando trae el argumento con algo dentro. Uno vacío no cuenta como decisión: el editor puede mandar
#' listas vacías por defecto, y tomarlas como «sin diccionario» apagaría en silencio lo que el usuario armó.
#' @param dic diccionario de la pregunta (forma de almacenamiento) o NULL.
#' @param ... listas de argumentos del plan (preset, overrides de la lámina).
#' @keywords internal
.txt_dic_args_nube <- function(dic, ...) {
  if (.txt_dic_es_vacio(dic)) return(list())
  decididos <- unique(unlist(lapply(list(...), function(a) {
    if (!is.list(a) || !length(a) || is.null(names(a))) return(character(0))
    names(a)[vapply(a, function(v) length(unlist(v)) > 0L, logical(1))]
  })))
  out <- list(equivalencias = if (length(dic$equivalencias)) dic$equivalencias else NULL,
              excluir_terminos = if (length(dic$excluir)) dic$excluir else NULL,
              frases_fijas = if (length(dic$frases)) dic$frases else NULL)
  out <- out[!vapply(out, is.null, logical(1))]
  out[setdiff(names(out), decididos)]
}

# ---------------------------------------------------------------------------
# Palabras reconocidas de una pregunta (lo que la UI ofrece para unir, excluir o fijar)
# ---------------------------------------------------------------------------

#' Palabras reconocidas en los comentarios con contenido de una pregunta, con su estado en el diccionario
#'
#' Una fila por raíz de contenido (las de la nube limpia, sin aplicar el diccionario, para que cada forma se vea):
#' `raiz`, `forma` (la escritura más frecuente), `formas` (todas, de la más a la menos usada), `personas` (cuántas la
#' usan, sin ponderar), `grupo` (la palabra que muestra su grupo de equivalencias, o NULL), `excluida`, `frases` (frases
#' fijas que la contienen) y `excluida_en` (términos excluidos de varias palabras que la contienen).
#' @param textos comentarios tal como vienen de la base, una fila por persona.
#' @param dic diccionario normalizado de la pregunta.
#' @keywords internal
texto_abierto_palabras <- function(textos, dic = NULL, min_chars = 3L) {
  dic <- dic %||% .txt_dic_vacio()
  crudo <- as.character(textos); crudo[is.na(crudo)] <- ""
  escrito <- nzchar(trimws(crudo))
  x <- crudo[escrito & !.txt_no_respuesta(crudo)]
  tok <- .txt_tokens(x)
  vacias <- .txt_vacias_limpias()
  es_cont <- function(t) nchar(t, type = "chars") >= min_chars & !.txt_sin_tildes(t) %in% vacias
  voc <- unique(unlist(tok))
  voc_cont <- voc[es_cont(voc)]
  raiz <- if (length(voc)) .txt_raiz(voc, vocabulario = voc_cont) else stats::setNames(character(0), character(0))
  clave_de <- function(w) unname(.txt_raiz(w, vocabulario = voc_cont))
  filas <- do.call(rbind, lapply(seq_along(tok), function(i) {
    t <- tok[[i]][es_cont(tok[[i]])]
    if (!length(t)) return(NULL)
    data.frame(persona = i, raiz = unname(raiz[t]), forma = t, stringsAsFactors = FALSE)
  }))
  grupo_de <- character(0)
  grupos <- lapply(dic$equivalencias, function(g) {
    r <- unique(clave_de(tolower(g$formas)))
    grupo_de[r] <<- g$mostrar
    personas <- if (is.null(filas)) 0L else length(unique(filas$persona[filas$raiz %in% r]))
    list(mostrar = g$mostrar, formas = as.list(g$formas), raices = as.list(r), personas = as.integer(personas))
  })
  sueltos <- dic$excluir[!grepl(" ", dic$excluir, fixed = TRUE)]
  excl_r <- if (length(sueltos)) unique(clave_de(tolower(sueltos))) else character(0)
  frases_r <- lapply(dic$frases, function(f) unique(clave_de(unlist(.txt_tokens(f)))))
  pex <- .txt_dic_patrones(dic$excluir)
  pex_r <- lapply(pex$tokens, function(t) unique(clave_de(t)))
  palabras <- list()
  if (!is.null(filas) && nrow(filas)) {
    personas <- tapply(filas$persona, filas$raiz, function(p) length(unique(p)))
    rs <- names(personas)[order(-as.integer(personas), names(personas))]
    palabras <- lapply(rs, function(r) {
      fs <- filas$forma[filas$raiz == r]
      tb <- table(fs); orden <- names(tb)[order(-as.integer(tb), names(tb))]
      list(raiz = r, forma = orden[[1]], formas = as.list(orden), personas = as.integer(personas[[r]]),
           grupo = if (r %in% names(grupo_de)) unname(grupo_de[[r]]) else NULL,
           excluida = r %in% excl_r,
           frases = as.list(dic$frases[vapply(frases_r, function(fr) r %in% fr, logical(1))]),
           excluida_en = as.list(pex$texto[vapply(pex_r, function(fr) r %in% fr, logical(1))]))
    })
  }
  fd <- .txt_frases(tok, min_personas = 2L, min_chars = min_chars, vacias = vacias)
  frases_detectadas <- lapply(seq_len(nrow(fd)), function(i) list(
    clave = fd$clave[[i]], forma = fd$forma[[i]], personas = as.integer(fd$personas[[i]]),
    fija = .txt_dic_clave(fd$forma[[i]]) %in% .txt_dic_clave(dic$frases),
    excluida = .txt_dic_clave(fd$forma[[i]]) %in% .txt_dic_clave(dic$excluir)))
  list(palabras = palabras, grupos = grupos, frases_detectadas = frases_detectadas,
       resumen = list(escribieron = as.integer(sum(escrito)), con_contenido = as.integer(length(x)),
                      n_palabras = as.integer(length(palabras))))
}

# ---------------------------------------------------------------------------
# Sesión: base, lectura y escritura
# ---------------------------------------------------------------------------

#' Base del pedido: la pedida (que debe existir) o la activa; nunca la primera por omisión
#' @keywords internal
.txt_dic_base <- function(sid, base = NULL) {
  s <- session_get(sid)
  base <- .txt_dic_termino(unlist(base %||% "")[1] %||% "")
  bases <- names((s$estudio %||% list())$bases %||% list())
  if (is.na(base) || !nzchar(base)) return(codif_source_active(sid))
  if ((length(bases) && !base %in% bases) || (!length(bases) && !identical(base, "default"))) {
    stop_api(404, "E_TXT_BASE_NO_EXISTE", sprintf("La base '%s' no existe en este proyecto.", base))
  }
  base
}

#' Comentarios de la pregunta en la base (los de Codificación: la base adaptada o la depurada si ya se cerró)
#' @keywords internal
.txt_dic_textos <- function(sid, base, variable) {
  variable <- .txt_dic_termino(unlist(variable %||% "")[1] %||% "")
  if (is.na(variable) || !nzchar(variable)) {
    stop_api(400, "E_TXT_SIN_VARIABLE", "Falta la pregunta abierta ('variable').")
  }
  df <- codif_data_cached(sid, base)
  if (!is.data.frame(df) || !variable %in% names(df)) {
    stop_api(404, "E_TXT_VARIABLE_NO_EXISTE", sprintf("La base '%s' no tiene la pregunta '%s'.", base, variable))
  }
  list(variable = variable, textos = df[[variable]])
}

#' Diccionario guardado de una pregunta (forma de almacenamiento), o vacío
#' @keywords internal
.txt_dic_de <- function(sid, base, variable) {
  s <- session_get(sid)
  d <- ((s[[.TXT_DIC_CLAVE_SESION]] %||% list())[[base]] %||% list())[[variable]]
  if (is.null(d)) .txt_dic_vacio() else d
}

#' Diccionario como JSON: listas aunque tengan un solo elemento
#' @keywords internal
.txt_dic_json <- function(d) {
  d <- d %||% .txt_dic_vacio()
  list(equivalencias = lapply(d$equivalencias, function(g) list(mostrar = g$mostrar, formas = as.list(g$formas))),
       excluir = as.list(d$excluir), frases = as.list(d$frases))
}

#' GET: el diccionario de la pregunta y sus palabras reconocidas
#' @keywords internal
texto_abierto_diccionario_consultar <- function(sid, base = NULL, variable = NULL) {
  base <- .txt_dic_base(sid, base)
  tx <- .txt_dic_textos(sid, base, variable)
  d <- .txt_dic_de(sid, base, tx$variable)
  c(list(ok = TRUE, base = base, variable = tx$variable, diccionario = .txt_dic_json(d)),
    texto_abierto_palabras(tx$textos, d))
}

#' PUT: guarda el diccionario completo de la pregunta y marca el proyecto
#'
#' Escribe sólo `[[base]][[variable]]`: las demás preguntas y bases quedan como estaban. Un diccionario vacío borra la
#' entrada de esa pregunta.
#' @keywords internal
texto_abierto_diccionario_guardar <- function(sid, base = NULL, variable = NULL, raw = list()) {
  base <- .txt_dic_base(sid, base)
  tx <- .txt_dic_textos(sid, base, variable)
  d <- .txt_dic_normalizar(raw)
  .txt_dic_validar_corpus(d, tx$textos)
  todo <- session_get(sid)[[.TXT_DIC_CLAVE_SESION]] %||% list()
  por_base <- todo[[base]] %||% list()
  por_base[[tx$variable]] <- if (.txt_dic_es_vacio(d)) NULL else d
  todo[[base]] <- if (length(por_base)) por_base else NULL
  session_set(sid, "texto_abierto_diccionario", if (length(todo)) todo else NULL)
  list(ok = TRUE, base = base, variable = tx$variable, diccionario = .txt_dic_json(d))
}

#' Cuelga el diccionario de cada base en su instrumento, para el render (vista previa y worker del PPT/Word)
#'
#' No muta la sesión: devuelve las fuentes con `inst_sources[[base]]$texto_abierto_diccionario` en las bases que tienen
#' diccionario. Las demás bases y las tablas de datos quedan iguales.
#' @keywords internal
.txt_dic_adjuntar_fuentes <- function(sid, src) {
  s <- session_get(sid, required = FALSE)
  todo <- (s %||% list())[[.TXT_DIC_CLAVE_SESION]]
  if (!is.list(todo) || !length(todo) || !is.list(src$inst_sources)) return(src)
  for (b in intersect(names(todo), names(src$inst_sources))) {
    if (is.list(src$inst_sources[[b]]) && length(todo[[b]])) src$inst_sources[[b]]$texto_abierto_diccionario <- todo[[b]]
  }
  src
}
