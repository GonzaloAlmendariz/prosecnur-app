# =============================================================================
# Monitoreo — qué se está escribiendo en las preguntas abiertas
# =============================================================================
# Hoy la app MUESTRA las respuestas abiertas y es el analista quien descubre,
# leyendo, que alguien escribió cualquier cosa. Y las descubre en Codificación,
# cuando el campo ya cerró. Es la misma inversión que el resto del GOAL de
# calidad de campo: mostrar es tarde, alertar es a tiempo.
#
# Dos decisiones tomadas con medición, no por gusto:
#
# 1. QUÉ PREGUNTAS SE VIGILAN. Por defecto, solo las que dependen de una
#    pregunta anterior —el «otro, especifique»—, que son de contenido por
#    construcción. En un estudio real son 18 de 24 preguntas de texto. Las
#    independientes se suman DECLARÁNDOLAS, porque inferirlas destruye la
#    señal: un detector aplicado a todo campo `text` marcó 103 de 104 teléfonos
#    como basura, ya que no tienen letras. El código de caso, el teléfono y el
#    nombre del encuestador son captura operativa y el instrumento no los
#    distingue del texto de contenido.
#
# 2. QUÉ CUENTA COMO «NO DICE NADA». Se probaron varias señales sobre las 69
#    respuestas reales de ese estudio. La adyacencia de teclado marcaba 10 —casi
#    todas frases legítimas, porque cualquier texto contiene pares de teclas
#    vecinas— y quedó descartada. Lo que se conserva marca exactamente 1: el
#    `hjk` que hoy nadie ve hasta Codificación.
#
# Doc vivo: docs/qa/goal-monitoreo-calidad-campo-2026-08-13.md
# =============================================================================

.MAB_VOCALES <- "[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]"
# Cinco consonantes seguidas dentro de una palabra. El español no llega a esa
# racha —«abstracto» y «obstrucción» se quedan en cuatro— y un manotazo de
# teclado la cruza sin esfuerzo.
.MAB_RACHA_CONSONANTES <- "[b-df-hj-np-tv-zBCDFGHJ-NP-TV-Z]{5,}"

#' Por qué una respuesta abierta no dice nada
#'
#' Devuelve el motivo por respuesta, o `""` cuando la respuesta parece real. Es
#' deliberadamente conservador: prefiere dejar pasar basura antes que sospechar
#' de una respuesta legítima, porque el aviso interrumpe a alguien que está
#' trabajando.
#'
#' Límite conocido y medido: un manotazo que resulta pronunciable (`qwertyuiop`
#' tiene vocales y no encadena consonantes) no se detecta. Y un acrónimo sin
#' vocales —`RH`, `PC`— se marca aunque sea una respuesta válida. Con avisos de
#' advertencia, ese cambio cuesta una mirada; el caso contrario cuesta un caso.
#'
#' @param x vector de respuestas.
#' @return vector de motivos, del mismo largo que `x`.
#' @family monitoreo
#' @export
abierta_motivo_vacia <- function(x) {
  v <- trimws(as.character(x))
  v[is.na(v)] <- ""
  out <- rep("", length(v))
  hay <- nzchar(v) & v != "NA"

  tiene_letras <- grepl("[[:alpha:]]", v)
  # Orden de prioridad: el motivo más específico gana, para que el mensaje
  # nombre lo que realmente pasa.
  out[hay & nchar(v) == 1L] <- "un_caracter"
  out[hay & out == "" & grepl("^(.)\\1{2,}$", v)] <- "caracter_repetido"
  out[hay & out == "" & !tiene_letras] <- "sin_letras"
  out[hay & out == "" & tiene_letras & !grepl(.MAB_VOCALES, v)] <- "sin_vocales"
  out[hay & out == "" & grepl(.MAB_RACHA_CONSONANTES, v)] <- "tecleo"
  out
}

.mab_explica <- function(motivo) {
  switch(motivo,
    un_caracter = "es una sola letra",
    caracter_repetido = "es un carácter repetido",
    sin_letras = "no tiene ni una letra",
    sin_vocales = "no tiene ninguna vocal",
    tecleo = "encadena consonantes que ninguna palabra tiene",
    "no parece una respuesta")
}

