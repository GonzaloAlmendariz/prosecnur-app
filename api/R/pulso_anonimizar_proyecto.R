# =============================================================================
# Anonimización de un .pulso completo — orquestación
# =============================================================================
#
# `pulso_anonimizar.R` tiene las primitivas (clasificar, seudonimizar, desplazar
# GPS). Acá vive el recorrido: abrir el zip, barrer el `state.rds` y los XLSX de
# `files/`, y regrabar un `.pulso` equivalente sin datos personales.
#
# El recorrido del state es genérico y recursivo, no una lista de ramas
# conocidas. Es deliberado: el state tiene decenas de ramas (snapshot de
# monitoreo, caches de dashboard por scope, reportes territoriales, ocurrencias)
# y una lista explícita quedaría desactualizada al primer módulo nuevo. Buscar
# todo data.frame en cualquier profundidad falla del lado seguro.
#
# Se corre en DOS pasadas sobre el proyecto entero:
#   1. Recolección — se construye el diccionario de nombres reales barriendo
#      todas las tablas (state + XLSX).
#   2. Aplicación — se anonimizan las columnas estructuradas y se barren las
#      preguntas abiertas con el diccionario COMPLETO.
# Dos pasadas y no una porque un nombre puede estar estructurado en una base y
# suelto dentro de un texto abierto de otra; con una sola pasada el segundo caso
# se escaparía según el orden de recorrido.

.PULSO_ANON_MAX_PROFUNDIDAD <- 12L

# -----------------------------------------------------------------------------
# Recorrido genérico del state
# -----------------------------------------------------------------------------

# Aplica `fn` a cada data.frame encontrado y reconstruye la estructura con el
# resultado. `fn(df, ruta)` devuelve el data.frame reemplazado.
.pulso_anon_map_dataframes <- function(x, fn, ruta = "", profundidad = 0L) {
  if (profundidad > .PULSO_ANON_MAX_PROFUNDIDAD) return(x)
  if (is.data.frame(x)) return(fn(x, ruta))
  if (!is.list(x) || !length(x)) return(x)
  nombres <- names(x)
  for (i in seq_along(x)) {
    hijo <- x[[i]]
    if (!is.list(hijo) && !is.data.frame(hijo)) next
    etiqueta <- if (!is.null(nombres) && nzchar(nombres[[i]] %||% "")) nombres[[i]] else paste0("[[", i, "]]")
    x[[i]] <- .pulso_anon_map_dataframes(hijo, fn, paste0(ruta, "/", etiqueta), profundidad + 1L)
  }
  x
}

# Igual que el anterior pero solo lee: acumula sin reconstruir.
.pulso_anon_walk_dataframes <- function(x, fn, ruta = "", profundidad = 0L) {
  if (profundidad > .PULSO_ANON_MAX_PROFUNDIDAD) return(invisible(NULL))
  if (is.data.frame(x)) { fn(x, ruta); return(invisible(NULL)) }
  if (!is.list(x) || !length(x)) return(invisible(NULL))
  nombres <- names(x)
  for (i in seq_along(x)) {
    hijo <- x[[i]]
    if (!is.list(hijo) && !is.data.frame(hijo)) next
    etiqueta <- if (!is.null(nombres) && nzchar(nombres[[i]] %||% "")) nombres[[i]] else paste0("[[", i, "]]")
    .pulso_anon_walk_dataframes(hijo, fn, paste0(ruta, "/", etiqueta), profundidad + 1L)
  }
  invisible(NULL)
}

.pulso_anon_state_como_lista <- function(s) {
  if (is.environment(s)) {
    claves <- ls(envir = s, all.names = TRUE)
    out <- stats::setNames(lapply(claves, function(k) get(k, envir = s)), claves)
    return(list(datos = out, era_env = TRUE))
  }
  list(datos = s, era_env = FALSE)
}

.pulso_anon_lista_como_state <- function(lista, era_env) {
  if (!era_env) return(lista)
  env <- new.env(parent = emptyenv())
  for (k in names(lista)) assign(k, lista[[k]], envir = env)
  env
}

# -----------------------------------------------------------------------------
# XLSX de files/
# -----------------------------------------------------------------------------

