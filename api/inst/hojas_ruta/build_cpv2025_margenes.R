#!/usr/bin/env Rscript
# Márgenes del CPV 2025 por distrito para las cuotas de persona y la calibración de
# pesos del estudio urbano multiciudad (ADR 0131), sobre los 164 distritos de
# territorios.json (ADR 0119).
#
# Fuente: REDATAM web del INEI, base CPV2025DI (https://redatamcpv2025.inei.gob.pe),
# procesador CrossTab, población censada (sin la omisión estimada), quiebre por DISTRITO.
#
# Salidas (gzip -n, filas ordenadas, sin marca de tiempo):
#   cpv2025_edad_simple_distrito.csv.gz
#     ubigeo × edad simple (todas las edades) × sexo. Mismo esquema que
#     inei2017_ciudades_edad_simple_distrito.csv.gz, para que la capa `edad` pueda
#     cambiar de año sin cambiar de lector.
#   cpv2025_margenes_distrito.csv.gz
#     ubigeo × sexo × grupo quinquenal (18-19, 20-24, ..., 85+) × último nivel de estudio
#     aprobado, sólo población de 18 años a más. `grupo_edad` agrupa los quinquenios en
#     los grupos de .hojas_ruta_age_defs_default (18_24, 25_34, ..., 65_plus).
#
# Uso:
#   Rscript api/inst/hojas_ruta/build_cpv2025_margenes.R
# Variables:
#   HOJAS_RUTA_CPV2025_OUT        carpeta de salida (por defecto, la del script)
#   HOJAS_RUTA_CPV2025_CACHE      caché de tablas REDATAM (por defecto tmp/redatam_cpv2025_cache)
#   HOJAS_RUTA_CPV2025_CONSULTADO fecha de consulta a registrar; por defecto la del archivo de
#                                 caché más antiguo, para que dos corridas sobre la misma caché
#                                 produzcan bytes idénticos.
#
# Ubigeo: en la base 2025 el departamento 27 es Lima Metropolitana y el 26 Lima provincias;
# ambos se traducen a 15 (ADR 0119 §6), igual que fetch_cpv2025_distritos() en
# build_inei2017_ciudades.R.

options(stringsAsFactors = FALSE, warn = 1)

for (pkg in c("jsonlite", "curl", "xml2")) {
  if (!requireNamespace(pkg, quietly = TRUE)) stop(sprintf("Package '%s' is required.", pkg), call. = FALSE)
}

