test_that("el spec se alinea por nombre contra las categorias de la lamina", {
  spec <- .t2b_normalizar_comparativo(
    list(
      periodo_actual = "2021",
      periodo_anterior = "2018",
      valores_anterior = c(Docentes = 96, Estudiantes = 85)
    ),
    categorias = c("Estudiantes", "Docentes")
  )

  expect_equal(spec$periodo_actual, "2021")
  expect_equal(spec$periodo_anterior, "2018")
  # El orden manda el de la lamina, no el del spec.
  expect_equal(spec$valores, c(85, 96))
})

test_that("una categoria sin historico queda NA y no recicla el valor de otra", {
  spec <- .t2b_normalizar_comparativo(
    list(valores_anterior = c(Estudiantes = 85)),
    categorias = c("Estudiantes", "Docentes", "Egresados")
  )

  expect_equal(spec$valores, c(85, NA_real_, NA_real_))
})

test_that("un vector sin nombres solo se acepta si calza exacto por posicion", {
  ok <- .t2b_normalizar_comparativo(
    list(valores_anterior = c(85, 96)),
    categorias = c("Estudiantes", "Docentes")
  )
  expect_equal(ok$valores, c(85, 96))

  # Longitud distinta sin nombres: no se adivina a quien corresponde cada cifra.
  expect_null(.t2b_normalizar_comparativo(
    list(valores_anterior = c(85, 96)),
    categorias = c("Estudiantes", "Docentes", "Egresados")
  ))
})

test_that("el historico en proporcion se normaliza a porcentaje", {
  spec <- .t2b_normalizar_comparativo(
    list(valores_anterior = c(Estudiantes = 0.85, Docentes = 0.96)),
    categorias = c("Estudiantes", "Docentes")
  )
  expect_equal(spec$valores, c(85, 96))
})

test_that("sin datos declarados no hay comparativo (la columna sigue simple)", {
  expect_null(.t2b_normalizar_comparativo(NULL, c("Estudiantes")))
  expect_null(.t2b_normalizar_comparativo(list(), c("Estudiantes")))
  expect_null(.t2b_normalizar_comparativo(
    list(valores_anterior = c(Estudiantes = NA_real_)),
    c("Estudiantes")
  ))
})

test_that("el semaforo corta en 80 y en 70, medido contra el deck 2021", {
  cols <- .t2b_semaforo_color(c(100, 80, 79, 70, 69, NA))

  expect_equal(cols[1], .T2B_SEMAFORO_COLORES[["alto"]])   # 100
  expect_equal(cols[2], .T2B_SEMAFORO_COLORES[["alto"]])   # 80 -> verde (limite inclusivo)
  expect_equal(cols[3], .T2B_SEMAFORO_COLORES[["medio"]])  # 79 -> ambar
  expect_equal(cols[4], .T2B_SEMAFORO_COLORES[["medio"]])  # 70 -> ambar
  expect_equal(cols[5], .T2B_SEMAFORO_COLORES[["bajo"]])   # 69 -> rojo
  # Sin dato no se emite juicio.
  expect_false(cols[6] %in% unname(.T2B_SEMAFORO_COLORES))
})

test_that("umbrales sin nombrar se leen por posicion sin abortar", {
  cols <- .t2b_semaforo_color(c(95, 85), umbrales = c(90, 60))
  expect_equal(cols[1], .T2B_SEMAFORO_COLORES[["alto"]])
  expect_equal(cols[2], .T2B_SEMAFORO_COLORES[["medio"]])
})

test_that("la tendencia distingue subida, caida y repeticion", {
  dirs <- .t2b_direccion(
    actual   = c(93, 78, 96, 90),
    anterior = c(85, 90, 96, NA)
  )
  expect_equal(dirs[1], "sube")
  expect_equal(dirs[2], "baja")
  expect_true(is.na(dirs[3]))  # 96 vs 96: sin cambio, sin flecha
  expect_true(is.na(dirs[4]))  # sin historico, sin flecha
})

test_that("la tolerancia apaga la flecha de un punto de redondeo", {
  expect_equal(.t2b_direccion(91, 90, tolerancia_pp = 0), "sube")
  expect_true(is.na(.t2b_direccion(91, 90, tolerancia_pp = 1)))
  expect_equal(.t2b_direccion(93, 90, tolerancia_pp = 1), "sube")
})

test_that("las capas se emiten solo cuando hay comparativo", {
  spec <- .t2b_normalizar_comparativo(
    list(periodo_actual = "2021", periodo_anterior = "2018",
         valores_anterior = c(Estudiantes = 85, Docentes = 96)),
    c("Estudiantes", "Docentes")
  )

  capas <- .t2b_capas_extra(
    x0 = 0.85, w = 0.14, y = c(0.3, 0.7),
    valores_actual = c(93, 96),
    comparativo = spec,
    y_encabezado = 0.92
  )

  expect_true(length(capas) > 0)
  # Sin spec no se dibuja nada: el graficador cae a la columna de siempre.
  expect_length(.t2b_capas_extra(0.85, 0.14, c(0.3, 0.7), c(93, 96), NULL), 0)
})