# Los inputs del proyecto viajan en `files/`. Se anonimizan las hojas de datos;
# el XLSForm (survey/choices/settings) se deja intacto porque es el instrumento,
# no la respuesta — salvo que traiga una hoja de datos embebida.
.PULSO_ANON_HOJAS_INSTRUMENTO <- c("survey", "choices", "settings", "external_choices")

.pulso_anon_es_xlsx <- function(path) grepl("\\.xlsx?$", tolower(path))

.pulso_anon_leer_hojas <- function(path) {
  hojas <- tryCatch(readxl::excel_sheets(path), error = function(e) character())
  out <- list()
  for (h in hojas) {
    if (tolower(h) %in% .PULSO_ANON_HOJAS_INSTRUMENTO) next
    df <- tryCatch(
      readxl::read_excel(path, sheet = h, col_types = "text", .name_repair = "minimal"),
      error = function(e) NULL
    )
    if (is.data.frame(df) && nrow(df)) out[[h]] <- as.data.frame(df, stringsAsFactors = FALSE)
  }
  out
}

# -----------------------------------------------------------------------------
# API principal
# -----------------------------------------------------------------------------

#' Anonimiza un .pulso real y escribe un fixture publicable.
#'
#' @param origen ruta al .pulso real
#' @param destino ruta del .pulso anonimizado a escribir
#' @param sal cadena secreta que ancla los seudónimos. Misma sal -> mismo
#'   resultado; sales distintas producen fixtures no correlacionables entre sí.
#' @param slug identificador del proyecto, usado en el reporte.
#' @return lista con el reporte de lo que se tocó.
pulso_anonimizar_archivo <- function(origen, destino, sal, slug = NULL) {
  if (!file.exists(origen)) {
    stop(sprintf("No encuentro el .pulso de origen: %s", origen), call. = FALSE)
  }
  if (!nzchar(sal %||% "")) {
    stop("La sal de anonimizacion no puede ser vacia.", call. = FALSE)
  }
  slug <- slug %||% tools::file_path_sans_ext(basename(origen))
  offset <- .pulso_pii_gps_offset(sal)

  stage <- tempfile("pulso-anon-"); dir.create(stage, recursive = TRUE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  zip::unzip(origen, exdir = stage)

  state_path <- file.path(stage, "state.rds")
  if (!file.exists(state_path)) {
    stop(sprintf("El .pulso no tiene state.rds: %s", origen), call. = FALSE)
  }
  s_raw <- readRDS(state_path)
  envuelto <- .pulso_anon_state_como_lista(s_raw)
  estado <- envuelto$datos

  # Deduplicar ANTES de tocar nada. Dos copias del mismo input son idénticas
  # byte a byte mientras nadie las reescriba; en cuanto el anonimizador las
  # regraba con openxlsx dejan de serlo —el formato xlsx es un zip y cada
  # escritura produce metadatos distintos— y el hash ya no las agrupa. Hacerlo
  # primero además ahorra anonimizar el mismo archivo dos veces.
  dedup <- .pulso_anon_deduplicar_files(estado, file.path(stage, "files"))
  estado <- dedup$estado

  archivos <- list.files(file.path(stage, "files"), full.names = TRUE, recursive = TRUE)
  archivos_xlsx <- archivos[.pulso_anon_es_xlsx(archivos)]

  # --- Pasada 1: diccionario global de nombres -------------------------------
  diccionario <- character()
  acumular <- function(df, ruta) {
    res <- pulso_anonimizar_data(df, sal = sal, offset_gps = offset)
    nuevos <- res$diccionario[!(names(res$diccionario) %in% names(diccionario))]
    diccionario <<- c(diccionario, nuevos)
    invisible(NULL)
  }
  .pulso_anon_walk_dataframes(estado, acumular, ruta = "state")
  hojas_por_archivo <- list()
  for (p in archivos_xlsx) {
    hojas <- .pulso_anon_leer_hojas(p)
    if (!length(hojas)) next
    hojas_por_archivo[[p]] <- hojas
    for (h in names(hojas)) acumular(hojas[[h]], paste0(basename(p), "!", h))
  }

  # --- Pasada 2: aplicar ------------------------------------------------------
  reporte_tablas <- list()
  aplicar <- function(df, ruta) {
    res <- pulso_anonimizar_data(df, sal = sal, offset_gps = offset)
    abiertas <- pulso_anonimizar_abiertas(res$data, diccionario, sal = sal)
    if (length(res$columnas) || abiertas$reemplazos > 0) {
      reporte_tablas[[length(reporte_tablas) + 1L]] <<- list(
        ruta = ruta,
        filas = nrow(df),
        columnas_pii = res$columnas,
        columnas_abiertas = abiertas$columnas,
        reemplazos_abiertas = abiertas$reemplazos
      )
    }
    abiertas$data
  }
  estado <- .pulso_anon_map_dataframes(estado, aplicar, ruta = "state")

  for (p in names(hojas_por_archivo)) {
    hojas <- hojas_por_archivo[[p]]
    tocado <- FALSE
    for (h in names(hojas)) {
      nueva <- aplicar(hojas[[h]], paste0(basename(p), "!", h))
      if (!identical(nueva, hojas[[h]])) { hojas[[h]] <- nueva; tocado <- TRUE }
    }
    if (!tocado) next
    # Reescribir solo las hojas de datos, preservando las del instrumento.
    .pulso_anon_reescribir_xlsx(p, hojas)
  }

  saveRDS(.pulso_anon_lista_como_state(estado, envuelto$era_env), state_path)

  # Marca de procedencia en el manifest: un fixture publicado debe declarar que
  # fue anonimizado, para que nadie lo confunda con el proyecto del cliente.
  manifest_path <- file.path(stage, "manifest.json")
  if (file.exists(manifest_path)) {
    manifest <- jsonlite::fromJSON(manifest_path, simplifyVector = FALSE)
    manifest$anonimizacion <- list(
      schema = PULSO_ANONIMIZACION_SCHEMA,
      slug = slug,
      aplicada = TRUE,
      tablas_tocadas = length(reporte_tablas)
    )
    writeLines(jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE), manifest_path)
  }

  dir.create(dirname(destino), recursive = TRUE, showWarnings = FALSE)
  if (file.exists(destino)) unlink(destino, force = TRUE)
  entradas <- list.files(stage, recursive = FALSE)
  zip::zip(zipfile = destino, files = entradas, root = stage)

  list(
    schema = PULSO_ANONIMIZACION_SCHEMA,
    slug = slug,
    origen = origen,
    destino = destino,
    tablas = reporte_tablas,
    n_tablas_tocadas = length(reporte_tablas),
    n_nombres_seudonimizados = length(diccionario),
    files_deduplicados = dedup$eliminados,
    gps_offset = offset
  )
}

