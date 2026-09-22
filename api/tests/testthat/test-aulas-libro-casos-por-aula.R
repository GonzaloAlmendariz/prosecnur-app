# =============================================================================
# La disposición de los casos: el número que hacía mentir al rendimiento
# =============================================================================
#
# El libro publicaba, en el mismo documento: bloque del eje «86 de 400» y
# «Rendimiento por facultad» con «Efectivas obtenidas 114 · Diferencia +24 ·
# Tasa obtenida 79,2 % · +12,7 %», las dos diferencias en VERDE. Las dos cifras
# eran ciertas y medían cosas distintas —una cuenta todos los cuestionarios
# aplicados en un aula, la otra sólo las entrevistas efectivas que caen en una
# celda de la cuota— y ningún rótulo decía sobre qué contaba. Gonzalo: «esto
# sigue mintiendo».
#
# **El vocabulario es el del diseño muestral**, no uno inventado (Gonzalo:
# «cuidado con el uso de jergas para explicar estos términos, es una
# investigación formal»): cuestionarios aplicados, entrevistas efectivas, casos
# fuera del universo, casos no resueltos, tasa de efectividad. La cadena que el
# marco declara es asistencia × respuesta × validez → efectividad.
#
# El fixture reproduce la aritmética del operativo: nueve cuestionarios
# aplicados, cinco entrevistas efectivas, dos casos fuera del universo y dos no
# resueltos.

# Un aula por cada disposición, para que se distingan de verdad: un fixture
# donde todo cae en la misma bolsa no prueba que el reparto separe.
.lacs_plan <- function() list(
  list(classroom_id = "a1", operational_code = "CH 7", label = "a1",
       faculty = "CIENCIAS SOCIALES", program = "ECONOMÍA", level = "7",
       sample_role = "titular", wave = "M1", orden = 1, eligible_n = 35,
       expected_valid = 20, sample_status = "agendada", operational_status = "aplicada"),
  list(classroom_id = "a2", operational_code = "CH 39", label = "a2",
       faculty = "CIENCIAS SOCIALES", program = "ECONOMÍA", level = "8",
       sample_role = "titular", wave = "M1", orden = 2, eligible_n = 15,
       expected_valid = 20, sample_status = "agendada", operational_status = "aplicada")
)

.lacs_dt <- function() list(
  schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
  tasa_esperada = 0.5, tasa_fuente = "tau_disenio", total_cuota = 7,
  facultades = list(
    list(facultad = "7", faculty_key = monitoreo_aulas_eje_key("7"), cuota = 4, tau = 0.5),
    list(facultad = "8", faculty_key = monitoreo_aulas_eje_key("8"), cuota = 3, tau = 0.5)),
  selection_run_id = "run_1", frame_hash = "hash_1")

.lacs_cfg <- function() monitoreo_aulas_normalize_config(list(
  enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
  plan = .lacs_plan(), design_targets = .lacs_dt(), eje_cuota = "nivel",
  source_mapping = list(collector_var = "collectorID", sex_var = "sexo",
                        student_code_var = "codigo",
                        declared_level_var = "a1",
                        declared_level_labels = list(`1` = "6", `2` = "7",
                                                     `3` = "8", `4` = "9",
                                                     `5` = "Otros"))))

# El padrón: 7 y 8 son ciclos del diseño; 5 NO lo es, así que quien resuelve a 5
# es un caso fuera del universo —contestó y no pertenece a la población medida—.
.lacs_padron <- function() list(
  schema = "monitoreo_aulas_padron_v1", vigencia = "2026-09-07",
  filas = c(
    lapply(1:3, function(i) list(codigo = sprintf("2019700%d", i), nivel = 7L,
                                 carrera = "ECONOMÍA", sexo = "F")),
    lapply(1:2, function(i) list(codigo = sprintf("2019800%d", i), nivel = 8L,
                                 carrera = "ECONOMÍA", sexo = "M")),
    lapply(1:2, function(i) list(codigo = sprintf("2019500%d", i), nivel = 5L,
                                 carrera = "ECONOMÍA", sexo = "F"))))

