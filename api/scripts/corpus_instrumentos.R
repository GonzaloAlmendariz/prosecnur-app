#!/usr/bin/env Rscript
# =============================================================================
# Corpus de instrumentos reales para el editor XLSForm y el motor del papel
# =============================================================================
#
#   Rscript api/scripts/corpus_instrumentos.R todo \
#     --origen ~/Documents/Pulso \
#     [--lista candidatos.json]      # subconjunto ya escaneado (json [{p}] o txt)
#     --trabajo /tmp/corpus_trabajo  # copias de los originales (nunca se editan)
#     --salida ~/Documents/Pulso/90_Pruebas/corpus_instrumentos \
#     [--workers 4] [--umbral 0.8] [--solo familia1,familia2]
#
# Pasos (cada uno se puede correr suelto): copiar · manifiesto · pulso ·
# motores · renders · todo.
#
# MATERIAL DE CLIENTE: copias, .pulso, artefactos y renders viven en --salida /
# --trabajo, nunca en el repo. Los originales solo se LEEN (se copian primero).
#
# Grano de la evidencia: instrumento canonico x modo (pdf|docx x columnas
# 1|2|auto). Denominador de cada cifra: los instrumentos canonicos del
# manifiesto (`manifiesto.csv`), no los archivos encontrados (`inventario.csv`).

script_path <- local({
  a <- commandArgs(trailingOnly = FALSE)
  hit <- a[startsWith(a, "--file=")]
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/corpus_instrumentos.R"
})
repo_root <- normalizePath(file.path(dirname(script_path), "..", ".."), mustWork = FALSE)
api_dir <- file.path(repo_root, "api")
Sys.setenv(PULSO_REPO_ROOT = repo_root, PULSO_API_DIR = api_dir)
suppressMessages(pkgload::load_all(api_dir, quiet = TRUE))

args <- commandArgs(trailingOnly = TRUE)
arg_valores <- function(nombre) {
  out <- character(0)
  eq <- paste0("--", nombre, "=")
  out <- c(out, sub(eq, "", args[startsWith(args, eq)], fixed = TRUE))
  idx <- which(args == paste0("--", nombre))
  out <- c(out, args[idx[idx < length(args)] + 1L])
  out
}
arg_valor <- function(nombre, default = NULL) {
  v <- arg_valores(nombre)
  if (length(v)) v[[1]] else default
}
paso <- if (length(args) && !startsWith(args[[1]], "--")) args[[1]] else "todo"
if ("--help" %in% args) {
  cat("Uso: Rscript api/scripts/corpus_instrumentos.R <copiar|manifiesto|pulso|motores|renders|todo>",
      "--origen DIR [--origen DIR2] [--lista FILE] --trabajo DIR --salida DIR [--workers N]\n")
  quit(status = 0)
}

origenes <- normalizePath(path.expand(arg_valores("origen")), mustWork = FALSE)
lista <- arg_valor("lista")
trabajo <- path.expand(arg_valor("trabajo", file.path(tempdir(), "corpus_trabajo")))
salida <- path.expand(arg_valor("salida", Sys.getenv("PULSO_CORPUS_DIR", "")))
workers <- as.integer(arg_valor("workers", "1"))
umbral <- as.numeric(arg_valor("umbral", "0.8"))
solo <- strsplit(arg_valor("solo", ""), ",", fixed = TRUE)[[1]]
if (!nzchar(salida)) stop("Falta --salida (o PULSO_CORPUS_DIR).")
for (d in c(trabajo, salida)) dir.create(d, recursive = TRUE, showWarnings = FALSE)
if (startsWith(normalizePath(salida, mustWork = FALSE), normalizePath(repo_root))) {
  stop("--salida no puede vivir dentro del repo: es material de cliente.")
}

log <- function(...) cat(format(Sys.time(), "%H:%M:%S"), sprintf(...), "\n")
escribir_csv <- function(df, path) {
  utils::write.csv(df, path, row.names = FALSE, fileEncoding = "UTF-8", na = "")
  log("escrito %s (%d filas)", path, nrow(df))
}
leer_csv <- function(path) utils::read.csv(path, stringsAsFactors = FALSE, encoding = "UTF-8",
                                           fileEncoding = "UTF-8", check.names = FALSE)

# Ruta relativa al origen que la contiene (para la familia).
relativa <- function(p) {
  for (o in origenes) if (startsWith(p, paste0(o, "/"))) return(substring(p, nchar(o) + 2L))
  basename(p)
}

