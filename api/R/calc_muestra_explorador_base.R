# Perfil descriptivo de una base declarada, ANTES del marco.
#
# G49 · Gonzalo: «¿por qué este explorador de variables te pediría tener un
# marco completo si se supone que este es un paso previo al marco? Lo que yo
# quería simplemente son las variables de las bases, tanto de estudiantes como
# de cursos-horario […] con las dos bases iniciales y crudas teníamos suficiente
# para poder ir mapeando qué teníamos».
#
# La primera versión del explorador describía `aula_frame`, que es PRODUCTO del
# marco: exigía construirlo para mirar las bases y mezclaba las columnas del
# archivo con las que el motor deriva (`included`, `exclude_reason`,
# `size_group`…). Justo al revés del orden de trabajo: primero se mira lo que se
# subió, después se mapea, y sólo entonces se construye.
#
# Este perfil se calcula sobre el ARCHIVO declarado en Datos › Fuentes, hoja
# incluida. No necesita marco, no inventa columnas y no reordena nada: describe
# lo que hay.
#
# Vive en R y no en la superficie porque la base real tiene 136.284 filas: traer
# eso al cliente para contar categorías sería mover un archivo entero por cada
# clic. Aquí se leen las columnas y se devuelven agregados.

.cm_expl_vacio <- function(x) {
  if (length(x) == 0) return(logical(0))
  texto <- trimws(as.character(x))
  is.na(x) | !nzchar(texto) | toupper(texto) %in% c("NA", "NAN", "NULL")
}

# Una columna es numérica cuando todo lo que trae dato es número y hay más de
# dos valores distintos: un 0/1 es una bandera y describirla con media y
# cuartiles responde a una pregunta que nadie hace.
.cm_expl_es_numerica <- function(x) {
  vacios <- .cm_expl_vacio(x)
  con_dato <- x[!vacios]
  if (!length(con_dato)) return(FALSE)
  if (is.numeric(con_dato)) return(length(unique(con_dato)) > 2)
  num <- suppressWarnings(as.numeric(trimws(as.character(con_dato))))
  if (anyNA(num)) return(FALSE)
  length(unique(num)) > 2
}

# Las columnas que describen al ESTUDIANTE admiten una lectura por persona; las
# del curso no, porque un estudiante tiene varias.
duplicated_ok <- function(nombre, mapping) {
  clave <- .cm_aulas_text_key(nombre)
  del_estudiante <- unlist(mapping[c("age", "level", "sex", "formation", "condition", "faculty", "program")])
  !clave %in% .cm_aulas_text_key(del_estudiante)
}

.cm_expl_cuantil <- function(valores, q) {
  as.numeric(stats::quantile(valores, probs = q, names = FALSE, type = 7))
}

.cm_expl_perfil_numerico <- function(x) {
  num <- suppressWarnings(as.numeric(trimws(as.character(x[!.cm_expl_vacio(x)]))))
  num <- num[is.finite(num)]
  if (!length(num)) return(NULL)
  minimo <- min(num)
  maximo <- max(num)
  n_bins <- max(6L, min(24L, as.integer(round(sqrt(length(num))))))
  ancho <- if (maximo > minimo) (maximo - minimo) / n_bins else 1
  cortes <- if (maximo > minimo) {
    idx <- pmin(n_bins - 1L, pmax(0L, as.integer(floor((num - minimo) / ancho))))
    tabulate(idx + 1L, nbins = n_bins)
  } else {
    length(num)
  }
  list(
    min = minimo, max = maximo,
    media = mean(num),
    p25 = .cm_expl_cuantil(num, 0.25),
    p50 = .cm_expl_cuantil(num, 0.50),
    p75 = .cm_expl_cuantil(num, 0.75),
    bins = lapply(seq_along(cortes), function(i) list(
      desde = minimo + ancho * (i - 1L),
      hasta = minimo + ancho * i,
      n = as.integer(cortes[[i]])
    ))
  )
}

