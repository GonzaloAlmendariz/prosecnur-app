# Un solo numerador para el total de cada cuota y su serie diaria (checklist de
# cuotas 1b, 3/11). Antes el total contaba «Completa» de la hoja si la
# plataforma no traía respuestas mientras la serie seguía en Kobo (vacía), y con
# la base inferida de la población el total salía 0 con la serie en Kobo.
# Fixture: los constructores de test-monitoreo-telefonico-rms.R.

for (.num_expr in parse(testthat::test_path("test-monitoreo-telefonico-rms.R"), keep.source = FALSE)) {
  if (is.call(.num_expr) && identical(.num_expr[[1]], as.name("<-"))) eval(.num_expr)
}
rm(.num_expr)

num_total_y_serie <- function(datos, cfg) {
  b <- .monitoreo_report_phone_blocks(datos, cfg$monitoreo_profile, cfg)
  b <- stats::setNames(b, vapply(b, function(x) x$id, ""))
  filas <- function(id) {
    r <- b[[id]]$rows
    if (is.data.frame(r)) return(r)
    if (!length(r)) return(data.frame())
    do.call(rbind, lapply(r, function(x) as.data.frame(x, check.names = FALSE, stringsAsFactors = FALSE)))
  }
  q <- filas("cuotas_variable")
  d <- filas("avance_efectivo_variable_dia")
  q <- q[q$Valor != "Sin dato", , drop = FALSE]
  serie <- vapply(seq_len(nrow(q)), function(i) {
    if (!nrow(d)) return(0L)
    as.integer(sum(as.integer(d$Efectivas[d$Variable == q$Variable[i] & d$Valor == q$Valor[i]])))
  }, 1L)
  kobo <- if (nrow(d)) sum(as.integer(d$`Efectivas Kobo`)) else 0L
  list(total = as.integer(q$Efectivas), serie = serie, kobo = kobo)
}

test_that("con Kobo, el total de cada cuota y su serie diaria cuentan las mismas efectivas de Kobo", {
  esc <- rms_escenario()
  r <- num_total_y_serie(esc$datos, esc$cfg)
  expect_gt(sum(r$total), 0L)
  expect_identical(r$serie, r$total)
  expect_identical(r$kobo, sum(r$total))
})

test_that("sin respuestas de plataforma, total y serie cuentan «Completa» de la hoja; la columna Kobo queda en 0", {
  esc <- rms_escenario()
  sin_kobo <- esc$datos[esc$datos$.source_role != "respuestas", , drop = FALSE]
  r <- num_total_y_serie(sin_kobo, esc$cfg)
  expect_gt(sum(r$total), 0L)           # antes: total de la hoja…
  expect_identical(r$serie, r$total)    # …con la serie vacía
  expect_identical(r$kobo, 0L)
})

test_that("cada fila de cuota publica de dónde sale su numerador: «kobo» o «hoja» (reparo 1)", {
  esc <- rms_escenario()
  origen <- function(datos) {
    b <- .monitoreo_report_phone_blocks(datos, esc$cfg$monitoreo_profile, esc$cfg)
    q <- Filter(function(x) identical(x$id, "cuotas_variable"), b)[[1]]$rows
    unique(vapply(q, function(r) as.character(r$Origen), ""))
  }
  expect_identical(origen(esc$datos), "kobo")
  expect_identical(origen(esc$datos[esc$datos$.source_role != "respuestas", , drop = FALSE]), "hoja")
})

num_bloques <- function(datos, cfg) {
  b <- .monitoreo_report_phone_blocks(datos, cfg$monitoreo_profile, cfg)
  b <- stats::setNames(b, vapply(b, function(x) x$id, ""))
  lapply(b, function(x) {
    r <- x$rows
    if (is.data.frame(r)) return(r)
    if (!length(r)) return(data.frame())
    do.call(rbind, lapply(r, function(y) as.data.frame(y, check.names = FALSE, stringsAsFactors = FALSE)))
  })
}

