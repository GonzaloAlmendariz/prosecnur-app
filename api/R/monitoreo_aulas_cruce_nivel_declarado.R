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
  if (!(var_ciclo %in% names(responses))) {
    return(vacio(sprintf("la variable declarada («%s») no está en la base", var_ciclo)))
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
