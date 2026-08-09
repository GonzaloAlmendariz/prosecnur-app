source("setup-load-all.R")

# Ola 4: divergentes, dumbbell y lollipop.

.capas <- function(p, clase) Filter(function(l) inherits(l$geom, clase), p$layers)

# --- Divergentes ------------------------------------------------------------

.df_likert <- function() {
  data.frame(
    item = c("Trato del personal", "Tiempo de espera"),
    muy_ins = c(3, 11), ins = c(6, 18), ni = c(12, 21), sat = c(44, 33), muy_sat = c(35, 17),
    stringsAsFactors = FALSE
  )
}
.cols_likert <- c("muy_ins", "ins", "ni", "sat", "muy_sat")

test_that("el reparto manda lo declarado a cada lado y parte el neutro", {
  r <- .divergentes_reparto(.cols_likert, n_negativas = 2, incluir_neutro = TRUE)
  expect_identical(r$negativas, c("muy_ins", "ins"))
  expect_identical(r$neutro, "ni")
  expect_identical(r$positivas, c("sat", "muy_sat"))
})

test_that("sin neutro declarado no se inventa uno", {
  r <- .divergentes_reparto(.cols_likert, n_negativas = 2, incluir_neutro = FALSE)
  expect_length(r$neutro, 0L)
  expect_identical(r$positivas, c("ni", "sat", "muy_sat"))
})

test_that("una escala par no tiene nivel central", {
  r <- .divergentes_reparto(c("a", "b", "c", "d"), n_negativas = 2, incluir_neutro = TRUE)
  expect_length(r$neutro, 0L)
  expect_identical(r$negativas, c("a", "b"))
  expect_identical(r$positivas, c("c", "d"))
})

test_that("el reparto explicito es aditivo y usa IDs de columnas", {
  esperado <- list(
    negativas = "muy_ins",
    neutro = "ni",
    positivas = c("sat", "muy_sat")
  )
  r <- .divergentes_reparto(
    c("muy_ins", "ni", "sat", "muy_sat"),
    n_negativas = 2,
    incluir_neutro = TRUE,
    reparto = esperado
  )
  expect_identical(r, esperado)

  # Omitir `reparto` conserva literalmente el contrato historico.
  historico <- .divergentes_reparto(.cols_likert, 2, TRUE)
  expect_identical(historico$negativas, c("muy_ins", "ins"))
  expect_identical(historico$neutro, "ni")
  expect_identical(historico$positivas, c("sat", "muy_sat"))
})

test_that("la escala se lee del cero hacia afuera en los dos lados", {
  # El primer intento dejaba "Muy insatisfecho" en el medio del lado negativo y
  # "Muy satisfecho" pegado al cero: la escala al reves justo donde importa.
  skip_if_not_installed("ggplot2")
  p <- graficar_barras_divergentes(
    data = .df_likert(), var_categoria = "item",
    cols_porcentaje = .cols_likert, n_negativas = 2
  )
  # Se mide la posicion DIBUJADA, no el indice interno: lo que importa es que el
  # segmento del peor nivel quede mas lejos del cero que el del siguiente.
  built <- ggplot2::ggplot_build(p)
  capa <- built$data[[1]]
  d <- p$data
  fila <- which(levels(d$.item) == "Tiempo de espera")

  x_de <- function(cat) {
    idx <- which(d$.cat == cat & d$.item == "Tiempo de espera" & d$.signo < 0)
    if (!length(idx)) return(NA_real_)
    min(capa$xmin[idx], na.rm = TRUE)
  }
  # `muy_ins` es el peor nivel: su borde exterior tiene que estar mas a la
  # izquierda (mas negativo) que el de `ins`.
  expect_lt(x_de("muy_ins"), x_de("ins"))
})

test_that("el neutro se dibuja partido a los dos lados", {
  skip_if_not_installed("ggplot2")
  p <- graficar_barras_divergentes(
    data = .df_likert(), var_categoria = "item",
    cols_porcentaje = .cols_likert, n_negativas = 2, incluir_neutro = TRUE
  )
  d <- p$data
  neu <- d[d$.cat == "ni", ]
  expect_true(any(neu$.signo < 0))
  expect_true(any(neu$.signo > 0))
  # Cada mitad vale la mitad del valor real.
  expect_equal(sum(abs(neu$.signo[neu$.item == "Tiempo de espera"])), 21, tolerance = 1e-9)
})

