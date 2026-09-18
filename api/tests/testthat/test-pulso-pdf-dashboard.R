# El kit de dashboard del sistema Pulso PDF.
#
# Se prueban las REGLAS, no el trazo: lo que decide una altura, una escala o un
# override. Las tres regresiones de aquí abajo salieron de defectos que el
# código no señalaba y que sólo se veían mirando el PDF renderizado.

test_that("la cuota se marca dentro de la barra solo cuando se supero", {
  # Gonzalo, 2026-09-18: «no creo que deba pintarse de verde, sino se pinta del
  # mismo color pero la línea negra marca la meta y diferencia el resto de la
  # barra, que es exceso». Revierte el recorte al 100 % del 2026-09-11, que
  # dejaba 115 % y 250 % con la misma barra llena.
  expect_true(prosecnurapp:::.ppd_marca_de_cuota(0.30, 0.20))
  # Sin superarla la cuota ya se ve como contorno hueco: marcarla otra vez
  # dentro del relleno seria decir dos veces lo mismo.
  expect_false(prosecnurapp:::.ppd_marca_de_cuota(0.12, 0.20))
  expect_false(prosecnurapp:::.ppd_marca_de_cuota(0.20, 0.20))
  # Sin meta no hay cuota que marcar.
  expect_false(prosecnurapp:::.ppd_marca_de_cuota(0.30, NA_real_))
  expect_false(prosecnurapp:::.ppd_marca_de_cuota(0.30, 0))
})

test_that("el eje se redondea a pasos legibles y siempre cubre el maximo", {
  eje <- prosecnurapp:::.ppd_eje_bonito(1063)
  expect_true(max(eje) >= 1063)
  expect_equal(eje[[1L]], 0)
  expect_true(length(unique(diff(eje))) == 1L)
  expect_equal(max(prosecnurapp:::.ppd_eje_bonito(0)), 1)
})

test_that("la portada es un override opt-in: lo escrito gana, lo vacio no borra", {
  defectos <- list(titulo = "Avance del trabajo de campo", subtitulo = "Cursos-horario",
                   cliente = "", periodo = "Del 07 al 09 de septiembre", corte = "09/09", nota = "")
  out <- pulso_pdf_portada_normalizar(defectos, list(cliente = "PUCP", titulo = "  "))
  expect_equal(out$cliente, "PUCP")
  # Un campo en blanco NO pisa al defecto: se conserva lo que el motor derivo.
  expect_equal(out$titulo, "Avance del trabajo de campo")
  expect_equal(out$periodo, "Del 07 al 09 de septiembre")
  # Todos los campos existen siempre, aunque nadie los haya escrito.
  expect_setequal(names(out), c("titulo", "subtitulo", "cliente", "periodo", "corte", "nota"))
  expect_true(all(vapply(out, function(v) is.character(v) && length(v) == 1L, logical(1))))
})

test_that("pulso_pdf_abrir usa la geometria del kit y no el defecto de 7x7", {
  # La regresion: el reporte pedia `geo$w_in`/`geo$h_in`, que no existen, y
  # `pdf()` caia en silencio a 7x7 pulgadas. El documento salia cuadrado y el
  # «apaisado» no era apaisado. Se mide sobre el MediaBox del archivo.
  destino <- tempfile(fileext = ".pdf")
  pulso_pdf_abrir(destino, geo = pulso_pdf_geo("landscape"))
  grid::grid.newpage()
  grid::grid.text("x")
  grDevices::dev.off()

  # En BYTES: un PDF trae binario y `readLines()` revienta al traducirlo.
  bytes <- readBin(destino, "raw", file.size(destino))
  bytes <- bytes[bytes != as.raw(0)]   # el nul incrustado rompe rawToChar()
  crudo <- rawToChar(bytes)
  caja <- regmatches(crudo, regexpr("/MediaBox *\\[[^]]+\\]", crudo, useBytes = TRUE))
  expect_true(length(caja) == 1L)
  numeros <- as.numeric(strsplit(gsub("[^0-9. ]", " ", caja), " +")[[1L]])
  numeros <- numeros[is.finite(numeros) & numeros > 0]
  expect_equal(round(max(numeros)), 841)   # 11,69 pulgadas de ancho
  expect_equal(round(min(numeros)), 595)   # 8,27 de alto
  expect_true(max(numeros) > min(numeros)) # apaisado, no cuadrado

  geo_rota <- list(page_w = NULL, page_h = NULL)
  expect_error(pulso_pdf_abrir(tempfile(fileext = ".pdf"), geo = geo_rota), "page_w")
})

