# La facultad del AULA contra la que el alumno DECLARA — control de calidad.
#
# Pedido de Gonzalo (2026-09-14, textual): «hasta ahora hemos estado midiendo el
# avance de las facultades por la facultad establecida en la base, pero no hemos
# hecho el control sobre lo que los alumnos reportan, no hemos cruzado ambas»;
# y sobre la forma: «me gustaría que quedara en una hoja del excel como control
# de calidad para tenerlo de referencia».
#
# **Qué compara y por qué importa.** El avance por facultad se cuenta con la
# facultad del curso-horario —la que el diseño le puso—, y las cuotas son por
# facultad. Pero en un curso de Estudios Generales o en un electivo se sienta
# gente de otras: esa respuesta suma a la cuota del aula, no a la de quien
# respondió. Medido sobre HSVG2026 el 2026-09-14: de 1.390 respuestas
# comparables, **80 (5,8 %) declaran otra facultad**; los cruces más gruesos son
# Arte y Diseño ↔ Arquitectura en los dos sentidos, y Estudios Generales hacia
# la facultad de destino.
#
# **Es un control, no una reatribución.** La hoja NO cambia ningún conteo: pone
# los dos lados al lado y deja ver el desacuerdo. Reatribuir es una decisión
# metodológica y tiene su propio sitio (`reatribuciones` del config).
#
# **El estudio DECLARA su variable**, igual que con el sexo: sin
# `source_mapping$faculty_var` esta hoja no se produce. Adivinar cuál de las
# preguntas es la facultad —«P7» aquí, otra cosa en el siguiente estudio— sería
# inventar el dato que el control existe para vigilar.

# **No confundir con `monitoreo_aulas_control_facultad.R`**, que es su vecino y
# hace otra cosa: aquél ADOSA la facultad del plan a las filas de «Base de
# control» —un dato que la hoja del equipo no trae—. Éste CRUZA esa facultad
# contra la que declara quien respondió. Uno completa, el otro vigila.

#' ¿Son la misma facultad dos nombres que llegan de sitios distintos?
#'
#' El marco abrevia («CIENCIAS Y ARTES DE LA COMUN.») y el cuestionario no
#' («…COMUNICACIÓN»). Comparar el texto entero daba 65 falsos desacuerdos en
#' HSVG2026, y recortar a un número fijo de letras fundía «ESTUDIOS GENERALES
#' LETRAS» con «…CIENCIAS», que son dos. Se acepta como igual sólo si una es
#' PREFIJO de la otra con al menos diez caracteres: es justo lo que distingue
#' una abreviatura de dos facultades distintas.
#'
#' @param a,b nombres de facultad.
#' @return `TRUE`, `FALSE`, o `NA` si falta alguno.
#' @keywords internal
.mcfd_misma_facultad <- function(a, b) {
  na <- .mcfd_norm(a); nb <- .mcfd_norm(b)
  if (!nzchar(na) || !nzchar(nb)) return(NA)
  if (identical(na, nb)) return(TRUE)
  n <- min(nchar(na), nchar(nb))
  n >= 10L && identical(substr(na, 1L, n), substr(nb, 1L, n))
}

# **La normalización se memoiza porque se pide miles de veces con quince
# valores.** `.mcfd_misma_facultad()` se evalúa fila a fila en ocho sitios sobre
# las respuestas comparables, y cada llamada normaliza sus dos nombres: sobre
# HSVG2026 son 2 769 filas, o sea más de cinco mil `iconv` + `gsub` para quince
# nombres de facultad distintos.
#
# Medido con `Rprof` el 2026-09-18: `.mcfd_misma_facultad` era el 89 % del
# tiempo del cruce y `.mcfd_norm` el 79 %, repartido entre `sub`, `gsub` e
# `iconv`. El cruce costaba 11,9 s y duplicaba el tablero entero.
#
# Es seguro: la función es PURA —un texto siempre da el mismo texto— así que la
# caché no puede devolver algo distinto de lo que se calcularía. El tope existe
# para que un uso con datos que no sean nombres de facultad no la haga crecer
# sin fin; al llegar, se vacía y se vuelve a llenar.
.MCFD_NORM_TOPE <- 4096L
.mcfd_norm_cache <- new.env(parent = emptyenv())