test_that("las series diarias del avance usan el mismo numerador: diario = Σ cuotas + completas de Kobo fuera de la base (reparo 3)", {
  esc <- rms_escenario()  # trae 1 respuesta huérfana: su llave no está en la hoja
  b <- num_bloques(esc$datos, esc$cfg)
  cuotas <- b$cuotas_variable[b$cuotas_variable$Valor != "Sin dato", ]
  fuera <- sum(as.integer(b$avance_efectivo_dia$`Efectivas Kobo`)) - sum(as.integer(cuotas$Efectivas))
  expect_identical(fuera, 1L)
  expect_identical(sum(as.integer(b$avance_efectivo_dia$Efectivas)), sum(as.integer(cuotas$Efectivas)) + fuera)
})

test_that("sin respuestas de plataforma, el diario y el diario por actor cuentan lo mismo que las cuotas, no 0 (reparo 3)", {
  esc <- rms_escenario()
  b <- num_bloques(esc$datos[esc$datos$.source_role != "respuestas", , drop = FALSE], esc$cfg)
  cuotas <- b$cuotas_variable[b$cuotas_variable$Valor != "Sin dato", ]
  expect_gt(sum(as.integer(cuotas$Efectivas)), 0L)
  expect_identical(sum(as.integer(b$avance_efectivo_dia$Efectivas)), sum(as.integer(cuotas$Efectivas)))
  por_actor <- tapply(as.integer(b$avance_efectivo_actor_dia$Efectivas), b$avance_efectivo_actor_dia$Actor, sum)
  por_cuota <- tapply(as.integer(cuotas$Efectivas), cuotas$Valor, sum)
  expect_identical(as.integer(por_actor[names(por_cuota)]), as.integer(por_cuota))
})

test_that("el PDF telefónico sin plataforma dibuja la serie de la hoja, no 0 frente a las cuotas (reparo 3)", {
  esc <- rms_escenario()
  sin_kobo <- esc$datos[esc$datos$.source_role != "respuestas", , drop = FALSE]
  b <- num_bloques(sin_kobo, esc$cfg)
  cuotas <- b$cuotas_variable[b$cuotas_variable$Valor != "Sin dato", ]
  hechos <- .mtpdf_report_facts(build_monitoreo_telefonico_report_model(list(data = sin_kobo), esc$cfg, include_targets = TRUE))
  expect_gt(length(hechos$daily_values), 0L)
  expect_identical(as.integer(sum(hechos$daily_values)), sum(as.integer(cuotas$Efectivas)))
})

test_that("el diario publica las completas de Kobo fuera de la base en su propia columna (reparo 3)", {
  esc <- rms_escenario()
  b <- num_bloques(esc$datos, esc$cfg)
  expect_identical(sum(as.integer(b$avance_efectivo_dia$`Fuera de la base`)), 1L)
  expect_identical(sum(as.integer(b$avance_efectivo_actor_dia$`Fuera de la base`)), 1L)
  sin_kobo <- num_bloques(esc$datos[esc$datos$.source_role != "respuestas", , drop = FALSE], esc$cfg)
  expect_identical(sum(as.integer(sin_kobo$avance_efectivo_dia$`Fuera de la base`)), 0L)
})

