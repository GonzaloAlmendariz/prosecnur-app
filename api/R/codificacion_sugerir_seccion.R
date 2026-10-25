# Sugerencia de módulo del instrumento para un comentario abierto (TXT-3, plan-texto-abierto-ccss-2026-10-24).
#
# Contrato:
#   - Es una PROPUESTA. El motor no escribe grupos ni matrix_cases: el analista confirma en Codificación, igual que
#     en el flujo híbrido de abiertas. Por eso es una función pura sobre (inst, data_df).
#   - Un código por módulo, por decena en el orden del formulario (10, 20, 30…), y «otro» = 80. Un módulo que se
#     lleva más de la mitad de las propuestas se parte en subtemas (TXT-11b: grupos formales, baterías y «general»),
#     con códigos dentro de su decena (21–29 para el 20) y `padre`; los demás quedan en primer nivel.
#   - El módulo de una pregunta es su grupo de primer nivel: `.section_map` da la sección más interna y aquí se sube
#     a su raíz, para que un subgrupo («bloque_crianza» dentro de «modulo_a») hable por su módulo.
#   - El vocabulario de un módulo son las raíces de contenido de la etiqueta del grupo, de sus preguntas y de las
#     opciones de sus selects. Raíces y palabras vacías vienen de `texto_abierto_normalizar.R` (las mismas de la
#     nube), así un comentario se lee igual en la nube y aquí.
#   - Puntaje de un módulo para un comentario: suma, sobre las raíces distintas que comparten, de
#     log(1 + M / df), con M módulos y df los módulos que usan esa raíz. Una palabra que está en todos los módulos
#     casi no pesa; una exclusiva de uno, sí. Se propone todo módulo con puntaje >= `min_puntaje` y >= `rel_max` del
#     mejor, hasta `max_propuestas` (multicode).
#   - Una no respuesta (`.txt_no_respuesta`) no recibe propuesta. Un comentario con contenido sin vocabulario
#     compartido queda `candidato_otro`: tampoco se le asigna «otro», se le señala.

.CODIF_SS_PATRON_MODULO <- "^(modulo|module|seccion|section|bloque|parte)[_ .-]?[a-z0-9]{1,2}$"
# Palabras que un comentario usa para pedir o valorar sin decir sobre qué, y que el cuestionario también usa en
# cualquier módulo («mejorar», «cuenta», «acuerdo»). No son de la nube (allí sí se ven): sólo no deciden el módulo.
.CODIF_SS_VACIAS_SUGERIR <- c(
  "mejorar", "mejora", "mejoras", "mejoren", "mejore", "cuenta", "cuentan", "queda", "quedan", "saber", "sabiendo",
  "tenido", "llegar", "acuerdo", "desacuerdo", "cuanto", "cuanta", "relacion", "tiempo", "mayor", "menor", "ofrecer",
  "ofrece", "ofrecen", "buscar", "dejar", "tomar", "uso", "usar", "dar", "permitir", "permitan", "cumplir", "cumplan",
  "totalmente", "nivel", "tipo", "caso", "grado", "actual", "actualmente", "momento", "año", "ano", "anos", "dia",
  "vida", "gran", "nuevo", "nueva", "posible", "cualquier", "persona", "gente", "hola", "aspecto", "aspectos",
  # TXT-22: la carrera se pregunta en el módulo de datos generales, pero un comentario la nombra para hablar de otra
  # cosa (la malla, los docentes): no decide el módulo.
  "carrera", "carreras"
)
.CODIF_SS_TIPOS_SIN_TEXTO <- c("calculate", "hidden", "start", "end", "today", "deviceid", "username",
                               "simserialid", "subscriberid", "phonenumber", "audit", "begin_group", "end_group",
                               "begin_repeat", "end_repeat")

#' Etiqueta visible de un grupo, sin el marcado de Markdown («### COMENTARIOS» → «COMENTARIOS»)
#' @keywords internal
.codif_ss_limpiar_etiqueta <- function(x, fallback) {
  x <- trimws(gsub("\\*+|<[^>]+>", "", sub("^[#\\s]+", "", as.character(x %||% ""), perl = TRUE)))
  if (is.na(x) || !nzchar(x)) fallback else x
}