test_that("el neutro partido se rotula una sola vez y con su valor real", {
  # Rotular las dos mitades escribiria un numero que no existe en los datos.
  skip_if_not_installed("ggplot2")
  p <- graficar_barras_divergentes(
    data = .df_likert(), var_categoria = "item",
    cols_porcentaje = .cols_likert, n_negativas = 2, mostrar_valores = TRUE
  )
  txt <- .capas(p, "GeomText")
  labs <- unlist(lapply(txt, function(l) as.character(l$data$.lab)))
  expect_equal(sum(labs == "21%", na.rm = TRUE), 1L)
})

test_that("el saldo es positivas menos negativas", {
  skip_if_not_installed("ggplot2")
  p <- graficar_barras_divergentes(
    data = .df_likert(), var_categoria = "item",
    cols_porcentaje = .cols_likert, n_negativas = 2, mostrar_saldo = TRUE
  )
  txt <- .capas(p, "GeomText")
  labs <- unlist(lapply(txt, function(l) as.character(l$data$.lab)))
  # Trato: (44+35) - (3+6) = +70. Tiempo: (33+17) - (11+18) = +21.
  expect_true("+70 pp" %in% labs)
  expect_true("+21 pp" %in% labs)
})

test_that("un reparto que deja un lado vacio se rechaza", {
  expect_error(
    graficar_barras_divergentes(
      data = .df_likert(), var_categoria = "item",
      cols_porcentaje = .cols_likert, n_negativas = 0
    ),
    "lado vacio"
  )
})

# --- Dumbbell ---------------------------------------------------------------

.df_brecha <- function() {
  data.frame(
    eje = rep(c("Salud", "Educacion", "Vivienda"), 2),
    grupo = rep(c("Acogida", "Refugiada"), each = 3),
    valor = c(72, 80, 64, 45, 62, 39),
    stringsAsFactors = FALSE
  )
}

test_that("exige exactamente dos bases y explica por que", {
  df <- data.frame(eje = "a", grupo = c("x", "y", "z"), valor = 1:3, stringsAsFactors = FALSE)
  expect_error(graficar_dumbbell(df), "exactamente dos bases")
  expect_error(graficar_dumbbell(df), "rango")
})

test_that("ordena por brecha de fabrica y el mayor queda arriba", {
  skip_if_not_installed("ggplot2")
  p <- graficar_dumbbell(.df_brecha())
  # El eje Y se dibuja de abajo hacia arriba, asi que la brecha mayor es el
  # ultimo nivel del factor.
  niveles <- levels(p$layers[[1]]$data$.eje)
  # Brechas: Salud -27, Educacion -18, Vivienda -25.
  expect_identical(niveles[[length(niveles)]], "Salud")
  expect_identical(niveles[[1]], "Educacion")
})

test_that("un tema sin valor en una de las bases no dibuja media brecha", {
  skip_if_not_installed("ggplot2")
  df <- .df_brecha()
  df <- df[!(df$eje == "Vivienda" & df$grupo == "Refugiada"), , drop = FALSE]
  p <- graficar_dumbbell(df)
  expect_false("Vivienda" %in% levels(p$layers[[1]]$data$.eje))
})

test_that("sin ningun tema comun se dice, no se dibuja vacio", {
  df <- data.frame(
    eje = c("a", "b"), grupo = c("x", "y"), valor = c(1, 2),
    stringsAsFactors = FALSE
  )
  expect_error(graficar_dumbbell(df), "no hay brecha")
})

test_that("la brecha rotulada es la diferencia real", {
  skip_if_not_installed("ggplot2")
  p <- graficar_dumbbell(.df_brecha(), mostrar_brecha = TRUE)
  txt <- .capas(p, "GeomText")
  labs <- unlist(lapply(txt, function(l) as.character(l$data$.lab)))
  expect_true("-27 pp" %in% labs)   # Salud: 45 - 72
  expect_true("-18 pp" %in% labs)   # Educacion: 62 - 80
})

test_that("el umbral silencia las brechas chicas", {
  skip_if_not_installed("ggplot2")
  p <- graficar_dumbbell(.df_brecha(), mostrar_brecha = TRUE, umbral_brecha_pct = 26)
  txt <- .capas(p, "GeomText")
  labs <- unlist(lapply(txt, function(l) as.character(l$data$.lab)))
  expect_true("-27 pp" %in% labs)
  expect_false("-18 pp" %in% labs)
})

# --- Lollipop ---------------------------------------------------------------

