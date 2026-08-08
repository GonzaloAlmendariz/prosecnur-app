source("setup-load-all.R")

# COBERTURA DE COMPOSICION (A7 del roadmap).
#
# Las suites del motor cubren contrato y estructura, no donde cae cada cosa
# dentro del lienzo. Todos los defectos que llegaron al cliente eran de
# composicion: el caption al borde absoluto, las cifras superpuestas de la serie
# temporal, el top-two-box de 3 pt. Este archivo mide lo que antes solo se veia
# renderizando.
#
# Las dos primeras mitades son distintas a proposito:
#   - las pruebas del AUDITOR verifican que detecta lo que dice detectar,
#     sembrando cada defecto historico;
#   - el BARRIDO lo aplica al catalogo, que es la cobertura propiamente dicha.
#
# Un auditor que no se prueba contra un defecto real es un test que siempre pasa.

# --- El auditor detecta lo que dice detectar --------------------------------

.comp_df_agrupadas <- function() {
  data.frame(
    categoria = c("Muy de acuerdo", "De acuerdo"), N = 800,
    pct_1 = c(.35, .65), pct_2 = c(.15, .85), stringsAsFactors = FALSE
  )
}
.comp_nota_larga <- paste(
  "Fuente: encuesta de salida aplicada en agosto de 2026 a personas usuarias",
  "de los cuatro centros de atencion del programa"
)

.comp_grafico_agrupadas <- function(...) {
  graficar_barras_agrupadas(
    data = .comp_df_agrupadas(), var_categoria = "categoria", var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Hombres", pct_2 = "Mujeres"),
    usar_canvas = TRUE, exportar = "rplot", ...
  )
}

test_that("un grafico sano no produce hallazgos", {
  skip_if_not_installed("ggplot2")
  p <- .comp_grafico_agrupadas(nota_pie = .comp_nota_larga)
  expect_equal(nrow(graficos_composicion_auditar(p)), 0L)
})

test_that("detecta el caption anclado al borde absoluto", {
  # El defecto real, reproducido: `x = 1` con `hjust = 1`. No cruza el limite
  # por aritmetica, pero queda pegado al borde y en el render se lee cortado.
  # La primera version de la regla toleraba tocar el borde y no lo veia.
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("cowplot")
  p <- .comp_grafico_agrupadas(nota_pie = .comp_nota_larga)
  sembrado <- p + cowplot::draw_text(text = .comp_nota_larga, x = 1, y = 0.03, hjust = 1, size = 8)

  hallazgos <- graficos_composicion_auditar(sembrado)
  expect_true(any(hallazgos$regla == "borde"))
})

test_that("detecta dos cifras que se pisan y ve cuando dejan de pisarse", {
  # El defecto de la serie temporal: donde dos lineas se cruzan, sus cifras se
  # dibujaban una encima de otra. El anticolision las separa moviendo el ANCLA,
  # no la coordenada, asi que la regla tiene que mirar el `vjust`.
  skip_if_not_installed("ggplot2")
  df <- data.frame(
    eje = rep(c("A", "B"), each = 4),
    grupo = rep(c("O1", "O2", "O3", "O4"), 2),
    valor = c(45, 58, 67, 72, 62, 60, 71, 78),
    stringsAsFactors = FALSE
  )
  con <- graficar_serie_temporal(df, mostrar_valores = TRUE)
  sin <- graficar_serie_temporal(df, mostrar_valores = TRUE, separacion_etiquetas = 0)

  expect_equal(sum(graficos_composicion_auditar(con)$regla == "solape"), 0L)
  expect_gt(sum(graficos_composicion_auditar(sin)$regla == "solape"), 0L)
})

test_that("detecta el texto por debajo del minimo legible", {
  # El top-two-box de 3 pt del cierre de equivalencias: en la lamina exportada
  # era un borron.
  skip_if_not_installed("ggplot2")
  df <- data.frame(
    eje = "A", grupo = c("O1", "O2"), valor = c(45, 72), stringsAsFactors = FALSE
  )
  chico <- graficar_serie_temporal(df, mostrar_valores = TRUE, size_valores = 1.5)
  normal <- graficar_serie_temporal(df, mostrar_valores = TRUE)

  expect_gt(sum(graficos_composicion_auditar(chico)$regla == "ilegible"), 0L)
  expect_equal(sum(graficos_composicion_auditar(normal)$regla == "ilegible"), 0L)
})

test_that("un grafico sin textos no revienta ni inventa hallazgos", {
  skip_if_not_installed("ggplot2")
  p <- ggplot2::ggplot(data.frame(x = 1:3, y = 1:3), ggplot2::aes(x, y)) + ggplot2::geom_point()
  out <- graficos_composicion_auditar(p)
  expect_s3_class(out, "data.frame")
  expect_equal(nrow(out), 0L)
  expect_named(out, c("regla", "etiqueta", "detalle"))
})

