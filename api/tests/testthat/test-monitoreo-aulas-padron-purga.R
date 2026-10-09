# =============================================================================
# Cómo desaparece el padrón, y qué deja
# =============================================================================
#
# El padrón es la única clave del proyecto que guarda códigos de alumno reales:
# revierte el F114 en su alcance. La contrapartida de esa reversión es la purga,
# y la purga sólo vale si además se VIGILA — sin el detector es una intención,
# con él es un gate.
#
# Y hay un detalle que hace que nada de esto sea automático: el anonimizador
# recorre `data.frame`s y el padrón es una lista de listas, así que pasa de largo
# por él. Estas pruebas existen porque ese olvido no fallaría: la copia saldría
# con los códigos dentro y todo verde.

.tpp_padron <- function() list(
  schema = "monitoreo_aulas_padron_v1",
  vigencia = "2026-09-07",
  filas = list(
    list(codigo = "20191234", nivel = 7L, carrera = "ECONOMÍA", sexo = "F"),
    list(codigo = "20205678", nivel = 9L, carrera = "SOCIOLOGÍA", sexo = "M")
  )
)

test_that("purgar deja el corte y se lleva los codigos", {
  st <- list(monitoreo_aulas_padron = .tpp_padron())
  out <- monitoreo_aulas_padron_purgar(st, motivo = "purga manual")
  expect_true(out$purgado)
  # **Con `[[`, no con `$`.** El `$` de R hace partial matching y
  # `$monitoreo_aulas_padron` calza con `monitoreo_aulas_padron_corte`: el
  # padron SI se borra y el `$` devuelve el corte, asi que un consumidor
  # descuidado creeria que sigue ahi. Es el mismo defecto que ya costo
  # `config$plan` pescando `plan_rows`.
  expect_null(out$estado[["monitoreo_aulas_padron"]])
  expect_false("monitoreo_aulas_padron" %in% names(out$estado))

  corte <- out$estado[["monitoreo_aulas_padron_corte"]]
  expect_identical(corte$schema, "monitoreo_aulas_padron_corte_v1")
  expect_identical(corte$motivo, "purga manual")
  # La vigencia del padron que se va: sin ella el corte no dice de que
  # extraccion salian sus cifras.
  expect_identical(corte$vigencia, "2026-09-07")
  expect_identical(corte$poblacion$personas, 2L)
})

test_that("el corte no lleva ni un codigo, ni como clave ni como valor", {
  st <- list(monitoreo_aulas_padron = .tpp_padron())
  corte <- monitoreo_aulas_padron_purgar(st)$estado[["monitoreo_aulas_padron_corte"]]
  plano <- paste(c(unlist(corte, use.names = TRUE), names(unlist(corte))),
                 collapse = " ")
  for (cod in c("20191234", "20205678")) {
    expect_false(grepl(cod, plano, fixed = TRUE))
  }
  # Y si que lleva la cifra: purgar cierra la medicion, no la borra.
  expect_identical(corte$poblacion$por_nivel[["7"]], 1L)
})

test_that("purgar dos veces no pisa el corte con uno vacio", {
  # Idempotencia con memoria. Un corte vacio borraria la unica cifra que
  # quedaba de la medicion, que es peor que no purgar.
  st <- list(monitoreo_aulas_padron = .tpp_padron())
  uno <- monitoreo_aulas_padron_purgar(st, motivo = "purga manual")
  dos <- monitoreo_aulas_padron_purgar(uno$estado, motivo = "purga al exportar")
  expect_false(dos$purgado)
  expect_identical(dos$estado[["monitoreo_aulas_padron_corte"]]$motivo, "purga manual")
  expect_identical(dos$estado[["monitoreo_aulas_padron_corte"]]$poblacion$personas, 2L)
})

test_that("un estado sin padron se devuelve tal cual", {
  out <- monitoreo_aulas_padron_purgar(list(otra_cosa = 1))
  expect_false(out$purgado)
  expect_identical(out$estado[["otra_cosa"]], 1)
  expect_null(out$estado[["monitoreo_aulas_padron_corte"]])
})

test_that("el corte guarda el ultimo diagnostico cuando lo hay", {
  st <- list(monitoreo_aulas_padron = .tpp_padron())
  diag <- list(schema = "monitoreo_aulas_nivel_diagnostico_v1",
               consideradas = 100L, resueltas = 91L, duplicadas = 4L,
               sin_nivel = 5L, tasa = 0.95)
  corte <- monitoreo_aulas_padron_purgar(st, "purga manual", diag)$estado[["monitoreo_aulas_padron_corte"]]
  expect_identical(corte$ultimo_diagnostico$resueltas, 91L)
  # Y puede faltar: se purga un padron que nunca llego a cruzarse, y entonces
  # el corte dice solo cual era la poblacion.
  corte2 <- monitoreo_aulas_padron_purgar(st, "purga manual")$estado[["monitoreo_aulas_padron_corte"]]
  expect_null(corte2$ultimo_diagnostico)
})

