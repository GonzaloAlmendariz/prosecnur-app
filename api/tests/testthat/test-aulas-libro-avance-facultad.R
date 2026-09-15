# =============================================================================
# El avance por facultad y sexo de la hoja «Avance de campo»
# (hasta A13a, 2026-08-31, «Cómo va el campo»; Gonzalo: «es AVANCE»)
# =============================================================================
#
# Encargo de Gonzalo: la tabla de avance al cliente se centra en «el reporte de
# avance por facultad por sexo a la muestra y la sobremuestra y la cantidad de
# aulas aplicadas». La hoja ya existía con el agregado del estudio; esto añade
# el corte que decide, porque la cuota es por facultad y por sexo y NO se
# compensa entre celdas (ADR 0079).
#
# Desde el 2026-09-08 las columnas son las que dictó Gonzalo con el Sheets vivo
# delante (textual: «Facultad, muestra, muestra mujeres, muestra hombres,
# efectivas, efectivas hombres, efectivas mujeres, faltantes (sobre muestra),
# faltantes hombre, faltantes mujeres, aulas aplicadas, sobremuestra,
# sobremuestra mujeres, sobremuestra hombres, faltantes (sobre la
# sobremuestra)»). Contrato anterior, citado para quien lea un diff: «Muestra ·
# Muestra mujeres · Muestra hombres · Aulas aplicadas · Aulas del plan ·
# Conseguidas · Conseguidas mujeres · Conseguidas hombres · Techo con
# sobremuestra · Avance · Faltan».

.lafac_aula <- function(id, fac, code, aplicada = TRUE, meta = 10) {
  list(classroom_id = id, operational_code = code, faculty = fac,
       label = paste("Aula", id), sample_role = "titular", wave = "M1",
       eligible_n = 30, expected_valid = meta,
       operational_status = if (aplicada) "aplicada" else "agendada")
}

.lafac_cuotas <- function(..., meta_diseno = NULL, meta_operativa = NULL) {
  facs <- list(...)
  out <- list(schema = "monitoreo_aulas_design_targets_v1", facultades = facs)
  if (!is.null(meta_diseno)) out$meta_diseno <- meta_diseno
  if (!is.null(meta_operativa)) out$meta_operativa <- meta_operativa
  out
}

.lafac_fac <- function(nombre, cuota, F = NULL, M = NULL) {
  list(facultad = nombre, faculty_key = .cm_criterios_fac_key(nombre),
       cuota = cuota, cuota_sexo = list(F = F, M = M), tau = 0.5)
}

.lafac_cfg <- function() list(source_mapping = list(collector_var = "collectorID", sex_var = "sexo"))

# Dos facultades con reparto por sexo y respuestas con sexo: FAC1 pide 10
# (6 F / 4 M) y recibe 6 (4 F / 2 M); FAC2 pide 5 (2 F / 3 M) y recibe 4
# (3 F / 1 M): en FAC2 sobran mujeres y faltan hombres, que es el caso que
# separa la suma por celdas del neto.
.lafac_dos <- function() list(
  plan = list(.lafac_aula("AULA-1", "FAC1", "CH 1"), .lafac_aula("AULA-2", "FAC2", "CH 2")),
  efectivas = c(`CH 1` = 6, `CH 2` = 4),
  responses = data.frame(
    collectorID = c(rep("AULA-1", 6), rep("AULA-2", 4)),
    sexo = c("Femenino", "Femenino", "Femenino", "Masculino", "Masculino", "Femenino",
             "Femenino", "Femenino", "Femenino", "Masculino"),
    stringsAsFactors = FALSE
  ),
  cuotas = .lafac_cuotas(.lafac_fac("FAC1", 10, F = 6, M = 4), .lafac_fac("FAC2", 5, F = 2, M = 3),
                         meta_diseno = 15, meta_operativa = 30)
)

.lafac_tabla_dos <- function() {
  d <- .lafac_dos()
  prosecnurapp:::.calaf_avance_por_facultad(
    d$plan, efectivas = d$efectivas, cuotas = d$cuotas, responses = d$responses, cfg = .lafac_cfg())
}

