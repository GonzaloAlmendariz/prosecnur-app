# =============================================================================
# Anonimización de un .pulso — logos del cliente (estilo_cliente.logos)
# =============================================================================
#
# Un logo identifica al cliente tanto como su nombre: el PNG de «UNSA» en la
# portada del Word dice de quién es el estudio sin leer una sola respuesta. Desde
# A6 R3 (ADR 0094) los logos viajan en `files/` del `.pulso` y su `nombre` vive
# en `estilo_cliente.logos.<lugar>` de cualquiera de los portadores de config
# (`graficos_config`, cada `graficos_config_por_base[[b]]`, el borrador y la
# receta del consolidado).
#
# Al anonimizar, cada logo con su PNG en `files/` se sustituye por un PNG NEUTRO
# —rectángulo gris con borde, del mismo aspecto, generado de forma
# determinista— bajo un `file_id` nuevo derivado de la sal, y su `nombre` pasa a
# «Logo del cliente». El PNG original sale de `files/` y su entrada del file
# store (con `original_name` y la ruta del equipo del analista) se reemplaza.
# Un logo cuyo PNG no viajó se retira: al abrir se podaría igual y su `nombre`
# es lo único que quedaría del cliente.
#
# El recorrido es genérico (cualquier lista con `estilo_cliente$logos`, a
# cualquier profundidad), por el mismo motivo que el de data.frames: una lista
# de portadores quedaría corta al primer portador nuevo.
#
# `.pulso_anon_logos_hallazgos()` es la otra mitad: el gate de
# `pulso_detectar_pii()` (y por él `make reference-project-verify`) falla si un
# fixture trae un logo que no es el neutro.

.PULSO_ANON_LOGO_NOMBRE <- "Logo del cliente"
.PULSO_ANON_LOGO_KIND <- "graficos_logo"
.PULSO_ANON_LOGO_ARCHIVO_RE <- "^logo_cliente_[0-9]+\\.png$"
.PULSO_ANON_LOGO_LADO_MAX <- 240L
.PULSO_ANON_LOGO_DEFAULT <- c(ancho = 400L, alto = 160L)

# Aplica `fn(logos)` a cada `estilo_cliente$logos` del state y reconstruye.
.pulso_anon_logos_map <- function(x, fn, profundidad = 0L) {
  if (profundidad > .PULSO_ANON_MAX_PROFUNDIDAD) return(x)
  if (is.data.frame(x) || !is.list(x) || !length(x)) return(x)
  ec <- if (!is.null(names(x)) && "estilo_cliente" %in% names(x)) x[["estilo_cliente"]] else NULL
  if (is.list(ec) && is.list(ec$logos)) {
    nuevos <- fn(ec$logos)
    ec$logos <- if (length(nuevos)) nuevos else NULL
    x[["estilo_cliente"]] <- ec
  }
  for (i in seq_along(x)) {
    hijo <- tryCatch(x[[i]], error = function(e) NULL)
    if (!is.list(hijo) || is.data.frame(hijo)) next
    nuevo <- .pulso_anon_logos_map(hijo, fn, profundidad + 1L)
    if (!identical(nuevo, hijo)) tryCatch(x[[i]] <- nuevo, error = function(e) NULL)
  }
  x
}

# Todas las referencias a logos: data.frame(lugar, file_id, nombre).
.pulso_anon_logos_refs <- function(estado) {
  filas <- list()
  .pulso_anon_logos_map(estado, function(lg) {
    for (lugar in names(lg)) {
      e <- lg[[lugar]] %||% list()
      filas[[length(filas) + 1L]] <<- data.frame(
        lugar = lugar,
        file_id = as.character(e$file_id %||% "")[1],
        nombre = as.character(e$nombre %||% "")[1],
        stringsAsFactors = FALSE
      )
    }
    lg
  })
  if (!length(filas)) return(data.frame(lugar = character(), file_id = character(), nombre = character()))
  do.call(rbind, filas)
}

