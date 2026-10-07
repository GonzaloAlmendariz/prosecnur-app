Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
SP <- Sys.getenv("SP")
r <- load_pulso(file.path(SP, "ing.pulso")); s <- session_get(r$session_id)
src <- .graficos_processing_sources(r$session_id)
cat("bases:", names(src$data_sources), "\n")
pb <- s$graficos_config_por_base; walk <- function(x, acc = list()) { if (is.list(x)) { if (!is.null(x$graficador)) return(c(acc, list(x))); for (e in x) acc <- walk(e, acc) }; acc }
sl <- pb[["ingenieria_civil"]]$plan$slides
for (i in c(7, 22, 25, 29, 30)) { els <- walk(sl[[i]]$payload); for (e in els) { a <- e$args %||% e; cat(i, e$graficador, paste(unlist(a$var %||% a$vars), collapse = ","), "| titulo:", substr(a$titulo %||% "", 1, 60), "\n") } }
lab_col <- function(df) grep("^label", names(df))[1]
sm <- function(b, v) { sv <- src$inst_sources[[b]]$survey; ch <- src$inst_sources[[b]]$choices
  row <- sv[!is.na(sv$name) & sv$name == v, ][1, ]; ln <- row$list_name %||% sub("^select_multiple ", "", row$type)
  cc <- ch[!is.na(ch$list_name) & ch$list_name == ln, ]; d <- as.character(src$data_sources[[b]][[v]]); d <- d[!is.na(d) & d != ""]
  tok <- strsplit(d, " "); n <- sapply(as.character(cc$name), function(cd) sum(vapply(tok, function(t) cd %in% t, TRUE)))
  list(base = b, var = v, pregunta = row[[lab_col(sv)]], labels = cc[[lab_col(ch)]], n = n, valid = length(d), pct = round(100 * n / length(d))) }
saveRDS(list(src = src, sm = sm), file.path(SP, "ing_tmp.rds"))
