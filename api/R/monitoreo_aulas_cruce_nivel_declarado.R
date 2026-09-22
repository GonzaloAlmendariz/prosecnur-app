# monitoreo_aulas_cruce_nivel_declarado.R — la hoja «Control de nivel».
#
# Hermana de `monitoreo_aulas_cruce_facultad_declarada.R`, y clonada de ella a
# propósito: mismo contrato, mismo guard de degradación y misma disciplina de no
# inventar nada. Lo que cambia son los dos lados que se comparan.
#
# Allí se cruzaba la facultad del AULA contra la que declara quien respondió.
# Aquí se cruza el nivel de la PERSONA —resuelto por su código PUCP contra el
# padrón, ADR 0088— contra el ciclo que esa misma persona declaró en el
# cuestionario. Son dos auto-reportes de la misma persona contrastados entre sí:
# el código, que es verificable contra una tabla, y el ciclo, que no lo es.
#
# **«OTROS» NO ES UNA DISCREPANCIA, y esto es lo único que no se clona.**
# Corrección de Gonzalo del 2026-09-17: «pero no se supone que estábamos viendo
# a alumnos sólo de esos ciclos; aquellos que no pertenezcan a ese ciclo puede
# ponerlo en el nuevo "Otros" que se va a agregar allí». La población ES ciclo 6
# a 9, así que quien marca «Otros» está declarando que NO es población: es fuera
# de universo declarado por la persona, no una no-respuesta. Y frente al padrón:
#
#   · padrón FUERA del rango del instrumento → **coinciden**. Los dos dicen lo
#     mismo, y contarlo como desacuerdo inflaría el conflicto justo en las aulas
#     mixtas, que son las que el piso de 50 % dejó dentro a propósito.
#   · padrón DENTRO del rango → **discrepan**, y de las que importan: la persona
#     se declara fuera de una población en la que el padrón la pone.
#
# Queda escrito en el ADR 0088, sección Notas.

#' El rango de niveles que el INSTRUMENTO considera población.
#'
#' Sale de las etiquetas declaradas, no de una constante: el instrumento de CCSS
#' ofrece Sexto a Noveno y otro estudio ofrecerá otra cosa. Sin etiquetas no hay
#' rango y «Otros» no se puede juzgar, que es distinto de juzgarlo mal.
#' @keywords internal
.mcnd_rango <- function(etiquetas) {
  v <- suppressWarnings(as.integer(unlist(etiquetas, use.names = FALSE)))
  sort(unique(v[is.finite(v)]))
}

# El centinela de «Otros». Un valor imposible como nivel y reconocible a simple
# vista en un volcado: un `""` se confundiría con «no declaró».
.MCND_OTROS <- "__otros__"

#' El ciclo declarado, llevado a número — o al centinela de «Otros».
#'
#' El catálogo `declared_level_labels` traduce el código de la opción a lo que
#' significa: `"1" -> "6"`, `"5" -> "Otros"`. Sin catálogo se acepta el valor
#' crudo si YA es un número, que es el caso de un formulario que guarda el
#' ciclo como entero; cualquier otra cosa queda sin declarar, porque adivinar
#' que «Sexto» es 6 en un estudio y 7 en otro es inventar el dato.
#' @keywords internal
.mcnd_declarado <- function(crudo, etiquetas) {
  vapply(as.character(crudo), function(v) {
    if (is.na(v)) return("")
    v <- trimws(v)
    if (!nzchar(v)) return("")
    e <- etiquetas[[v]]
    val <- if (is.null(e)) v else as.character(e)[1]
    val <- trimws(val)
    if (!nzchar(val)) return("")
    # «Otros», «Otro», «Ninguno de los anteriores»: la opción de escape del
    # instrumento. Se reconoce por prefijo y no por lista cerrada, que es la
    # regla de la casa —una lista cerrada se traga lo que no reconoce—.
    k <- toupper(iconv(val, from = "", to = "ASCII//TRANSLIT", sub = ""))
    if (startsWith(k, "OTRO") || startsWith(k, "NINGUN")) return(.MCND_OTROS)
    n <- suppressWarnings(as.integer(val))
    if (is.finite(n)) as.character(n) else ""
  }, character(1), USE.NAMES = FALSE)
}

