source("setup-load-all.R")

# ADR 0064 — el radar compara públicos.
#
# Los radares del motor cruzan por una variable dentro de una base; aquí las
# series son las fuentes. El cálculo se prueba aparte del dibujo porque es donde
# está la decisión que importa: qué cuenta como el indicador y sobre qué
# denominador.

.rmb_fuente <- function(valores, var = "p1") {
  # Dos columnas a proposito. Con UNA, el `%||%` compartido revienta: para un
  # data frame `length()` es el numero de columnas, asi que `length(a) == 1 &&
  # is.na(a)` evalua `is.na()` sobre el data frame entero y `&&` recibe un
  # vector. Las bases reales tienen decenas de columnas y nunca lo tocan, pero el
  # fixture si lo hacia.
  data <- data.frame(id = seq_along(valores), x = valores, stringsAsFactors = FALSE)
  names(data) <- c("id", var)
  inst <- list(
    survey = data.frame(type = c("integer", "select_one lst"),
                        name = c("id", var), label = c("id", "X"),
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = "lst", name = as.character(1:4),
                         label = c("Muy mal", "Mal", "Bien", "Muy bien"),
                         stringsAsFactors = FALSE)
  )
  list(data = data, inst = inst)
}

# Captura los argumentos con los que se llamaria a `graficar_radar`, sin dibujar.
# Lo que estas pruebas cuidan es el cableado —que lo declarado LLEGUE al
# graficador—, no los pixeles: un arg que se guarda y nadie lee sale como si
# nunca se hubiera declarado.
.radar_mb_capturar_args <- function(datos, ...) {
  capturado <- NULL
  testthat::with_mocked_bindings(
    graficar_radar = function(...) { capturado <<- list(...); NULL },
    .radar_mb_grafico(datos, ...),
    .package = "prosecnurapp"
  )
  capturado
}

.radar_mb_capturar_render <- function(el, sources) {
  capturado <- NULL
  data_sources <- sources$data_sources
  instrument_sources <- sources$inst_sources
  testthat::with_mocked_bindings(
    graficar_radar = function(...) { capturado <<- list(...); NULL },
    .render_radar_publicos(el),
    .package = "prosecnurapp"
  )
  capturado
}

.rmb_sources <- function(...) {
  partes <- list(...)
  list(
    data_sources = lapply(partes, `[[`, "data"),
    inst_sources = lapply(partes, `[[`, "inst")
  )
}

test_that("el indicador es la suma de los codigos declarados sobre respuestas validas", {
  # 10 respuestas: cuatro 3, dos 4, dos 1 y dos vacias. El top-two-box (3+4) es
  # 6 de 8 VALIDAS = 75 %, no 6 de 10.
  src <- .rmb_sources(docentes = .rmb_fuente(c("3","3","3","3","4","4","1","1", NA, "")))

  d <- .radar_mb_datos(list(Tema = list("docentes$p1")), "3,4", src)

  expect_equal(nrow(d), 1L)
  expect_equal(d$valor[1], 75)
  # El denominador son las validas: un publico con mas no-respuesta saldria
  # artificialmente bajo y la comparacion dejaria de ser justa.
  expect_equal(d$n[1], 8L)
})

test_that("una serie por publico, en el orden declarado de los ejes", {
  src <- .rmb_sources(
    docentes    = .rmb_fuente(c("4","4","1","1")),
    estudiantes = .rmb_fuente(c("3","3","3","1"))
  )
  ejes <- list(
    Segundo = list("docentes$p1", "estudiantes$p1"),
    Primero = list("docentes$p1", "estudiantes$p1")
  )

  d <- .radar_mb_datos(ejes, "3,4", src)

  expect_equal(nrow(d), 4L)
  # Los ejes conservan el orden DECLARADO y no el alfabetico: un radar cuyo
  # poligono cambia de forma al reordenar seria ilegible entre laminas.
  expect_equal(levels(d$eje), c("Segundo", "Primero"))
  expect_setequal(levels(d$grupo), c("docentes", "estudiantes"))
  expect_equal(d$valor[d$grupo == "docentes"][1], 50)
  expect_equal(d$valor[d$grupo == "estudiantes"][1], 75)
})