test_that("lo que no es un ggplot se ignora en vez de abortar", {
  # El barrido no puede caerse porque un graficador devuelva un gtable.
  expect_equal(nrow(graficos_composicion_auditar(NULL)), 0L)
  expect_equal(nrow(graficos_composicion_auditar("no soy un grafico")), 0L)
})

# --- El barrido del catalogo ------------------------------------------------

# Un caso por graficador, con datos sinteticos y textos LARGOS a proposito: el
# desborde aparece con la nota real de un estudio, no con "abc".
.comp_casos <- function() {
  nota <- .comp_nota_larga
  titulo <- "Satisfaccion con los servicios recibidos durante el ultimo trimestre"

  likert <- data.frame(
    item = c("Trato del personal", "Tiempo de espera"),
    n = 412, muy_ins = c(3, 11), ins = c(6, 18), ni = c(12, 21),
    sat = c(44, 33), muy_sat = c(35, 17), stringsAsFactors = FALSE
  )
  tidy <- data.frame(
    eje = rep(c("Acceso a servicios de salud", "Documentacion regularizada"), each = 3),
    grupo = rep(c("Linea de base", "Ola 2", "Ola 3"), 2),
    valor = c(45, 58, 67, 30, 34, 33), stringsAsFactors = FALSE
  )
  brecha <- data.frame(
    eje = rep(c("Acceso a salud", "Documentacion"), 2),
    grupo = rep(c("Poblacion de acogida", "Poblacion refugiada"), each = 2),
    valor = c(72, 68, 45, 31), stringsAsFactors = FALSE
  )

  list(
    serie_temporal = function() graficar_serie_temporal(
      tidy, titulo = titulo, nota_pie = nota
    ),
    dumbbell = function() graficar_dumbbell(
      brecha, titulo = titulo, nota_pie = nota
    ),
    lollipop = function() graficar_lollipop(
      data.frame(opcion = c("Transporte publico", "Atencion en salud", "Busqueda de trabajo"),
                 pct = c(52, 61, 38), stringsAsFactors = FALSE),
      "opcion", "pct", titulo = titulo, nota_pie = nota
    ),
    barras_divergentes = function() graficar_barras_divergentes(
      likert, var_categoria = "item",
      cols_porcentaje = c("muy_ins", "ins", "ni", "sat", "muy_sat"),
      n_negativas = 2, titulo = titulo, nota_pie = nota
    ),
    barras_agrupadas = function() .comp_grafico_agrupadas(titulo = titulo, nota_pie = nota),
    barras_apiladas = function() graficar_barras_apiladas(
      data = likert, var_categoria = "item", var_n = "n",
      cols_porcentaje = c("muy_ins", "ins", "ni", "sat", "muy_sat"),
      etiquetas_grupos = c(muy_ins = "Muy insatisfecho", ins = "Insatisfecho",
                           ni = "Ni una ni otra", sat = "Satisfecho", muy_sat = "Muy satisfecho"),
      escala_valor = "proporcion_100", titulo = titulo, nota_pie = nota,
      usar_canvas = TRUE
    )
  )
}

test_that("ningun graficador del catalogo desborda, pisa ni encoge su texto", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("cowplot")

  casos <- .comp_casos()
  problemas <- list()

  for (nombre in names(casos)) {
    p <- tryCatch(casos[[nombre]](), error = function(e) e)
    if (inherits(p, "error")) {
      problemas[[nombre]] <- paste("no construye:", conditionMessage(p))
      next
    }
    hallazgos <- graficos_composicion_auditar(p)
    if (nrow(hallazgos)) {
      problemas[[nombre]] <- paste0(
        nrow(hallazgos), " hallazgo(s): ",
        paste(unique(hallazgos$regla), collapse = ", "), " — ",
        paste(utils::head(hallazgos$detalle, 2), collapse = " | ")
      )
    }
  }

  expect_identical(
    names(problemas), NULL,
    label = paste0(
      "Composicion con hallazgos. ",
      paste(names(problemas), unlist(problemas), sep = ": ", collapse = "; ")
    )
  )
})

test_that("el barrido cubre de verdad los graficadores nuevos", {
  # Un barrido que se olvida de un graficador pasa en verde sin mirarlo. La
  # lista de casos tiene que nombrar a los del catalogo que sabe auditar.
  casos <- names(.comp_casos())
  expect_true(all(c("serie_temporal", "dumbbell", "lollipop",
                    "barras_divergentes") %in% casos))
})
