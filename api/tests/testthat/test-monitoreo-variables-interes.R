# La distribución que alimenta el selector de variable de interés.
#
# Los datos de estos tests son los reales de ACRDCONTA: «Ciclo de egreso» llega
# como `2021-1`, `2021-2`, `2022-1`… y por eso el año necesita agruparse.

test_that("la distribucion cuenta categorias y las ordena por frecuencia", {
  d <- .monitoreo_variable_distribucion(c("2021-1", "2021-2", "2021-1", "2022-1"))
  expect_true(d$categorical)
  expect_equal(d$non_empty, 4L)
  expect_equal(d$distinct_count, 3L)
  expect_equal(d$categories[[1]]$value, "2021-1")
  expect_equal(d$categories[[1]]$count, 2L)
})

test_that("los vacios no cuentan como categoria", {
  d <- .monitoreo_variable_distribucion(c("A", "", NA, "  ", "A"))
  expect_equal(d$non_empty, 2L)
  expect_equal(d$distinct_count, 1L)
  expect_equal(d$categories[[1]]$count, 2L)
})

test_that("una columna identificadora no devuelve reparto, pero si su conteo", {
  # 200 valores unicos: contarlos es caro y el resultado no segmenta nada. La
  # interfaz necesita saber POR QUE no hay reparto, de ahi que distinct_count
  # se publique igual.
  d <- .monitoreo_variable_distribucion(paste0("cod", seq_len(200)))
  expect_false(d$categorical)
  expect_equal(d$distinct_count, 200L)
  expect_equal(length(d$categories), 0L)
})

test_that("el recorte del top se declara en vez de aparentar el total", {
  valores <- unlist(lapply(seq_len(50), function(i) rep(paste0("c", i), 50 - i + 1)))
  d <- .monitoreo_variable_distribucion(valores, max_categorias = 60L, top = 40L)
  expect_true(d$categorical)
  expect_equal(length(d$categories), 40L)
  expect_equal(d$otras_categorias, 10L)
  expect_true(d$otras_casos > 0L)
  # Nada se pierde por el camino: lo visible mas lo resumido es el total.
  visibles <- sum(vapply(d$categories, function(x) x$count, integer(1)))
  expect_equal(visibles + d$otras_casos, d$non_empty)
})

test_that("una columna vacia no rompe ni inventa categorias", {
  d <- .monitoreo_variable_distribucion(c("", NA, "   "))
  expect_equal(d$non_empty, 0L)
  expect_equal(d$distinct_count, 0L)
  expect_false(d$categorical)
})

test_that("detecta el patron de ciclo por mayoria, no por unanimidad", {
  # Una errata suelta no puede impedir que se agrupe una hoja de 270 personas.
  expect_true(.monitoreo_variable_parece_ciclo(c("2021-1", "2021-2", "2022-1", "sin dato")))
  expect_false(.monitoreo_variable_parece_ciclo(c("ASOCIADO", "CONTRATADO", "AUXILIAR")))
  expect_false(.monitoreo_variable_parece_ciclo(character(0)))
})

test_that("la normalizacion por anio agrupa los semestres de una misma cohorte", {
  expect_equal(
    .monitoreo_variable_normalizar(c("2021-1", "2021-2", "2022-1"), "anio"),
    c("2021", "2021", "2022")
  )
})

test_that("normalizar no fabrica categorias donde el dato no las tiene", {
  # Sin anio reconocible el valor se devuelve intacto: inventar un grupo seria
  # peor que dejar la categoria como esta.
  expect_equal(.monitoreo_variable_normalizar(c("Sin dato", "ASOCIADO"), "anio"), c("Sin dato", "ASOCIADO"))
  expect_equal(.monitoreo_variable_normalizar(c("2021-1"), "ninguna"), "2021-1")
})

test_that("normalizar y contar reduce las categorias a una por cohorte", {
  crudo <- c("2021-1", "2021-2", "2022-1", "2022-2", "2022-1")
  expect_equal(.monitoreo_variable_distribucion(crudo)$distinct_count, 4L)
  agrupado <- .monitoreo_variable_normalizar(crudo, "anio")
  d <- .monitoreo_variable_distribucion(agrupado)
  expect_equal(d$distinct_count, 2L)
  expect_equal(d$categories[[1]]$value, "2022")
  expect_equal(d$categories[[1]]$count, 3L)
})

# --- Persistencia ------------------------------------------------------------