test_that("un solo publico produce un radar de una linea, no un error", {
  # Lo que rompe la figura es el hueco, no el numero de series.
  src <- .rmb_sources(administrativos = .rmb_fuente(c("3","4","1","1","3")))
  d <- .radar_mb_datos(list(A = list("administrativos$p1")), "3,4", src)
  expect_equal(nlevels(d$grupo), 1L)
  expect_equal(d$valor[1], 60)
})

test_that("sin corte declarado no se dibuja nada y se dice por que", {
  src <- .rmb_sources(docentes = .rmb_fuente(c("3","4")))
  expect_error(.radar_mb_datos(list(A = list("docentes$p1")), "", src),
               class = "api_error")
  expect_error(.radar_mb_datos(list(), "3,4", src), class = "api_error")
})

test_that("los huecos se reportan en vez de rellenarse con cero", {
  # Rellenar con cero inventa un dato: la serie se cerraria por ese vertice y se
  # leeria como si ese tema puntuara cero en ese publico.
  src <- .rmb_sources(
    docentes    = .rmb_fuente(c("3","4")),
    estudiantes = .rmb_fuente(c("3","1"))
  )
  ejes <- list(
    Comun = list("docentes$p1", "estudiantes$p1"),
    Solo  = list("docentes$p1")
  )

  d <- .radar_mb_datos(ejes, "3,4", src)
  huecos <- .radar_mb_huecos(d)

  expect_length(huecos, 1L)
  expect_equal(huecos[[1]]$grupo, "estudiantes")
  expect_equal(unlist(huecos[[1]]$ejes), "Solo")
})

test_that("la etiqueta del indicador se deriva de las opciones elegidas", {
  opciones <- list(
    list(codigo = "1", etiqueta = "Totalmente en desacuerdo"),
    list(codigo = "3", etiqueta = "De acuerdo"),
    list(codigo = "4", etiqueta = "Totalmente de acuerdo"),
    list(codigo = "5", etiqueta = "SIN INF")
  )
  expect_equal(.radar_mb_etiqueta_corte("3,4", opciones),
               "De acuerdo + Totalmente de acuerdo")
  expect_equal(.radar_mb_etiqueta_corte("", opciones), "")
})

test_that("el elemento de plan exige ejes con nombre y un indicador", {
  # El nombre del eje ES la etiqueta del vertice: sin el, el radar sale con seis
  # puntas anonimas.
  expect_error(p_radar_publicos(vars = list(list("a$b")), corte = "3"),
               class = "api_error")
  expect_error(p_radar_publicos(vars = list(A = list("a$b")), corte = ""),
               class = "api_error")

  el <- p_radar_publicos(vars = list(A = list("docentes$p1")), corte = "3, 4",
                         corte_etiqueta = "T2B")
  expect_equal(el$.element_type, "radar_publicos")
  expect_equal(el$estilo, "comparativo")
  expect_true(el$mostrar_tabla)
  expect_equal(names(el$vars), "A")
})

test_that("el despacho del PPT encuentra el renderer por convencion de nombre", {
  # `reporte_plan_ppt.R` esta congelado a crecimiento: el radar se engancha
  # porque el despacho resuelve `.render_<etype>` con `inherits = TRUE`, no
  # porque se le haya anadido una rama.
  expect_true(exists(".render_radar_publicos", mode = "function"))
  expect_setequal(names(formals(.render_radar_publicos)), c("el", "preset_args"))
})

test_that("todos los estilos declarados producen argumentos validos", {
  fml <- names(formals(graficar_radar))
  for (clave in names(.RADAR_MB_ESTILOS)) {
    args <- .radar_mb_estilo_args(clave)
    desconocidos <- setdiff(names(args), fml)
    expect_equal(desconocidos, character(0),
                 info = paste("estilo", clave, "declara argumentos que el graficador no acepta"))
  }
  # Una clave inventada cae al estilo por defecto en vez de fallar: un plan viejo
  # con un estilo retirado sigue dibujando.
  expect_equal(.radar_mb_estilo_args("no_existe"), .radar_mb_estilo_args("comparativo"))
})

