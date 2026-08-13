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

test_that("las tres puertas de la invariante siguen cableadas", {
  # `set` quita, `build_presets` repone. Si alguna se desconecta, la invariante
  # «presencia = decisión» se rompe en silencio y en direcciones opuestas:
  # sin el quitar, el `.pulso` vuelve a congelar defaults; sin el reponer,
  # guardar limpio equivale a borrar media configuración —medido, los títulos de
  # bloque de la lámina 66 salieron planos por eso—.
  src <- paste(readLines(file.path("..", "..", "R", "router_graficos.R"), warn = FALSE),
               collapse = "\n")
  bloque <- function(nombre) {
    i <- regexpr(paste0(nombre, " <- function"), src, fixed = TRUE)
    expect_gt(i, 0)
    substr(src, i, i + 1200L)
  }
  expect_true(grepl(".graficos_presets_solo_decisiones", bloque(".graficos_config_set"), fixed = TRUE))
  expect_true(grepl(".graficos_presets_solo_decisiones", bloque(".graficos_config_get"), fixed = TRUE))
  # El reverso va en el EMBUDO, no en el getter: el arnés de render y el job de
  # export leen la sesión directamente sin pasar por `.graficos_config_get()`.
  expect_true(grepl(".graficos_presets_con_defaults", bloque(".build_presets"), fixed = TRUE))
})

test_that("quitar y reponer son inversas sobre un bag completo", {
  completo <- list(base = list(color = "#000000", tamano = 12, partes = c("titulo", "valores")),
                   pie  = list(orden = "manual", umbral = 0))
  ida   <- .graficos_presets_solo_decisiones(completo, DEF)
  vuelta <- .graficos_presets_con_defaults(ida, DEF)
  expect_equal(vuelta$base$color, "#000000")
  expect_equal(vuelta$base$tamano, 12)
  expect_equal(vuelta$pie$orden, "manual")   # su decisión
  expect_equal(vuelta$pie$umbral, 0)         # repuesto del default
  # El control: el bag intermedio SÍ perdió lo que coincidía. Si `ida` no
  # quitara nada, esta ida y vuelta sería trivial y no probaría nada.
  expect_equal(ida$base, list())
})

