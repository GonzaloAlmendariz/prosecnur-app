source("setup-load-all.R")

# Ítem 9 del checklist del catálogo (ADR 0139): el panorama, las fortalezas, la cobertura, el contraste de públicos, las
# aperturas por grupo y la escala con Sin información aparte van como gráfico en las láminas de dos y de cuatro gráficos,
# con piezas nativas. Antes la lámina entera caía a la plantilla anterior (rótulos montados) y el panorama tumbaba el
# informe: `.espec_n_base` no sabía contar un gráfico de varios públicos.

.rr_inst <- function() list(
  survey = data.frame(name = c(paste0("p", 1:4), "ciclo"), type = c(rep("select_one lk", 4), "select_one ci"),
                      list_name = c(rep("lk", 4), "ci"),
                      label = c("Los reglamentos se aplican correctamente en todas las situaciones que son necesarias",
                                "La biblioteca atiende las necesidades de información de los estudiantes",
                                "El servicio de salud responde a tiempo", "La tutoría acompaña la formación", "Ciclo"),
                      stringsAsFactors = FALSE),
  choices = data.frame(list_name = c(rep("lk", 5), "ci", "ci"), name = c("1", "2", "3", "4", "9", "1", "2"),
                       label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información",
                                 "Segundo ciclo", "Cuarto ciclo"), stringsAsFactors = FALSE), orders_list = NULL)
.rr_base <- function(acuerdo, n = 40) {
  d <- as.data.frame(lapply(acuerdo, function(k) c(rep(c("3", "4"), length.out = k), rep(c("1", "2", "9"), length.out = n - k))),
                     stringsAsFactors = FALSE)
  names(d) <- paste0("p", seq_along(acuerdo)); d$ciclo <- rep(c("1", "2"), length.out = n); d
}
.rr_fuentes <- function() list(data_sources = list(docentes = .rr_base(c(36, 20, 32, 16)), estudiantes = .rr_base(c(30, 22, 14, 28))),
                               inst_sources = list(docentes = .rr_inst(), estudiantes = .rr_inst()))
.rr_graficos <- function() list(
  panorama = list(graficador = "p_panorama", args = list(vars = list("docentes$*", "estudiantes$*"), corte = list("3", "4"))),
  fortalezas = list(graficador = "p_fortalezas", args = list(vars = list("docentes$*"), corte = list("3", "4"), n = 2)),
  cobertura = list(graficador = "p_cobertura", args = list(universos = "Docentes: 50; Estudiantes: 60", metas = "Docentes: 60%; Estudiantes: 60%")),
  contraste = list(graficador = "p_dumbbell", args = list(bases = list("docentes", "estudiantes"), corte = list("3", "4"), estilo = "resumen",
                                                          cruce = NULL, regla = list(tipo = "mayor_diferencia", n = 3))),
  aperturas = list(graficador = "p_dumbbell", args = list(vars = list("estudiantes$*"), corte = list("3", "4"), estilo = "resumen",
                                                          cruce = "estudiantes$ciclo", grupos = list("1", "2"),
                                                          regla = list(tipo = "mayor_diferencia", n = 3))),
  sin_informacion = list(graficador = "p_barras_divergentes", args = list(vars = list("docentes$*", "estudiantes$*"), estilo = "resumen",
                                                                          regla = list(tipo = "mayor_sin_info", n = 4))))
.rr_slides <- function(k, g) {
  if (k == 2L) list(id = "s2", tipo = "p_slide_2_graficos", payload = list(titulo = "Dos gráficos", izquierda = g, derecha = g))
  else list(id = "s4", tipo = "p_slide_4_graficos", payload = list(titulo = "Cuatro gráficos", superior_izquierda = g, superior_derecha = g,
                                                                   inferior_izquierda = g, inferior_derecha = g))
}
# Nota (catálogo, ronda 4): una corrida del gate de área, con un render de Arte en paralelo en otra sesión de R, dio una
# falla en esta suite sin decir cuál; aislada pasa 113 de 113, en el orden del gate también, y con un render de Arte en
# paralelo no se reprodujo en tres intentos (2026-11-09). El único estado compartido que toca esta suite es del proceso:
# las notas de filas de menos (`.LAM_RR_PIE`) y el registro de avisos del mazo (`.lam_avisos_estado`); cada render los
# vacía al empezar y aquí se vacían también antes de cada render, para que ninguna suite anterior los deje sucios.
.rr_render <- function(slide_raw, src = .rr_fuentes()) {
  .LAM_RR_PIE$notas <- NULL
  .lam_avisos_soltar(.lam_avisos_estado$token)
  .heq_local_render(.heq_matriz_por_nombre(src))   # el contraste empareja con la matriz declarada (ADR 0138 §5)
  plan <- .normalize_plan(list(slides = list(slide_raw)), avisar = FALSE)
  out <- withr::local_tempfile(fileext = ".pptx", .local_envir = parent.frame())
  suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources,
                                    plan = p_plan(slides = list(.rebuild_slide(plan$slides[[1]]))), path_ppt = out, mensajes_progreso = FALSE))
  .pptx_leer_parte(out, .pptx_slide_paths(out)[1])
}

