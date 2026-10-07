Sys.setlocale("LC_ALL", "en_US.UTF-8")
SP <- Sys.getenv("SP")
`%||%` <- function(a, b) if (is.null(a)) b else a
conta <- readRDS(file.path(SP, "src_conta.rds")); acg <- readRDS(file.path(SP, "src_acg.rds"))
lab_col <- function(df) grep("^label", names(df))[1]
meta <- function(src, b, v) {
  sv <- src$inst_sources[[b]]$survey; ch <- src$inst_sources[[b]]$choices
  row <- sv[!is.na(sv$name) & sv$name == v, ][1, ]
  ln <- row$list_name %||% sub("^select_(one|multiple) ", "", row$type)
  cc <- ch[!is.na(ch$list_name) & ch$list_name == ln, ]
  list(label = row[[lab_col(sv)]], type = row$type, codes = as.character(cc$name), labels = cc[[lab_col(ch)]])
}
freq <- function(src, b, v) {
  m <- meta(src, b, v); d <- as.character(src$data_sources[[b]][[v]]); d <- d[!is.na(d) & d != ""]
  n <- table(factor(d, levels = m$codes))
  list(base = b, var = v, pregunta = m$label, labels = m$labels, n = as.integer(n), valid = length(d),
       pct = round(100 * as.integer(n) / length(d)))
}
out <- list()
out$genero   <- freq(conta, "estudiantes", "p5")
out$rango    <- freq(conta, "estudiantes", "p3_recod")
out$ciclo    <- freq(conta, "estudiantes", "p6")
out$edad     <- list(x = as.numeric(conta$data_sources$estudiantes$p3), pregunta = meta(conta, "estudiantes", "p3")$label)
out$titulo   <- freq(conta, "egresados", "p8")
out$anio     <- freq(conta, "egresados", "p9")
out$sueldo   <- freq(conta, "egresados", "p13")
out$mision1  <- lapply(list(c("docentes","p9"),c("estudiantes","p7"),c("egresados","p14"),c("administrativos","p6")), function(x) freq(conta, x[1], x[2]))
out$mision2  <- lapply(list(c("docentes","p10"),c("estudiantes","p8"),c("egresados","p15"),c("administrativos","p7")), function(x) freq(conta, x[1], x[2]))
out$likert1  <- freq(conta, "estudiantes", "p16_6")
# las afirmaciones de la lámina 26 (búsqueda por texto en el instrumento)
for (b in c("docentes","egresados","administrativos")) { sv <- conta$inst_sources[[b]]$survey; l <- sv[[lab_col(sv)]]
  i <- grep("estatuto|normas internas de la Facultad|recursos presupuestales", l); for (k in i) cat("L26", b, sv$name[k], substr(l[k], 1, 70), "\n") }
# radar -> tabla: TTB = De acuerdo + Totalmente de acuerdo sobre válidos
ttb <- function(b, v) { f <- freq(conta, b, v); top <- grep("^De acuerdo$|^Totalmente de acuerdo$", trimws(f$labels), ignore.case = TRUE)
  list(item = f$pregunta, ttb = round(100 * sum(f$n[top]) / f$valid), valid = f$valid, labels = f$labels) }
out$radar <- list(docentes = lapply(sprintf("p30_%d", 1:6), function(v) ttb("docentes", v)),
                  estudiantes = lapply(sprintf("p22_%d", 1:6), function(v) ttb("estudiantes", v)),
                  egresados = lapply(sprintf("p28_%d", 1:6), function(v) ttb("egresados", v)))
cat("RADAR docentes:", sapply(out$radar$docentes, `[[`, "ttb"), " items:", sapply(out$radar$docentes, function(x) substr(x$item, 1, 25)), "\n")
cat("RADAR estudiantes:", sapply(out$radar$estudiantes, `[[`, "ttb"), "\nRADAR egresados:", sapply(out$radar$egresados, `[[`, "ttb"), "\n")
cat("escala p30_1:", out$radar$docentes[[1]]$labels, "\n")
# selección múltiple ACG
b <- names(acg$data_sources)[1]; m <- meta(acg, b, "D1_information"); d <- as.character(acg$data_sources[[b]]$D1_information)
d <- d[!is.na(d) & d != ""]; tok <- strsplit(d, " ")
out$multiple <- list(pregunta = m$label, labels = m$labels, n = sapply(m$codes, function(cd) sum(vapply(tok, function(t) cd %in% t, TRUE))), valid = length(d))
out$multiple$pct <- round(100 * out$multiple$n / out$multiple$valid)
str(out$multiple); cat("misión docentes:", out$mision1[[1]]$labels, out$mision1[[1]]$pct, "\n")
cat("likert1:", out$likert1$labels, "|", out$likert1$pct, "valid", out$likert1$valid, "\n")
cat("rango:", out$rango$labels, out$rango$pct, "| ciclo:", out$ciclo$labels, "\n| sueldo:", out$sueldo$labels, "\n| anio:", out$anio$labels, out$anio$valid, "\n")
saveRDS(out, file.path(SP, "datos_muestra.rds"))
