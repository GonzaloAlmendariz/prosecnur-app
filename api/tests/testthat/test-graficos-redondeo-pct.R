source("setup-load-all.R")

# El motor no tenía UN método de redondeo de porcentajes: tenía tres, escritos a
# mano dentro de cada familia. Apiladas repartía por resto mayor; agrupadas,
# categóricas y numéricas usaban la regla de la casa; y divergentes, lollipop,
# dumbbell, puntos comparativos y serie temporal llamaban a `round()` de R, que
# redondea AL PAR. La consecuencia la trajo la revisión de ACRD CONTA
# (2026-08-14): 64 celdas del PPT que no cuadraban con el SPSS sin que ningún
# dato estuviera mal.
#
# Ver `docs/qa/checklist-redondeo-decimales-2026-08-14.md`.

# ---------------------------------------------------------------------------
# El método y sus alias
# ---------------------------------------------------------------------------

test_that("el default es estandar y los alias de planes guardados se entienden", {
  expect_equal(.pulso_pct_metodo(NULL), "estandar")
  expect_equal(.pulso_pct_metodo(""), "estandar")
  expect_equal(.pulso_pct_metodo(NA), "estandar")
  expect_equal(.pulso_pct_metodo("estandar"), "estandar")
  expect_equal(.pulso_pct_metodo("reparto"), "reparto")
  # Alias que puede traer un `.pulso` escrito a mano o por una versión previa.
  expect_equal(.pulso_pct_metodo("resto_mayor"), "reparto")
  expect_equal(.pulso_pct_metodo("RESTO-MAYOR"), "reparto")
  expect_equal(.pulso_pct_metodo("hare"), "reparto")
  expect_equal(.pulso_pct_metodo("half_up"), "estandar")
  expect_equal(.pulso_pct_metodo("clasico"), "estandar")
  expect_equal(.pulso_pct_metodo("comercial"), "estandar")
})

test_that("un metodo desconocido cae en estandar y no aborta el render", {
  # Un método inválido no puede volverse un error a mitad de un mazo de 60
  # láminas: se degrada al default declarado.
  expect_equal(.pulso_pct_metodo("lo-que-sea"), "estandar")
  expect_silent(.pulso_pct_unidades(c(1, 1), 0, "lo-que-sea"))
})

# ---------------------------------------------------------------------------
# El caso que disparó todo esto
# ---------------------------------------------------------------------------

test_that("estandar reproduce el SPSS en el caso real de ACRD CONTA", {
  # Egresados, N = 178, q0034_0003. Dos categorías con UN caso cada una
  # (0,56 %): el reparto le daba 1 % a una y 0 % a la otra porque se le
  # acababan los puntos, y el desempate lo decidía el orden de la lista.
  p <- c(1, 10, 72, 94, 1) / 178
  expect_equal(.pulso_pct_unidades(p, 0, "estandar"), c(1L, 6L, 40L, 53L, 1L))
})

test_that("el mismo dato recibe la misma cifra", {
  # La propiedad que el reparto no puede dar: dos categorías con el mismo valor
  # salen rotuladas igual, independientemente de su posición en la lista.
  p <- c(1, 10, 72, 94, 1) / 178
  u <- .pulso_pct_unidades(p, 0, "estandar")
  expect_equal(u[1], u[5])

  # El control: con reparto, ese mismo dato sale distinto. Se afirma aquí para
  # que quede registrado que es una propiedad del método y no una regresión.
  r <- .pulso_pct_unidades(p, 0, "reparto")
  expect_false(r[1] == r[5])
})

# ---------------------------------------------------------------------------
# Lo que garantiza cada método
# ---------------------------------------------------------------------------

test_that("reparto cierra en 100 y estandar no tiene por que", {
  p <- c(1, 10, 72, 94, 1) / 178
  expect_equal(sum(.pulso_pct_unidades(p, 0, "reparto")), 100L)
  expect_equal(sum(.pulso_pct_unidades(p, 0, "estandar")), 101L)
})

test_that("reparto cierra en 100 a cualquier resolucion", {
  p <- c(3, 17, 41, 39) / 100
  for (dec in 0:2) {
    expect_equal(sum(.pulso_pct_unidades(p, dec, "reparto")),
                 as.integer(100 * 10^dec))
  }
})

test_that("las unidades respetan la resolucion pedida", {
  p <- c(1, 10, 72, 94, 1) / 178
  # dec = 1 → unidades de 0,1 %: 0,56 % es 6 unidades y se rotula «0.6%».
  expect_equal(.pulso_pct_unidades(p, 1, "estandar")[1], 6L)
  expect_equal(.pulso_pct_etiquetas(p, 1, "estandar")$labels[1], "0.6%")
  expect_equal(.pulso_pct_etiquetas(p, 0, "estandar")$labels[1], "1%")
})

