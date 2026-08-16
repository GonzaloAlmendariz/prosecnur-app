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

# Todo se expresa en CENTIMETROS. El OOXML mide en EMU y `officer` en pulgadas,
# pero un informe que dice «0.303 in» obliga a convertir para compararlo con una
# regla o con la guia del canvas, que ya acota en cm. La conversion se hace una
# vez, al construir los umbrales.
.VERIF_CM_POR_IN <- 2.54

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
  grosor_escala_cm     = 0.77,
  grosor_categorica_cm = 0.65,
  barras_por_grafico   = 7L,
  texto_minimo_pt      = 12,
  # El aprobado no tiene NI UNO en la rampa de escala: sus 67 rojos son todos
  # titulos. El umbral es cero porque el modelo esta en cero.
  rojo_en_rampa_max    = 0L,
  # Percentil 10 del borde superior del titulo en el aprobado. La mediana es
  # 0.90 cm; se toma el p10 para no marcar por una lamina que empieza mas arriba.
  titulo_top_min_cm    = 0.78,
  # Proporcion de texto por debajo del minimo que el aprobado se permite.
  texto_prop_max       = 0.062,
  # Cifras blancas sobre un tramo claro de la rampa. El aprobado tiene CERO.
  texto_ilegible_max   = 0L,
  # Percentil 10 del aprobado. Su mediana es 4.24 cm; el motor nunca arranca
  # tan arriba como el peor caso del modelo.
  arranque_min_cm      = 3.53,
  # Hueco ENTRE premisas. El aprobado separa 1.76 cm de mediana y el motor
  # 0.97: es lo que hay detras de «se ve muy apretado».
  hueco_premisas_min_cm = 1.40
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
#'   `texto_pt`, cada uno un vector con una entrada por grafico o por texto. Los
#'   grosores van en CENTIMETROS; el texto, en puntos.
#' @export
medir_mazo <- function(path) {
  laminas <- .verif_laminas_xml(path)
  gr_esc <- numeric(0); n_esc <- integer(0)
  gr_cat <- numeric(0); txt <- numeric(0)
  rojo <- 0L; tops <- numeric(0); ilegible <- 0L

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
    rojo <- rojo + .verif_rojo_en_rampa(xml)
    ilegible <- ilegible + .verif_texto_ilegible(.verif_formas(xml))
    tt <- .verif_titulo_top_cm(xml)
    if (!is.na(tt)) tops <- c(tops, tt)
  }

  list(grosor_escala = gr_esc * .VERIF_CM_POR_IN, barras_escala = n_esc,
       grosor_categorico = gr_cat * .VERIF_CM_POR_IN, texto_pt = txt,
       rojo_en_rampa = rojo, titulo_top_cm = tops, texto_ilegible = ilegible)
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
    grosor_escala_cm     = round(q(m$grosor_escala, p), 2),
    grosor_categorica_cm = round(q(m$grosor_categorico, p), 2),
    # El techo usa el MAXIMO del aprobado, no su percentil alto, y ahi la
    # asimetria con los pisos es deliberada. Un piso calibrado al minimo lo
    # baja un solo accidente; un techo calibrado al percentil lo pone por
    # DEBAJO de lo que la referencia hace, y entonces el motor parte laminas
    # que el entregable no partia. Medido: con el percentil 90 (seis barras) el
    # mazo pasaba de 63 a 73 laminas.
    barras_por_grafico   = as.integer(max(m$barras_escala)),
    texto_minimo_pt      = round(q(m$texto_pt, p), 1),
    texto_prop_max       = round(mean(m$texto_pt < q(m$texto_pt, p)), 3),
    rojo_en_rampa_max    = as.integer(m$rojo_en_rampa),
    texto_ilegible_max   = as.integer(m$texto_ilegible),
    titulo_top_min_cm    = if (length(m$titulo_top_cm)) round(q(m$titulo_top_cm, p), 2)
                           else .VERIF_UMBRALES$titulo_top_min_cm
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
      if (g$grosor * .VERIF_CM_POR_IN < u$grosor_escala_cm) {
        add("R1 grosor de escala", i, round(g$grosor * .VERIF_CM_POR_IN, 3),
            sprintf(">= %.2f cm", u$grosor_escala_cm),
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
      if (g$grosor * .VERIF_CM_POR_IN < u$grosor_categorica_cm) {
        add("R5 grosor categorico", i, round(g$grosor * .VERIF_CM_POR_IN, 3),
            sprintf(">= %.2f cm", u$grosor_categorica_cm),
            sprintf("%d barras", g$n))
      }
    }

      # R7: el titulo no puede pegarse al borde superior.
    tt <- .verif_titulo_top_cm(xml)
    if (!is.na(tt) && tt < u$titulo_top_min_cm) {
      add("R7 posicion del titulo", i, round(tt, 3),
          sprintf(">= %.2f cm", u$titulo_top_min_cm), "pegado al borde")
    }

    # R8: el bloque no puede empezar pegado al logo.
    ar <- .verif_arranque_cm(formas)
    if (!is.na(ar) && ar < u$arranque_min_cm) {
      add("R8 arranque vertical", i, round(ar, 3),
          sprintf(">= %.2f cm", u$arranque_min_cm), "primera barra muy arriba")
    }

    # B2: dos premisas seguidas necesitan mas aire que dos publicos.
    hp <- .verif_hueco_entre_premisas_cm(formas)
    if (!is.na(hp) && hp < u$hueco_premisas_min_cm) {
      add("B2 hueco entre premisas", i, round(hp, 3),
          sprintf(">= %.2f cm", u$hueco_premisas_min_cm), "se ve apretado")
    }

    # R9: una cifra blanca sobre un tramo claro no se lee.
    il <- .verif_texto_ilegible(formas)
    if (il > u$texto_ilegible_max) {
      add("R9 texto ilegible", i, il,
          sprintf("<= %d", u$texto_ilegible_max),
          "cifra blanca sobre tramo claro")
    }

    # R4: el rojo institucional es color de TITULO, no extremo de escala.
    rr <- .verif_rojo_en_rampa(xml)
    if (rr > u$rojo_en_rampa_max) {
      add("R4 rojo en la rampa", i, rr,
          sprintf("<= %d", u$rojo_en_rampa_max),
          "el extremo negativo va naranja")
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
      "R6 circulares",
      "R10 interlineado (medido: los tres mazos usan 100 %; no es la causa)",
      "R8 arranque vertical del bloque",
      "R9 color del texto: el resto del criterio, mas alla de la legibilidad"
    )
  )
}