# ---------------------------------------------------------------------------
# Integracion con el graficador: el comparativo no debe alterar la lamina
# cuando no se declara, y debe dibujarse cuando si.
# ---------------------------------------------------------------------------

.t2b_datos_demo <- function() {
  data.frame(
    publico = c("Estudiantes", "Docentes"),
    n = c(172, 52),
    p1 = c(0.01, 0.00),
    p2 = c(0.06, 0.04),
    p3 = c(0.49, 0.34),
    p4 = c(0.44, 0.62)
  )
}

.t2b_args_demo <- function(path, ...) {
  utils::modifyList(list(
    data = .t2b_datos_demo(),
    var_categoria = "publico",
    var_n = "n",
    cols_porcentaje = c("p1", "p2", "p3", "p4"),
    etiquetas_grupos = c(p1 = "Totalmente en desacuerdo", p2 = "En desacuerdo",
                         p3 = "De acuerdo", p4 = "Totalmente de acuerdo"),
    mostrar_barra_extra = TRUE,
    barra_extra_preset = "top2box",
    usar_canvas = TRUE,
    exportar = "png",
    path_salida = path,
    ancho = 13.33, alto = 5.2, dpi = 72
  ), list(...))  # los `...` mandan: un test puede cambiar el preset de la columna
}

test_that("la lamina con comparativo se renderiza sin romper", {
  skip_if_not_installed("cowplot")
  path <- tempfile(fileext = ".png")
  do.call(graficar_barras_apiladas, .t2b_args_demo(
    path,
    barra_extra_comparativo = list(
      periodo_actual = "2021", periodo_anterior = "2018",
      valores_anterior = c(Estudiantes = 85, Docentes = 96)
    )
  ))
  expect_true(file.exists(path))
  expect_gt(file.size(path), 0)
})

test_that("sin comparativo la lamina sigue rindiendo la columna de siempre", {
  skip_if_not_installed("cowplot")
  path <- tempfile(fileext = ".png")
  do.call(graficar_barras_apiladas, .t2b_args_demo(path))
  expect_true(file.exists(path))
  expect_gt(file.size(path), 0)
})

test_that("el comparativo se ignora cuando la columna extra lleva conteos", {
  # Con `totales` la columna son N, no porcentajes: un semaforo de 80/70 sobre
  # un conteo no significa nada, asi que el spec no debe activarse.
  skip_if_not_installed("cowplot")
  path <- tempfile(fileext = ".png")
  expect_no_error(do.call(graficar_barras_apiladas, .t2b_args_demo(
    path,
    barra_extra_preset = "totales",
    barra_extra_comparativo = list(
      periodo_actual = "2021", periodo_anterior = "2018",
      valores_anterior = c(Estudiantes = 85, Docentes = 96)
    )
  )))
})

test_that("el preset de acreditacion declara la separacion y la jerarquia del deck", {
  pre <- .preset_acreditacion_apiladas()

  # gapWidth 74 del deck => la barra ocupa 100/174 del carril.
  expect_equal(pre$grosor_barras, 0.575)
  expect_equal(pre$grosor_modo, "manual")

  # Jerarquia: pregunta (16) > dato (14) > etiqueta de fila (13).
  expect_gt(pre$size_titulos_grupo, pre$size_texto_barras * ggplot2::.pt)
  expect_gt(pre$size_texto_barras * ggplot2::.pt, pre$size_ejes)

  # La leyenda es de mazo, no de lamina.
  expect_false(pre$mostrar_leyenda)

  # La rampa cierra en verde, no en azul marino.
  expect_equal(unname(pre$colores_grupos[["Totalmente de acuerdo"]]), "#8FC36B")
})

test_that("presets_acreditacion() entrega un objeto que el plan PPT ya sabe leer", {
  pr <- presets_acreditacion()

  # Forma de p_presets(): un bloque por tipo, cada uno con `args`.
  expect_true(is.list(pr))
  expect_true(all(c("base", "barras_apiladas", "multi_apiladas") %in% names(pr)))
  expect_true(is.list(pr$barras_apiladas$args))

  # Las apiladas de una y de varias fuentes comparten estilo: una lamina con
  # dos publicos y otra con uno no pueden verse distintas.
  expect_equal(
    pr$multi_apiladas$args$grosor_barras,
    pr$barras_apiladas$args$grosor_barras
  )

  # El comparativo NO viaja en el preset: es un dato de cada pregunta.
  expect_null(pr$barras_apiladas$args$barra_extra_comparativo)
})