test_that("comparar publicos es un MODO del radar, no otro graficador", {
  # Para el analista sigue siendo «un radar»: lo unico que cambia es de donde
  # salen las series. Un graficador aparte partiria en dos una misma idea.
  reg <- .graficos_registry_payload()
  nombres <- vapply(reg$graficadores, function(g) g$name, character(1))
  expect_false("p_radar_publicos" %in% nombres)

  g <- Filter(function(x) identical(x$name, "p_radar"), reg$graficadores)[[1]]
  modos <- Filter(function(a) identical(a$name, "modo"), g$args)[[1]]$choices
  expect_true("publicos" %in% vapply(modos, function(c) c$value, character(1)))

  arg_estilo <- Filter(function(a) identical(a$name, "estilo"), g$args)[[1]]
  # El selector se deriva del catalogo del motor. Copiado a mano, un estilo
  # nuevo no aparece y uno retirado queda como opcion muerta que dibuja otra
  # cosa.
  expect_setequal(vapply(arg_estilo$choices, function(c) c$value, character(1)),
                  names(.RADAR_MB_ESTILOS))
  # `choices` viaja resuelto: si saliera como funcion, jsonlite la serializa
  # como `{}` y el selector llega vacio.
  expect_false(is.function(arg_estilo$choices))

  # Los cuatro controles del modo caen en «datos» porque el inspector v2
  # renderiza el slot de graficador con `mode="data"`: un arg fuera de ese grupo
  # se sirve pero no tiene donde salir en la UI.
  grupo_de <- function(n) Filter(function(a) identical(a$name, n), g$args)[[1]]$grupo
  for (a in c("corte", "corte_etiqueta", "estilo", "mostrar_tabla", "eje_min")) {
    expect_equal(grupo_de(a), "datos", info = a)
  }
  # Los controles de lectura valen para los TRES modos, asi que no dependen del
  # modo. `mostrar_valores` necesita ademas que el `datos` declarado gane sobre
  # la heuristica de nombre, que si no lo manda a «valores» — un grupo que el
  # inspector no renderiza para un slot de graficador.
  for (a in c("mostrar_valores", "valores_decimales")) {
    expect_equal(grupo_de(a), "datos", info = a)
    expect_null(Filter(function(x) identical(x$name, a), g$args)[[1]]$depende)
  }
})

test_that("p_radar(modo = publicos) construye el elemento multibase", {
  el <- p_radar(modo = "publicos", vars = list(A = list("docentes$p1")),
                corte = "3,4", corte_etiqueta = "T2B")
  expect_equal(el$.element_type, "radar_publicos")
  expect_equal(el$estilo, "comparativo")
  # Los otros dos modos siguen dando el radar de siempre.
  expect_equal(p_radar(modo = "box", vars = c("p1", "p2"),
                       box_labels = c("De acuerdo", "Totalmente de acuerdo"))$.element_type,
               "radar_tabla")
})

# ---------------------------------------------------------------------------
# Los tres controles de lectura: numeros, decimales y piso del eje.
# ---------------------------------------------------------------------------

test_that("los numeros en los vertices se piden y el umbral no los silencia", {
  # Sin bajar el umbral, `graficar_radar` deja mudo todo vertice por debajo de
  # 3 %, y quien pidio ver los numeros no entiende por que faltan algunos.
  d <- data.frame(eje = factor(c("A", "B")), grupo = factor(c("g", "g")),
                  valor = c(1.5, 80), n = c(100L, 100L))
  args <- .radar_mb_capturar_args(d, mostrar_valores = TRUE)
  expect_true(args$mostrar_valores)
  expect_equal(args$valores_umbral_pct, 0)

  # Sin declarar nada, manda el estilo.
  expect_false(.radar_mb_capturar_args(d)$mostrar_valores)
})

