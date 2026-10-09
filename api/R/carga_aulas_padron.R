# carga_aulas_padron.R — el padrón que traduce un código de alumno a su nivel.
#
# **Por qué existe.** Las metas de CCSS Perfil 2026-II son por NIVEL CURRICULAR,
# y el nivel de una respuesta no está en la respuesta: está en la persona. La
# encuesta pide el código PUCP, y ese código hay que traducirlo. Pero el nivel
# per-persona no sobrevive a ninguna de las dos puertas por las que podría
# llegar:
#
#   - el marco lo COLAPSA a la moda del aula al construir `aula_frame`
#     (`calc_muestra_aulas.R`), así que del marco sale «el nivel de esta aula»,
#     no «el nivel de esta persona»;
#   - y el `.pulso` SUBROGA los códigos de alumno sin guardar el mapa (F114,
#     `project_pulso.R`), a propósito, para poder decir «estas dos aulas
#     comparten 7 alumnos» sin poder nombrar a ninguno.
#
# Las dos decisiones son correctas y no se tocan. Lo que falta es una tabla
# mínima, cargada aparte, que sólo sirva para traducir.
#
# **Lo que guarda, y nada más**: código → nivel, carrera, sexo. No el nombre, no
# el correo, no el aula, no el curso. El padrón es un traductor, no una base. Y
# como contiene un identificador directo —el clasificador de PII de la app mete
# `codigo_pucp` en el mismo balde que DNI y pasaporte— el estudio que lo use se
# declara NO anónimo y el padrón se purga: a mano cuando el campo cierra, y
# automáticamente en toda copia que sale.
#
# **La columna del nivel se EXIGE, no se adivina.** El mapeo del motor acepta
# nueve alias para el rol `level` —`nivel_curricular`, `nivel_creditos`,
# `ciclo`, `nivel_segun_creditos`…— y toma el primero que encuentra. Con la base
# de la DTI, que trae dos de ellos, eso convierte una decisión metodológica en
# una carrera de alias. Y no son equivalentes: medido sobre las 1.354 personas
# de Ciencias Sociales, `NIVEL_CURRICULAR` (5 a 12) y `NIVEL_CREDITOS` (1 a 7)
# coinciden en 11 casos; la diferencia modal es 4 pero sólo en el 56 %. Una es
# dónde te pone la currícula, la otra cuánto has avanzado en créditos. Aquí se
# pide la columna por nombre y, si sólo aparece la otra, se avisa en vez de
# usarla callando.
#
# Tolerancias, con el patrón de `carga_disponibilidad_aplicadores` y
# `carga_daa_iagen`: se lee lo legible y se avisa lo que no, en
# `attr(, "avisos")`, que el endpoint emite entero.

.cap_SCHEMA <- "monitoreo_aulas_padron_v1"

# Los nombres de columna que se buscan por rol. `nivel` va PRIMERO por la
# curricular y no lleva las de créditos: son la trampa que este lector existe
# para no pisar (ver cabecera).
.CAP_ROLES <- list(
  codigo = c("alumno", "codigo", "codigo_pucp", "codigo_alumno", "cod_alumno",
             "codigo_estudiante", "id_estudiante", "cod_pucp"),
  nivel = c("nivel_curricular", "nivel curricular"),
  carrera = c("carrera", "especialidad", "programa", "nombreesp"),
  sexo = c("sexo", "sex", "genero", "gender")
)

# Los nombres que NO sirven como nivel pero que alguien podría creer que sí.
# Se nombran para poder avisar con precisión en vez de decir «falta el nivel».
.CAP_NIVEL_IMPOSTORES <- c("nivel_creditos", "nivel creditos", "nivel_segun_creditos",
                           "nivel_por_creditos", "ciclo_actual", "ciclo actual")

# Normalización de nombre de columna: sin tildes, sin espacios dobles, minúscula
# y con guion bajo. ASCII-fold ANTES de tolower, por el mismo motivo que en
# `carga_disponibilidad_aplicadores`: `tolower("Ó")` depende del locale del
# proceso y `chartr` no.
.cap_clave <- function(x) {
  v <- as.character(x %||% "")
  v[is.na(v)] <- ""
  v <- chartr("ÁÉÍÓÚÑáéíóúñ", "AEIOUNaeioun", v)
  v <- tolower(trimws(v))
  gsub("[^a-z0-9]+", "_", v)
}

