# Señales de calidad en respuestas de texto abierto.
#
# **Es material para leer, no un veredicto.** Las señales ordenan por dónde
# empezar a mirar; quién invalida es una persona. Esa distincion manda sobre
# todo el diseño: por eso no hay una puntuacion agregada ni un «sospechoso
# si/no» por respuesta.
#
# La leccion que ordeno el archivo salio de medir `acnur_pdm` (1 610 respuestas
# abiertas en 15 preguntas): **una señal solo significa algo contra su propia
# pregunta**. En `Enumerator_name` el 99 % de las respuestas se repiten —es el
# nombre del encuestador— y en `telephone` el 100 % es una sola palabra. Las
# mismas dos señales que ahi no dicen nada, en `recomendation` marcan el 55 % y
# el 44 % sobre respuestas de contenido. Aplicarlas en absoluto llenaria la
# pantalla de falsos positivos en los campos donde repetir es lo correcto.
#
# **Señal descartada, con su cifra**: «teclado seguido» (asdf, qwer, 1234…)
# marca **0 de las 1 610** respuestas. No entra: una señal que no distingue
# nada solo añade ruido al lector.

# Relleno es lo que ocupa el campo SIN DECIR NADA. La distincion con la lista de
# abajo salio de medir: en `recomendation` de acnur_pdm, meter «no» y «ninguno»
# aqui daba un 33 % de «relleno» que en realidad era gente contestando que no
# tenia recomendaciones —«NO» repetido 38 veces—. Es la trampa de una palabra
# para dos cosas: un «no» en «¿algo que añadir?» es una respuesta, y un «.» en
# la misma pregunta es un campo obligatorio esquivado.
MONITOREO_TEXTO_RELLENO <- c(
  ".", "-", "_", "x", "xx", "xxx", "na", "n/a", "s/n", "0", "00"
)

# Decir que no hay nada que decir NO es mala calidad. Se cuenta aparte porque
# explica por que una pregunta abierta trae poco contenido, que es informacion
# distinta de que se la esten saltando.
MONITOREO_TEXTO_NEGATIVA <- c(
  "no", "ninguno", "ninguna", "nada", "no hay", "no tengo", "nunca",
  "sin comentario", "sin comentarios", "no aplica", "ns", "nc"
)

#' Señales por respuesta de una pregunta abierta
#'
#' @param respuestas Vector de texto de UNA pregunta.
#' @return `data.frame` con una fila por respuesta contestada.
monitoreo_texto_senales <- function(respuestas) {
  v <- trimws(as.character(respuestas))
  v[is.na(v)] <- ""
  idx <- which(nzchar(v))
  if (!length(idx)) {
    return(data.frame(
      fila = integer(0), texto = character(0), largo = integer(0),
      palabras = integer(0), relleno = logical(0), negativa = logical(0),
      repeticiones = integer(0),
      stringsAsFactors = FALSE
    ))
  }
  con <- v[idx]
  normal <- tolower(gsub("[[:space:]]+", " ", con))
  conteo <- table(normal)
  data.frame(
    fila = idx,
    texto = con,
    largo = nchar(con),
    palabras = lengths(strsplit(normal, " +")),
    # Relleno es lo que ocupa el campo sin decir nada. Se compara con la lista
    # y tambien con el texto sin puntuacion: «...» y «.» son lo mismo.
    relleno = normal %in% MONITOREO_TEXTO_RELLENO |
      !nzchar(gsub("[[:punct:][:space:]]", "", normal)),
    negativa = normal %in% MONITOREO_TEXTO_NEGATIVA,
    repeticiones = as.integer(conteo[normal]),
    stringsAsFactors = FALSE
  )
}

#' Como se comporta una pregunta abierta en conjunto
#'
#' Es lo que permite leer las señales de cada respuesta: una tasa de repeticion
#' del 55 % en una pregunta de contenido merece mirarse; en un campo de nombre
#' de encuestador es lo esperable.
monitoreo_texto_perfil <- function(respuestas, etiqueta = "") {
  s <- monitoreo_texto_senales(respuestas)
  n <- nrow(s)
  tasa <- function(x) if (n) round(100 * sum(x) / n, 1) else NA_real_
  list(
    etiqueta = etiqueta,
    contestadas = n,
    sin_contestar = length(respuestas) - n,
    distintas = if (n) length(unique(tolower(s$texto))) else 0L,
    largo_mediano = if (n) stats::median(s$largo) else NA_real_,
    pct_relleno = tasa(s$relleno),
    pct_negativa = tasa(s$negativa),
    pct_una_palabra = tasa(s$palabras <= 1),
    pct_repetida = tasa(s$repeticiones > 1),
    pct_muy_corta = tasa(s$largo < 4)
  )
}

