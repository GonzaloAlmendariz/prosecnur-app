# Layout `croquis_campus`: el verso de la ficha de campo (B32).
#
# Croquis estilizado PROPIO del campus PUCP —dibujo nuestro en grid, plan view
# GIRADO 180 grados: sur arriba, con la flecha N apuntando hacia abajo
# (dictado de Gonzalo, 2026-09-03)— donde el pabellon del aula se resalta con
# relleno pleno y anillo; los demas pabellones van en trazo suave con su letra,
# y las puertas, avenidas, caminos y edificios sin letra orientan al aplicador
# aunque no aplique ahi (dictados de Gonzalo, 2026-09-02: «darle un mapa real
# de toda la PUCP como estilo croquis y resaltarles donde queda el pabellon» y
# «con las puertas de la PUCP tambien y los edificios importantes para que se
# guien a pesar de que no sean pabellones»). El mapa oficial isometrico se uso
# SOLO como referencia; aqui no se incrusta ningun bitmap ajeno.
#
# Tres capas de datos, cada una con su procedencia:
# - Identidad y posicion de cada pabellon: docs/qa/croquis-campus-pucp-fuentes.md
#   (marcadores oficiales de pucp.edu.pe/mapa-campus; V de OSM; Y DERIVADA de
#   tres marcadores vecinos — declarado, jamas inventado con seguridad falsa).
# - Huellas de edificios, caminos y areas verdes: inst/croquis/
#   campus-pucp-geometria.json, extracto de © OpenStreetMap contributors (ODbL)
#   generado por api/scripts/croquis_geometria_osm.py.
# - Colores por letra: gemelo R del sistema de chips B31 del frontend
#   (chipDePabellon.ts + aulasCargaDeCampo.css). Misma letra, mismo tono, en la
#   app y en el papel; la paridad la fija test-collection-croquis-campus.R.

#' Cuantos tonos tiene la paleta de pabellones (gemelo de TONOS_DE_PABELLON).
#' @keywords internal
CCX_TONOS_DE_PABELLON <- 8L

# La paleta B31 resuelta a hex para papel: los 8 tonos de `es-tono-*` en
# `aulasCargaDeCampo.css`, en su orden, con los tokens de `tokens.css`
# (steel, green, rose, amber, violet, cyan, monitoring, processing). El PDF no
# lee CSS, asi que la resolucion vive aqui y el test de paridad la vigila.
.ccx_paleta_tonos <- function() {
  c("#4f7cbf", "#16a34a", "#c2416b", "#d97706",
    "#7c3aed", "#0ea5b7", "#a0464e", "#0f766e")
}

# «A703» -> «A»; «lfia» -> «L»; «Ñ201» -> «N»; sin letra inicial -> "".
# Gemelo de `letraDePabellon` (frontend): misma normalizacion de diacriticos
# para que la Ñ comparta tono con la N en vez de quedarse sin color.
.ccx_letra_de_pabellon <- function(lugar) {
  crudo <- toupper(trimws(as.character(lugar %||% "")[1]))
  if (is.na(crudo) || !nzchar(crudo)) return("")
  primera <- substr(crudo, 1L, 1L)
  primera <- chartr("ÑÁÉÍÓÚ", "NAEIOU", primera)
  if (!grepl("^[A-Z]$", primera)) return("")
  primera
}

# Indice ciclico 0..7 por letra; NA sin letra. Gemelo de `tonoDePabellon`.
.ccx_tono_de_pabellon <- function(lugar) {
  letra <- .ccx_letra_de_pabellon(lugar)
  if (!nzchar(letra)) return(NA_integer_)
  codigo <- utf8ToInt(letra) - 65L
  if (codigo < 0L || codigo > 25L) return(NA_integer_)
  codigo %% CCX_TONOS_DE_PABELLON
}

# Un venue puede traer VARIAS aulas: en ULT2, 301/1.392 vienen como
# «A204 · A206» y 73 CRUZAN pabellon («H404 · A608») — cursos que se dictan en
# dos edificios segun la sesion (dictado de Gonzalo, 2026-09-02: «marcar que
# puede ser en cualquiera de los dos en funcion del horario»). Se parte por
# los separadores VISTOS en datos reales; no se inventan otros.
.ccx_lugares_de_venue <- function(venue_raw) {
  crudo <- trimws(as.character(venue_raw %||% "")[1])
  if (is.na(crudo) || !nzchar(crudo)) return(character(0))
  tokens <- trimws(strsplit(crudo, "[·/;,]")[[1]])
  tokens[nzchar(tokens)]
}

# Letras de pabellon del venue, unicas y en orden de aparicion. Conserva las
# que no tienen edificio en el croquis («TAMB» -> T): decidir si T existe y
# declararlo es del dibujante, no del parser.
.ccx_letras_de_venue <- function(venue_raw) {
  letras <- vapply(.ccx_lugares_de_venue(venue_raw), .ccx_letra_de_pabellon,
                   character(1), USE.NAMES = FALSE)
  unique(letras[nzchar(letras)])
}

