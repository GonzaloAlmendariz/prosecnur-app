source("setup-load-all.R")

# Selector por intención (ADR 0135): GET /api/graficos/resumenes/inventario dice, por base, el público, su n, cuántas
# preguntas tiene de cada tipo (escala con el criterio del ADR, opción única, múltiples, numéricas, abiertas) y si hay
# padrón declarado. Fixture sintético de dos bases con instrumentos DISTINTOS, para que una base no caiga en la otra.

.inv_choices <- function() data.frame(
  list_name = c(rep("lk", 6), rep("sx", 2), rep("srv", 3), rep("si", 2)),
  name = c("1", "2", "3", "4", "5", "9", "1", "2", "a", "b", "c", "1", "2"),
  label = c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo", "Sin información",
            "Mujer", "Hombre", "Biblioteca", "Comedor", "Tópico", "Sí", "No"), stringsAsFactors = FALSE)

# Docentes: 4 de escala (batería lk), sexo (única), consentimiento (metadato), servicios (múltiple, dummies `/`),
# edad (numérica), comentario (abierta), nombre (contacto), q1_recod (la misma q1), q9 (en el instrumento, no en la base).
.inv_inst_doc <- function() list(
  survey = data.frame(
    name = c("consent", "q1", "q2", "q3", "q4", "q9", "sexo", "servicios", "edad", "comentario", "nombre", "q1_recod"),
    type = c("select_one si", rep("select_one lk", 5), "select_one sx", "select_multiple srv", "integer", "text", "text",
             "select_one lk"),
    list_name = c("si", rep("lk", 5), "sx", "srv", "", "", "", "lk"),
    label = c("Consentimiento informado", "Reglamentos", "Biblioteca", "Docentes", "Salud", "No aplicada", "Sexo",
              "Servicios que usa", "Edad", "Comentario final", "Nombre del docente", "Reglamentos (recod.)"),
    stringsAsFactors = FALSE),
  choices = .inv_choices(), orders_list = NULL)

# Estudiantes: sólo dos preguntas lk (no forman batería y no se declaran ordinales: no son de escala), sexo, servicios
# con dummies `_código`, nota decimal, el código del alumno (identificador: no es abierta) y un «Otro (especifique)»
# (abierta), como en Arte.
.inv_inst_est <- function() list(
  survey = data.frame(name = c("p1", "p2", "sexo", "servicios", "nota", "p4", "p3_other"),
                      type = c("select_one lk", "select_one lk", "select_one sx", "select_multiple srv", "decimal", "text", "text"),
                      list_name = c("lk", "lk", "sx", "srv", "", "", ""),
                      label = c("Clima", "Trato", "Sexo", "Servicios", "Nota", "¿Cuál es su código PUCP?", "Otro (especifique):"),
                      stringsAsFactors = FALSE),
  choices = .inv_choices(), orders_list = NULL)

.inv_fuentes <- function() {
  lk <- function(n) rep(c("1", "2", "3", "4", "5", "9"), length.out = n)
  doc <- data.frame(consent = "1", q1 = lk(30), q2 = lk(30), q3 = lk(30), q4 = lk(30), sexo = rep(c("1", "2"), 15),
                    `servicios/a` = 1L, `servicios/b` = 0L, edad = 40L, comentario = "ok", nombre = "x", q1_recod = lk(30),
                    check.names = FALSE, stringsAsFactors = FALSE)
  est <- data.frame(p1 = lk(12), p2 = lk(12), sexo = rep(c("1", "2"), 6), servicios_a = 1L, servicios_c = 0L, nota = 14.5, p4 = "20201234", p3_other = "",
                    stringsAsFactors = FALSE)
  list(data_sources = list(docentes = doc, estudiantes = est),
       inst_sources = list(docentes = .inv_inst_doc(), estudiantes = .inv_inst_est()))
}

.inv_estado <- function() list(calc_muestra_estudio = list(componentes = list(
  list(actor = "Docentes", marco = list(marco_validado = 120), meta = list(valor = 60, tipo = "cobertura")))))

test_that("por base: el público, su n y las preguntas por tipo, sin solaparse y sin caer en la otra base", {
  inv <- .graficos_inventario(.inv_estado(), .inv_fuentes())
  expect_true(inv$ok)
  expect_identical(vapply(inv$bases, `[[`, "", "base"), c("docentes", "estudiantes"))
  doc <- inv$bases[[1]]; est <- inv$bases[[2]]
  expect_identical(doc$publico, "docentes"); expect_identical(doc$n, 30L); expect_identical(est$n, 12L)
  # q9 no está en la base; q1_recod es q1; el consentimiento es metadato; el nombre es contacto.
  expect_identical(doc$preguntas, list(escala = 4L, opcion_unica = 1L, multiple = 1L, numerica = 1L, abierta = 1L))
  # Dos lk no son batería: son de opción única, igual que sexo.
  expect_identical(est$preguntas, list(escala = 0L, opcion_unica = 3L, multiple = 1L, numerica = 1L, abierta = 1L))
})

test_that("«escala» es el mismo criterio que la regla de preguntas (ADR 0135): batería o declarada ordinal", {
  src <- .inv_fuentes()
  # Mismo conjunto que `.regla_preguntas_de_base`, salvo la `_recod`, que el inventario no cuenta dos veces.
  regla <- .regla_preguntas_de_base("docentes", character(0), src)
  expect_identical(.graficos_inventario_preguntas("docentes", src)$escala, length(regla[!grepl("_recod$", regla)]))
  # Declarar la lista ordinal en Estudiantes convierte sus dos lk en escala; declararla nominal en Docentes la apaga.
  src$inst_sources$estudiantes$listas_ordinales_declaradas <- "lk"
  src$inst_sources$docentes$listas_nominales <- "lk"
  expect_identical(.graficos_inventario_preguntas("estudiantes", src)[c("escala", "opcion_unica")], list(escala = 2L, opcion_unica = 1L))
  expect_identical(.graficos_inventario_preguntas("docentes", src)[c("escala", "opcion_unica")], list(escala = 0L, opcion_unica = 5L))
})