# La columna de un rol en el data.frame, o "" si ninguna calza.
.cap_columna <- function(df, candidatos) {
  if (!is.data.frame(df) || !ncol(df)) return("")
  claves <- .cap_clave(names(df))
  idx <- match(.cap_clave(candidatos), claves, nomatch = 0L)
  idx <- idx[idx > 0L]
  if (length(idx)) names(df)[[idx[[1L]]]] else ""
}

# **La cabecera no está en la fila 1.** La extracción tal como la entrega la DTI
# abre con un banner de seis filas —«Reporte de Estudiantes matriculados», el
# número de solicitud, «Información al 07/09/2026», y el aviso legal de uso—
# seguido de cinco filas vacías: la cabecera real está en la 12. Leerla a ciegas
# devuelve una sola columna llamada «Reporte de Estudiantes matriculados» y el
# lector concluía, con razón aparente, que el archivo no traía las columnas.
#
# Así que se busca la fila de cabecera: la primera que nombre a la vez el código
# del alumno y su nivel. Y de paso se recoge del banner la FECHA de la
# información, que es la vigencia del padrón y lo único que atrapa un archivo
# del ciclo anterior.
.cap_vigencia <- function(lineas) {
  txt <- paste(as.character(lineas[!is.na(lineas)]), collapse = " ")
  m <- regmatches(txt, regexpr("[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}", txt))
  if (!length(m)) return("")
  partes <- strsplit(m[[1]], "/", fixed = TRUE)[[1]]
  sprintf("%s-%02d-%02d", partes[[3]], as.integer(partes[[2]]), as.integer(partes[[1]]))
}

.cap_leer_hoja <- function(path, hoja) {
  crudo <- tryCatch(
    openxlsx::read.xlsx(path, sheet = hoja, colNames = FALSE, rows = 1:40,
                        skipEmptyRows = FALSE, skipEmptyCols = FALSE),
    error = function(e) NULL
  )
  if (!is.data.frame(crudo) || !nrow(crudo)) return(NULL)
  fila_cab <- 0L
  for (i in seq_len(nrow(crudo))) {
    celdas <- as.character(unlist(crudo[i, ], use.names = FALSE))
    celdas <- celdas[!is.na(celdas) & nzchar(trimws(celdas))]
    if (length(celdas) < 3L) next
    falso <- stats::setNames(as.data.frame(matrix("", 1, length(celdas)),
                                          stringsAsFactors = FALSE), celdas)
    if (nzchar(.cap_columna(falso, .CAP_ROLES$codigo)) &&
        nzchar(.cap_columna(falso, .CAP_ROLES$nivel))) {
      fila_cab <- i
      break
    }
  }
  if (!fila_cab) return(NULL)
  d <- tryCatch(
    openxlsx::read.xlsx(path, sheet = hoja, startRow = fila_cab,
                        skipEmptyRows = FALSE, skipEmptyCols = FALSE),
    error = function(e) NULL
  )
  if (!is.data.frame(d) || !nrow(d)) return(NULL)
  if (fila_cab > 1L) {
    attr(d, "vigencia") <- .cap_vigencia(unlist(crudo[seq_len(fila_cab - 1L), ],
                                                use.names = FALSE))
  }
  d
}

# El código tal como se va a comparar: sin espacios, sin puntuación de adorno,
# en mayúscula. Se normaliza aquí y en el cruce con la MISMA función, porque un
# padrón que guarda «20191234» y una respuesta que trae « 20191234 » tienen que
# encontrarse.
#' Normaliza un código de alumno para poder cruzarlo.
#'
#' @param x códigos tal como vienen del padrón o de la respuesta.
#' @return los códigos normalizados (mayúscula, sin separadores).
#' @export
monitoreo_aulas_codigo_key <- function(x) {
  v <- as.character(x %||% "")
  v[is.na(v)] <- ""
  toupper(gsub("[^A-Za-z0-9]", "", trimws(v)))
}