.mcfd_norm <- function(x) {
  crudo <- as.character(x %||% "")[1]
  # **El vacío no se cachea**: `assign("", ...)` es un error de R —«zero-length
  # variable name»— y el cruce llama con "" en cuanto una fila no trae facultad.
  # Lo cazó el contrato de la caché el mismo día que nació.
  if (is.na(crudo) || !nzchar(crudo)) return("")
  hit <- .mcfd_norm_cache[[crudo]]
  if (!is.null(hit)) return(hit)
  k <- toupper(trimws(crudo))
  k <- suppressWarnings(iconv(k, to = "ASCII//TRANSLIT"))
  out <- if (is.na(k)) "" else gsub("[^A-Z]", "", k)
  if (length(.mcfd_norm_cache) >= .MCFD_NORM_TOPE) {
    rm(list = ls(.mcfd_norm_cache, all.names = TRUE), envir = .mcfd_norm_cache)
  }
  assign(crudo, out, envir = .mcfd_norm_cache)
  out
}

#' El cruce entre la facultad del aula y la declarada por quien respondió.
#'
#' @param plan filas del plan.
#' @param responses `data.frame` de respuestas de la plataforma.
#' @param cfg config de aulas universitarias (`source_mapping$faculty_var` y,
#'   opcionalmente, `faculty_labels`: código declarado → nombre).
#' @param cuotas bloque `design_targets` de la config, para saber qué facultad
#'   cerraría por el aula y no por lo declarado. Sin él el bloque por sexo sale
#'   igual, sin la columna de meta.
#' @return lista `{ok, comparables, coinciden, discrepan, por_facultad,
#'   por_sexo, matriz, pares, sin_aula, sin_declarar}`; `ok = FALSE` cuando el estudio no declara su
#'   variable o no hay con qué cruzar.
#' @export
monitoreo_aulas_cruce_facultad_declarada <- function(plan, responses, cfg = list(),
                                                     cuotas = NULL) {
  vacio <- function(motivo = "") list(
    ok = FALSE, motivo = motivo, comparables = 0L, coinciden = 0L, discrepan = 0L,
    por_facultad = list(), por_sexo = list(), matriz = list(), pares = list(),
    sin_aula = 0L, sin_declarar = 0L)
  if (!length(plan) || !is.data.frame(responses) || !nrow(responses)) {
    return(vacio("sin plan o sin respuestas"))
  }
  mapping <- cfg[["source_mapping"]] %||% list()
  var_fac <- .monitoreo_scalar(mapping[["faculty_var"]] %||% "", "")
  if (!nzchar(var_fac)) return(vacio("el estudio no declara su variable de facultad"))
  # Mismo resolvedor que el resto del perfil: el prefijo de grupo de Kobo
  # (`datos_demo/P7`) no puede hacer que una variable bien declarada se lea
  # como ausente.
  var_fac <- monitoreo_aulas_columna_declarada(responses, var_fac)
  if (!nzchar(var_fac)) {
    return(vacio(sprintf(
      "la variable declarada («%s») no está en la base",
      .monitoreo_scalar(mapping[["faculty_var"]] %||% "", ""))))
  }

  # Código de aula → facultad del marco. Es la misma resolución que usa el
  # resto del perfil, no una propia: la respuesta se ata a su aula por el
  # `collector_var` declarado.
  aula <- .monitoreo_aulas_response_classroom(responses, cfg)
  valid <- .monitoreo_aulas_valid_response(responses, cfg)
  del_marco <- new.env(parent = emptyenv())
  unidades <- if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else plan
  for (u in unidades) {
    cod <- .monitoreo_scalar(u[["operational_code"]] %||% u[["classroom_id"]], "")
    if (nzchar(cod) && is.null(del_marco[[cod]])) {
      del_marco[[cod]] <- .monitoreo_scalar(u[["faculty"]], "")
    }
  }

  etiqueta <- .mcfd_etiquetas(mapping)
  crudo <- trimws(as.character(responses[[var_fac]]))
  declarada <- vapply(crudo, function(v) {
    if (is.na(v) || !nzchar(v)) return("")
    e <- etiqueta[[v]]
    if (is.null(e)) v else e
  }, character(1), USE.NAMES = FALSE)

  fac_aula <- vapply(as.character(aula), function(c) {
    v <- if (!is.na(c) && nzchar(c)) del_marco[[c]] else NULL
    if (is.null(v)) "" else v
  }, character(1), USE.NAMES = FALSE)

  # Sólo las válidas: una respuesta descartada no es un desacuerdo de campo.
  en_juego <- valid
  comparables <- en_juego & nzchar(fac_aula) & nzchar(declarada)
  if (!any(comparables)) return(vacio("ninguna respuesta tiene aula del plan y facultad declarada"))

  igual <- mapply(.mcfd_misma_facultad, fac_aula[comparables], declarada[comparables],
                  USE.NAMES = FALSE)
  igual[is.na(igual)] <- FALSE

  # **Si NADA coincide, lo que falla es la comparación, no el campo.** Se vio
  # generando el .xlsx de verdad en vez de mirar el motor: un estudio que
  # declara `faculty_var` pero no `faculty_labels` trae el código crudo («7»),
  # que no casa con ningún nombre del marco, y la hoja salía —bien formada,
  # sin fallar— diciendo «1.390 · 100,0 % DE OTRA FACULTAD». Un control que da
  # la alarma máxima porque está comparando un número contra un nombre es peor
  # que no tener control: se lee como una catástrofe de campo. Cero
  # coincidencias sobre cientos de comparables no ocurre en un operativo real;
  # ocurre cuando los dos lados hablan idiomas distintos.
  if (!any(igual)) {
    return(vacio(paste(
      "los dos lados no hablan el mismo idioma: ninguna de las",
      sum(comparables), "respuestas comparables casa con la facultad de su aula.",
      "Suele faltar `faculty_labels` (código declarado → nombre) en el mapping.")))
  }

  facs <- sort(unique(fac_aula[comparables]), method = "radix")
  por_facultad <- lapply(facs, function(f) {
    i <- .mcfd_norm(f) == vapply(fac_aula[comparables], .mcfd_norm, character(1),
                                 USE.NAMES = FALSE)
    # Declaradas: cuántas respuestas dicen SER de esta facultad, esté donde esté
    # el aula. Es el otro lado del control y lo que dice si la cuota se llena
    # por gente de fuera.
    j <- vapply(declarada[comparables], function(x) isTRUE(.mcfd_misma_facultad(x, f)),
                logical(1), USE.NAMES = FALSE)
    list(facultad = f, respuestas = sum(i), coinciden = sum(i & igual),
         discrepan = sum(i & !igual), declaradas = sum(j))
  })
  # Facultades que NADIE tiene como aula pero alguien declara: hoy son
  # invisibles en el avance por facultad, y es justo lo que hay que ver.
  solo_declaradas <- setdiff(
    unique(declarada[comparables]),
    unique(unlist(lapply(facs, function(f) {
      declarada[comparables][vapply(declarada[comparables], function(x)
        isTRUE(.mcfd_misma_facultad(x, f)), logical(1), USE.NAMES = FALSE)]
    })))
  )
  for (f in sort(solo_declaradas, method = "radix")) {
    j <- vapply(declarada[comparables], function(x) isTRUE(.mcfd_misma_facultad(x, f)),
                logical(1), USE.NAMES = FALSE)
    por_facultad[[length(por_facultad) + 1L]] <- list(
      facultad = f, respuestas = 0L, coinciden = 0L, discrepan = 0L,
      declaradas = sum(j))
  }
  # El nombre del MARCO manda cuando los dos lados nombran la misma facultad:
  # es el que usan las metas y el resto del libro.
  facs_canon <- c(facs, sort(solo_declaradas, method = "radix"))

  pares <- if (any(!igual)) {
    p <- paste(fac_aula[comparables][!igual], "→", declarada[comparables][!igual])
    t <- sort(table(p), decreasing = TRUE)
    lapply(seq_along(t), function(i) list(par = names(t)[i], n = as.integer(t[[i]])))
  } else {
    list()
  }

  list(
    ok = TRUE,
    motivo = "",
    por_sexo = .mcfd_por_sexo(responses, cfg, comparables, fac_aula, declarada,
                              facs_canon, cuotas),
    matriz = .mcfd_matriz(fac_aula[comparables], declarada[comparables], facs_canon),
    comparables = as.integer(sum(comparables)),
    coinciden = as.integer(sum(igual)),
    discrepan = as.integer(sum(!igual)),
    por_facultad = por_facultad,
    pares = pares,
    sin_aula = as.integer(sum(en_juego & !nzchar(fac_aula))),
    sin_declarar = as.integer(sum(en_juego & nzchar(fac_aula) & !nzchar(declarada)))
  )
}