# -----------------------------------------------------------------------------
# Deduplicación de inputs por contenido
# -----------------------------------------------------------------------------

# Un proyecto real puede terminar con el MISMO archivo registrado bajo dos
# `file_id` distintos —el marco muestral de HSVG viajaba dos veces, 11.5 MB cada
# copia, porque se cargó una vez por cada pestaña que lo necesitaba—. Como los
# `file_id` son distintos, `build_pulso` los trata como inputs separados y copia
# ambos.
#
# Se agrupan los archivos por sha256, se elige un canónico por grupo y se
# reescribe el state para que todas las referencias apunten a él. El reemplazo
# es sobre strings exactos: un `file_id` es un UUID, no aparece como fragmento
# de otra cosa, así que sustituirlo donde sea que esté es seguro.
.pulso_anon_deduplicar_files <- function(estado, files_dir) {
  if (!dir.exists(files_dir)) return(list(estado = estado, eliminados = character()))
  archivos <- list.files(files_dir, full.names = TRUE, recursive = TRUE)
  if (length(archivos) < 2) return(list(estado = estado, eliminados = character()))

  hashes <- vapply(archivos, function(p) digest::digest(file = p, algo = "sha256"),
                   character(1), USE.NAMES = FALSE)
  # El nombre en el zip es "<file_id>__<nombre original>".
  fids <- sub("__.*$", "", basename(archivos))

  # El registro de canónicos va en un environment y no en una lista: `l[["x"]]`
  # sobre una lista que no tiene esa clave no devuelve NULL, revienta con
  # "subindice fuera de los limites".
  canon <- new.env(parent = emptyenv())
  alias <- character()
  eliminados <- character()
  for (i in seq_along(archivos)) {
    h <- hashes[[i]]
    if (!exists(h, envir = canon, inherits = FALSE)) {
      assign(h, fids[[i]], envir = canon)
      next
    }
    alias[fids[[i]]] <- get(h, envir = canon)
    unlink(archivos[[i]], force = TRUE)
    eliminados <- c(eliminados, fids[[i]])
  }
  if (!length(alias)) return(list(estado = estado, eliminados = character()))

  estado <- .pulso_anon_reemplazar_strings(estado, alias)
  if (is.list(estado$files)) {
    estado$files <- estado$files[setdiff(names(estado$files), names(alias))]
  }
  list(estado = estado, eliminados = eliminados)
}