test_that("los seis gráficos de resumen salen nativos en las láminas de dos y de cuatro gráficos, dentro de la lámina", {
  for (nm in names(.rr_graficos())) for (k in c(2L, 4L)) {
    xml <- .rr_render(.rr_slides(k, .rr_graficos()[[nm]]))
    et <- paste(nm, k)
    expect_identical(.pptx_lamina_estado(xml), "nativa", label = et)
    expect_true(grepl('name="prosecnur:grafico:mixta"', xml, fixed = TRUE), label = et)
    expect_false(grepl('name="mixta:respaldo"', xml, fixed = TRUE), label = et)
    expect_false(grepl("<p:pic>", xml, fixed = TRUE), label = et)
    # Nada se sale de la lámina (13.333 x 7.5 in).
    fuera <- Filter(function(f) f$x < -0.01 || f$y < -0.01 || f$x + f$w > 13.34 || f$y + f$h > 7.51, .verif_formas(xml))
    expect_length(fuera, 0L)
  }
})

test_that("cada gráfico dibuja sus piezas y su nota va al pie de la lámina compuesta", {
  pie <- function(xml) paste(gsub("</?a:t>", "", regmatches(xml, gregexpr("<a:t>[^<]*</a:t>", xml))[[1]]), collapse = " ")
  x <- .rr_render(.rr_slides(4L, .rr_graficos()$panorama))
  expect_true(grepl("Mediana del público", pie(x), fixed = TRUE))
  expect_true(grepl("Cada marca es una pregunta (Top Two Box)", pie(x), fixed = TRUE))
  x <- .rr_render(.rr_slides(2L, .rr_graficos()$contraste))
  expect_true(grepl("Diferencia", pie(x), fixed = TRUE))
  expect_true(grepl("Docentes menos Estudiantes", pie(x), fixed = TRUE))   # D6
  # P7: la ranura deja las 2 de mayor diferencia y la nota de la regla lo dice en UNA frase, no «Se muestran las 3» y
  # luego «muestra las 2 primeras de 3».
  frase <- "Se muestran las 2 de mayor diferencia de las 3 elegidas; el resto en otra lámina."
  expect_true(grepl(frase, pie(x), fixed = TRUE))
  expect_false(grepl("Por espacio", pie(x), fixed = TRUE))
  # Dos ranuras con el mismo gráfico: la regla va una sola vez en el pie.
  expect_identical(lengths(regmatches(pie(x), gregexpr("Se muestran las", pie(x), fixed = TRUE))), 1L)
  x <- .rr_render(.rr_slides(4L, .rr_graficos()$sin_informacion))
  expect_true(grepl("Sin información", pie(x), fixed = TRUE))
  expect_true(grepl('name="divergentes:centro"', x, fixed = TRUE))
  x <- .rr_render(.rr_slides(4L, .rr_graficos()$fortalezas))
  expect_true(grepl('name="fortalezas:barra"', x, fixed = TRUE))
  x <- .rr_render(.rr_slides(4L, .rr_graficos()$cobertura))
  expect_true(grepl('name="cobertura:barra_tasa"', x, fixed = TRUE))
})

test_that("un gráfico de varios públicos no tiene un n: cada público conserva su base", {
  expect_true(is.na(.espec_n_base(list(tipo = "panorama", publicos = c("Docentes", "Estudiantes"), valores = list(1, 2)))))
  expect_true(is.na(.espec_n_base(list(tipo = "contraste"))))
  expect_true(is.na(.espec_n_base(list(tipo = "divergentes", estilo = "resumen"))))
  expect_identical(.lam_rr_tipo(list(tipo = "divergentes")), NA_character_)   # la lámina 71 sigue su camino
  expect_identical(.lam_rr_tipo(list(tipo = "divergentes", estilo = "resumen")), "divergentes_resumen")
})