#' Grupo de primer nivel de cada grupo del formulario, y el orden en que aparecen
#' @keywords internal
.codif_ss_raices_de_grupo <- function(sv) {
  tipo <- as.character(sv$type %||% character(0)); tipo[is.na(tipo)] <- ""
  nom <- as.character(sv$name %||% character(0)); nom[is.na(nom)] <- ""
  pila <- character(0); raiz <- character(0); orden <- character(0)
  for (i in seq_along(tipo)) {
    if (tipo[i] %in% c("begin_group", "begin_repeat") && nzchar(nom[i])) {
      if (!length(pila)) orden <- c(orden, nom[i])
      pila <- c(pila, nom[i])
      raiz[[nom[i]]] <- pila[1]
    } else if (tipo[i] %in% c("end_group", "end_repeat") && length(pila)) {
      pila <- pila[-length(pila)]
    }
  }
  list(raiz = raiz, orden = unique(orden))
}

#' Texto que aporta una pregunta al vocabulario: su etiqueta y, si su lista no es una escala, sus opciones
#'
#' Una lista de opciones que usan tres preguntas o más es una escala (acuerdo, frecuencia): no describe el módulo.
#' @keywords internal
.codif_ss_texto_pregunta <- function(inst, nm, base_tipo, lista, usos_lista) {
  txt <- .codif_var_label(inst, nm, "")
  if (base_tipo %in% c("select_one", "select_multiple") && nzchar(lista) && usos_lista[[lista]] < 3L) {
    txt <- c(txt, unname(as.character(.choices_lookup(inst, lista))))
  }
  txt
}

#' Textos que describen cada módulo: etiqueta del grupo, de sus preguntas y de sus opciones
#'
#' Devuelve `list(modulos = data.frame(seccion, etiqueta), textos = list(seccion -> character), de_variable)`.
#' `de_variable` es el módulo donde vive la variable a codificar (no compite consigo mismo).
#' @keywords internal
.codif_ss_textos_modulo <- function(inst, variable) {
  sv <- inst$survey
  if (is.null(sv) || !nrow(sv)) return(list(orden = character(0), etiquetas = character(0), textos = list(), de_variable = ""))
  sm <- .section_map(inst)
  rg <- .codif_ss_raices_de_grupo(sv)
  tipo <- as.character(sv$type); tipo[is.na(tipo)] <- ""
  base_tipo <- sub("\\s.*$", "", tipo)
  lista <- if ("list_norm" %in% names(sv)) as.character(sv$list_norm) else rep("", nrow(sv))
  lista[is.na(lista)] <- ""
  es_select <- base_tipo %in% c("select_one", "select_multiple") & nzchar(lista)
  usos_lista <- as.list(table(lista[es_select]))
  textos <- stats::setNames(vector("list", length(rg$orden)), rg$orden)
  de_variable <- ""
  for (i in seq_len(nrow(sm))) {
    nm <- as.character(sm$name[i] %||% ""); sec <- as.character(sm$section[i] %||% "")
    if (is.na(nm) || !nzchar(nm) || is.na(sec) || !nzchar(sec) || base_tipo[i] %in% .CODIF_SS_TIPOS_SIN_TEXTO) next
    mod <- unname(rg$raiz[sec]); if (is.na(mod)) next
    if (identical(nm, variable)) { de_variable <- mod; next }
    textos[[mod]] <- c(textos[[mod]], .codif_ss_texto_pregunta(inst, nm, base_tipo[i], lista[i], usos_lista))
  }
  etiquetas <- vapply(rg$orden, function(g) .codif_ss_limpiar_etiqueta(.codif_var_label(inst, g, ""), g), character(1))
  for (g in rg$orden) textos[[g]] <- c(etiquetas[[g]], textos[[g]])
  list(orden = rg$orden, etiquetas = etiquetas, textos = textos, de_variable = de_variable)
}

