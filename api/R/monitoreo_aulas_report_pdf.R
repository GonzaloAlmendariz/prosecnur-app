# El reporte de avance a cliente del perfil de aulas universitarias.
#
# Gonzalo pidió la misma tabla en tres soportes: «una en avance y las otras dos
# en un PDF para poder enviarlos a sus correos y un excel para poder
# compartírselos». El Excel es la hoja «Avance de campo» del libro y la
# pantalla es `AulasAvanceParaCliente`; esto es el tercero.
#
# POR QUÉ HACE FALTA UN MODELO PROPIO
#
# `.monitoreo_client_report_model_for_snapshot()` ramifica en tres y aulas caía
# al de ACREDITACIÓN por descarte —no a un genérico—. Ese modelo y su
# renderizador hablan de `actors`, `daily_actor` y `channel_labels`: reusarlo
# obligaría a llamar «actores» a las facultades, que es el defecto que este
# perfil ya arrastra con las tasas homónimas. Ver
# `docs/qa/checklist-monitoreo-criterios-2026-08-26.md` § T8c.
#
# EL CONTENIDO NO SE RECALCULA
#
# La tabla la decide `.calaf_avance_por_facultad()`, la misma que escribe la
# hoja del libro. Si este modelo la rehiciera, habría tres tablas del mismo
# nombre con cifras distintas — exactamente lo que las tres formas existen para
# evitar.

#' Modelo del PDF de avance de aulas.
#'
#' @param snapshot snapshot de Monitoreo (`data`, `synced_at`).
#' @param cfg config de Monitoreo ya normalizada o normalizable.
#' @param include_targets si el documento incluye metas.
#' @return lista con `report_kind`, `facultades`, `total` y la procedencia.
#' @export
build_monitoreo_aulas_report_model <- function(snapshot, cfg, include_targets = FALSE) {
  if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) {
    stop_api(409, "E_NO_MONITOREO_DATA", "Sincroniza datos antes de generar el reporte de avance.")
  }
  aulas_cfg <- (cfg$aulas_universitarias %||% cfg)
  plan <- aulas_cfg$plan %||% list()
  if (!length(plan)) {
    stop_api(409, "E_AULAS_SIN_PLAN", "El estudio no trae plan de cursos-horario del que informar.")
  }
  data <- snapshot$data
  efectivas <- monitoreo_aulas_efectivas_por_aula(plan, data, aulas_cfg)
  validas <- .monitoreo_aulas_valid_response(data, aulas_cfg)

  # UNA sola fuente del contenido: la misma función que escribe la hoja del
  # libro. No se recalcula aquí.
  facultades <- .calaf_avance_por_facultad(
    plan, efectivas = efectivas, cuotas = aulas_cfg$design_targets,
    responses = data, validas = validas, cfg = aulas_cfg,
    # Los partes también, para que «Aulas aplicadas» sea la misma cifra que en
    # el libro: la definición de aula aplicada es una sola.
    partes = aulas_cfg$partes_campo %||% list()
  )

  # Sin cuotas del diseño no hay avance que informar a un cliente: se dice, no
  # se publica un documento con ceros que se leerían como medidos.
  if (is.null(facultades) || !nrow(facultades)) {
    stop_api(409, "E_AULAS_SIN_CUOTAS",
             "El estudio no trae la cuota del diseño por facultad: sin ella el reporte de avance no se puede afirmar.")
  }

  suma <- function(col) sum(suppressWarnings(as.numeric(facultades[[col]])), na.rm = TRUE)
  muestra <- suma("Muestra")
  conseguidas <- suma("Conseguidas")

  list(
    report_kind = "aulas_advance_pdf",
    family = "aulas_universitarias",
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    synced_at = .monitoreo_scalar(snapshot$synced_at %||% "", ""),
    include_targets = isTRUE(include_targets),
    facultades = facultades,
    total = list(
      muestra = muestra,
      conseguidas = conseguidas,
      avance = if (muestra > 0) conseguidas / muestra else NA_real_,
      # Los faltantes se SUMAN por facultad y no se netean: pasarse en una no
      # cubre lo que falta en otra (ADR 0079). Un neto siempre sale más
      # favorable y es el número que un cliente citaría.
      faltan = suma("Faltan"),
      facultades_abiertas = sum(suppressWarnings(as.numeric(facultades$Faltan)) > 0, na.rm = TRUE),
      aulas_aplicadas = suma("Aulas aplicadas"),
      aulas_del_plan = suma("Aulas del plan")
    ),
    # La procedencia viaja con el documento: quien lo reciba tiene que poder
    # saber contra qué se midió sin preguntar.
    criterio = list(
      denominador = "la cuota de alumnos que el diseño fijó por facultad",
      numerador = "las respuestas que llegaron a la plataforma y pasaron los filtros del estudio",
      no_cubre = "La sobremuestra operativa no viaja a Monitoreo, así que este reporte no la compara."
    )
  )
}