#' Preguntas abiertas que se vigilan en un estudio
#'
#' Las dependientes salen del instrumento —una pregunta de texto con `relevant`
#' es el «otro, especifique»— y las declaradas salen de
#' `operational_config$abiertas`. Ninguna se adivina por nombre de columna.
#'
#' @param data data.frame de la base recolectada.
#' @param survey hoja `survey` del instrumento.
#' @param declaradas variables extra que el estudio quiere vigilar.
#' @return data.frame con `variable`, `origen` (`dependiente`/`declarada`) y
#'   `etiqueta`.
#' @family monitoreo
#' @export
abiertas_vigiladas <- function(data, survey = NULL, declaradas = character(0)) {
  vacio <- data.frame(variable = character(0), origen = character(0),
                      etiqueta = character(0), stringsAsFactors = FALSE)
  if (!is.data.frame(data) || !nrow(data)) return(vacio)
  declaradas <- as.character(unlist(declaradas %||% character(0)))
  declaradas <- unique(declaradas[nzchar(declaradas) & declaradas %in% names(data)])

  dep <- character(0)
  etiquetas <- character(0)
  if (is.data.frame(survey) && nrow(survey) && "name" %in% names(survey)) {
    tipo <- if ("type_base" %in% names(survey)) as.character(survey$type_base) else {
      sub("\\s.*$", "", as.character(survey$type %||% ""))
    }
    rel_col <- grep("^relevant", names(survey), value = TRUE)[1]
    rel <- if (!is.na(rel_col)) as.character(survey[[rel_col]]) else rep(NA_character_, nrow(survey))
    rel[is.na(rel)] <- ""
    nombre <- as.character(survey$name)
    lab_col <- .semilla_label_col(survey)
    lab <- if (!is.na(lab_col)) as.character(survey[[lab_col]]) else rep("", nrow(survey))
    lab[is.na(lab)] <- ""

    ok <- !is.na(tipo) & tipo == "text" & !is.na(nombre) & nombre %in% names(data)
    dep <- unique(nombre[ok & nzchar(trimws(rel))])
    etiquetas <- setNames(lab[ok], nombre[ok])
  }
  # Una variable declarada a mano manda sobre su clasificación automática: si
  # alguien la declaró, es porque la quiere vigilar.
  declaradas <- setdiff(declaradas, dep)
  vars <- c(dep, declaradas)
  if (!length(vars)) return(vacio)
  data.frame(
    variable = vars,
    origen = c(rep("dependiente", length(dep)), rep("declarada", length(declaradas))),
    etiqueta = unname(vapply(vars, function(v) as.character(etiquetas[[v]] %||% "")[1], character(1))),
    stringsAsFactors = FALSE
  )
}

#' Alertar sobre respuestas abiertas que no dicen nada
#'
#' Una alerta por pregunta —no por respuesta—: si un encuestador escribió tres
#' veces cualquier cosa en la misma pregunta, es un problema, no tres.
#'
#' @param data data.frame de la base recolectada.
#' @param survey hoja `survey` del instrumento.
#' @param agent_var variable del agente, para decir a quién llamar.
#' @param caso_var columna con la que nombrar cada encuesta.
#' @param declaradas variables abiertas extra declaradas por el estudio.
#' @return lista de alertas.
#' @family monitoreo
#' @export
monitoreo_alertas_abiertas <- function(data, survey = NULL, agent_var = "",
                                       caso_var = "", declaradas = character(0)) {
  vigiladas <- abiertas_vigiladas(data, survey, declaradas)
  if (!nrow(vigiladas)) return(list())

  agente <- if (nzchar(agent_var %||% "") && agent_var %in% names(data)) {
    .mcc_chr(data[[agent_var]])
  } else rep("", nrow(data))
  caso <- if (nzchar(caso_var %||% "") && caso_var %in% names(data)) {
    .mcc_chr(data[[caso_var]])
  } else as.character(seq_len(nrow(data)))

  out <- list()
  for (i in seq_len(nrow(vigiladas))) {
    v <- vigiladas$variable[i]
    valores <- .mcc_chr(data[[v]])
    motivos <- abierta_motivo_vacia(valores)
    idx <- which(nzchar(motivos))
    if (!length(idx)) next
    n_respondidas <- sum(nzchar(valores) & valores != "NA")

    quienes <- unique(agente[idx][nzchar(agente[idx])])
    # Etiqueta primero y código entre paréntesis: el analista lee la pregunta,
    # no el nombre de la columna.
    nombre <- if (nzchar(vigiladas$etiqueta[i])) {
      sprintf("%s (%s)", trimws(vigiladas$etiqueta[i]), v)
    } else v

    ejemplos <- unique(valores[idx])
    mensaje <- sprintf(
      "En «%s» hay %d de %d respuestas que no dicen nada: %s. %s",
      nombre, length(idx), n_respondidas,
      paste(sprintf("«%s» (%s)", utils::head(ejemplos, 3),
                    vapply(utils::head(motivos[idx], 3), .mab_explica, character(1))),
            collapse = ", "),
      if (length(quienes) == 1L) {
        sprintf("Todas las escribió %s.", quienes)
      } else if (length(quienes) > 1L) {
        sprintf("Las escribieron %s.", paste(quienes, collapse = " y "))
      } else ""
    )
    pregunta <- if (length(quienes) == 1L) sprintf(
      "¿Qué le respondieron a %s en esa pregunta? Mientras el caso esté fresco todavía se puede recuperar; en Codificación ya no.",
      quienes[1]
    ) else paste(
      "¿Qué respondieron realmente en esa pregunta? Mientras los casos estén",
      "frescos todavía se pueden recuperar; en Codificación ya no."
    )

    out[[length(out) + 1L]] <- list(
      severidad = "advertencia",
      componente_id = NA_character_,
      actor = if (length(quienes) == 1L) quienes[1] else "",
      tipo = "abierta_sin_contenido",
      mensaje = trimws(mensaje),
      detalle = list(
        variable = v,
        etiqueta = vigiladas$etiqueta[i],
        # De dónde salió que esta pregunta se vigila: del instrumento o de una
        # declaración del estudio. Sin esto no se sabe por qué aparece.
        origen = vigiladas$origen[i],
        n_dudosas = length(idx),
        n_respondidas = as.integer(n_respondidas),
        casos = caso[idx],
        valores = valores[idx],
        motivos = unname(motivos[idx]),
        agentes = quienes,
        pregunta = pregunta
      )
    )
  }
  # La pregunta con más respuestas vacías primero.
  if (!length(out)) return(out)
  out[order(-vapply(out, function(x) x$detalle$n_dudosas, numeric(1)))]
}