test_that("sin cuotas del diseño el bloque no se inventa: devuelve NULL", {
  plan <- list(.lafac_aula("A1", "FAC1", "CH 1"))
  expect_null(prosecnurapp:::.calaf_avance_por_facultad(plan, cuotas = NULL))
  expect_null(prosecnurapp:::.calaf_avance_por_facultad(plan, cuotas = list(facultades = list())))
})

test_that("las columnas son las que dictó Gonzalo, en su orden", {
  out <- .lafac_tabla_dos()
  # El orden del segundo dictado del 2026-09-08: CADA META SEGUIDA DE LO QUE LE
  # FALTA, primero en total y después por sexo, hombres antes que mujeres.
  #
  # Y el del 2026-09-15: el bloque de aulas PEGADO a «Efectivas» —donde se
  # compara con algo— en vez de cerrando la tabla veinte columnas más allá.
  expect_identical(names(out), c(
    "Facultad",
    "Efectivas", "Avance muestra",
    "Aulas aplicadas", "Aulas planificadas", "Aulas proyectadas al cierre",
    "Efectivas hombres", "Avance muestra hombres",
    "Efectivas mujeres", "Avance muestra mujeres",
    "Muestra", "Faltantes muestra",
    "Muestra hombres", "Faltantes hombres muestra",
    "Muestra mujeres", "Faltantes mujeres muestra",
    "Sobremuestra", "Faltantes sobremuestra",
    "Sobremuestra hombres", "Faltantes hombres sobremuestra",
    "Sobremuestra mujeres", "Faltantes mujeres sobremuestra"
  ))
  # «Aulas aplicadas» aparece UNA vez: la que cerraba la tabla se movió, no se
  # duplicó. Con el contrato comparando listas enteras esto ya lo cubre, pero
  # un duplicado es justo lo que un `identical` mal actualizado dejaría pasar.
  expect_identical(sum(names(out) == "Aulas aplicadas"), 1L)
  # Y son EXACTAMENTE las del vocabulario compartido, que es de donde las leen
  # el renderer del Sheets, el writer del xlsx y el PDF. Si esta igualdad se
  # rompe, tres salidas se quedan pintando columnas que ya no existen.
  expect_identical(names(out), AULAS_AVANCE_CABECERAS$facultad)
  # Las tres que el dictado no nombra ya no están.
  expect_false(any(c("Aulas del plan", "Avance", "Techo con sobremuestra") %in% names(out)))
})

test_that("cada «Efectivas» lleva a su derecha su avance sobre la muestra", {
  # Gonzalo, 2026-09-08, viendo la tabla publicada: «al lado de cada
  # "Efectivas..." tiene que haber un porcentaje de avance». Un conteo suelto no
  # dice si 109 es mucho o poco sin ir a buscar la muestra siete columnas más
  # allá.
  t <- .lafac_tabla_dos()
  cols <- names(t)
  for (par in list(c("Efectivas", "Avance muestra"),
                   c("Efectivas hombres", "Avance muestra hombres"),
                   c("Efectivas mujeres", "Avance muestra mujeres"))) {
    expect_identical(which(cols == par[[2]]), which(cols == par[[1]]) + 1L,
                     info = sprintf("«%s» no va justo a la derecha de «%s»", par[[2]], par[[1]]))
  }
  fac1 <- t[t$Facultad == "FAC1", , drop = FALSE]
  expect_equal(fac1$`Avance muestra`, 6 / 10)
  expect_equal(fac1$`Avance muestra hombres`, 2 / 4)
  expect_equal(fac1$`Avance muestra mujeres`, 4 / 6)
})

test_that("la fila Total no SUMA porcentajes: los recalcula desde los agregados", {
  # Sumar quince avances del 40 % daría 600 %. El único porcentaje que significa
  # algo en esa fila es el de los totales ya sumados.
  t <- .lafac_tabla_dos()
  total <- prosecnurapp:::.calaf_fila_total(t)
  expect_equal(total$`Avance muestra`, 10 / 15)
  expect_equal(total$`Avance muestra hombres`, 3 / 7)
  expect_equal(total$`Avance muestra mujeres`, 7 / 8)
  expect_false(isTRUE(all.equal(total$`Avance muestra`, sum(t$`Avance muestra`))))
})

