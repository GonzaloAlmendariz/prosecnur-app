# Layout `field_form`: la ficha de papel que el aplicador lleva al aula.
#
# Reproduce la hoja que el equipo ya usaba en campo: el QR ocupa la mayor parte
# de la pagina — tiene que escanearse rapido, muchas veces, en un aula — y
# debajo va un formulario de lineas en mayusculas que se llena a mano.
#
# La diferencia de fondo con `single_sheet` no es estetica: alli los datos vienen
# en un grid de etiqueta/valor; aqui van sobre el MISMO renglon que se llena a
# mano, porque la hoja es un parte de campo y no una ficha de datos.
#
# Que un campo se imprima o se deje en blanco lo decide una sola pregunta: si el
# plan conoce el dato ANTES de imprimir. Los que si —facultad, pabellon y aula,
# curso, horario, docente y matriculados, todos declarados con `binding` en
# `collection_material_field_form_rows()`— salen impresos, porque copiarlos a
# mano de otra hoja es un paso de mas que puede fallar. Los que no —cuantos
# asistieron, cuantos rechazaron, quien aplico, a que hora— son espacio en blanco
# bien pautado.
#
# Un campo con `binding` cuyo dato llegue vacio NO desaparece: cae a su raya, que
# es lo que hace el aula cuando el catalogo no la trae.

.cfc_layout <- function() {
  list(
    # 0.55 de simbolo UTIL, no 0.68 de matriz con su zona de silencio dentro:
    # con 33 modulos aquello dejaba 0.515 de simbolo real. El tope no es el ancho
    # de la hoja sino el titulo, que en este layout va DEBAJO del QR (`y_title`
    # 0.392): la matriz ampliada llegaba a 0.368 y se lo comia.
    # 0.62 y no 0.55: los renglones que liberaron la poda de 2026-09-03
    # —seis impresos en tres filas, «Efectivas» fuera— se los queda el
    # simbolo, que es lo que se escanea muchas veces en un aula. Con este
    # lado mide 0.438 npc de alto y, centrado en 0.750, va de 0.531 a 0.969:
    # el mismo margen superior de antes.
    qr_side = 0.62,
    qr_x = 0.50,
    # La hoja tenia 239 px de blanco por encima del QR contra 43 por debajo del
    # pie —medido sobre el PNG a 150 dpi, 13,6 % del alto arriba y 2,5 % abajo—
    # y otros 144 px de hueco entre el QR y su titulo. Ese aire no lo pedia
    # nadie: el QR ocupa 0.389 del alto y lo demas es formulario, asi que subir
    # el simbolo hasta casi el borde libera media pagina de renglones.
    #
    # Con `qr_side` 0.55 el simbolo mide 0.389 npc de alto (es cuadrado, y el
    # lado se declara sobre el ANCHO): con el centro en 0.775 va de 0.581 a
    # 0.970, o sea 0.030 de margen superior, casi el mismo que el inferior.
    qr_y = 0.750,
    x_left = 0.075,
    x_right = 0.925,
    y_brand = 0.955,
    # El titulo va centrado DEBAJO del QR: es el id del colector, o sea el
    # nombre de esta ficha concreta, y se lee junto al simbolo que lo codifica.
    y_title = 0.495,
    title_size = 16,
    form_top = 0.440,
    # 0.040, no 0.029: el aire recuperado arriba se reparte entre los renglones
    # en vez de acumularse en un margen. Son ~70 px entre lineas a 150 dpi
    # —12 mm de papel— contra los ~51 px de antes, que es lo que hace falta para
    # escribir a mano encima. Con 10 renglones el ultimo cae en 0.120, por
    # encima del suelo y del enlace. Medido contra el PNG real, no solo la
    # aritmetica: verificar con `.cfx_grey()`/`test-collection-ficha-campo.R` si
    # se vuelve a tocar.
    form_step = 0.040,
    form_floor = 0.120,
    label_size = 8.6,
    gap = 0.008,
    # El enlace impreso al pie no es decoracion: es el unico camino a la
    # encuesta cuando el QR no escanea — hoja mal impresa, manchada o doblada.
    # Una ficha cuyo unico portador del enlace es la imagen del QR es papel
    # muerto en cuanto esa imagen falla.
    y_link = 0.092,
    # 9 pt medidos, no elegidos a ojo: a este cuerpo la URL entera ocupa 0.743
    # de los 0.850 npc disponibles y no se parte en dos lineas. Es el respaldo
    # que alguien va a teclear a mano, asi que tiene que leerse.
    link_size = 9
  )
}