#' Módulos candidatos: los pedidos, o los grupos de primer nivel con vocabulario (si alguno se llama «modulo_x»,
#' sólo esos), sin el módulo de la propia variable
#' @keywords internal
.codif_ss_elegir_modulos <- function(tm, secciones = NULL) {
  secciones <- trimws(as.character(unlist(secciones %||% character(0), use.names = FALSE)))
  secciones <- unique(secciones[!is.na(secciones) & nzchar(secciones)])
  if (length(secciones)) {
    faltan <- setdiff(secciones, tm$orden)
    if (length(faltan)) {
      stop_api(422, "E_CODIF_SUGERIR_SECCION_NO_EXISTE",
               sprintf("La sección '%s' no es un grupo de primer nivel del formulario.", faltan[[1]]),
               details = list(secciones_disponibles = as.list(tm$orden)))
    }
    return(tm$orden[tm$orden %in% secciones])
  }
  cand <- setdiff(tm$orden, tm$de_variable)
  cand <- cand[vapply(cand, function(g) length(tm$textos[[g]]) > 1L, logical(1))]
  nombrados <- cand[grepl(.CODIF_SS_PATRON_MODULO, tolower(cand))]
  if (length(nombrados)) nombrados else cand
}

#' Raíces de contenido de un texto, con la forma escrita de cada una (la primera que aparece)
#' @keywords internal
.codif_ss_raices <- function(tokens, raiz, vacias, min_chars = 3L) {
  lapply(tokens, function(t) {
    t <- t[nchar(t, type = "chars") >= min_chars & !.txt_sin_tildes(t) %in% vacias]
    if (!length(t)) return(stats::setNames(character(0), character(0)))
    r <- unname(raiz[t])
    keep <- !duplicated(r)
    stats::setNames(t[keep], r[keep])
  })
}

#' El diccionario de la pregunta llevado al vocabulario de la sugerencia
#'
#' Devuelve el mapa de equivalencias (forma → raíz de `mostrar`), las raíces excluidas (términos de una palabra) y los
#' tokens sin las apariciones de los términos excluidos de varias palabras, en el comentario y en los módulos.
#' @keywords internal
.codif_ss_diccionario <- function(diccionario, tok_mod, tok_resp, contenido, vacias) {
  out <- list(mapa = list(), excluidas = character(0), tok_mod = tok_mod, tok_resp = tok_resp)
  if (.txt_dic_es_vacio(diccionario)) return(out)
  clave_de <- function(w) unname(.txt_raiz(w, vocabulario = contenido))
  eqm <- .txt_dic_mapa(diccionario$equivalencias, clave_de)
  out$mapa <- as.list(eqm$mapa)
  excl <- .txt_dic_termino(unlist(diccionario$excluir %||% character(0)))
  sueltos <- excl[nzchar(excl) & !grepl(" ", excl, fixed = TRUE)]
  if (length(sueltos)) {
    r <- clave_de(unlist(.txt_tokens(sueltos)))
    m <- match(r, names(eqm$mapa)); r[!is.na(m)] <- unname(eqm$mapa[m[!is.na(m)]])
    out$excluidas <- unique(r)
  }
  pex <- .txt_dic_patrones(excl)
  if (length(pex$tokens)) {
    clave_tok <- function(t) ifelse(nchar(t, type = "chars") >= 3L & !.txt_sin_tildes(t) %in% vacias, clave_de(t), .txt_sin_tildes(t))
    pk <- lapply(pex$tokens, clave_tok); pk <- pk[order(-lengths(pk))]
    quitar <- function(t) {
      if (length(t) < 2L) return(t)
      k <- clave_tok(t); keep <- rep(TRUE, length(t)); j <- 1L
      while (j <= length(t)) {
        hit <- .txt_dic_calza(k, j, pk)
        if (hit[2] > 0L) { keep[j:(j + hit[2] - 1L)] <- FALSE; j <- j + hit[2] } else j <- j + 1L
      }
      t[keep]
    }
    out$tok_mod <- lapply(tok_mod, quitar)
    out$tok_resp <- lapply(tok_resp, quitar)
  }
  out
}

