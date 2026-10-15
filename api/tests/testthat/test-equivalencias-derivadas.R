source("setup-load-all.R")

# ADR 0105: una fila de la matriz declara un indicador compuesto de varias
# preguntas (`derivada`, regla «alguna»). Fixture sintético de dos mediciones
# (sin datos de cliente): «recurrió a alguna instancia» se forma con dos
# preguntas Sí(1)/No(2) en b2024 (p28_1, p28_2) y con tres en b2025 (r1, r2, r3).

.dv_inst <- function(vars) {
  list(
    survey = data.frame(type = "select_one lst_sn", name = vars, label = vars,
                        list_name = "lst_sn", section = "S", stringsAsFactors = FALSE),
    choices = data.frame(list_name = "lst_sn", name = c("1", "2", "99"),
                         label = c("Sí", "No", "No responde"), stringsAsFactors = FALSE)
  )
}

.dv_datos <- function() list(
  # Casos: 1 sí+no, 2 no+sí, 3 no+no, 4 NA+NA, 5 99+NA (sólo especial),
  # 6 99+no (válida no especial), 7 99+sí.
  b2024 = data.frame(p28_1 = c(1, 2, 2, NA, 99, 99, 99),
                     p28_2 = c(2, 1, 2, NA, NA, 2, 1),
                     sexo = c(1, 2, 1, 2, 1, 2, 1)),
  b2025 = data.frame(r1 = c(2, 2, 1, NA), r2 = c(2, 2, 2, NA), r3 = c(1, 2, 2, NA),
                     sexo = c(1, 1, 2, 2))
)

.dv_setup <- function(env = parent.frame(), datos = .dv_datos()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  s <- session_get(sid)
  s$estudio <- list(
    bases = list(b2024 = list(nombre = "b2024"), b2025 = list(nombre = "b2025")),
    processing_mode = "multibase", topology_declared = "separate", active_base = "b2024"
  )
  s$rp_inst_sources <- list(b2024 = .dv_inst(c("p28_1", "p28_2", "sexo")),
                            b2025 = .dv_inst(c("r1", "r2", "r3", "sexo")))
  s$rp_data_sources <- datos
  .session_env[[sid]] <- s
  sid
}

.dv_derivada <- function() list(
  regla = "alguna",
  por_base = list(b2024 = list(variables = list("p28_1", "p28_2"), codigos = list("1")),
                  b2025 = list(variables = list("r1", "r2", "r3"), codigos = list(1)))
)

.dv_fila <- function(derivada = .dv_derivada()) {
  f <- list(id = "AP-12", seccion = "Atención", etiqueta_estandar = "Recurrió a alguna instancia",
            variables = list())
  f["derivada"] <- list(derivada)
  f
}

.dv_fila_sexo <- function() list(
  id = "S-01", seccion = "Sociodemográficas", etiqueta_estandar = "Sexo",
  variables = list(b2024 = "sexo", b2025 = "sexo"),
  armonizacion = list(
    escala = list(list(codigo = "1", etiqueta = "Mujer"), list(codigo = "2", etiqueta = "Hombre")),
    por_base = list(b2024 = list(comparable = TRUE, mapa = list()),
                    b2025 = list(comparable = TRUE, mapa = list())))
)

.dv_guardar <- function(sid, filas = list(.dv_fila(), .dv_fila_sexo())) {
  .equiv_guardar_declaracion(sid, filas)
  (session_get(sid)$equivalencias_publicos)$filas
}