# ---------------------------------------------------------------------------
# 1. copiar — candidatos -> copias en --trabajo (reintento unico si iCloud
#    devuelve un archivo desalojado/roto)
# ---------------------------------------------------------------------------
paso_copiar <- function() {
  cand <- character(0)
  if (!is.null(lista)) {
    if (grepl("\\.json$", lista)) {
      j <- jsonlite::fromJSON(lista, simplifyVector = FALSE)
      cand <- vapply(j, function(x) as.character(x$p), character(1))
    } else cand <- readLines(lista, warn = FALSE)
  } else {
    for (o in origenes) {
      cand <- c(cand, list.files(o, pattern = "\\.xlsx$", recursive = TRUE, full.names = TRUE,
                                 ignore.case = TRUE))
    }
  }
  cand <- unique(cand[!grepl("(^|/)~\\$", cand)])
  dir.create(file.path(trabajo, "copias"), recursive = TRUE, showWarnings = FALSE)
  es_zip <- function(f) {
    isTRUE(file.exists(f)) && isTRUE(file.info(f)$size > 0) &&
      identical(readBin(f, "raw", 2L), as.raw(c(0x50, 0x4b)))
  }
  filas <- lapply(cand, function(p) {
    dst <- file.path(trabajo, "copias", paste0(substr(digest::digest(p, algo = "sha1"), 1, 12), ".xlsx"))
    intento <- function() {
      unlink(dst)
      ok <- tryCatch(file.copy(p, dst, overwrite = TRUE, copy.date = TRUE), error = function(e) FALSE)
      isTRUE(ok) && es_zip(dst)
    }
    estado <- if (!file.exists(p)) "no_existe" else if (intento()) "ok" else {
      Sys.sleep(3)
      if (intento()) "ok_reintento" else "ilegible_tras_reintento"
    }
    data.frame(origen = p, relativa = relativa(p), copia = if (grepl("^ok", estado)) dst else "",
               estado_copia = estado,
               mtime = format(file.info(p)$mtime, "%Y-%m-%dT%H:%M:%S"),
               bytes = as.numeric(file.info(p)$size), stringsAsFactors = FALSE)
  })
  inv <- do.call(rbind, filas)
  escribir_csv(inv, file.path(trabajo, "copias.csv"))
  log("copias: %s", paste(names(table(inv$estado_copia)), table(inv$estado_copia), sep = "=", collapse = " "))
  invisible(inv)
}