# Código declarado → nombre, si el estudio lo trae. Sin él el valor crudo viaja
# tal cual y el cruce entero se cae por el guard de «vocabularios que no se
# tocan»: un «5» contra «CIENCIAS E INGENIERIA» no es un desacuerdo de campo,
# es una traducción que falta.
#' Deja el catálogo de facultades como una lista con nombre → nombre.
#'
#' Vive aquí y no en el normalizador de la config porque es la misma regla que
#' lee el cruce: un código sin nombre —o un nombre sin código— no traduce nada
#' y no debe persistir como si lo hiciera.
#' @keywords internal
.mcfd_normalizar_etiquetas <- function(x) {
  if (is.character(x)) x <- as.list(x)
  if (!is.list(x) || !length(x)) return(list())
  nombres <- names(x) %||% character(0)
  out <- list()
  for (i in seq_along(x)) {
    k <- trimws(as.character(nombres[[i]] %||% "")[1])
    v <- .monitoreo_scalar(x[[i]], "")
    if (nzchar(k) && !is.na(k) && nzchar(v)) out[[k]] <- v
  }
  out
}

.mcfd_etiquetas <- function(mapping) {
  .mcfd_normalizar_etiquetas(mapping[["faculty_labels"]] %||% list())
}

# **Lo que Gonzalo preguntó el 2026-09-14: «¿qué pasa si en el avance que
# reportamos cerramos campo y aquí no?».**
#
# El avance por facultad —y sus cuotas de mujeres y hombres— se cuenta con la
# facultad del AULA. Si una facultad llega a su cuota por esa cuenta, se cierra
# campo ahí. Pero parte de esas respuestas son de alumnos de otras facultades:
# por lo que ellos declaran, la facultad puede seguir corta. Cerrar entonces es
# cerrar sobre una cuota que nunca se llenó, y ya no hay cómo volver.
#
# Este bloque pone las dos cuentas al lado, por sexo, contra la meta del diseño.
# NO cambia el avance: avisa.
.mcfd_por_sexo <- function(responses, cfg, comparables, fac_aula, declarada,
                           facs_canon, cuotas) {
  col <- monitoreo_aulas_columna_sexo(responses, cfg)
  if (!nzchar(col) || !(col %in% names(responses))) return(list())
  sexo <- monitoreo_aulas_sexo_key(responses[[col]], cfg)[comparables]
  # Misma doctrina que el resto: sin saber QUÉ CÓDIGO es mujer no se cuenta por
  # sexo. Una cifra por sexo inventada es peor que ninguna.
  if (!any(sexo %in% c("F", "M"))) return(list())

  metas <- .mcfd_metas_por_facultad(cuotas)
  fa <- fac_aula[comparables]
  de <- declarada[comparables]
  cuenta <- function(mascara, sx) sum(mascara & sexo == sx)

  lapply(facs_canon, function(f) {
    i <- vapply(fa, function(x) isTRUE(.mcfd_misma_facultad(x, f)), logical(1),
                USE.NAMES = FALSE)
    j <- vapply(de, function(x) isTRUE(.mcfd_misma_facultad(x, f)), logical(1),
                USE.NAMES = FALSE)
    # **La meta se busca con la MISMA regla de igualdad que el resto**, no por
    # clave exacta: el plan abrevia («CIENCIAS Y ARTES DE LA COMUN.») y el
    # diseño puede escribir el nombre entero. Con clave exacta esa facultad se
    # quedaba sin meta y sin aviso para siempre, en silencio.
    meta <- .mcfd_meta_de(metas, f)
    fila <- list(
      facultad = f,
      aula_F = cuenta(i, "F"), aula_M = cuenta(i, "M"),
      declaradas_F = cuenta(j, "F"), declaradas_M = cuenta(j, "M"),
      meta_F = suppressWarnings(as.numeric(meta$F %||% NA)),
      meta_M = suppressWarnings(as.numeric(meta$M %||% NA))
    )
    # El aviso, que es el punto del bloque: la celda que cerraría contando por
    # el aula y NO cerraría contando lo que el alumno declara.
    faltan <- function(meta_v, dec_v) {
      if (!is.finite(meta_v)) return(0L)
      max(0L, as.integer(meta_v) - as.integer(dec_v))
    }
    cierra <- function(meta_v, aula_v) is.finite(meta_v) && aula_v >= meta_v
    fila$riesgo_F <- cierra(fila$meta_F, fila$aula_F) &&
      faltan(fila$meta_F, fila$declaradas_F) > 0L
    fila$riesgo_M <- cierra(fila$meta_M, fila$aula_M) &&
      faltan(fila$meta_M, fila$declaradas_M) > 0L
    fila$faltan_F <- faltan(fila$meta_F, fila$declaradas_F)
    fila$faltan_M <- faltan(fila$meta_M, fila$declaradas_M)
    fila
  })
}

