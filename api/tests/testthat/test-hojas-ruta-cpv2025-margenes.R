# ADR 0131: márgenes del CPV 2025 por distrito (cuotas de persona y calibración de pesos),
# generados por api/inst/hojas_ruta/build_cpv2025_margenes.R desde el REDATAM CPV2025DI.

# Ambos archivos salen de la misma base que `pob25` (población censada, CPV2025DI), así que
# la edad simple debe sumar exactamente `pob25`. La tolerancia es de una persona por cada mil,
# por si el INEI corrige la base y se regenera un archivo antes que el otro.
TOLERANCIA_POB25 <- 0.001

cpv2025_territorio <- function() {
  reg <- jsonlite::read_json(.hojas_ruta_inst_path("hojas_ruta", "territorios.json"), simplifyVector = FALSE)
  pob25 <- unlist(lapply(reg$provincias, function(p) {
    vapply(p$cobertura$distritos, function(x) as.numeric(x$pob25), numeric(1))
  }))
  distritos <- sort(unlist(lapply(reg$provincias, function(p) unlist(p$distritos))))
  list(distritos = distritos, pob25 = pob25)
}

leer_cpv2025 <- function(archivo) {
  path <- .hojas_ruta_inst_path("hojas_ruta", archivo)
  expect_true(file.exists(path), info = paste("falta", archivo))
  utils::read.csv(gzfile(path), colClasses = c(ubigeo = "character"), encoding = "UTF-8")
}

test_that("la edad simple 2025 cubre los distritos del registro y suma pob25", {
  ter <- cpv2025_territorio()
  edad <- leer_cpv2025("cpv2025_edad_simple_distrito.csv.gz")
  expect_true(all(c("ubigeo", "edad", "sexo", "poblacion", "fuente_base", "consultado") %in% names(edad)))
  for (k in c("ubigeo", "edad", "sexo", "poblacion")) expect_false(anyNA(edad[[k]]), info = k)
  expect_true(all(grepl("^[0-9]{6}$", edad$ubigeo)))
  expect_false(any(substr(edad$ubigeo, 1L, 2L) %in% c("26", "27")), info = "ubigeo 2025 sin traducir a 15")
  expect_setequal(unique(edad$ubigeo), ter$distritos)
  expect_setequal(unique(edad$sexo), c("Hombre", "Mujer"))
  expect_true(all(edad$edad >= 0L) && all(edad$poblacion >= 0L))
  expect_false(anyDuplicated(edad[, c("ubigeo", "sexo", "edad")]) > 0L)
  expect_identical(edad[, c("ubigeo", "sexo", "edad")],
                   edad[order(edad$ubigeo, edad$sexo, edad$edad), c("ubigeo", "sexo", "edad")])

  tot <- tapply(edad$poblacion, edad$ubigeo, sum)[ter$distritos]
  rel <- abs(tot - ter$pob25[ter$distritos]) / ter$pob25[ter$distritos]
  expect_true(all(rel <= TOLERANCIA_POB25), info = paste(names(rel)[rel > TOLERANCIA_POB25], collapse = ", "))
})

test_that("los márgenes 18+ traen la grilla completa sexo x quinquenio x nivel y cuadran con la edad simple", {
  ter <- cpv2025_territorio()
  m <- leer_cpv2025("cpv2025_margenes_distrito.csv.gz")
  claves <- c("ubigeo", "sexo", "edad_min", "grupo_edad", "nivel_codigo", "nivel_educativo", "poblacion")
  expect_true(all(c(claves, "edad_max", "fuente", "universo", "consultado") %in% names(m)))
  for (k in claves) expect_false(anyNA(m[[k]]), info = k)
  expect_setequal(unique(m$ubigeo), ter$distritos)
  expect_setequal(unique(m$grupo_edad), c("18_24", "25_34", "35_44", "45_54", "55_64", "65_plus"))
  expect_identical(min(m$edad_min), 18L)
  expect_setequal(unique(m$nivel_codigo), 1:13)
  expect_false(anyDuplicated(m[, c("ubigeo", "sexo", "edad_min", "nivel_codigo")]) > 0L)
  celdas <- length(ter$distritos) * 2L * length(unique(m$edad_min)) * 13L
  expect_identical(nrow(m), celdas)

  # El último quinquenio es abierto (85 a más) y sólo él lleva edad_max vacía.
  expect_identical(unique(m$edad_min[is.na(m$edad_max)]), max(m$edad_min))

  edad <- leer_cpv2025("cpv2025_edad_simple_distrito.csv.gz")
  adultos <- edad[edad$edad >= 18L, ]
  a <- tapply(adultos$poblacion, paste(adultos$ubigeo, adultos$sexo), sum)
  b <- tapply(m$poblacion, paste(m$ubigeo, m$sexo), sum)
  expect_identical(sort(names(a)), sort(names(b)))
  rel <- abs(b[names(a)] - a) / a
  expect_true(all(rel <= TOLERANCIA_POB25), info = paste(names(rel)[rel > TOLERANCIA_POB25], collapse = ", "))
})