#' Etiqueta de un subtema: la primera línea de su nota o de su grupo, sin marcado y recortada
#' @keywords internal
.codif_ss_recortar_etiqueta <- function(x, fallback, max_chars = 90L) {
  x <- strsplit(as.character(x %||% ""), "\n", fixed = TRUE)[[1]]
  x <- x[nzchar(trimws(x))]
  x <- gsub("[_*]+", "", .codif_ss_limpiar_etiqueta(if (length(x)) x[[1]] else "", fallback))
  x <- trimws(gsub("\\s+", " ", x, perl = TRUE))
  if (!nzchar(x)) return(fallback)
  if (nchar(x, type = "chars") <= max_chars) return(x)
  corte <- substr(x, 1L, max_chars)
  corte <- sub("\\s+\\S*$", "", corte, perl = TRUE)
  paste0(corte, "…")
}

#' Etiqueta del subtema «general»: «MÓDULO B. EXPERIENCIA UNIVERSITARIA» → «Experiencia universitaria: preguntas generales»
#' @keywords internal
.codif_ss_etiqueta_general <- function(etiqueta_modulo) {
  x <- sub("^(m[oó]dulo|secci[oó]n|bloque|parte)\\s+[a-z0-9]{1,2}\\s*[.:–—-]\\s*", "", trimws(etiqueta_modulo),
           ignore.case = TRUE, perl = TRUE)
  if (!nzchar(x)) return("Preguntas generales")
  if (identical(x, toupper(x))) x <- paste0(substr(x, 1L, 1L), tolower(substr(x, 2L, nchar(x))))
  paste0(x, ": preguntas generales")
}

#' ¿Abre `etiqueta` su propio subtema tras una batería? (TXT-25)
#'
#' Sí cuando la pregunta trae un enunciado interrogativo propio (con «¿» o «?», de 20 caracteres o más), distinto del
#' que abrió el subtema en curso, y no comparte la lista de opciones de la pregunta anterior (una escala compartida es
#' un ítem de batería, aunque pregunte). Su recodificada (mismo enunciado) y su «Por favor, especifica» se quedan.
#' @keywords internal
.codif_ss_abre_pregunta <- function(etiqueta, etiqueta_abre, lista, lista_anterior) {
  e <- trimws(gsub("\\s+", " ", as.character(etiqueta %||% "")[1], perl = TRUE))
  if (is.na(e) || nchar(e, type = "chars") < 20L || !grepl("[\u00bf?]", e, perl = TRUE)) return(FALSE)
  if (identical(e, trimws(gsub("\\s+", " ", as.character(etiqueta_abre %||% "")[1], perl = TRUE)))) return(FALSE)
  !(nzchar(lista) && identical(lista, lista_anterior))
}