#' Segmentos rojos que pertenecen a la rampa de escala
#'
#' El rojo institucional NO esta prohibido: es el color de los titulos, y el
#' entregable aprobado lo usa en 67. Lo que no puede es pintar el extremo
#' negativo de una escala. El criterio que los distingue sin ambiguedad —y que
#' ya se uso para corregir 26 colores en 23 listas sin tocar un solo titulo— es
#' la vecindad: es rampa cuando el color inmediatamente siguiente es el amarillo.
#'
#' @keywords internal
.verif_rojo_en_rampa <- function(xml) {
  cols <- toupper(gsub('.*val="', "", gsub('"$', "",
    regmatches(xml, gregexpr('srgbClr val="[0-9A-Fa-f]{6}"', xml))[[1]]))) 
  cols <- substr(gsub("[^0-9A-F]", "", cols), 1, 6)
  if (length(cols) < 2L) return(0L)
  rojos <- which(cols == "CA5651")
  rojos <- rojos[rojos < length(cols)]
  if (!length(rojos)) return(0L)
  sum(cols[rojos + 1L] %in% c("FFD965", "FFD966"))
}


#' Borde superior del titulo de lamina, en centimetros
#'
#' El titulo es el unico texto a 24 pt de la lamina, asi que se reconoce por su
#' cuerpo y no por su placeholder —que cambia de nombre entre plantillas—.
#'
#' @keywords internal
.verif_titulo_top_cm <- function(xml) {
  sps <- regmatches(xml, gregexpr("<p:sp>.*?</p:sp>", xml))[[1]]
  for (sp in sps) {
    if (!grepl('sz="2400"', sp, fixed = TRUE)) next
    m <- regmatches(sp, regexpr('<a:off x="(-?\\d+)" y="(-?\\d+)"/>', sp))
    if (!length(m)) next
    nums <- as.numeric(regmatches(m, gregexpr("-?\\d+", m))[[1]])
    if (length(nums) >= 2L) return(nums[[2]] / .VERIF_EMU * .VERIF_CM_POR_IN)
  }
  NA_real_
}