# Ancho real de un texto con su gpar, medido por el device en vez de estimado
# por conteo de caracteres: las etiquetas del formulario tienen largos muy
# distintos ("DOCENTE:" vs "N° DE ENCUESTAS APLICADAS:") y una estimacion
# desalinea todas las lineas del renglon.
.cfc_text_width <- function(text, gp) {
  grid::pushViewport(grid::viewport(gp = gp))
  on.exit(grid::popViewport(), add = TRUE)
  grid::convertWidth(grid::stringWidth(text), "npc", valueOnly = TRUE)
}

# Un valor impreso NUNCA se sale de su celda.
#
# El renderer dibuja el valor donde termina la etiqueta y no mide nada mas, asi
# que un dato largo se comia la celda de al lado y, en la ultima de la fila, el
# margen de la hoja. Medido sobre el libro de HSVG2026: el horario llega a 141
# caracteres cuando el curso tiene cuatro sesiones («LUN 18:00-22:00 · MAR
# 18:00-22:00 · …») y el nombre del curso a 128, contra un p99 de 51 y 65. Son
# pocos, y por eso el defecto seria de los que se descubren en la impresora.
#
# Se recorta con elipsis y no se reduce el cuerpo: bajar el tamaño de letra en
# las fichas largas haria que las 1.512 hojas no se parezcan entre si, y la
# elipsis al menos DICE que hay mas. Lo completo siempre esta en el plan.
.cfc_recortar <- function(valor, disponible, gp) {
  if (!nzchar(valor)) return(valor)
  # Sin hueco no se imprime nada. Devolver el valor entero «porque no cabe de
  # todos modos» es justo el caso que deforma la hoja, y el llamador avisa.
  if (disponible <= 0) return("")
  if (.cfc_text_width(valor, gp) <= disponible) return(valor)
  # Busqueda binaria sobre el numero de caracteres: medir cada prefijo uno a uno
  # son 141 mediciones de texto por celda y esto corre 1.512 veces.
  lo <- 0L
  hi <- nchar(valor)
  while (lo < hi) {
    mid <- (lo + hi + 1L) %/% 2L
    if (.cfc_text_width(paste0(substr(valor, 1L, mid), "…"), gp) <= disponible) lo <- mid else hi <- mid - 1L
  }
  if (lo <= 0L) return("")
  paste0(trimws(substr(valor, 1L, lo)), "…")
}

# Parte un valor impreso en dos lineas por PALABRAS: lo que cabe en el primer
# hueco (tras la etiqueta) y el resto para la segunda linea. Devuelve NULL si
# el valor entero cabe en el primer hueco — el llamador imprime como siempre.
#
# Existe porque la elipsis recortaba DATO OPERATIVO: el nombre del curso llega
# a 128 caracteres y el horario a 141 (cuatro sesiones), y «DELITOS CONTRA LA
# VIDA, EL CUERPO,…» en la ficha impresa obliga al aplicador a adivinar el
# resto (lo señaló Gonzalo, 2026-09-01). El aire entre renglones (12 mm, para
# escribir a mano) admite una segunda linea tipografica de 8.6 pt sin robar
# renglones de escritura ni mover la geometria de la hoja.
.cfc_partir <- function(valor, disponible, gp) {
  if (!nzchar(valor) || disponible <= 0) return(NULL)
  if (.cfc_text_width(valor, gp) <= disponible) return(NULL)
  palabras <- strsplit(valor, " ", fixed = TRUE)[[1]]
  # Ni la primera palabra cabe: no hay corte de palabra digno, que decida el
  # recortador clasico del llamador.
  if (.cfc_text_width(palabras[[1]], gp) > disponible) return(NULL)
  n <- 1L
  while (n < length(palabras) &&
         .cfc_text_width(paste(palabras[seq_len(n + 1L)], collapse = " "), gp) <= disponible) {
    n <- n + 1L
  }
  list(
    primera = paste(palabras[seq_len(n)], collapse = " "),
    resto = paste(palabras[-seq_len(n)], collapse = " ")
  )
}