#' El cruce entre el nivel del padrón y el ciclo que la persona declaró.
#'
#' @param responses `data.frame` de respuestas de la plataforma.
#' @param padron el padrón cargado (`monitoreo_aulas_padron_v1`).
#' @param cfg config de aulas universitarias. Declara
#'   `source_mapping$student_code_var` —la llave del padrón— y
#'   `source_mapping$declared_level_var` con su `declared_level_labels`.
#' @return lista `{ok, motivo, comparables, coinciden, discrepan,
#'   fuera_declarado, matriz, pares, por_nivel, sin_nivel}`. `ok = FALSE` cuando
#'   el estudio no declara sus variables o no hay con qué cruzar: un bloque
#'   vacío con su motivo es más honesto que uno con ceros que se leerían como
#'   medidos.
#' @export
monitoreo_aulas_cruce_nivel_declarado <- function(responses, padron = list(), cfg = list()) {
  vacio <- function(motivo = "", sin_nivel = list()) list(
    ok = FALSE, motivo = motivo, comparables = 0L, coinciden = 0L, discrepan = 0L,
    fuera_declarado = list(coinciden = 0L, discrepan = 0L),
    matriz = list(), pares = list(), por_nivel = list(),
    sin_nivel = sin_nivel %||% list())
  if (!is.data.frame(responses) || !nrow(responses)) return(vacio("sin respuestas"))

  mapping <- cfg[["source_mapping"]] %||% list()
  var_ciclo <- .monitoreo_scalar(mapping[["declared_level_var"]] %||% "", "")
  if (!nzchar(var_ciclo)) {
    return(vacio("el estudio no declara su variable de ciclo autodeclarado"))
  }
  # Se resuelve con el MISMO resolvedor que el código y el sexo: Kobo devuelve
  # las columnas con el prefijo de su grupo —`modulo_a/A1`— y el estudio las
  # declara sin él. Con el match a secas, un `A1` correctamente declarado
  # contestaba «la variable declarada no está en la base» y la hoja «Control de
  # nivel» salía muda con el dato delante.
  var_ciclo <- monitoreo_aulas_columna_declarada(responses, var_ciclo)
  if (!nzchar(var_ciclo)) {
    return(vacio(sprintf(
      "la variable declarada («%s») no está en la base",
      .monitoreo_scalar(mapping[["declared_level_var"]] %||% "", ""))))
  }

  # El nivel de la persona lo resuelve el MISMO motor que alimenta las celdas de
  # cuota. Recalcularlo aquí daría una segunda verdad sobre la misma cifra, y el
  # control existe para contrastar dos fuentes, no para crear una tercera.
  res <- monitoreo_aulas_nivel_por_respuesta(responses, padron, cfg)
  valid <- .monitoreo_aulas_valid_response(responses, cfg)

  etiquetas <- .mcfd_normalizar_etiquetas(mapping[["declared_level_labels"]])
  declarado <- .mcnd_declarado(responses[[var_ciclo]], etiquetas)
  rango <- .mcnd_rango(etiquetas)

  del_padron <- ifelse(res$resuelto & is.finite(res$nivel), as.character(res$nivel), "")

  # **La bolsa «sin nivel», desglosada por lo que se puede hacer con ella.** De
  # las que no resolvieron, las que SÍ declararon ciclo son las que vale la pena
  # revisar: hay persona y hay dato, lo que falla es el código. Las que tampoco
  # declararon no tienen por dónde agarrarse.
  sin_nivel_idx <- valid & !nzchar(del_padron)
  con_ciclo <- sin_nivel_idx & nzchar(declarado) & declarado != .MCND_OTROS
  motivos <- res$motivo
  sin_nivel <- list(
    total = sum(sin_nivel_idx),
    con_ciclo_declarado = sum(con_ciclo),
    sin_ciclo_declarado = sum(sin_nivel_idx & !nzchar(declarado)),
    se_declaro_fuera = sum(sin_nivel_idx & declarado == .MCND_OTROS),
    por_motivo = as.list(table(motivos[sin_nivel_idx]))
  )

  # Sólo las válidas: una respuesta descartada no es un desacuerdo de campo. Es
  # el mismo criterio que la hermana de facultad.
  comparables <- valid & nzchar(del_padron) & nzchar(declarado)
  if (!any(comparables)) {
    return(vacio("ninguna respuesta tiene nivel del padrón y ciclo declarado", sin_nivel))
  }

  pa <- del_padron[comparables]
  de <- declarado[comparables]
  es_otros <- de == .MCND_OTROS
  # «Otros» coincide cuando el padrón TAMBIÉN pone a esa persona fuera del rango
  # del instrumento. Sin rango declarado no se puede juzgar y se cuenta aparte,
  # nunca como desacuerdo.
  fuera_del_rango <- if (length(rango)) !(suppressWarnings(as.integer(pa)) %in% rango) else rep(NA, length(pa))
  igual <- ifelse(es_otros, fuera_del_rango, pa == de)
  igual[is.na(igual)] <- FALSE

  # **Si los dos lados no hablan el mismo idioma, lo que falla es la
  # comparación y no el campo.** Es la lección de la hermana de facultad, que
  # salió publicando «1.390 · 100,0 % DE OTRA FACULTAD» por comparar un código
  # contra un nombre. El modo de fallo aquí es idéntico: un estudio que declara
  # la variable pero no su catálogo trae el código de la opción («1», «2»…) y lo
  # compara contra el nivel del padrón (6, 7…).
  #
  # **La prueba NO es «cero coincidencias», y tampoco «vocabularios disjuntos».**
  # Escribí las dos, en ese orden, y el test las tumbó las dos por el mismo
  # motivo: con UNA respuesta comparable que de verdad discrepa, no hay ninguna
  # coincidencia y los dos conjuntos de un elemento son disjuntos — así que las
  # dos pruebas se comían el hallazgo y devolvían el bloque vacío, sin
  # discrepancia y sin par que ir a buscar. La hermana no lo nota porque mide
  # cientos a la vez; una hoja de control con diez respuestas sí.
  #
  # La prueba de verdad es EXACTA y no depende de cuántas respuestas haya: todo
  # valor declarado tiene que pertenecer al vocabulario que el estudio declara.
  # Ese vocabulario son los niveles del catálogo cuando hay catálogo, y los del
  # propio padrón cuando no —porque un formulario que guarda el ciclo como
  # entero es legítimo y no necesita traducción—. Un «1» frente a un padrón de
  # niveles 6 a 9 está FUERA, y eso se ve con una sola respuesta.
  vocabulario <- if (length(rango)) as.character(rango) else unique(pa)
  comparan_por_igualdad <- !es_otros
  fuera_del_vocabulario <- setdiff(unique(de[comparan_por_igualdad]), vocabulario)
  if (length(fuera_del_vocabulario)) {
    return(vacio(paste(
      sprintf("el ciclo declarado usa valores que el estudio no reconoce (%s);",
              paste(utils::head(sort(fuera_del_vocabulario), 6), collapse = ", ")),
      sprintf("los niveles declarados son %s.",
              paste(utils::head(vocabulario, 8), collapse = ", ")),
      "Suele significar que falta el catálogo de opciones",
      "(`declared_level_labels`) y se está comparando el código de la opción",
      "contra el nivel del padrón."
    ), sin_nivel))
  }

  # La matriz de consistencia: padrón × declarado, con «Otros» como su propia
  # columna. No se colapsa con «no declaró»: son dos cosas distintas.
  claves_pa <- sort(unique(pa))
  claves_de <- sort(unique(de))
  matriz <- list()
  for (a in claves_pa) {
    fila <- list(nivel_padron = a, celdas = list())
    for (b in claves_de) {
      n <- sum(pa == a & de == b)
      if (!n) next
      fila$celdas[[length(fila$celdas) + 1L]] <- list(
        declarado = if (identical(b, .MCND_OTROS)) "Otros" else b,
        es_otros = identical(b, .MCND_OTROS),
        n = as.integer(n),
        coinciden = as.integer(sum(pa == a & de == b & igual))
      )
    }
    matriz[[length(matriz) + 1L]] <- fila
  }

  # Las discrepancias, una por una y sin muestrear: la hoja existe para ir a
  # buscarlas. El código NO viaja aquí —es PII y el bloque se persiste en el
  # payload—; lo que viaja es la fila de la base, que es con lo que se busca.
  filas <- which(comparables)
  pares <- list()
  for (i in seq_along(filas)) {
    if (isTRUE(igual[[i]])) next
    pares[[length(pares) + 1L]] <- list(
      fila = as.integer(filas[[i]]),
      nivel_padron = pa[[i]],
      declarado = if (identical(de[[i]], .MCND_OTROS)) "Otros" else de[[i]],
      es_otros = identical(de[[i]], .MCND_OTROS)
    )
  }

  por_nivel <- lapply(claves_pa, function(a) {
    sel <- pa == a
    list(nivel = a, comparables = as.integer(sum(sel)),
         coinciden = as.integer(sum(sel & igual)),
         discrepan = as.integer(sum(sel & !igual)))
  })

  list(
    ok = TRUE, motivo = "",
    comparables = as.integer(sum(comparables)),
    coinciden = as.integer(sum(igual)),
    discrepan = as.integer(sum(!igual)),
    # Las dos mitades de «Otros», separadas porque piden acciones distintas:
    # la que coincide no pide nada y la que discrepa es un caso a revisar.
    fuera_declarado = list(
      coinciden = as.integer(sum(es_otros & igual)),
      discrepan = as.integer(sum(es_otros & !igual))
    ),
    matriz = matriz, pares = pares, por_nivel = por_nivel,
    sin_nivel = sin_nivel
  )
}