#' Proponer qué preguntas abiertas independientes son de contenido
#'
#' Las que dependen de otra pregunta ya se vigilan solas. Estas son las que
#' quedan, y entre ellas conviven texto de contenido y captura operativa
#' (códigos, teléfonos, nombres). La app perfila cada una y dice qué encontró;
#' decidir es del analista, porque declarar mal una operativa alertaría en
#' **cada caso de la base**.
#'
#' @param data data.frame de la base recolectada.
#' @param survey hoja `survey` del instrumento.
#' @param roles_declarados variables que ya cumplen otro rol en el estudio (el
#'   agente, las llaves de identidad). Se excluyen: el estudio ya dijo qué son,
#'   y volver a ofrecerlas como respuesta abierta sería contradecirlo. Medido:
#'   sin esto, el nombre del encuestador —2,2 palabras y repetido entre casos—
#'   se propone como texto de contenido.
#' @return lista de candidatas con su evidencia.
#' @family monitoreo
#' @export
abiertas_candidatas <- function(data, survey = NULL, roles_declarados = character(0)) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  roles_declarados <- as.character(unlist(roles_declarados %||% character(0)))
  if (!is.data.frame(survey) || !nrow(survey) || !("name" %in% names(survey))) return(list())
  tipo <- if ("type_base" %in% names(survey)) as.character(survey$type_base) else {
    sub("\\s.*$", "", as.character(survey$type %||% ""))
  }
  rel_col <- grep("^relevant", names(survey), value = TRUE)[1]
  rel <- if (!is.na(rel_col)) as.character(survey[[rel_col]]) else rep("", nrow(survey))
  rel[is.na(rel)] <- ""
  nombre <- as.character(survey$name)
  lab_col <- .semilla_label_col(survey)
  lab <- if (!is.na(lab_col)) as.character(survey[[lab_col]]) else rep("", nrow(survey))
  lab[is.na(lab)] <- ""

  ok <- !is.na(tipo) & tipo == "text" & !is.na(nombre) & nombre %in% names(data) &
    !nzchar(trimws(rel)) & !(nombre %in% roles_declarados)
  out <- list()
  for (i in which(ok)) {
    v <- .mcc_chr(data[[nombre[i]]])
    v <- v[nzchar(v) & v != "NA"]
    if (!length(v)) next
    solo_numeros <- mean(grepl("^[0-9 .+-]+$", v))
    palabras <- mean(lengths(strsplit(v, "\\s+")))
    unicidad <- length(unique(v)) / length(v)

    # Un valor por caso y de una sola palabra es la firma de un identificador;
    # varias palabras es la firma de una respuesta. Ninguna de las dos es
    # concluyente, y por eso la evidencia va visible y la decisión es del
    # analista.
    operativa <- solo_numeros > 0.5 || (palabras < 2 && unicidad > 0.9)
    out[[length(out) + 1L]] <- list(
      variable = nombre[i],
      etiqueta = trimws(lab[i]),
      n_respuestas = length(v),
      palabras_promedio = round(palabras, 1),
      probable_operativa = operativa,
      porque = if (operativa) sprintf(
        "Un valor distinto casi por caso y de %s. Parece captura operativa —un código, un teléfono, un nombre—, no una respuesta.",
        if (solo_numeros > 0.5) "puros números" else "una sola palabra"
      ) else sprintf(
        "Respuestas de %.1f palabras en promedio y repetidas entre casos. Parece texto de contenido.",
        palabras
      ),
      ejemplos = as.list(utils::head(unique(v), 2))
    )
  }
  # Primero lo que parece contenido: es lo que el analista está buscando.
  if (!length(out)) return(out)
  out[order(vapply(out, function(x) isTRUE(x$probable_operativa), logical(1)))]
}