test_that("entradas degeneradas no revientan", {
  expect_equal(.pulso_pct_unidades(c(0, 0), 0, "estandar"), c(0L, 0L))
  expect_equal(.pulso_pct_unidades(numeric(0), 0, "estandar"), integer(0))
  expect_equal(.pulso_pct_unidades(c(NA, 1), 0, "estandar"), c(0L, 100L))
  # Frecuencias crudas o proporciones dan lo mismo: se normaliza por la suma.
  expect_equal(.pulso_pct_unidades(c(1, 3), 0, "estandar"),
               .pulso_pct_unidades(c(0.25, 0.75), 0, "estandar"))
})

# ---------------------------------------------------------------------------
# El bug del redondeo al par
# ---------------------------------------------------------------------------

test_that("el 0,5 sube siempre, en los dos extremos de la escala", {
  # `round()` de R redondea al par: dejaba 12,5 % en 12 % mientras 87,5 % subía
  # a 88 % en el mismo gráfico. Ese era el tercer método, el que nadie eligió.
  expect_equal(.pulso_round_half_up(12.5), 13)
  expect_equal(.pulso_round_half_up(87.5), 88)
  expect_equal(.pulso_round_half_up(0.5), 1)
  expect_equal(.pulso_round_half_up(2.5), 3)
  # El control explícito contra el comportamiento que se está corrigiendo.
  expect_false(.pulso_round_half_up(12.5) == round(12.5))
})

test_that("ninguna familia de porcentajes rotula con round() crudo", {
  # Gate de no-regresión del ítem 5: si alguien vuelve a escribir
  # `formatC(round(...))` para una etiqueta de %, esto lo caza sin renderizar.
  familias <- c(
    "graficador_barras_divergentes.R", "graficador_lollipop.R",
    "graficador_dumbbell.R", "graficador_puntos_comparativos.R",
    "graficador_serie_temporal.R"
  )
  for (f in familias) {
    ruta <- testthat::test_path("..", "..", "R", f)
    skip_if_not(file.exists(ruta), paste("no existe", f))
    src <- readLines(ruta, warn = FALSE)
    src <- src[!grepl("^\\s*#", src)]
    ofensivas <- grep('formatC\\(round\\(|paste0\\(round\\(|paste0\\(abs\\(round\\(',
                      src, value = TRUE)
    expect_equal(length(ofensivas), 0,
                 info = paste0(f, " rotula con round() crudo: ",
                               paste(trimws(ofensivas), collapse = " | ")))
  }
})

# ---------------------------------------------------------------------------
# Cifra y segmento cuentan lo mismo (ítem 16)
# ---------------------------------------------------------------------------

test_that("lo que se rotula 0 % es exactamente lo que no se dibuja", {
  # La regla: en apiladas un segmento que se rotularía 0 % no se dibuja. Quien
  # decide ambas cosas es la MISMA llamada, así que la pregunta que hace la
  # geometría y la que hace la etiqueta no pueden divergir.
  p <- c(1, 699) / 700   # 0,143 % y 99,857 %
  u <- .pulso_pct_unidades(p, 0, "estandar")
  expect_equal(u[1], 0L)
  expect_equal(.pulso_fmt_pct_unidades(u, 0)[1], "0%")

  # Con un decimal más, ese mismo caso deja de ser cero y sí se dibujaría.
  expect_true(.pulso_pct_unidades(p, 1, "estandar")[1] > 0L)
})

# ---------------------------------------------------------------------------
# La cadena del preset al graficador (ítems 7, 8 y 13)
# ---------------------------------------------------------------------------

# Preset → función que lo consume. `donut` hereda de `pie` y `multi_apiladas`
# comparte motor con `barras_apiladas`.
.PRESET_FUN <- list(
  barras_apiladas     = "graficar_barras_apiladas",
  multi_apiladas      = "graficar_barras_apiladas",
  barras_categoricas  = "graficar_barras_categoricas",
  pie                 = "graficar_pie",
  donut               = "graficar_pie",
  barras_divergentes  = "graficar_barras_divergentes",
  dumbbell            = "graficar_dumbbell",
  lollipop            = "graficar_lollipop",
  serie_temporal      = "graficar_serie_temporal",
  puntos_comparativos = "graficar_puntos_comparativos"
)

.args_preset <- function(preset) {
  a <- .PRESETS_META[[preset]]$args
  if (!is.list(a)) return(character(0))
  vapply(a, function(x) as.character(x$name %||% "")[1], character(1))
}

test_that("todo arg declarado en el preset lo acepta su graficador", {
  # `.keep_formals()` descarta en silencio lo que la función no declara: un arg
  # mal escrito en la metadata se traduce en un control que el analista mueve y
  # que no hace nada. Esto lo caza sin renderizar.
  campos <- c("metodo_redondeo", "decimales", "decimales_pct", "valores_decimales")
  for (preset in names(.PRESET_FUN)) {
    fml <- names(formals(get(.PRESET_FUN[[preset]])))
    declarados <- intersect(.args_preset(preset), campos)
    expect_true(length(declarados) > 0,
                info = paste(preset, "no declara ningun control de decimales"))
    expect_equal(setdiff(declarados, fml), character(0),
                 info = paste0(preset, " declara args que ",
                               .PRESET_FUN[[preset]], " no acepta"))
  }
})