.df_rank <- function() {
  data.frame(
    opcion = c("Transporte", "Salud", "Trabajo", "Vivienda", "Educacion"),
    pct = c(52, 61, 38, 44, 25),
    stringsAsFactors = FALSE
  )
}

test_that("ordena de mayor a menor de fabrica", {
  skip_if_not_installed("ggplot2")
  p <- graficar_lollipop(.df_rank(), "opcion", "pct")
  niveles <- levels(p$data$.cat)
  # El eje Y va de abajo hacia arriba: el mayor es el ultimo nivel.
  expect_identical(niveles[[length(niveles)]], "Salud")
  expect_identical(niveles[[1]], "Educacion")
})

test_that("el orden declarado respeta el instrumento", {
  skip_if_not_installed("ggplot2")
  p <- graficar_lollipop(.df_rank(), "opcion", "pct", orden = "declarado")
  expect_identical(levels(p$data$.cat)[[length(levels(p$data$.cat))]], "Transporte")
})

test_that("el recorte por top_n se declara para no dejar creer que son todas", {
  skip_if_not_installed("ggplot2")
  p <- graficar_lollipop(.df_rank(), "opcion", "pct", top_n = 3)
  expect_equal(nrow(p$data), 3L)
  expect_equal(attr(p, "pulso_lollipop_recortadas"), 2L)
})

test_that("sin recorte no se reporta recorte", {
  skip_if_not_installed("ggplot2")
  p <- graficar_lollipop(.df_rank(), "opcion", "pct")
  expect_equal(attr(p, "pulso_lollipop_recortadas"), 0L)
})

test_that("un top_n mayor que las categorias no recorta nada", {
  skip_if_not_installed("ggplot2")
  p <- graficar_lollipop(.df_rank(), "opcion", "pct", top_n = 99)
  expect_equal(nrow(p$data), 5L)
  expect_equal(attr(p, "pulso_lollipop_recortadas"), 0L)
})

test_that("la categoria resaltada usa el color de enfasis", {
  skip_if_not_installed("ggplot2")
  p <- graficar_lollipop(.df_rank(), "opcion", "pct", resaltar = "Salud")
  expect_true(p$data$.destacada[p$data$.cat == "Salud"])
  expect_false(any(p$data$.destacada[p$data$.cat != "Salud"]))
})

# --- Contrato del plan ------------------------------------------------------

test_that("los tres constructores arman un ppt_element utilizable", {
  d <- p_barras_divergentes(vars = c("p1", "p2"), n_negativas = 2)
  expect_s3_class(d, "ppt_element")
  expect_identical(d$.element_type, "barras_divergentes")

  b <- p_dumbbell(vars = list("Salud" = c("a$p1", "b$p1")), corte = "3,4")
  expect_s3_class(b, "ppt_element")
  expect_identical(b$.element_type, "dumbbell")
  expect_null(b$var)          # el match parcial de `$` tumbaria el mazo
  expect_true("var" %in% names(b))

  l <- p_lollipop(var = "p1", top_n = 10)
  expect_s3_class(l, "ppt_element")
  expect_identical(l$.element_type, "lollipop")
})

test_that("barras divergentes y lollipop conservan su prefijo posicional", {
  expect_identical(
    names(formals(p_barras_divergentes)),
    c(
      "vars", "var", "n_negativas", "incluir_neutro", "mostrar_saldo",
      "titulo", "overrides", "base", "filtros",
      "umbral_etiqueta_pct", "excluir_opciones"
    )
  )
  d <- p_barras_divergentes(
    c("p1", "p2"), NULL, 2L, TRUE, FALSE, "Titulo divergente posicional"
  )
  expect_identical(d$title_slide, "Titulo divergente posicional")
  expect_false(d$overrides$mostrar_saldo)

  d_nombrado <- p_barras_divergentes(
    vars = "p1",
    umbral_etiqueta_pct = 7,
    excluir_opciones = c("No sabe", "No responde")
  )
  expect_equal(d_nombrado$overrides$umbral_etiqueta_pct, 7)
  expect_identical(
    d_nombrado$overrides$excluir_opciones,
    c("No sabe", "No responde")
  )

  expect_identical(
    names(formals(p_lollipop)),
    c(
      "var", "orden", "top_n", "resaltar", "titulo", "overrides", "base",
      "filtros", "excluir_opciones"
    )
  )
  l <- p_lollipop(
    "p1", "declarado", 3L, "Salud", "Titulo lollipop posicional"
  )
  expect_identical(l$title_slide, "Titulo lollipop posicional")
  expect_identical(l$overrides$orden, "declarado")
  expect_identical(l$overrides$top_n, 3L)
  expect_identical(l$overrides$resaltar, "Salud")

  l_nombrado <- p_lollipop(var = "p1", excluir_opciones = "No sabe")
  expect_identical(l_nombrado$overrides$excluir_opciones, "No sabe")
})