#' Respuestas que conviene leer primero
#'
#' Ordena por lo que la propia pregunta hace raro: primero el relleno, despues
#' lo mas corto, y entre iguales lo que mas se repite. **No filtra nada**: el
#' lector ve todas y decide.
monitoreo_texto_orden_de_lectura <- function(respuestas) {
  s <- monitoreo_texto_senales(respuestas)
  if (!nrow(s)) return(s)
  s[order(!s$relleno, s$largo, -s$repeticiones), , drop = FALSE]
}

# Nombres de variable que son identificadores, no respuestas que leer. Se
# excluyen del visualizador por dos motivos: no aportan calidad de contenido y
# suelen traer datos personales —`Enumerator_name` y `telephone` de acnur_pdm
# son exactamente eso—.
#
# **Se declara siempre cuales se excluyeron.** Un filtro por nombre puede
# equivocarse —una pregunta «¿como se llama el programa?» casaria `name`— y ya
# paso una vez con el filtro de identificadores del mazo, que se comio cinco
# preguntas cerradas de 125 en silencio. Si se ve la lista, el error se corrige;
# si se descarta callando, no.
# Los patrones van anclados al nombre COMPLETO. Sin anclar, `^cod(e|igo)`
# excluia `codigo_postal_why`, que es una pregunta de contenido: lo cazo el
# propio test que escribi para comprobar que no habia falsos positivos.
MONITOREO_TEXTO_IDENTIFICADOR <- paste(
  "^(pulso_)?cod(e|igo)(_pulso)?$", "^enumerator(_name)?$",
  "^encuestador(_nombre)?$", "^telephone$", "^telefono$", "^celular$",
  "^dni$", "^email$", "^correo$", "^ump$",
  sep = "|"
)

#' Que preguntas de un instrumento son de texto abierto
#'
#' La fuente es el instrumento y no la base: contar columnas de tipo caracter da
#' codigos, GPS, fechas y selects. Medido —contra el instrumento, `acnur_acg`
#' tiene 4 preguntas `text` y `acnur_pdm` 18; contando columnas caracter salian
#' «~22» y «~14»—.
#'
#' **Sin instrumento no se adivina.** Una heuristica sobre la base marcaba como
#' abiertas las coordenadas GPS y la fecha de Kobo.
#'
#' @param survey Hoja `survey` del instrumento, con `type` y `name`.
#' @param columnas Nombres de columna de la base.
#' @return Lista con `disponible`, `motivo`, `preguntas` y `excluidas`.
monitoreo_texto_preguntas <- function(survey = NULL, columnas = character(0)) {
  vacio <- function(motivo) list(
    disponible = FALSE, motivo = motivo,
    preguntas = list(), excluidas = list()
  )
  if (is.null(survey) || !NROW(survey)) {
    return(vacio("Este estudio no trae instrumento, asi que no se sabe que preguntas son abiertas."))
  }
  col_tipo <- grep("^type$", names(survey), ignore.case = TRUE)[1]
  col_nom <- grep("^name$", names(survey), ignore.case = TRUE)[1]
  if (is.na(col_tipo) || is.na(col_nom)) {
    return(vacio("El instrumento no declara tipo y nombre de sus preguntas."))
  }
  col_lab <- grep("^label", names(survey), ignore.case = TRUE)[1]
  tipo <- trimws(as.character(survey[[col_tipo]]))
  nombre <- as.character(survey[[col_nom]])
  etiqueta <- if (is.na(col_lab)) nombre else as.character(survey[[col_lab]])
  abiertas <- which(tipo == "text" & !is.na(nombre) & nzchar(nombre))
  if (!length(abiertas)) {
    return(vacio("El instrumento de este estudio no tiene ni una pregunta de texto abierto."))
  }

  # La columna puede venir con el prefijo del grupo (`D/D1_information_text`).
  en_la_base <- function(n) {
    hit <- columnas[columnas == n | endsWith(columnas, paste0("/", n))]
    if (length(hit)) hit[1] else NA_character_
  }

  preguntas <- list()
  excluidas <- list()
  for (i in abiertas) {
    col <- en_la_base(nombre[i])
    fila <- list(
      variable = nombre[i],
      columna = col,
      etiqueta = trimws(gsub("[[:space:]]+", " ", etiqueta[i] %||% nombre[i]))
    )
    if (grepl(MONITOREO_TEXTO_IDENTIFICADOR, nombre[i], ignore.case = TRUE)) {
      fila$motivo <- "Es un identificador, no una respuesta que leer."
      excluidas[[length(excluidas) + 1L]] <- fila
    } else if (is.na(col)) {
      fila$motivo <- "El instrumento la declara pero la base no trae su columna."
      excluidas[[length(excluidas) + 1L]] <- fila
    } else {
      preguntas[[length(preguntas) + 1L]] <- fila
    }
  }
  list(
    disponible = length(preguntas) > 0L,
    motivo = if (length(preguntas)) "" else
      "Las preguntas abiertas del instrumento son identificadores o no estan en la base.",
    preguntas = preguntas,
    excluidas = excluidas
  )
}