test_that("los decimales mandan sobre el vertice y sobre la tabla a la vez", {
  d <- data.frame(eje = factor(c("A", "B")), grupo = factor(c("g", "g")),
                  valor = c(98.04, 96.25), n = c(51L, 51L))
  expect_equal(.radar_mb_capturar_args(d, decimales = 0)$valores_decimales, 0L)

  # La tabla redondea con el MISMO numero: una celda que dice 98 con el valor
  # guardado en 98.04 es una cifra que no cuadra con el resto del informe.
  t0 <- .radar_mb_tabla(d, "T2B", decimales = 0)
  expect_equal(t0$g, c(98, 96))
  expect_equal(attr(t0, "decimales"), 0L)
  t1 <- .radar_mb_tabla(d, "T2B", decimales = 1)
  expect_equal(t1$g, c(98.0, 96.2))
  expect_equal(attr(t1, "decimales"), 1L)

  # Se acota en un solo sitio para que vertice y tabla no puedan discrepar.
  expect_equal(.radar_mb_decimales(-4), 0L)
  expect_equal(.radar_mb_decimales(99), 3L)
  expect_equal(.radar_mb_decimales("x"), 0L)
  # El defecto es 0 en las TRES puertas —constructor, tabla y formato— o la
  # celda y el vertice dicen cosas distintas.
  expect_equal(.radar_mb_decimales(NULL), 0L)
  expect_equal(attr(.radar_mb_tabla(d, "T2B"), "decimales"), 0L)
  expect_equal(p_radar_publicos(vars = list(A = list("a$b")), corte = "3")$decimales, 0L)
})

test_that("el piso del eje estira la banda alta sin recortar ningun dato", {
  d <- data.frame(eje = factor(c("A", "B")), grupo = factor(c("g", "g")),
                  valor = c(92.2, 98.0), n = c(51L, 51L))
  # `graficar_radar` toma los limites en escala 0-1.
  expect_equal(.radar_mb_capturar_args(d, eje_min = 50)$limites, c(0.5, 1))
  # Cero = eje completo, que sigue siendo el defecto.
  expect_equal(.radar_mb_capturar_args(d)$limites, c(0, 100))

  # Un piso por encima del valor mas bajo baja hasta el, y lo dice. Dejarlo
  # dibujaria ese 42 % en el centro del radar, donde se lee como cero.
  bajo <- data.frame(eje = factor(c("A", "B")), grupo = factor(c("g", "g")),
                     valor = c(42.3, 98.0), n = c(51L, 51L))
  expect_message(piso <- .radar_mb_piso(bajo, 50), "42.3")
  expect_equal(piso, 42.3)
  expect_silent(expect_equal(.radar_mb_piso(bajo, 40), 40))

  expect_equal(.radar_mb_eje_min(150), 99)
  expect_equal(.radar_mb_eje_min(-3), 0)
})

test_that("los tres controles viajan del elemento de plan al dibujo", {
  # El eslabon que se rompe callado: un arg que el constructor guarda pero el
  # renderer no lee sale como si nunca se hubiera declarado.
  el <- p_radar(modo = "publicos", vars = list(A = list("docentes$p1")),
                corte = "3,4", mostrar_valores = TRUE,
                valores_decimales = 0, eje_min = 50)
  expect_true(el$mostrar_valores)
  expect_equal(el$decimales, 0L)
  expect_equal(el$eje_min, 50)

  src <- .rmb_sources(docentes = .rmb_fuente(c("3", "4", "3", "1")))
  args <- .radar_mb_capturar_render(el, src)
  expect_true(args$mostrar_valores)
  expect_equal(args$valores_decimales, 0L)
  expect_equal(args$limites, c(0.5, 1))
})

# ---------------------------------------------------------------------------
# Lo que el radar muestra POR DEFECTO, y la tabla editable.
# ---------------------------------------------------------------------------

test_that("por defecto se ven los radios y no las cifras sobre la figura", {
  # La telarana se lee por su forma. Los radios del centro a cada punta son la
  # estructura que deja seguir un tema; los numeros del vertice y las etiquetas
  # de nivel son dos capas de cifras sobre esa forma, y la tabla al costado ya
  # da el dato exacto. Las dos se encienden desde la UI, pero no arrancan asi.
  a <- .radar_mb_estilo_args("comparativo")
  expect_true(a$mostrar_radios)
  expect_false(a$mostrar_valores)
  expect_false(a$mostrar_niveles)
  expect_true(a$mostrar_tela)

  # `auditoria` es el unico que si etiqueta los niveles: existe para revisar la
  # lectura del eje, no para presentar.
  expect_true(.radar_mb_estilo_args("auditoria")$mostrar_niveles)
})