test_that("la variable de interes sobrevive a la whitelist del modelo operativo", {
  # Sin estar en `.monitoreo_operational_model()` el campo se descarta al
  # guardar y la eleccion del usuario desaparece sin un solo error.
  modelo <- .monitoreo_operational_model(list(
    interest_variables = list(
      list(actor = "Egresados", variable = "Ciclo de egreso", normalization = "anio")
    )
  ))
  expect_true("interest_variables" %in% names(modelo))
  expect_equal(length(modelo$interest_variables), 1L)
  expect_equal(modelo$interest_variables[[1]]$actor, "Egresados")
  expect_equal(modelo$interest_variables[[1]]$variable, "Ciclo de egreso")
  expect_equal(modelo$interest_variables[[1]]$normalization, "anio")
})

test_that("acepta los alias en espanol", {
  out <- .monitoreo_normalize_interest_variables(list(
    list(unidad = "Docentes", columna = "Categoria", normalizacion = "ninguna")
  ))
  expect_equal(out[[1]]$actor, "Docentes")
  expect_equal(out[[1]]$variable, "Categoria")
})

test_that("un actor puede declarar varias variables de interes", {
  # A Egresados le importa el ciclo de egreso y tambien si esta trabajando.
  out <- .monitoreo_normalize_interest_variables(list(
    list(actor = "Egresados", variable = "Ciclo de egreso"),
    list(actor = "Egresados", variable = "Situacion laboral")
  ))
  expect_equal(length(out), 2L)
  expect_equal(vapply(out, function(x) x$variable, character(1)),
               c("Ciclo de egreso", "Situacion laboral"))
})

test_that("no se repite el mismo par actor+variable", {
  out <- .monitoreo_normalize_interest_variables(list(
    list(actor = "Egresados", variable = "Ciclo de egreso"),
    list(actor = "egresados", variable = "ciclo de egreso")
  ))
  expect_equal(length(out), 1L)
})

test_that("descarta entradas incompletas en vez de guardar basura", {
  out <- .monitoreo_normalize_interest_variables(list(
    list(actor = "", variable = "Ciclo"),
    list(actor = "Egresados", variable = ""),
    "no es una lista"
  ))
  expect_equal(length(out), 0L)
})

test_that("una normalizacion desconocida cae a ninguna", {
  out <- .monitoreo_normalize_interest_variables(list(
    list(actor = "Egresados", variable = "Ciclo", normalization = "loquesea")
  ))
  expect_equal(out[[1]]$normalization, "ninguna")
})

test_that("una variable que ya no existe en la base se descarta", {
  # Si la hoja cambia, conservarla dejaria el modelo apuntando a una columna
  # fantasma y el desglose saldria vacio sin explicar por que.
  out <- .monitoreo_normalize_interest_variables(
    list(list(actor = "Egresados", variable = "Columna borrada")),
    cols = c("Ciclo de egreso", "Codigo PUCP")
  )
  expect_equal(length(out), 0L)
})

test_that("sin declaraciones el modelo trae una lista vacia, no NULL", {
  expect_equal(.monitoreo_operational_model(list())$interest_variables, list())
})

# --- Puente con el reporte de control ----------------------------------------

test_that("una variable declarada se convierte en spec de control", {
  specs <- .monitoreo_interest_variables_specs(list(
    list(actor = "Egresados", variable = "Ciclo de egreso", normalization = "anio")
  ))
  expect_equal(length(specs), 1L)
  expect_equal(specs[[1]]$actor, "Egresados")
  expect_equal(specs[[1]]$aliases, "Ciclo de egreso")
  # `anio` reutiliza el agrupado por cohorte que ya tenia la spec fija.
  expect_equal(specs[[1]]$type, "anio")
})

test_that("sin normalizacion la spec es de texto", {
  specs <- .monitoreo_interest_variables_specs(list(
    list(actor = "Docentes", variable = "Categoria", normalization = "ninguna")
  ))
  expect_equal(specs[[1]]$type, "texto")
})

test_that("lo declarado sustituye a las specs fijas del MISMO actor", {
  fijas <- list(
    list(actor = "Egresados", label = "Anio de egreso", type = "anio", aliases = "Ciclo de egreso"),
    list(actor = "Docentes", label = "Categoria docente", type = "texto", aliases = "Categoria")
  )
  declaradas <- .monitoreo_interest_variables_specs(list(
    list(actor = "Egresados", variable = "Situacion laboral")
  ))
  out <- .monitoreo_merge_control_specs(fijas, declaradas)
  actores <- vapply(out, function(s) s$actor, character(1))
  etiquetas <- vapply(out, function(s) s$label, character(1))
  # Egresados aparece una sola vez, con lo declarado.
  expect_equal(sum(actores == "Egresados"), 1L)
  expect_true("Situacion laboral" %in% etiquetas)
  # Y Docentes conserva su spec de fabrica: no declaro nada.
  expect_true("Categoria docente" %in% etiquetas)
})

