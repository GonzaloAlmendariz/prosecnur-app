# Verificador del mazo contra el recetario.
#
# La guia de canvas (`debug_ph`) pinta bordes magenta sobre los placeholders.
# Sirve para mirar una lamina, no para saber si un mazo de sesenta cumple. Peor:
# activa mete 978 bordes que tapan lo que se quiere ver —una comparacion de
# color con la guia encendida oculto el hallazgo de los tamanos de letra—.
#
# Esto la reemplaza por lo que hacia falta: medir el .pptx ya generado contra
# las recetas medidas del entregable aprobado, y devolver los incumplimientos
# con su lamina. Un mazo se aprueba por conformidad, no por ausencia de bordes.
#
# La cadena de medicion es la misma que se valido a mano sobre el mazo del
# 14-08, y el orden importa porque cada paso descarta un falso positivo que ya
# costo una conclusion equivocada:
#
#   segmento -> barra (misma fila) -> grafico (misma columna)
#
# - Un segmento se reconoce por su RELLENO. Solo los colores de la escala: el
#   azul institucional y el celeste pintan cabeceras y la columna Top Two Box, y
#   meterlos ensancha el rango de alturas hasta hacerlo inutil.
# - La leyenda repite esos mismos colores en cuadraditos; sin descartarlos, cada
#   leyenda se lee como un grafico de "una barra de 0.108 in".
# - La caja de etiqueta usa el mismo azul que la barra categorica y lleva texto
#   propio; sin ese filtro el medidor devuelve 0.159 in en decenas de laminas.
# - El grosor de un grafico es la MODA de sus barras, no la media: en una lamina
#   conviven la barra, la cabecera y la leyenda.
# - Y se mide POR GRAFICO, no por lamina: una lamina de dos graficos con 7 y 6
#   barras no es "un grafico de 13 barras finisimas".

# Colores de la rampa de escala (dos paletas: la del entregable y la del motor).
.VERIF_RAMPA <- c("F4B183", "FFD965", "FFD966", "ADD493", "B0D597",
                  "70AD47", "8FC36B", "CA5651")

# Azul institucional: barras categoricas.
.VERIF_AZUL <- c("081F5C")

# Umbrales DERIVADOS del entregable que el cliente aprobo, no elegidos a ojo.
#
# Salen de `calibrar_umbrales()` sobre `Informe Contabilidad 14-08.pptx`, con el
# percentil 10 para los pisos y el 90 para los techos. Los anteriores —0.32 in,
# 9 barras, 11 pt— se habian fijado contra un ideal, y el resultado es que el
# propio entregable aprobado los incumplia mas del doble que el motor. Un piso
# que la referencia no cumple no mide conformidad: mide distancia a una idea.
#
# Al calibrar, DOS de los cuatro salieron mas exigentes que el ideal, no menos:
# el aprobado no baja de 12 pt en la decima parte peor de su texto, ni de 0.256
# in en sus barras categoricas. El ideal era laxo justo donde el entregable es
# cuidadoso.
#
# Se usa el percentil y no el extremo a proposito: el peor caso de un mazo de
# sesenta laminas es un accidente, y calibrar contra el deja pasar cualquier
# cosa. La vara es parecerse al entregable TIPICO, no a su peor lamina.
.VERIF_UMBRALES <- list(
  grosor_escala_in     = 0.303,
  grosor_categorica_in = 0.256,
  barras_por_grafico   = 7L,
  texto_minimo_pt      = 12,
  # Proporcion de texto por debajo del minimo que el aprobado se permite.
  texto_prop_max       = 0.062,
  titulo_top_min_in    = 0.35
)

.VERIF_EMU <- 914400


#' Lee las laminas de un .pptx como texto XML
#' @keywords internal
.verif_laminas_xml <- function(path) {
  if (!file.exists(path)) {
    stop_api(400L, "E_ARCHIVO_NO_EXISTE", detalle = "No se encuentra el .pptx a verificar.")
  }
  nombres <- utils::unzip(path, list = TRUE)$Name
  nombres <- grep("^ppt/slides/slide[0-9]+\\.xml$", nombres, value = TRUE)
  if (!length(nombres)) return(list())
  orden <- order(as.integer(sub("\\D*(\\d+)\\.xml$", "\\1", nombres)))
  nombres <- nombres[orden]

  destino <- tempfile("verif_mazo_")
  dir.create(destino, showWarnings = FALSE, recursive = TRUE)
  on.exit(unlink(destino, recursive = TRUE), add = TRUE)
  utils::unzip(path, files = nombres, exdir = destino)

  lapply(nombres, function(n) {
    con <- file(file.path(destino, n), encoding = "UTF-8")
    on.exit(close(con), add = TRUE)
    paste(readLines(con, warn = FALSE), collapse = "")
  })
}


