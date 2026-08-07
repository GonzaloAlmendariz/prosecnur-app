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
  for (a in c("corte", "corte_etiqueta", "estilo", "mostrar_tabla")) {
    expect_equal(grupo_de(a), "datos", info = a)
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
