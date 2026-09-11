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

  # La SERIE DIARIA, que es lo que sostiene los gráficos de ritmo. Sale de la
  # misma función que escribe el bloque «Avance diario» del libro, y
  # `monitoreo_aulas_ritmo_de_avance()` se queda sólo con las columnas de avance:
  # las de rendimiento no cruzan a un documento de cliente.
  diario <- tryCatch(
    .calad_avance_diario(plan, responses = data, validas = validas,
                         cuotas = aulas_cfg$design_targets, cfg = aulas_cfg),
    error = function(e) NULL
  )
  ritmo <- monitoreo_aulas_ritmo_de_avance(diario, facultades)

  # Cursos-horario TITULARES por facultad: el denominador de «cuántas aulas de
  # las previstas se han visitado». La tabla por facultad sólo trae las
  # aplicadas, y sin su plan una cifra de aulas no dice si va bien.
  aulas_plan <- .marp_titulares_por_facultad(plan)

  suma <- function(col) sum(suppressWarnings(as.numeric(facultades[[col]])), na.rm = TRUE)
  muestra <- suma("Muestra")
  # Las columnas se llaman como las dictó Gonzalo el 2026-09-08 («efectivas»,
  # «faltantes»); «Conseguidas», «Faltan» y «Aulas del plan» ya no existen en
  # la tabla, y este modelo lee la MISMA tabla que el libro.
  conseguidas <- suma("Efectivas")
  sobremuestra <- suma("Sobremuestra")

  # Los DEFECTOS de la portada: derivados de lo que el motor ya sabe, y
  # sobreescribibles uno por uno desde la UI (`pulso_pdf_portada_normalizar()`).
  # Viajan en el modelo para que el panel pueda mostrarlos como placeholder: un
  # defecto que no se ve no es sobreescribible, es una sorpresa.
  portada_defecto <- list(
    titulo = "Avance del trabajo de campo",
    subtitulo = .marp_nombre_del_estudio(aulas_cfg),
    cliente = "",
    periodo = .marp_periodo_de_campo(ritmo),
    corte = .marp_corte_legible(snapshot$synced_at %||% ""),
    nota = ""
  )

  list(
    report_kind = "aulas_advance_pdf",
    family = "aulas_universitarias",
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    synced_at = .monitoreo_scalar(snapshot$synced_at %||% "", ""),
    include_targets = isTRUE(include_targets),
    facultades = facultades,
    ritmo = ritmo,
    aulas_planificadas = aulas_plan,
    portada_defecto = portada_defecto,
    # La tabla traspuesta de «Avance general», la primera de las dos que Gonzalo
    # aprobó del libro. Se pide a la MISMA función que la escribe allí; el PDF
    # decide qué filas muestra, no cómo se calculan.
    general = tryCatch(
      .calag_tabla_general(facultades, list(
        aplicadas = sum(suppressWarnings(as.numeric(facultades[["Aulas aplicadas"]])), na.rm = TRUE),
        # PLANIFICADAS son los TITULARES, no las filas del plan: el plan lleva
        # dentro el banco de reservas, y contarlo entero publicaba «56 aulas
        # aplicadas de 1.392 planificadas», que es 25 veces el operativo real y
        # se lee como un campo que no arrancó. Es el mismo criterio que
        # `aulas_libro_indicadores()` usa para la hoja.
        planificadas = sum(vapply(plan, function(u) {
          identical(.cai_txt(u$sample_role), "titular")
        }, logical(1)))
      )),
      error = function(e) NULL
    ),
    total = list(
      muestra = muestra,
      conseguidas = conseguidas,
      avance = if (muestra > 0) conseguidas / muestra else NA_real_,
      # Los faltantes se SUMAN por facultad y no se netean: pasarse en una no
      # cubre lo que falta en otra (ADR 0079). Un neto siempre sale más
      # favorable y es el número que un cliente citaría.
      faltan = suma("Faltantes muestra"),
      facultades_abiertas = sum(suppressWarnings(as.numeric(facultades[["Faltantes muestra"]])) > 0, na.rm = TRUE),
      aulas_aplicadas = suma("Aulas aplicadas"),
      # La segunda meta, con el mismo trato que la primera (decisión de Gonzalo,
      # 2026-09-08: «dos metas, la de 2 500 y la de 3 750»).
      sobremuestra = if (sobremuestra > 0) sobremuestra else NA_real_,
      faltan_sobremuestra = if (sobremuestra > 0) suma("Faltantes sobremuestra") else NA_real_
    ),
    # La procedencia viaja con el documento: quien lo reciba tiene que poder
    # saber contra qué se midió sin preguntar.
    criterio = list(
      denominador = "la cuota de alumnos que el diseño fijó por facultad",
      numerador = "las respuestas que llegaron a la plataforma y pasaron los filtros del estudio",
      no_cubre = if (sobremuestra > 0) {
        "La sobremuestra se reparte por facultad y por sexo con el ratio del diseño, y su columna de faltantes se mide contra ella."
      } else {
        "El estudio no publica la sobremuestra, así que sus columnas van en blanco."
      }
    )
  )
}