# ---------------------------------------------------------------------------
# 2. manifiesto — lectura con el lector del editor, huella, grupos, familias
# ---------------------------------------------------------------------------
paso_manifiesto <- function() {
  inv <- leer_csv(file.path(trabajo, "copias.csv"))
  lecturas <- list()
  inv$lectura <- ""; inv$huella <- ""
  for (i in seq_len(nrow(inv))) {
    if (!nzchar(inv$copia[i])) { inv$lectura[i] <- inv$estado_copia[i]; next }
    r <- .corpus_leer_xlsform(inv$copia[i])
    if (!r$ok) { inv$lectura[i] <- paste("no_xlsform:", substr(r$error, 1, 160)); next }
    sv_filas <- sum(.corpus_survey_filas(r$sheets$survey))
    if (!sv_filas) { inv$lectura[i] <- "survey_vacia"; next }
    inv$lectura[i] <- "ok"
    inv$huella[i] <- .corpus_huella(r$sheets)
    lecturas[[inv$copia[i]]] <- list(nombres = .corpus_nombres(r$sheets), rasgos = .corpus_rasgos(r$sheets))
  }
  ok <- inv[inv$lectura == "ok", , drop = FALSE]
  ok$familia_ruta <- vapply(ok$relativa, .corpus_familia_de_ruta, character(1))
  ok$rango <- vapply(ok$relativa, .corpus_rango_area, integer(1))

  # Grupos exactos por huella; representante = preferencia canonica.
  grupos <- split(seq_len(nrow(ok)), ok$huella)
  reps <- vapply(grupos, function(ix) ix[.corpus_orden_canonico(ok$relativa[ix], as.POSIXct(ok$mtime[ix], format = "%Y-%m-%dT%H:%M:%S"))][1], integer(1))

  # Versiones: union-find por Jaccard de nombres >= umbral, sin fundir
  # ediciones de anos distintos (item 49; corpus_instrumentos_lectura.R).
  nombres <- lapply(reps, function(r) lecturas[[ok$copia[r]]]$nombres)
  agr <- .corpus_agrupar_versiones(ok$relativa[reps], nombres, umbral)
  cluster <- agr$cluster
  sims <- agr$sims

  sel <- list(); destino <- character(nrow(ok)); rol <- character(nrow(ok))
  for (cl in unique(cluster)) {
    gi <- which(cluster == cl)                    # grupos exactos del instrumento
    miembros <- unlist(grupos[gi])
    # Casa: el area de mayor rango (01_Estudios primero) y, dentro, la familia con mas archivos.
    rk <- min(ok$rango[miembros])
    fams <- ok$familia_ruta[miembros][ok$rango[miembros] == rk]
    familia <- names(sort(table(fams), decreasing = TRUE))[1]
    # Canonica entre los representantes de los grupos exactos.
    rr <- reps[gi]
    ord <- .corpus_orden_canonico(ok$relativa[rr], as.POSIXct(ok$mtime[rr], format = "%Y-%m-%dT%H:%M:%S"),
                                  en_casa = ok$familia_ruta[rr] == familia)
    canon <- rr[ord[1]]
    cap <- function(r) {
      x <- lecturas[[ok$copia[r]]]$rasgos
      c(repeat_ = isTRUE(x$repeat_), matrices = isTRUE(x$matrices), idiomas = x$n_idiomas > 1,
        html = isTRUE(x$html), markdown = isTRUE(x$markdown), paper = nzchar(x$paper),
        hoja_paper = isTRUE(x$hoja_paper), choice_filter = isTRUE(x$choice_filter))
    }
    cap0 <- cap(canon)
    # Versiones extra (max 2): las que ejercitan una capacidad que la canonica no.
    extra <- integer(0)
    cubiertas <- cap0
    for (r in rr[ord[-1]]) {
      nuevas <- cap(r) & !cubiertas
      if (any(nuevas) && length(extra) < 2L) { extra <- c(extra, r); cubiertas <- cubiertas | cap(r) }
    }
    elegidos <- c(canon, extra)
    for (e in elegidos) {
      g_e <- grupos[[which(reps == e)]]
      absorbe <- setdiff(if (e == canon) setdiff(miembros, unlist(grupos[which(reps %in% extra)])) else g_e, e)
      destino[absorbe] <- ok$relativa[e]
      rol[absorbe] <- ifelse(absorbe %in% g_e, "duplicado_exacto", "version_absorbida")
      x <- lecturas[[ok$copia[e]]]$rasgos
      sel[[length(sel) + 1L]] <- data.frame(
        familia = familia, instrumento = paste0("i", cl),
        rol = if (e == canon) "canonica" else paste0("version_extra(", paste(names(which(cap(e) & !cap0)), collapse = "+"), ")"),
        archivo = basename(ok$relativa[e]), origen = ok$origen[e], relativa = ok$relativa[e],
        copia = ok$copia[e], huella = ok$huella[e], mtime = ok$mtime[e],
        filas_survey = x$filas_survey, filas_choices = x$filas_choices,
        repeat_ = x$repeat_, matrices = x$matrices, idiomas = x$idiomas, html = x$html,
        markdown = x$markdown, paper = x$paper, hoja_paper = x$hoja_paper,
        choice_filter = x$choice_filter, relevant = x$relevant, n_listas = x$n_listas,
        tipos_mixtos = x$tipos_mixtos, tipos = x$tipos, form_title = x$form_title,
        n_absorbe = length(absorbe),
        absorbe = paste(ok$relativa[absorbe], collapse = " ; "),
        stringsAsFactors = FALSE)
      destino[e] <- ok$relativa[e]; rol[e] <- if (e == canon) "canonica" else "version_extra"
    }
  }
  man <- do.call(rbind, sel)
  man <- man[order(man$familia, man$instrumento, man$rol != "canonica"), , drop = FALSE]
  # Reparto en .pulso de <= .XLSFORM_FORMS_MAX formularios por familia.
  man$pulso <- ""
  for (f in unique(man$familia)) {
    ix <- which(man$familia == f)
    trozo <- (seq_along(ix) - 1L) %/% .XLSFORM_FORMS_MAX
    man$pulso[ix] <- ifelse(trozo == 0L, f, paste0(f, "-", trozo + 1L))
  }
  man$id <- paste0(man$pulso, "__", vapply(tools::file_path_sans_ext(man$archivo), .corpus_slug, character(1), max = 40L))
  man$id <- make.unique(man$id, sep = "_")
  escribir_csv(man, file.path(salida, "manifiesto.csv"))

  inv$destino <- ""; inv$rol <- ""
  inv$destino[match(ok$copia, inv$copia)] <- destino
  inv$rol[match(ok$copia, inv$copia)] <- rol
  escribir_csv(inv[, c("relativa", "estado_copia", "lectura", "huella", "rol", "destino", "mtime", "bytes")],
               file.path(salida, "inventario.csv"))
  sims_df <- if (length(sims)) {
    m <- do.call(rbind, sims)
    data.frame(a = ok$relativa[reps[m[, 1]]], b = ok$relativa[reps[m[, 2]]], jaccard = round(m[, 3], 3))
  } else data.frame(a = character(0), b = character(0), jaccard = numeric(0))
  escribir_csv(sims_df, file.path(salida, "versiones_enlazadas.csv"))
  meta <- list(
    generado = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
    commit = tryCatch(system2("git", c("-C", shQuote(repo_root), "rev-parse", "--short", "HEAD"), stdout = TRUE), error = function(e) ""),
    entrada = list(origenes = origenes, lista = lista %||% "", archivos = nrow(inv),
                   leidos_como_xlsform = nrow(ok)),
    grano = "instrumento canonico x modo (pdf|docx x columnas 1|2|auto)",
    denominador = "instrumentos de manifiesto.csv (canonicas + versiones extra), no archivos encontrados",
    umbral_versiones_jaccard = umbral,
    audiencia = "interna (QA del motor); nada de esta carpeta va a un cliente ni al repo"
  )
  writeLines(jsonlite::toJSON(meta, auto_unbox = TRUE, pretty = TRUE), file.path(salida, "manifiesto_meta.json"))
  log("manifiesto: %d archivos, %d xlsform, %d huellas distintas, %d instrumentos, %d familias, %d formularios en %d .pulso",
      nrow(inv), nrow(ok), length(grupos), length(unique(cluster)), length(unique(man$familia)),
      nrow(man), length(unique(man$pulso)))
  invisible(man)
}