`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L) y else x

script_path <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% ".")
script_dir <- dirname(normalizePath(script_path, mustWork = FALSE))
repo_root <- normalizePath(file.path(script_dir, "..", "..", ".."), mustWork = FALSE)

CPV2025_URL <- "https://redatamcpv2025.inei.gob.pe"
CROSSTAB_URL <- paste0(CPV2025_URL, "/bininei/RpWebStats.exe/CrossTab?")
BASE <- "CPV2025DI"
FUENTE <- "INEI CPV 2025, REDATAM base CPV2025DI (población censada)"
VAR_SEXO <- "POBLACION.S5_P2"
VAR_EDAD <- "POBLACION.S5_P3"
VAR_QUINQ <- "POBLACION.EDQUINQ"
VAR_NIVEL <- "POBLACION.S5_P13"
FILTRO_ADULTOS <- "POBLACION.S5_P3 >= 18"
ARCHIVO_EDAD <- "cpv2025_edad_simple_distrito.csv.gz"
ARCHIVO_MARGENES <- "cpv2025_margenes_distrito.csv.gz"

# Orden y rótulos de POBLACION.S5_P13 (rango 1..13 en el diccionario de la base).
NIVELES <- c(
  "Sin nivel", "Educación inicial", "Primaria", "Secundaria", "Básica especial",
  "Superior no universitaria incompleta", "Superior no universitaria completa",
  "Superior universitaria incompleta", "Superior universitaria completa",
  "Maestría incompleta", "Maestría completa", "Doctorado incompleto", "Doctorado completo"
)

# Selecciones por departamento que publica el propio REDATAM (campo SELECTION del CrossTab).
SELECCIONES <- c(
  "02" = "Ancash", "04" = "Arequipa", "05" = "Ayacucho", "06" = "Cajamarca", "07" = "Callao",
  "08" = "Cusco", "10" = "Huanuco", "11" = "Ica", "12" = "Junin", "13" = "LaLibertad",
  "14" = "Lambayeque", "15" = "ResLima", "15b" = "RegLima", "16" = "Loreto", "20" = "Piura",
  "21" = "Puno", "22" = "SanMartin", "23" = "Tacna", "24" = "Tumbes", "25" = "Ucayali"
)

out_dir <- Sys.getenv("HOJAS_RUTA_CPV2025_OUT", script_dir)
cache_dir <- Sys.getenv("HOJAS_RUTA_CPV2025_CACHE", file.path(repo_root, "tmp", "redatam_cpv2025_cache"))
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(cache_dir, recursive = TRUE, showWarnings = FALSE)

# --- Territorio ------------------------------------------------------------------

territorios <- jsonlite::read_json(file.path(script_dir, "territorios.json"))
pob25 <- unlist(lapply(territorios$provincias, function(p) {
  d <- p$cobertura$distritos %||% list()
  vapply(d, function(x) as.numeric(x$pob25 %||% NA), numeric(1))
}))
distritos <- sort(unlist(lapply(territorios$provincias, function(p) unlist(p$distritos))))
deps <- unique(substr(distritos, 1L, 2L))
faltan <- setdiff(deps, substr(names(SELECCIONES), 1L, 2L))
if (length(faltan)) stop("Sin selección REDATAM para los departamentos: ", paste(faltan, collapse = ", "), call. = FALSE)
selecciones <- SELECCIONES[substr(names(SELECCIONES), 1L, 2L) %in% deps]

cpv2025_to_ubigeo <- function(cod) {
  dep <- substr(cod, 1L, 2L)
  ifelse(dep == "27", paste0("1501", substr(cod, 5L, 6L)),
         ifelse(dep == "26", paste0("15", substr(cod, 3L, 6L)), cod))
}

# --- REDATAM -----------------------------------------------------------------------

crosstab_body <- function(row, column, control, selection, filter) {
  campos <- c(
    MAIN = "WebServerMain.inl", BASE = BASE, LANG = "esp", CODIGO = "XXUSUARIOXX",
    ITEM = "CRUCPOB", MODE = "RUN", inputTitle = "", ROW = row, CONTROL = control,
    COLUMN = column, AREABREAK = "DISTRITO", WEIGHT = "", SELECTION = selection,
    INLINESELECTION = "", FORMAT = "HTML", PERCENT = "OFF", UNIVERSE = "", FILTER = "",
    TEXT_FILTER = filter
  )
  paste(paste0(names(campos), "=", vapply(campos, curl::curl_escape, character(1))), collapse = "&")
}

# Devuelve el HTML de la tabla (el CrossTab responde con un iframe hacia un temporal).
fetch_crosstab <- function(row, column, control, selection, filter) {
  body <- crosstab_body(row, column, control, selection, filter)
  key <- substr(digest_md5(body), 1L, 16L)
  cache <- file.path(cache_dir, paste0(key, ".html"))
  if (file.exists(cache) && file.size(cache) > 0) return(cache)
  for (intento in 1:3) {
    res <- tryCatch({
      h <- curl::new_handle(post = TRUE, postfields = body, timeout = 600)
      curl::handle_setheaders(h, "Content-Type" = "application/x-www-form-urlencoded")
      html <- rawToChar(curl::curl_fetch_memory(CROSSTAB_URL, h)$content)
      src <- xml2::xml_attr(xml2::xml_find_first(xml2::read_html(html), ".//iframe|.//frame"), "src")
      if (is.na(src)) stop("el CrossTab no devolvió tabla")
      if (!grepl("^http", src)) src <- paste0(CPV2025_URL, src)
      tabla <- curl::curl_fetch_memory(src, curl::new_handle(timeout = 600))$content
      if (!length(tabla) || !grepl("AREA #", rawToChar(tabla), fixed = TRUE)) stop("tabla sin áreas")
      writeBin(tabla, cache)
      TRUE
    }, error = function(e) { message("  intento ", intento, " falló: ", conditionMessage(e)); FALSE })
    if (isTRUE(res)) return(cache)
    Sys.sleep(5 * intento)
  }
  stop("REDATAM no respondió para ", selection, " (", row, ").", call. = FALSE)
}

digest_md5 <- function(x) {
  f <- tempfile()
  on.exit(unlink(f))
  writeLines(x, f, useBytes = TRUE)
  unname(tools::md5sum(f))
}

as_count <- function(x) {
  x <- gsub("[^0-9-]", "", x)
  ifelse(x %in% c("", "-"), 0L, suppressWarnings(as.integer(x)))
}

# Filas de la tabla como vectores de celdas no vacías, en orden de documento.
# Se corta por bytes (strsplit fijo): con una cadena UTF-8 de 7 MB, gregexpr recalcula
# offsets de carácter en cada coincidencia y el costo se vuelve cuadrático.
table_rows <- function(path) {
  html <- rawToChar(readBin(path, "raw", file.size(path)))
  html <- gsub("</T([RDH])>", "</t\\1>", html, useBytes = TRUE)
  trs <- strsplit(html, "</tr>", fixed = TRUE, useBytes = TRUE)[[1]]
  trs <- trs[grepl("<td", trs, fixed = TRUE, useBytes = TRUE)]
  lapply(trs, function(r) {
    cells <- strsplit(sub("^.*?<tr[^>]*>", "", r, perl = TRUE, useBytes = TRUE), "</t[dh]>", useBytes = TRUE)[[1]]
    cells <- gsub("<[^>]+>", "", cells, useBytes = TRUE)
    Encoding(cells) <- "UTF-8"
    con_entidad <- grepl("&", cells, fixed = TRUE)
    cells[con_entidad] <- vapply(cells[con_entidad], function(x) {
      xml2::xml_text(xml2::read_html(paste0("<p>", x, "</p>")))
    }, character(1), USE.NAMES = FALSE)
    cells <- trimws(gsub("[[:space:]\u00a0]+", " ", cells))
    cells[nzchar(cells)]
  })
}

es_cabecera_sexo <- function(cells) length(cells) >= 3L && identical(tail(cells, 3L), c("Hombre", "Mujer", "Total"))

# Recorre la tabla y devuelve una fila por (área, control, categoría, sexo).
parse_crosstab <- function(path) {
  area <- NA_character_
  control <- NA_character_
  rows <- table_rows(path)
  n_max <- length(rows)
  v_cod <- v_control <- v_cat <- character(n_max)
  v_h <- v_m <- integer(n_max)
  k <- 0L
  for (cells in rows) {
    if (!length(cells)) next
    if (startsWith(cells[[1]], "AREA #")) {
      area <- sub("^AREA # *([0-9]+).*$", "\\1", cells[[1]])
      control <- NA_character_
      next
    }
    # El bloque RESUMEN suma la selección entera y no trae su propio AREA #: sin este
    # corte se le acumularía al último distrito de la tabla.
    if (toupper(cells[[1]]) == "RESUMEN") area <- NA_character_
    if (is.na(area)) next
    if (es_cabecera_sexo(cells)) {
      if (length(cells) == 4L) control <- cells[[1]]
      next
    }
    if (length(cells) != 4L || cells[[1]] == "Total") next
    n <- as_count(cells[2:3])
    if (anyNA(n)) next
    k <- k + 1L
    v_cod[k] <- area
    v_control[k] <- control
    v_cat[k] <- cells[[1]]
    v_h[k] <- n[[1]]
    v_m[k] <- n[[2]]
  }
  if (!k) stop("No se leyeron filas de ", path, call. = FALSE)
  s <- seq_len(k)
  data.frame(
    cod = rep(v_cod[s], 2L), control = rep(v_control[s], 2L), categoria = rep(v_cat[s], 2L),
    sexo = rep(c("Hombre", "Mujer"), each = k), poblacion = c(v_h[s], v_m[s])
  )
}

parse_edad <- function(x) as.integer(sub("^([0-9]+).*$", "\\1", x))

# --- Consultas -------------------------------------------------------------------

edad <- list()
margen <- list()
for (i in seq_along(selecciones)) {
  sel <- paste0("sels\\", selecciones[[i]], ".sel")
  message("REDATAM ", sel)
  e <- parse_crosstab(fetch_crosstab(VAR_EDAD, VAR_SEXO, "", sel, ""))
  e$selection <- sel
  edad[[i]] <- e
  m <- parse_crosstab(fetch_crosstab(VAR_NIVEL, VAR_SEXO, VAR_QUINQ, sel, FILTRO_ADULTOS))
  margen[[i]] <- m
}
edad <- do.call(rbind, edad)
margen <- do.call(rbind, margen)

CONSULTADO <- Sys.getenv(
  "HOJAS_RUTA_CPV2025_CONSULTADO",
  format(as.Date(min(file.mtime(list.files(cache_dir, pattern = "[.]html$", full.names = TRUE)))), "%Y-%m-%d")
)

# --- Edad simple -----------------------------------------------------------------

edad$ubigeo <- cpv2025_to_ubigeo(edad$cod)
edad <- edad[edad$ubigeo %in% distritos, ]
edad$edad <- parse_edad(edad$categoria)
if (anyNA(edad$edad)) stop("Rótulos de edad sin leer: ", paste(unique(edad$categoria[is.na(edad$edad)]), collapse = ", "), call. = FALSE)
edad <- data.frame(
  ubigeo = edad$ubigeo, edad = edad$edad, sexo = edad$sexo, poblacion = edad$poblacion,
  fuente_base = FUENTE, variable_edad = VAR_EDAD, variable_sexo = VAR_SEXO,
  selection = edad$selection, consultado = CONSULTADO
)
edad <- edad[order(edad$ubigeo, edad$sexo, edad$edad), ]

# --- Márgenes 18+ ----------------------------------------------------------------

margen$ubigeo <- cpv2025_to_ubigeo(margen$cod)
margen <- margen[margen$ubigeo %in% distritos, ]
# Con CONTROL, el REDATAM cierra cada área con un bloque «Total» que suma los quinquenios.
margen <- margen[!is.na(margen$control) & margen$control != "Total", ]
q_min <- as.integer(sub("^De ([0-9]+) a.*$", "\\1", margen$control))
q_max <- suppressWarnings(as.integer(sub("^De [0-9]+ a ([0-9]+) años$", "\\1", margen$control)))
q_max[grepl("más", margen$control)] <- NA_integer_
if (anyNA(q_min)) stop("Grupos quinquenales sin leer: ", paste(unique(margen$control[is.na(q_min)]), collapse = ", "), call. = FALSE)
margen$edad_min <- pmax(q_min, 18L)
margen$edad_max <- q_max
cortes <- c(18L, 25L, 35L, 45L, 55L, 65L)
ids <- c("18_24", "25_34", "35_44", "45_54", "55_64", "65_plus")
margen$grupo_edad <- ids[findInterval(margen$edad_min, cortes)]
margen$nivel_codigo <- match(margen$categoria, NIVELES)
if (anyNA(margen$nivel_codigo)) stop("Niveles sin catalogar: ", paste(unique(margen$categoria[is.na(margen$nivel_codigo)]), collapse = ", "), call. = FALSE)

# El REDATAM omite las celdas en cero; el archivo trae la grilla completa para que la
# ausencia de una fila nunca se confunda con un dato que no se pidió.
quinq <- unique(margen[, c("edad_min", "edad_max", "grupo_edad")])
quinq <- quinq[order(quinq$edad_min), ]
grilla <- merge(
  merge(data.frame(ubigeo = distritos), data.frame(sexo = c("Hombre", "Mujer"))),
  merge(quinq, data.frame(nivel_codigo = seq_along(NIVELES)))
)
llave <- function(d) paste(d$ubigeo, d$sexo, d$edad_min, d$nivel_codigo)
grilla$poblacion <- 0L
idx <- match(llave(margen), llave(grilla))
if (anyNA(idx) || anyDuplicated(idx)) {
  malas <- unique(c(llave(margen)[is.na(idx)], llave(margen)[duplicated(idx) & !is.na(idx)]))
  stop("Celdas de márgenes fuera de la grilla o duplicadas: ", paste(head(malas, 10L), collapse = "; "), call. = FALSE)
}
grilla$poblacion[idx] <- margen$poblacion
margen <- data.frame(
  ubigeo = grilla$ubigeo, sexo = grilla$sexo, edad_min = grilla$edad_min, edad_max = grilla$edad_max,
  grupo_edad = grilla$grupo_edad, nivel_codigo = grilla$nivel_codigo,
  nivel_educativo = NIVELES[grilla$nivel_codigo], poblacion = grilla$poblacion,
  fuente = FUENTE, variables = paste(VAR_SEXO, VAR_QUINQ, VAR_NIVEL, sep = " x "),
  universo = FILTRO_ADULTOS, consultado = CONSULTADO
)
margen <- margen[order(margen$ubigeo, margen$sexo, margen$edad_min, margen$nivel_codigo), ]

# --- Controles -------------------------------------------------------------------

sin_dato <- setdiff(distritos, unique(edad$ubigeo))
if (length(sin_dato)) stop("Distritos sin edad simple 2025: ", paste(sin_dato, collapse = ", "), call. = FALSE)
tot <- tapply(edad$poblacion, edad$ubigeo, sum)
dif <- tot[distritos] - pob25[distritos]
if (any(abs(dif) > 0, na.rm = TRUE)) {
  message("Distritos cuya edad simple no suma pob25:")
  print(dif[abs(dif) > 0])
}
adultos <- tapply(edad$poblacion[edad$edad >= 18L], edad$ubigeo[edad$edad >= 18L], sum)
cubo <- tapply(margen$poblacion, margen$ubigeo, sum)
dif_cubo <- cubo[distritos] - adultos[distritos]
message(sprintf("Márgenes 18+: %d personas; diferencia con la edad simple 18+: %d (máx. por distrito %d)",
                sum(cubo), sum(dif_cubo), max(abs(dif_cubo))))

# --- Escritura -------------------------------------------------------------------

write_csv_gz <- function(df, name) {
  path <- file.path(out_dir, sub("[.]gz$", "", name))
  unlink(paste0(path, ".gz"))
  rownames(df) <- NULL
  utils::write.csv(df, path, row.names = FALSE, fileEncoding = "UTF-8", na = "")
  status <- system2("gzip", c("-n", "-9", "-f", shQuote(path)))
  if (!identical(status, 0L)) stop("gzip falló en ", path, call. = FALSE)
  paste0(path, ".gz")
}

for (p in c(write_csv_gz(edad, ARCHIVO_EDAD), write_csv_gz(margen, ARCHIVO_MARGENES))) {
  message(sprintf("%s  %d bytes  md5 %s", p, file.size(p), tools::md5sum(p)))
}
