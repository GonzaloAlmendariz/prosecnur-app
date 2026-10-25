# Sugerencia de módulo del instrumento para un comentario abierto (TXT-3, plan-texto-abierto-ccss-2026-10-24).
#
# Contrato:
#   - Es una PROPUESTA. El motor no escribe grupos ni matrix_cases: el analista confirma en Codificación, igual que
#     en el flujo híbrido de abiertas. Por eso es una función pura sobre (inst, data_df).
#   - Un código por módulo, por decena en el orden del formulario (10, 20, 30…), y «otro» = 80. Sin jerarquía.
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
  "vida", "gran", "nuevo", "nueva", "posible", "cualquier", "persona", "gente", "hola", "aspecto", "aspectos"
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
    txt <- .codif_var_label(inst, nm, "")
    # Una lista de opciones que usan tres preguntas o más es una escala (acuerdo, frecuencia): no describe el módulo.
    if (base_tipo[i] %in% c("select_one", "select_multiple") && nzchar(lista[i]) && usos_lista[[lista[i]]] < 3L) {
      txt <- c(txt, unname(as.character(.choices_lookup(inst, lista[i]))))
    }
    textos[[mod]] <- c(textos[[mod]], txt)
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

#' Propuesta de módulo para cada respuesta de `variable`
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

  vacias <- unique(c(.txt_vacias_limpias(), .CODIF_SS_VACIAS_SUGERIR))
  tok_mod <- lapply(mods, function(g) unlist(.txt_tokens(tm$textos[[g]])))
  tok_resp <- .txt_tokens(textos[filas])
  voc <- unique(c(unlist(tok_mod), unlist(tok_resp)))
  contenido <- voc[nchar(voc, type = "chars") >= 3L & !.txt_sin_tildes(voc) %in% vacias]
  dic <- .codif_ss_diccionario(diccionario, tok_mod, tok_resp, contenido, vacias)
  tok_mod <- dic$tok_mod; tok_resp <- dic$tok_resp
  raiz <- if (length(voc)) .txt_raiz(voc, vocabulario = contenido, equivalencias = dic$mapa) else character(0)

  voc_mod <- lapply(.codif_ss_raices(lapply(tok_mod, identity), raiz, vacias), names)
  # Una raíz que está en todos los módulos no distingue ninguno (con tres módulos o más): se descarta.
  voc_mod <- lapply(voc_mod, function(v) v[!v %in% c(.CODIF_SS_VACIAS_SUGERIR, dic$excluidas)])
  df <- table(unlist(voc_mod))
  if (length(mods) >= 3L) {
    ubicuas <- names(df)[as.integer(df) >= length(mods)]
    voc_mod <- lapply(voc_mod, function(v) v[!v %in% ubicuas])
    df <- df[!names(df) %in% ubicuas]
  }
  idf <- log1p(length(mods) / as.numeric(df)); names(idf) <- names(df)
  raices_resp <- .codif_ss_raices(tok_resp, raiz, vacias)
  if (length(dic$excluidas)) raices_resp <- lapply(raices_resp, function(r) r[!names(r) %in% dic$excluidas])

  respuestas <- lapply(seq_along(filas), function(k) {
    i <- filas[[k]]
    propuestas <- list()
    if (!no_resp[[k]]) {
      rr <- raices_resp[[k]]
      puntajes <- lapply(seq_along(mods), function(m) {
        comun <- intersect(names(rr), voc_mod[[m]])
        if (!length(comun)) return(NULL)
        w <- idf[comun]
        o <- order(-w, comun)
        list(m = m, puntaje = sum(w), palabras = unname(rr[comun[o]]))
      })
      puntajes <- Filter(Negate(is.null), puntajes)
      if (length(puntajes)) {
        p <- vapply(puntajes, `[[`, numeric(1), "puntaje")
        tope <- max(p)
        ok <- p >= min_puntaje & p >= rel_max * tope
        sel <- puntajes[ok][order(-p[ok], vapply(puntajes[ok], `[[`, integer(1), "m"))]
        sel <- utils::head(sel, max(1L, as.integer(max_propuestas)))
        propuestas <- lapply(sel, function(s) list(
          codigo = codigos[[s$m]], seccion = mods[[s$m]], etiqueta = unname(tm$etiquetas[[mods[[s$m]]]]),
          puntaje = round(s$puntaje, 2), palabras = as.list(s$palabras)
        ))
      }
    }
    list(
      id_caso = .codif_matrix_case_id_for_row(data_df, i), fila = i, texto = textos[[i]],
      no_respuesta = isTRUE(no_resp[[k]]),
      candidato_otro = !isTRUE(no_resp[[k]]) && !length(propuestas),
      propuestas = propuestas
    )
  })

  con_prop <- vapply(respuestas, function(r) length(r$propuestas) > 0L, logical(1))
  por_modulo <- stats::setNames(lapply(codigos, function(cd) {
    sum(vapply(respuestas, function(r) any(vapply(r$propuestas, function(p) identical(p$codigo, cd), logical(1))), logical(1)))
  }), codigos)
  list(
    variable = variable,
    estado = "propuesta",
    requiere_confirmacion = TRUE,
    modulos = lapply(seq_along(mods), function(m) list(
      codigo = codigos[[m]], seccion = mods[[m]], etiqueta = unname(tm$etiquetas[[mods[[m]]]]),
      n_terminos = length(voc_mod[[m]])
    )),
    otro = list(codigo = codigo_otro, etiqueta = "Otro"),
    respuestas = respuestas,
    resumen = list(
      escribieron = length(filas),
      con_contenido = sum(!no_resp),
      con_propuesta = sum(con_prop),
      candidatos_otro = sum(vapply(respuestas, `[[`, logical(1), "candidato_otro")),
      por_modulo = lapply(por_modulo, as.integer)
    )
  )
}