test_that("las faltantes por sexo contra la SOBREMUESTRA existen y no se compensan", {
  # Ganadas el 2026-09-08. Antes sólo vivían sumadas dentro del bloque de meta:
  # se sabía que faltaban N mujeres para la sobremuestra del estudio y no en
  # cuál de las facultades.
  #
  # FAC2 pide 5 (2 F / 3 M) y recibe 4 (3 F / 1 M); con ratio 2 su sobremuestra
  # es 10 (4 F / 6 M): sobran mujeres contra su celda y faltan hombres.
  t <- .lafac_tabla_dos()
  fac2 <- t[t$Facultad == "FAC2", , drop = FALSE]
  expect_equal(fac2$`Sobremuestra mujeres`, 4)
  expect_equal(fac2$`Sobremuestra hombres`, 6)
  expect_equal(fac2$`Faltantes mujeres sobremuestra`, 1)   # 4 pedidas, 3 recibidas
  expect_equal(fac2$`Faltantes hombres sobremuestra`, 5)   # 6 pedidos, 1 recibido
})

test_that("la tabla se niega a salir con columnas que no sean las del vocabulario", {
  # El guard existe porque el modo de fallo del anclaje por rótulo es MUDO: una
  # columna renombrada aquí dejaría al formateador del Sheets sin reconocerla y
  # saldría publicada sin numFmt y sin color, sin que nada avise.
  fila <- data.frame(Facultad = "X", Efectivas = 1, check.names = FALSE)
  expect_error(prosecnurapp:::.calaf_exigir_cabecera(fila), "AULAS_AVANCE_CABECERAS")
})

test_that("la muestra es la CUOTA del diseño y trae su reparto por sexo", {
  plan <- list(.lafac_aula("A1", "FAC1", "CH 1"), .lafac_aula("A2", "FAC1", "CH 2"))
  ef <- c(`CH 1` = 12, `CH 2` = 8)
  out <- prosecnurapp:::.calaf_avance_por_facultad(
    plan, efectivas = ef, cuotas = .lafac_cuotas(.lafac_fac("FAC1", 40, F = 22, M = 18)))
  expect_equal(nrow(out), 1L)
  expect_equal(out$Muestra, 40)
  expect_equal(out$`Muestra mujeres`, 22)
  expect_equal(out$`Muestra hombres`, 18)
  expect_equal(out$Efectivas, 20)
  expect_equal(out$`Faltantes muestra`, 20)
})

test_that("las aulas aplicadas se cuentan por operational_status, no por el parte", {
  # Medido el 2026-08-26: en un estudio real `application_status` llega vacío en
  # las 269 filas mientras `operational_status` marca 152 aplicadas.
  plan <- list(
    .lafac_aula("A1", "FAC1", "CH 1", aplicada = TRUE),
    .lafac_aula("A2", "FAC1", "CH 2", aplicada = FALSE),
    .lafac_aula("A3", "FAC1", "CH 3", aplicada = FALSE)
  )
  expect_true(all(vapply(plan, function(u) is.null(u$application_status), logical(1))))
  out <- prosecnurapp:::.calaf_avance_por_facultad(
    plan, efectivas = c(`CH 1` = 5), cuotas = .lafac_cuotas(.lafac_fac("FAC1", 20)))
  expect_equal(out$`Aulas aplicadas`, 1L)
})