# Meta de mujeres y hombres por facultad, del bloque `design_targets`.
.mcfd_metas_por_facultad <- function(cuotas) {
  filas <- if (is.list(cuotas)) (cuotas[["facultades"]] %||% list()) else list()
  out <- list()
  for (f in filas) {
    if (!is.list(f)) next
    nombre <- .monitoreo_scalar(f[["facultad"]], "")
    if (!nzchar(nombre)) next
    cs <- f[["cuota_sexo"]] %||% list()
    out[[length(out) + 1L]] <- list(
      facultad = nombre, F = cs[["F"]] %||% NA, M = cs[["M"]] %||% NA)
  }
  out
}

.mcfd_meta_de <- function(metas, facultad) {
  for (m in metas) if (isTRUE(.mcfd_misma_facultad(m$facultad, facultad))) return(m)
  list()
}

# **La matriz de consistencia, pedida el 2026-09-14**: «un seguimiento de quién
# responde otra carrera, en cada facultad a qué carrera responde; creo que es
# una matriz de consistencia de 15x15».
#
# Filas: la facultad del AULA. Columnas: la que el alumno DECLARA. La diagonal
# son los que coinciden y todo lo de fuera es el desacuerdo, leído en las dos
# direcciones: la fila dice a dónde se va la gente de esta facultad y la
# columna, de dónde viene la que llena su cuota.
#
# El orden de filas y columnas es el MISMO —`facs_canon`, que ya incluye a las
# facultades que nadie tiene como aula pero alguien declara—, así que la matriz
# es cuadrada por construcción y cada fila suma su total. Si filas y columnas
# se ordenaran por separado, la diagonal dejaría de ser la coincidencia sin que
# nada fallara.
.mcfd_matriz <- function(fa, de, facs_canon) {
  if (!length(facs_canon)) return(list())
  # Cada respuesta se clasifica UNA vez contra el orden canónico; comparar
  # facultad por facultad dentro del doble bucle costaba N×15×15 llamadas.
  indice <- function(v) vapply(v, function(x) {
    for (i in seq_along(facs_canon)) {
      if (isTRUE(.mcfd_misma_facultad(x, facs_canon[[i]]))) return(i)
    }
    NA_integer_
  }, integer(1), USE.NAMES = FALSE)
  ia <- indice(fa); id <- indice(de)
  lapply(seq_along(facs_canon), function(i) {
    fila <- vapply(seq_along(facs_canon), function(j) {
      sum(!is.na(ia) & !is.na(id) & ia == i & id == j)
    }, integer(1))
    list(facultad = facs_canon[[i]], celdas = fila, total = sum(fila),
         coinciden = fila[[i]])
  })
}