test_that("los controles publicados sobreviven constructor y rebuild", {
  d <- .graficos_rebuild_graf_json(
    list(
      graficador = "p_barras_divergentes",
      args = list(
        vars = c("p1", "p2"),
        umbral_etiqueta_pct = 7,
        excluir_opciones = c("No sabe", "No responde")
      )
    )
  )
  expect_equal(d$overrides$umbral_etiqueta_pct, 7)
  expect_identical(d$overrides$excluir_opciones, c("No sabe", "No responde"))

  l <- .graficos_rebuild_graf_json(
    list(
      graficador = "p_lollipop",
      args = list(var = "p1", excluir_opciones = "No sabe")
    )
  )
  expect_identical(l$overrides$excluir_opciones, "No sabe")
})

test_that("aliases de umbral se normalizan antes del whitelist y el canónico gana", {
  div <- .clean_rebuild_args(
    list(vars = "p1", umbral_etiqueta = 6),
    p_barras_divergentes
  )
  expect_false("umbral_etiqueta" %in% names(div))
  expect_equal(div$umbral_etiqueta_pct, 6)

  dumb <- .clean_rebuild_args(
    list(
      vars = list(Tema = c("a$p1", "b$p1")),
      corte = "3,4",
      umbral_brecha = 4,
      umbral_brecha_pct = 9
    ),
    p_dumbbell
  )
  expect_false("umbral_brecha" %in% names(dumb))
  expect_equal(dumb$umbral_brecha_pct, 9)

  legacy_fn <- function(umbral_etiqueta = NULL) umbral_etiqueta
  legacy <- .clean_rebuild_args(list(umbral_etiqueta = 0.05), legacy_fn)
  expect_equal(legacy$umbral_etiqueta, 0.05)
})

test_that("la exclusión ocurre antes de recalcular el denominador", {
  skip_if_not_installed("ggplot2")
  .tab_freq <- function(ref, filtros = list()) {
    data.frame(
      Opciones = c("Visible", "No sabe", "Total"),
      n = c(30, 70, 100),
      stringsAsFactors = FALSE
    )
  }

  tab <- .ola4_tabla_opciones("p1", list(), excluir_opciones = "No sabe")
  expect_identical(tab$Opciones, "Visible")
  expect_equal(tab$n / sum(tab$n), 1)

  p <- .render_lollipop(
    p_lollipop("p1", excluir_opciones = "No sabe"),
    preset_args = list()
  )
  expect_equal(nrow(p$data), 1L)
  expect_equal(p$data$.valor, 100)
})

test_that("excluir una negativa no reclasifica Neutral ni cambia la polaridad", {
  skip_if_not_installed("ggplot2")
  escala <- c("Muy negativa", "Negativa", "Neutral", "Positiva", "Muy positiva")
  .tab_freq <- function(ref, filtros = list()) {
    data.frame(
      Opciones = c(escala, "Total"),
      n = c(10, 20, 30, 25, 15, 100),
      stringsAsFactors = FALSE
    )
  }

  tabla <- .ola4_tabla_escala(
    "p1",
    list(),
    excluir_opciones = "Negativa",
    n_negativas = 2,
    incluir_neutro = TRUE
  )
  neutral_id <- names(tabla$etiquetas_grupos)[tabla$etiquetas_grupos == "Neutral"]
  expect_identical(tabla$reparto$neutro, unname(neutral_id))
  expect_false(neutral_id %in% tabla$reparto$negativas)

  p <- .render_barras_divergentes(
    p_barras_divergentes(
      "p1",
      n_negativas = 2,
      incluir_neutro = TRUE,
      excluir_opciones = "Negativa"
    ),
    preset_args = list()
  )
  neutral_rows <- p$data[as.character(p$data$.cat) == neutral_id, , drop = FALSE]
  expect_setequal(neutral_rows$.lado, c("neu", "neu2"))
  saldo <- sum(p$data$.signo[p$data$.lado %in% c("neg", "pos")])
  expect_equal(saldo, 37.5)
  expect_gt(saldo, 0)
})

