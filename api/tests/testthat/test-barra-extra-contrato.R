source("setup-load-all.R")

# Contrato de la «Barra extra» (decisión de Gonzalo, 2026-10-23): UNA sola opción por bloque/tarjeta, `barra_extra`,
# que reemplaza a `top2box` + `mostrar_barra_extra` + `barra_extra_preset` + `columna_bottom2box`.
#   - `false` | vector de "top2box" / "bottom2box" / "conteos" (el orden = el orden de las columnas).
#   - Resolución: bloque > lámina (args / overrides) > preset base.
#   - Las claves viejas sólo se leen en la migración (`.graficos_migrar_barra_extra`, llamada desde `.normalize_plan` y
#     `.graficos_normalize_config`) y se reescriben una vez.
#   - El motor sigue hablando sus args (`mostrar_barra_extra`, `barra_extra_preset`, `columna_bottom2box`): la
#     derivación está en graficos_barra_extra.R (`.barra_extra_a_args`).

.be_plan <- function(args, tipo = "p_slide_1_grafico", titulo = "Gestión") {
  list(slides = list(list(id = "s1", tipo = tipo,
                          payload = list(titulo = titulo, grafico = list(graficador = "p_barras_apiladas", args = args)))))
}
.be_args <- function(plan, i = 1L) plan$slides[[i]]$payload$grafico$args
.be_ov <- function(plan, i = 1L) .be_args(plan, i)$overrides
.be_viejas <- c("top2box", "mostrar_barra_extra", "barra_extra_preset", "columna_bottom2box", "word_mostrar_barra_extra")
.be_sin_viejas <- function(x) {
  encontradas <- character()
  rec <- function(v) {
    if (!is.list(v)) return(invisible())
    encontradas <<- c(encontradas, intersect(names(v), .be_viejas))
    for (e in v) rec(e)
  }
  rec(x)
  encontradas
}