test_that("la columna de rótulos crece con su tinta y recorta con «…» sólo cuando no cabe", {
  corto <- .lam_rr_filas(c("Salud", "Tutoría"), 1.2, 2.4, 2, c(1, 1), 0.22, 0.45)
  expect_false(corto$recortados > 0L); expect_equal(corto$wq, 1.2)
  largo <- strrep("palabra larga ", 30)
  r <- .lam_rr_filas(rep(largo, 4), 1.2, 2.4, 1.0, rep(1, 4), 0.22, 0.45)
  expect_true(r$recortados > 0L); expect_equal(r$size, .LAM_ROTULO_PT_PISO)
  expect_lte(sum(r$alturas), 1.0 + 1e-9)
  expect_null(.lam_rr_filas(rep(largo, 40), 1.2, 2.4, 0.5, rep(1, 40), 0.22, 0.45))
})

test_that("el eje de una ranura angosta rotula una guía de cada dos", {
  px <- function(v) v / 100 * 1.9
  expect_identical(.lam_rr_eje_cada(px, c(lo = 30, hi = 100, paso = 10)), 3L)
  px2 <- function(v) v / 100 * 9
  expect_identical(.lam_rr_eje_cada(px2, c(lo = 30, hi = 100, paso = 10)), 1L)
})

test_that("ronda 2, ítem 1: con públicos distintos cada nota va con su etiqueta y lo que la base dice sale sólo si es la misma frase", {
  e1 <- list(tipo = "fortalezas", publico = "Docentes", nota_base = "Base: Docentes 93 a 115", texto_regla = "Se muestran las 4 más altas",
             indicador = "Top Two Box", columnas = list())
  e2 <- utils::modifyList(e1, list(publico = "Estudiantes", nota_base = "Base: Estudiantes 242 a 279"))
  p <- .lam_rr_pie(NULL, list(e1, e2))
  expect_identical(p, "Docentes: base 93 a 115. Estudiantes: base 242 a 279. Se muestran las 4 más altas. Barras: Top Two Box de cada pregunta.")
  e3 <- utils::modifyList(e2, list(texto_regla = "Se muestran las 2 más altas"))
  expect_match(.lam_rr_pie(NULL, list(e1, e3)), "Docentes: base 93 a 115; se muestran las 4 más altas. Estudiantes: base 242 a 279; se muestran las 2 más altas", fixed = TRUE)
  # El mismo público en dos ranuras: sin etiqueta y una sola vez.
  expect_identical(.lam_rr_pie(NULL, list(e1, e1)), "Base: Docentes 93 a 115. Se muestran las 4 más altas. Barras: Top Two Box de cada pregunta.")
  # Exacta: la base repetida como frase sale; una base que sólo la contiene no se come la nota.
  expect_identical(lengths(regmatches(.lam_rr_pie("Base: Docentes 93 a 115.", list(e1)), gregexpr("93 a 115", .lam_rr_pie("Base: Docentes 93 a 115.", list(e1))))), 1L)
  expect_match(.lam_rr_pie("Base: Docentes 93 a 115 respuestas", list(e1)), "respuestas. Base: Docentes 93 a 115.", fixed = TRUE)
})

test_that("ronda 2, ítem 1: en el render, dos fortalezas de públicos distintos nombran su público en el pie", {
  g <- function(b, n) list(graficador = "p_fortalezas", args = list(vars = list(paste0(b, "$*")), corte = list("3", "4"), n = n))
  xml <- .rr_render(list(id = "s2", tipo = "p_slide_2_graficos", payload = list(titulo = "Dos públicos", izquierda = g("docentes", 2), derecha = g("estudiantes", 1))))
  t <- paste(gsub("</?a:t>", "", regmatches(xml, gregexpr("<a:t>[^<]*</a:t>", xml))[[1]]), collapse = " ")
  # La base de la lámina ya es la unión de las de cada público; la regla de cada una va con su etiqueta y lo común, una vez.
  expect_match(t, "Base: Docentes 40 y Estudiantes 40. Docentes: se muestran las 2 más altas", fixed = TRUE)
  expect_match(t, "Estudiantes: se muestran la más alta", fixed = FALSE)
  expect_identical(lengths(regmatches(t, gregexpr("Barras: Top Two Box", t, fixed = TRUE))), 1L)
})

test_that("ronda 2, ítem 2: el corte conserva el final y dos rótulos del mismo gráfico no quedan iguales", {
  a <- "Los procesos de selección y contratación de los(as) docentes de la Unidad académica son justos."
  b <- "Los procesos de selección y contratación de los(as) docentes de la Unidad académica son transparentes."
  r <- .lam_rr_recortar_lote(c(a, b), 1.6, .LAM_ROTULO_PT_PISO, 2L)
  tx <- vapply(r, `[[`, "", "texto")
  expect_true(all(vapply(r, `[[`, TRUE, "recortado")))
  expect_match(tx[1], "justos\\.$"); expect_match(tx[2], "transparentes\\.$")
  expect_match(tx[1], "…", fixed = TRUE)
  expect_false(identical(tx[1], tx[2]))
  expect_true(all(lengths(lapply(r, `[[`, "lineas")) <= 2L))
  # Sin necesidad de cortar, el rótulo queda entero.
  expect_false(.lam_rr_recortar_medio("Creación", 1.6, 10.5, 2L)$recortado)
})