# --- El renderizador ---------------------------------------------------------
#
# Vía `grDevices::pdf()` + `grid`, como el resto de motores nuevos. La capa
# estética la pone el kit compartido (`pulso_pdf_theme.R`); el layout es propio.
#
# **Apaisado, y no vertical**: la tabla lleva diecisiete columnas —facultad,
# efectivas, y las dos metas con lo que le falta a cada una, todo con su reparto
# por sexo, más las aulas aplicadas— y en A4 vertical no caben sin encoger la
# tipografía hasta
# hacerla ilegible. El libro de códigos usa dos columnas verticales porque su
# unidad es una variable estrecha; aquí la unidad es una fila ancha.

.marp_pct <- function(x) {
  v <- suppressWarnings(as.numeric(x))
  if (!length(v) || !is.finite(v[1])) return("-")
  sprintf("%.1f %%", v[1] * 100)
}

# Personas ENTERAS. Lo que falta se redondea hacia arriba —decir que faltan 22
# cuando faltan 22,4 promete cerrar con menos de lo que hace falta— y lo demás
# hacia abajo, que es no prometer de más. Mismo criterio que la pantalla.
.marp_personas <- function(x, faltante = FALSE) {
  v <- suppressWarnings(as.numeric(x))
  if (!length(v) || !is.finite(v[1])) return("-")
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
                                               periodo = "",
                                               portada = list(),
                                               con_portada = TRUE) {
  tok <- pulso_pdf_tokens()
  ty <- pulso_pdf_type()
  geo <- pulso_pdf_geo("landscape")
  df <- model$facultades
  if (is.null(df) || !nrow(df)) {
    stop_api(409, "E_AULAS_SIN_CUOTAS", "El modelo no trae facultades que informar.")
  }

  pulso_pdf_abrir(output_file, geo = geo)
  on.exit(grDevices::dev.off(), add = TRUE)


  # Cuántas filas entran por página: se calcula, no se adivina, para que la
  # última página no quede con una fila colgando fuera del marco.
  # 0,044 y no 0,040: quince facultades a 0,040 dejaban dos centímetros muertos
  # al pie de la hoja, y el renglón más suelto se lee mejor.
  alto_fila <- 0.044
  # La tabla arranca justo bajo el cromo: con 0,645 quedaban veinte milímetros
  # de página en blanco entre la regla y la primera fila, y las quince
  # facultades se partían en dos hojas sin necesidad.
  y_tabla <- 0.755
  # **Ni huérfanas ni páginas desparejas.** Con quince facultades a 0,044 caben
  # catorce y la decimoquinta se iba sola a una hoja entera: una página con una
  # fila no es una página, es un error de composición. Dos reglas, en orden:
  #
  #   1. Si todo cabe apretando el renglón hasta el mínimo legible, cabe: se
  #      prefiere una hoja bien llena a dos medio vacías.
  #   2. Si de verdad no cabe, las filas se reparten PAREJAS entre las hojas que
  #      hagan falta, en vez de llenar la primera y dejar el resto a la última.
  .ALTO_FILA_MINIMO <- 0.0355
  alto_util <- y_tabla - 0.10
  if (nrow(df) * .ALTO_FILA_MINIMO <= alto_util) {
    alto_fila <- min(alto_fila, alto_util / nrow(df))
  }
  por_pagina <- max(1L, floor(alto_util / alto_fila))
  n_hojas <- max(1L, ceiling(nrow(df) / por_pagina))
  por_pagina <- ceiling(nrow(df) / n_hojas)
  paginas <- split(seq_len(nrow(df)), ceiling(seq_len(nrow(df)) / por_pagina))

  # **La tabla de detalle va en DOS páginas, no en una de diecisiete columnas.**
  # Con las diecisiete juntas cada columna medía 0,051 npc y los nombres de
  # facultad se truncaban —«ESTUDIOS GENERA...», «CIENCIAS E INGE...»—, que en
  # un documento de cliente es justo lo que no se puede recortar. Partida por
  # meta, cada página lleva diez columnas anchas y el nombre entero.
  #
  # Facultad, las tres de «Efectivas» y «Aulas» se REPITEN en las dos: son el
  # contexto contra el que se lee cualquiera de las dos metas, y quien tenga
  # delante una sola de las hojas tiene que poder leerla sola.
  col <- function(campo, rotulo, grupo = "", w = 0.066, num = TRUE) {
    list(campo = campo, rotulo = rotulo, grupo = grupo, w = w, num = num)
  }
  comunes_izq <- list(
    # 0,266 npc = 31 caracteres: entra «ESTUDIOS GENERALES LETRAS» entero, que
    # con 0,205 salía «ESTUDIOS GENERALES L...». En un documento de cliente el
    # nombre de la facultad es lo último que se puede recortar.
    col("Facultad", "Facultad", w = 0.266, num = FALSE),
    col("Efectivas", "Total", "Efectivas"),
    col("Efectivas hombres", "Hom.", "Efectivas"),
    col("Efectivas mujeres", "Muj.", "Efectivas")
  )
  comun_der <- list(col("Aulas aplicadas", "Aulas", w = 0.060))
  detalle <- function(meta) {
    prefijo <- if (identical(meta, "muestra")) "Muestra" else "Sobremuestra"
    sufijo <- if (identical(meta, "muestra")) "muestra" else "sobremuestra"
    grupo <- paste(prefijo, "y lo que le falta")
    c(comunes_izq, list(
      col(prefijo, "Meta", grupo),
      col(paste("Faltantes", sufijo), "Faltan", grupo),
      col(paste(prefijo, "hombres"), "Hom.", grupo),
      col(paste0("Faltantes hombres ", sufijo), "Faltan", grupo),
      col(paste(prefijo, "mujeres"), "Muj.", grupo),
      col(paste0("Faltantes mujeres ", sufijo), "Faltan", grupo)
    ), comun_der)
  }
  # La sobremuestra sólo tiene hoja si el estudio la publica.
  hay_sobremuestra <- is.finite(suppressWarnings(as.numeric(model$total$sobremuestra))) &&
    suppressWarnings(as.numeric(model$total$sobremuestra)) > 0
  hojas_detalle <- list(list(clave = "muestra", titulo = "Detalle por facultad: muestra",
                             columnas = detalle("muestra")))
  if (hay_sobremuestra) {
    hojas_detalle[[2L]] <- list(clave = "sobremuestra",
                                titulo = "Detalle por facultad: sobremuestra",
                                columnas = detalle("sobremuestra"))
  }
  x0 <- 0.04

  # --- El documento -----------------------------------------------------------
  #
  # La numeración de páginas corre sobre TODAS las páginas dibujadas, no sobre
  # las de la tabla: `pag` se incrementa en cada `grid.newpage()`. La portada no
  # lleva número ni pie —una portada numerada se lee como si faltara algo antes—.
  ancho_util <- 1 - 2 * x0

  # El total de páginas se cuenta ANTES de dibujar: el folio «03 / 09» necesita
  # el denominador en la primera página, no en la última.
  ritmo_previo <- model$ritmo
  hay_ritmo <- is.list(ritmo_previo) && is.data.frame(ritmo_previo$total) && nrow(ritmo_previo$total)
  n_paneles <- if (hay_ritmo) length(ritmo_previo$facultades %||% list()) else 0L
  total_paginas <- 1L +                                        # resumen
    (if (hay_ritmo) 1L else 0L) +                              # ritmo global
    (if (n_paneles) ceiling(n_paneles / 8) else 0L) +           # ritmo por facultad
    1L +                                                        # metas por facultad
    ceiling(nrow(df) / .marp_filas_por_pagina_avance()) +        # avance visual
    length(paginas) * length(hojas_detalle)                     # detalle numérico

  antetitulo <- "Monitoreo de cursos-horario"
  pag <- 0L
  nueva <- function(sec_titulo, sec_subtitulo, derecha = "") {
    grid::grid.newpage()
    pag <<- pag + 1L
    pulso_pdf_cromo(antetitulo, sec_titulo, sec_subtitulo, tokens = tok, ty = ty,
                    geo = geo, derecha = derecha)
  }
  pie <- function() pulso_pdf_pie(pag, total_paginas, periodo, tokens = tok, ty = ty, geo = geo)

  if (isTRUE(con_portada)) {
    port <- pulso_pdf_portada_normalizar(
      defectos = model$portada_defecto %||% list(titulo = titulo, subtitulo = subtitulo),
      usuario = portada
    )
    t <- model$total
    grid::grid.newpage()
    pulso_pdf_portada(port, tokens = tok, ty = ty, geo = geo,
                      antetitulo = "Monitoreo de cursos-horario", destacados = list(
      list(rotulo = "Avance de la muestra", valor = .marp_pct(t$avance)),
      list(rotulo = "Encuestas efectivas", valor = .marp_personas(t$conseguidas)),
      list(rotulo = "Cursos-horario aplicados", valor = .marp_personas(t$aulas_aplicadas))
    ))
    if (!nzchar(periodo) && nzchar(port$periodo)) periodo <- port$periodo
    titulo <- port$titulo
  }

  if (!nzchar(periodo)) periodo <- format(Sys.Date(), "%m-%Y")

  nueva("Resumen del avance", "Dónde está el campo respecto de la muestra del diseño")
  .marp_pagina_resumen(model, tok, ty, geo, x0, ancho_util)
  pie()

  ritmo <- model$ritmo
  if (is.list(ritmo) && is.data.frame(ritmo$total) && nrow(ritmo$total)) {
    nueva("Ritmo del campo", "Encuestas efectivas por jornada y acumulado contra la muestra del diseño")
    .marp_pagina_ritmo(ritmo, tok, ty, geo, x0, ancho_util)
    pie()

    paneles <- ritmo$facultades %||% list()
    if (length(paneles)) {
      por_hoja <- 8L
      hojas <- split(seq_along(paneles), ceiling(seq_along(paneles) / por_hoja))
      for (h in seq_along(hojas)) {
        nueva("Ritmo por facultad",
              if (length(hojas) > 1L) {
                sprintf("Cada panel con su propia escala · %d de %d", h, length(hojas))
              } else "Cada panel con su propia escala")
        .marp_paneles_por_facultad(paneles[hojas[[h]]], tok, ty, geo, x0, ancho_util)
        pulso_pdf_leyenda(x0, 0.095, list(
          list(texto = "Efectivas del día", color = tok$navy, forma = "barra"),
          list(texto = "Acumulado", color = tok$success, forma = "linea"),
          list(texto = "Meta de la facultad", color = tok$danger, forma = "linea", lty = 2)
        ), tokens = tok, ty = ty)
        pie()
      }
    }
  }

  # «Metas por facultad»: el gráfico que ya se lee en pantalla, en el documento.
  nueva("Metas por facultad", "Lo conseguido dentro de la cuota de cada facultad, hombres y mujeres")
  .marp_pagina_metas(df, tok, ty, geo, x0, ancho_util)
  pie()

  # La lectura visual del avance, antes del detalle numérico: responde «cómo va»
  # de un vistazo; la tabla de diecisiete columnas responde «cuánto exactamente».
  por_hoja_avance <- .marp_filas_por_pagina_avance()
  hojas_avance <- split(seq_len(nrow(df)), ceiling(seq_len(nrow(df)) / por_hoja_avance))
  for (h in seq_along(hojas_avance)) {
    nueva("Avance por facultad y sexo",
          if (length(hojas_avance) > 1L) {
            sprintf("Efectivas conseguidas contra la cuota de cada sexo · %d de %d", h, length(hojas_avance))
          } else "Efectivas conseguidas contra la cuota de cada sexo")
    .marp_pagina_avance_visual(df, hojas_avance[[h]], tok, ty, x0, ancho_util,
                               aulas_plan = model$aulas_planificadas %||% numeric(0))
    pie()
  }

  for (hoja in hojas_detalle) {
    for (p in seq_along(paginas)) {
      nueva(
        hoja$titulo,
        if (length(paginas) > 1L) sprintf("%s · %d de %d", subtitulo, p, length(paginas)) else subtitulo
      )
      .marp_tabla_detalle(df, paginas[[p]], hoja$columnas, tok, ty, x0,
                          y_tabla = y_tabla, alto_fila = alto_fila,
                          criterio = if (identical(hoja, hojas_detalle[[length(hojas_detalle)]]) &&
                                         p == length(paginas)) model$criterio else NULL)
      pie()
    }
  }
  invisible(output_file)
}