test_that("el valor por caso es 1, 0 o NA según la regla «alguna»", {
  d <- .dv_datos()$b2024
  v <- .equiv_deriv_valor(d, c("p28_1", "p28_2"), "1")
  # 1 sí, 2 sí, 3 no, 4 vacías -> NA, 5 sólo especial -> NA, 6 válida -> 0, 7 sí.
  expect_identical(v, c("1", "1", "0", NA, NA, "0", "1"))

  # Códigos como texto normalizado: "1", 1 y 1.0 casan.
  d_chr <- data.frame(a = c("1", "2", " 1 "), b = c(NA, "2.0", NA), stringsAsFactors = FALSE)
  expect_identical(.equiv_deriv_valor(d_chr, c("a", "b"), "1"), c("1", "0", "1"))

  # haven_labelled y factor dan lo mismo que el numérico.
  lab <- d
  lab$p28_1 <- haven::labelled(lab$p28_1, c(Sí = 1, No = 2, `No responde` = 99))
  expect_identical(.equiv_deriv_valor(lab, c("p28_1", "p28_2"), "1"), v)
  fac <- d
  fac$p28_2 <- factor(fac$p28_2)
  expect_identical(.equiv_deriv_valor(fac, c("p28_1", "p28_2"), "1"), v)

  # Un especial que se declara como «sí» cuenta como sí.
  expect_identical(.equiv_deriv_valor(d, c("p28_1", "p28_2"), c("1", "99"))[5], "1")
})

test_that("la expresión canónica respeta el orden declarado y se escribe en variables", {
  der <- .equiv_deriv_normalizar(.dv_derivada(), c("b2024", "b2025"), "AP-12")
  expect_identical(der$regla, "alguna")
  expect_identical(der$por_base$b2025$codigos, list("1"))
  expect_identical(.equiv_deriv_expresion(c("p28_2", "p28_1")), "alguna(p28_2,p28_1)")
  vars <- .equiv_deriv_variables(list(), der)
  expect_identical(vars, list(b2024 = "alguna(p28_1,p28_2)", b2025 = "alguna(r1,r2,r3)"))
  # Una lista de un elemento viaja como arreglo.
  json <- as.character(jsonlite::toJSON(der, auto_unbox = TRUE))
  expect_match(json, "\"codigos\":[\"1\"]", fixed = TRUE)
})

test_that("la validación rechaza regla desconocida, base sin variables y códigos inválidos", {
  bases <- c("b2024", "b2025")
  codigo <- function(der) tryCatch(.equiv_deriv_normalizar(der, bases, "X"),
                                   api_error = function(e) e)
  e <- codigo(list(regla = "todas", por_base = .dv_derivada()$por_base))
  expect_identical(e$code, "E_EQUIV_DERIVADA_INVALIDA")
  expect_identical(e$status, 400)
  expect_match(e$details$motivo, "todas")

  e <- codigo(list(regla = "alguna", por_base = list(b2024 = list(variables = list(), codigos = list("1")))))
  expect_identical(e$code, "E_EQUIV_DERIVADA_INVALIDA")
  expect_match(e$details$motivo, "ninguna variable")

  e <- codigo(list(regla = "alguna", por_base = list(b2024 = list(variables = list("a"), codigos = list()))))
  expect_match(e$details$motivo, "códigos")
  e <- codigo(list(por_base = list(b2024 = list(variables = list("a"), codigos = list("1 2")))))
  expect_match(e$details$motivo, "espacios")
  e <- codigo(list(por_base = list(b2099 = list(variables = list("a"), codigos = list("1")))))
  expect_match(e$details$motivo, "b2099")
  e <- codigo(list(por_base = list(b2024 = list(variables = list("a,b"), codigos = list("1")))))
  expect_match(e$details$motivo, "paréntesis")
  e <- codigo(list(regla = "alguna", por_base = list()))
  expect_identical(e$code, "E_EQUIV_DERIVADA_INVALIDA")
  expect_null(.equiv_deriv_normalizar(NULL, bases))

  # Y por la ruta del guardado: el 400 sale del POST.
  sid <- .dv_setup()
  e <- tryCatch(.equiv_guardar_declaracion(sid, list(.dv_fila(list(regla = "suma", por_base = list())))),
                api_error = function(e) e)
  expect_identical(e$code, "E_EQUIV_DERIVADA_INVALIDA")
})