test_that("el reparto por sexo de lo conseguido se atribuye por classroom_id", {
  # La primera versión mapeó por `operational_code` y las respuestas cayeron
  # todas en NA: son dos identificadores distintos del mismo aula, y el que
  # viaja en la respuesta es el del QR. En HSVG2026 pasó lo contrario —el QR
  # lleva el código operativo y el cruce sólo miraba `classroom_id`—, así que
  # desde el 2026-09-07 el reparto se apoya en
  # `monitoreo_aulas_efectivas_por_sexo()`, que resuelve las TRES claves.
  #
  # Y la variable de sexo se DECLARA: buscarla por nombre («sex», «sexo») era la
  # otra mitad del defecto, porque en ese estudio la columna es
  # `datos_demo/P2`.
  plan <- list(.lafac_aula("AULA-1", "FAC1", "CH 1"))
  resp <- data.frame(
    collectorID = rep("AULA-1", 6),
    sexo = c("Femenino", "Femenino", "Femenino", "Masculino", "Masculino", "Femenino"),
    stringsAsFactors = FALSE
  )
  out <- prosecnurapp:::.calaf_avance_por_facultad(
    plan, efectivas = c(`CH 1` = 6), cuotas = .lafac_cuotas(.lafac_fac("FAC1", 10, F = 6, M = 4)),
    responses = resp, cfg = .lafac_cfg())
  expect_equal(out$`Efectivas mujeres`, 4)
  expect_equal(out$`Efectivas hombres`, 2)
  # Y lo que falta en cada celda: 6 - 4 y 4 - 2.
  expect_equal(out$`Faltantes mujeres muestra`, 2)
  expect_equal(out$`Faltantes hombres muestra`, 2)
  expect_equal(out$`Faltantes muestra`, 4)
})

test_that("la tabla NO compensa entre facultades y abre por la que más falta", {
  plan <- list(
    .lafac_aula("A1", "CORTA", "CH 1"),
    .lafac_aula("B1", "SOBRADA", "CH 2")
  )
  out <- prosecnurapp:::.calaf_avance_por_facultad(
    plan, efectivas = c(`CH 1` = 5, `CH 2` = 90),
    cuotas = .lafac_cuotas(.lafac_fac("CORTA", 50), .lafac_fac("SOBRADA", 10)))
  # La que peor va abre la tabla: es lo que se mira primero.
  expect_equal(out$Facultad[[1]], "CORTA")
  expect_equal(out$`Faltantes muestra`[[1]], 45)
  # Y el superávit de la otra no descuenta: `Faltantes` se acota en 0, no negativo.
  expect_equal(out$`Faltantes muestra`[[2]], 0)
})

test_that("ni entre sexos: en una facultad con mujeres de sobra, los hombres que faltan se declaran", {
  out <- .lafac_tabla_dos()
  fac2 <- out[out$Facultad == "FAC2", , drop = FALSE]
  expect_equal(fac2$`Faltantes mujeres muestra`, 0)   # 2 pedidas, 3 recibidas: sobra, no resta
  expect_equal(fac2$`Faltantes hombres muestra`, 2)   # 3 pedidos, 1 recibido
  expect_equal(fac2$`Faltantes muestra`, 2)             # la suma de las celdas, no el neto (1)
})

test_that("sin efectivas no se publica un cero: se declara NA", {
  # Un 0 conseguidas se leería como «no consiguió nada»; sin base de respuestas
  # lo cierto es que todavía no se sabe.
  plan <- list(.lafac_aula("A1", "FAC1", "CH 1"))
  out <- prosecnurapp:::.calaf_avance_por_facultad(
    plan, efectivas = NULL, cuotas = .lafac_cuotas(.lafac_fac("FAC1", 20)))
  expect_true(is.na(out$Efectivas))
  expect_true(is.na(out$`Faltantes muestra`))
  expect_true(is.na(out$`Faltantes sobremuestra`))
})

# ---------------------------------------------------------------------------
# La sobremuestra: la segunda meta, con el mismo trato que la primera.
#
# Hasta el 2026-08-30 la cabecera del modulo decia que la sobremuestra «no
# viaja al libro», y era cierto. Dejo de serlo cuando `design_targets` paso a
# publicar `meta_diseno` y `meta_operativa`. Una salvedad correcta que caduca
# por un arreglo propio no avisa: por eso hay test. Y desde el 2026-09-08 ya no
# es un «techo» derivado: es la segunda meta, repartida por facultad y por sexo.
# ---------------------------------------------------------------------------