#' Subtemas de un módulo: sus grupos formales, sus baterías y sus preguntas sueltas
#'
#' Recorre el módulo en el orden del formulario. Un grupo hijo (con lo que anide) es un subtema. Una batería es una
#' nota (`note`, o un `enunciado_*`) directamente en el módulo, con las preguntas que la siguen hasta la próxima nota
#' o grupo. TXT-25: dentro de una batería, una pregunta que ya no es ítem de ella (`.codif_ss_abre_pregunta`) abre su
#' propio subtema, aunque no haya nota de por medio, y lo mismo la pregunta que la siga. Las preguntas sueltas fuera de
#' batería y de grupo forman el subtema «general» del módulo (ése no se parte). Un subtema sin preguntas con texto no
#' entra. Devuelve una lista de `list(seccion, etiqueta, textos)`.
#' @keywords internal
.codif_ss_subtemas <- function(inst, modulo, variable, etiqueta_modulo = modulo) {
  sv <- inst$survey
  tipo <- as.character(sv$type %||% character(0)); tipo[is.na(tipo)] <- ""
  nom <- as.character(sv$name %||% character(0)); nom[is.na(nom)] <- ""
  base_tipo <- sub("\\s.*$", "", tipo)
  lista <- if ("list_norm" %in% names(sv)) as.character(sv$list_norm) else rep("", nrow(sv))
  lista[is.na(lista)] <- ""
  usos_lista <- as.list(table(lista[base_tipo %in% c("select_one", "select_multiple") & nzchar(lista)]))
  ini <- which(base_tipo %in% c("begin_group", "begin_repeat") & nom == modulo)
  if (!length(ini)) return(list())
  subs <- list(); n_preg <- list()
  # TXT-20: la etiqueta de siempre va recortada a 90 caracteres; la completa viaja aparte para el rótulo corto.
  abrir <- function(clave, nombre, etiqueta = NULL, tipo = "bateria") {
    if (is.null(subs[[clave]])) {
      lab <- .codif_var_label(inst, nombre, "")
      etiqueta <- etiqueta %||% .codif_ss_recortar_etiqueta(lab, nombre)
      completa <- .codif_ss_recortar_etiqueta(lab, etiqueta, max_chars = Inf)
      subs[[clave]] <<- list(seccion = clave, etiqueta = etiqueta, etiqueta_completa = completa, textos = character(0),
                             tipo = tipo)
      n_preg[[clave]] <<- 0L
    }
    clave
  }
  general <- paste0(modulo, "__general")
  prof <- 0L; en_grupo <- NULL; bateria <- NULL; abre_bateria <- ""; lista_anterior <- ""
  for (i in seq.int(ini[[1]] + 1L, length.out = max(0L, length(tipo) - ini[[1]]))) {
    bt <- base_tipo[[i]]
    if (bt %in% c("begin_group", "begin_repeat")) {
      prof <- prof + 1L
      if (prof == 1L) {
        clave_g <- if (nzchar(nom[[i]])) nom[[i]] else sprintf("%s__grupo_%d", modulo, i)
        en_grupo <- abrir(clave_g, nom[[i]], tipo = "grupo")
        bateria <- NULL
      }
      next
    }
    if (bt %in% c("end_group", "end_repeat")) {
      if (prof == 0L) break
      prof <- prof - 1L
      if (prof == 0L) en_grupo <- NULL
      next
    }
    nm <- nom[[i]]
    if (!nzchar(nm) || identical(nm, variable)) next
    if (prof == 0L && (bt == "note" || startsWith(tolower(nm), "enunciado_"))) {
      bateria <- abrir(nm, nm)
      abre_bateria <- .codif_var_label(inst, nm, ""); lista_anterior <- ""
      next
    }
    if (bt == "note" || bt %in% .CODIF_SS_TIPOS_SIN_TEXTO) next
    if (prof == 0L && !is.null(bateria) && n_preg[[bateria]] > 0L) {
      lab_i <- .codif_var_label(inst, nm, "")
      if (.codif_ss_abre_pregunta(lab_i, abre_bateria, lista[[i]], lista_anterior)) {
        bateria <- abrir(nm, nm, tipo = "pregunta"); abre_bateria <- lab_i
      }
    }
    if (prof == 0L && !is.null(bateria)) lista_anterior <- lista[[i]]
    clave <- en_grupo %||% bateria %||% abrir(general, general, .codif_ss_etiqueta_general(etiqueta_modulo), tipo = "general")
    subs[[clave]]$textos <- c(subs[[clave]]$textos, .codif_ss_texto_pregunta(inst, nm, bt, lista[[i]], usos_lista))
    n_preg[[clave]] <- n_preg[[clave]] + 1L
  }
  subs <- subs[vapply(names(subs), function(k) n_preg[[k]] > 0L, logical(1))]
  unname(lapply(subs, function(x) { x$textos <- c(x$etiqueta, x$textos); x }))
}

#' Fusiona subtemas consecutivos, siempre el par vecino de menor vocabulario, hasta `max_subtemas`
#'
#' TXT-25: primero entre dos baterías vecinas (suelen ser el mismo tema en dos escalas: frecuencia de redes y de IA,
#' trato docente y horarios de atención); sólo cuando ya no quedan dos baterías juntas se fusiona cualquier par. Así
#' una pregunta que se separó de su batería no vuelve a juntarse mientras haya otra salida.
#' @keywords internal
.codif_ss_fusionar_subtemas <- function(subs, vacias, max_subtemas = 9L) {
  n_voc <- function(x) {
    t <- .txt_sin_tildes(unlist(.txt_tokens(x$textos)))
    length(unique(t[nchar(t, type = "chars") >= 3L & !t %in% vacias]))
  }
  while (length(subs) > max_subtemas) {
    tam <- vapply(subs, n_voc, integer(1))
    costo <- utils::head(tam, -1L) + tam[-1L]
    es_bat <- vapply(subs, function(x) identical(x$tipo %||% "bateria", "bateria"), logical(1))
    par_bat <- utils::head(es_bat, -1L) & es_bat[-1L]
    if (any(par_bat)) costo[!par_bat] <- Inf
    k <- which.min(costo)
    a <- subs[[k]]; b <- subs[[k + 1L]]
    subs[[k]] <- list(seccion = a$seccion, etiqueta = paste(a$etiqueta, b$etiqueta, sep = " / "),
                      etiqueta_completa = paste(a$etiqueta_completa %||% a$etiqueta, b$etiqueta_completa %||% b$etiqueta, sep = " / "),
                      textos = c(a$textos, b$textos), tipo = if (identical(a$tipo, b$tipo)) a$tipo else "mixto")
    subs[[k + 1L]] <- NULL
  }
  subs
}