# Sustituye, en cualquier profundidad, los valores de texto que coinciden
# exactamente con alguna clave de `mapa` (y las claves de listas nombradas).
.pulso_anon_reemplazar_strings <- function(x, mapa, profundidad = 0L) {
  if (profundidad > .PULSO_ANON_MAX_PROFUNDIDAD) return(x)
  if (is.character(x)) {
    hit <- x %in% names(mapa)
    if (any(hit)) x[hit] <- unname(mapa[x[hit]])
    return(x)
  }
  if (is.data.frame(x) || !is.list(x) || !length(x)) return(x)
  for (i in seq_along(x)) {
    # `is.list()` es TRUE para objetos que no se indexan como una lista simple
    # (clases con `[[` propio, estructuras con atributos donde `length()` y los
    # índices válidos no coinciden). Acceder a ciegas revienta con "subindice
    # fuera de los limites"; una rama que no se puede leer se deja como está.
    hijo <- tryCatch(x[[i]], error = function(e) NULL)
    if (is.null(hijo)) next
    nuevo <- .pulso_anon_reemplazar_strings(hijo, mapa, profundidad + 1L)
    if (!identical(nuevo, hijo)) {
      asignado <- tryCatch({ x[[i]] <- nuevo; TRUE }, error = function(e) FALSE)
      if (!asignado) next
    }
  }
  nms <- names(x)
  if (!is.null(nms)) {
    hit <- nms %in% names(mapa)
    if (any(hit)) {
      nms[hit] <- unname(mapa[nms[hit]])
      names(x) <- nms
    }
  }
  x
}