test_that("la sobremuestra por facultad sale del ratio del diseño, no de un 1,5 supuesto", {
  unidades <- list(
    list(operational_code = "CH 1", faculty = "DERECHO", operational_status = "aplicada"),
    list(operational_code = "CH 2", faculty = "DERECHO", operational_status = "agendada")
  )
  cuotas <- list(
    meta_diseno = 100, meta_operativa = 250,   # ratio 2,5 y NO 1,5
    facultades = list(list(facultad = "DERECHO", faculty_key = "derecho", cuota = 40))
  )
  t <- prosecnurapp:::.calaf_avance_por_facultad(unidades, c(`CH 1` = 10, `CH 2` = 0), cuotas)
  expect_true("Sobremuestra" %in% names(t))
  # 40 x 2,5 = 100. Con un 1,5 cableado saldria 60.
  expect_equal(t$Sobremuestra[[1]], 100)
  # Sin reparto por sexo en el diseño, la sobremuestra por sexo calla.
  expect_true(is.na(t$`Sobremuestra mujeres`[[1]]))
  # Y los faltantes contra ella: 100 - 10, neto porque no hay celdas.
  expect_equal(t$`Faltantes sobremuestra`[[1]], 90)
})

test_that("sin las dos cifras del diseño la columna queda en NA y no se inventa", {
  unidades <- list(list(operational_code = "CH 1", faculty = "DERECHO",
                        operational_status = "aplicada"))
  # Un estudio viejo: cuotas por facultad pero sin meta_diseno/meta_operativa.
  cuotas <- list(facultades = list(list(facultad = "DERECHO", faculty_key = "derecho", cuota = 40)))
  t <- prosecnurapp:::.calaf_avance_por_facultad(unidades, c(`CH 1` = 10), cuotas)
  expect_true(is.na(t$Sobremuestra[[1]]))
  expect_true(is.na(t$`Faltantes sobremuestra`[[1]]))
})

test_that("el reparto por resto mayor da enteros que suman exactamente el total", {
  expect_equal(prosecnurapp:::.calaf_repartir(10, c(1, 1, 1)), c(4, 3, 3))
  expect_equal(sum(prosecnurapp:::.calaf_repartir(398, c(125, 119, 21))), 398)
  # Proporcional: la parte grande se lleva la parte grande.
  r <- prosecnurapp:::.calaf_repartir(398, c(125, 119, 21))
  expect_true(r[[1]] > r[[2]] && r[[2]] > r[[3]])
  # Sin pesos o sin total no hay reparto que afirmar.
  expect_true(all(is.na(prosecnurapp:::.calaf_repartir(10, c(0, 0)))))
  expect_true(all(is.na(prosecnurapp:::.calaf_repartir(NA, c(1, 2)))))
})

test_that("la sobremuestra se reparte entre facultades y sexos, y las partes suman el total", {
  # Quince redondeos de `cuota x ratio` no tienen por qué sumar la sobremuestra
  # del diseño; con el reparto, la fila Total y el bloque de meta dicen lo mismo.
  facs <- list(.lafac_fac("A", 125, F = 85, M = 40), .lafac_fac("B", 119, F = 94, M = 25),
               .lafac_fac("C", 21, F = 12, M = 9))
  cuotas <- .lafac_cuotas(facs[[1]], facs[[2]], facs[[3]], meta_diseno = 2500, meta_operativa = 3750)
  unidades <- list(list(operational_code = "CH 1", faculty = "A", operational_status = "aplicada"))
  t <- prosecnurapp:::.calaf_avance_por_facultad(unidades, c(`CH 1` = 0), cuotas)
  # 265 x 1,5 = 397,5 -> 398 (round de R), repartidos 188 / 179 / 31.
  expect_equal(sum(t$Sobremuestra), 398)
  expect_equal(t$Sobremuestra[t$Facultad == "A"], 188)
  # Dentro de cada facultad, mujeres + hombres = la sobremuestra de la facultad.
  expect_equal(t$`Sobremuestra mujeres` + t$`Sobremuestra hombres`, t$Sobremuestra)
  expect_equal(t$`Sobremuestra mujeres`[t$Facultad == "A"], 128)
})