# --- El renderizador ---------------------------------------------------------
#
# Vía `grDevices::pdf()` + `grid`, como el resto de motores nuevos. La capa
# estética la pone el kit compartido (`pulso_pdf_theme.R`); el layout es propio.
#
# **Apaisado, y no vertical**: la tabla lleva diez columnas —facultad, muestra y
# su reparto por sexo, conseguidas y el suyo, aulas, avance y faltan— y en A4
# vertical no caben sin encoger la tipografía hasta hacerla ilegible. El libro
# de códigos usa dos columnas verticales porque su unidad es una variable
# estrecha; aquí la unidad es una fila ancha.

.marp_pct <- function(x) {
  v <- suppressWarnings(as.numeric(x))
  if (!length(v) || !is.finite(v[1])) return("—")
  sprintf("%.1f %%", v[1] * 100)
}

# Personas ENTERAS. Lo que falta se redondea hacia arriba —decir que faltan 22
# cuando faltan 22,4 promete cerrar con menos de lo que hace falta— y lo demás
# hacia abajo, que es no prometer de más. Mismo criterio que la pantalla.
.marp_personas <- function(x, faltante = FALSE) {
  v <- suppressWarnings(as.numeric(x))
  if (!length(v) || !is.finite(v[1])) return("—")
  n <- if (faltante) ceiling(v[1]) else floor(v[1])
  formatC(as.integer(n), big.mark = ",", format = "d")
}