test_that("una ref sin frecuencia aborta la bateria y nombra la ref", {
  .tab_freq <- function(ref, filtros = list()) {
    if (identical(ref, "p2")) return(NULL)
    data.frame(
      Opciones = c("Negativa", "Neutral", "Positiva", "Total"),
      n = c(20, 30, 50, 100),
      stringsAsFactors = FALSE
    )
  }

  expect_error(
    .ola4_tabla_escala(c("p1", "p2"), list(), n_negativas = 1),
    "p2.*no devolvio frecuencias utilizables"
  )
})

test_that("una ref vaciada por exclusion aborta la bateria y nombra la ref", {
  escala <- c("Negativa", "Neutral", "Positiva")
  .tab_freq <- function(ref, filtros = list()) {
    data.frame(
      Opciones = c(escala, "Total"),
      n = c(20, 30, 50, 100),
      stringsAsFactors = FALSE
    )
  }
  .resolve_ref <- function(ref, arg_name = "var") list(ref = ref)
  .exclusion_for_ctx <- function(ctx, excluir_opciones) {
    if (identical(ctx$ref, "p2")) escala else excluir_opciones
  }

  expect_error(
    .ola4_tabla_escala(
      c("p1", "p2"),
      list(),
      excluir_opciones = "solo_p2",
      n_negativas = 1
    ),
    "p2.*vacia tras aplicar exclusiones"
  )
})

test_that("la bateria falla si las refs no comparten la escala original", {
  .tab_freq <- function(ref, filtros = list()) {
    opciones <- if (identical(ref, "p1")) {
      c("Negativa", "Neutral", "Positiva")
    } else {
      c("Negativa", "Indiferente", "Positiva")
    }
    data.frame(
      Opciones = c(opciones, "Total"),
      n = c(20, 30, 50, 100),
      stringsAsFactors = FALSE
    )
  }

  expect_error(
    .ola4_tabla_escala(c("p1", "p2"), list(), n_negativas = 1),
    "p2.*escala original.*p1"
  )
})

test_that("las exclusiones no pueden dejar un lado divergente vacio", {
  .tab_freq <- function(ref, filtros = list()) {
    data.frame(
      Opciones = c(
        "Muy negativa", "Negativa", "Neutral", "Positiva", "Muy positiva", "Total"
      ),
      n = c(10, 20, 30, 25, 15, 100),
      stringsAsFactors = FALSE
    )
  }

  expect_error(
    .ola4_tabla_escala(
      "p1",
      list(),
      excluir_opciones = c("Muy negativa", "Negativa"),
      n_negativas = 2,
      incluir_neutro = TRUE
    ),
    "lado negativo vacio"
  )
})

test_that("cada ref conserva ambos lados aunque la bateria global los tenga", {
  escala <- c("Muy negativa", "Negativa", "Neutral", "Positiva", "Muy positiva")
  .tab_freq <- function(ref, filtros = list()) {
    data.frame(
      Opciones = c(escala, "Total"),
      n = c(10, 20, 30, 25, 15, 100),
      stringsAsFactors = FALSE
    )
  }
  .resolve_ref <- function(ref, arg_name = "var") list(ref = ref)
  .exclusion_for_ctx <- function(ctx, excluir_opciones) {
    if (identical(ctx$ref, "p1")) c("Muy negativa", "Negativa") else excluir_opciones
  }

  expect_error(
    .ola4_tabla_escala(
      c("p1", "p2"),
      list(),
      excluir_opciones = "solo_p1",
      n_negativas = 2,
      incluir_neutro = TRUE
    ),
    "p1.*lado negativo vacio"
  )
})

test_that("el dispatcher encuentra los tres renderers por convencion", {
  # Es lo que permite que existan sin agregar una linea al archivo congelado.
  for (etype in c("barras_divergentes", "dumbbell", "lollipop")) {
    expect_true(exists(paste0(".render_", etype), mode = "function"), label = etype)
  }
})

test_that("los constructores rechazan una declaracion incompleta", {
  expect_error(p_barras_divergentes(vars = character(0)), "al menos una pregunta")
  expect_error(p_dumbbell(vars = list(), corte = "3"), "lista nombrada")
  expect_error(p_dumbbell(vars = list("T" = "a$b"), corte = ""), "al menos un codigo")
  expect_error(p_lollipop(var = ""), "character\\(1\\)")
})