# El subtitulo del croquis como funcion PURA del venue: lo que el warning
# declara tambien se imprime — el aplicador tiene la lamina en la mano, no el
# log del render (nota del verificador de V2).
.ccx_subtitulo_croquis <- function(venue_raw) {
  venue <- trimws(as.character(venue_raw %||% "")[1])
  if (is.na(venue)) venue <- ""
  pb <- .ccx_pabellones()
  lugares <- .ccx_lugares_de_venue(venue)
  letras_venue <- .ccx_letras_de_venue(venue)
  letras_sel <- letras_venue[letras_venue %in% pb$letra]
  aulas_txt <- paste(toupper(lugares), collapse = " · ")
  # Guion corto a proposito: el device pdf() no codifica U+2014 y lo sustituye
  # con aviso en cada render (medido con las 10 fichas de prueba).
  base <- if (length(letras_sel) > 1L) {
    # Dos pabellones a la vez: cualquiera de los dos, segun la sesion del
    # horario (la cara de la ficha imprime el horario completo).
    sprintf("Tu lugar de aplicación: PABELLÓN %s · aulas %s - según el horario",
            paste(letras_sel, collapse = " o "), aulas_txt)
  } else if (length(letras_sel) == 1L) {
    sprintf("Tu lugar de aplicación: PABELLÓN %s · %s %s",
            letras_sel, if (length(lugares) > 1L) "aulas" else "aula", aulas_txt)
  } else if (length(letras_venue)) {
    return(sprintf("Aula %s - pabellón fuera del croquis", aulas_txt))
  } else if (nzchar(venue)) {
    # Hay venues reales sin letra de pabellon («101E», «SIMB» en HSVG2026):
    # el aula se conserva en el subtitulo; lo que falta es el pabellon.
    return(sprintf("Aula %s - pabellón por confirmar", toupper(venue)))
  } else {
    return("Pabellón por confirmar")
  }
  # El token mixto sin edificio, impreso: «TAMB · Z111» resalta Z y el papel
  # dice que TAMB quedo fuera, en vez de dejarlo solo en el warning.
  desconocidas <- setdiff(letras_venue, letras_sel)
  if (length(desconocidas)) {
    fuera <- lugares[vapply(lugares, function(lg) {
      .ccx_letra_de_pabellon(lg) %in% desconocidas
    }, logical(1))]
    base <- sprintf("%s (%s fuera del croquis)", base,
                    paste(toupper(fuera), collapse = " · "))
  }
  base
}

# Pabellones por letra con su posicion real aproximada (lat/lng WGS84).
# `fuente`: oficial = marcador directo del mapa oficial; osm = edificio
# nombrado en OpenStreetMap; derivada = centroide de marcadores oficiales
# adyacentes que nombran el pabellon; google = place publico de Google Maps
# (K, «Seccion Mecatronica», cazada en el barrido del 2026-09-03 — el venue
# real «K301» dejo de caer en desconocido). La B lleva un ajuste de croquis declarado
# (+25 m O, +20 m S) para que su chip no solape con el de la A: estan a 25 m
# reales y a esta escala dos chips legibles no caben sin tocarse (la huella de
# la B usa el marcador SIN ajuste).
.ccx_pabellones <- function() {
  data.frame(
    letra = c("A", "B", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
              "N", "O", "P", "Q", "R", "U", "V", "X", "Y", "Z"),
    lat = c(-12.072545, -12.072939, -12.069849, -12.070985, -12.071556,
            -12.071198, -12.069614, -12.070515, -12.070352, -12.072890,
            -12.067530, -12.071597, -12.068663, -12.072765, -12.072239,
            -12.071231, -12.067682, -12.072251, -12.073125, -12.065333,
            -12.066830, -12.069115),
    lng = c(-77.079539, -77.079875, -77.080512, -77.079311, -77.080365,
            -77.078940, -77.081231, -77.078737, -77.080311, -77.082775,
            -77.080201, -77.081676, -77.078801, -77.082621, -77.078092,
            -77.078530, -77.079144, -77.081060, -77.081880, -77.078511,
            -77.079414, -77.080909),
    fuente = c("oficial", "oficial", "oficial", "oficial", "oficial",
               "oficial", "oficial", "oficial", "oficial", "google",
               "oficial", "oficial", "oficial", "oficial", "oficial",
               "oficial", "oficial", "oficial", "osm", "oficial",
               "google", "oficial"),
    stringsAsFactors = FALSE
  )
}

# Edificios de referencia sin letra: el aplicador se orienta por ellos aunque
# no aplique ahi. Sus huellas ya vienen de la geometria OSM; esto es solo el
# rotulo y donde ponerlo.
.ccx_hitos <- function() {
  data.frame(
    nombre = c("Biblioteca", "Dintilhac", "Tinkuy", "Comedor", "Capilla",
               "Coliseo", "CIA", "Arquitectura", "Huaca 20", "Rotonda Letras"),
    # El rotulo de la rotonda va corrido ~30 m SE de su centro real: encima
    # le cae el chip del pabellon L (estan a 25 m) y el circulo es chico.
    lat = c(-12.069037, -12.069530, -12.068131, -12.070422, -12.069567,
            -12.066931, -12.072085, -12.071692, -12.069530, -12.067790),
    lng = c(-77.079997, -77.079396, -77.079469, -77.081178, -77.080103,
            -77.079950, -77.080308, -77.080885, -77.082482, -77.079930),
    stringsAsFactors = FALSE
  )
}