test_that("los colores de sexo del PDF son los mismos que los de la pantalla", {
  # Si divergen, el documento contradice a la herramienta con la que se hizo.
  tok <- pulso_pdf_tokens()
  expect_equal(tolower(tok$sexo_h), "#4a6eb6")  # --pulso-module-dashboard
  expect_equal(tolower(tok$sexo_m), "#c2416b")  # --pulso-accent-rose
})

test_that("el sistema tiene UN cuerpo por rol y TRES pesos de regla", {
  # La regresión: el documento acumuló cuatro cuerpos distintos para el mismo
  # rol —5,8 · 6,0 · 6,2 · 6,4 en versalitas— y OCHO pesos de regla para tres
  # funciones. Cada valor se eligió razonablemente en su momento; juntos hacen
  # que dos tablas de la misma hoja no se parezcan.
  for (escala in c("tecnica", "cliente")) {
    ty <- pulso_pdf_type(escala)
    expect_true(all(c("title", "subtitle", "section", "body", "code", "footer",
                      "caption", "eyebrow") %in% names(ty)))
    expect_true(all(vapply(ty, function(v) is.numeric(v) && v > 0, logical(1))))
  }
  # La escala de cliente es MAYOR en todos los roles: si algún día empata o baja,
  # es que alguien tocó una y no la otra.
  tec <- pulso_pdf_type("tecnica"); cli <- pulso_pdf_type("cliente")
  for (k in names(tec)) expect_gt(cli[[k]], tec[[k]])

  pesos <- pulso_pdf_pesos()
  expect_setequal(names(pesos), c("fila", "columna", "bloque", "acento"))
  # De más fina a más gruesa, en el orden de su jerarquía.
  expect_lt(pesos$fila, pesos$columna)
  expect_lt(pesos$columna, pesos$bloque)
  expect_lt(pesos$bloque, pesos$acento)
})

test_that("las versalitas retiran el aire antes de salirse de su caja", {
  # «CURSOS-HORARIO APLICADOS» espaciado no cabe en una tarjeta de KPI; sin
  # medir, se salía por el borde derecho.
  largo <- "Cursos-horario aplicados"
  expect_true(grepl(" ", pulso_pdf_versalitas(largo), fixed = TRUE))
  apretado <- pulso_pdf_versalitas(largo, ancho = 0.10, fontsize = 6.6)
  expect_equal(apretado, toupper(largo))
  holgado <- pulso_pdf_versalitas("Faltan", ancho = 0.10, fontsize = 6.6)
  expect_true(grepl("F A L T A N", holgado, fixed = TRUE))
  # Sin caja declarada, el comportamiento de siempre.
  expect_true(grepl(" ", pulso_pdf_versalitas(largo, ancho = NULL), fixed = TRUE))
})

# --- Accesibilidad -----------------------------------------------------------