# CH 7: tres entrevistas efectivas. CH 39: dos efectivas, dos casos fuera del
# universo (ciclo 5), uno sin código declarado y uno con código que el padrón no
# verifica —esos dos sí se recuperan preguntando—.
#
# **Y el caso que destapó el reparto mal hecho**: `20195001` es de ciclo 5 —no
# pertenece a la población medida— y contesta DOS veces en CH 39. Es el
# `20231159` del operativo real. Sus dos respuestas son casos fuera del
# universo; llamar «duplicado» a la segunda la metía en la bolsa de lo que se
# arregla revisando datos, cuando ninguna de las dos podría contar jamás.
.lacs_resp <- function() data.frame(
  collectorID = c(rep("a1", 3), rep("a2", 6)),
  codigo = c("20197001", "20197002", "20197003",
             "20198001", "20198002", "20195001", "20195001", "", "20199999"),
  sexo = rep("Femenino", 9),
  # Lo que cada uno DECLARA: los de ciclo 8 dicen 7 y los de 5 se declaran
  # «Otros». Es el desacuerdo que justifica medir por el padrón.
  a1 = c("2", "2", "2", "2", "2", "5", "5", "2", "2"),
  stringsAsFactors = FALSE
)

# El mismo estudio con una persona DEL UNIVERSO que contesta dos veces: es el
# único caso que debe salir como duplicado.
.lacs_resp_dup_elegible <- function() {
  r <- .lacs_resp()
  r$codigo[[5]] <- "20198001"   # repite al de ciclo 8, que sí está en el diseño
  r
}

.lacs_bloque <- function() {
  cfg <- .lacs_cfg()
  monitoreo_aulas_avance_cuota_del_plan(cfg$plan, .lacs_resp(), cfg,
                                        padron = .lacs_padron())
}

test_that("las disposiciones son disjuntas y suman los cuestionarios aplicados", {
  # Es la propiedad que hace utilizable la tabla. Un total que no cuadra con sus
  # partes invita a buscar una pérdida que no existe.
  c0 <- .lacs_bloque()$casos
  expect_true(is.data.frame(c0) && nrow(c0) == 2L)
  partes <- rowSums(c0[, MONITOREO_AULAS_CASOS_BOLSAS, drop = FALSE])
  expect_identical(as.integer(partes), as.integer(c0$aplicados))
  t <- monitoreo_aulas_casos_total(c0)
  expect_identical(t$aplicados, 9L)
  expect_identical(t$efectivas, 5L)
})

test_that("ninguna bolsa es el residual: `sin_clasificar` vale 0 y lo prueba", {
  # **`fuera_universo` era el cajón de lo que el motor no supiera clasificar.**
  # Medido sobre el `.pulso` real: su asignación POSITIVA capturaba CERO de las
  # 114 y los veintitrés que salían ahí llegaban todos por un `is.na()` final.
  # Hoy coincidía con lo correcto; mañana un fallo de atribución habría salido
  # como un salto en esa columna, indistinguible de más gente de otro ciclo.
  c0 <- .lacs_bloque()$casos
  expect_true("sin_clasificar" %in% names(c0))
  expect_identical(monitoreo_aulas_casos_total(c0)$sin_clasificar, 0L)
  # Y con el eje en el AULA tampoco: el contrato es del motor, no de un estudio.
  cfg <- .lacs_cfg(); cfg$eje_cuota <- "facultad"
  por_aula <- monitoreo_aulas_avance_cuota_del_plan(cfg$plan, .lacs_resp(), cfg,
                                                    padron = .lacs_padron())
  if (is.data.frame(por_aula$casos) && nrow(por_aula$casos)) {
    expect_identical(monitoreo_aulas_casos_total(por_aula$casos)$sin_clasificar, 0L)
  }
})

test_that("un duplicado es una persona DEL UNIVERSO que contestó dos veces", {
  # El caso del operativo: `20231159`, ciclo 5, dos respuestas en CH 39. Las dos
  # son casos fuera del universo — es una unidad NO elegible y ninguna de sus
  # respuestas podría contar nunca.
  c0 <- .lacs_bloque()$casos
  ch39 <- c0[c0$codigo == "CH 39", , drop = FALSE]
  expect_identical(as.integer(ch39$duplicados), 0L)
  expect_identical(as.integer(ch39$fuera_universo), 2L)
  # Y cuando la que repite SÍ está en la población medida, entonces sí: su
  # segunda respuesta es un duplicado y la primera sigue siendo efectiva.
  cfg <- .lacs_cfg()
  c1 <- monitoreo_aulas_avance_cuota_del_plan(
    cfg$plan, .lacs_resp_dup_elegible(), cfg, padron = .lacs_padron())$casos
  t1 <- monitoreo_aulas_casos_total(c1)
  expect_identical(t1$duplicados, 1L)
  expect_identical(t1$efectivas, 4L)
  expect_identical(t1$fuera_universo, 2L)
  expect_identical(t1$sin_clasificar, 0L)
  expect_identical(t1$aplicados, 9L)
})