test_that("la fila Total suma personas y aulas, y los faltantes sin netear (ADR 0079)", {
  out <- .lafac_tabla_dos()
  total <- prosecnurapp:::.calaf_fila_total(out)
  expect_identical(nrow(total), 1L)
  expect_identical(names(total), names(out))
  expect_identical(total$Facultad, "Total")
  expect_equal(total$Muestra, 15)
  expect_equal(total$`Muestra mujeres`, 8)
  expect_equal(total$`Muestra hombres`, 7)
  expect_equal(total$Efectivas, 10)
  expect_equal(total$`Efectivas mujeres`, 7)
  expect_equal(total$`Efectivas hombres`, 3)
  # 4 (FAC1) + 2 (FAC2): la suma de las celdas, no 15 - 10 = 5.
  expect_equal(total$`Faltantes muestra`, 6)
  expect_equal(total$`Faltantes mujeres muestra`, 2)
  expect_equal(total$`Faltantes hombres muestra`, 4)
  expect_equal(total$`Aulas aplicadas`, 2)
  # Ratio 2: 30 repartidos 20 / 10; por sexo 12+8 y 4+6.
  expect_equal(total$Sobremuestra, 30)
  expect_equal(total$`Sobremuestra mujeres`, 16)
  expect_equal(total$`Sobremuestra hombres`, 14)
  # FAC1: (12-4) + (8-2) = 14; FAC2: (4-3) + (6-1) = 6.
  expect_equal(total$`Faltantes sobremuestra`, 20)
  # Una tabla sin nada que sumar en una columna deja NA, no 0.
  sin_sexo <- prosecnurapp:::.calaf_avance_por_facultad(
    list(.lafac_aula("A1", "FAC1", "CH 1")), efectivas = c(`CH 1` = 3),
    cuotas = .lafac_cuotas(.lafac_fac("FAC1", 20)))
  expect_true(is.na(prosecnurapp:::.calaf_fila_total(sin_sexo)$`Efectivas mujeres`))
  expect_null(prosecnurapp:::.calaf_fila_total(NULL))
})

test_that("la nota nombra las dos metas con el mismo rango y no llama referencial a la sobremuestra", {
  nota <- prosecnurapp:::.calaf_nota_metas(.lafac_tabla_dos())
  expect_match(nota, "Muestra \\(15\\) y sobremuestra \\(30\\) son las dos metas")
  expect_match(nota, "x2\\)")
  for (prohibida in c("referencial", "margen", "segunda meta", "techo")) {
    expect_false(grepl(prohibida, nota, ignore.case = TRUE), info = prohibida)
  }
  # Sin sobremuestra en el diseño, lo dice.
  sin <- prosecnurapp:::.calaf_avance_por_facultad(
    list(.lafac_aula("A1", "FAC1", "CH 1")), efectivas = c(`CH 1` = 3),
    cuotas = .lafac_cuotas(.lafac_fac("FAC1", 20)))
  expect_match(prosecnurapp:::.calaf_nota_metas(sin), "no publica la sobremuestra")
})

# Localiza la cabecera de UNA tabla entre las filas publicadas. Se busca por la
# cabecera COMPLETA y no por su primera celda: cuatro de las cinco tablas de la
# hoja empiezan por «Facultad» desde el 2026-09-08, y `which(primera ==
# "Facultad")` devolvía cuatro posiciones.
.lafac_cabecera_de <- function(filas, clave) {
  which(vapply(filas, function(f) {
    identical(prosecnurapp:::.calac_tabla_de_cabecera(
      vapply(f, function(x) as.character(x), character(1))), clave)
  }, logical(1)))
}