.pulso_anon_reescribir_xlsx <- function(path, hojas_datos) {
  wb <- tryCatch(openxlsx::loadWorkbook(path), error = function(e) NULL)
  if (is.null(wb)) return(invisible(FALSE))
  existentes <- names(wb)
  for (h in names(hojas_datos)) {
    if (!(h %in% existentes)) next
    openxlsx::removeWorksheet(wb, h)
    openxlsx::addWorksheet(wb, h)
    openxlsx::writeData(wb, h, hojas_datos[[h]])
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(TRUE)
}

# -----------------------------------------------------------------------------
# Auditoría de un fixture ya escrito
# -----------------------------------------------------------------------------

#' Busca PII residual en un .pulso. Es el gate: si devuelve filas, el fixture no
#' se publica.
#'
#' Escanea por CONTENIDO las columnas que la clasificación por nombre NO marca
#' como PII. Ese reparto no es arbitrario: la garantía se construye en dos capas
#' que cubren huecos distintos.
#'
#'   - Las columnas clasificadas como PII las garantiza el anonimizador por
#'     construcción — toda columna que matchea un patrón es reemplazada, y los
#'     tests unitarios verifican que el reemplazo no deja rastro del original.
#'   - Las columnas NO clasificadas son el hueco real: una columna de nombre
#'     inocente (`nota`, `observacion`, `detalle_incidencia`) con un correo o un
#'     celular escrito adentro. Eso es lo que este detector busca.
#'
#' Escanearlas todas sería peor que inútil: el anonimizador preserva la FORMA
#' del dato (correo con dominio institucional, celular de nueve dígitos que
#' arranca en 9) justamente para que los parsers y validadores de la app se
#' sigan ejercitando, así que los seudónimos matchean los mismos patrones que
#' los originales. Un detector que mirara esas columnas reportaría el 100% de
#' los fixtures correctos como sucios y se volvería ruido que nadie lee.
#'
#' @param incluir_columnas_pii escanear también las columnas clasificadas como
#'   PII. Solo para depurar el anonimizador; con `TRUE` los seudónimos legítimos
#'   aparecen como hallazgos.
pulso_detectar_pii <- function(path, max_ejemplos = 3L, incluir_columnas_pii = FALSE) {
  stage <- tempfile("pulso-pii-"); dir.create(stage, recursive = TRUE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  zip::unzip(path, exdir = stage)

  patrones <- list(
    correo = "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
    celular_pe = "(?<![0-9])9[0-9]{8}(?![0-9])",
    dni_pe = "(?<![0-9])[0-9]{8}(?![0-9])"
  )
  # Dominios que el propio anonimizador emite: no son hallazgos. El seudónimo
  # conserva el dominio de origen como prefijo y cierra bajo `example.test`
  # (`alguien@pucp.edu.pe.example.test`), así que el ancla no puede exigir la
  # arroba pegada: basta con que el correo TERMINE en el TLD reservado.
  correo_sintetico <- "(^|@|\\.)example\\.test$"

  hallazgos <- list()
  registrar <- function(df, ruta) {
    if (!is.data.frame(df) || !nrow(df)) return(invisible(NULL))
    for (nm in names(df)) {
      # Una columna que el clasificador reconoce como PII (`email_address`,
      # `telefono`, `dni`) NO se salta entera: se salta solo para los patrones
      # cuyo seudónimo es indistinguible del dato real.
      #
      # El correo sí se escanea, porque desde que los seudónimos se emiten bajo
      # `.example.test` se reconocen por dominio. Un DNI o un celular sintético,
      # en cambio, preserva la forma —8 y 9 dígitos— y no hay manera de
      # separarlo de uno auténtico: marcarlos convertiría el gate en ruido.
      #
      # Saltarse la columna entera era lo que dejaba pasar un correo real
      # sobreviviente: comprobado inyectando uno en `email_address` de una data
      # adaptada, el gate devolvía «sin PII detectable».
      col_es_pii <- !is.na(.pulso_pii_clasificar_columna(nm))
      col <- df[[nm]]
      if (!is.character(col) && !is.factor(col)) next
      v <- as.character(col)
      v <- v[!is.na(v) & nzchar(v)]
      if (!length(v)) next
      for (tipo in names(patrones)) {
        if (col_es_pii && !incluir_columnas_pii && tipo != "correo") next
        hits <- grepl(patrones[[tipo]], v, perl = TRUE)
        if (tipo == "correo") hits <- hits & !grepl(correo_sintetico, v)
        # Mismo criterio que el anonimizador: una fecha compacta yyyymmdd no es
        # un documento. Sin esta exclusión el gate rechazaría todo fixture de
        # campo por sus propias fechas de captura.
        if (tipo == "dni_pe") hits <- hits & !.pulso_pii_solo_fechas_compactas(v)
        if (!any(hits)) next
        hallazgos[[length(hallazgos) + 1L]] <<- data.frame(
          ruta = ruta, columna = nm, tipo = tipo,
          n = sum(hits),
          ejemplo = paste(utils::head(v[hits], max_ejemplos), collapse = " | "),
          stringsAsFactors = FALSE
        )
      }
    }
    invisible(NULL)
  }

  state_path <- file.path(stage, "state.rds")
  if (file.exists(state_path)) {
    s <- readRDS(state_path)
    envuelto <- .pulso_anon_state_como_lista(s)
    .pulso_anon_walk_dataframes(envuelto$datos, registrar, ruta = "state")
  }
  for (p in list.files(file.path(stage, "files"), full.names = TRUE, recursive = TRUE)) {
    if (!.pulso_anon_es_xlsx(p)) next
    hojas <- .pulso_anon_leer_hojas(p)
    for (h in names(hojas)) registrar(hojas[[h]], paste0(basename(p), "!", h))
  }

  if (!length(hallazgos)) {
    return(data.frame(ruta = character(), columna = character(), tipo = character(),
                      n = integer(), ejemplo = character(), stringsAsFactors = FALSE))
  }
  do.call(rbind, hallazgos)
}