test_that(".barra_extra_a_args deriva cada valor del contrato", {
  expect_identical(.barra_extra_a_args("top2box")[c("mostrar_barra_extra", "barra_extra_preset")],
                   list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box"))
  expect_false(isTRUE(.barra_extra_a_args("top2box")$columna_bottom2box))
  both <- .barra_extra_a_args(c("top2box", "bottom2box"))
  expect_identical(both$barra_extra_preset, "top2box")
  expect_true(both$mostrar_barra_extra)
  expect_true(both$columna_bottom2box)
  bot <- .barra_extra_a_args("bottom2box")
  expect_identical(bot$barra_extra_preset, "bottom2box")
  expect_true(bot$mostrar_barra_extra)
  expect_false(isTRUE(bot$columna_bottom2box))
  con <- .barra_extra_a_args("conteos")
  expect_identical(con$barra_extra_preset, "totales")
  expect_true(con$mostrar_barra_extra)
  off <- .barra_extra_a_args(FALSE)
  expect_false(off$mostrar_barra_extra)
  expect_identical(off$barra_extra_preset, "ninguno")
  expect_identical(.barra_extra_a_args(NULL), list())
  # Forma JSON: lista de textos, como la deja jsonlite con simplifyVector = FALSE.
  expect_identical(.barra_extra_a_args(list("top2box", "bottom2box")), both)
})

test_that("Top y Bottom se combinan; Conteos con un box avisa y se queda con los boxes", {
  expect_silent(.barra_extra_a_args(c("top2box", "bottom2box")))
  expect_message(a <- .barra_extra_a_args(c("conteos", "top2box")), "PULSO-AVISO.*Conteos")
  expect_identical(a$barra_extra_preset, "top2box")
  expect_false(isTRUE(a$columna_bottom2box))
  expect_message(b <- .barra_extra_a_args(c("conteos", "top2box", "bottom2box")), "Conteos")
  expect_true(b$columna_bottom2box)
  # Un valor desconocido se descarta con aviso; no inventa una columna.
  expect_message(d <- .barra_extra_a_args(c("top2box", "top9box")), "top9box")
  expect_identical(d$barra_extra_preset, "top2box")
})

test_that("la precedencia es bloque > lámina > preset base (.merge_args baja la barra extra)", {
  preset <- list(mostrar_barra_extra = TRUE, barra_extra_preset = "totales")
  expect_identical(.merge_args(preset, list(barra_extra = "top2box"))$barra_extra_preset, "top2box")
  expect_identical(.merge_args(preset, list(barra_extra = "top2box"), list(barra_extra = FALSE))$barra_extra_preset, "ninguno")
  expect_false(.merge_args(preset, list(barra_extra = "top2box"), list(barra_extra = FALSE))$mostrar_barra_extra)
  # La clave de contrato no viaja al graficador.
  expect_false("barra_extra" %in% names(.merge_args(preset, list(barra_extra = "conteos"))))
  # Un preset sin barra_extra declarada no cambia (ningún default se mueve).
  expect_identical(.merge_args(preset, list(size_ejes = 7)), c(preset, list(size_ejes = 7)))
  # Y el `barra_extra` declarado manda sobre claves viejas del mismo nivel.
  expect_identical(.merge_args(list(barra_extra = "conteos", mostrar_barra_extra = FALSE, barra_extra_preset = "top2box"))$barra_extra_preset,
                   "totales")
})

test_that("la migración reescribe el Top Two Box encendido y el Bottom que lo acompaña", {
  p <- .graficos_migrar_barra_extra(.be_plan(list(var = "d$p1",
         overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box", top2box_labels = c("De acuerdo", "Totalmente de acuerdo")))))
  expect_identical(unlist(.be_ov(p)$barra_extra), "top2box")
  expect_identical(.be_ov(p)$top2box_labels, c("De acuerdo", "Totalmente de acuerdo"))   # las etiquetas se quedan junto a la barra extra
  expect_length(.be_sin_viejas(p), 0L)

  p2 <- .graficos_migrar_barra_extra(.be_plan(list(var = "d$p1",
          overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box", columna_bottom2box = TRUE))))
  expect_identical(unlist(.be_ov(p2)$barra_extra), c("top2box", "bottom2box"))
  expect_length(.be_sin_viejas(p2), 0L)

  p3 <- .graficos_migrar_barra_extra(.be_plan(list(var = "d$p1", overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "totales"))))
  expect_identical(unlist(.be_ov(p3)$barra_extra), "conteos")
  p4 <- .graficos_migrar_barra_extra(.be_plan(list(var = "d$p1", overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "bottom2box"))))
  expect_identical(unlist(.be_ov(p4)$barra_extra), "bottom2box")
  expect_length(c(.be_sin_viejas(p3), .be_sin_viejas(p4)), 0L)
})

test_that("top2box de una multiapilada pasa a barra_extra y deja sus etiquetas", {
  args <- list(modo = "var", vars = list("d$p1", "d$p2"), top2box = TRUE, top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))
  p <- .graficos_migrar_barra_extra(list(slides = list(list(id = "s", tipo = "p_slide_1_grafico",
         payload = list(grafico = list(graficador = "p_barras_multiapiladas", args = args))))))
  a <- .be_args(p)
  expect_identical(unlist(a$overrides$barra_extra), "top2box")
  expect_identical(a$top2box_labels, c("De acuerdo", "Totalmente de acuerdo"))
  expect_length(.be_sin_viejas(p), 0L)
  # top2box = FALSE suelto no declara nada: el preset (apagado en multiapiladas) sigue decidiendo.
  q <- .graficos_migrar_barra_extra(list(slides = list(list(id = "s", tipo = "p_slide_1_grafico",
         payload = list(grafico = list(graficador = "p_barras_multiapiladas", args = list(modo = "var", vars = list("d$p1"), top2box = FALSE)))))))
  expect_null(.be_args(q)$overrides$barra_extra)
  expect_length(.be_sin_viejas(q), 0L)
})

test_that("Top Two Box declarado pero apagado: queda apagado, conserva sus etiquetas y avisa por lámina", {
  args <- list(modo = "var", vars = list("d$p1"), top2box = TRUE, top2box_labels = c("De acuerdo", "Totalmente de acuerdo"),
               overrides = list(mostrar_barra_extra = FALSE))
  plan <- list(slides = list(list(id = "s", tipo = "p_slide_1_grafico",
                                  payload = list(titulo = "Satisfacción", grafico = list(graficador = "p_barras_multiapiladas", args = args)))))
  p <- .graficos_migrar_barra_extra(plan, avisar = TRUE)
  expect_false(.be_ov(p)$barra_extra)
  expect_identical(.be_args(p)$top2box_labels, c("De acuerdo", "Totalmente de acuerdo"))
  av <- .graficos_avisos_migracion(p)
  expect_length(av, 1L)
  expect_match(av, "lámina 1")
  expect_match(av, "Satisfacción")
  expect_match(av, "Top Two Box")
  expect_match(av, "sigue apagado")
  expect_length(.be_sin_viejas(p), 0L)
  # Sin avisar, el plan no lleva el atributo (el consolidado lo hashea).
  expect_length(.graficos_avisos_migracion(.graficos_migrar_barra_extra(plan, avisar = FALSE)), 0L)
})

test_that("mostrar_barra_extra = FALSE sin Top Two Box declarado: false sin aviso", {
  p <- .graficos_migrar_barra_extra(.be_plan(list(var = "d$p1", overrides = list(mostrar_barra_extra = FALSE, barra_extra_preset = "top2box"))), avisar = TRUE)
  expect_false(.be_ov(p)$barra_extra)
  expect_length(.graficos_avisos_migracion(p), 0L)
  expect_length(.be_sin_viejas(p), 0L)
})

test_that("un bloque multilista conserva su decisión: el FALSE heredado o propio apaga y avisa; el suyo manda", {
  bloques <- list(
    list(modo = "var", vars = list("d$a"), top2box = TRUE),                                         # hereda el FALSE del padre
    list(modo = "var", vars = list("d$b"), overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box")),
    list(modo = "var", vars = list("d$c"))                                                          # nada propio: padre
  )
  args <- list(modo = "multilista", bloques = bloques, top2box_labels = c("De acuerdo", "Totalmente de acuerdo"),
               overrides = list(mostrar_barra_extra = FALSE))
  plan <- list(slides = list(list(id = "s", tipo = "p_slide_1_grafico",
                                  payload = list(titulo = "Mixta", grafico = list(graficador = "p_barras_multiapiladas", args = args)))))
  p <- .graficos_migrar_barra_extra(plan, avisar = TRUE)
  b <- .be_args(p)$bloques
  expect_false(b[[1]]$overrides$barra_extra)                               # top2box + FALSE heredado = apagado, con aviso
  expect_identical(unlist(b[[2]]$overrides$barra_extra), "top2box")        # lo suyo manda sobre el padre
  expect_false(.be_ov(p)$barra_extra)                                      # el padre quedó apagado
  av <- .graficos_avisos_migracion(p)
  expect_length(av, 1L)
  expect_match(av, "bloque 1")
  expect_length(.be_sin_viejas(p), 0L)
})

test_that("word_mostrar_barra_extra pasa a word_barra_extra", {
  p <- .graficos_migrar_barra_extra(.be_plan(list(var = "d$p1", overrides = list(word_mostrar_barra_extra = FALSE))))
  expect_false(.be_ov(p)$word_barra_extra)
  p2 <- .graficos_migrar_barra_extra(.be_plan(list(var = "d$p1", overrides = list(word_mostrar_barra_extra = TRUE))))
  expect_identical(unlist(.be_ov(p2)$word_barra_extra), "top2box")
  expect_length(c(.be_sin_viejas(p), .be_sin_viejas(p2)), 0L)
})

test_that("el recetario columna_bottom2box de los overrides sube a la barra extra del bloque", {
  p <- .graficos_migrar_barra_extra(.be_plan(list(var = "d$p1", overrides = list(barra_extra_preset = "top2box", columna_bottom2box = TRUE))))
  expect_identical(unlist(.be_ov(p)$barra_extra), c("top2box", "bottom2box"))
})

test_that("la migración es idempotente y no toca lo ya migrado ni lo que no declara nada", {
  viejo <- .be_plan(list(var = "d$p1", overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box", columna_bottom2box = TRUE,
                                                          size_ejes = 7)))
  una <- .graficos_migrar_barra_extra(viejo, avisar = FALSE)
  dos <- .graficos_migrar_barra_extra(una, avisar = FALSE)
  expect_identical(una, dos)
  expect_identical(.be_ov(una)$size_ejes, 7)
  limpio <- .be_plan(list(var = "d$p1", overrides = list(size_ejes = 7)))
  expect_identical(.graficos_migrar_barra_extra(limpio, avisar = FALSE), limpio)
  nuevo <- .be_plan(list(var = "d$p1", overrides = list(barra_extra = "conteos")))
  expect_identical(.graficos_migrar_barra_extra(nuevo, avisar = FALSE), nuevo)
  # Una barra_extra nueva gana a las claves viejas que sobrevivan en el mismo nivel.
  mixto <- .graficos_migrar_barra_extra(.be_plan(list(var = "d$p1", overrides = list(barra_extra = "conteos", mostrar_barra_extra = FALSE))))
  expect_identical(unlist(.be_ov(mixto)$barra_extra), "conteos")
  expect_length(.be_sin_viejas(mixto), 0L)
})

test_that("ninguna clave vieja sobrevive a .normalize_plan ni a .graficos_normalize_config", {
  viejo <- .be_plan(list(var = "d$p1", overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box", columna_bottom2box = TRUE,
                                                          word_mostrar_barra_extra = FALSE)))
  expect_length(.be_sin_viejas(.normalize_plan(viejo)), 0L)
  expect_identical(unlist(.be_ov(.normalize_plan(viejo))$barra_extra), c("top2box", "bottom2box"))
  expect_false(.be_ov(.normalize_plan(viejo))$word_barra_extra)
  expect_length(.be_sin_viejas(.normalize_plan(viejo, avisar = TRUE)), 0L)
  cfg <- .graficos_normalize_config(list(plan = viejo))
  expect_length(.be_sin_viejas(cfg$plan), 0L)
  expect_identical(unlist(.be_ov(cfg$plan)$barra_extra), c("top2box", "bottom2box"))
  # Sigue funcionando junto a la migración de población antigua: los avisos de ambas viajan juntos.
  mix <- viejo
  mix$slides[[2]] <- list(id = "s2", tipo = "p_slide_1_grafico",
                          payload = list(titulo = "T", grafico = list(graficador = "p_barras_multiapiladas",
                            args = list(modo = "var", vars = list("d$p1"), top2box = TRUE, overrides = list(mostrar_barra_extra = FALSE)))))
  expect_length(.graficos_avisos_migracion(.normalize_plan(mix, avisar = TRUE)), 1L)
})

test_that("la config guarda y devuelve la barra extra por .graficos_config_set / .graficos_effective_config", {
  sid <- session_create()
  on.exit(try(session_destroy(sid), silent = TRUE), add = TRUE)
  viejo <- .be_plan(list(var = "d$p1", overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box")))
  .graficos_config_set(sid, list(plan = viejo))
  eff <- .graficos_effective_config(sid)
  expect_identical(unlist(.be_ov(eff$plan)$barra_extra), "top2box")
  expect_length(.be_sin_viejas(eff$plan), 0L)
  # Round-trip: lo que se guarda ya migrado vuelve igual.
  .graficos_config_set(sid, list(plan = eff$plan))
  expect_identical(.be_ov(.graficos_effective_config(sid)$plan), .be_ov(eff$plan))
})

test_that("la sesión se reescribe una sola vez al migrar", {
  sid <- session_create()
  on.exit(try(session_destroy(sid), silent = TRUE), add = TRUE)
  .graficos_config_set(sid, list(plan = .be_plan(list(var = "d$p1", overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box")))))
  .graficos_config_migrar_sesion(sid)
  guardada <- session_get(sid)$graficos_config$plan
  expect_length(.be_sin_viejas(guardada), 0L)
  expect_identical(unlist(.be_ov(guardada)$barra_extra), "top2box")
})

test_that("el motor lee la barra extra: top2box, conteos y apagado cambian lo que se dibuja", {
  skip_if_not_installed("ggplot2")
  inst <- list(
    survey = data.frame(name = "p12", type = "select_one likert5", list_name = "likert5", label = "La gestión es adecuada", stringsAsFactors = FALSE),
    choices = data.frame(list_name = "likert5", name = as.character(1:5),
                         label = c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo"),
                         stringsAsFactors = FALSE),
    orders_list = NULL)
  data <- list(docentes = data.frame(p12 = c("1", "2", rep("4", 17), rep("5", 31)), stringsAsFactors = FALSE))
  textos <- function(ov) {
    plan <- list(diapo_001 = p_slide_1_grafico(grafico = p_barras_apiladas(var = "docentes$p12", overrides = ov)))
    res <- reporte_ppt_plan(data = data, instrumento = list(docentes = inst), plan = plan,
                            presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), solo_lista = TRUE, mensajes_progreso = FALSE)
    plots <- Filter(function(p) inherits(p, "ggplot"), res$rendered)
    unlist(lapply(plots, function(p) {
      b <- suppressWarnings(ggplot2::ggplot_build(p))
      unlist(lapply(b$data, function(l) if ("label" %in% names(l)) as.character(l$label)))
    }))
  }
  t2b <- c("De acuerdo", "Totalmente de acuerdo")
  expect_true("Top Two Box" %in% textos(list(barra_extra = list("top2box"), top2box_labels = t2b)))
  expect_false("Top Two Box" %in% textos(list(barra_extra = FALSE, top2box_labels = t2b)))
  # La barra extra de la lámina manda sobre las claves viejas sueltas del mismo nivel.
  expect_false("Top Two Box" %in% textos(list(barra_extra = FALSE, mostrar_barra_extra = TRUE, barra_extra_preset = "top2box", top2box_labels = t2b)))
  expect_false("Top Two Box" %in% textos(list(barra_extra = list("conteos"), top2box_labels = t2b)))
})

test_that("la multiapilada recibe la barra extra como formal y deriva su bandera top2box", {
  el <- p_barras_multiapiladas(modo = "var", vars = list("d$p1"), barra_extra = list("top2box", "bottom2box"),
                               top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))
  expect_true(el$top2box)
  expect_identical(unlist(el$overrides$barra_extra), c("top2box", "bottom2box"))
  expect_identical(.top2box_del_grafico(el)$barra_extra_preset, "top2box")
  # Apagada gana a la bandera vieja de quien arma el elemento a mano.
  off <- p_barras_multiapiladas(modo = "var", vars = list("d$p1"), top2box = TRUE, barra_extra = FALSE)
  expect_false(off$top2box)
  expect_length(.top2box_del_grafico(off), 0L)
  # Conteos no es un box: la bandera top2box queda apagada y el preset base decide el resto.
  expect_false(p_barras_multiapiladas(modo = "var", vars = list("d$p1"), barra_extra = "conteos")$top2box)
  # Sin barra extra y sin bandera nada cambia.
  sin <- p_barras_multiapiladas(modo = "var", vars = list("d$p1"))
  expect_false(sin$top2box)
  expect_null(sin$overrides$barra_extra)
})

test_that("multilista: el bloque decide y hereda la barra extra de su lámina", {
  el <- p_barras_multiapiladas(modo = "multilista", barra_extra = "top2box", bloques = list(
    list(modo = "var", vars = list("d$a")),
    list(modo = "var", vars = list("d$b"), barra_extra = FALSE),
    list(modo = "var", vars = list("d$c"), overrides = list(barra_extra = list("conteos")))))
  hijos <- el$bloques
  expect_true(hijos[[1]]$top2box)
  expect_false(hijos[[2]]$top2box)
  expect_false(hijos[[2]]$overrides$barra_extra)
  expect_false(hijos[[3]]$top2box)
  expect_identical(unlist(hijos[[3]]$overrides$barra_extra), "conteos")
})

test_that("Word: word_barra_extra sustituye la barra extra sólo en el Word y hereda la de la lámina si no está", {
  ov <- list(barra_extra = list("top2box"))
  # Hereda: nada declarado para el Word, los overrides pasan intactos y reservan la columna.
  expect_identical(.word_barra_extra_solo_word(ov), ov)
  heredada <- .word_conservar_barra_extra_pedida(.word_barra_extra_solo_word(ov))
  expect_gt(heredada$canvas_w_extra, 0)
  expect_null(heredada$mostrar_barra_extra)   # con barra_extra declarada la columna sale de ella
  # FALSE apaga sólo el Word.
  off <- .word_barra_extra_solo_word(c(ov, list(word_barra_extra = FALSE)))
  expect_false(off$barra_extra)
  expect_null(off$word_barra_extra)
  expect_null(.word_conservar_barra_extra_pedida(off)$canvas_w_extra)
  # Un vector enciende y fija las columnas del Word.
  on <- .word_barra_extra_solo_word(list(word_barra_extra = list("top2box", "bottom2box")))
  expect_identical(unlist(on$barra_extra), c("top2box", "bottom2box"))
  expect_gt(.word_conservar_barra_extra_pedida(on)$canvas_w_extra, 0)
  # La clave sólo-Word no llega al graficador por el camino de la lámina.
  expect_false("word_barra_extra" %in% names(.merge_args(list(barra_extra = "top2box", word_barra_extra = FALSE))))
})