#' Puntaje de cada unidad (módulo o subtema) para cada respuesta
#'
#' `textos_unidad` es una lista de vectores de texto por unidad. Devuelve `voc` (raíces por unidad) y `sel`: por
#' respuesta, las unidades propuestas (`m`, `puntaje`, `palabras`) en orden de puntaje.
#' @keywords internal
.codif_ss_puntuar <- function(textos_unidad, textos_resp, no_resp, diccionario, min_puntaje, rel_max, max_propuestas) {
  vacias <- unique(c(.txt_vacias_limpias(), .CODIF_SS_VACIAS_SUGERIR))
  n <- length(textos_unidad)
  tok_mod <- lapply(textos_unidad, function(x) unlist(.txt_tokens(x)))
  tok_resp <- .txt_tokens(textos_resp)
  voc <- unique(c(unlist(tok_mod), unlist(tok_resp)))
  contenido <- voc[nchar(voc, type = "chars") >= 3L & !.txt_sin_tildes(voc) %in% vacias]
  dic <- .codif_ss_diccionario(diccionario, tok_mod, tok_resp, contenido, vacias)
  tok_mod <- dic$tok_mod; tok_resp <- dic$tok_resp
  raiz <- if (length(voc)) .txt_raiz(voc, vocabulario = contenido, equivalencias = dic$mapa) else character(0)

  voc_mod <- lapply(.codif_ss_raices(tok_mod, raiz, vacias), names)
  # Una raíz que está en todas las unidades no distingue ninguna (con tres o más): se descarta.
  voc_mod <- lapply(voc_mod, function(v) v[!v %in% c(.CODIF_SS_VACIAS_SUGERIR, dic$excluidas)])
  df <- table(unlist(voc_mod))
  if (n >= 3L) {
    ubicuas <- names(df)[as.integer(df) >= n]
    voc_mod <- lapply(voc_mod, function(v) v[!v %in% ubicuas])
    df <- df[!names(df) %in% ubicuas]
  }
  idf <- log1p(n / as.numeric(df)); names(idf) <- names(df)
  raices_resp <- .codif_ss_raices(tok_resp, raiz, vacias)
  if (length(dic$excluidas)) raices_resp <- lapply(raices_resp, function(r) r[!names(r) %in% dic$excluidas])

  sel <- lapply(seq_along(textos_resp), function(k) {
    if (no_resp[[k]]) return(list())
    rr <- raices_resp[[k]]
    puntajes <- Filter(Negate(is.null), lapply(seq_len(n), function(m) {
      comun <- intersect(names(rr), voc_mod[[m]])
      if (!length(comun)) return(NULL)
      w <- idf[comun]
      list(m = m, puntaje = sum(w), palabras = unname(rr[comun[order(-w, comun)]]))
    }))
    if (!length(puntajes)) return(list())
    p <- vapply(puntajes, `[[`, numeric(1), "puntaje")
    ok <- p >= min_puntaje & p >= rel_max * max(p)
    out <- puntajes[ok][order(-p[ok], vapply(puntajes[ok], `[[`, integer(1), "m"))]
    utils::head(out, max(1L, as.integer(max_propuestas)))
  })
  list(voc = voc_mod, sel = sel, vacias = vacias)
}