# Rotulos de zona: nombran un barrio del campus, no un edificio. Derecho y
# CC.SS. comparten cuadra con los pabellones D y J (sus marcadores caen
# encima); un rotulo de zona los nombra sin tapar las letras.
.ccx_zonas <- function() {
  data.frame(
    nombre = c("Derecho · CC.SS.", "Zona Ingeniería"),
    lat = c(-12.070150, -12.072700),
    lng = c(-77.080750, -77.081500),
    stringsAsFactors = FALSE
  )
}

# Puertas de ingreso. Principal/Union/Riva-Aguero son las tres del PDF oficial;
# 8 y 10 existen como marcadores de estacionamiento «Puerta N» y su posicion
# sobre el borde es aproximada (declarado en el doc de fuentes).
.ccx_puertas <- function() {
  data.frame(
    nombre = c("ENTRADA PRINCIPAL", "ENTRADA UNIÓN",
               "ENTRADA RIVA-AGÜERO", "PUERTA 8", "PUERTA 10"),
    lat = c(-12.069050, -12.071500, -12.068800, -12.066691, -12.065670),
    lng = c(-77.077670, -77.077410, -77.082400, -77.078060, -77.080590),
    lado = c("este", "este", "oeste", "este", "norte"),
    stringsAsFactors = FALSE
  )
}

# Perimetro estilizado del campus (sentido horario desde el SE). Es croquis,
# no catastro: siete vertices que respetan los bordes reales (Av. Universitaria
# al este, Av. Riva Aguero al oeste, el dedo norte de Artes Escenicas). El
# generador de geometria usa EL MISMO poligono como filtro; si esto cambia,
# regenerar el JSON.
.ccx_borde_campus <- function() {
  data.frame(
    lat = c(-12.0747, -12.0650, -12.0648, -12.0656, -12.0658, -12.0688, -12.0746),
    lng = c(-77.0770, -77.0781, -77.0790, -77.0800, -77.0818, -77.0824, -77.0838)
  )
}

# Huellas de edificios, caminos y verdes (© OpenStreetMap contributors, ODbL).
# Se leen una vez por proceso: el bundle renderiza cientos de versos y parsear
# 120 KB de JSON por pagina seria puro desperdicio.
.ccx_geometria_cache <- new.env(parent = emptyenv())
.ccx_geometria <- function() {
  if (!is.null(.ccx_geometria_cache$geom)) return(.ccx_geometria_cache$geom)
  path <- system.file("croquis", "campus-pucp-geometria.json", package = "prosecnurapp")
  geom <- if (nzchar(path) && file.exists(path)) {
    tryCatch(jsonlite::read_json(path), error = function(e) NULL)
  } else {
    NULL
  }
  .ccx_geometria_cache$geom <- geom
  geom
}

# Geometria del croquis sobre la pagina A4 vertical. El bbox geografico y el
# factor cos(latitud) hacen que 100 m midan lo mismo en ambos ejes; el ancho
# npc sale del alto disponible por esa proporcion, centrado en la hoja.
.ccx_layout <- function() {
  geo <- pulso_pdf_geo("portrait")
  lat0 <- -12.0748; lat1 <- -12.0645
  lng0 <- -77.0842; lng1 <- -77.0770
  dlat <- lat1 - lat0; dlng <- lng1 - lng0
  aspect <- (dlng * cos(12.07 * pi / 180)) / dlat
  y0 <- 0.120; y1 <- 0.842
  h_npc <- y1 - y0
  w_npc <- h_npc * aspect * (geo$page_h / geo$page_w)
  list(
    lat0 = lat0, lat1 = lat1, lng0 = lng0, lng1 = lng1,
    x0 = 0.5 - w_npc / 2, y0 = y0, w = w_npc, h = h_npc,
    y_title = 0.945, y_sub = 0.912, y_leyenda = 0.085,
    lado_pabellon = 0.031
  )
}

# lat/lng -> npc de pagina, GIRADA 180 grados: sur arriba, este a la
# izquierda (dictado de Gonzalo, 2026-09-03: «inviertas el mapa 180 grados»).
# La flecha N del dibujo apunta hacia abajo y sigue diciendo la verdad.
# Vectorizada: acepta columnas enteras.
.ccx_proyectar <- function(lat, lng, L) {
  list(
    x = L$x0 + (1 - (lng - L$lng0) / (L$lng1 - L$lng0)) * L$w,
    y = L$y0 + (1 - (lat - L$lat0) / (L$lat1 - L$lat0)) * L$h
  )
}