# ---------------------------------------------------------------------------
# 3. pulso — un .pulso por familia (trozos de <= 6) con el codigo real
# ---------------------------------------------------------------------------
paso_pulso <- function() {
  man <- leer_csv(file.path(salida, "manifiesto.csv"))
  dir.create(file.path(salida, "pulso"), showWarnings = FALSE)
  ver <- list()
  for (p in unique(man$pulso)) {
    if (length(solo) && nzchar(solo[1]) && !p %in% solo) next
    filas <- man[man$pulso == p, , drop = FALSE]
    formas <- lapply(seq_len(nrow(filas)), function(i) {
      r <- .corpus_leer_xlsform(filas$copia[i])
      list(sheets = r$sheets, original_name = filas$archivo[i], name = NULL)
    })
    dest <- file.path(salida, "pulso", paste0(p, ".pulso"))
    res <- tryCatch(.corpus_construir_pulso(formas, dest, p), error = function(e) e)
    if (inherits(res, "error")) {
      ver[[p]] <- data.frame(pulso = p, ok = FALSE, error = conditionMessage(res), formularios = 0L,
                             nombres = "", huellas_ok = FALSE, stringsAsFactors = FALSE)
      next
    }
    # Verificacion: abrir con load_pulso y recomputar la huella desde el workbook.
    ab <- tryCatch(.corpus_abrir_pulso(dest), error = function(e) e)
    if (inherits(ab, "error")) {
      ver[[p]] <- data.frame(pulso = p, ok = FALSE, error = paste("load_pulso:", conditionMessage(ab)),
                             formularios = 0L, nombres = "", huellas_ok = FALSE, stringsAsFactors = FALSE)
      next
    }
    h <- vapply(ab$forms, function(f) .corpus_huella(.corpus_frames_de_workbook(f$workbook)), character(1))
    try(session_delete(ab$sid), silent = TRUE)
    ver[[p]] <- data.frame(pulso = p, ok = TRUE, error = "", formularios = length(ab$forms),
                           nombres = paste(vapply(ab$forms, `[[`, "", "name"), collapse = " | "),
                           huellas_ok = setequal(h, filas$huella),
                           bytes = as.numeric(file.info(dest)$size),
                           sha256 = .corpus_sha256_file(dest), stringsAsFactors = FALSE)
    log("pulso %s: %d formularios, huellas %s", p, length(ab$forms), if (setequal(h, filas$huella)) "iguales" else "DISTINTAS")
  }
  v <- do.call(rbind, lapply(ver, function(d) { for (c in c("bytes", "sha256")) if (!c %in% names(d)) d[[c]] <- NA; d }))
  escribir_csv(v, file.path(salida, "pulso", "verificacion.csv"))
  invisible(v)
}