#' PDF de avance de aulas para el cliente.
#'
#' @param model salida de `build_monitoreo_aulas_report_model()`.
#' @param output_file ruta del PDF.
#' @param include_targets sin uso hoy; el modelo ya trae la cuota.
#' @param titulo,subtitulo,periodo parámetros estándar de todo motor.
#' @export
monitoreo_aulas_advance_report_pdf <- function(model, output_file,
                                               include_targets = FALSE,
                                               titulo = "Avance del trabajo de campo",
                                               subtitulo = "Cursos-horario · avance por facultad",
                                               periodo = "") {
  tok <- pulso_pdf_tokens()
  ty <- pulso_pdf_type()
  geo <- pulso_pdf_geo("landscape")
  df <- model$facultades
  if (is.null(df) || !nrow(df)) {
    stop_api(409, "E_AULAS_SIN_CUOTAS", "El modelo no trae facultades que informar.")
  }
  if (!nzchar(periodo)) periodo <- format(Sys.Date(), "%m-%Y")

  grDevices::pdf(output_file, width = geo$w_in, height = geo$h_in, onefile = TRUE)
  on.exit(grDevices::dev.off(), add = TRUE)

  # LA CABECERA SE SEPARA MÁS EN APAISADO. El kit separa título y subtítulo
  # 0,016 npc, que en A4 vertical son ~4,7 mm y en apaisado ~3,3: con un título
  # de 15 pt el subtítulo queda debajo de la caja del título y se pisan. Visto
  # renderizando a PNG, no leyendo el código. Los tres `y` son parámetros del
  # kit justamente para esto.
  y_tit <- 0.955; y_sub <- 0.905; y_reg <- 0.870

  # Cuántas filas entran por página: se calcula, no se adivina, para que la
  # última página no quede con una fila colgando fuera del marco.
  alto_fila <- 0.040
  y_tabla <- 0.66
  por_pagina <- max(1L, floor((y_tabla - 0.10) / alto_fila))
  paginas <- split(seq_len(nrow(df)), ceiling(seq_len(nrow(df)) / por_pagina))

  columnas <- list(
    list(campo = "Facultad", rotulo = "Facultad", w = 0.20, num = FALSE),
    list(campo = "Muestra", rotulo = "Total", w = 0.075, num = TRUE),
    list(campo = "Muestra mujeres", rotulo = "Mujeres", w = 0.075, num = TRUE),
    list(campo = "Muestra hombres", rotulo = "Hombres", w = 0.075, num = TRUE),
    list(campo = "Conseguidas", rotulo = "Total", w = 0.075, num = TRUE),
    list(campo = "Conseguidas mujeres", rotulo = "Mujeres", w = 0.075, num = TRUE),
    list(campo = "Conseguidas hombres", rotulo = "Hombres", w = 0.075, num = TRUE),
    # Rótulos cortos porque la columna mide 0,075 npc: «Aplicadas» a 8 pt se
    # comía el borde y quedaba pegado a «Hombres» de la izquierda.
    list(campo = "Aulas aplicadas", rotulo = "Aulas", w = 0.078, num = TRUE),
    list(campo = "Aulas del plan", rotulo = "Plan", w = 0.067, num = TRUE),
    list(campo = "Avance", rotulo = "Avance", w = 0.080, num = TRUE),
    list(campo = "Faltan", rotulo = "Faltan", w = 0.075, num = TRUE)
  )
  x0 <- 0.04
  xs <- cumsum(c(x0, vapply(columnas, function(c) c$w, numeric(1))))

  for (p in seq_along(paginas)) {
    grid::grid.newpage()
    pulso_pdf_header(titulo, subtitulo, tokens = tok, geo = geo,
                     y_titulo = y_tit, y_subtitulo = y_sub, y_regla = y_reg)

    if (p == 1L) {
      t <- model$total
      # La portada lleva lo que el cliente pregunta primero, en una línea.
      resumen <- sprintf(
        "De una muestra de %s alumnos se llevan %s: %s de avance. Faltan %s repartidos en %s.",
        .marp_personas(t$muestra), .marp_personas(t$conseguidas), .marp_pct(t$avance),
        .marp_personas(t$faltan, faltante = TRUE),
        if (identical(as.integer(t$facultades_abiertas), 1L)) "1 facultad"
        else sprintf("%d facultades", as.integer(t$facultades_abiertas))
      )
      grid::grid.text(resumen, x = x0, y = 0.820, just = c("left", "top"),
                      gp = grid::gpar(col = tok$ink, fontsize = ty$body))
      # Los faltantes NO se netean, y quien lea el total va a querer restarlo.
      grid::grid.text(
        "La cuota es de cada facultad y de cada sexo: cubrir de más en una no cubre lo que falta en otra.",
        x = x0, y = 0.780, just = c("left", "top"),
        gp = grid::gpar(col = tok$soft, fontsize = ty$foot))
    }

    # Cabecera de grupos: «Mujeres» y «Hombres» aparecen dos veces —bajo la
    # muestra y bajo lo conseguido— y sin el grupo no se sabe cuál es cuál.
    grupo <- function(desde, hasta, texto) {
      grid::grid.text(texto, x = (xs[desde] + xs[hasta + 1L]) / 2, y = y_tabla + 0.048,
                      just = c("center", "bottom"),
                      gp = grid::gpar(col = tok$soft, fontsize = ty$foot, fontface = "bold"))
      pulso_pdf_hairline(xs[desde], xs[hasta + 1L], y_tabla + 0.042, tokens = tok)
    }
    grupo(2L, 4L, "La muestra que le toca")
    grupo(5L, 7L, "Lo que se lleva")

    grid::grid.rect(x = x0, y = y_tabla, width = sum(vapply(columnas, function(c) c$w, numeric(1))),
                    height = 0.034, just = c("left", "bottom"),
                    gp = grid::gpar(fill = tok$tbl_header, col = tok$tbl_frame, lwd = 0.6))
    for (i in seq_along(columnas)) {
      c <- columnas[[i]]
      grid::grid.text(c$rotulo, x = if (c$num) xs[i + 1L] - 0.006 else xs[i] + 0.006,
                      y = y_tabla + 0.012, just = c(if (c$num) "right" else "left", "bottom"),
                      gp = grid::gpar(col = tok$navy, fontsize = ty$foot, fontface = "bold"))
    }

    y <- y_tabla - alto_fila
    for (k in paginas[[p]]) {
      fila <- df[k, , drop = FALSE]
      falta <- suppressWarnings(as.numeric(fila$Faltan))
      abierta <- is.finite(falta) && falta > 0
      if (which(paginas[[p]] == k) %% 2L == 0L) {
        grid::grid.rect(x = x0, y = y, width = sum(vapply(columnas, function(c) c$w, numeric(1))),
                        height = alto_fila, just = c("left", "bottom"),
                        gp = grid::gpar(fill = tok$tbl_zebra, col = NA))
      }
      # La que no ha cerrado lleva un filete de acento a la izquierda: el color
      # no es el único portador —la columna «Faltan» dice lo mismo— pero ayuda
      # a encontrarlas de un vistazo.
      if (abierta) {
        grid::grid.rect(x = x0, y = y, width = 0.004, height = alto_fila,
                        just = c("left", "bottom"), gp = grid::gpar(fill = tok$danger, col = NA))
      }
      for (i in seq_along(columnas)) {
        c <- columnas[[i]]
        v <- fila[[c$campo]]
        txt <- if (identical(c$campo, "Facultad")) {
          # Recortado a su columna: «Ciencias y Artes de la Comunicación» se
          # salía e invadía la cifra de al lado. Una etiqueta con elipsis se
          # lee; una cifra pisada, no.
          nombre <- .form_pdf_clean_text(as.character(v))
          tope <- pulso_pdf_chars(c$w) - 1L
          # Elipsis en TRES PUNTOS ASCII y no «…»: el device PDF no tiene el
          # U+2026 en su fuente y R lo sustituye con un aviso, así que en el
          # documento salía otro carácter.
          if (nchar(nombre) > tope) paste0(substr(nombre, 1L, tope - 3L), "...") else nombre
        } else if (identical(c$campo, "Avance")) {
          .marp_pct(v)
        } else {
          .marp_personas(v, faltante = identical(c$campo, "Faltan"))
        }
        grid::grid.text(txt, x = if (c$num) xs[i + 1L] - 0.006 else xs[i] + 0.010,
                        y = y + alto_fila / 2, just = c(if (c$num) "right" else "left", "centre"),
                        gp = grid::gpar(col = tok$ink, fontsize = ty$body))
      }
      pulso_pdf_hairline(x0, xs[length(xs)], y, tokens = tok, lwd = 0.4)
      y <- y - alto_fila
    }

    if (p == length(paginas)) {
      # ENVUELTO, no `grid.text`: el pie es una frase larga y sin envoltura se
      # salía por el borde derecho —«…que el diseño fijó por fa»—. Visto en el
      # PNG de la última página, que es la única donde el pie aparece.
      ancho <- xs[length(xs)] - x0
      .form_pdf_text(
        paste0("Se cuenta ", model$criterio$numerador, " contra ",
               model$criterio$denominador, ". ", model$criterio$no_cubre),
        x = x0, y = max(0.09, y - 0.012), w = ancho,
        chars = pulso_pdf_chars(ancho), fontsize = ty$foot,
        col = tok$faint, line_h = 0.022)
    }
    pulso_pdf_footer(p, periodo, tokens = tok, geo = geo)
  }
  invisible(output_file)
}
