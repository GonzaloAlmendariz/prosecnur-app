source("setup-load-all.R")

# ADR 0074 — el proyecto guarda decisiones, no defaults.
#
# Medido sobre «Conta 11-08»: de 253 valores guardados en sus presets, 221 eran
# idénticos al default del día en que se guardó. El motor no podía distinguirlos
# de una decisión, así que esa foto pisaba cualquier default nuevo para siempre.

DEF <- list(
  base = list(color = "#000000", tamano = 12, partes = c("titulo", "valores")),
  pie  = list(orden = "natural", umbral = 0)
)

test_that("lo que coincide con el default no se guarda", {
  bag <- list(
    base = list(color = "#000000", tamano = 12, partes = c("titulo", "valores")),
    pie  = list(orden = "natural", umbral = 0)
  )
  expect_equal(.graficos_presets_solo_decisiones(bag, DEF),
               list(base = list(), pie = list()))
})

test_that("lo que el analista cambió sobrevive", {
  # El control del test de arriba: si la función vaciara siempre, los dos
  # pasarían. Aquí tiene que quedar EXACTAMENTE lo distinto.
  bag <- list(
    base = list(color = "#CA5651", tamano = 12, partes = c("titulo", "valores")),
    pie  = list(orden = "manual", umbral = 0)
  )
  limpio <- .graficos_presets_solo_decisiones(bag, DEF)
  expect_equal(limpio$base, list(color = "#CA5651"))
  expect_equal(limpio$pie, list(orden = "manual"))
})

test_that("un valor sin default declarado se conserva", {
  # De esos no se puede decir que nadie los eligió, así que no se tocan.
  bag <- list(base = list(color = "#000000", inventado = "x"))
  expect_equal(.graficos_presets_solo_decisiones(bag, DEF)$base, list(inventado = "x"))
})

test_that("un preset entero sin default no se toca", {
  bag <- list(desconocido = list(a = 1, b = 2))
  expect_equal(.graficos_presets_solo_decisiones(bag, DEF)$desconocido, list(a = 1, b = 2))
})

test_that("un default nuevo ALCANZA a un proyecto viejo, y sus decisiones aguantan", {
  # La consecuencia del ADR, y la razón de hacerlo: hoy el `.pulso` congela el
  # default y el mazo sale igual para siempre. Con esto, mejorar un default
  # llega a los proyectos existentes.
  guardado <- .graficos_presets_solo_decisiones(
    list(base = list(color = "#000000", tamano = 12, partes = c("titulo", "valores")),
         pie  = list(orden = "manual")),
    DEF
  )
  expect_equal(guardado$base, list())        # nada suyo en base
  expect_equal(guardado$pie, list(orden = "manual"))  # su decisión, intacta

  # Llega una versión con otro default de color.
  DEF2 <- DEF; DEF2$base$color <- "#081F5C"
  efectivo <- function(bag, defaults) {
    out <- defaults
    for (b in names(bag)) for (a in names(bag[[b]])) out[[b]][[a]] <- bag[[b]][[a]]
    out
  }
  e <- efectivo(guardado, DEF2)
  expect_equal(e$base$color, "#081F5C")   # adopta el default nuevo
  expect_equal(e$pie$orden, "manual")     # y conserva lo que sí eligió

  # El control: con el bag SIN limpiar, el proyecto se queda con el color viejo
  # para siempre. Es el bug que este ADR viene a matar.
  sucio <- list(base = list(color = "#000000"), pie = list(orden = "manual"))
  expect_equal(efectivo(sucio, DEF2)$base$color, "#000000")
})

test_that("el recuento dice lo que hay, para poder citar el número", {
  bag <- list(base = list(color = "#000000", tamano = 99), pie = list(orden = "natural"))
  r <- .graficos_presets_recuento(bag, DEF)
  expect_equal(r$total, 3L)
  expect_equal(r$decisiones, 1L)
  expect_equal(r$defaults_congelados, 2L)
})

test_that("el guardado y la lectura de config pasan por el filtro", {
  # Contrato estático: si alguien añade otra puerta de escritura, la invariante
  # «presencia = decisión» deja de sostenerse sin que nada lo diga.
  src <- readLines(file.path("..", "..", "R", "router_graficos.R"), warn = FALSE)
  set_i <- grep(".graficos_config_set <- function", src, fixed = TRUE)
  get_i <- grep(".graficos_config_get <- function", src, fixed = TRUE)
  expect_length(set_i, 1L)
  expect_length(get_i, 1L)
  expect_true(any(grepl(".graficos_presets_solo_decisiones",
                        src[set_i:(set_i + 8L)], fixed = TRUE)))
  expect_true(any(grepl(".graficos_presets_solo_decisiones",
                        src[get_i:(get_i + 12L)], fixed = TRUE)))
})