# Las claves que el filtro de poblacion conoce. Lista CERRADA: lo que no esta
# aqui no se ignora, se RECHAZA (el porque, dentro de la funcion).
#
# **Va antes del bloque roxygen de `carga_aulas_padron()`, no entre el roxygen
# y su funcion.** Metida en medio, el `@export` se pega a ESTA constante y la
# funcion desaparece del NAMESPACE: el contrato lo caza, pero cuesta un gate.
.CAP_FILTRO_CLAVES <- c("facultades", "carreras", "condiciones", "niveles",
                        "edad_minima")

#' El padrón de elegibles, leído de la base de matriculados.
#'
#' Deriva la tabla mínima que traduce un código de alumno a su nivel, su carrera
#' y su sexo. Exige la columna del nivel CURRICULAR por nombre: si la base sólo
#' trae la de créditos, avisa en vez de usarla (no son equivalentes, y la
#' decisión es metodológica, no de parseo).
#'
#' Tolerancias: una fila sin código se salta con aviso; un nivel no numérico
#' queda vacío con aviso y esa persona no podrá acreditar celda; un código
#' repetido se queda con su primera aparición y avisa (dos filas del mismo
#' alumno son dos matrículas, no dos personas).
#'
#' **El filtro de población se DECLARA.** Medido el 2026-09-17 sobre la
#' extracción 212139: sin filtro el lector devuelve 22.746 personas de todo
#' pregrado —Arquitectura, Derecho, Danza—, no las 783 del estudio. Y eso rompe
#' la semántica del cruce: si «resuelve en el padrón» significa «es población»,
#' un alumno de otra facultad sentado en un aula seleccionada acreditaría celda
#' sin serlo. El padrón tiene que CONTENER la población, así que se le dice
#' cuál es. Sin filtro carga igual, con un aviso fuerte, porque un padrón de
#' toda la universidad es casi siempre un archivo equivocado.
#'
#' @param path ruta al `.xlsx` de matriculados.
#' @param hoja nombre de la hoja; por defecto la primera que traiga las
#'   columnas necesarias.
#' @param filtro lista con la población del estudio, toda opcional. Sus claves
#'   son `facultades`, `carreras`, `condiciones`, `niveles` y `edad_minima`, y
#'   **una clave que no esté en esa lista se rechaza** en vez de ignorarse:
#'   `carreras` es el estrato cuando el estudio vive en UNA facultad (dictado de
#'   Gonzalo, 2026-09-17), y llamar a esta función con una clave inventada hacía
#'   que cargara la universidad entera con un aviso de «sin filtro». Detalle:
#'   `facultades` (vector de nombres), `niveles` (vector de enteros),
#'   `edad_minima` (entero), `condiciones` (vector de condiciones de matrícula
#'   admitidas).
#' @return lista `monitoreo_aulas_padron_v1`; avisos en `attr(, "avisos")`.
#' @export
carga_aulas_padron <- function(path, hoja = NULL, filtro = list()) {
  if (!is.character(path) || length(path) != 1L || is.na(path) ||
      !nzchar(path) || !file.exists(path)) {
    stop_api(400, "E_AULAS_PADRON_NO_EXISTE",
             "No se encontro el archivo de matriculados del que sale el padron.")
  }
  hojas <- tryCatch(openxlsx::getSheetNames(path), error = function(e) character(0))
  if (!length(hojas)) {
    stop_api(422, "E_AULAS_PADRON_SIN_COLUMNAS",
             "El archivo no tiene hojas legibles.")
  }
  candidatas <- if (is.character(hoja) && length(hoja) == 1L && nzchar(hoja)) hoja else hojas

  avisos <- character(0)
  # **Se busca la hoja que traiga las columnas, no la primera.** La base de la
  # DTI viaja con hojas hermanas —«Excluidos», «Trazabilidad», «SQL original»—
  # y leer la primera a ciegas devolvía el SQL como si fuera data.
  elegida <- ""
  df <- NULL
  vigencia <- ""
  for (h in candidatas) {
    d <- .cap_leer_hoja(path, h)
    if (is.null(d)) next
    if (nzchar(.cap_columna(d, .CAP_ROLES$codigo)) &&
        nzchar(.cap_columna(d, .CAP_ROLES$nivel))) {
      elegida <- h
      df <- d
      vigencia <- attr(d, "vigencia") %||% ""
      break
    }
  }

  if (is.null(df)) {
    # Se distingue «no está el nivel curricular» de «no está ninguna columna»,
    # porque son dos arreglos distintos: pedir otra extracción a la DTI, o
    # revisar que el archivo sea el que se cree.
    impostor <- ""
    for (h in candidatas) {
      d <- tryCatch(
        openxlsx::read.xlsx(path, sheet = h, colNames = FALSE, rows = 1:40,
                            skipEmptyRows = FALSE, skipEmptyCols = FALSE),
        error = function(e) NULL)
      if (!is.data.frame(d)) next
      celdas <- as.character(unlist(d, use.names = FALSE))
      celdas <- celdas[!is.na(celdas) & nzchar(trimws(celdas))]
      hit <- celdas[.cap_clave(celdas) %in% .cap_clave(.CAP_NIVEL_IMPOSTORES)]
      if (length(hit)) { impostor <- hit[[1]]; break }
    }
    if (nzchar(impostor)) {
      stop_api(
        422, "E_AULAS_PADRON_NIVEL_AUSENTE",
        sprintf(paste(
          "El archivo trae «%s» pero no el nivel curricular, y no son lo mismo:",
          "una dice en que ciclo te pone la curricula y la otra cuanto has",
          "avanzado en creditos. Pide la extraccion con NIVEL_CURRICULAR."
        ), impostor)
      )
    }
    stop_api(
      422, "E_AULAS_PADRON_SIN_COLUMNAS",
      "Ninguna hoja trae a la vez el codigo del alumno y su nivel curricular."
    )
  }

  col_cod <- .cap_columna(df, .CAP_ROLES$codigo)
  col_niv <- .cap_columna(df, .CAP_ROLES$nivel)
  col_car <- .cap_columna(df, .CAP_ROLES$carrera)
  col_sex <- .cap_columna(df, .CAP_ROLES$sexo)
  if (!nzchar(col_car)) avisos <- c(avisos, "El padron no trae carrera: el panel referencial de carrera queda sin dato.")
  if (!nzchar(col_sex)) avisos <- c(avisos, "El padron no trae sexo: el panel referencial de sexo queda sin dato.")

  # **El recorte a la población del estudio, antes de derivar nada.** Se aplica
  # aquí y no en el cruce porque el cruce ya no puede: el `.pulso` subrogó los
  # códigos del marco sin guardar el mapa (F114), así que no hay contra qué
  # comparar la identidad. El padrón ES la definición de población, y se declara.
  if (!is.list(filtro)) filtro <- list()
  # **Una clave que el filtro no conoce NO se traga en silencio.**
  #
  # Me pasó el 2026-09-17 llamando a esta función con
  # `list(columna = "FACULTAD", valores = "CIENCIAS SOCIALES")`: ninguna de las
  # dos claves existe, el filtro no se aplicó y el padrón cargó **25.403
  # personas de toda la universidad** con su aviso de «sin filtro» — que es
  # cierto y no es el que hacía falta. Un padrón de la universidad entera
  # traduce códigos de gente que no es del estudio, así que el error es del tipo
  # que hay que gritar, no deducir.
  desconocidas <- setdiff(names(filtro) %||% character(0), .CAP_FILTRO_CLAVES)
  if (length(desconocidas)) {
    stop_api(400, "E_AULAS_PADRON_FILTRO_CLAVE", sprintf(
      "El filtro de poblacion no conoce %s. Las claves son: %s.",
      paste(sprintf("«%s»", desconocidas), collapse = ", "),
      paste(.CAP_FILTRO_CLAVES, collapse = ", ")))
  }
  antes <- nrow(df)
  recorte <- function(columna, candidatos, etiqueta, normaliza = .cap_clave) {
    valores <- .monitoreo_chr_vec(candidatos)
    if (!length(valores) || !nzchar(columna)) return(invisible(NULL))
    ok <- normaliza(df[[columna]]) %in% normaliza(valores)
    if (!any(ok)) {
      # Cero coincidencias casi nunca es «esta poblacion no existe»: es que se
      # esta comparando un codigo contra un nombre. La leccion es del cruce de
      # facultad declarada, que se niega a publicar «100 % de desacuerdo»
      # cuando lo que falla es la comparacion.
      stop_api(422, "E_AULAS_PADRON_FILTRO_SIN_COINCIDENCIAS", sprintf(
        "Ninguna fila calza con el filtro de %s. Revisa como se escriben los valores en la columna «%s».",
        etiqueta, columna))
    }
    df <<- df[ok, , drop = FALSE]
    invisible(NULL)
  }
  recorte(.cap_columna(df, c("facultad", "nombrefac", "unidad_academica")),
          filtro$facultades, "facultad")
  # **Y por CARRERA, que es el estrato cuando el estudio vive en UNA facultad.**
  #
  # Gonzalo, 2026-09-17, sobre la base de la DTI: «aquí en vez de facultad debe
  # ser carrera, para este estudio donde la carrera es el estrato, no la
  # facultad». Filtrar por facultad en CCSS Perfil 2026-II no acota nada —toda
  # la población es Ciencias Sociales— y la agrupación que sí significa algo es
  # la de sus seis carreras. Las dos vías conviven: un estudio que cruza
  # facultades sigue filtrando por facultad.
  recorte(.cap_columna(df, .CAP_ROLES$carrera), filtro$carreras, "carrera")
  recorte(.cap_columna(df, c("condicion_matricula", "condicion_de_matricula")),
          filtro$condiciones, "condicion de matricula")

  col_edad <- .cap_columna(df, c("edad"))
  edad_min <- suppressWarnings(as.integer(filtro$edad_minima %||% NA_integer_))
  if (is.finite(edad_min) && nzchar(col_edad)) {
    edades <- suppressWarnings(as.integer(trimws(as.character(df[[col_edad]]))))
    # Una edad ilegible NO se asume mayor de edad: se descarta con aviso.
    df <- df[is.finite(edades) & edades >= edad_min, , drop = FALSE]
  }
  niveles_ok <- suppressWarnings(as.integer(.monitoreo_chr_vec(filtro$niveles)))
  niveles_ok <- niveles_ok[is.finite(niveles_ok)]
  if (length(niveles_ok)) {
    n_col <- suppressWarnings(as.integer(trimws(as.character(df[[col_niv]]))))
    df <- df[is.finite(n_col) & n_col %in% niveles_ok, , drop = FALSE]
  }
  if (!nrow(df)) {
    stop_api(422, "E_AULAS_PADRON_VACIO",
             "El filtro de poblacion no dejo ninguna fila.")
  }
  declarado <- length(.monitoreo_chr_vec(filtro$facultades)) > 0L ||
    length(.monitoreo_chr_vec(filtro$carreras)) > 0L ||
    length(niveles_ok) > 0L || is.finite(edad_min) ||
    length(.monitoreo_chr_vec(filtro$condiciones)) > 0L
  if (declarado) {
    avisos <- c(avisos, sprintf("Filtro de poblacion aplicado: %d de %d filas.",
                                nrow(df), antes))
  } else {
    # Aviso fuerte a proposito. Un padron sin filtro traduce codigos de gente
    # que no es poblacion del estudio, y como «resuelve en el padron» significa
    # «es poblacion», eso acredita celdas que no corresponden.
    avisos <- c(avisos, paste(
      "El padron se cargo SIN filtro de poblacion: traduce a cualquiera que",
      "figure en el archivo, no solo a la poblacion del estudio. Declara al",
      "menos la facultad y los niveles."))
  }

  codigos <- monitoreo_aulas_codigo_key(df[[col_cod]])
  niveles <- suppressWarnings(as.integer(trimws(as.character(df[[col_niv]]))))
  carreras <- if (nzchar(col_car)) trimws(as.character(df[[col_car]])) else rep("", length(codigos))
  sexos <- if (nzchar(col_sex)) trimws(as.character(df[[col_sex]])) else rep("", length(codigos))
  carreras[is.na(carreras)] <- ""
  sexos[is.na(sexos)] <- ""

  sin_codigo <- !nzchar(codigos)
  if (any(sin_codigo)) {
    avisos <- c(avisos, sprintf("%d fila(s) sin codigo de alumno: se saltan.", sum(sin_codigo)))
  }
  sin_nivel <- !sin_codigo & !is.finite(niveles)
  if (any(sin_nivel)) {
    # No se imputa. Una persona sin nivel legible no puede acreditar celda, y
    # decirlo es lo unico honesto: una cifra inventada es peor que ninguna.
    avisos <- c(avisos, sprintf(
      "%d fila(s) con nivel no numerico: esas personas no podran acreditar celda.",
      sum(sin_nivel)))
  }

  ok <- !sin_codigo
  codigos <- codigos[ok]; niveles <- niveles[ok]
  carreras <- carreras[ok]; sexos <- sexos[ok]

  # **Un codigo repetido es una matricula repetida, no dos personas.** La base
  # de la DTI trae una fila por alumno x curso-horario, asi que el mismo codigo
  # aparece tantas veces como cursos lleve. Se queda la primera aparicion.
  dup <- duplicated(codigos)
  if (any(dup)) {
    avisos <- c(avisos, sprintf(
      "%d fila(s) con codigo repetido: se conserva la primera de cada persona.",
      sum(dup)))
  }
  codigos <- codigos[!dup]; niveles <- niveles[!dup]
  carreras <- carreras[!dup]; sexos <- sexos[!dup]

  if (!length(codigos)) {
    stop_api(422, "E_AULAS_PADRON_VACIO",
             "El archivo no dejo ninguna persona con codigo legible.")
  }

  filas <- lapply(seq_along(codigos), function(i) list(
    codigo = codigos[[i]],
    nivel = if (is.finite(niveles[[i]])) as.integer(niveles[[i]]) else NA_integer_,
    carrera = carreras[[i]],
    sexo = sexos[[i]]
  ))

  out <- list(
    schema = .cap_SCHEMA,
    cargado_en = .monitoreo_now_iso(),
    hoja = elegida,
    # La fecha de la informacion, del banner de la extraccion. Es lo unico que
    # atrapa un padron del ciclo anterior (comprobacion 5 del diagnostico).
    vigencia = vigencia,
    # El filtro con el que se derivo viaja CON el padron: sin el no se puede
    # decir de que poblacion es esta tabla, y el diagnostico de coherencia
    # necesita saberlo para redactar su aviso.
    filtro = list(
      facultades = as.list(.monitoreo_chr_vec(filtro$facultades)),
      niveles = as.list(niveles_ok),
      edad_minima = if (is.finite(edad_min)) edad_min else NA_integer_,
      condiciones = as.list(.monitoreo_chr_vec(filtro$condiciones)),
      declarado = declarado
    ),
    columnas = list(codigo = col_cod, nivel = col_niv,
                    carrera = col_car, sexo = col_sex),
    filas = filas
  )
  attr(out, "avisos") <- avisos
  out
}