# ---------------------------------------------------------------------------
# 4. motores — PDF y Word x columnas 1|2|auto sobre cada formulario del .pulso
# ---------------------------------------------------------------------------
correr_pulso <- function(p, man) {
  dest <- file.path(salida, "pulso", paste0(p, ".pulso"))
  ab <- .corpus_abrir_pulso(dest)
  on.exit(try(session_delete(ab$sid), silent = TRUE), add = TRUE)
  filas <- man[man$pulso == p, , drop = FALSE]
  out <- list()
  for (f in ab$forms) {
    frames <- .corpus_frames_de_workbook(f$workbook)
    h <- .corpus_huella(frames)
    fm <- filas[filas$huella == h, , drop = FALSE][1, ]
    dir_art <- file.path(salida, "artefactos", p)
    dir.create(dir_art, recursive = TRUE, showWarnings = FALSE)
    for (k in seq_len(nrow(.CORPUS_MODOS))) {
      fmt <- .CORPUS_MODOS$formato[k]; cols <- .CORPUS_MODOS$columnas[k]
      out_file <- file.path(dir_art, sprintf("%s__c%s.%s", fm$id, cols, fmt))
      fila <- .corpus_correr_modo(frames, fmt, cols, out_file, tools::file_path_sans_ext(fm$archivo))
      fila$conforme <- .corpus_fila_conforme(fila)
      out[[length(out) + 1L]] <- c(list(id = fm$id, familia = fm$familia, pulso = p,
                                        formulario = f$name, archivo = fm$archivo), fila)
    }
  }
  out
}

paso_motores <- function() {
  man <- leer_csv(file.path(salida, "manifiesto.csv"))
  ps <- unique(man$pulso)
  if (length(solo) && nzchar(solo[1])) ps <- intersect(ps, solo)
  log("motores: %d .pulso, %d formularios, %d workers", length(ps), sum(man$pulso %in% ps), workers)
  run <- function(p) {
    t0 <- Sys.time()
    r <- tryCatch(correr_pulso(p, man), error = function(e) list(list(pulso = p, ok = FALSE, error = paste("corrida:", conditionMessage(e)))))
    message(sprintf("%s pulso %s listo en %.0f s", format(Sys.time(), "%H:%M:%S"), p, as.numeric(difftime(Sys.time(), t0, units = "secs"))))
    r
  }
  res <- if (workers > 1L) parallel::mclapply(ps, run, mc.cores = workers, mc.preschedule = FALSE) else lapply(ps, run)
  filas <- unlist(res, recursive = FALSE)
  cols <- unique(unlist(lapply(filas, names)))
  df <- do.call(rbind, lapply(filas, function(f) {
    f <- lapply(f, function(v) if (is.null(v) || !length(v)) NA else v[[1]])
    as.data.frame(f[cols] |> stats::setNames(cols) |> lapply(function(v) if (is.null(v)) NA else v),
                  stringsAsFactors = FALSE)
  }))
  destino <- file.path(salida, "resultados.csv")
  if (length(solo) && nzchar(solo[1]) && file.exists(destino)) {
    previo <- leer_csv(destino)
    previo <- previo[!previo$pulso %in% ps, , drop = FALSE]
    for (c in setdiff(names(df), names(previo))) previo[[c]] <- rep(NA, nrow(previo))
    for (c in setdiff(names(previo), names(df))) df[[c]] <- rep(NA, nrow(df))
    df <- rbind(previo[, names(df)], df)
  }
  escribir_csv(df, destino)
  invisible(df)
}

# ---------------------------------------------------------------------------
# 5. renders — primeras 2 paginas de cada PDF a PNG
# ---------------------------------------------------------------------------
paso_renders <- function() {
  res <- leer_csv(file.path(salida, "resultados.csv"))
  pdfs <- res$artefacto[res$formato %in% "pdf" & nzchar(res$artefacto %||% "")]
  dir.create(file.path(salida, "renders"), showWarnings = FALSE)
  bin <- .corpus_bin("pdftoppm")
  for (f in pdfs) {
    pref <- file.path(salida, "renders", tools::file_path_sans_ext(basename(f)))
    system2(bin, c("-f", "1", "-l", "2", "-r", "80", "-png", shQuote(f), shQuote(pref)))
  }
  log("renders: %d PDF -> %d PNG", length(pdfs), length(list.files(file.path(salida, "renders"), "\\.png$")))
}

switch(paso,
  copiar = paso_copiar(),
  manifiesto = paso_manifiesto(),
  pulso = paso_pulso(),
  motores = paso_motores(),
  renders = paso_renders(),
  todo = { paso_copiar(); paso_manifiesto(); paso_pulso(); paso_motores(); paso_renders() },
  stop("paso desconocido: ", paso)
)