# G51 · Contar filas o contar estudiantes.
#
# Gonzalo: «cuenta estudiantes únicos». En MATRICULADO hay una fila por
# estudiante-curso, así que «cuántas mujeres hay» contado por filas devuelve
# matrículas, no personas: un alumno con cinco cursos pesa cinco veces.
#
# Con `ids` presentes, cada categoría cuenta ESTUDIANTES DISTINTOS. Eso tiene
# una consecuencia que hay que declarar y no esconder: un estudiante puede caer
# en dos categorías de la misma columna —lleva un curso presencial y otro
# virtual— así que las categorías pueden sumar más que el total de estudiantes.
# Deduplicar por estudiante «tomando su primera fila» evitaría el exceso a
# cambio de inventar cuál de sus cursos lo representa; preferimos contar bien y
# avisar.
.cm_expl_top <- function(x, top, cola_max, ids = NULL) {
  vacios <- .cm_expl_vacio(x)
  valores <- trimws(as.character(x[!vacios]))
  if (!length(valores)) return(NULL)
  tabla <- if (is.null(ids)) {
    sort(table(valores), decreasing = TRUE)
  } else {
    sort(vapply(
      split(ids[!vacios], valores),
      function(grupo) length(unique(grupo[nzchar(grupo)])),
      integer(1)
    ), decreasing = TRUE)
  }
  claves <- names(tabla)
  n <- as.integer(tabla)
  cabeza <- seq_len(min(top, length(claves)))
  resto <- setdiff(seq_along(claves), cabeza)
  list(
    categorias = lapply(cabeza, function(i) list(clave = claves[[i]], n = n[[i]])),
    otras = if (length(resto)) {
      listadas <- utils::head(resto, cola_max)
      list(
        n = sum(n[resto]),
        categorias = length(resto),
        truncadas = as.integer(max(0L, length(resto) - length(listadas))),
        filas = lapply(listadas, function(i) list(clave = claves[[i]], n = n[[i]]))
      )
    } else NULL
  )
}

# Columnas que no se ofrecen: describir una columna de identificadores produce
# una lista de tantas categorías como filas, y ninguna dice nada.
.cm_expl_columna_identificadora <- function(nombre, x, filas) {
  clave <- .cm_aulas_text_key(nombre)
  if (grepl("correo|email|celular|telefono", clave)) return(TRUE)
  # Identificadores de PERSONA por nombre: con una base chica la heuristica de
  # abajo no se dispara y la columna se colaria igual. No entran aqui los
  # codigos de CURSO —«Curso», «Curso-Horario»—, que se repiten y sí describen.
  if (grepl("codigo_pucp|codigo_alumno|codigo_estudiante|cod_alumno|cod_pucp|dni|documento|hash", clave)) {
    return(TRUE)
  }
  # El nombre de la persona tampoco describe: en MATRICULADO trae 29.090
  # categorías —una por estudiante— y es dato personal que nadie necesita ver
  # para decidir un marco. «Nombre del curso» sí describe y no entra aquí.
  if (grepl("nombre_completo|nombres_completos|apellido|nombre_del_alumno|nombre_del_estudiante", clave)) {
    return(TRUE)
  }
  distintos <- length(unique(trimws(as.character(x[!.cm_expl_vacio(x)]))))
  # Casi tantos valores distintos como filas y sin repetición útil: es una clave.
  filas > 50 && distintos > filas * 0.9
}

# G50 · Los filtros son de CUALQUIER columna, no sólo de facultad.
#
# Gonzalo: «yo también tengo que ser capaz de en este explorador tener filtros
# dinámicos que me permitan tener ese nivel de especificidad […] explorar como
# si tuviera el Excel, básicamente, pero la diferencia aquí es que hay
# gráficos». Un selector de facultad respondía una pregunta de las muchas que se
# hacen sobre una base: «cuántos tipos de curso hay en esta facultad» necesita
# cruzar dos columnas, y la siguiente pregunta cruzará otras dos.
#
# Se aplican en AND entre columnas y en OR dentro de una columna, que es como
# funciona el autofiltro de una hoja de cálculo: cada columna acota, y dentro de
# ella se admiten varios valores.
.cm_expl_aplicar_filtros <- function(datos, filtros) {
  if (!length(filtros)) return(datos)
  for (filtro in filtros) {
    columna <- .cm_aulas_scalar(filtro$columna %||% filtro$column, "")
    valores <- .cm_aulas_chr_vec(filtro$valores %||% filtro$values)
    if (!nzchar(columna) || !length(valores)) next
    if (!columna %in% names(datos)) next
    actuales <- trimws(as.character(datos[[columna]]))
    datos <- datos[actuales %in% trimws(valores), , drop = FALSE]
  }
  datos
}