# --- la hoja del libro ------------------------------------------------------
#
# Mismo contrato y mismos tipos de fila que sus hermanas (`titulo`, `nota`,
# `bloque`, `cabecera`, `dato`), para que el formateador del libro y el de
# Sheets la reconozcan sin caso especial.

.MCND_HOJA <- "Control de nivel"
.MCND_BLOQUES <- c("MATRIZ DE CONSISTENCIA", "DISCREPANCIAS, UNA POR UNA",
                   "RESPUESTAS SIN NIVEL")

#' Las filas de la hoja «Control de nivel», tipadas.
#'
#' @param responses respuestas de la plataforma.
#' @param padron el padrón cargado. **Viaja por argumento y no por la config**:
#'   el padrón vive sólo en la sesión, nunca en la config que se persiste, para
#'   que la purga lo alcance (ADR 0087).
#' @param cfg config de aulas universitarias.
#' @return `NULL` cuando el cruce no es posible —y entonces la hoja no se
#'   escribe, porque una hoja vacía diría «todo coincide»—; si no, lista de
#'   filas `{tipo, celdas}`.
#' @keywords internal
aulas_libro_filas_control_nivel <- function(responses = NULL, padron = list(),
                                            cfg = list()) {
  o <- monitoreo_aulas_cruce_nivel_declarado(responses, padron, cfg)
  if (!isTRUE(o$ok) || !o$comparables) return(NULL)

  filas <- list()
  poner <- function(tipo, celdas) {
    filas[[length(filas) + 1L]] <<- list(tipo = tipo, celdas = .alp_celdas(tipo, celdas))
  }
  pct <- function(n, d) if (d > 0) sprintf("%.1f %%", 100 * n / d) else ""

  poner("titulo", "CONTROL DE NIVEL")
  poner("nota", "")

  poner("bloque", .MCND_BLOQUES[[1]])
  poner("nota", paste(
    "Cada fila es un nivel del padrón y cada columna lo que esas personas",
    "declararon. La diagonal es el acuerdo; «Otros» tiene columna propia y no",
    "se confunde con no haber contestado."))
  declarados <- sort(unique(unlist(lapply(o$matriz, function(f)
    vapply(f$celdas, function(c) c$declarado, character(1))), use.names = FALSE)))
  # «Otros» al final, siempre: es la opción de escape y leerla entre los ciclos
  # la haría parecer uno más.
  declarados <- c(setdiff(declarados, "Otros"), intersect("Otros", declarados))
  poner("cabecera", c("NIVEL DEL PADRÓN", toupper(declarados), "COMPARABLES",
                      "COINCIDEN", "% ACUERDO"))
  for (f in o$matriz) {
    de_la_fila <- vapply(f$celdas, function(c) c$declarado, character(1))
    cuentas <- vapply(declarados, function(b) {
      i <- which(de_la_fila == b)
      if (length(i)) as.character(f$celdas[[i[[1]]]]$n) else ""
    }, character(1), USE.NAMES = FALSE)
    suyo <- o$por_nivel[[which(vapply(o$por_nivel, function(x) x$nivel,
                                      character(1)) == f$nivel_padron)[[1]]]]
    poner("dato", c(f$nivel_padron, cuentas, suyo$comparables, suyo$coinciden,
                    pct(suyo$coinciden, suyo$comparables)))
  }
  poner("dato", c("TOTAL", rep("", length(declarados)), o$comparables, o$coinciden,
                  pct(o$coinciden, o$comparables)))

  if (length(o$pares)) {
    poner("nota", "")
    poner("bloque", .MCND_BLOQUES[[2]])
    poner("nota", paste(
      "La FILA es la de la base de respuestas, que es con lo que se busca. El",
      "código no se escribe aquí: es dato personal y esta hoja se comparte."))
    poner("cabecera", c("FILA EN LA BASE", "NIVEL DEL PADRÓN", "CICLO DECLARADO",
                        "SE DECLARÓ FUERA"))
    for (x in o$pares) {
      poner("dato", c(x$fila, x$nivel_padron, x$declarado,
                      if (isTRUE(x$es_otros)) "sí" else ""))
    }
  }

  sn <- o$sin_nivel
  if (isTRUE((sn$total %||% 0L) > 0L)) {
    poner("nota", "")
    poner("bloque", .MCND_BLOQUES[[3]])
    poner("nota", paste(
      "Respuestas válidas cuyo código no resolvió contra el padrón, así que no",
      "cuentan para ninguna celda. Se desglosan por lo que se puede HACER con",
      "cada grupo: las que SÍ declararon ciclo son las que vale la pena revisar",
      "—hay persona y hay dato, lo que falla es el código—."))
    poner("cabecera", c("GRUPO", "RESPUESTAS", "QUÉ HACER"))
    poner("dato", c("Con ciclo declarado", sn$con_ciclo_declarado,
                    "Revisar el código en la base"))
    poner("dato", c("Sin ciclo declarado", sn$sin_ciclo_declarado,
                    "Sin dato por donde empezar"))
    poner("dato", c("Se declaró fuera del estudio", sn$se_declaro_fuera,
                    "Fuera de universo declarado: no falta nada"))
    poner("dato", c("TOTAL", sn$total, ""))
    if (length(sn$por_motivo)) {
      poner("nota", "")
      poner("cabecera", c("MOTIVO DEL MOTOR", "RESPUESTAS"))
      for (nm in names(sn$por_motivo)) {
        poner("dato", c(gsub("_", " ", nm), as.character(sn$por_motivo[[nm]])))
      }
    }
  }
  filas
}