test_that("en el Sheets y en el xlsx la tabla por facultad cierra con la fila Total", {
  d <- .lafac_dos()
  ind <- aulas_libro_indicadores(
    d$plan, efectivas = d$efectivas, responses = d$responses,
    validas = rep(TRUE, nrow(d$responses)), cuotas = d$cuotas, cfg = .lafac_cfg())
  expect_identical(nrow(ind$facultades), 2L)

  # Sheets: cabecera de la tabla por facultad, dos facultades y «Total» justo
  # debajo, con la muestra sumada y el faltante por celdas. Las celdas viajan
  # como NÚMEROS desde el 2026-09-08, así que se comparan como números.
  filas <- aulas_libro_hoja_avance(ind, fecha = as.Date("2026-08-15"))
  primera <- vapply(filas, function(f) as.character(f[[1]]), character(1))
  cab <- .lafac_cabecera_de(filas, "facultad")
  expect_length(cab, 1L)
  total <- cab + 3L
  expect_identical(primera[[total]], "Total")
  nombres <- as.character(unlist(filas[[cab]]))
  fila_total <- filas[[total]]
  celda <- function(rotulo) fila_total[[which(nombres == rotulo)]]
  expect_identical(celda("Muestra"), 15)
  expect_identical(celda("Faltantes muestra"), 6)
  expect_identical(celda("Faltantes sobremuestra"), 20)
  # Y la nota, la misma que el xlsx, justo debajo.
  expect_identical(primera[[total + 1L]], prosecnurapp:::.calaf_nota_metas(ind$facultades))

  # xlsx: la misma fila, en negrita.
  wb <- openxlsx::createWorkbook()
  aulas_libro_escribir_indicadores(wb, ind, hoja = "Avance de campo")
  path <- withr::local_tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  celdas <- openxlsx::read.xlsx(path, sheet = "Avance de campo", colNames = FALSE,
                                skipEmptyRows = FALSE, skipEmptyCols = FALSE)
  col1 <- as.character(celdas[[1]])
  cab_x <- which(!is.na(col1) & col1 == "Facultad" &
                   !is.na(as.character(celdas[[2]])) &
                   as.character(celdas[[2]]) == "Efectivas")
  expect_length(cab_x, 1L)
  expect_identical(col1[[cab_x + 3L]], "Total")
  nombres_x <- as.character(celdas[cab_x, ])
  expect_identical(as.character(celdas[cab_x + 3L, which(nombres_x == "Muestra")]), "15")
  expect_identical(as.character(celdas[cab_x + 3L, which(nombres_x == "Faltantes muestra")]), "6")
  negrita <- FALSE
  for (so in openxlsx::loadWorkbook(path)$styleObjects) {
    if (!identical(so$sheet, "Avance de campo") || !((cab_x + 3L) %in% so$rows)) next
    if (any(grepl("BOLD", toupper(as.character(so$style$fontDecoration %||% "")), fixed = TRUE))) negrita <- TRUE
  }
  expect_true(negrita)
})

# --- El bloque de aulas: aplicadas · planificadas · proyectadas al cierre -----
#
# Dictado de Gonzalo (2026-09-15): «que la columna de aulas aplicadas esté a su
# derecha y también la de aulas planificadas para que podamos ver si se están
# aplicando el número que se tenía previsto o más incluso, partiendo del hecho
# que se han pedido refuerzos. Hasta estoy pensando en una columna que sea la
# suma de las aplicadas con las agendadas».

# **El eje de aplicación es `application_status`, no el operativo.** El
# operativo (`planificada`/`agendada`/`reemplazada`) es el circuito y el libro
# no lo mueve a «aplicada» nunca: el 2026-09-07 la tabla salió publicada con
# «Aulas aplicadas: 0» en las quince facultades mientras ocho aulas producían
# encuestas. Aquí se separan a propósito para que la fixture no pueda repetir
# esa confusión sin que un test lo diga.
.lafac_unidad <- function(code, fac, rol = "titular", estado = "planificada",
                          fecha = "", aplicacion = "") {
  list(classroom_id = code, operational_code = code, faculty = fac,
       label = code, sample_role = rol, wave = "M1",
       eligible_n = 30, expected_valid = 10,
       sample_status = estado, scheduled_date = fecha,
       application_status = aplicacion,
       operational_status = estado)
}