test_that("el padrón declarado viene de Cálculo de muestra por base; sin él, declarado = FALSE con su motivo", {
  inv <- .graficos_inventario(.inv_estado(), .inv_fuentes())
  expect_identical(inv$bases[[1]]$padron$declarado, TRUE)
  expect_identical(inv$bases[[1]]$padron$valor, 120)
  expect_match(inv$bases[[1]]$padron$origen, "Cálculo de muestra: marco validado (Docentes)", fixed = TRUE)
  expect_false(inv$bases[[2]]$padron$declarado)
  expect_true(is.na(inv$bases[[2]]$padron$valor))
  expect_match(inv$bases[[2]]$padron$motivo, "Sin padrón declarado.", fixed = TRUE)
  sin_sesion <- .graficos_inventario(NULL, .inv_fuentes())
  expect_false(sin_sesion$bases[[1]]$padron$declarado)
})

test_that("una base sin instrumento cuenta cero preguntas sin romper el resto", {
  src <- .inv_fuentes(); src$inst_sources$estudiantes <- NULL
  inv <- .graficos_inventario(NULL, src)
  expect_identical(inv$bases[[2]]$preguntas, list(escala = 0L, opcion_unica = 0L, multiple = 0L, numerica = 0L, abierta = 0L))
  expect_identical(inv$bases[[1]]$preguntas$escala, 4L)
})

test_that("un scope desconocido responde E_GRAFICOS_INVENTARIO_SCOPE (registrado, 400)", {
  e <- tryCatch(.graficos_inventario_scope(list(scope = "todo")), api_error = function(e) e)
  expect_identical(e$code, "E_GRAFICOS_INVENTARIO_SCOPE"); expect_identical(as.integer(e$status), 400L)
  expect_identical(.graficos_inventario_scope(list(scope = "Consolidated")), "consolidated")
  expect_identical(.graficos_inventario_scope(NULL), "")
  expect_true("E_GRAFICOS_INVENTARIO_SCOPE" %in% errores_registrados()$codigo)
})

# ---- Contrato HTTP (sesión compartida, patrón de test-graficos-regla-preguntas.R) -------------------------------

.inv_sesion <- function() {
  src <- .inv_fuentes()
  sid <- session_create()
  # La base activa es la SEGUNDA: si el inventario cayera en la activa (o en la primera) faltaría una base.
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
                                   active_base = "estudiantes", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", src$data_sources)
  session_set(sid, "rp_inst_sources", src$inst_sources)
  session_set(sid, "calc_muestra_estudio", .inv_estado()$calc_muestra_estudio)
  sid
}

.inv_http <- function(sid, query = "") {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_inventario(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  req <- as.environment(list(REQUEST_METHOD = "GET", PATH_INFO = "/api/graficos/resumenes/inventario", QUERY_STRING = query,
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
                             rook.input = list(read = function(...) raw(0), rewind = function() invisible(0),
                                               read_lines = function(...) character())))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("HTTP: el inventario lee todas las bases de la sesión, con conteos y padrón", {
  sid <- .inv_sesion(); on.exit(session_delete(sid), add = TRUE)
  r <- .inv_http(sid)
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$body$ok))
  expect_length(r$body$bases, 2L)
  doc <- r$body$bases[[1]]; est <- r$body$bases[[2]]
  expect_identical(names(doc), c("base", "publico", "n", "preguntas", "padron"))
  expect_identical(doc$base, "docentes"); expect_identical(est$base, "estudiantes")
  expect_identical(names(doc$preguntas), c("escala", "opcion_unica", "multiple", "numerica", "abierta"))
  expect_identical(doc$preguntas$escala, 4L)
  # Las variables virtuales que Gráficos agrega a la fuente (`__district`, `__age_group`…) no son preguntas.
  expect_identical(est$preguntas, list(escala = 0L, opcion_unica = 3L, multiple = 1L, numerica = 1L, abierta = 1L))
  expect_identical(doc$preguntas, list(escala = 4L, opcion_unica = 1L, multiple = 1L, numerica = 1L, abierta = 1L))
  expect_identical(names(doc$padron), c("declarado", "valor", "origen", "motivo"))
  expect_true(isTRUE(doc$padron$declarado)); expect_identical(doc$padron$valor, 120L)
  expect_false(isTRUE(est$padron$declarado)); expect_null(est$padron$valor)   # NA sale como null
})

test_that("HTTP: un scope desconocido es 400 con su código; sin fuentes, el 409 de Gráficos", {
  sid <- .inv_sesion(); on.exit(session_delete(sid), add = TRUE)
  r <- .inv_http(sid, "scope=todo")
  expect_identical(r$status, 400L); expect_identical(r$body$error$code %||% r$body$code, "E_GRAFICOS_INVENTARIO_SCOPE")
  vacia <- session_create(); on.exit(session_delete(vacia), add = TRUE)
  r2 <- .inv_http(vacia)
  expect_identical(r2$status, 409L); expect_identical(r2$body$error$code %||% r2$body$code, "E_NO_VALID_RP_DATA")
})

test_that("el endpoint queda montado en la app", {
  src <- paste(readLines(test_path("..", "..", "R", "plumber_app.R"), warn = FALSE), collapse = "\n")
  expect_match(src, "mount_graficos_inventario(pr)", fixed = TRUE)
})