test_that("los casos FUERA DEL UNIVERSO no se mezclan con los NO RESUELTOS", {
  # Los primeros no son pérdida —no pertenecen a la población medida y no entran
  # al denominador de la efectividad—; los segundos se recuperan preguntando.
  # Juntarlos invita a sumar cosas que no se suman.
  c0 <- .lacs_bloque()$casos
  ch39 <- c0[c0$codigo == "CH 39", , drop = FALSE]
  expect_identical(as.integer(ch39$aplicados), 6L)
  expect_identical(as.integer(ch39$efectivas), 2L)
  # Las dos respuestas de la misma persona de ciclo 5: población, no pérdida.
  expect_identical(as.integer(ch39$fuera_universo), 2L)
  expect_identical(as.integer(ch39$sin_codigo), 1L)
  expect_identical(as.integer(ch39$no_verificable), 1L)
  expect_identical(as.integer(ch39$duplicados), 0L)
  # Y el aula limpia no inventa disposiciones.
  ch7 <- c0[c0$codigo == "CH 7", , drop = FALSE]
  expect_identical(as.integer(ch7$aplicados), 3L)
  expect_identical(as.integer(ch7$efectivas), 3L)
  expect_identical(sum(as.integer(ch7[, MONITOREO_AULAS_CASOS_BOLSAS[-1]])), 0L)
})

test_that("la tasa de efectividad es efectivas entre ELEGIBLES, no entre aplicados", {
  # Es el último eslabón de la cadena del diseño. Con los aplicados en el
  # denominador, un aula que recibe gente de otro ciclo saldría rindiendo más
  # cuanto más ruido entra.
  c0 <- .lacs_bloque()$casos
  ch39 <- c0[c0$codigo == "CH 39", , drop = FALSE]
  expect_identical(as.numeric(ch39$elegibles), 15)
  expect_equal(monitoreo_aulas_tasa_efectividad(ch39$efectivas, ch39$elegibles), 2 / 15)
  # Un 0 de 0 no es efectividad nula: es efectividad que todavía no existe.
  expect_true(is.na(monitoreo_aulas_tasa_efectividad(0, 0)))
  expect_true(is.na(monitoreo_aulas_tasa_efectividad(3, NA)))
})

test_that("la tabla abre por el aula de menor efectividad", {
  # Misma convención que la tabla por facultad y la de facultades en riesgo: la
  # que peor va se mira primero. CH 39 rinde 2/15 y CH 7, 3/35... CH 7 es menor.
  c0 <- .lacs_bloque()$casos
  tasas <- monitoreo_aulas_tasa_efectividad(c0$efectivas, c0$elegibles)
  expect_false(is.unsorted(tasas[is.finite(tasas)]))
})

test_that("un cuestionario huérfano no se atribuye a ningún aula", {
  # No se sabe de qué aula vino: meterlo en una inventaría su procedencia.
  cfg <- .lacs_cfg()
  resp <- rbind(.lacs_resp(),
                data.frame(collectorID = "ZZZ", codigo = "20197001", sexo = "Femenino",
                           a1 = "2", stringsAsFactors = FALSE))
  c0 <- monitoreo_aulas_avance_cuota_del_plan(cfg$plan, resp, cfg,
                                              padron = .lacs_padron())$casos
  expect_identical(monitoreo_aulas_casos_total(c0)$aplicados, 9L)
  expect_false("ZZZ" %in% c0$codigo)
})

# --- La consecuencia: el rendimiento deja de mentir --------------------------

.lacs_ind <- function() {
  cfg <- .lacs_cfg()
  resp <- .lacs_resp()
  aulas_libro_indicadores(
    cfg$plan,
    efectivas = monitoreo_aulas_efectivas_por_aula(cfg$plan, resp, cfg),
    responses = resp, validas = rep(TRUE, nrow(resp)),
    cuotas = cfg$design_targets, cfg = cfg, avance_cuota = .lacs_bloque())
}

