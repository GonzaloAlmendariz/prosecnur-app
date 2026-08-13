source("setup-load-all.R")

# ¿Cada parte respeta su negrita de forma independiente, en todos los
# graficadores? La auditoría encontró dos mandos que existían y no hacían nada:
# el título del boxplot iba en negrita FIJA y el subtítulo en plana fija, y los
# títulos de bloque de las multiapiladas en negrita fija. La UI ofrecía los tres.

test_that("una parte declarada por el registro la consulta su graficador", {
  # El aserto que habría atrapado los dos casos: un token en el multiflag que
  # el motor nunca mira es un interruptor que miente.
  ns <- asNamespace("prosecnurapp")
  presets <- get(".PRESETS_META", envir = ns)
  mapa <- list(
    barras_apiladas    = "graficar_barras_apiladas",
    multi_apiladas     = "graficar_barras_apiladas",
    barras_agrupadas   = "graficar_barras_agrupadas",
    pie                = "graficar_pie",
    donut              = "graficar_pie",
    radar_tabla        = "graficar_radar",
    boxplot            = "graficar_boxplot"
  )
  revisados <- 0L
  for (k in names(mapa)) {
    a <- Filter(function(x) identical(x$name, "textos_negrita"), presets[[k]]$args %||% list())
    if (!length(a)) next
    tokens <- vapply(a[[1]]$opciones %||% list(),
                     function(o) as.character(o$value %||% o)[1], character(1))
    f <- get0(mapa[[k]], envir = ns)
    if (is.null(f)) next
    src <- paste(deparse(f), collapse = "\n")
    # Un token puede consultarse por su nombre literal o a través de un helper
    # compartido. Cuando la regla del subtítulo salió a `.graficos_face_subtitulo()`
    # este aserto lo dio por muerto: la cadena `"subtitulo"` desapareció del
    # motor aunque el mando funciona —lo prueba el test de render—. Un aserto
    # que confunde «extraído» con «muerto» acusa en falso.
    helpers <- c(subtitulo = ".graficos_face_subtitulo")
    consulta <- function(t) {
      grepl(paste0('"', t, '"'), src, fixed = TRUE) ||
        (t %in% names(helpers) && grepl(helpers[[t]], src, fixed = TRUE))
    }
    sin_consultar <- tokens[!vapply(tokens, consulta, logical(1))]
    expect_equal(sin_consultar, character(0),
                 info = sprintf("%s declara partes que su motor no mira: %s",
                                k, paste(sin_consultar, collapse = ", ")))
    revisados <- revisados + 1L
  }
  # El control: si el mapa quedara vacío por un cambio de nombres, el bucle no
  # comprobaría nada y el test pasaría en verde sin medir.
  expect_gt(revisados, 5L)
})

test_that("sin declaración, una parte va en plana", {
  # Hubo una regla de «legado» que conservaba la negrita anterior cuando no
  # había declaración. Era una muleta del ADR 0074: existía porque el motor no
  # podía distinguir «nadie lo declaró» de «alguien declaró el default». Con el
  # `.pulso` guardando sólo decisiones, la duda desaparece.
  expect_equal(.graficos_face_legado(NULL, "titulo"), "plain")
  expect_equal(.graficos_face_legado(character(0), "titulo"), "plain")
  # Y el `legado` de la firma ya no manda nada, aunque se pase.
  expect_equal(.graficos_face_legado(NULL, "titulo", "bold"), "plain")
})

test_that("la declaración manda, y sólo sobre su parte", {
  expect_equal(.graficos_face_legado("titulo", "titulo"), "bold")
  expect_equal(.graficos_face_legado("titulo", "subtitulo"), "plain")
  expect_equal(.graficos_face_legado("subtitulo", "titulo"), "plain")
  # El control: si la función devolviera siempre lo mismo, los tres pasarían.
  expect_false(identical(.graficos_face_legado("titulo", "titulo"),
                         .graficos_face_legado("titulo", "subtitulo")))
})

test_that("las partes reparadas ya no llevan la negrita escrita a fuego", {
  # No se mide sobre el objeto renderizado a propósito: estos textos los dibuja
  # el canvas de cowplot, y `p$layers` no expone sus `fontface` —devuelve lo
  # mismo con el interruptor encendido y apagado, que es un aserto que no
  # distingue el caso bueno del malo. Se mide donde la decisión se toma.
  leer <- function(f) paste(readLines(file.path("..", "..", "R", f), warn = FALSE), collapse = "\n")

  apiladas <- readLines(file.path("..", "..", "R", "graficador_barras_apiladas.R"), warn = FALSE)
  ancla <- grep("colour   = color_titulos_grupo", apiladas, fixed = TRUE)
  expect_length(ancla, 1L)
  bloque <- paste(apiladas[ancla:(ancla + 5L)], collapse = "\n")
  expect_false(grepl('fontface = "bold"', bloque, fixed = TRUE))
  expect_true(grepl(".graficos_face_legado", bloque, fixed = TRUE))

  boxplot <- leer("graficador_boxplot.R")
  # El panel de texto del boxplot recibe su cara desde fuera; antes la tenía
  # escrita dentro.
  expect_false(grepl('fontface = "bold", colour = col_top', boxplot, fixed = TRUE))
  expect_true(grepl("face_top = .graficos_face_legado", boxplot, fixed = TRUE))
  # El control: el fichero SÍ conserva negritas fijas legítimas —el chip de la
  # media—, así que el aserto no está pasando por ausencia de la cadena.
  expect_true(grepl('fontface = "bold"', boxplot, fixed = TRUE))
})