# Tramos claros de la rampa: sobre ellos una cifra blanca no se lee.
.VERIF_CLAROS <- c("F4B183", "FFD965", "FFD966", "EFD25E")


#' Cifras blancas que caen sobre un tramo claro
#'
#' El recetario dejo esto abierto por no poder medirlo: «el metodo por forma
#' devuelve el color de relleno de la propia caja, no el del segmento que hay
#' debajo». Se resuelve cruzando por POSICION —que segmento contiene el centro
#' de la caja de texto—, que es la unica forma de saber sobre que fondo cae.
#'
#' Importa porque es una regresion posible de la receta 4: al cambiar el extremo
#' negativo de rojo oscuro a naranja claro, las cifras blancas que se leian
#' sobre el rojo dejan de leerse sobre el naranja. El entregable aprobado tiene
#' cero.
#'
#' @param formas Salida de `.verif_formas()`.
#' @return Numero de cifras blancas sobre fondo claro.
#' @keywords internal
.verif_texto_ilegible <- function(formas) {
  if (!length(formas)) return(0L)
  segs <- Filter(function(f) f$col %in% .VERIF_CLAROS && !nzchar(f$texto), formas)
  if (!length(segs)) return(0L)
  blancos <- Filter(function(f) f$col == "FFFFFF" && nzchar(f$texto), formas)
  if (!length(blancos)) return(0L)

  sum(vapply(blancos, function(b) {
    cx <- b$x + b$w / 2
    cy <- b$y + b$h / 2
    any(vapply(segs, function(s) {
      cx >= s$x && cx <= s$x + s$w && cy >= s$y && cy <= s$y + s$h
    }, logical(1)))
  }, logical(1)))
}


#' Arranque vertical del bloque de datos, en centimetros
#'
#' Donde empieza la primera barra. El comentario que lo motiva —«los graficos
#' pueden estar un poquito mas abajo, la primera barra no tan cerca del logo»—
#' apuntaba al mazo criticado; el aprobado arranca a 4.24 cm de mediana.
#'
#' @keywords internal
.verif_arranque_cm <- function(formas) {
  segs <- .verif_segmentos(formas, .VERIF_RAMPA)
  if (!length(segs)) return(NA_real_)
  min(vapply(segs, function(s) s$y, numeric(1))) * .VERIF_CM_POR_IN
}


#' Hueco entre premisas de una lamina, en centimetros
#'
#' Hay DOS poblaciones de hueco y confundirlas no mide nada: el que separa dos
#' publicos de la misma premisa y el que separa dos premisas. Se distinguen por
#' el mayor salto de la serie ordenada, no por un estadistico que las promedie
#' —un coeficiente de variacion sobre la mezcla da falsos positivos, y ya costo
#' una iteracion entera perseguir un alto variable que no existia—.
#'
#' @return Mediana del hueco ENTRE premisas, o `NA_real_` si la lamina no tiene
#'   dos poblaciones distinguibles.
#' @keywords internal
.verif_hueco_entre_premisas_cm <- function(formas) {
  segs <- .verif_segmentos(formas, .VERIF_RAMPA)
  if (length(segs) < 4L) return(NA_real_)

  filas <- list()
  for (s in segs) filas[[as.character(round(s$y, 3))]] <- s$h
  ys <- sort(as.numeric(names(filas)))
  if (length(ys) < 4L) return(NA_real_)

  gaps <- numeric(0)
  for (i in seq_len(length(ys) - 1L)) {
    g <- ys[i + 1L] - (ys[i] + filas[[as.character(ys[i])]])
    if (is.finite(g) && g >= 0) gaps <- c(gaps, g)
  }
  if (length(gaps) < 3L) return(NA_real_)

  sg <- sort(gaps)
  saltos <- diff(sg)
  if (!length(saltos)) return(NA_real_)
  idx <- which.max(saltos)
  # Sin un salto claro, la lamina tiene una sola poblacion: no hay «entre
  # premisas» que medir y devolver la mediana de todo seria inventarlo.
  if (saltos[idx] <= stats::median(sg) * 0.5) return(NA_real_)

  stats::median(sg[(idx + 1L):length(sg)]) * .VERIF_CM_POR_IN
}