.contraste_wcag <- function(a, b) {
  lum <- function(hex) {
    canal <- grDevices::col2rgb(hex)[, 1] / 255
    f <- function(c) if (c <= 0.03928) c / 12.92 else ((c + 0.055) / 1.055)^2.4
    0.2126 * f(canal[[1]]) + 0.7152 * f(canal[[2]]) + 0.0722 * f(canal[[3]])
  }
  la <- lum(a); lb <- lum(b)
  (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
}

test_that("todo color de TEXTO llega al 4,5:1 de WCAG AA sobre blanco", {
  # `faint` estaba en 3,15:1 y es el color de casi todos los rótulos pequeños
  # del documento —encabezados de columna, ejes, antetítulos— a 5,8 y 7,4 pt,
  # que no son «texto grande» por ningún criterio.
  tok <- pulso_pdf_tokens()
  for (rol in c("navy", "ink", "soft", "faint", "sexo_h", "sexo_m", "success", "danger")) {
    expect_gte(.contraste_wcag(tok[[rol]], "#ffffff"), 4.5)
  }
  # Y el blanco sobre la banda navy de la portada.
  expect_gte(.contraste_wcag(tok$sobre_navy, tok$navy), 4.5)
})

test_that("los dos colores de sexo son el MISMO gris, y por eso nada puede depender solo de ellos", {
  # Esto no es un fallo que corregir en el token —son la identidad de la app en
  # pantalla—: es la razón por la que el gráfico de metas escribe la inicial de
  # cada serie bajo su carril. La prueba fija el hecho para que nadie retire esa
  # inicial creyendo que el color basta.
  tok <- pulso_pdf_tokens()
  gris <- function(hex) {
    canal <- grDevices::col2rgb(hex)[, 1] / 255
    0.2126 * canal[[1]] + 0.7152 * canal[[2]] + 0.0722 * canal[[3]]
  }
  expect_lt(abs(gris(tok$sexo_h) - gris(tok$sexo_m)), 0.10)
})

test_that("las barras del dia se cuentan entre ellas, no entre las jornadas", {
  # Gonzalo, 2026-09-18: «las barras siguen sin números». El salto se calculaba
  # sobre las jornadas del calendario, asi que en un panel de 11 dias con 5
  # barras reales las de indice par salian mudas — aunque cabian todas.
  once_dias <- c(101, 0, 66, 0, 39, 0, 37, 0, 69, 0, 37)   # 6 barras de 11 dias
  expect_equal(prosecnurapp:::.ppd_rotulos_de_barras(once_dias, 6L),
               c(1L, 3L, 5L, 7L, 9L, 11L))
  # El defecto que esto mata: con la regla vieja, una barra en dia PAR no se
  # rotulaba nunca. Aqui las tres barras existen en dias pares y las tres hablan.
  pares <- c(0, 19, 0, 0, 0, 12, 0, 6, 0, 0, 0)
  expect_equal(prosecnurapp:::.ppd_rotulos_de_barras(pares, 6L), c(2L, 6L, 8L))
  # Cuando NO caben, una de cada tantas y siempre la ultima.
  muchas <- rep(5, 12)
  got <- prosecnurapp:::.ppd_rotulos_de_barras(muchas, 6L)
  expect_lte(length(got), 7L)
  expect_true(12L %in% got)
  # Un panel sin una sola efectiva no rotula nada.
  expect_equal(prosecnurapp:::.ppd_rotulos_de_barras(rep(0, 5), 6L), integer(0))
  expect_equal(prosecnurapp:::.ppd_rotulos_de_barras(c(NA, NA), 6L), integer(0))
})

test_that("cuantas cifras caben lo decide el ancho, no un tope fijo", {
  # El tope fijo de seis silenciaba barras aunque sobrara papel: un panel de
  # facultad con once barras de dos o tres digitos las admite todas.
  once <- c(55, 150, 35, 29, 89, 32, 14, 13, 24, 31, 28)
  caben <- prosecnurapp:::.ppd_cifras_que_caben(once, 0.42, 5.8)
  expect_gte(caben, length(once))
  expect_equal(length(prosecnurapp:::.ppd_rotulos_de_barras(once, caben)), length(once))
  # Y al reves: cifras de miles en un panel estrecho SI se amontonarian, asi que
  # el tope baja solo. Esto es lo que el numero magico no sabia hacer.
  miles <- c(1010, 2300, 4100, 1500, 2200)
  expect_lt(prosecnurapp:::.ppd_cifras_que_caben(miles, 0.12, 5.8), length(miles))
  # Mas digitos, menos cifras: la relacion no puede invertirse.
  expect_lte(prosecnurapp:::.ppd_cifras_que_caben(miles, 0.42, 5.8),
             prosecnurapp:::.ppd_cifras_que_caben(c(5, 7, 9), 0.42, 5.8))
  # Un panel sin efectivas no divide por cero ni promete sitio que no usa.
  expect_equal(prosecnurapp:::.ppd_cifras_que_caben(rep(0, 4), 0.42, 5.8), 1L)
})