#' Bloque de texto abierto para el payload de un perfil de Monitoreo
#'
#' Contesta siempre, igual que el de tiempos: sin instrumento devuelve
#' `disponible = FALSE` con el motivo, para que la vista lo diga en vez de
#' desaparecer.
#'
#' Por cada pregunta viaja su **perfil** —lo que esa pregunta hace en conjunto—
#' junto a las respuestas en orden de lectura. El perfil no es decoracion: es lo
#' que permite saber si una señal significa algo ahi. Un 99 % de repeticion en
#' el nombre del encuestador es lo esperable; el mismo 99 % en «¿por que?» no.
#'
#' @param por_pregunta Cuantas respuestas se mandan de cada pregunta.
monitoreo_texto_abierto_payload <- function(responses = data.frame(),
                                            survey = NULL,
                                            por_pregunta = 60L) {
  hallazgo <- monitoreo_texto_preguntas(survey, names(responses))
  base <- list(
    disponible = isTRUE(hallazgo$disponible),
    motivo = hallazgo$motivo,
    excluidas = hallazgo$excluidas,
    preguntas = list()
  )
  if (!base$disponible) return(base)

  base$preguntas <- lapply(hallazgo$preguntas, function(p) {
    v <- responses[[p$columna]]
    perfil <- monitoreo_texto_perfil(v, p$etiqueta)
    orden <- monitoreo_texto_orden_de_lectura(v)
    cuantas <- min(nrow(orden), por_pregunta)
    list(
      variable = p$variable,
      etiqueta = p$etiqueta,
      perfil = perfil,
      # `mostradas` y `contestadas` viajan por separado a proposito: una lista
      # recortada sin decir cuanto se recorto se lee como si fuera todo.
      mostradas = cuantas,
      respuestas = if (cuantas) lapply(seq_len(cuantas), function(i) list(
        fila = orden$fila[i],
        texto = orden$texto[i],
        largo = orden$largo[i],
        relleno = orden$relleno[i],
        negativa = orden$negativa[i],
        repeticiones = orden$repeticiones[i]
      )) else list()
    )
  })
  base
}

#' Banda de una proporcion (Wilson)
#'
#' La banda de una mediana sale de los ordenes estadisticos
#' (`monitoreo_tiempos_banda_mediana`); la de una tasa, no. Aqui va el intervalo
#' de Wilson, que se porta bien con pocos casos y con tasas pegadas a 0 o a 1
#' —justo lo que pasa aqui: la mitad de los aplicadores tienen 0 % de relleno—.
#' Lo que se comparte entre las dos es el criterio, no la formula: **destaca
#' quien no alcanza a lo que hace el resto**.
monitoreo_banda_proporcion <- function(exitos, n, conf = 0.95) {
  if (!is.finite(n) || n <= 0) return(list(inferior = NA_real_, superior = NA_real_))
  z <- stats::qnorm(1 - (1 - conf) / 2)
  p <- exitos / n
  d <- 1 + z^2 / n
  centro <- p + z^2 / (2 * n)
  radio <- z * sqrt(p * (1 - p) / n + z^2 / (4 * n^2))
  list(
    inferior = max(0, (centro - radio) / d),
    superior = min(1, (centro + radio) / d)
  )
}