test_that("las columnas nombran su base con el vocabulario del diseño", {
  r <- .lacs_ind()$rendimiento
  expect_true(all(c("Cuestionarios aplicados", "Entrevistas efectivas",
                    "Casos fuera del universo", "Casos no resueltos",
                    "Casos duplicados") %in% names(r)))
  # El rótulo que contaba una cosa y se leía como otra ya no existe, ni el
  # vocabulario inventado que estuvo a punto de sustituirlo.
  for (jerga in c("Efectivas obtenidas", "Encuestas recogidas", "De ellas cuentan",
                  "No cuentan")) {
    expect_false(jerga %in% names(r), info = jerga)
  }
})

test_that("la diferencia y la tasa van contra las ENTREVISTAS EFECTIVAS", {
  f <- .lacs_ind()$rendimiento[1, , drop = FALSE]
  expect_identical(as.numeric(f[["Cuestionarios aplicados"]]), 9)
  expect_identical(as.numeric(f[["Entrevistas efectivas"]]), 5)
  expect_identical(as.numeric(f[["Casos fuera del universo"]]), 2)
  expect_identical(as.numeric(f[["Casos no resueltos"]]), 2)
  expect_identical(as.numeric(f[["Casos duplicados"]]), 0)
  # **La fila cuadra consigo misma**, que es lo que permite leerla sin ir a
  # buscar otra tabla — y es la señal en producción de que no hay nada sin
  # clasificar, porque esa bolsa no se publica.
  expect_identical(
    as.numeric(f[["Cuestionarios aplicados"]]),
    as.numeric(f[["Entrevistas efectivas"]]) + as.numeric(f[["Casos fuera del universo"]]) +
      as.numeric(f[["Casos no resueltos"]]) + as.numeric(f[["Casos duplicados"]]))
  # **El número que engañaba.** Esperadas 40 contra 5 efectivas: −35. Contra los
  # 9 aplicados habría dicho −31, más favorable y falso; con el operativo real
  # la diferencia salía +24 en verde yendo por debajo.
  expect_identical(as.numeric(f[["Efectivas esperadas"]]), 40)
  expect_identical(as.numeric(f[["Diferencia de efectivas"]]), -35)
  # Y la tasa obtenida sale de las efectivas sobre los elegibles de las aulas
  # aplicadas: 5 de 50.
  expect_equal(as.numeric(f[["Tasa de rendimiento de la facultad obtenida"]]), 5 / 50)
})

test_that("el bloque del eje y el rendimiento ya cuentan lo mismo", {
  # Era la raíz del engaño: dos tablas del mismo documento contando sobre bases
  # distintas sin decirlo.
  ind <- .lacs_ind()
  del_eje <- sum(suppressWarnings(as.numeric(ind$facultades[["Efectivas"]])), na.rm = TRUE)
  expect_identical(as.numeric(ind$rendimiento[1, ][["Entrevistas efectivas"]]), del_eje)
})

# --- Lo que NO puede cambiar: el eje por AULA --------------------------------

test_that("con el eje en el AULA las columnas de disposición no aparecen", {
  # Con `atribucion = "aula"` todo cuestionario de un aula aplicada es una
  # entrevista efectiva de su celda: tres columnas que serían una copia de la de
  # al lado y dos ceros perpetuos no se pintan. Mismo mecanismo que sobremuestra
  # y sexo, sexta puerta.
  d <- prosecnurapp:::.calacd_declaracion(.lacs_dt(), por_aula = TRUE)
  expect_false(d$casos)
  cols <- prosecnurapp:::aulas_avance_columnas_declaradas("rendimiento", d)
  expect_false(any(c("Entrevistas efectivas", "Casos fuera del universo",
                     "Casos no resueltos", "Casos duplicados") %in% cols))
  # Y «Cuestionarios aplicados» sí está: es la columna de siempre, con su base
  # dicha en el rótulo.
  expect_true("Cuestionarios aplicados" %in% cols)
  # Con el eje por persona, las tres aparecen.
  con <- prosecnurapp:::aulas_avance_columnas_declaradas(
    "rendimiento", prosecnurapp:::.calacd_declaracion(.lacs_dt(), por_aula = FALSE))
  expect_true(all(c("Entrevistas efectivas", "Casos fuera del universo",
                    "Casos no resueltos", "Casos duplicados") %in% con))
})