# Ancho y alto declarados en el IHDR de un PNG; NULL si no es un PNG legible.
.pulso_anon_logo_dims <- function(path) {
  b <- tryCatch(readBin(path, "raw", n = 24L), error = function(e) raw())
  firma <- as.raw(c(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
  if (length(b) < 24L || !identical(b[1:8], firma) || !identical(rawToChar(b[13:16]), "IHDR")) return(NULL)
  ent <- function(x) sum(as.numeric(as.integer(x)) * 256^(3:0))
  d <- c(ancho = ent(b[17:20]), alto = ent(b[21:24]))
  if (any(d < 1)) NULL else d
}

# PNG neutro del mismo aspecto: fondo gris claro y borde gris medio, sin texto
# (no hace falta un device gráfico, así que es determinista byte a byte).
.pulso_anon_logo_neutro <- function(ancho, alto) {
  escala <- .PULSO_ANON_LOGO_LADO_MAX / max(ancho, alto)
  w <- max(8L, as.integer(round(ancho * escala)))
  h <- max(8L, as.integer(round(alto * escala)))
  m <- matrix(0.86, nrow = h, ncol = w)
  borde <- 2L
  m[c(seq_len(borde), (h - borde + 1L):h), ] <- 0.62
  m[, c(seq_len(borde), (w - borde + 1L):w)] <- 0.62
  png::writePNG(array(rep(m, 3L), dim = c(h, w, 3L)))
}

.pulso_anon_logo_fid <- function(fid, sal) {
  h <- .pulso_pii_hash(paste0("logo|", fid), sal)
  sprintf("%s-%s-4%s-8%s-%s", substr(h, 1, 8), substr(h, 9, 12), substr(h, 14, 16),
          substr(h, 18, 20), substr(h, 21, 32))
}

#' Sustituye los logos del cliente por PNG neutros (ver cabecera del archivo)
#' @param estado State como lista (`.pulso_anon_state_como_lista()$datos`).
#' @param files_dir `files/` del `.pulso` desempaquetado.
#' @param sal Sal de la anonimización (ancla los `file_id` nuevos).
#' @return `list(estado, neutralizados, retirados)`.
#' @keywords internal
.pulso_anon_logos_neutralizar <- function(estado, files_dir, sal) {
  refs <- .pulso_anon_logos_refs(estado)
  files <- if (is.list(estado$files)) estado$files else list()
  es_logo <- vapply(files, function(m) identical(as.character((m %||% list())$kind %||% "")[1], .PULSO_ANON_LOGO_KIND),
                    logical(1))
  fids <- unique(c(refs$file_id[nzchar(refs$file_id)], names(files)[es_logo]))
  entradas <- if (dir.exists(files_dir)) list.files(files_dir, full.names = TRUE) else character()

  mapa <- character()
  retirados <- character()
  for (fid in fids) {
    propias <- entradas[startsWith(basename(entradas), paste0(fid, "__"))]
    dims <- if (length(propias)) .pulso_anon_logo_dims(propias[[1]]) else NULL
    if (length(propias)) unlink(propias, force = TRUE)
    files[[fid]] <- NULL
    if (!length(propias)) { retirados <- c(retirados, fid); next }
    dims <- dims %||% .PULSO_ANON_LOGO_DEFAULT
    nuevo <- .pulso_anon_logo_fid(fid, sal)
    nombre_archivo <- sprintf("logo_cliente_%d.png", length(mapa) + 1L)
    bytes <- .pulso_anon_logo_neutro(dims[["ancho"]], dims[["alto"]])
    writeBin(bytes, file.path(files_dir, sprintf("%s__%s", nuevo, nombre_archivo)))
    files[[nuevo]] <- list(file_id = nuevo, kind = .PULSO_ANON_LOGO_KIND, original_name = nombre_archivo,
                           ext = "png", size = length(bytes))
    mapa[fid] <- nuevo
  }

  estado <- .pulso_anon_logos_map(estado, function(lg) {
    out <- list()
    for (lugar in names(lg)) {
      fid <- as.character((lg[[lugar]] %||% list())$file_id %||% "")[1]
      if (!nzchar(fid) || is.na(mapa[fid])) next
      out[[lugar]] <- list(file_id = unname(mapa[fid]), nombre = .PULSO_ANON_LOGO_NOMBRE)
    }
    out
  })
  if (length(fids)) estado$files <- files
  # Cualquier otra referencia al file_id viejo (fuera de estilo_cliente) sigue al nuevo.
  if (length(mapa)) estado <- .pulso_anon_reemplazar_strings(estado, mapa)
  list(estado = estado, neutralizados = length(mapa), retirados = retirados)
}

#' Gate: logos del cliente que no son el neutro del anonimizador
#' @return data.frame con las columnas de `pulso_detectar_pii()` (cero filas si limpio).
#' @keywords internal
.pulso_anon_logos_hallazgos <- function(estado, files_dir) {
  refs <- .pulso_anon_logos_refs(estado)
  files <- if (is.list(estado$files)) estado$files else list()
  es_logo <- vapply(files, function(m) identical(as.character((m %||% list())$kind %||% "")[1], .PULSO_ANON_LOGO_KIND),
                    logical(1))
  fids <- unique(c(refs$file_id[nzchar(refs$file_id)], names(files)[es_logo]))
  entradas <- if (dir.exists(files_dir)) list.files(files_dir, full.names = TRUE) else character()
  out <- list()
  marcar <- function(columna, tipo, ejemplo) {
    out[[length(out) + 1L]] <<- data.frame(ruta = "state$estilo_cliente$logos", columna = columna, tipo = tipo,
                                           n = 1L, ejemplo = ejemplo, stringsAsFactors = FALSE)
  }
  for (i in seq_len(nrow(refs))) {
    if (nzchar(refs$nombre[[i]]) && !identical(refs$nombre[[i]], .PULSO_ANON_LOGO_NOMBRE)) marcar(refs$lugar[[i]], "logo_nombre", refs$nombre[[i]])
  }
  for (fid in fids) {
    on <- as.character(((files[[fid]] %||% list())$original_name) %||% "")[1]
    if (nzchar(on) && !grepl(.PULSO_ANON_LOGO_ARCHIVO_RE, on)) marcar(fid, "logo_archivo", on)
    for (p in entradas[startsWith(basename(entradas), paste0(fid, "__"))]) {
      d <- .pulso_anon_logo_dims(p)
      neutro <- if (is.null(d)) raw() else .pulso_anon_logo_neutro(d[["ancho"]], d[["alto"]])
      if (!identical(readBin(p, "raw", n = file.info(p)$size), neutro)) marcar(fid, "logo_cliente", basename(p))
    }
  }
  if (!length(out)) {
    return(data.frame(ruta = character(), columna = character(), tipo = character(),
                      n = integer(), ejemplo = character(), stringsAsFactors = FALSE))
  }
  do.call(rbind, out)
}