# La base del equipo: PULSO PUCP. Posicion CONFIRMADA por el dueño
# (2026-09-03, captura de Google Maps) y calzada con el place publico
# «PULSO PUCP» de Google (-12.0675895, -77.081028): el extremo norte del
# edificio largo junto a CIGA, al oeste del Auditorio de EEGG Letras. La
# identidad ya la daba pulso.pucp.edu.pe («Casetas - Pabellon de EEGG
# Letras»); el marcador del mapa oficial PUCP existe con lat/lng VACIOS.
# Se dibuja SIEMPRE: el aplicador se orienta desde su base aunque su cita
# este en la otra punta del campus (dictado 2026-09-03).
.ccx_base_pulso <- function() {
  list(nombre = "PULSO PUCP", lat = -12.0675895, lng = -77.081028,
       fuente = "confirmada")
}

# Un poligono/linea del JSON de geometria a coordenadas npc.
.ccx_xy_npc <- function(xy, L) {
  m <- do.call(rbind, lapply(xy, function(p) c(as.numeric(p[[1]]), as.numeric(p[[2]]))))
  .ccx_proyectar(m[, 1], m[, 2], L)
}

# Rotulo con pastilla blanca semitransparente: sobre un plano lleno de huellas
# el texto suelto se pierde, y una caja opaca taparia lo que nombra.
.ccx_rotulo_pastilla <- function(nombre, x, y, fontsize, col, fontface = "plain") {
  grid::grid.roundrect(
    x = x, y = y, width = 0.010 + nchar(nombre) * fontsize * 0.00102,
    height = 0.0125, r = grid::unit(2.4, "pt"), default.units = "npc",
    gp = grid::gpar(fill = grDevices::adjustcolor("#ffffff", alpha.f = 0.82), col = NA)
  )
  grid::grid.text(nombre, x = x, y = y, default.units = "npc",
    gp = grid::gpar(col = col, fontsize = fontsize, fontface = fontface))
}

