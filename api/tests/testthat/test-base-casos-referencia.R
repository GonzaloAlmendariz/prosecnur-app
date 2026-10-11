source("setup-load-all.R")

# Contrato base-sin-ponderar F6, §6: ningún proyecto de referencia trae pesos, así que se inyecta un `peso` sintético
# EN MEMORIA sobre acrconta_mazo (multibase real: docentes, estudiantes, egresados, administrativos). La base de
# lámina debe ser casos con peso > 0 por fuente; sin peso, idéntica a la de pesos 1.

.bcr_fuentes <- function() {
  pulso <- system.file("reference_projects", "acrconta_mazo", "acrconta_mazo.pulso", package = "prosecnurapp")
  if (!nzchar(pulso)) pulso <- testthat::test_path("..", "..", "inst", "reference_projects", "acrconta_mazo", "acrconta_mazo.pulso")
  testthat::skip_if_not(file.exists(pulso), "sin el proyecto de referencia acrconta_mazo")
  copia <- withr::local_tempdir(.local_envir = parent.frame())
  file.copy(pulso, file.path(copia, "ref.pulso"))
  ld <- suppressMessages(load_pulso(file.path(copia, "ref.pulso")))
  withr::defer(session_delete(ld$session_id), envir = parent.frame())
  .graficos_processing_sources(ld$session_id)
}

# Primera select_one de la fuente con al menos dos categorías y algún NA (para que la base sea menor que la fuente).
.bcr_var <- function(d, inst) {
  sv <- inst$survey
  cand <- sv$name[grepl("^select_one(\\s|$)", sv$type %||% "") & sv$name %in% names(d)]
  for (v in cand) {
    x <- as.character(d[[v]])
    if (length(unique(stats::na.omit(x))) >= 2L) return(v)
  }
  NA_character_
}

.bcr_bases <- function(ds, is, plan) {
  meta <- reporte_ppt_plan(data = ds, instrumento = is, plan = plan, solo_lista = TRUE,
                           build_render_meta = TRUE, mensajes_progreso = FALSE)$render_meta
  vapply(meta, function(e) e$base %||% NA_character_, character(1))
}

test_that("acrconta_mazo con peso inyectado: la base multibase sale en casos por fuente", {
  src <- .bcr_fuentes()
  ds <- src$data_sources; is <- src$inst_sources
  skip_if(length(ds) < 2L, "acrconta_mazo sin multibase")
  fuente <- names(ds)[1]
  v <- .bcr_var(ds[[fuente]], is[[fuente]])
  skip_if(is.na(v), "sin select_one utilizable")
  plan <- list(diapo_001 = p_slide_1_grafico(grafico = p_barras_multiapiladas(modo = "var", vars = paste0(fuente, "$", v))))

  d <- ds[[fuente]]
  n <- nrow(d)
  sin <- .bcr_bases(ds, is, plan)
  uno <- ds; uno[[fuente]]$peso <- 1
  expect_identical(.bcr_bases(uno, is, plan), sin)          # test 1 sobre datos reales

  pesado <- ds
  w <- rep(c(2.5, 0.4, 1.3), length.out = n); w[seq(1, n, by = 7)] <- 0
  pesado[[fuente]]$peso <- w
  x <- as.character(d[[v]])
  validos <- !is.na(x) & nzchar(x) & x != "NA"
  casos <- sum(validos & w > 0)
  esperado <- sprintf("Base: %s %s", format(casos, big.mark = ","), fuente)
  expect_identical(.bcr_bases(pesado, is, plan), esperado)
  # El mutante «suma de pesos» escribiría otra cifra.
  expect_false(identical(format(round(sum(w[validos]), 2)), format(casos)))
})