#' Propuesta de módulo para cada respuesta de `variable`
#'
#' Si un módulo se lleva más de la mitad de las respuestas con propuesta y tiene dos subtemas o más
#' (`.codif_ss_subtemas`), se parte: sus subtemas (hasta nueve, códigos `<módulo> + 1..9`, p. ej. 21–29 para el 20)
#' compiten con los demás módulos, que quedan en primer nivel. El módulo partido sigue en `modulos`, y cada subtema
#' trae `padre` (el código del módulo); sus propuestas, `padre` y `subtema`.
#'
#' @param inst instrumento (`leer_instrumento_xlsform`).
#' @param data_df base con la variable de texto.
#' @param variable nombre de la columna a codificar (p. ej. `coment`).
#' @param secciones grupos de primer nivel a usar como módulos; por defecto, los detectados.
#' @param diccionario diccionario de la pregunta (TXT-6/7, texto_abierto_diccionario.R): sus equivalencias unen formas
#'   en el comentario y en el vocabulario de los módulos; sus términos excluidos salen del vocabulario (uno de varias
#'   palabras, con sus palabras). Por defecto, ninguno.
#' @return lista con `modulos`, `otro`, `respuestas` (id_caso, texto, no_respuesta, candidato_otro, propuestas con
#'   codigo/seccion/etiqueta/puntaje/palabras) y `resumen`. Nunca trae asignaciones: `estado = "propuesta"`.
#' @keywords internal
codif_sugerir_seccion <- function(inst, data_df, variable, secciones = NULL, min_puntaje = 1, rel_max = 0.5,
                                  max_propuestas = 3L, diccionario = NULL) {
  variable <- trimws(as.character(variable %||% "")[1])
  if (is.na(variable) || !nzchar(variable)) {
    stop_api(400, "E_CODIF_SUGERIR_SIN_VARIABLE", "Falta la variable de texto a codificar.")
  }
  if (!is.data.frame(data_df) || !variable %in% names(data_df)) {
    stop_api(404, "E_CODIF_SUGERIR_VARIABLE_NO_EXISTE", sprintf("La base no tiene la variable '%s'.", variable))
  }
  tm <- .codif_ss_textos_modulo(inst, variable)
  mods <- .codif_ss_elegir_modulos(tm, secciones)
  if (!length(mods)) {
    stop_api(422, "E_CODIF_SUGERIR_SIN_SECCIONES",
             "El formulario no tiene grupos de primer nivel con preguntas para proponer un módulo.")
  }
  codigos <- as.character(seq_along(mods) * 10L)
  codigo_otro <- if (length(mods) < 8L) "80" else as.character((length(mods) + 1L) * 10L)

  textos <- as.character(data_df[[variable]]); textos[is.na(textos)] <- ""
  filas <- which(nzchar(trimws(textos)))
  no_resp <- if (length(filas)) .txt_no_respuesta(textos[filas]) else logical(0)
  puntuar <- function(textos_unidad) {
    .codif_ss_puntuar(textos_unidad, textos[filas], no_resp, diccionario, min_puntaje, rel_max, max_propuestas)
  }

  # Unidades de primer nivel: un módulo cada una.
  unidades <- lapply(seq_along(mods), function(m) list(
    codigo = codigos[[m]], seccion = mods[[m]], etiqueta = unname(tm$etiquetas[[mods[[m]]]]), padre = NULL,
    textos = tm$textos[[mods[[m]]]]
  ))
  pz <- puntuar(lapply(unidades, `[[`, "textos"))

  # TXT-11b: el módulo que se lleva más de la mitad de las propuestas se parte en subtemas.
  con_prop1 <- sum(lengths(pz$sel) > 0L)
  partidos <- character(0)
  if (con_prop1 > 0L) {
    n_mod <- vapply(seq_along(mods), function(m) sum(vapply(pz$sel, function(s) any(vapply(s, `[[`, integer(1), "m") == m), logical(1))), integer(1))
    nuevas <- list()
    for (m in seq_along(mods)) {
      subs <- if (n_mod[[m]] * 2L > con_prop1) .codif_ss_subtemas(inst, mods[[m]], variable, unname(tm$etiquetas[[mods[[m]]]])) else list()
      if (length(subs) < 2L) { nuevas <- c(nuevas, unidades[m]); next }
      subs <- .codif_ss_fusionar_subtemas(subs, pz$vacias)
      partidos <- c(partidos, codigos[[m]])
      nuevas <- c(nuevas, lapply(seq_along(subs), function(j) list(
        codigo = as.character(as.integer(codigos[[m]]) + j), seccion = subs[[j]]$seccion,
        etiqueta = subs[[j]]$etiqueta, padre = codigos[[m]], textos = subs[[j]]$textos,
        etiqueta_completa = subs[[j]]$etiqueta_completa %||% subs[[j]]$etiqueta,
        etiqueta_corta = .codif_rotulo_corto_subtema(subs[[j]]$etiqueta_completa %||% subs[[j]]$etiqueta)
      )))
    }
    if (length(partidos)) { unidades <- nuevas; pz <- puntuar(lapply(unidades, `[[`, "textos")) }
  }

  respuestas <- lapply(seq_along(filas), function(k) {
    i <- filas[[k]]
    propuestas <- lapply(pz$sel[[k]], function(s) {
      u <- unidades[[s$m]]
      p <- list(codigo = u$codigo, seccion = u$seccion, etiqueta = u$etiqueta,
                puntaje = round(s$puntaje, 2), palabras = as.list(s$palabras))
      if (!is.null(u$padre)) {
        p$padre <- u$padre; p$subtema <- u$codigo
        p$etiqueta_completa <- u$etiqueta_completa; p$etiqueta_corta <- u$etiqueta_corta   # TXT-20
      }
      p
    })
    list(
      id_caso = .codif_matrix_case_id_for_row(data_df, i), fila = i, texto = textos[[i]],
      no_respuesta = isTRUE(no_resp[[k]]),
      candidato_otro = !isTRUE(no_resp[[k]]) && !length(propuestas),
      propuestas = propuestas
    )
  })

  # Lista de módulos: los de primer nivel y, tras un módulo partido, sus subtemas con `padre`.
  n_terminos <- stats::setNames(lengths(pz$voc), vapply(unidades, `[[`, "", "codigo"))
  modulos <- list()
  for (m in seq_along(mods)) {
    modulos[[length(modulos) + 1L]] <- list(
      codigo = codigos[[m]], seccion = mods[[m]], etiqueta = unname(tm$etiquetas[[mods[[m]]]]),
      n_terminos = if (codigos[[m]] %in% names(n_terminos)) unname(n_terminos[[codigos[[m]]]]) else
        sum(n_terminos[vapply(unidades, function(u) identical(u$padre, codigos[[m]]), logical(1))])
    )
    for (u in Filter(function(u) identical(u$padre, codigos[[m]]), unidades)) {
      modulos[[length(modulos) + 1L]] <- list(codigo = u$codigo, seccion = u$seccion, etiqueta = u$etiqueta,
                                              etiqueta_completa = u$etiqueta_completa, etiqueta_corta = u$etiqueta_corta,
                                              padre = u$padre, n_terminos = unname(n_terminos[[u$codigo]]))
    }
  }

  con_prop <- vapply(respuestas, function(r) length(r$propuestas) > 0L, logical(1))
  todos <- vapply(modulos, `[[`, "", "codigo")
  por_modulo <- stats::setNames(lapply(todos, function(cd) {
    sum(vapply(respuestas, function(r) any(vapply(r$propuestas, function(p) identical(p$codigo, cd) || identical(p$padre, cd), logical(1))), logical(1)))
  }), todos)
  list(
    variable = variable,
    estado = "propuesta",
    requiere_confirmacion = TRUE,
    modulos = modulos,
    otro = list(codigo = codigo_otro, etiqueta = "Otro"),
    respuestas = respuestas,
    resumen = list(
      escribieron = length(filas),
      con_contenido = sum(!no_resp),
      con_propuesta = sum(con_prop),
      candidatos_otro = sum(vapply(respuestas, `[[`, logical(1), "candidato_otro")),
      por_modulo = lapply(por_modulo, as.integer),
      partidos = as.list(partidos)
    )
  )
}
