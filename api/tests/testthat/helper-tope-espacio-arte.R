# =============================================================================
# Fixture del recorte por espacio con los conteos de Arte (P5 y P7, 2026-11-09)
# =============================================================================
#
# Tres preguntas que la lámina rotula 58 % (las unidades suman 100) con Top Two Box sin redondear 58,06 (estudiantes
# p24_2), 57,39 (docentes p15_1) y 58,26 (docentes p30_3), en orden CRUZADO: estudiantes va primero en `vars`.
# Prefijo `.tea_`: testthat carga los helper-*.R para todos los archivos.

.tea_inst <- function(vars) list(
  survey = data.frame(name = vars, type = "select_one lk", list_name = "lk", label = paste("Pregunta", vars), stringsAsFactors = FALSE),
  choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4", "9"),
                       label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"),
                       stringsAsFactors = FALSE),
  listas_ordinales_declaradas = "lk")   # la base de estudiantes tiene dos preguntas: no forma batería por sí sola
.tea_col <- function(cuentas) rep(c("1", "2", "3", "4", "9"), cuentas)
.tea_fuentes <- function() {
  bajas <- lapply(1:19, function(i) c(20, 40 - i, 30 + i, 5, 10))   # Top Two Box de 35 a 53 % sobre 105, todas bajo 60
  doc <- c(stats::setNames(lapply(bajas, .tea_col), sprintf("q%02d", 1:19)),
           list(p15_1 = .tea_col(c(3, 33, 56, 10, 13)), p30_3 = .tea_col(c(3, 19, 52, 15, 26))))
  n_doc <- 115L
  doc <- lapply(doc, function(x) c(x, rep("9", n_doc - length(x)))[seq_len(n_doc)])
  est <- list(p24_2 = .tea_col(c(13, 57, 126, 36, 47)), p24_9 = .tea_col(c(5, 20, 150, 80, 24)))   # p24_9: 82 %, no entra
  list(data_sources = list(estudiantes = as.data.frame(est, stringsAsFactors = FALSE), docentes = as.data.frame(doc, stringsAsFactors = FALSE)),
       inst_sources = list(estudiantes = .tea_inst(names(est)), docentes = .tea_inst(names(doc))))
}
.tea_el <- function(regla = list(tipo = "bajo_umbral", umbral = 60))
  p_barras_divergentes(vars = c("estudiantes$*", "docentes$*"), n_negativas = 2, incluir_neutro = FALSE, estilo = "resumen", regla = regla)