#' Resumen del padrón, sin códigos.
#'
#' Lo que se puede publicar de un padrón: cuántas personas trae y cómo se
#' reparten. Se usa para el diagnóstico de coherencia y para el corte congelado
#' que queda cuando el padrón se purga, y por eso **no lleva ni un código**.
#'
#' @param padron el padrón cargado.
#' @return lista con los conteos por nivel, carrera y sexo.
#' @export
monitoreo_aulas_padron_resumen <- function(padron = list()) {
  filas <- if (is.list(padron)) padron[["filas"]] %||% list() else list()
  vacio <- list(schema = "monitoreo_aulas_padron_resumen_v1", personas = 0L,
                por_nivel = list(), por_carrera = list(), por_sexo = list(),
                sin_nivel = 0L)
  if (!length(filas)) return(vacio)
  conteo <- function(valores) {
    valores <- as.character(valores)
    valores <- valores[nzchar(valores) & !is.na(valores)]
    if (!length(valores)) return(list())
    t <- table(valores)
    stats::setNames(as.list(as.integer(t)), names(t))
  }
  niveles <- vapply(filas, function(f) {
    v <- suppressWarnings(as.integer(f[["nivel"]] %||% NA_integer_))
    if (is.finite(v)) as.character(v) else ""
  }, character(1))
  list(
    schema = "monitoreo_aulas_padron_resumen_v1",
    personas = length(filas),
    por_nivel = conteo(niveles),
    por_carrera = conteo(vapply(filas, function(f) as.character(f[["carrera"]] %||% ""), character(1))),
    por_sexo = conteo(vapply(filas, function(f) as.character(f[["sexo"]] %||% ""), character(1))),
    sin_nivel = sum(!nzchar(niveles))
  )
}