test_that("con la base hecha de las propias respuestas, cada completa cuenta una vez: ni 0 ni doble (reparo 3)", {
  # Fixture de test-monitoreo-engine.R («cuotas telefonicas desde poblacion del actor»): acreditación sin barrido.
  data <- data.frame(
    response_id = paste0("R", 1:6),
    response_status = c("completed", "partial", "disqualified", "not_responded", "completed", "partial"),
    dim_actor = c("Egresados", "Egresados", "Egresados", "Egresados", "Docentes", "Docentes"),
    Distrito = c("Lima", "Lima", "Callao", "Lima", "Centro", "Centro"),
    telefono_contacto = c("999111111", "999222222", "999333333", "999444444", "999555555", "999666666"),
    dim_canal = c(rep("Telefonico", 4), rep("Correo", 2)),
    .source_role = rep("respuestas", 6),
    .source_id = c(rep("src_egresados_tel", 4), rep("src_docentes_correo", 2)),
    .source_label = c(rep("Egresados telefono asistido", 4), rep("Docentes correo", 2)),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "acreditacion", variant = "multi_actor", units = list(
      list(id = "Egresados", actor = "Egresados", label = "Egresados", phone = list(enabled = TRUE, role = "target")),
      list(id = "Docentes", actor = "Docentes", label = "Docentes", phone = list(enabled = FALSE, role = "none")))),
    operational_model = list(link_collectors = list(list(source_id = "src_egresados_tel", actor = "Egresados",
      channel = "Telefónico", operational_use = "telefono_asistido", roster_required = TRUE))),
    control_vars = c("Distrito"),
    goals = list(list(filters = list(Actor = "Egresados", Distrito = "Lima"), meta = 3L))
  ), data)
  reports <- monitoreo_acreditacion_reportes(data, cfg, report_scope = "phone_summary")
  blocks <- stats::setNames(reports$sheets[[1]]$blocks, vapply(reports$sheets[[1]]$blocks, `[[`, character(1), "id"))
  cuotas <- .monitoreo_internal_records_to_df(blocks$cuotas_variable$rows)
  diario <- .monitoreo_internal_records_to_df(blocks$avance_efectivo_dia$rows)
  cuotas <- cuotas[cuotas$Variable == "Distrito", ]
  expect_identical(sum(as.integer(cuotas$Efectivas)), 1L)       # la única completa telefónica (R1)
  expect_identical(sum(as.integer(diario$Efectivas)), 1L)       # ni 2 (doble) ni la de correo
  expect_identical(sum(as.integer(diario$`Fuera de la base`)), 0L)
  # Esas completas suman por su propio estado: ningún aviso dice que «no se suman».
  expect_length(blocks$avisos_numerador$rows, 0L)
})

test_that("un actor sin Kobo conectado cuenta su hoja en vez de caer a 0; el otro sigue en Kobo (reparo 2)", {
  bar <- rms_barrido()
  sin_kobo <- PERIODOS_RMS[[1]]
  resp <- rms_respuestas(bar, n_huerfanas = 0L)
  resp <- resp[!resp$`intro/Intro01` %in% bar$`Código proGres`[bar$Periodo == sin_kobo], , drop = FALSE]
  esc <- rms_escenario(bar = bar, resp = resp)
  b <- num_bloques(esc$datos, esc$cfg)
  q <- b$cuotas_variable
  fila <- function(actor) q[q$Valor == actor & q$Actor == actor, , drop = FALSE]
  hoja <- sum(bar$Periodo == sin_kobo & bar$Status == "Efectivo")
  expect_gt(hoja, 0L)
  expect_identical(as.integer(fila(sin_kobo)$Efectivas), as.integer(hoja))  # antes: 0
  expect_identical(fila(sin_kobo)$Origen, "hoja")
  expect_identical(unique(q$Origen[q$Valor != sin_kobo & q$Actor != "Total"]), "kobo")
  diario_actor <- b$avance_efectivo_actor_dia
  expect_identical(sum(as.integer(diario_actor$Efectivas[diario_actor$Actor == sin_kobo])), as.integer(hoja))
})

test_that("un actor con sus llaves rotas cuenta su hoja y sus completas de Kobo se declaran sin sumarse: cada entrevista una vez", {
  bar <- rms_barrido()
  p1 <- PERIODOS_RMS[[1]]
  resp <- rms_respuestas(bar, n_huerfanas = 0L)
  de_p1 <- resp$`intro/Intro01` %in% bar$`Código proGres`[bar$Periodo == p1]
  resp$`intro/Intro01`[de_p1] <- sub("CGU-26-9", "CGU-26-8", resp$`intro/Intro01`[de_p1])  # llave válida, ajena a la base
  esc <- rms_escenario(bar = bar, resp = resp)
  b <- num_bloques(esc$datos, esc$cfg)
  reales <- sum(bar$Status == "Efectivo")
  expect_identical(sum(as.integer(b$avance_efectivo_dia$Efectivas)), as.integer(reales))  # la revisión medía 20 con 16
  expect_identical(sum(as.integer(b$avance_efectivo_dia$`Fuera de la base`)), sum(de_p1))
  bloques <- .monitoreo_report_phone_blocks(esc$datos, esc$cfg$monitoreo_profile, esc$cfg)
  nota <- Filter(function(x) identical(x$id, "avance_efectivo_dia"), bloques)[[1]]$note
  expect_match(nota, "no se suman a Efectivas")
  expect_match(nota, p1, fixed = TRUE)
})