#' Perfil descriptivo de una hoja de una base declarada.
#'
#' @param path ruta al archivo subido (xlsx/xls/csv).
#' @param sheet hoja a leer; vacío = la primera.
#' @param filtros lista de `list(columna=, valores=)` para acotar la descripción.
#' @param top cuántas categorías se devuelven con conteo propio.
calc_muestra_explorar_base <- function(datos = NULL, sheet = "", filtros = list(),
                                       top = 40L, cola_max = 500L, path = NULL,
                                       unidad = "filas") {
  # Acepta la hoja ya leida (la ruta la cachea en sesion) o la lee del archivo:
  # el motor no obliga a la superficie a elegir una de las dos formas.
  if (!is.data.frame(datos)) {
    if (!nzchar(path %||% "") || !file.exists(path)) {
      stop_api(400, "E_CALC_MUESTRA_EXPLORAR_ARCHIVO", "El archivo declarado ya no esta disponible en la sesion.")
    }
    datos <- .cm_aulas_read_table(path, if (nzchar(sheet)) sheet else NULL)
  }
  if (!is.data.frame(datos) || !nrow(datos)) {
    stop_api(400, "E_CALC_MUESTRA_EXPLORAR_HOJA", "La hoja indicada no trae filas legibles.")
  }
  filas_totales <- nrow(datos)
  datos <- .cm_expl_aplicar_filtros(datos, filtros)
  filas <- nrow(datos)

  # La columna de estudiante se resuelve con los alias del motor, no con una
  # idea propia de cómo se llama un código de alumno.
  mapping <- .cm_aulas_config_mapping(list())
  col_id <- .cm_aulas_col(datos, mapping$student_id)
  por_estudiante <- identical(unidad, "estudiantes") && nzchar(col_id)
  ids <- if (por_estudiante) trimws(as.character(datos[[col_id]])) else NULL
  estudiantes <- if (nzchar(col_id)) {
    length(unique(trimws(as.character(datos[[col_id]]))[!.cm_expl_vacio(datos[[col_id]])]))
  } else NA_integer_

  columnas <- lapply(names(datos), function(nombre) {
    x <- datos[[nombre]]
    vacios <- .cm_expl_vacio(x)
    con_dato <- sum(!vacios)
    if (!con_dato) return(NULL)
    if (.cm_expl_columna_identificadora(nombre, x, filas)) return(NULL)
    numerica <- .cm_expl_es_numerica(x)
    distintos <- length(unique(trimws(as.character(x[!vacios]))))
    sin_dato <- sum(vacios)
    # Una numérica del CURSO no admite lectura por persona —un estudiante lleva
    # varios cursos con niveles distintos— y se queda por filas.
    por_persona_aqui <- por_estudiante && (!numerica || !duplicated_ok(nombre, mapping))
    if (por_persona_aqui) {
      # El total tiene que hablar la misma unidad que el reparto: con las
      # categorías contando personas y el total contando filas, los porcentajes
      # salían sobre 23.301 matrículas y ninguno llegaba al 20%.
      con_persona <- unique(ids[!vacios & nzchar(ids)])
      con_dato <- length(con_persona)
      sin_dato <- length(setdiff(unique(ids[nzchar(ids)]), con_persona))
    }
    base <- list(
      columna = nombre,
      tipo = if (numerica) "numerica" else "categorica",
      con_dato = as.integer(con_dato),
      sin_dato = as.integer(sin_dato),
      distintos = as.integer(distintos)
    )
    if (numerica) {
      # Una numérica del estudiante (edad, ciclo) se describe una vez por
      # persona; una del curso se deja por filas, que es lo que el archivo dice.
      # Un valor por persona, tomando su primer registro CON dato: deduplicar
      # sobre todas las filas dejaba fuera al estudiante cuya primera matrícula
      # traía el campo vacío, y entonces el histograma no sumaba el total.
      valores <- if (por_persona_aqui) x[!vacios][!duplicated(ids[!vacios])] else x
      base$resumen <- .cm_expl_perfil_numerico(valores)
    } else {
      reparto <- .cm_expl_top(x, top, cola_max, ids)
      base$categorias <- reparto$categorias
      base$otras <- reparto$otras
    }
    base
  })
  columnas <- Filter(Negate(is.null), columnas)

  list(
    schema = "calc_muestra_explorador_base_v1",
    sheet = sheet,
    filas = as.integer(filas),
    filas_base = as.integer(filas_totales),
    estudiantes = if (is.na(estudiantes)) NULL else as.integer(estudiantes),
    unidad = if (por_estudiante) "estudiantes" else "filas",
    # La superficie necesita saber si pudo contar personas: sin columna de
    # estudiante el conmutador no debe ofrecer una unidad que no existe.
    unidad_disponible = nzchar(col_id),
    columnas = columnas
  )
}