#' Formas con geometria y relleno de una lamina
#' @keywords internal
.verif_formas <- function(xml) {
  sps <- regmatches(xml, gregexpr("<p:sp>.*?</p:sp>", xml))[[1]]
  if (!length(sps)) return(list())

  out <- list()
  for (sp in sps) {
    m <- regmatches(sp, regexpr(
      '<a:off x="(-?\\d+)" y="(-?\\d+)"/>\\s*<a:ext cx="(\\d+)" cy="(\\d+)"', sp))
    if (!length(m)) next
    nums <- as.numeric(regmatches(m, gregexpr("-?\\d+", m))[[1]])
    if (length(nums) < 4L) next

    fill <- regmatches(sp, regexpr('<a:solidFill>\\s*<a:srgbClr val="[0-9A-Fa-f]{6}"', sp))
    if (!length(fill)) next
    col <- toupper(sub('.*val="', "", sub('"$', "", fill)))
    col <- substr(gsub('[^0-9A-Fa-f]', "", col), 1, 6)

    textos <- regmatches(sp, gregexpr("<a:t>[^<]*</a:t>", sp))[[1]]
    texto <- trimws(paste(gsub("</?a:t>", "", textos), collapse = ""))

    out[[length(out) + 1L]] <- list(
      x = nums[[1]] / .VERIF_EMU, y = nums[[2]] / .VERIF_EMU,
      w = nums[[3]] / .VERIF_EMU, h = nums[[4]] / .VERIF_EMU,
      col = col, texto = texto
    )
  }
  out
}


#' Segmentos de barra de una familia
#'
#' `exigir_sin_texto` va activo para TODAS las familias, no solo la categorica:
#' una barra de datos no lleva texto propio —su cifra es una capa aparte—, y las
#' cajas que si lo llevan son la columna Top Two Box, con relleno de la rampa y
#' alto fijo de 0.159 in. Sin este filtro la mediana del grosor del entregable
#' aprobado salia 0.159 exacta: no era el grosor de sus barras, era el de una
#' caja de texto contada sesenta veces.
#'
#' @keywords internal
.verif_segmentos <- function(formas, colores, exigir_sin_texto = TRUE) {
  Filter(function(f) {
    f$col %in% colores &&
      f$h > 0 && f$w > f$h &&                       # horizontal
      !(f$w < 0.25 && f$h < 0.25) &&                # no es cuadradito de leyenda
      (!exigir_sin_texto || !nzchar(f$texto))       # no es caja de etiqueta
  }, formas)
}


#' Agrupa segmentos en barras (misma fila) y barras en graficos (misma columna)
#'
#' @param tol_hueco Separacion en pulgadas a partir de la cual dos segmentos de
#'   la misma fila pertenecen a graficos distintos.
#'
#' @return Lista de graficos; cada uno con `n` barras y su `grosor` (la moda).
#' @keywords internal
.verif_graficos <- function(segs, tol_fila = 0.02, tol_col = 1.0,
                            tol_hueco = 0.30) {
  if (!length(segs)) return(list())

  # Barra = segmentos CONTIGUOS de una misma fila. Compartir fila no basta: dos
  # graficos lado a lado tienen barras a la misma altura, y unirlos por la `y`
  # los funde en una barra imposible que arranca en el grafico izquierdo y
  # termina en el derecho. Se parte donde hay hueco.
  clave <- vapply(segs, function(s) round(s$y / tol_fila), numeric(1))
  barras <- list()
  for (fila in split(segs, clave)) {
    ord <- order(vapply(fila, function(s) s$x, numeric(1)))
    fila <- fila[ord]
    ini <- fila[[1]]
    fin_x <- ini$x + ini$w
    for (k in seq_along(fila)[-1]) {
      s <- fila[[k]]
      if (s$x - fin_x > tol_hueco) {
        barras[[length(barras) + 1L]] <- list(x = ini$x, h = ini$h)
        ini <- s
      }
      fin_x <- max(fin_x, s$x + s$w)
    }
    barras[[length(barras) + 1L]] <- list(x = ini$x, h = ini$h)
  }
  if (!length(barras)) return(list())

  # Grafico = barras que arrancan en la misma columna. Ninguna barra cruza de un
  # grafico al de al lado, asi que el eje las separa sin ambiguedad.
  ejes <- sort(unique(round(vapply(barras, function(b) b$x, numeric(1)), 1)))
  grupos <- list()
  actual <- ejes[[1]]
  for (e in ejes[-1]) {
    if (e - actual[[length(actual)]] < tol_col) {
      actual <- c(actual, e)
    } else {
      grupos[[length(grupos) + 1L]] <- actual
      actual <- e
    }
  }
  grupos[[length(grupos) + 1L]] <- actual

  out <- list()
  for (g in grupos) {
    propias <- Filter(function(b) b$x >= min(g) - 0.05 && b$x <= max(g) + 0.05, barras)
    # Con una sola barra no hay grosor comparable del que hablar.
    if (length(propias) < 2L) next
    alturas <- round(vapply(propias, function(b) b$h, numeric(1)), 3)
    tab <- table(alturas)
    out[[length(out) + 1L]] <- list(
      n = length(propias),
      grosor = as.numeric(names(tab)[which.max(tab)])
    )
  }
  out
}