# Dibuja el croquis completo sobre la pagina ya abierta y devuelve warnings.
# `venue_raw` es el aula CRUDA (sin el relleno «Por confirmar»): el vacio se
# declara con subtitulo propio y warning, nunca se dibuja roto.
.ccx_dibujar_croquis <- function(venue_raw, page_no = 1L) {
  tokens <- pulso_pdf_tokens()
  L <- .ccx_layout()
  geo <- pulso_pdf_geo("portrait")
  paleta <- .ccx_paleta_tonos()
  pb <- .ccx_pabellones()
  venue <- trimws(as.character(venue_raw %||% "")[1])
  if (is.na(venue)) venue <- ""
  lugares <- .ccx_lugares_de_venue(venue)
  letras_venue <- .ccx_letras_de_venue(venue)
  # Solo se resalta lo que EXISTE en el croquis; el resto se declara.
  letras_sel <- letras_venue[letras_venue %in% pb$letra]
  warnings <- list()
  for (letra in setdiff(letras_venue, letras_sel)) {
    warnings[[length(warnings) + 1L]] <- list(
      code = "croquis_pabellon_desconocido", page = page_no, letra = letra
    )
  }

  grid::grid.rect(gp = grid::gpar(fill = "#ffffff", col = NA))

  grid::grid.text("CROQUIS DEL CAMPUS PUCP", x = 0.5, y = L$y_title,
    gp = grid::gpar(col = tokens$navy, fontsize = 15, fontface = "bold"))
  if (!length(letras_venue)) {
    warnings[[length(warnings) + 1L]] <- list(
      code = "croquis_sin_pabellon", page = page_no
    )
  }
  sub <- .ccx_subtitulo_croquis(venue)
  grid::grid.text(sub, x = 0.5, y = L$y_sub,
    gp = grid::gpar(col = tokens$soft, fontsize = if (nchar(sub) > 64L) 9 else 10))
  pulso_pdf_hairline(0.08, 0.92, L$y_sub - 0.018, tokens = tokens)

  # **Todo el mapa dentro de su marco (C2).** El croquis se dibuja en
  # coordenadas de pagina, asi que un vertice de camino que cruce el borde del
  # bbox aterrizaba donde le tocara: medido, 309 pixeles de geometria OSM se
  # colaban por encima del mapa e invadian la banda del subtitulo, y un glifo
  # suelto quedaba sobre el titulo. El recorte es solo VERTICAL —de `y0` al
  # tope— y deja el ancho completo de pagina: los rotulos de las puertas viven
  # a los lados del terreno y cortarlos si seria mutilar dato.
  # `grid.clip` y no un viewport propio: un viewport con otra altura REMAPEA
  # las coordenadas npc y descolocaria todo el dibujo (medido: los chips
  # resaltados desaparecian). Esto solo fija la region de recorte del viewport
  # actual, dejando el sistema de coordenadas de pagina intacto.
  grid::grid.clip(
    x = 0.5, y = L$y0 + L$h / 2, width = 1, height = L$h,
    default.units = "npc"
  )

  # Terreno.
  borde <- .ccx_borde_campus()
  pin <- .ccx_proyectar(borde$lat, borde$lng, L)
  grid::grid.polygon(x = pin$x, y = pin$y, default.units = "npc",
    gp = grid::gpar(fill = "#f4f6f9", col = tokens$tbl_frame, lwd = 1.1))

  # Avenidas: banda tenue fuera del borde, rotulo en su angulo real. Tras el
  # giro de 180, el este queda a la IZQUIERDA y el sur ARRIBA: los offsets
  # empujan hacia afuera del terreno en su lado nuevo, y el angulo del texto
  # se normaliza para no imprimirse boca abajo.
  ang_legible <- function(p) {
    ang <- atan2((p$y[2] - p$y[1]) * geo$page_h,
                 (p$x[2] - p$x[1]) * geo$page_w) * 180 / pi
    if (ang > 90) ang <- ang - 180
    if (ang < -90) ang <- ang + 180
    ang
  }
  este <- .ccx_proyectar(c(-12.0747, -12.0650), c(-77.0770, -77.0781), L)
  off <- 0.016
  grid::grid.lines(x = este$x - off, y = este$y, default.units = "npc",
    gp = grid::gpar(col = tokens$line, lwd = 5))
  grid::grid.text("Av. Universitaria", x = mean(este$x) - off - 0.018,
    y = mean(este$y), rot = ang_legible(este),
    gp = grid::gpar(col = tokens$faint, fontsize = 7, fontface = "italic"))
  oeste <- .ccx_proyectar(c(-12.0658, -12.0746), c(-77.0818, -77.0838), L)
  grid::grid.lines(x = oeste$x + off, y = oeste$y, default.units = "npc",
    gp = grid::gpar(col = tokens$line, lwd = 5))
  grid::grid.text("Av. José de la Riva Agüero",
    x = mean(oeste$x) + off + 0.018, y = mean(oeste$y), rot = ang_legible(oeste),
    gp = grid::gpar(col = tokens$faint, fontsize = 7, fontface = "italic"))
  sur <- .ccx_proyectar(c(-12.0746, -12.0747), c(-77.0838, -77.0770), L)
  grid::grid.lines(x = sur$x, y = sur$y + 0.011, default.units = "npc",
    gp = grid::gpar(col = tokens$line, lwd = 5))
  grid::grid.text("Av. Manuel Cipriano Dulanto",
    x = mean(sur$x), y = mean(sur$y) + 0.011 + 0.009,
    gp = grid::gpar(col = tokens$faint, fontsize = 7, fontface = "italic"))

  # Geometria OSM: verdes -> caminos -> huellas. Si el JSON faltara (paquete a
  # medio instalar), el croquis degrada a chips sobre el terreno y lo declara.
  geom <- .ccx_geometria()
  if (is.null(geom)) {
    warnings[[length(warnings) + 1L]] <- list(
      code = "croquis_sin_geometria", page = page_no
    )
  } else {
    for (v in geom$verdes) {
      p <- .ccx_xy_npc(v$xy, L)
      colf <- if (identical(v$clase, "cancha")) "#dfe9dc" else "#e9f0e7"
      grid::grid.polygon(x = p$x, y = p$y, default.units = "npc",
        gp = grid::gpar(fill = colf, col = NA))
    }
    for (cam in geom$caminos) {
      p <- .ccx_xy_npc(cam$xy, L)
      if (identical(cam$clase, "servicio")) {
        grid::grid.lines(x = p$x, y = p$y, default.units = "npc",
          gp = grid::gpar(col = "#e3e8ef", lwd = 2.4, lineend = "round", linejoin = "round"))
      } else {
        grid::grid.lines(x = p$x, y = p$y, default.units = "npc",
          gp = grid::gpar(col = "#ffffff", lwd = 1.5, lineend = "round", linejoin = "round"))
      }
    }
    for (ed in geom$edificios) {
      p <- .ccx_xy_npc(ed$xy, L)
      letra_ed <- ed$letra
      if (!is.null(letra_ed)) {
        tono_ed <- .ccx_tono_de_pabellon(letra_ed)
        col_ed <- paleta[[tono_ed + 1L]]
        resaltada <- letra_ed %in% letras_sel
        grid::grid.polygon(x = p$x, y = p$y, default.units = "npc",
          gp = grid::gpar(
            fill = grDevices::adjustcolor(col_ed, alpha.f = if (resaltada) 0.55 else 0.18),
            col = grDevices::adjustcolor(col_ed, alpha.f = if (resaltada) 1 else 0.65),
            lwd = if (resaltada) 1.6 else 0.8))
      } else {
        grid::grid.polygon(x = p$x, y = p$y, default.units = "npc",
          gp = grid::gpar(fill = "#e2e7ee", col = "#c8d0dc", lwd = 0.5))
      }
    }
  }

  # Hitos y zonas: rotulos con pastilla sobre sus huellas.
  hitos <- .ccx_hitos()
  ph <- .ccx_proyectar(hitos$lat, hitos$lng, L)
  for (i in seq_len(nrow(hitos))) {
    .ccx_rotulo_pastilla(hitos$nombre[i], ph$x[i], ph$y[i], 6.2, tokens$soft)
  }
  zonas <- .ccx_zonas()
  pz <- .ccx_proyectar(zonas$lat, zonas$lng, L)
  for (i in seq_len(nrow(zonas))) {
    .ccx_rotulo_pastilla(zonas$nombre[i], pz$x[i], pz$y[i], 6.2, tokens$faint,
                         fontface = "italic")
  }

  # Puertas.
  puertas <- .ccx_puertas()
  pp <- .ccx_proyectar(puertas$lat, puertas$lng, L)
  for (i in seq_len(nrow(puertas))) {
    x <- pp$x[i]; y <- pp$y[i]
    grid::grid.points(x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
      pch = 23, size = grid::unit(7, "pt"),
      gp = grid::gpar(fill = tokens$navy, col = "#ffffff", lwd = 1))
    lado <- puertas$lado[i]
    # Girado 180: la etiqueta de una puerta del este sale hacia la izquierda,
    # la del oeste hacia la derecha, y la del norte hacia abajo.
    dx <- if (identical(lado, "este")) -0.012 else if (identical(lado, "oeste")) 0.012 else 0
    dy <- if (identical(lado, "norte")) -0.016 else 0
    just <- if (identical(lado, "este")) "right" else if (identical(lado, "oeste")) "left" else "centre"
    grid::grid.text(puertas$nombre[i], x = x + dx, y = y + dy, just = just,
      gp = grid::gpar(col = tokens$navy, fontsize = 6, fontface = "bold"))
  }

  # Chips de letra: el interfaz operativo del croquis, encima de todo. El
  # seleccionado con relleno pleno + anillo; el resto en trazo suave de su
  # tono. El color sale SOLO de la letra (paridad B31).
  ppb <- .ccx_proyectar(pb$lat, pb$lng, L)
  lado <- L$lado_pabellon
  alto <- lado * geo$page_w / geo$page_h
  # **Los resaltados se dibujan AL FINAL.** Recorrer la tabla en su orden
  # dejaba que el vecino posterior tapara al resaltado: K y O distan 0.0173 npc
  # —un 56 % del lado del chip— y K se dibuja antes, asi que la O le comia el
  # anillo justo cuando la ficha era de la K (dictado de Gonzalo, 2026-09-03:
  # «si el aula a la que va a aplicar el QR es la K, esa deberia estar por
  # encima»). El orden entre los NO resaltados se conserva: quien manda es la
  # que la ficha señala, y solo esa.
  orden <- c(
    which(!(pb$letra %in% letras_sel)),
    which(pb$letra %in% letras_sel)
  )
  for (i in orden) {
    tono <- .ccx_tono_de_pabellon(pb$letra[i])
    colr <- paleta[[tono + 1L]]
    if (pb$letra[i] %in% letras_sel) {
      grid::grid.circle(x = ppb$x[i], y = ppb$y[i],
        r = grid::unit(lado * 1.05, "npc"), default.units = "npc",
        gp = grid::gpar(col = colr, lwd = 1.8,
                        fill = grDevices::adjustcolor(colr, alpha.f = 0.14)))
      grid::grid.roundrect(x = ppb$x[i], y = ppb$y[i], width = lado, height = alto,
        r = grid::unit(2.2, "pt"), default.units = "npc",
        gp = grid::gpar(fill = colr, col = colr, lwd = 1.4))
      grid::grid.text(pb$letra[i], x = ppb$x[i], y = ppb$y[i],
        gp = grid::gpar(col = "#ffffff", fontsize = 11, fontface = "bold"))
      # La pastilla con el AULA junto al anillo: la letra dice el edificio, el
      # codigo dice el salon — y con dos pabellones cada uno carga el suyo.
      # El sitio se elige esquivando lo ya rotulado (abajo → arriba → derecha
      # → izquierda): A tiene a B a 25 m, H tiene a Z arriba y al rotulo de
      # Derecho·CC.SS. abajo; sin esta busqueda alguna pastilla siempre tapa
      # algo.
      aulas_de <- lugares[vapply(lugares, function(lg) {
        identical(.ccx_letra_de_pabellon(lg), pb$letra[i])
      }, logical(1))]
      if (length(aulas_de)) {
        etiqueta <- paste(toupper(aulas_de), collapse = " · ")
        w_pill <- 0.012 + nchar(etiqueta) * 0.0068
        obst_x <- c(ppb$x[-i], ph$x, pz$x)
        obst_y <- c(ppb$y[-i], ph$y, pz$y)
        obst_hw <- c(rep(lado / 2, nrow(pb) - 1L),
                     0.010 + nchar(hitos$nombre) * 6.2 * 0.00051,
                     0.010 + nchar(zonas$nombre) * 6.2 * 0.00051)
        obst_hh <- c(rep(alto / 2, nrow(pb) - 1L),
                     rep(0.00625, nrow(hitos)), rep(0.00625, nrow(zonas)))
        salto <- lado * 1.05 + 0.011
        salto_x <- lado * 1.05 + w_pill / 2 + 0.004
        candidatos <- list(
          c(ppb$x[i], ppb$y[i] - salto), c(ppb$x[i], ppb$y[i] + salto),
          c(ppb$x[i] + salto_x, ppb$y[i]), c(ppb$x[i] - salto_x, ppb$y[i])
        )
        libre <- function(p) !any(
          abs(obst_x - p[1]) < (obst_hw + w_pill / 2) &
          abs(obst_y - p[2]) < (obst_hh + 0.0065)
        )
        sitio <- candidatos[[1]]
        for (cand in candidatos) if (libre(cand)) { sitio <- cand; break }
        grid::grid.roundrect(x = sitio[1], y = sitio[2], width = w_pill, height = 0.013,
          r = grid::unit(2.6, "pt"), default.units = "npc",
          gp = grid::gpar(fill = grDevices::adjustcolor("#ffffff", alpha.f = 0.94),
                          col = colr, lwd = 0.9))
        grid::grid.text(etiqueta, x = sitio[1], y = sitio[2],
          gp = grid::gpar(col = colr, fontsize = 6.6, fontface = "bold"))
      }
    } else {
      grid::grid.roundrect(x = ppb$x[i], y = ppb$y[i], width = lado, height = alto,
        r = grid::unit(2.2, "pt"), default.units = "npc",
        gp = grid::gpar(fill = "#ffffff", lwd = 1.1,
                        col = grDevices::adjustcolor(colr, alpha.f = 0.75)))
      grid::grid.text(pb$letra[i], x = ppb$x[i], y = ppb$y[i],
        gp = grid::gpar(col = colr, fontsize = 8.5, fontface = "bold"))
    }
  }

  # La base PULSO PUCP, SIEMPRE y encima de todo: pin navy con su rotulo.
  base <- .ccx_base_pulso()
  pbase <- .ccx_proyectar(base$lat, base$lng, L)
  # Pin macizo: navy pleno con doble borde. Sin punto interior — el test de
  # presencia muestrea el centro y un adorno blanco lo volveria ambiguo.
  grid::grid.circle(x = pbase$x, y = pbase$y, r = grid::unit(0.012, "npc"),
    default.units = "npc",
    gp = grid::gpar(fill = "#ffffff", col = tokens$navy, lwd = 1))
  grid::grid.circle(x = pbase$x, y = pbase$y, r = grid::unit(0.009, "npc"),
    default.units = "npc",
    gp = grid::gpar(fill = tokens$navy, col = tokens$navy))
  .ccx_rotulo_pastilla(base$nombre, pbase$x, pbase$y - 0.020, 6.6, tokens$navy,
                       fontface = "bold")

  # Norte: girado el mapa, la flecha apunta hacia ABAJO — sigue apuntando al
  # norte de verdad.
  nx <- L$x0 + L$w - 0.012; ny <- L$y0 + L$h - 0.008
  grid::grid.lines(x = c(nx, nx), y = c(ny, ny - 0.026), default.units = "npc",
    arrow = grid::arrow(length = grid::unit(4, "pt"), type = "closed"),
    gp = grid::gpar(col = tokens$soft, fill = tokens$soft, lwd = 1.2))
  grid::grid.text("N", x = nx, y = ny - 0.036,
    gp = grid::gpar(col = tokens$soft, fontsize = 7, fontface = "bold"))

  # Barra de escala: 100 m medidos con la MISMA proyeccion del croquis, para
  # que «que tan lejos queda» tenga respuesta de pie, no solo de vista.
  metros_ancho <- (L$lng1 - L$lng0) * 111320 * cos(12.07 * pi / 180)
  barra_w <- 100 / metros_ancho * L$w
  bx <- L$x0 + 0.014; by <- L$y0 + 0.016
  grid::grid.lines(x = c(bx, bx + barra_w), y = c(by, by), default.units = "npc",
    gp = grid::gpar(col = tokens$soft, lwd = 1.4))
  for (tx in c(bx, bx + barra_w)) {
    grid::grid.lines(x = c(tx, tx), y = c(by - 0.003, by + 0.003),
      default.units = "npc", gp = grid::gpar(col = tokens$soft, lwd = 1.4))
  }
  grid::grid.text("100 m", x = bx + barra_w / 2, y = by + 0.009,
    gp = grid::gpar(col = tokens$soft, fontsize = 5.8))

  # Atribucion ODbL de la capa de huellas: obligacion de la licencia y
  # honestidad del dibujo — las posiciones son nuestras, la geometria no.
  grid::grid.text("Geometría © colaboradores de OpenStreetMap",
    x = L$x0 + L$w - 0.010, y = L$y0 + 0.012, just = "right",
    gp = grid::gpar(col = tokens$faint, fontsize = 4.8))

  # Leyenda (cinco entradas: la base PULSO tambien se explica).
  # Se libera el recorte: la leyenda y el pie viven fuera del marco del mapa.
  grid::grid.clip(x = 0.5, y = 0.5, width = 1, height = 1, default.units = "npc")

  ly <- L$y_leyenda
  lx <- 0.075
  paso <- c(0.205, 0.165, 0.19, 0.165, 0.17)
  etiquetas <- c("Pabellón donde aplicas", "Otros pabellones",
                 "Edificio de referencia", "Puerta de ingreso",
                 "Base PULSO PUCP")
  for (k in 1:5) {
    if (k == 1L) {
      grid::grid.circle(x = lx, y = ly, r = grid::unit(0.0105, "npc"),
        default.units = "npc", gp = grid::gpar(col = tokens$navy, fill = NA, lwd = 1.4))
      grid::grid.roundrect(x = lx, y = ly, width = 0.016, height = 0.011,
        r = grid::unit(1.5, "pt"), default.units = "npc",
        gp = grid::gpar(fill = tokens$navy, col = tokens$navy))
    } else if (k == 2L) {
      grid::grid.roundrect(x = lx, y = ly, width = 0.016, height = 0.011,
        r = grid::unit(1.5, "pt"), default.units = "npc",
        gp = grid::gpar(fill = "#ffffff", col = tokens$soft, lwd = 1))
    } else if (k == 3L) {
      grid::grid.roundrect(x = lx, y = ly, width = 0.016, height = 0.011,
        r = grid::unit(1.5, "pt"), default.units = "npc",
        gp = grid::gpar(fill = "#e2e7ee", col = "#c8d0dc", lwd = 0.8))
    } else if (k == 4L) {
      grid::grid.points(x = grid::unit(lx, "npc"), y = grid::unit(ly, "npc"),
        pch = 23, size = grid::unit(6, "pt"),
        gp = grid::gpar(fill = tokens$navy, col = "#ffffff"))
    } else {
      grid::grid.circle(x = lx, y = ly, r = grid::unit(0.008, "npc"),
        default.units = "npc",
        gp = grid::gpar(fill = "#ffffff", col = tokens$navy, lwd = 1))
      grid::grid.circle(x = lx, y = ly, r = grid::unit(0.0058, "npc"),
        default.units = "npc",
        gp = grid::gpar(fill = tokens$navy, col = tokens$navy))
    }
    grid::grid.text(etiquetas[k], x = lx + 0.014, y = ly, just = "left",
      gp = grid::gpar(col = tokens$ink, fontsize = 6.6))
    lx <- lx + paso[k]
  }

  warnings
}

