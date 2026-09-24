# Cuadro maestro de acreditación: cuándo se intenta el censo y cuándo se sortea.
#
# El documento PULSO «Selección de muestras de actores» (marzo 2026) corta por
# tamaño fijo —estudiantes en aulas en 3000/3001, docentes en 250/251— y del
# otro lado del corte fija un n (1 800 estudiantes; 150 docentes por cuotas).
# Medido en el loop de Cálculo de muestra (2026-09-24): con esos cortes la
# muestra de estudiantes BAJABA al crecer la población (1 800 → 1 519), y un n
# fijo degrada la precisión con N (±2,1 % con 3 001, ±3,1 % con 20 000); en
# docentes, 150 por cuotas no da margen aun con la nómina completa.
#
# Regla (decisión de Gonzalo, 2026-09-24: «haz lo que estadísticamente sea más
# válido»): se intenta el censo mientras el diseño probabilístico pediría al
# menos la cobertura mínima del documento (60 %); desde ahí se sortea con el n
# de una precisión fija. En el punto de cambio ambos piden lo mismo, así que la
# muestra crece con N sin saltos, y del lado probabilístico el margen es
# siempre el declarado. Con las precisiones de abajo el cambio cae en N ≈ 2 052
# (estudiantes) y N ≈ 259 (docentes; el documento cortaba en 250).

# Estudiantes en aulas: conglomerados de cursos-horario, ±2,5 % con deff 2.
.CM_CUADRO_ESTUDIANTES_AULA <- list(z = 1.96, p = 0.5, e = 0.025, deff = 2)
# Docentes con nómina: MAS (estratificado por dedicación si el marco la trae),
# ±5 %. La respuesta se infla con la cobertura mínima observada (60 %).
.CM_CUADRO_DOCENTES <- list(z = 1.96, p = 0.5, e = 0.05, deff = 1)
.CM_CUADRO_COBERTURA_CENSAL <- 0.60

#' TRUE si intentar el censo pide a lo más lo que pediría la muestra: el n de
#' la precisión dada alcanza la cobertura mínima de N.
#'
#' Se compara la fracción SIN redondear, n/N = n0 / (N − 1 + n0) —la misma
#' fórmula de `calc_n_muestra` antes del ceiling—, que decrece estrictamente
#' con N: hay un único punto de cambio. Con el n redondeado la técnica
#' alternaba en el cruce (2 052 muestra, 2 053 censo, 2 054 muestra).
.cm_cuadro_conviene_censo <- function(N, precision, cobertura = .CM_CUADRO_COBERTURA_CENSAL) {
  N <- as.numeric(N)
  if (!is.finite(N) || N <= 1) return(TRUE)
  n0 <- precision$z^2 * precision$p * (1 - precision$p) * precision$deff / precision$e^2
  n0 / (N - 1 + n0) >= cobertura
}