.lafac_aulas <- function(plan) {
  out <- prosecnurapp:::.calaf_avance_por_facultad(
    plan, efectivas = NULL, cuotas = .lafac_cuotas(.lafac_fac("FAC1", 10)))
  out[1L, c("Aulas aplicadas", "Aulas planificadas", "Aulas proyectadas al cierre")]
}

test_that("planificadas son los TITULARES, no todo lo que hay en el plan", {
  # Una reserva de cadena reemplaza a un titular que cayó: no es un aula de más.
  # Contarla aquí inflaría el plan contra el que se compara lo aplicado, que es
  # justo la comparación que esta columna existe para permitir. Es la misma
  # cuenta que publica «Rendimiento por facultad»: una pregunta, una respuesta.
  v <- .lafac_aulas(list(
    .lafac_unidad("CH 1", "FAC1"),
    .lafac_unidad("CH 2", "FAC1"),
    .lafac_unidad("R 1.1", "FAC1", rol = "chain_reserve")))
  expect_identical(v[["Aulas planificadas"]], 2L)
})

test_that("proyectadas suma las aplicadas y las que ya tienen fecha", {
  v <- .lafac_aulas(list(
    .lafac_unidad("CH 1", "FAC1", estado = "agendada", fecha = "2026-09-14",
                  aplicacion = "aplicada"),
    .lafac_unidad("CH 2", "FAC1", estado = "agendada", fecha = "2026-09-17"),
    .lafac_unidad("CH 3", "FAC1", estado = "planificada")))
  expect_identical(v[["Aulas aplicadas"]], 1L)
  expect_identical(v[["Aulas proyectadas al cierre"]], 2L)
  # La tercera no tiene fecha: no se puede aplicar, así que no se proyecta. Un
  # «3» aquí sería prometer un cierre que nadie ha agendado.
  expect_identical(v[["Aulas planificadas"]], 3L)
})

test_that("un aula aplicada que conserva su fecha NO se cuenta dos veces", {
  # El campo teclea la fecha al agendar y no la borra al aplicar, así que las
  # dos listas se solapan. Sumarlas sin descontar la intersección daría una
  # proyección por encima del plan en cuanto el operativo avanzara —y el
  # número existe justo para compararse con el plan—.
  v <- .lafac_aulas(list(
    .lafac_unidad("CH 1", "FAC1", estado = "agendada", fecha = "2026-09-14",
                  aplicacion = "aplicada"),
    .lafac_unidad("CH 2", "FAC1", estado = "agendada", fecha = "2026-09-14",
                  aplicacion = "aplicada")))
  expect_identical(v[["Aulas aplicadas"]], 2L)
  expect_identical(v[["Aulas proyectadas al cierre"]], 2L)
})

test_that("proyectadas puede pasar de planificadas: eso es un refuerzo agendado", {
  # Es el caso que motivó la columna. Una extra activada y agendada hace que la
  # facultad cierre por encima de su plan, y el número tiene que poder decirlo
  # en vez de toparse en el plan.
  v <- .lafac_aulas(list(
    .lafac_unidad("CH 1", "FAC1", aplicacion = "aplicada"),
    .lafac_unidad("CH 2", "FAC1", aplicacion = "aplicada"),
    .lafac_unidad("E 1", "FAC1", rol = "extra_reserve_pool",
                  estado = "agendada", fecha = "2026-09-18")))
  expect_identical(v[["Aulas planificadas"]], 2L)
  expect_identical(v[["Aulas proyectadas al cierre"]], 3L)
})

test_that("sin fecha ni estado, proyectadas iguala a las aplicadas y no revienta", {
  v <- .lafac_aulas(list(.lafac_unidad("CH 1", "FAC1", estado = "")))
  expect_identical(v[["Aulas aplicadas"]], 0L)
  expect_identical(v[["Aulas proyectadas al cierre"]], 0L)
})