# --- «Control de nivel», rehecha ---------------------------------------------

.lacs_filas_hoja <- function(avance_cuota = .lacs_bloque()) {
  aulas_libro_filas_control_nivel(.lacs_resp(), .lacs_padron(), .lacs_cfg(),
                                  avance_cuota = avance_cuota)
}

test_that("la hoja informa la efectividad por aula, no preguntas de motor", {
  filas <- .lacs_filas_hoja()
  primeras <- vapply(filas, function(f) as.character(unlist(f$celdas)[[1]]), character(1))
  expect_identical(primeras[[1]], "CONTROL DE NIVEL")
  expect_true("EFECTIVIDAD POR AULA" %in% primeras)
  expect_true("ACUERDO CON EL CICLO DECLARADO" %in% primeras)
  expect_true("CH 39" %in% primeras)
  expect_true("TOTAL" %in% primeras)
  # La cabecera lleva la cadena del diseño y separa lo que no se suma.
  cab <- filas[[which(primeras == "EFECTIVIDAD POR AULA")[[1]] + 1L]]
  expect_identical(as.character(unlist(cab$celdas)), prosecnurapp:::.MCND_CAB_EFECTIVIDAD)
})

test_that("la fila de un aula trae su cadena, y el TOTAL cuadra", {
  filas <- .lacs_filas_hoja()
  fila_de <- function(x) {
    i <- which(vapply(filas, function(f) identical(as.character(unlist(f$celdas)[[1]]), x),
                      logical(1)))[[1]]
    # Las celdas viajan tipadas —texto el aula, NÚMERO las cifras— así que se
    # comparan como texto sólo tras normalizarlas.
    vapply(filas[[i]]$celdas, function(v) as.character(v %||% ""), character(1))
  }
  ch39 <- fila_de("CH 39")
  # AULA · ELEGIBLES · APLICADOS · EFECTIVAS · TASA · SIN EFECTIVA · FUERA · …
  expect_identical(ch39[[2]], "15")
  expect_identical(ch39[[3]], "6")
  expect_identical(ch39[[4]], "2")
  expect_identical(as.numeric(ch39[[5]]), round(2 / 15, 4))
  expect_identical(ch39[[6]], "13")     # 15 elegibles − 2 efectivas
  expect_identical(ch39[[7]], "2")      # fuera del universo
  total <- fila_de("TOTAL")
  expect_identical(total[[2]], "50")
  expect_identical(total[[3]], "9")
  expect_identical(total[[4]], "5")
  expect_identical(as.numeric(total[[5]]), 0.1)
})

test_that("«elegibles sin entrevista efectiva» no se desglosa y nunca es negativo", {
  # Se reparte entre inasistencia, no respuesta e invalidez, y con lo que hoy se
  # registra esas tres no son separables: una columna que fingiera distinguirlas
  # inventaría un dato que el operativo no tiene.
  cab <- prosecnurapp:::.MCND_CAB_EFECTIVIDAD
  expect_true("ELEGIBLES SIN ENTREVISTA EFECTIVA" %in% cab)
  for (inventada in c("INASISTENCIA", "NO RESPUESTA", "INVALIDEZ", "TASA DE ASISTENCIA")) {
    expect_false(any(grepl(inventada, cab, fixed = TRUE)), info = inventada)
  }
})

test_that("lo que no servía para actuar se fue, y el vocabulario del motor no se filtra", {
  todo <- paste(unlist(lapply(.lacs_filas_hoja(),
                              function(f) as.character(unlist(f$celdas)))), collapse = " ")
  for (fuera in c("FILA EN LA BASE", "MOTIVO DEL MOTOR", "MATRIZ DE CONSISTENCIA",
                  "DISCREPANCIAS, UNA POR UNA", "RESPUESTAS SIN NIVEL",
                  "NIVEL DEL PADRÓN", "codigo_no_en_padron", "sin_codigo_declarado",
                  "Sin dato por donde empezar")) {
    expect_false(grepl(fuera, todo, fixed = TRUE), info = fuera)
  }
  # Ni la jerga inventada que estuvo a punto de imprimirse.
  for (jerga in c("Dónde se pierde", "DÓNDE SE PIERDE", "aprovechamiento",
                  "captura", "fuga", "rinde")) {
    expect_false(grepl(jerga, todo, fixed = TRUE), info = jerga)
  }
  # Y el código del alumno sigue sin salir: es dato personal y la hoja se
  # comparte. Es lo que hace que la lista una-por-una no pueda volver.
  expect_false(grepl("20197001", todo, fixed = TRUE))
  expect_false(grepl("20199999", todo, fixed = TRUE))
})