test_that("una fila Total que junta un actor con Kobo y otro con la hoja se publica «mixto» (reparo 2)", {
  bar <- rms_barrido()
  sin_kobo <- PERIODOS_RMS[[1]]
  resp <- rms_respuestas(bar, n_huerfanas = 0L)
  resp <- resp[!resp$`intro/Intro01` %in% bar$`Código proGres`[bar$Periodo == sin_kobo], , drop = FALSE]
  esc <- rms_escenario(bar = bar, resp = resp)
  esc$cfg$goals <- c(esc$cfg$goals, list(list(filters = list(Origen = "Muestra"), meta = 40L)))
  q <- .monitoreo_report_phone_quota_df(esc$datos[esc$datos$.source_role == "barrido", , drop = FALSE],
    esc$cfg$monitoreo_profile, esc$cfg,
    effective_mask = rep(TRUE, sum(esc$datos$.source_role == "barrido")),
    kobo_rows = esc$datos$Periodo[esc$datos$.source_role == "barrido"] != sin_kobo)
  total <- q[q$Actor == "Total" & q$Valor == "Muestra", , drop = FALSE]
  expect_identical(nrow(total), 1L)
  expect_identical(total$Origen, "mixto")
})

test_that("dos casos con la misma llave y una sola respuesta: una efectiva, no dos, y el aviso con su conteo (reparo 4)", {
  bar <- rms_barrido()
  resp <- rms_respuestas(bar, n_huerfanas = 0L)
  efectivo <- which(bar$Status == "Efectivo")[[1]]
  copia <- which(bar$Status == "No barrido" & bar$Origen == "Muestra")[[1]]
  bar$`Código proGres`[copia] <- bar$`Código proGres`[efectivo]   # la base repite la llave
  bar$Status[copia] <- "Efectivo"; bar$Fecha[copia] <- bar$Fecha[efectivo]; bar$Intentos[copia] <- "1"
  esc <- rms_escenario(bar = bar, resp = resp)
  b <- num_bloques(esc$datos, esc$cfg)
  expect_identical(sum(as.integer(b$avance_efectivo_dia$Efectivas)), nrow(resp))   # antes: nrow(resp) + 1
  avisos <- b$avisos_numerador
  expect_identical(avisos$Aviso, "Llaves repetidas")
  expect_match(avisos$Detalle, "^2 casos de la base comparten llave \\(1 llave repetida")
  expect_match(avisos$Detalle, gsub("-", "", bar$`Código proGres`[efectivo]), fixed = TRUE)  # la llave como la normaliza el cruce
})

test_that("emparejar uno a uno: prioridad a los casos «Completa» de la hoja y una respuesta con varias llaves cuenta una vez", {
  phone <- list(c("codigo:A", "tel:1"), c("codigo:A"), c("codigo:B"))
  resp <- list(c("codigo:A", "tel:1"), c("codigo:B"))
  expect_identical(.monitoreo_telefonico_emparejar_uno_a_uno(phone, resp, c(TRUE, TRUE)), c(TRUE, FALSE, TRUE))
  expect_identical(.monitoreo_telefonico_emparejar_uno_a_uno(phone, resp, c(TRUE, TRUE), prioridad = c(FALSE, TRUE, FALSE)), c(FALSE, TRUE, TRUE))
  expect_identical(.monitoreo_telefonico_llaves_repetidas(phone)$casos, 2L)
  expect_identical(.monitoreo_telefonico_aviso_llaves_repetidas(list(casos = 0L, llaves = 0L, ejemplos = character(0))), "")
})