#' Dibuja una pagina compilada con el layout `croquis_campus`.
#'
#' El verso de la ficha de campo: mismo contrato que sus hermanos
#' (`collection_material_draw_field_form`). No tiene QR ni enlace, asi que
#' `links` sale vacio; el pie es solo el logo, como en la cara de la ficha.
#'
#' @param page pagina de `collection_material_compile`.
#' @param page_no numero visible.
#' @param total_pages total visible.
#' @param brand_assets ignorado (el verso no lleva careta); presente por firma.
#' @return lista con `warnings`, `links` y `zones` (npc, una por bloque dibujado).
#' @export
collection_material_draw_campus_croquis <- function(page, page_no = 1L,
                                                    total_pages = 1L,
                                                    brand_assets = list()) {
  tokens <- pulso_pdf_tokens()
  geo <- pulso_pdf_geo(page$orientation %||% "portrait")
  grid::grid.newpage()
  # `venue_raw`, no `venue`: el compilado rellena el vacio con «Por confirmar»
  # y preguntarle a esa cadena si hay aula responde que si SIEMPRE.
  warnings <- .ccx_dibujar_croquis(page$unit$venue_raw, page_no)
  pulso_pdf_footer(page_no, periodo = "", tokens = tokens, geo = geo, pagina = FALSE)
  # El croquis se dibuja entero haya o no bloque `campus_map`: del titulo
  # (centrado en `y_title`) a la leyenda (`y_leyenda`, marcas de radio 0.0105),
  # a lo ancho de la hoja —el recorte del mapa es solo vertical y los rotulos de
  # puertas y avenidas viven a los costados del terreno—.
  mapa <- .crf_block(page, "campus_map")
  L <- .ccx_layout()
  zones <- list(
    .cmz_zone(
      mapa$block_id, "campus_map", geo$margin, 1 - geo$margin,
      L$y_leyenda - 0.013, L$y_title + .cmz_alto_lineas(1L, 15, 1, geo) / 2 + 0.003,
      kind = if (is.null(mapa)) "derived" else "block"
    ),
    .crf_footer_zona(.crf_block(page, "footer"), geo)
  )
  list(warnings = warnings, links = list(), zones = .cmz_sin_solapes(zones))
}

#' Lamina suelta del croquis del campus (referencia general del operativo).
#'
#' La misma pagina que el verso de la ficha, servida sola: con `venue` resalta
#' ese pabellon; con `NULL` sale la lamina general sin resaltado (declarado
#' con su propio subtitulo, no roto).
#'
#' @param path archivo de salida.
#' @param venue aula («A206») cuyo pabellon se resalta, o `NULL`.
#' @param device pdf o png.
#' @param dpi resolucion del PNG.
#' @return metadatos del render con sus warnings.
#' @export
collection_croquis_lamina <- function(path, venue = NULL,
                                      device = c("pdf", "png"), dpi = 150) {
  device <- match.arg(device)
  tokens <- pulso_pdf_tokens()
  geo <- pulso_pdf_geo("portrait")
  .crf_open_device(path, device, "portrait", dpi)
  device_open <- TRUE
  on.exit(if (device_open) grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  warnings <- .ccx_dibujar_croquis(venue, 1L)
  pulso_pdf_footer(1L, periodo = "", tokens = tokens, geo = geo, pagina = FALSE)
  grDevices::dev.off()
  device_open <- FALSE
  list(path = path, device = device, page_count = 1L, warnings = warnings)
}