#' Medidas crudas de un mazo, sin juzgarlas
#'
#' Separado de la verificacion porque son dos preguntas distintas: esta dice
#' cuanto mide el mazo, y `verificar_mazo()` dice si eso esta bien. Mezclarlas
#' fue lo que dejo los umbrales sin origen comprobable — cada uno se eligio a
#' ojo y ninguno salia de haber medido el entregable.
#'
#' @param path Ruta al `.pptx`.
#'
#' @return Lista con `grosor_escala`, `barras_escala`, `grosor_categorico` y
#'   `texto_pt`, cada uno un vector con una entrada por grafico o por texto.
#' @export
medir_mazo <- function(path) {
  laminas <- .verif_laminas_xml(path)
  gr_esc <- numeric(0); n_esc <- integer(0)
  gr_cat <- numeric(0); txt <- numeric(0)

  for (xml in laminas) {
    formas <- .verif_formas(xml)
    for (g in .verif_graficos(.verif_segmentos(formas, .VERIF_RAMPA))) {
      gr_esc <- c(gr_esc, g$grosor); n_esc <- c(n_esc, g$n)
    }
    for (g in .verif_graficos(.verif_segmentos(formas, .VERIF_AZUL, exigir_sin_texto = TRUE))) {
      gr_cat <- c(gr_cat, g$grosor)
    }
    szs <- as.numeric(gsub('\\D', "", regmatches(xml, gregexpr('sz="\\d+"', xml))[[1]])) / 100
    txt <- c(txt, szs[is.finite(szs)])
  }

  list(grosor_escala = gr_esc, barras_escala = n_esc,
       grosor_categorico = gr_cat, texto_pt = txt)
}


#' Deriva los umbrales de un mazo de referencia
#'
#' Los umbrales del recetario se habian fijado contra un ideal, y el entregable
#' que el cliente aprobo los incumple mas del doble que el motor: 46 de sus
#' graficos bajan de 0.32 in y 53 de sus textos de 11 pt. Un piso que la
#' referencia no cumple no mide conformidad, mide distancia a una idea.
#'
#' Se toma un percentil bajo y no el minimo: el minimo de un mazo de sesenta
#' laminas es un caso aislado, y calibrar contra el deja pasar cualquier cosa.
#'
#' @param path Ruta al `.pptx` de referencia.
#' @param p Percentil inferior que se acepta como piso.
#'
#' @return Lista de umbrales con la forma de `.VERIF_UMBRALES`.
#' @export
calibrar_umbrales <- function(path, p = 0.10) {
  m <- medir_mazo(path)
  q <- function(x, prob) if (!length(x)) NA_real_ else unname(stats::quantile(x, prob, na.rm = TRUE))

  list(
    grosor_escala_in     = round(q(m$grosor_escala, p), 3),
    grosor_categorica_in = round(q(m$grosor_categorico, p), 3),
    # El techo usa el MAXIMO del aprobado, no su percentil alto, y ahi la
    # asimetria con los pisos es deliberada. Un piso calibrado al minimo lo
    # baja un solo accidente; un techo calibrado al percentil lo pone por
    # DEBAJO de lo que la referencia hace, y entonces el motor parte laminas
    # que el entregable no partia. Medido: con el percentil 90 (seis barras) el
    # mazo pasaba de 63 a 73 laminas.
    barras_por_grafico   = as.integer(max(m$barras_escala)),
    texto_minimo_pt      = round(q(m$texto_pt, p), 1),
    texto_prop_max       = round(mean(m$texto_pt < q(m$texto_pt, p)), 3),
    titulo_top_min_in    = .VERIF_UMBRALES$titulo_top_min_in
  )
}