test_that("dos pasadas: el código manda sobre el teléfono compartido y sobre la prioridad de la hoja (revisión del reparo 4)", {
  # A y B comparten teléfono; la única respuesta es de B: va a B, no a A.
  expect_identical(.monitoreo_telefonico_emparejar_uno_a_uno(
    list(c("codigo:A", "telefono:9"), c("codigo:B", "telefono:9")), list(c("codigo:B", "telefono:9")), TRUE),
    c(FALSE, TRUE))
  # X (no barrido) e Y («Completa» en la hoja) comparten teléfono; la respuesta trae el código de X: va a X.
  expect_identical(.monitoreo_telefonico_emparejar_uno_a_uno(
    list(c("codigo:X", "telefono:5"), c("codigo:Y", "telefono:5")), list("codigo:X"), TRUE, prioridad = c(FALSE, TRUE)),
    c(TRUE, FALSE))
  # Sin código que cruce, el teléfono todavía empareja.
  expect_identical(.monitoreo_telefonico_emparejar_uno_a_uno(list(c("codigo:Z", "telefono:7")), list("telefono:7"), TRUE), TRUE)
})

test_that("llaves repetidas por código, esté donde esté; un teléfono compartido no es una llave repetida", {
  expect_identical(.monitoreo_telefonico_llaves_repetidas(list("telefono:9", "telefono:9"))$casos, 0L)
  r <- .monitoreo_telefonico_llaves_repetidas(list(c("telefono:1", "codigo:Q"), c("telefono:2", "codigo:Q")))
  expect_identical(r$casos, 2L)
  expect_identical(r$ejemplos, "Q")
})

test_that("las completas sin llave legible se avisan, no se pierden en silencio (revisión del reparo 4)", {
  bar <- rms_barrido()
  resp <- rms_respuestas(bar, n_huerfanas = 0L)
  resp$`intro/Intro01`[1:2] <- ""
  b <- num_bloques(rms_escenario(bar = bar, resp = resp)$datos, rms_escenario(bar = bar, resp = resp)$cfg)
  aviso <- b$avisos_numerador$Detalle[b$avisos_numerador$Aviso == "Completas sin llave"]
  expect_match(aviso, "^2 completas de Kobo sin llave legible")
})

test_that("la fecha de un caso es la de su propia respuesta, no la más reciente de las que comparten llave", {
  bar <- rms_barrido()
  resp <- rms_respuestas(bar, n_huerfanas = 0L)
  efectivo <- which(bar$Status == "Efectivo")[1:2]
  bar$`Código proGres`[efectivo[[2]]] <- bar$`Código proGres`[efectivo[[1]]]
  dos <- resp[resp$`intro/Intro01` == bar$`Código proGres`[efectivo[[1]]], , drop = FALSE]
  dos <- rbind(dos, transform(dos, start = "2026-10-26T10:00:00.000-05:00", end = "2026-10-26T10:30:00.000-05:00",
                              `intro/interviewdate` = "2026-10-26", check.names = FALSE))
  resp <- rbind(resp[resp$`intro/Intro01` != bar$`Código proGres`[efectivo[[1]]], , drop = FALSE], dos)
  b <- num_bloques(rms_escenario(bar = bar, resp = resp)$datos, rms_escenario(bar = bar, resp = resp)$cfg)
  dia <- b$avance_efectivo_dia
  # Dos casos, dos respuestas (24/10 y 26/10): cada día cuenta la suya, no las dos el 26.
  expect_identical(sum(as.integer(dia$Efectivas)), nrow(resp))
  expect_gte(sum(as.integer(dia$Efectivas[grepl("24", dia$Fecha)])), 1L)
})

test_that("un envío duplicado cuenta una vez y se avisa; con la base hecha de respuestas no hay aviso «sin llave» (revisión del reparo 4)", {
  bar <- rms_barrido()
  resp <- rms_respuestas(bar, n_huerfanas = 0L)
  resp <- rbind(resp, resp[1, , drop = FALSE])
  b <- num_bloques(rms_escenario(bar = bar, resp = resp)$datos, rms_escenario(bar = bar, resp = resp)$cfg)
  expect_identical(sum(as.integer(b$avance_efectivo_dia$Efectivas)), nrow(resp) - 1L)
  expect_match(b$avisos_numerador$Detalle[b$avisos_numerador$Aviso == "Respuestas repetidas"], "^1 completa de Kobo repite un caso")
  expect_identical(.monitoreo_telefonico_aviso_respuestas_repetidas(0L), "")
})
