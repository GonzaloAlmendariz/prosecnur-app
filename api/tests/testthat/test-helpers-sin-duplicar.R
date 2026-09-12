# EL GUARD de la clase 7: un concepto con DOS implementaciones.
#
# **La regla ya existía y el repo la incumplía sin que nada lo dijera.**
# CLAUDE.md: «Micro-helpers (`%||%`, `*_scalar`, `*_slug`, `*_chr`…): usar los
# compartidos existentes; no redefinir por módulo». Una regla en prosa no falla
# nunca — sólo se lee cuando alguien va a buscarla, y el que escribe un helper
# de cuatro líneas no va a buscarla.
#
# **La medida, para que el tope no sea un número inventado** (2026-09-12): el
# backend define **69** helpers de texto/escalar distintos, y de ésos sólo **4
# cuerpos** tienen más de una copia, sumando **9 copias**. Es decir: la mayoría
# tiene comportamiento propio legítimo —`.caa_txt` trata «-» como ausencia,
# `.bit_texto` trunca a 300— y eso NO es duplicación, es otro concepto con
# nombre parecido. Por eso el guard compara CUERPOS y no nombres.
#
# El guard, que es la medida que manda porque es la que corre, encuentra **4**
# —una pareja más que el barrido manual: `.mach_txt = .monitoreo_scalar`—. Eran
# **5** antes de cerrar la mía (`.mapm_txt` era copia byte a byte de
# `.mams_txt`, los dos lados del mismo gesto de publicar marcas). Las otras
# cuatro viven en analítica, gráficos y monitoreo: se dejan MEDIDAS y no se
# tocan a ciegas, que es área de otra sesión.

TOPE_CUERPOS_DUPLICADOS <- 4L

test_that("no crecen los micro-helpers de texto con cuerpo repetido", {
  dir_r <- testthat::test_path("..", "..", "R")
  skip_if_not(dir.exists(dir_r), "sin fuentes de api/R a mano")

  firma <- function(ruta) {
    lineas <- readLines(ruta, warn = FALSE)
    inicio <- grep("^\\.[a-z]+_(txt|text|chr|scalar)[a-z_]* <- function\\(", lineas)
    out <- list()
    for (i in inicio) {
      prof <- 0L
      cuerpo <- character(0)
      for (j in seq(i, length(lineas))) {
        ln <- lineas[[j]]
        prof <- prof + lengths(regmatches(ln, gregexpr("\\{", ln))) -
          lengths(regmatches(ln, gregexpr("\\}", ln)))
        cuerpo <- c(cuerpo, ln)
        if (prof == 0L && length(cuerpo) > 1L) break
      }
      # Sin la cabecera (el nombre no cuenta), sin comentarios y sin espacios:
      # lo que se compara es QUE HACE, no cómo se llama ni cómo está indentado.
      txt <- paste(cuerpo[-1], collapse = " ")
      txt <- gsub("#.*", "", txt)
      txt <- trimws(gsub("[[:space:]]+", " ", txt))
      out[[length(out) + 1L]] <- list(
        nombre = sub(" <- function.*", "", lineas[[i]]),
        archivo = basename(ruta), cuerpo = txt)
    }
    out
  }

  todos <- unlist(lapply(list.files(dir_r, pattern = "\\.R$", full.names = TRUE), firma),
                  recursive = FALSE)
  # Si el barrido deja de encontrar helpers, el guard se habria vuelto mudo.
  expect_gt(length(todos), 40L)

  cuerpos <- vapply(todos, function(h) h$cuerpo, character(1))
  repes <- names(which(table(cuerpos) > 1L))
  detalle <- vapply(repes, function(c) {
    quienes <- todos[cuerpos == c]
    sprintf("%s", paste(vapply(quienes, function(h) h$nombre, character(1)), collapse = " = "))
  }, character(1))

  expect_lte(
    length(repes), TOPE_CUERPOS_DUPLICADOS,
    label = paste0(
      "Micro-helpers con el MISMO cuerpo en sitios distintos (CLAUDE.md: se ",
      "comparten, no se redefinen por módulo): ",
      paste(detalle, collapse = " · "),
      ". Si vienes de CERRAR uno, baja TOPE_CUERPOS_DUPLICADOS a este número."
    )
  )
})