#' Nombres que son el mismo nombre
#'
#' Medido en acnur_pdm: sus 19 aplicadores nominales son **16**. «JORGE DEL
#' SOLAR» convive con «JORGE  DEL SOLAR» (dos espacios) y «Silbia Cruzado» con
#' «silbia cruzado». Sin unirlos, tres aplicadores aparecen partidos y con un
#' solo caso, y un grupo de uno no dice nada de nadie.
#'
#' **Solo se unen mayusculas y espacios, que es seguro.** «MARTHA VILANUEVA»
#' —sin una L— NO se une a «MARTHA VILLANUEVA»: parecerse no es ser, y fusionar
#' por parecido inventaria datos. Ese caso se reconoce por quedarse en un solo
#' registro, y por eso `n` viaja siempre al lado de la tasa.
monitoreo_texto_normaliza_grupo <- function(grupo) {
  g <- trimws(gsub("[[:space:]]+", " ", as.character(grupo)))
  clave <- toupper(g)
  # La forma que se muestra es la mas frecuente, no la primera que aparezca.
  visible <- vapply(split(g, clave), function(v) names(sort(table(v), decreasing = TRUE))[1], "")
  # Se cuenta contra el texto CRUDO: si se contara contra `g`, las variantes que
  # solo difieren en espacios ya estarian unidas y la cuenta diria menos de las
  # que hubo. Medido: en acnur_pdm son 2 fusiones y contando mal salia 1.
  crudos <- unique(as.character(grupo)[nzchar(trimws(as.character(grupo)))])
  list(clave = clave, visible = unname(visible[clave]),
       fusionados = length(crudos) - length(unique(clave[nzchar(clave)])))
}

#' Señales de texto abierto agregadas por grupo
#'
#' @param respuestas Texto de UNA pregunta.
#' @param grupo Quien o donde, una entrada por respuesta.
#' @param senal `"relleno"` o `"negativa"`.
monitoreo_texto_por_grupo <- function(respuestas, grupo, senal = "relleno",
                                      conf = 0.95, minimo_n = 5) {
  s <- monitoreo_texto_senales(respuestas)
  vacia <- data.frame(
    grupo = character(0), n = integer(0), n_bajo = logical(0), marcadas = integer(0),
    tasa = numeric(0), banda_inf = numeric(0), banda_sup = numeric(0),
    tasa_resto = numeric(0), destaca = logical(0), stringsAsFactors = FALSE
  )
  if (!nrow(s)) return(vacia)
  if (!senal %in% names(s)) stop("`senal` tiene que ser una de las que produce monitoreo_texto_senales()")
  g <- monitoreo_texto_normaliza_grupo(grupo)
  marca <- s[[senal]]
  clave <- g$clave[s$fila]
  visible <- g$visible[s$fila]
  vale <- !is.na(clave) & nzchar(clave)
  if (!any(vale)) return(vacia)
  marca <- marca[vale]; clave <- clave[vale]; visible <- visible[vale]

  filas <- lapply(sort(unique(clave)), function(k) {
    dentro <- marca[clave == k]
    fuera <- marca[clave != k]
    n <- length(dentro)
    banda <- if (n >= minimo_n) monitoreo_banda_proporcion(sum(dentro), n, conf) else
      list(inferior = NA_real_, superior = NA_real_)
    resto <- if (length(fuera)) mean(fuera) else NA_real_
    data.frame(
      grupo = visible[clave == k][1],
      n = n,
      n_bajo = n < minimo_n,
      marcadas = sum(dentro),
      tasa = round(100 * mean(dentro), 1),
      banda_inf = round(100 * banda$inferior, 1),
      banda_sup = round(100 * banda$superior, 1),
      tasa_resto = if (is.finite(resto)) round(100 * resto, 1) else NA_real_,
      destaca = is.finite(banda$inferior) && is.finite(resto) &&
        (100 * resto < round(100 * banda$inferior, 1) || 100 * resto > round(100 * banda$superior, 1)),
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, filas)
  # Los grupos sin banda van al final aunque su tasa sea la mas alta: un 100 %
  # sobre un caso encabezando la lista se lee como «el peor», y no dice nada.
  out[order(out$n_bajo, -out$tasa, -out$n), , drop = FALSE]
}