#' Dibuja el bloque de renglones para llenar a mano.
#'
#' @param rows renglones compilados; cada uno con `fields` de `label` y `span`.
#' @param L layout de la ficha de campo.
#' @param tokens paleta Pulso.
#' @return lista de warnings.
#' @keywords internal
.cfc_draw_form <- function(rows, L, tokens) {
  warnings <- list()
  width <- L$x_right - L$x_left
  gp <- grid::gpar(col = tokens$ink, fontsize = L$label_size, fontface = "bold")

  # La capacidad se cuenta en RENGLONES DIBUJADOS, no en filas: un campo con
  # `lines = 2` ocupa dos. Contarlo por filas dejaba pasar una hoja que no cabe.
  .lineas_de <- function(row) {
    max(1L, max(vapply(row$fields %||% list(), function(cell) {
      n <- suppressWarnings(as.integer(cell$lines %||% 1L))
      if (length(n) != 1L || is.na(n) || n < 1L) 1L else n
    }, integer(1)), 1L))
  }
  capacity <- max(1L, as.integer(floor((L$form_top - L$form_floor) / L$form_step)) + 1L)
  usadas <- cumsum(vapply(rows, .lineas_de, integer(1)))
  if (length(usadas) && usadas[[length(usadas)]] > capacity) {
    caben <- sum(usadas <= capacity)
    warnings[[length(warnings) + 1L]] <- list(
      code = "form_lines_overflow",
      rows = length(rows), visible_rows = max(1L, caben)
    )
    rows <- rows[seq_len(max(1L, caben))]
  }

  linea <- 0L
  for (i in seq_along(rows)) {
    y <- L$form_top - linea * L$form_step
    cells <- rows[[i]]$fields %||% list()
    linea <- linea + .lineas_de(rows[[i]])
    cursor <- L$x_left
    for (cell in cells) {
      label <- toupper(.crf_txt(cell$label, ""))
      span <- as.numeric(cell$span %||% (1 / length(cells))) * width
      grid::grid.text(
        label, x = cursor, y = y, just = c("left", "bottom"),
        default.units = "npc", gp = gp
      )
      valor <- .crf_txt(cell$value, "")
      if (nzchar(valor)) {
        # Un dato que el plan YA conoce (ej. matriculados) se imprime en vez de
        # dejarse en blanco: copiarlo a mano es un paso de mas que puede fallar.
        # Sin raya -no es un campo para llenar- y en peso normal para
        # distinguirlo visualmente de la etiqueta en negrita.
        valor_x <- cursor + .cfc_text_width(label, gp) + L$gap
        valor_gp <- grid::gpar(col = tokens$ink, fontsize = L$label_size, fontface = "plain")
        # El hueco real de esta celda, medido hasta donde empieza la siguiente.
        hueco <- cursor + span - L$gap - valor_x
        # Un valor que no cabe ENVUELVE a una segunda linea (el ancho de la
        # celda, colgada en el aire entre renglones) antes de recortarse: la
        # elipsis queda solo de red cuando ni dos lineas alcanzan. Ver
        # `.cfc_partir()`.
        partes <- .cfc_partir(valor, hueco, valor_gp)
        if (!is.null(partes)) {
          grid::grid.text(
            partes$primera, x = valor_x, y = y,
            just = c("left", "bottom"), default.units = "npc", gp = valor_gp
          )
          grid::grid.text(
            .cfc_recortar(partes$resto, span - L$gap, valor_gp),
            x = cursor, y = y - 0.014,
            just = c("left", "bottom"), default.units = "npc", gp = valor_gp
          )
        } else {
          impreso <- .cfc_recortar(valor, hueco, valor_gp)
          if (!nzchar(impreso)) {
            warnings[[length(warnings) + 1L]] <- list(
              code = "form_value_no_room", label = label, row = i
            )
          }
          grid::grid.text(
            impreso, x = valor_x, y = y,
            just = c("left", "bottom"), default.units = "npc",
            gp = valor_gp
          )
        }
      } else if (nzchar(.crf_txt(cell$note, ""))) {
        # Un campo con NOTA dice algo en vez de pedirlo: texto tenue en
        # cursiva y NINGUNA raya. La raya es una invitación a escribir, y este
        # campo existe justo para que nadie escriba en él —«Efectivas» la
        # calcula el sistema desde la plataforma, no el ojo del aplicador—.
        nota_gp <- grid::gpar(col = tokens$soft, fontsize = L$label_size - 0.6, fontface = "italic")
        nota_x <- cursor + .cfc_text_width(label, gp) + L$gap
        grid::grid.text(
          .cfc_recortar(.crf_txt(cell$note, ""), cursor + span - L$gap - nota_x, nota_gp),
          x = nota_x, y = y, just = c("left", "bottom"),
          default.units = "npc", gp = nota_gp
        )
      } else {
        rule_from <- cursor + .cfc_text_width(label, gp) + L$gap
        rule_to <- cursor + span - L$gap
        if (rule_to > rule_from) {
          grid::grid.lines(
            x = grid::unit(c(rule_from, rule_to), "npc"),
            y = grid::unit(y - 0.004, "npc"),
            gp = grid::gpar(col = tokens$ink, lwd = 0.7)
          )
          # Los renglones extra de un campo con `lines > 1` arrancan en el
          # margen, no donde acaba la etiqueta: la etiqueta ya se dijo una vez y
          # sangrar la segunda linea solo roba sitio para escribir.
          n_lineas <- suppressWarnings(as.integer(cell$lines %||% 1L))
          if (length(n_lineas) == 1L && !is.na(n_lineas) && n_lineas > 1L) {
            for (k in seq_len(n_lineas - 1L)) {
              grid::grid.lines(
                x = grid::unit(c(cursor, rule_to), "npc"),
                y = grid::unit(y - k * L$form_step - 0.004, "npc"),
                gp = grid::gpar(col = tokens$ink, lwd = 0.7)
              )
            }
          }
        } else {
          # La etiqueta se comio su propio renglon: no hay donde escribir. Se
          # avisa en vez de dibujar una raya de un milimetro que nadie puede usar.
          warnings[[length(warnings) + 1L]] <- list(
            code = "form_field_no_room", label = label, row = i
          )
        }
      }
      cursor <- cursor + span
    }
  }
  warnings
}