test_that("solo eligen metodo las familias que cierran a 100 %", {
  # Ofrecer el reparto donde no hay un total que cerrar sería un mando que no
  # hace nada: una batería de respuesta múltiple o una serie temporal no tienen
  # resto que repartir.
  cierran <- c("barras_apiladas", "multi_apiladas", "barras_categoricas", "pie", "donut")
  no_cierran <- c("barras_divergentes", "dumbbell", "lollipop", "serie_temporal",
                  "puntos_comparativos", "barras_agrupadas")
  for (p in cierran) {
    expect_true("metodo_redondeo" %in% .args_preset(p), info = p)
  }
  for (p in no_cierran) {
    expect_false("metodo_redondeo" %in% .args_preset(p), info = p)
  }
})

test_that("el reparto no se aplica a porcentajes que no cierran a 100", {
  # Una barra categórica o una torta pueden traer porcentajes independientes
  # —respuesta múltiple, o un subconjunto de opciones—. Normalizarlos convertiría
  # un 12,5 % en 44 % porque la fila suma 0,285. Cuando no cierra, cada cifra se
  # redondea sola, que es lo único que ahí significa algo.
  sueltos <- c(0.125, 0.135, 0.025)
  for (m in c("estandar", "reparto")) {
    expect_equal(.barras_categoricas_etiquetas_pct(sueltos, 0, m),
                 c("13%", "14%", "3%"), info = m)
  }

  # Y cuando sí cierra, el reparto vuelve a tener algo que decidir.
  cierra <- c(1, 10, 72, 94, 1) / 178
  expect_equal(.barras_categoricas_etiquetas_pct(cierra, 0, "estandar"),
               c("1%", "6%", "40%", "53%", "1%"))
  expect_equal(.barras_categoricas_etiquetas_pct(cierra, 0, "reparto"),
               c("1%", "6%", "40%", "53%", "0%"))
})

test_that("el metodo se declara con los dos nombres acordados", {
  arg <- Filter(function(x) identical(x$name, "metodo_redondeo"),
                .PRESETS_META$barras_apiladas$args)[[1]]
  expect_equal(arg$default, "estandar")
  expect_equal(vapply(arg$choices, function(c) c$value, character(1)),
               c("estandar", "reparto"))
  expect_equal(vapply(arg$choices, function(c) c$label, character(1)),
               c("Redondeo estándar", "Reparto a 100 %"))
})

# ---------------------------------------------------------------------------
# El gobierno: la lámina no decide cómo se redondea (ítems 11 y 12)
# ---------------------------------------------------------------------------

test_that("los campos gobernados se retiran del override de la lamina", {
  ov <- list(
    metodo_redondeo = "reparto", decimales = 2, valores_decimales = 1,
    decimales_pct = 2, color_ejes = "#081F5C", size_valores = 3
  )
  out <- .calculos_sanear_overrides(ov)
  expect_equal(sort(names(out)), c("color_ejes", "size_valores"))
  # Lo que no gobierna la configuración general sigue intacto, con su valor.
  expect_equal(out$color_ejes, "#081F5C")
})

test_that("sanear overrides tolera lo que llega vacio o sin nombres", {
  expect_null(.calculos_sanear_overrides(NULL))
  expect_equal(.calculos_sanear_overrides(list()), list())
  sin_nombres <- list(1, 2)
  expect_equal(.calculos_sanear_overrides(sin_nombres), sin_nombres)
})

test_that("la clasificacion que sirve la UI coincide con lo que declara el preset", {
  payload <- .presets_metadata_payload()
  con_calculos <- Filter(function(x) !is.null(x$calculos), payload$presets)
  expect_gt(length(con_calculos), 8)

  for (p in con_calculos) {
    nombres <- vapply(.PRESETS_META[[p$name]]$args,
                      function(a) as.character(a$name %||% "")[1], character(1))
    # El campo de decimales que anuncia existe de verdad en el preset.
    expect_true(p$calculos$campo_decimales %in% nombres, info = p$name)
    # Y solo dice `admite_metodo` quien declara el arg y cierra a 100 %.
    if (isTRUE(p$calculos$admite_metodo)) {
      expect_true("metodo_redondeo" %in% nombres, info = p$name)
      expect_true(isTRUE(p$calculos$cierra_100), info = p$name)
    }
  }

  # Las familias que no rotulan porcentajes no traen el bloque y la matriz las
  # omite: histograma de conteos, box plot y compañía no tienen qué redondear.
  sin <- Filter(function(x) is.null(x$calculos), payload$presets)
  expect_true("boxplot" %in% vapply(sin, function(x) x$name, character(1)))
  expect_true("histograma" %in% vapply(sin, function(x) x$name, character(1)))
})

test_that("estandar no elimina el cero falso, solo lo corre", {
  # Queda asentado por escrito para que no se lea el cambio de método como una
  # garantía que no da: con base 178 un caso se salva, con base 700 no.
  expect_equal(.pulso_pct_unidades(c(1, 177) / 178, 0, "estandar")[1], 1L)
  expect_equal(.pulso_pct_unidades(c(1, 699) / 700, 0, "estandar")[1], 0L)
})