# --- la hoja del libro --------------------------------------------------------

.MCFD_HOJA <- "Control de facultad"
.MCFD_BLOQUES <- c("FACULTAD POR FACULTAD", "SI CERRAMOS POR EL AULA, ¿CERRAMOS DE VERDAD?",
                   "MATRIZ DE CONSISTENCIA", "DÓNDE SE CRUZAN")

#' Las filas de la hoja de control, tipadas — mismo contrato que sus hermanas.
#'
#' @param plan filas del plan.
#' @param responses respuestas de la plataforma.
#' @param cfg config de aulas universitarias.
#' @return `NULL` si el estudio no declara su variable de facultad o no hay con
#'   qué cruzar; si no, lista de filas `{tipo, celdas}`.
#' @keywords internal
aulas_libro_filas_control_facultad <- function(plan = list(), responses = NULL,
                                               cfg = list(), cuotas = NULL) {
  o <- monitoreo_aulas_cruce_facultad_declarada(plan, responses, cfg, cuotas = cuotas)
  if (!isTRUE(o$ok) || !o$comparables) return(NULL)

  filas <- list()
  poner <- function(tipo, celdas) {
    filas[[length(filas) + 1L]] <<- list(tipo = tipo, celdas = .alp_celdas(tipo, celdas))
  }
  pct <- function(n, d) if (d > 0) sprintf("%.1f %%", 100 * n / d) else ""

  poner("titulo", "CONTROL DE FACULTAD")
  poner("nota", sprintf(paste(
    "La facultad del AULA —la que el diseño le puso al curso-horario— contra la",
    "que el alumno DECLARA en el cuestionario. %d respuestas comparables: %d",
    "coinciden (%s) y %d no (%s)."),
    o$comparables, o$coinciden, pct(o$coinciden, o$comparables),
    o$discrepan, pct(o$discrepan, o$comparables)))
  poner("nota", paste(
    "Es un control, no una reatribución: esta hoja NO cambia ningún conteo del",
    "avance. Sirve para saber cuánta de la cuota de una facultad la está",
    "llenando gente de otra."))
  poner("nota", "")

  poner("bloque", .MCFD_BLOQUES[[1]])
  poner("nota", paste(
    "«Por el aula» son las respuestas recogidas en aulas de esa facultad;",
    "«declaradas» son las de quienes dicen ser de ella, estén donde estén. Una",
    "facultad con 0 aulas y declarantes es gente que hoy no se ve en su fila."))
  poner("cabecera", c("FACULTAD", "POR EL AULA", "COINCIDEN", "DE OTRA FACULTAD",
                      "% DE OTRA", "DECLARADAS", "DIFERENCIA"))
  for (f in o$por_facultad) {
    poner("dato", c(
      f$facultad, f$respuestas, f$coinciden, f$discrepan,
      pct(f$discrepan, f$respuestas), f$declaradas,
      sprintf("%+d", f$declaradas - f$respuestas)))
  }
  poner("dato", c("TOTAL", o$comparables, o$coinciden, o$discrepan,
                  pct(o$discrepan, o$comparables), o$comparables, "+0"))

  if (length(o$por_sexo)) {
    poner("nota", "")
    poner("bloque", .MCFD_BLOQUES[[2]])
    poner("nota", paste(
      "El avance por facultad —y sus cuotas de mujeres y hombres— se cuenta con",
      "la facultad del AULA. Si una facultad llega a su cuota por esa cuenta se",
      "cierra campo ahí, pero parte de esas respuestas son de alumnos de otras",
      "facultades: por lo que ellos declaran puede seguir corta. Este bloque no",
      "cambia el avance; avisa de dónde cerrar sería cerrar en falso."))
    poner("cabecera", c("FACULTAD", "META M", "POR AULA M", "DECLARAN M",
                        "META H", "POR AULA H", "DECLARAN H", "AVISO"))
    num <- function(x) if (is.finite(x)) as.character(as.integer(x)) else ""
    hay_aviso <- FALSE
    for (f in o$por_sexo) {
      aviso <- character(0)
      if (isTRUE(f$riesgo_F)) aviso <- c(aviso, sprintf("faltarían %d mujeres", f$faltan_F))
      if (isTRUE(f$riesgo_M)) aviso <- c(aviso, sprintf("faltarían %d hombres", f$faltan_M))
      if (length(aviso)) {
        hay_aviso <- TRUE
        aviso <- paste("CERRARÍA POR AULA Y NO POR LO DECLARADO:",
                       paste(aviso, collapse = " y "))
      } else {
        aviso <- ""
      }
      poner("dato", c(f$facultad, num(f$meta_F), f$aula_F, f$declaradas_F,
                      num(f$meta_M), f$aula_M, f$declaradas_M, aviso))
    }
    if (!hay_aviso) {
      poner("nota", paste(
        "Hoy ninguna facultad cerraría por el aula quedándose corta por lo que",
        "los alumnos declaran. El aviso aparece solo si eso cambia."))
    }
  }

  if (length(o$matriz) > 1L) {
    poner("nota", "")
    poner("bloque", .MCFD_BLOQUES[[3]])
    poner("nota", paste(
      "Cada fila es la facultad del AULA y cada columna, la que el alumno",
      "DECLARA; las columnas van numeradas en el mismo orden que las filas. La",
      "diagonal son los que coinciden. Leída por filas dice a dónde se va la",
      "gente recogida en esta facultad; por columnas, de dónde viene la que",
      "está llenando su cuota."))
    n <- length(o$matriz)
    poner("cabecera", c("AULA \\ DECLARA", as.character(seq_len(n)), "TOTAL"))
    for (k in seq_len(n)) {
      f <- o$matriz[[k]]
      poner("dato", c(sprintf("%d. %s", k, f$facultad),
                      as.list(f$celdas), f$total))
    }
  }

  if (length(o$pares)) {
    poner("nota", "")
    poner("bloque", .MCFD_BLOQUES[[4]])
    poner("nota", paste(
      "De qué facultad era el aula y de cuál dice ser quien respondió. Lo que",
      "más se repite suele ser un curso compartido o un alumno de Estudios",
      "Generales que ya declara su facultad de destino."))
    poner("cabecera", c("AULA DE", "EL ALUMNO DECLARA", "RESPUESTAS"))
    for (x in o$pares) {
      lados <- strsplit(x$par, " → ", fixed = TRUE)[[1]]
      poner("dato", c(lados[[1]], if (length(lados) > 1L) lados[[2]] else "", x$n))
    }
  }
  filas
}