test_that("el acuerdo con lo declarado cabe en una fila", {
  filas <- .lacs_filas_hoja()
  i <- which(vapply(filas, function(f) {
    identical(as.character(unlist(f$celdas)[[1]]), "ACUERDO CON EL CICLO DECLARADO")
  }, logical(1)))
  expect_length(i, 1L)
  # Bloque, cabecera y UNA fila de datos: el hallazgo no necesita 55 filas.
  expect_identical(as.character(unlist(filas[[i + 1L]]$celdas)),
                   prosecnurapp:::.MCND_CAB_ACUERDO)
  expect_identical(length(filas), i + 2L)
})

test_that("sin disposición en el bloque la hoja no inventa la tabla, y el acuerdo sigue", {
  # Degradar es publicar menos, no publicar ceros: sin el bloque la primera
  # tabla no se escribe y la segunda —que sólo necesita el cruce— se queda.
  primeras <- vapply(.lacs_filas_hoja(NULL),
                     function(f) as.character(unlist(f$celdas)[[1]]), character(1))
  expect_false("EFECTIVIDAD POR AULA" %in% primeras)
  expect_true("ACUERDO CON EL CICLO DECLARADO" %in% primeras)
})

# =============================================================================
# El FORMATO, que mentía con los valores correctos
# =============================================================================
#
# Gonzalo abrió la hoja publicada el 2026-09-22 y los tres valores estaban bien:
# «Casos fuera del universo 27» pintado «2700,0 %», «Tasa esperada 0,6651»
# pintada «1». Las tablas ganaron columnas y bloques, se movieron de fila, y
# Google conserva el formato de la celda que había debajo: **lo que no se
# reasienta, se hereda.**

test_that("toda columna publicada tiene naturaleza declarada", {
  # Es el guard del defecto: una columna nueva sin declarar se publicaba con el
  # formato del vecino y nadie lo veía. Ahora rompe aquí.
  tablas <- c(names(AULAS_AVANCE_CABECERAS), AULAS_COBERTURA_CLAVE)
  for (t in tablas) {
    cols <- if (identical(t, AULAS_COBERTURA_CLAVE)) {
      AULAS_COBERTURA_CABECERAS
    } else {
      c(AULAS_AVANCE_CABECERAS[[t]],
        if (identical(t, "general")) AULAS_AVANCE_FILAS_GENERAL else character(0))
    }
    for (col in cols) {
      expect_true(nzchar(prosecnurapp:::.calac_naturaleza(col, t)),
                  info = sprintf("«%s» de «%s» no declara su naturaleza", col, t))
    }
  }
  # Y una intrusa NO se formatea a ojo: se declara sin naturaleza.
  expect_identical(prosecnurapp:::.calac_naturaleza("Columna nueva", "rendimiento"), "")
  # La primera columna con la palabra del eje sigue siendo texto.
  expect_identical(prosecnurapp:::.calac_naturaleza("Nivel", "facultad"), "texto")
})

test_that("el formato se REASIENTA en cada columna publicada, venga o no una cifra", {
  rows <- aulas_libro_hoja_avance(.lacs_ind(), fecha = as.Date("2026-09-22"),
                                  eje = monitoreo_aulas_eje(.lacs_cfg()))
  reqs <- prosecnurapp:::.maaf_requests(111L, rows)
  primeras <- vapply(rows, function(r) as.character(r[[1]] %||% ""), character(1))
  i <- which(primeras == "Facultad")[[1]]        # cabecera del rendimiento
  cab <- as.character(unlist(rows[[i]]))
  formato_de <- function(col) {
    j <- which(cab == col)[[1]]
    for (r in reqs) {
      rc <- r$repeatCell
      if (is.null(rc)) next
      nf <- rc$cell$userEnteredFormat$numberFormat
      if (is.null(nf)) next
      if (rc$range$startColumnIndex != j - 1L) next
      if (rc$range$startRowIndex + 1L > i + 1L || rc$range$endRowIndex < i + 1L) next
      return(nf$type)
    }
    ""
  }
  # Los conteos en NUMBER, incluidos los que hoy valen cero: la columna sin
  # cifra era justo la que heredaba el formato de la publicación anterior.
  for (col in c("Cuestionarios aplicados", "Entrevistas efectivas",
                "Casos fuera del universo", "Casos no resueltos",
                "Casos duplicados", "Diferencia de efectivas")) {
    expect_identical(formato_de(col), "NUMBER", info = col)
  }
  # Y las tasas en PERCENT. Con `#,##0`, 0,6651 sale «1».
  for (col in c("Tasa de rendimiento de la facultad esperada",
                "Tasa de rendimiento de la facultad obtenida",
                "Diferencia de tasa")) {
    expect_identical(formato_de(col), "PERCENT", info = col)
  }
})