test_that("el campo derivada persiste con su escala por defecto y sobrevive a un editor que no lo conoce", {
  sid <- .dv_setup()
  filas <- .dv_guardar(sid)
  f <- filas[[1]]
  expect_identical(f$variables, list(b2024 = "alguna(p28_1,p28_2)", b2025 = "alguna(r1,r2,r3)"))
  expect_identical(f$derivada$por_base$b2024$variables, list("p28_1", "p28_2"))
  # Escala por defecto 1 «Sí» / 0 «No», mapa identidad, comparable en cada base.
  expect_identical(vapply(f$armonizacion$escala, `[[`, "", "codigo"), c("1", "0"))
  expect_true(f$armonizacion$por_base$b2025$comparable)
  # La expresión no escribe etiquetas en Analítica ni es huérfana de cobertura.
  labels <- session_get(sid)$analitica_config_por_base$b2024$datos$variable_labels
  expect_false("alguna(p28_1,p28_2)" %in% names(labels))
  cob <- .equiv_estado(sid)$cobertura$b2024
  expect_identical(cob$huerfanas, character(0))
  expect_identical(cob$n_calzan, 3L)

  # Un editor que reenvía las filas SIN la clave `derivada` no la borra.
  rev1 <- .equiv_estado(sid)$revision
  sin_clave <- lapply(filas, function(x) { x$derivada <- NULL; x$armonizacion <- NULL; x })
  filas2 <- .dv_guardar(sid, sin_clave)
  expect_identical(filas2[[1]]$derivada, f$derivada)
  expect_identical(.equiv_estado(sid)$revision, rev1)

  # Cambiar los códigos que cuentan como «sí» mueve la huella.
  otra <- .dv_derivada()
  otra$por_base$b2024$codigos <- list("1", "2")
  .dv_guardar(sid, list(.dv_fila(otra), .dv_fila_sexo()))
  expect_false(identical(.equiv_estado(sid)$revision, rev1))

  # Mandar derivada = null la borra, y la fila sin otra variable se va.
  borrada <- filas2[[1]]
  borrada["derivada"] <- list(NULL)
  filas3 <- .dv_guardar(sid, list(borrada, filas2[[2]]))
  expect_length(filas3, 1L)
  expect_identical(filas3[[1]]$etiqueta_estandar, "Sexo")

  # Ida y vuelta por el .pulso: el estado se guarda literal (session_schema).
  .dv_guardar(sid)
  tmp <- withr::local_tempfile(fileext = ".rds")
  saveRDS(session_get(sid)$equivalencias_publicos, tmp)
  expect_identical(readRDS(tmp)$filas[[1]]$derivada, f$derivada)
})

test_that("el preview de una fila compuesta responde con la forma de siempre y cuenta 1, 0 y sin dato", {
  sid <- .dv_setup()
  .dv_guardar(sid)
  p <- .equiv_armon_preview(sid, "AP-12", "b2024")
  expect_identical(p$variable, "alguna(p28_1,p28_2)")
  expect_true(p$comparable)
  expect_identical(vapply(p$codigos, `[[`, "", "codigo"), c("0", "1"))
  expect_identical(vapply(p$codigos, `[[`, 1L, "n"), c(2L, 3L))
  expect_identical(vapply(p$codigos, `[[`, "", "etiqueta"), c("No", "Sí"))
  expect_identical(vapply(p$codigos, function(x) x$armonizado, ""), c("0", "1"))
  expect_identical(vapply(p$escala, `[[`, 1L, "n"), c(3L, 2L))
  expect_identical(p$n_total, 5L)
  expect_identical(p$n_sin_mapa, 0L)
  expect_identical(p$derivada$n_si, 3L)
  expect_identical(p$derivada$n_no, 2L)
  expect_identical(p$derivada$n_sin_dato, 2L)
  expect_identical(p$derivada$variables, list("p28_1", "p28_2"))

  # Componente ausente: 409 que nombra la componente, no la expresión.
  datos <- .dv_datos()
  datos$b2025$r3 <- NULL
  sid2 <- .dv_setup(datos = datos)
  .dv_guardar(sid2)
  e <- tryCatch(.equiv_armon_preview(sid2, "AP-12", "b2025"), api_error = function(e) e)
  expect_identical(e$code, "E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE")
  expect_identical(e$details$variable, "r3")
})