test_that("la paleta se ancla a la etiqueta real aunque cambien mayusculas o tildes", {
  # Las del instrumento de acreditacion real (`acrconta.pulso`): con match
  # exacto por nombre, dos de cuatro caian al azul marino y al teal del default.
  reales <- c("Totalmente en Desacuerdo", "En desacuerdo",
              "De acuerdo", "Totalmente de Acuerdo")
  cols <- .preset_acreditacion_colores(reales)

  expect_equal(unname(cols), .PRESET_ACRD_RAMPA)
  expect_equal(names(cols), reales)  # se nombra como la lamina las va a mostrar
})

test_that("una categoria fuera de la escala no entra a la rampa", {
  cols <- .preset_acreditacion_colores(
    c("Totalmente en Desacuerdo", "En desacuerdo", "De acuerdo",
      "Totalmente de Acuerdo", "SIN INF")
  )
  expect_equal(unname(cols[1:4]), .PRESET_ACRD_RAMPA)
  expect_equal(unname(cols[["SIN INF"]]), .PRESET_ACRD_FUERA_ESCALA)
})

test_that("la escala de satisfaccion resuelve con la misma rampa", {
  cols <- .preset_acreditacion_colores(
    c("Nada satisfecho", "Poco satisfecho", "Satisfecho", "Muy satisfecho")
  )
  expect_equal(unname(cols), .PRESET_ACRD_RAMPA)
})

test_that("cuatro etiquetas irreconocibles se asignan por posicion, no a medias", {
  cols <- .preset_acreditacion_colores(c("Nivel 1", "Nivel 2", "Nivel 3", "Nivel 4"))
  expect_equal(unname(cols), .PRESET_ACRD_RAMPA)
})

test_that("sin etiquetas se devuelven los nombres canonicos", {
  cols <- .preset_acreditacion_colores(NULL)
  expect_equal(unname(cols), .PRESET_ACRD_RAMPA)
  expect_true("Totalmente de acuerdo" %in% names(cols))
})

test_that("el historico se puede declarar por el id con que el plan nombra la fila", {
  # En una bateria multiapilada el plan identifica cada fila por su variable
  # (`p30_1`), no por el enunciado. Exigir el enunciado completo rompia el
  # match en silencio cada vez que la etiqueta se recortaba o envolvia.
  spec <- .t2b_normalizar_comparativo(
    list(valores_anterior = c(p30_1 = 88, p30_2 = 91)),
    categorias = c("La carrera tiene un plan de estudios solido",
                   "Las autoridades toman decisiones"),
    alias = c("p30_1", "p30_2")
  )
  expect_equal(spec$valores, c(88, 91))
})

test_that("la etiqueta envuelta a dos lineas sigue alineando", {
  spec <- .t2b_normalizar_comparativo(
    list(valores_anterior = c("Los reglamentos son claros" = 79)),
    categorias = "Los reglamentos\nson claros"
  )
  expect_equal(spec$valores, 79)
})

test_that("el alias no pisa un match por etiqueta que ya resolvio", {
  spec <- .t2b_normalizar_comparativo(
    list(valores_anterior = c(Estudiantes = 85, p2 = 99)),
    categorias = c("Estudiantes", "Docentes"),
    alias = c("p1", "p2")
  )
  # La primera resuelve por etiqueta; la segunda solo tiene alias.
  expect_equal(spec$valores, c(85, 99))
})

test_that("claves que no coinciden con ninguna fila caen a orden, pero avisando", {
  # El caso real: en una bateria multiapilada la fila se identifica por el
  # ENUNCIADO y el plan declara por variable. Antes esto devolvia NULL y la
  # columna volvia a la cifra suelta sin decir nada.
  expect_warning(
    spec <- .t2b_normalizar_comparativo(
      list(valores_anterior = c(p30_1 = 88, p30_2 = 91, p30_3 = 74)),
      categorias = c("La carrera tiene un plan de estudios",
                     "Las autoridades toman decisiones",
                     "Existe un equilibrio entre admitidos"),
      alias = c("La carrera tiene un plan de estudios",
                "Las autoridades toman decisiones",
                "Existe un equilibrio entre admitidos")
    ),
    "se alinea por ORDEN"
  )
  expect_equal(spec$valores, c(88, 91, 74))
})

test_that("un match parcial NO cae a orden: respeta lo declarado y deja NA el resto", {
  # Si al menos una clave resolvio, el usuario si sabe nombrar filas; reordenar
  # todo por posicion ahi seria pisar un dato correcto con uno inventado.
  expect_silent(
    spec <- .t2b_normalizar_comparativo(
      list(valores_anterior = c(Estudiantes = 85, NoExiste = 99)),
      categorias = c("Estudiantes", "Docentes")
    )
  )
  expect_equal(spec$valores, c(85, NA_real_))
})