test_that("una spec sin actor se conserva siempre", {
  # Aplica a todos los actores; no puede caer porque uno declare lo suyo.
  fijas <- list(list(actor = "", label = "Sede", type = "texto", aliases = "Sede"))
  out <- .monitoreo_merge_control_specs(
    fijas,
    .monitoreo_interest_variables_specs(list(list(actor = "Egresados", variable = "Ciclo")))
  )
  expect_true("Sede" %in% vapply(out, function(s) s$label, character(1)))
})

test_that("sin declaraciones las specs fijas quedan intactas", {
  fijas <- list(list(actor = "Egresados", label = "Anio de egreso", type = "anio", aliases = "Ciclo de egreso"))
  expect_equal(.monitoreo_merge_control_specs(fijas, list()), fijas)
})

test_that("varias variables del mismo actor conviven en el reporte", {
  declaradas <- .monitoreo_interest_variables_specs(list(
    list(actor = "Egresados", variable = "Ciclo de egreso", normalization = "anio"),
    list(actor = "Egresados", variable = "Situacion laboral")
  ))
  out <- .monitoreo_merge_control_specs(list(), declaradas)
  expect_equal(length(out), 2L)
})

# --- Conexion con Avance > Detalle -------------------------------------------

test_that("el reporte de avance trae los controles de la variable declarada", {
  # El defecto: la deteccion de controles solo corria al publicar, asi que
  # Avance > Detalle recibia `controls` vacio y mostraba "Sin variables de
  # control detectadas" aunque el estudio tuviera su variable declarada.
  data <- data.frame(
    CodPulso = paste0("E", 1:6),
    Estado = c("Completa", "Completa", "No contesta", "Completa", "Rechazo", "Completa"),
    `Ciclo de egreso` = c("2021-1", "2021-2", "2022-1", "2022-1", "2021-1", "2022-2"),
    .source_actor = rep("Egresados", 6),
    .source_role = rep("universo", 6),
    .source_label = rep("Universo - Egresados", 6),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      units = list(list(id = "egresados", actor = "Egresados", label = "Egresados"))
    ),
    operational_model = list(
      interest_variables = list(
        list(actor = "Egresados", variable = "Ciclo de egreso", normalization = "anio")
      )
    )
  ), data)

  reports <- monitoreo_acreditacion_reportes(data, cfg, report_scope = "advance_summary")
  controls <- .monitoreo_internal_records_to_df(reports$client_report$controls %||% list())
  expect_true(nrow(controls) > 0L)
})

test_that("lo declarado manda sobre las specs de fabrica en el reporte", {
  # El eslabon que faltaba: `.monitoreo_client_report_model()` calculaba los
  # controles con las specs fijas, y como la deteccion posterior respeta lo ya
  # calculado, la declaracion del usuario no llegaba nunca al reporte.
  data <- data.frame(
    CodPulso = paste0("D", 1:8),
    Estado = rep(c("Completa", "No contesta"), 4),
    Categoria = rep(c("ASOCIADO", "CONTRATADO"), 4),
    `Dedicación` = rep(c("TPA", "DTC"), 4),
    .source_actor = rep("Docentes", 8),
    .source_role = rep("universo", 8),
    .source_label = rep("Universo - Docentes", 8),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      units = list(list(id = "docentes", actor = "Docentes", label = "Docentes"))
    ),
    operational_model = list(
      interest_variables = list(list(actor = "Docentes", variable = "Categoria"))
    )
  ), data)

  r <- monitoreo_acreditacion_reportes(data, cfg, report_scope = "advance_summary")
  ctl <- .monitoreo_internal_records_to_df(r$client_report$controls %||% list())
  expect_true(nrow(ctl) > 0L)
  variables <- unique(as.character(ctl$Variable))
  # Manda la declarada; la fija del MISMO actor no compite con ella.
  expect_true("Categoria" %in% variables)
  expect_false("Tipo de dedicacion" %in% variables)
})

test_that("la variable declarada llega a las specs de control del motor", {
  cfg <- list(operational_model = list(interest_variables = list(
    list(actor = "Egresados", variable = "Situacion laboral", normalization = "ninguna")
  )))
  specs <- .monitoreo_report_control_specs(
    data.frame(x = 1),
    list(family = "acreditacion"),
    cfg$operational_model$interest_variables
  )
  etiquetas <- vapply(specs, function(s) s$label, character(1))
  expect_true("Situacion laboral" %in% etiquetas)
  # Y las fijas de otros actores siguen ahi.
  expect_true(any(grepl("dedicaci", etiquetas, ignore.case = TRUE)))
})