test_that("contrato HTTP: POST con derivada y GET preview", {
  sid <- .dv_setup()
  pr <- plumber::pr() |> plumber::pr_set_serializer(.api_serializer()) |> mount_equivalencias()
  llamar <- function(metodo, ruta, query = "", body = NULL) {
    raw <- if (is.null(body)) raw(0) else charToRaw(enc2utf8(as.character(
      jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
    req <- new.env()
    req$REQUEST_METHOD <- metodo; req$PATH_INFO <- ruta; req$QUERY_STRING <- query
    req$HTTP_X_PULSO_SESSION <- sid; req$HTTP_CONTENT_TYPE <- "application/json"
    entrada <- new.env()
    entrada$rewind <- function() invisible(0L)
    entrada$read <- function(l = -1L) raw
    entrada$read_lines <- function(n = -1L) rawToChar(raw)
    req$rook.input <- entrada
    res <- pr$call(req)
    list(status = res$status, body = jsonlite::fromJSON(res$body, simplifyVector = FALSE))
  }
  local_mocked_bindings(.equiv_disponible = function(sid) TRUE)
  r <- llamar("POST", "/api/carga/equivalencias/declaracion",
              body = list(filas = list(.dv_fila(), .dv_fila_sexo())))
  expect_identical(r$status, 200L)
  f <- r$body$estado$filas[[1]]
  expect_identical(f$variables$b2024, "alguna(p28_1,p28_2)")
  expect_identical(f$derivada$por_base$b2025$codigos, list("1"))

  g <- llamar("GET", "/api/carga/equivalencias/armonizacion/preview", query = "fila=0&base=b2025")
  expect_identical(g$status, 200L)
  expect_identical(g$body$variable, "alguna(r1,r2,r3)")
  expect_identical(g$body$derivada$n_si, 2L)
  expect_identical(g$body$derivada$n_sin_dato, 1L)

  mal <- llamar("POST", "/api/carga/equivalencias/declaracion",
                body = list(filas = list(.dv_fila(list(regla = "conteo", por_base = list())))))
  expect_equal(mal$status, 400)
  expect_identical(mal$body$error$code %||% mal$body$code, "E_EQUIV_DERIVADA_INVALIDA")
})

test_that("el indicador entra a armonizada_apilar como pregunta y como cruce", {
  sid <- .dv_setup()
  filas <- .dv_guardar(sid)
  datos <- .dv_datos()
  periodos <- c("b2024", "b2025")
  prep <- .equiv_derivadas_preparar(datos, filas, periodos)
  expect_identical(prep$datos$b2025[["alguna(r1,r2,r3)"]], c("1", "0", "1", NA))

  # Como pregunta.
  ap <- armonizada_apilar(prep$datos, filas[1], periodos = periodos, insts = session_get(sid)$rp_inst_sources)
  q <- armonizada_modelo_frecuencias(ap)$preguntas[[1]]
  expect_identical(vapply(q$periodos, `[[`, "", "estado"), c(b2024 = "ok", b2025 = "ok"))
  expect_equal(unname(q$periodos$b2024$n), c(3, 2))
  expect_equal(q$periodos$b2024$N, 5)
  expect_equal(unname(q$periodos$b2025$n), c(2, 1))
  expect_identical(q$sin_mapa$b2024$n_sin_mapa, 0L)

  # Como cruce de la pregunta «Sexo».
  apc <- armonizada_apilar(prep$datos, filas[2], cruces = filas[1], periodos = periodos,
                           insts = session_get(sid)$rp_inst_sources)
  m <- armonizada_modelo_cruces(apc)
  x24 <- m$preguntas[[1]]$periodos$b2024$cruces$x1
  # Sí: casos 1, 2, 7 (sexo 1, 2, 1); No: casos 3, 6 (sexo 1, 2).
  expect_equal(unname(x24$N_vec), c(3, 2))
  expect_equal(unname(x24$n_mat["1", ]), c(2, 1))
})

test_that("una componente ausente deja la base n.c. con variable_ausente y nombra la componente", {
  sid <- .dv_setup()
  filas <- .dv_guardar(sid)
  datos <- .dv_datos()
  datos$b2025$r2 <- NULL
  periodos <- c("b2024", "b2025")
  prep <- .equiv_derivadas_preparar(datos, filas, periodos)
  expect_false("alguna(r1,r2,r3)" %in% names(prep$datos$b2025))

  ap <- armonizada_apilar(prep$datos, filas[1], periodos = periodos)
  q <- armonizada_modelo_frecuencias(ap)$preguntas[[1]]
  expect_identical(q$periodos$b2024$estado, "ok")
  nc <- q$periodos$b2025
  expect_identical(nc$estado, "n.c.")
  expect_identical(nc$motivo, "variable_ausente")
  expect_identical(nc$causa, "no_esta_en_la_base")
  expect_identical(nc$variable, "r2")
  av <- Filter(function(a) identical(a$tipo, "variable_ausente"),
               .armz_avisos_ausente(ap, .armz_rotulos(periodos)))
  expect_length(av, 1L)
  expect_match(av[[1]]$mensaje, "«r2»", fixed = TRUE)

  # Una componente excluida en Analítica excluye el indicador en esa base.
  prep2 <- .equiv_derivadas_preparar(.dv_datos(), filas, periodos, excluidas = list(b2024 = "p28_2"))
  ap2 <- armonizada_apilar(prep2$datos, filas[1], periodos = periodos, excluidas = prep2$excluidas)
  nc2 <- armonizada_modelo_frecuencias(ap2)$preguntas[[1]]$periodos$b2024
  expect_identical(nc2$causa, "excluida")
  expect_identical(nc2$variable, "p28_2")

  # Ausente en todas las mediciones y pedida sola: el 409 nombra la componente.
  datos$b2024$p28_1 <- NULL
  prep3 <- .equiv_derivadas_preparar(datos, filas, periodos)
  e <- tryCatch(armonizada_apilar(prep3$datos, filas[1], periodos = periodos), api_error = function(e) e)
  expect_identical(e$code, "E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE")
  expect_identical(e$details$variable, "p28_1")
})

test_that(".armz_preparar materializa el indicador antes de apilar (pregunta y cruce)", {
  sid <- .dv_setup()
  .dv_guardar(sid)
  datos <- .dv_datos()
  datos$b2025$r2 <- NULL
  local_mocked_bindings(
    .armz_periodos_estudio = function(sid, equiv) c("b2024", "b2025"),
    .armz_fuentes = function(sid, periodos, cfg) list(
      datos = datos, insts = session_get(sid)$rp_inst_sources, excluidas = list()),
    .armz_ponderar = function(sid, b, df, cfg) list(data = df, estado = list(pondera = FALSE))
  )
  ap <- .armz_preparar(sid, list(), filas_refs = list("AP-12"), cruces_refs = list("S-01"))
  q <- armonizada_modelo_frecuencias(ap)$preguntas[[1]]
  expect_equal(unname(q$periodos$b2024$n), c(3, 2))
  expect_identical(q$periodos$b2025$motivo, "variable_ausente")
  expect_identical(q$periodos$b2025$variable, "r2")

  ap2 <- .armz_preparar(sid, list(), filas_refs = list("S-01"), cruces_refs = list("AP-12"))
  x24 <- armonizada_modelo_cruces(ap2)$preguntas[[1]]$periodos$b2024$cruces$x1
  expect_equal(unname(x24$N_vec), c(3, 2))
})
