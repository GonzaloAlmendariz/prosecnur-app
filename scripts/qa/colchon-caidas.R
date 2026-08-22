`%||%` <- function(a, b) if (is.null(a)) b else a
norm <- function(x) toupper(trimws(gsub("[[:space:]]+", " ", x)))
tmp <- file.path(tempdir(), "a1e"); unlink(tmp, recursive = TRUE); dir.create(tmp)
utils::unzip(file.path(Sys.getenv("SP"), "HSVG2026_definitivo.pulso"), exdir = tmp)
st <- readRDS(file.path(tmp, "state.rds"))
df <- st$calc_muestra_aulas_selection$selection
tit <- df[df$sample_role == "titular", ]
tit$rinde <- as.numeric(tit$eligible_n_neto) * as.numeric(tit$rendimiento_ref)
tit$fac <- norm(tit$faculty)

est <- st$calc_muestra_estudio$componentes[[1]]$marco$estratos
cu <- data.frame(
  lab = norm(vapply(est, function(e) as.character(e$label %||% e$id %||% ""), character(1))),
  cuota = vapply(est, function(e) as.numeric(e$cuota_fija %||% NA_real_), numeric(1)),
  stringsAsFactors = FALSE)
cu <- cu[!is.na(cu$cuota) & cu$cuota > 0, ]

cat(sprintf("%-34s %5s %7s %7s %8s\n", "facultad", "aulas", "espera", "cuota", "colchon"))
sin <- 0; deficit <- 0
for (i in seq_len(nrow(cu))) {
  sub <- tit[tit$fac == cu$lab[i], ]
  if (!nrow(sub)) { cat(sprintf("%-34s   SIN AULAS (cuota %.0f)\n", substr(cu$lab[i],1,34), cu$cuota[i])); next }
  esp <- sum(sub$rinde); q <- cu$cuota[i]
  colchon <- if (esp < q) -1L else sum(cumsum(sort(sub$rinde, decreasing = TRUE)) <= (esp - q))
  if (esp < q) deficit <- deficit + 1 else if (colchon <= 0) sin <- sin + 1
  cat(sprintf("%-34s %5d %7.0f %7.0f %8s\n", substr(cu$lab[i],1,34), nrow(sub), esp, q,
              if (esp < q) sprintf("DEFICIT %.0f", q - esp) else as.character(colchon)))
}
cat("\nen deficit (no llegan a su cuota ni sin caidas):", deficit,
    "\nsin colchon (cualquier caida obliga a reemplazo):", sin, "\n")