#' Dibuja una pagina compilada con el layout `field_form`.
#'
#' @param page pagina de `collection_material_compile`.
#' @param page_no numero visible.
#' @param total_pages total visible.
#' @param brand_assets mapa efimero id -> ruta PNG de los logos de la careta.
#' @return lista con `warnings` y `links`.
#' @export
collection_material_draw_field_form <- function(page, page_no = 1L, total_pages = 1L,
                                                brand_assets = list()) {
  tokens <- pulso_pdf_tokens()
  type <- pulso_pdf_type()
  geo <- pulso_pdf_geo(page$orientation %||% "portrait")
  L <- .cfc_layout()
  brand <- .crf_block(page, "brand_strip")
  heading <- .crf_block(page, "heading")
  qr <- .crf_block(page, "access_qr")
  form <- .crf_block(page, "form_lines")
  footer <- .crf_block(page, "footer")
  warnings <- list()

  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "#ffffff", col = NA))

  if (!is.null(brand)) {
    for (id in .cra_draw_brand_strip(
      brand$assets, brand_assets, y = L$y_brand,
      max_height_mm = brand$max_height_mm %||% 11,
      align = as.character(brand$align %||% "center")[[1]], geo = geo
    )) {
      warnings[[length(warnings) + 1L]] <- list(
        code = "brand_asset_missing", page = page_no, asset_id = id
      )
    }
  }

  payload <- .crf_txt(qr$value, "")
  if (!is.null(qr)) {
    if (nzchar(payload)) {
      # El hueco reservado es del simbolo; la zona de silencio se derrama sobre
      # el blanco de la hoja. Misma cuenta que la ficha y el afiche, y por la
      # misma funcion: el relector del PNG la aplica a los tres presets.
      qz <- qr$quiet_zone %||% 4L
      mm <- collection_qr_matrix(payload, correction = qr$correction %||% "M", quiet_zone = qz)
      grid::pushViewport(.crf_qr_viewport(
        L$qr_x, L$qr_y, .crf_qr_lado_total(L$qr_side, nrow(mm), qz, L$x_right - L$x_left), geo
      ))
      .crf_draw_qr_modules(mm)
      grid::popViewport()
    } else {
      grid::pushViewport(.crf_qr_viewport(L$qr_x, L$qr_y, L$qr_side, geo))
      grid::grid.rect(gp = grid::gpar(fill = NA, col = tokens$rule, lwd = 0.7))
      grid::grid.text("Sin enlace", gp = grid::gpar(col = tokens$faint, fontsize = type$body))
      grid::popViewport()
    }
  }

  if (!is.null(heading)) {
    titulo <- .crf_txt(heading$value, "")
    if (!nzchar(titulo)) {
      # El titulo es el id del colector. Si el acceso no lo trae, la hoja no
      # sabe como se llama: se cae al rotulo de la unidad y se avisa, en vez de
      # imprimir un hueco centrado bajo el QR.
      titulo <- .crf_txt(page$unit$label, "")
      warnings[[length(warnings) + 1L]] <- list(
        code = "sheet_title_missing", page = page_no
      )
    }
    .cra_draw_centered(
      .crf_wrap(titulo, 40L, 2L), L$y_title,
      grid::gpar(col = tokens$navy, fontsize = L$title_size, fontface = "bold"),
      lineheight = 1.15
    )
  }

  if (!is.null(form)) {
    for (w in .cfc_draw_form(form$rows %||% list(), L, tokens)) {
      w$page <- page_no
      warnings[[length(warnings) + 1L]] <- w
    }
  }

  links <- list()
  if (nzchar(payload)) {
    link_lines <- .crf_wrap(payload, width = 108L, max_lines = 2L)
    .cra_draw_centered(
      link_lines, L$y_link,
      grid::gpar(col = tokens$navy, fontsize = L$link_size), lineheight = 1.05
    )
    link_h <- length(link_lines) * (L$link_size * 1.05 / 72) / geo$page_h
    links[[1]] <- list(
      page = page_no, url = payload, kind = "printed_url",
      x0 = L$x_left, x1 = L$x_right,
      y0 = L$y_link - link_h, y1 = L$y_link + 0.006
    )
    # El QR tambien se clickea: en un PDF que viaja por WhatsApp o correo nadie
    # va a apuntar la camara a su propia pantalla.
    half_h <- (L$qr_side * geo$page_w / geo$page_h) / 2
    links[[2]] <- list(
      page = page_no, url = payload, kind = "qr_area",
      x0 = L$qr_x - L$qr_side / 2, x1 = L$qr_x + L$qr_side / 2,
      y0 = L$qr_y - half_h, y1 = L$qr_y + half_h
    )
  } else {
    warnings[[length(warnings) + 1L]] <- list(code = "access_missing", page = page_no)
  }

  # El pie es SOLO el logo: ni texto al centro ni numero de pagina. En una hoja
  # de una pagina que se reparte suelta por aula ninguno de los dos identifica
  # nada, y el logo ya dice de quien es (dictado de Gonzalo, 2026-09-01).
  pulso_pdf_footer(page_no, periodo = "", tokens = tokens, geo = geo, pagina = FALSE)
  list(warnings = warnings, links = links)
}