#' Los valores planos de la hoja de control, para Sheets.
#' @keywords internal
aulas_libro_valores_control_facultad <- function(plan = list(), responses = NULL,
                                                 cfg = list(), cuotas = NULL) {
  filas <- aulas_libro_filas_control_facultad(plan, responses, cfg, cuotas = cuotas)
  if (is.null(filas)) return(NULL)
  lapply(filas, function(f) as.list(f$celdas))
}

#' Escribe la hoja «Control de facultad» sobre el workbook del libro.
#' @keywords internal
aulas_libro_hoja_control_facultad <- function(wb, plan = list(), responses = NULL,
                                              cfg = list(), cuotas = NULL) {
  filas <- aulas_libro_filas_control_facultad(plan, responses, cfg, cuotas = cuotas)
  if (is.null(filas)) return(invisible(FALSE))
  hoja <- .MCFD_HOJA
  openxlsx::addWorksheet(wb, hoja)
  estilos <- list(
    titulo = openxlsx::createStyle(fontSize = 14, textDecoration = "bold"),
    nota = openxlsx::createStyle(fontColour = "#6B6560", fontSize = 10),
    cabecera = openxlsx::createStyle(textDecoration = "bold", fgFill = "#F3EDEA",
                                     border = "bottom", borderColour = "#C9BEB8",
                                     fontSize = 10),
    bloque = openxlsx::createStyle(textDecoration = "bold", fontSize = 12)
  )
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    openxlsx::writeData(wb, hoja, .alp_fila_df(f$celdas), startRow = i, colNames = FALSE)
    est <- estilos[[f$tipo]]
    if (!is.null(est)) {
      openxlsx::addStyle(wb, hoja, est, rows = i, cols = seq_along(f$celdas),
                         gridExpand = TRUE)
    }
  }
  total <- openxlsx::createStyle(textDecoration = "bold", border = "top",
                                 borderColour = "#C9BEB8")
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    if (identical(f$tipo, "dato") && identical(as.character(f$celdas[[1]]), "TOTAL")) {
      openxlsx::addStyle(wb, hoja, total, rows = i, cols = seq_along(f$celdas),
                         gridExpand = TRUE, stack = TRUE)
    }
  }
  anchos <- c(38L, rep(16L, max(0L, max(vapply(filas, function(f) length(f$celdas),
                                               integer(1))) - 1L)))
  openxlsx::setColWidths(wb, hoja, cols = seq_along(anchos), widths = anchos)
  openxlsx::freezePane(wb, hoja, firstActiveRow = 2L)
  invisible(TRUE)
}

#' Requests de formato de la hoja de control en Sheets.
#' @keywords internal
aulas_libro_control_facultad_formato_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- max(1L, max(vapply(rows, function(r) length(r %||% list()), integer(1))))
  requests <- list()
  poner <- function(req) requests[[length(requests) + 1L]] <<- req
  for (i in seq_along(rows)) {
    celdas <- trimws(as.character(unlist(rows[[i]] %||% list(), use.names = FALSE)))
    primera <- if (length(celdas)) celdas[[1L]] else ""
    if (identical(primera, "CONTROL DE FACULTAD")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 13L))
      poner(.maaf_alto_fila(sheet_id, i, 36L))
    } else if (primera %in% .MCFD_BLOQUES) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 11L))
      poner(.maaf_alto_fila(sheet_id, i, 28L))
    } else if (primera %in% c("FACULTAD", "AULA DE")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#E7EEF9", "#1B4B8F", wrap = TRUE))
    } else if (identical(primera, "TOTAL")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#F3EDEA", "#3A3532"))
    } else if (length(celdas) == 1L && nzchar(primera)) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#FFFFFF", "#6B6560",
                        size = 9L, italic = TRUE, bold = FALSE))
    }
  }
  requests
}