test_that("el detector de PII encuentra el padron, y trunca el ejemplo", {
  h <- monitoreo_aulas_padron_hallazgo_pii(list(monitoreo_aulas_padron = .tpp_padron()))
  expect_identical(h$clave, "monitoreo_aulas_padron")
  # Mismo balde que DNI y pasaporte en el clasificador de la app.
  expect_identical(h$tipo, "documento")
  expect_identical(h$personas, 2L)
  # El ejemplo identifica el FORMATO del codigo, no a la persona: el detector
  # existe para avisar de que hay PII, no para mostrarla.
  expect_identical(h$ejemplo, "2019…")
  expect_false(grepl("20191234", h$ejemplo, fixed = TRUE))
})

test_that("el detector no ve nada donde no hay padron", {
  expect_null(monitoreo_aulas_padron_hallazgo_pii(list()))
  expect_null(monitoreo_aulas_padron_hallazgo_pii(
    list(monitoreo_aulas_padron = list(schema = "x", filas = list()))))
  # Un padron ya purgado deja corte, y el corte NO es un hallazgo: es
  # justamente lo que queda cuando la PII se fue.
  purgado <- monitoreo_aulas_padron_purgar(
    list(monitoreo_aulas_padron = .tpp_padron()))$estado
  expect_null(monitoreo_aulas_padron_hallazgo_pii(purgado))
})

test_that("una copia exportada sale sin padron, y el detector la vigila", {
  # La prueba de punta a punta, y la unica que demuestra que la purga es un
  # gate y no una intencion. Dos mitades:
  #   - el detector CAZA un padron en una copia sin purgar (si no, nadie se
  #     enteraria de que salio con codigos dentro);
  #   - anonimizar lo purga y deja su corte.
  skip_if_not_installed("zip")
  d <- file.path(tempdir(), paste0("purga-e2e-", as.integer(runif(1, 1, 1e9))))
  stage <- file.path(d, "stage"); dir.create(stage, recursive = TRUE)
  saveRDS(list(id = "x", created_at = "2026-09-17T00:00:00Z", files = list(),
               monitoreo_aulas_padron = .tpp_padron()),
          file.path(stage, "state.rds"))
  writeLines('{"schema":"pulso/v1"}', file.path(stage, "manifest.json"))
  origen <- file.path(d, "con-padron.pulso")
  zip::zip(origen, c("manifest.json", "state.rds"), root = stage)

  hallazgos <- pulso_detectar_pii(origen)
  expect_identical(nrow(hallazgos), 1L)
  expect_identical(hallazgos$tipo[[1]], "documento")
  expect_identical(as.integer(hallazgos$n[[1]]), 2L)

  destino <- file.path(d, "anonimizado.pulso")
  invisible(pulso_anonimizar_archivo(origen, destino, sal = "sal-de-prueba",
                                     slug = "demo"))
  salida <- file.path(d, "salida"); dir.create(salida, showWarnings = FALSE)
  st <- readRDS(utils::unzip(destino, "state.rds", exdir = salida))

  expect_false("monitoreo_aulas_padron" %in% names(st))
  expect_identical(st[["monitoreo_aulas_padron_corte"]]$motivo, "purga al exportar")
  expect_identical(st[["monitoreo_aulas_padron_corte"]]$poblacion$personas, 2L)

  # Y que ningun codigo sobreviva EN NINGUN rincon del estado. Se recorre el
  # objeto deserializado, no los bytes del archivo: state.rds va comprimido, asi
  # que buscar en el binario daria «no aparece» aunque el codigo estuviera.
  plano <- paste(unlist(st, use.names = TRUE), collapse = " ")
  for (cod in c("20191234", "20205678")) {
    expect_false(grepl(cod, plano, fixed = TRUE))
  }

  expect_identical(nrow(pulso_detectar_pii(destino)), 0L)
})

test_that("el padron esta censado en el esquema de sesion, y como persistible", {
  # El contrato de session_schema.R: clave nueva ⇒ fila nueva en el MISMO
  # commit. Y `persistible` no es un detalle: es la declaracion de que esto
  # sobrevive al guardado, que es exactamente lo que el F114 evitaba.
  esq <- session_schema()
  for (clave in c("monitoreo_aulas_padron", "monitoreo_aulas_padron_corte")) {
    fila <- esq[esq$clave == clave, , drop = FALSE]
    expect_identical(nrow(fila), 1L)
    expect_identical(as.character(fila$categoria[[1]]), "persistible")
  }
})