test_that("los nombres de los temas no quedan pegados al poligono", {
  # El tope de 1.10 del graficador impedia pedir mas aire. Con seis ejes de
  # nombre largo, un 10 % dejaba «Costos y presupuestos» tocando la figura.
  expect_gt(.RADAR_MB_MARGENES$eje_label_mult, 1.10)
  expect_lt(.RADAR_MB_MARGENES$radar_scale, 1)
})

test_that("el encabezado de la tabla se escribe a mano y las columnas se renombran", {
  d <- data.frame(eje = factor(c("A", "B")), grupo = factor(c("docentes", "docentes")),
                  valor = c(98, 96), n = c(51L, 51L))
  tabla <- .radar_mb_tabla(d, "De acuerdo + Totalmente de Acuerdo")

  # El indicador NO entra en la celda: metido ahi se comia media tabla, y ademas
  # hace falta aunque la tabla este apagada. Va al subtitulo del grafico.
  expect_equal(.radar_mb_nombres_tabla(tabla)[1], "Tema")
  expect_equal(.radar_mb_capturar_args(d, indicador = "De acuerdo + Totalmente de Acuerdo")$subtitulo,
               "% De acuerdo + Totalmente de Acuerdo")
  expect_null(.radar_mb_capturar_args(d)$subtitulo)

  # Con titulo propio, manda el titulo.
  propio <- .radar_mb_nombres_tabla(tabla, titulo_tema = "Competencia")
  expect_equal(propio[1], "Competencia")

  # Las columnas de publico se renombran por clave; lo que no se nombra se queda.
  renom <- .radar_mb_nombres_tabla(tabla, encabezados = list(docentes = "Docentes"))
  expect_equal(renom[2], "Docentes")
  expect_equal(.radar_mb_nombres_tabla(tabla, encabezados = list(nadie = "X"))[2], "docentes")
})

test_that("los renombres se declaran como en las multiapiladas", {
  # Mismo formato que `titulos_grupo`: el analista no aprende una sintaxis nueva
  # por cambiar de graficador.
  expect_equal(.radar_mb_renombres("docentes=Docentes\negresados=Egresados"),
               list(docentes = "Docentes", egresados = "Egresados"))
  expect_equal(.radar_mb_renombres("  docentes = Docentes  "), list(docentes = "Docentes"))
  expect_equal(.radar_mb_renombres("sin igual"), list())
  expect_equal(.radar_mb_renombres(NULL), list())
})

test_that("los anchos de tabla se acotan a algo dibujable", {
  # La UI pide un porcentaje y el motor una fraccion; confundirlas dejaba la
  # primera columna en el 4500 % del ancho.
  expect_equal(.radar_mb_fraccion(45), 0.45)
  expect_equal(.radar_mb_fraccion(0.45), 0.45)
  # Por debajo de 0.2 el nombre del tema se parte en cinco lineas; por encima de
  # 0.8 las cifras se apelmazan contra el borde.
  expect_equal(.radar_mb_fraccion(95), 0.8)
  expect_equal(.radar_mb_fraccion(0.01), 0.2)
  # Todo lo mayor que 1 se lee como porcentaje, asi que un «5» es 5 % y sube al
  # minimo dibujable — no 500 %.
  expect_equal(.radar_mb_fraccion(5), 0.2)
  expect_true(is.na(.radar_mb_fraccion(NULL)))
  expect_equal(.radar_mb_proporcion(0.1), 0.3)
  expect_true(is.na(.radar_mb_proporcion("")))
})

test_that("los cuatro controles de tabla viajan del elemento al compositor", {
  el <- p_radar(modo = "publicos", vars = list(A = list("docentes$p1")), corte = "3,4",
                tabla_titulo = "Competencia",
                tabla_encabezados = "docentes=Docentes",
                tabla_ancho_tema = 45, tabla_proporcion = 1.4)
  expect_equal(el$tabla_titulo, "Competencia")
  expect_equal(el$tabla_encabezados, list(docentes = "Docentes"))
  expect_equal(el$tabla_ancho_tema, 0.45)
  expect_equal(el$tabla_proporcion, 1.4)
})