test_that("el alto de cada fila se reasienta: la nota que se fue no deja su hueco", {
  # Las filas 17, 27, 30 y 31 de «Avance de campo» salieron a cuatro veces lo
  # normal y VACÍAS: el alto de la nota que ya no está.
  rows <- aulas_libro_hoja_avance(.lacs_ind(), fecha = as.Date("2026-09-22"),
                                  eje = monitoreo_aulas_eje(.lacs_cfg()))
  reqs <- prosecnurapp:::.maaf_requests(111L, rows)
  con_alto <- vapply(Filter(function(r) !is.null(r$updateDimensionProperties), reqs),
                     function(r) r$updateDimensionProperties$range$startIndex + 1L, integer(1))
  # Toda fila que no sea cabecera de tabla pide su alto: las cabeceras lo piden
  # en otra pasada porque bajan de línea, y pisarlas las aplastaría.
  sin_alto <- setdiff(seq_along(rows), con_alto)
  for (i in sin_alto) {
    expect_true(nzchar(prosecnurapp:::.calac_tabla_de_cabecera(
      vapply(rows[[i]], function(x) as.character(x %||% ""), character(1)))),
      info = sprintf("la fila %d no reasienta su alto y no es cabecera", i))
  }
})

# =============================================================================
# «Avance diario» contaba cuestionarios y los llamaba efectivas
# =============================================================================

test_that("el avance diario cuenta ENTREVISTAS EFECTIVAS, como el rendimiento", {
  # Publicaba «Efectivas del día 127 · Diferencia +21» en VERDE cuando eran 94 y
  # la diferencia −12, contradiciendo a «Rendimiento» dos tablas más arriba en
  # la misma hoja. Peor que antes de tocar nada: antes al menos mentían igual.
  cfg <- .lacs_cfg()
  resp <- .lacs_resp()
  resp$`_submission_time` <- rep("2026-09-22T09:00:00", nrow(resp))
  ind <- aulas_libro_indicadores(
    cfg$plan,
    efectivas = monitoreo_aulas_efectivas_por_aula(cfg$plan, resp, cfg),
    responses = resp, validas = rep(TRUE, nrow(resp)),
    cuotas = cfg$design_targets, cfg = cfg,
    avance_cuota = monitoreo_aulas_avance_cuota_del_plan(
      cfg$plan, resp, cfg, padron = .lacs_padron()))
  del_dia <- sum(suppressWarnings(as.numeric(ind$diario[["Efectivas del día"]])), na.rm = TRUE)
  expect_identical(del_dia, 5)
  # **Las dos tablas de la misma hoja dicen lo mismo**, que es la propiedad que
  # se rompió al arreglar sólo una de ellas.
  expect_identical(del_dia, as.numeric(ind$rendimiento[1, ][["Entrevistas efectivas"]]))
})

test_that("sin máscara de efectivas el avance diario no se mueve", {
  # Un estudio con el eje en el AULA no distingue: toda válida de un aula
  # aplicada es una entrevista efectiva, y la tabla cuenta como siempre.
  cfg <- .lacs_cfg()
  resp <- .lacs_resp()
  resp$`_submission_time` <- rep("2026-09-22T09:00:00", nrow(resp))
  d <- .calad_avance_diario(cfg$plan, responses = resp, validas = rep(TRUE, nrow(resp)),
                            cuotas = cfg$design_targets, cfg = cfg)
  expect_identical(sum(suppressWarnings(as.numeric(d[["Efectivas del día"]])), na.rm = TRUE), 9)
})
