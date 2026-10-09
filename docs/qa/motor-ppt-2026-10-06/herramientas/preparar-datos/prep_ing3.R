Sys.setlocale("LC_ALL", "en_US.UTF-8"); SP <- Sys.getenv("SP"); `%||%` <- function(a, b) if (is.null(a)) b else a
x <- readRDS(file.path(SP, "ing_tmp.rds")); src <- x$src; b <- "ingenieria_mecanica"; d <- src$data_sources[[b]]
lab_col <- function(df) grep("^label", names(df))[1]
sm <- function(v) { sv <- src$inst_sources[[b]]$survey; ch <- src$inst_sources[[b]]$choices
  row <- sv[!is.na(sv$name) & sv$name == v, ][1, ]; ln <- row$list_name %||% sub("^select_multiple ", "", row$type)
  cc <- ch[!is.na(ch$list_name) & ch$list_name == ln, ]
  cols <- paste0(v, ".", cc$name); M <- sapply(cols, function(cn) if (cn %in% names(d)) as.character(d[[cn]]) else rep(NA_character_, nrow(d)))
  resp <- rowSums(!is.na(M)) > 0; sel <- colSums(M[resp, , drop = FALSE] == "1", na.rm = TRUE)
  list(base = b, var = v, pregunta = row[[lab_col(sv)]], labels = cc[[lab_col(ch)]], n = as.integer(sel), valid = sum(resp), pct = round(100 * sel / sum(resp))) }
o <- readRDS(file.path(SP, "datos_muestra.rds"))
o$ing_p27 <- sm("p27"); o$ing_p35 <- sm("p35_recod")
for (k in c("ing_p27","ing_p35")) { z <- o[[k]]; cat("\n", k, "base", z$valid, "\n"); print(data.frame(l = substr(z$labels, 1, 60), n = z$n, pct = z$pct)) }
saveRDS(o, file.path(SP, "datos_muestra.rds"))