#' Renglones por defecto de la ficha de campo, calcados de la hoja en uso.
#'
#' @return lista de renglones para el bloque `form_lines`.
#' @export
collection_material_field_form_rows <- function() {
  fila <- function(...) list(fields = list(...))
  campo <- function(label, span, binding = NULL, lines = NULL, note = NULL) {
    list(label = label, span = span, binding = binding, lines = lines, note = note)
  }
  list(
    # Los cinco primeros campos SE SABEN antes de entrar al aula, asi que se
    # imprimen. Estaban en blanco por una premisa que no se sostiene —«aqui casi
    # ningun dato existe antes de entrar al aula»—: facultad, curso, horario y
    # docente salen del catalogo de cursos-horarios, y el pabellon y aula del
    # string de sesiones. Dejarlos en blanco obligaba al aplicador a copiarlos de
    # otra hoja, que es justo el paso que la ficha existe para ahorrar. La hoja
    # de 2025 que este preset replica los llevaba impresos.
    #
    # Un campo sin dato NO desaparece: cae a su raya, que es lo que hace hoy el
    # aula cuando el catalogo no la trae.
    # **Seis datos impresos, TRES y TRES** (poda de Gonzalo, 2026-09-03: «si
    # son seis items pueden ir tres y tres, de paso ocupan un poquito menos de
    # alto y el QR se puede ver un poquito mas grande»). Antes eran cuatro
    # renglones —dos de ellos a hoja entera por lo largos que llegan curso y
    # horario— y ahora son tres: el alto liberado se lo queda el QR, que es lo
    # que de verdad se usa muchas veces en un aula.
    #
    # Emparejados por afinidad: donde estoy (facultad y aula), que dicto y
    # cuando (curso y horario), quien y cuantos (docente y matriculados).
    # Los tres renglones parten la hoja por la MITAD exacta: con anchos
    # distintos (0.55/0.45, 0.50/0.50, 0.60/0.40) la columna derecha arrancaba
    # en tres sitios y el bloque se leia desalineado — «hay como un poco de
    # disparidad» (Gonzalo, 2026-09-03). Una sola linea de fuga vertical.
    fila(campo("Facultad", 0.5, binding = "unit.faculty"),
         campo("Pabellón y aula:", 0.5, binding = "unit.venue")),
    # Curso y horario comparten renglon a media hoja. Los dos son los largos
    # del lote —el curso llega a 128 caracteres y el horario a 141 con cuatro
    # sesiones, contra un p99 de 65 y 51— y el renglon los ENVUELVE a dos
    # lineas antes de recortar (`.cfc_partir`), asi que el caso corriente entra
    # entero y solo los extremos ven la elipsis.
    fila(campo("Curso:", 0.5, binding = "unit.course_name"),
         campo("Horario:", 0.5, binding = "unit.schedule")),
    fila(campo("Docente:", 0.5, binding = "unit.teacher"),
         campo("N° de alumnos matriculados:", 0.5, binding = "unit.eligible_n")),
    # **Solo lo que el aplicador VE con sus ojos** (dictado de Gonzalo,
    # 2026-09-03: «los aplicadores no tienen una forma de saber si el alumno
    # finalizó la encuesta pasando por los filtros o no»).
    #
    # Se fue el H/M —«Hombres:»/«Mujeres:»—: medido, no existe campo destino en
    # el lector de partes, ni en el parte en-app, ni en el modelo del plan. El
    # aplicador contaba cabezas y el dato moria en el papel. Si algun dia hace
    # falta el denominador por sexo (la plataforma solo sabe el sexo de quien
    # RESPONDIO, no el de los presentes), vuelve CON su campo, no antes.
    #
    # Los asistentes y las aplicadas van juntos y a media hoja cada uno: son
    # los dos numeros grandes del parte y la raya larga es donde se escribe.
    fila(
      campo("N° de alumnos en aula", 0.5),
      campo("N° de encuestas aplicadas:", 0.5)
    ),
    # Por que faltan las que faltan. «Efectivas» NO esta: la calcula el sistema
    # desde la plataforma —que es quien sabe si la respuesta paso los filtros—
    # y ocupaba sitio en el papel para no pedir nada («si las calcula el
    # sistema, que necesidad hay de que este alli», Gonzalo 2026-09-03).
    fila(
      campo("Rechazos:", 0.5), campo("Ya respondieron:", 0.5)
    ),
    fila(campo("Aplicador/a", 1)),
    fila(campo("Fecha:", 0.5), campo("Hora de aplicación:", 0.5)),
    # Espacio libre para lo que ninguna casilla previo: la hoja del equipo en
    # papel ya lo tenia y el formulario digital no.
    #
    # DOS renglones, no uno. Con uno solo, lo que cabia despues de la etiqueta
    # era media linea: para una casilla que existe justo porque no sabemos que
    # se va a escribir en ella, eso es prometer sitio y no darlo. El segundo
    # renglon sale del aire que se recupero por encima del QR.
    fila(campo("Observaciones:", 1, lines = 2L))
  )
}