#' Verifica un mazo contra el recetario
#'
#' Las reglas que se comprueban son las medibles sobre el archivo. Las que no
#' —interlineado, arranque vertical del bloque— se declaran como no cubiertas en
#' vez de omitirse: un informe que calla lo que no mira se lee como si lo
#' hubiera aprobado.
#'
#' @param path Ruta al `.pptx`.
#' @param umbrales Lista de umbrales; por defecto los del recetario.
#'
#' @return Lista con `hallazgos` (data.frame), `resumen` y `no_cubierto`.
#' @export
verificar_mazo <- function(path, umbrales = .VERIF_UMBRALES) {
  u <- utils::modifyList(.VERIF_UMBRALES, umbrales %||% list())
  laminas <- .verif_laminas_xml(path)

  reglas <- character(0); lams <- integer(0)
  valores <- numeric(0); esperados <- character(0); detalles <- character(0)
  add <- function(regla, lam, valor, esperado, detalle) {
    reglas <<- c(reglas, regla); lams <<- c(lams, lam)
    valores <<- c(valores, valor); esperados <<- c(esperados, esperado)
    detalles <<- c(detalles, detalle)
  }

  n_graf_escala <- 0L; n_graf_cat <- 0L
  texto_todo <- numeric(0)

  for (i in seq_along(laminas)) {
    xml <- laminas[[i]]
    formas <- .verif_formas(xml)

    # R1 y R2: grosor y numero de barras en escala.
    gr_esc <- .verif_graficos(.verif_segmentos(formas, .VERIF_RAMPA))
    n_graf_escala <- n_graf_escala + length(gr_esc)
    for (g in gr_esc) {
      if (g$grosor < u$grosor_escala_in) {
        add("R1 grosor de escala", i, g$grosor,
            sprintf(">= %.2f in", u$grosor_escala_in),
            sprintf("%d barras", g$n))
      }
      if (g$n > u$barras_por_grafico) {
        add("R2 barras por grafico", i, g$n,
            sprintf("<= %d", u$barras_por_grafico),
            "la lamina deberia partirse")
      }
    }

    # R5: grosor en categoricas.
    gr_cat <- .verif_graficos(.verif_segmentos(formas, .VERIF_AZUL, exigir_sin_texto = TRUE))
    n_graf_cat <- n_graf_cat + length(gr_cat)
    for (g in gr_cat) {
      if (g$grosor < u$grosor_categorica_in) {
        add("R5 grosor categorico", i, g$grosor,
            sprintf(">= %.2f in", u$grosor_categorica_in),
            sprintf("%d barras", g$n))
      }
    }

    # R3 se acumula y se juzga al final: ver abajo.
    szs <- as.numeric(gsub('\\D', "", regmatches(xml, gregexpr('sz="\\d+"', xml))[[1]])) / 100
    texto_todo <- c(texto_todo, szs[is.finite(szs)])
  }

  # R3 es una regla de MAZO, no de lamina. Medida por lamina no discrimina: basta
  # un rotulo pequeno para marcarla, y con el umbral del aprobado quedaban
  # marcadas 53 de 63 laminas del PROPIO entregable aprobado. Lo que distingue un
  # mazo legible de otro no es que ninguna lamina tenga letra chica, sino cuanta
  # hay.
  if (length(texto_todo)) {
    prop <- mean(texto_todo < u$texto_minimo_pt)
    if (prop > u$texto_prop_max) {
      add("R3 proporcion de texto pequeno", NA_integer_, round(prop, 4),
          sprintf("<= %.1f %%", 100 * u$texto_prop_max),
          sprintf("%.1f %% por debajo de %g pt", 100 * prop, u$texto_minimo_pt))
    }
  }

  hallazgos <- data.frame(
    regla = reglas, lamina = lams, valor = valores,
    esperado = esperados, detalle = detalles,
    stringsAsFactors = FALSE
  )

  list(
    hallazgos = hallazgos,
    resumen = list(
      laminas = length(laminas),
      graficos_escala = n_graf_escala,
      graficos_categoricos = n_graf_cat,
      incumplimientos = nrow(hallazgos),
      por_regla = if (nrow(hallazgos)) as.list(table(hallazgos$regla)) else list()
    ),
    # Lo que este verificador NO mira. Se declara para que un informe limpio no
    # se confunda con un mazo conforme.
    no_cubierto = c(
      "R4 color de la escala (exige distinguir rampa de titulos por vecindad)",
      "R6 circulares",
      "R7 posicion del titulo (vive en el layout, no en la lamina)",
      "R8 arranque vertical del bloque",
      "R9 color del texto",
      "R10 interlineado"
    )
  )
}