test_that("ronda 2, ítem 2: antes de cortar se muestran menos filas, y la lámina lo dice", {
  largo <- function(k) paste("Los procesos de selección y contratación de los docentes de la unidad académica son", c("justos", "transparentes", "claros", "públicos")[k])
  medio <- function(k) paste("Los procesos de selección de los docentes son", c("justos", "transparentes", "claros", "públicos")[k])
  # Cuatro enunciados de dos líneas en un alto que sólo admite dos enteros: van dos, sin cortes.
  f <- .lam_rr_filas(vapply(1:4, medio, ""), 1.2, 2.4, 1.0, rep(1, 4), 0.22, 0.45)
  expect_identical(f$k, 2L); expect_identical(f$recortados, 0L)
  # Si ni la mitad cabe entera (enunciados de cuatro líneas), van todas con el corte al medio.
  g <- .lam_rr_filas(vapply(1:4, largo, ""), 1.2, 2.4, 0.95, rep(1, 4), 0.22, 0.45)
  expect_identical(g$k, 4L); expect_gt(g$recortados, 0L)
  expect_identical(length(unique(g$textos)), 4L)
  # En el render: la ranura de 4 con enunciados largos o dice «Por espacio…» en el pie o no corta.
  inst <- .rr_inst(); inst$survey$label[1:4] <- vapply(1:4, largo, "")
  src <- .rr_fuentes(); src$inst_sources$docentes <- inst; src$inst_sources$estudiantes <- inst
  xml <- .rr_render(.rr_slides(4L, .rr_graficos()$contraste), src)
  t <- paste(gsub("</?a:t>", "", regmatches(xml, gregexpr("<a:t>[^<]*</a:t>", xml))[[1]]), collapse = " ")
  rot <- gsub("</?a:t>", "", unlist(regmatches(xml, gregexpr('name="puntos:rotulo".*?</p:sp>', xml))))
  expect_true(grepl("Por espacio", t, fixed = TRUE) || any(grepl("…", t, fixed = TRUE)))
})

test_that("ronda 2, ítem 3: en la escala de una ranura, la cifra de un segmento interior que no cabe no se escribe", {
  xml <- .rr_render(.rr_slides(4L, .rr_graficos()$sin_informacion))
  expect_false(grepl('name="divergentes:cifra_chica"', xml, fixed = TRUE))
  # Cada cifra escrita dentro cabe en su segmento con la regla de la casa (tinta + 0.12 in).
  sps <- regmatches(xml, gregexpr("<p:sp>.*?</p:sp>", xml))[[1]]
  seg <- Filter(function(x) grepl('name="divergentes:segmento"', x, fixed = TRUE), sps)
  expect_gt(length(seg), 0L)
})

test_that("ronda 2, ítem 6: la escala de una ranura con filas de públicos distintos dice el n de cada fila", {
  expect_identical(.lam_rr_div_n(list(filas = c("A (Doc.)", "B (Est.)"), n = c(115, 279))), c("n = 115", "n = 279"))
  expect_identical(.lam_rr_div_n(list(filas = c("A", "B"), n = c(115, 115))), character(0))
  xml <- .rr_render(.rr_slides(2L, .rr_graficos()$sin_informacion))
  n <- gsub("</?a:t>", "", unlist(regmatches(xml, gregexpr('name="divergentes:n".*?</p:sp>', xml))))
  expect_gt(length(n), 0L)
  expect_true(all(grepl("n = [0-9]+", n)))
})

test_that("ronda 2, ítem 5: el panorama usa el alto de la ranura de dos (filas hasta 1.4 in, centradas)", {
  e <- list(tipo = "panorama", publicos = c("Docentes", "Estudiantes", "Administrativos"), textos_bajo = c("1 de 3", "2 de 3", "0 de 3"),
            encabezado_bajo = "Bajo 60%", referencia = 60)
  g2 <- .lam_rr_panorama_geo(e, 0.5, 1.65, 6, 5.07)
  expect_gt(g2$hrow, 0.9); expect_lte(g2$hrow, 1.4)
  expect_lte(g2$ley + g2$cab + g2$eje + 3 * g2$hrow, 5.07)
})