#' Los valores de la hoja, para el publicador de Sheets.
#' @keywords internal
aulas_libro_valores_control_nivel <- function(responses = NULL, padron = list(),
                                              cfg = list()) {
  filas <- aulas_libro_filas_control_nivel(responses, padron, cfg)
  if (is.null(filas)) return(NULL)
  lapply(filas, function(f) as.list(f$celdas))
}

#' Escribe la hoja «Control de nivel» sobre el workbook del libro.
#' @keywords internal
aulas_libro_hoja_control_nivel <- function(wb, responses = NULL, padron = list(),
                                           cfg = list()) {
  filas <- aulas_libro_filas_control_nivel(responses, padron, cfg)
  if (is.null(filas)) return(invisible(FALSE))
  hoja <- .MCND_HOJA
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
  anchos <- c(30L, rep(15L, max(0L, max(vapply(filas, function(f) length(f$celdas),
                                               integer(1))) - 1L)))
  openxlsx::setColWidths(wb, hoja, cols = seq_along(anchos), widths = anchos)
  openxlsx::freezePane(wb, hoja, firstActiveRow = 2L)
  invisible(TRUE)
}

#' Requests de formato de la hoja de control de nivel en Sheets.
#' @keywords internal
aulas_libro_control_nivel_formato_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- max(1L, max(vapply(rows, function(r) length(r %||% list()), integer(1))))
  requests <- list()
  poner <- function(req) requests[[length(requests) + 1L]] <<- req
  cabeceras <- c("NIVEL DEL PADRÓN", "FILA EN LA BASE", "GRUPO", "MOTIVO DEL MOTOR")
  for (i in seq_along(rows)) {
    celdas <- trimws(as.character(unlist(rows[[i]] %||% list(), use.names = FALSE)))
    primera <- if (length(celdas)) celdas[[1L]] else ""
    if (identical(primera, "CONTROL DE NIVEL")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 13L))
      poner(.maaf_alto_fila(sheet_id, i, 36L))
    } else if (primera %in% .MCND_BLOQUES) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 11L))
      poner(.maaf_alto_fila(sheet_id, i, 28L))
    } else if (primera %in% cabeceras) {
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