#' Plantilla built-in de la ficha de campo con QR grande.
#'
#' @param assets ids de logo de la careta; `NULL` para una hoja sin co-marca.
#' @param rows renglones del formulario; por defecto los de la hoja en uso.
#' @param title_binding que se imprime como titulo bajo el QR. Por defecto los
#'   DOS codigos de la unidad (`unit.codigo_ficha`): «CH 1 MAT202_0591».
#'   `NULL` la deja sin titulo.
#'
#'   El default ha cambiado dos veces, y las dos por lo mismo: el elemento mas
#'   grande de una hoja que alguien sostiene en un aula tiene que identificar
#'   esa hoja.
#'
#'   Fue `access.logical_collector_id`, que en el origen legacy de aulas nadie
#'   llena y caia en el hash de `.collection_stable_id("logical", unit_id)`
#'   —«logical-unit-aulas-aula-01-fd6e0ab1ee-4cd233a0cb», impreso a 16 pt—. Los
#'   tests viejos no lo veian porque su fixture siempre ponia un
#'   `logical_collector_id` legible a mano.
#'
#'   Luego fue `unit.label`, el codigo academico solo («mat202_0591»), que
#'   identifica el curso pero no dice nada del operativo: el equipo habla de
#'   «CH 1» y ese codigo vivia unicamente en el nombre del archivo, que
#'   desaparece al imprimir. Pedido de Gonzalo el 2026-08-27.
#' @return `collection_material_template/v1` determinista.
#' @export
collection_material_field_sheet_template <- function(assets = NULL, rows = NULL,
                                                     title_binding = "unit.codigo_ficha") {
  blocks <- list()
  if (!is.null(assets)) {
    blocks <- c(blocks, list(list(
      block_id = "careta", type = "brand_strip", assets = as.list(assets),
      align = "center", max_height_mm = 11
    )))
  }
  if (!is.null(title_binding)) {
    blocks <- c(blocks, list(list(
      block_id = "titulo", type = "heading", binding = title_binding, max_lines = 2L
    )))
  }
  blocks <- c(blocks, list(
    list(
      block_id = "qr", type = "access_qr", binding = "access.qr_payload",
      required = TRUE, correction = "M", quiet_zone = 4L, min_size_mm = 70
    ),
    list(block_id = "registro", type = "form_lines", rows = rows %||% collection_material_field_form_rows()),
    list(block_id = "footer", type = "footer", binding = "project.name")
  ))
  # El VERSO (B32): croquis del campus con el pabellon del aula resaltado.
  # Viaja en la MISMA hoja —se imprime a doble cara— y por eso es una segunda
  # pagina de esta plantilla y no un material aparte: un insumo que venga
  # «junto a lo demas en el QR, quizas a la vuelta de su ficha» (Gonzalo,
  # 2026-09-02).
  verso <- list(
    list(block_id = "croquis", type = "campus_map", binding = "unit.venue"),
    list(block_id = "footer", type = "footer", binding = "project.name")
  )
  template <- list(
    schema = COLLECTION_MATERIAL_TEMPLATE_SCHEMA,
    template_id = "template-ficha-campo-qr-a4-v1",
    revision = 1L,
    preset_id = "ficha_campo_qr_a4_v1",
    material_kind = "application_sheet",
    compatible_adapters = list("aulas_v1", "kobo_existing_v1", "manual_links_v1"),
    page = list(size = "A4", orientation = "portrait"),
    pages = list(
      list(page_id = "ficha", layout_preset = "field_form", blocks = blocks),
      list(page_id = "croquis", layout_preset = "croquis_campus", blocks = verso)
    ),
    brand_ref = "project-brand",
    sensitivity_policy = "operational"
  )
  template$template_sha256 <- .cm_template_sha256(template)
  template
}
