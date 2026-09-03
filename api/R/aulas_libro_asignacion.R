# aulas_libro_asignacion.R — la hoja «Asignación de aplicadores» del libro
# operativo (B68, dictado de Gonzalo 2026-09-03: «una hoja adicional que sea
# asignación de aplicadores, y ahí se debería mostrar toda esta información de
# forma bastante estética, que se vea cómo la distribución se está haciendo a
# todos por igual, en base a la disponibilidad… que vaya no solo en la
# aplicación, sino también en el Excel operativo que generamos»).
#
# La DOBLE ESCRITURA prometida: la app enseña el reparto en la pestaña de
# Asignación y el libro generado lleva esta hoja con EL MISMO reparto — el
# mismo motor (`monitoreo_aulas_reparto`), la misma configuración vigente
# (fijadas, duración, rango, semilla del resorteo), así que no hay dos
# verdades que puedan divergir.
#
# La hoja es APP-OWNED y se regenera entera con cada libro; no existe rama de
# lectura — el importador no la mira, igual que Base de control.
#
# Sin disponibilidad cargada en la sesión no hay reparto que escribir y la
# hoja NO se crea: una hoja vacía se leería como «nadie asignado», que es
# mentira — la ausencia del bloque ya la declara la app.

# El día de semana SIN locale (mismo patrón que .mav_DIAS) y en la palabra
# completa del libro.
.ala_DIAS <- c("Domingo", "Lunes", "Martes", "Miércoles", "Jueves",
               "Viernes", "Sábado")

.ala_txt <- function(v) {
  out <- trimws(as.character(v %||% "")[1])
  if (is.na(out)) "" else out
}

# «2026-09-07» → «Lunes 07/09», la etiqueta de la casa.
.ala_etiqueta <- function(fecha) {
  d <- suppressWarnings(as.Date(fecha))
  if (is.na(d)) return(fecha)
  paste(.ala_DIAS[[as.POSIXlt(d)$wday + 1L]], format(d, "%d/%m"))
}

# El croquis del día en palabras del lector (B79: «3 aplicaciones en A», nunca
# «A×3»): primera entrada completa, las siguientes cortas.
.ala_croquis <- function(lugares_del_dia) {
  letras <- character(0)
  for (lg in lugares_del_dia) {
    if (grepl("^[A-ZÁÉÍÓÚ]{1,2}[0-9]{2,4}$", lg, ignore.case = TRUE)) {
      letras <- c(letras, toupper(substr(trimws(lg), 1L, 1L)))
    }
  }
  if (!length(letras)) return("")
  conteo <- sort(table(letras), decreasing = TRUE)
  partes <- vapply(seq_along(conteo), function(k) {
    n <- as.integer(conteo[[k]]); letra <- names(conteo)[[k]]
    if (k == 1L) {
      sprintf("%d %s en %s", n, if (n == 1L) "aplicación" else "aplicaciones", letra)
    } else sprintf("%d en %s", n, letra)
  }, character(1))
  paste(partes, collapse = " · ")
}

.ala_AVISO <- c(
  sin_disponibilidad = "fuera de su disponibilidad declarada",
  se_solapa = "se solapa con otra cita suya"
)

#' Escribe la hoja «Asignación de aplicadores» sobre el workbook del libro.
#'
#' @param wb workbook de openxlsx ya en construcción.
#' @param plan el plan COMPLETO de la sesión (el mismo insumo que usa la app),
#'   no el filtrado del libro: el reparto de la hoja debe ser idéntico al de
#'   la pestaña de Asignación.
#' @param disponibilidad la clave de sesión `monitoreo_aulas_disponibilidad`;
#'   `NULL` o vacía = no se escribe hoja (no hay reparto que contar).
#' @param cfg el config de aulas vigente (fijadas, duración, rango, semilla).
#' @return TRUE si la hoja se escribió; FALSE si no había reparto.
#' @keywords internal
aulas_libro_hoja_asignacion <- function(wb, plan, disponibilidad, cfg = list()) {
  if (is.null(disponibilidad) || !is.list(disponibilidad) || !length(disponibilidad)) {
    return(invisible(FALSE))
  }
  cfg <- if (is.list(cfg)) cfg else list()
  rep <- monitoreo_aulas_reparto(
    plan, disponibilidad,
    fijadas = cfg[["reparto_fijado"]] %||% list(),
    duracion_min = cfg[["duracion_aplicacion_min"]] %||% 30L,
    rango = cfg[["reparto_rango"]],
    semilla = cfg[["reparto_semilla"]] %||% 0L
  )

  # Código → lugar confirmado (el catálogo como fallback), igual que la app.
  lugares <- new.env(parent = emptyenv())
  for (u in (if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else plan)) {
    cod <- .ala_txt(u[["operational_code"]])
    if (!nzchar(cod)) next
    lg <- .ala_txt(u[["scheduled_venue"]])
    if (!nzchar(lg)) lg <- .ala_txt(u[["venue"]])
    if (nzchar(lg) && is.null(lugares[[cod]])) lugares[[cod]] <- lg
  }
  lugar_de <- function(cod) .ala_txt(lugares[[cod]] %||% "")

  hoja <- "Asignación de aplicadores"
  openxlsx::addWorksheet(wb, hoja)

  # --- estilos sobrios de la casa: el rojo primordial para las cabeceras ---
  es_titulo <- openxlsx::createStyle(fontSize = 14, textDecoration = "bold")
  es_nota <- openxlsx::createStyle(fontColour = "#6B6560", fontSize = 10)
  es_dia <- openxlsx::createStyle(
    textDecoration = "bold", fontColour = "#FFFFFF", fgFill = "#A0464E",
    fontSize = 11
  )
  es_cab <- openxlsx::createStyle(
    textDecoration = "bold", fgFill = "#F3EDEA", border = "bottom",
    borderColour = "#C9BEB8", fontSize = 10
  )
  es_alerta <- openxlsx::createStyle(fontColour = "#8F3A42", textDecoration = "bold")
  es_bloque <- openxlsx::createStyle(textDecoration = "bold", fontSize = 12)

  fila <- 1L
  poner <- function(valores, estilo = NULL) {
    openxlsx::writeData(wb, hoja, t(as.matrix(valores)), startRow = fila,
                        colNames = FALSE)
    if (!is.null(estilo)) {
      openxlsx::addStyle(wb, hoja, estilo, rows = fila,
                         cols = seq_along(valores), gridExpand = TRUE)
    }
    fila <<- fila + 1L
  }

  poner("ASIGNACIÓN DE APLICADORES", es_titulo)
  semilla <- as.integer(rep[["semilla"]] %||% 0L)
  rango <- rep[["rango"]]
  poner(sprintf(
    "Sorteo: %s · Rango: %s · Generada con el reparto vigente de la app",
    if (semilla > 0L) sprintf("n.º %d", semilla + 1L) else "original (alfabético)",
    if (is.list(rango)) sprintf("del %s al %s", rango[["desde"]], rango[["hasta"]]) else "todo el horizonte"
  ), es_nota)
  poner("Materiales se recogen 30 min antes; salida al aula 15 min antes de la hora pactada.", es_nota)
  fila <- fila + 1L

  cabecera <- c("CURSO-HORARIO", "LUGAR", "RECOJO", "SALE AL AULA",
                "APLICACIÓN", "APLICADOR", "FIJADA", "AVISO")

  for (d in (rep[["dias"]] %||% list())) {
    asigs <- d[["asignaciones"]] %||% list()
    lugares_dia <- vapply(asigs, function(a) lugar_de(.ala_txt(a[["codigo"]])), character(1))
    croquis <- .ala_croquis(lugares_dia)
    poner(sprintf(
      "%s — %d %s%s",
      .ala_etiqueta(.ala_txt(d[["fecha"]])), length(asigs),
      if (length(asigs) == 1L) "cita" else "citas",
      if (nzchar(croquis)) paste0(" — ", croquis) else ""
    ), es_dia)
    if (length(asigs)) {
      poner(cabecera, es_cab)
      for (a in asigs) {
        cod <- .ala_txt(a[["codigo"]])
        aviso <- .ala_txt(a[["advertencia"]])
        poner(c(
          cod,
          lugar_de(cod),
          .ala_txt(a[["recojo"]]),
          .ala_txt(a[["salida"]]),
          paste0(.ala_txt(a[["inicio"]]),
                 if (nzchar(.ala_txt(a[["fin"]]))) paste0("–", .ala_txt(a[["fin"]])) else ""),
          .ala_txt(a[["aplicador"]]),
          if (isTRUE(a[["fijada"]])) "fijada a mano" else "",
          if (nzchar(aviso)) (.ala_AVISO[[aviso]] %||% aviso) else ""
        ))
      }
    }
    no_cub <- unlist(d[["no_cubiertos"]] %||% list())
    if (length(no_cub)) {
      poner(sprintf("Sin nadie asignado: %s", paste(no_cub, collapse = ", ")), es_alerta)
    }
    pend <- unlist(d[["por_confirmar"]] %||% list())
    if (length(pend)) {
      poner(sprintf("Por confirmar (fecha sin hora pactada): %s",
                    paste(pend, collapse = ", ")), es_nota)
    }
    fila <- fila + 1L
  }

  fuera <- rep[["fuera_de_rango"]] %||% list()
  if (length(fuera)) {
    poner("FUERA DEL RANGO ELEGIDO — esperan su tanda; nada se descarta", es_alerta)
    for (f in fuera) {
      cods <- c(unlist(f[["codigos"]] %||% list()), unlist(f[["por_confirmar"]] %||% list()))
      poner(sprintf("%s: %s", .ala_etiqueta(.ala_txt(f[["fecha"]])),
                    paste(cods, collapse = ", ")), es_nota)
    }
    fila <- fila + 1L
  }

  # --- la equidad, dicha (el «que se vea cómo la distribución se hace a todos
  # por igual» del dictado): cargas por aplicador con los ceros incluidos y el
  # veredicto en una línea, el mismo criterio que el rail de la app. ---
  poner("CARGAS POR APLICADOR", es_bloque)
  eq <- rep[["equidad"]] %||% list()
  cargas <- vapply(eq, function(e) as.integer(e[["asignadas"]] %||% 0L), integer(1))
  poner(c("APLICADOR", "CITAS ASIGNADAS"), es_cab)
  for (e in eq) {
    poner(c(.ala_txt(e[["aplicador"]]), as.character(as.integer(e[["asignadas"]] %||% 0L))))
  }
  con_carga <- cargas[cargas > 0L]
  if (length(con_carga)) {
    dif <- max(con_carga) - min(con_carga)
    libres <- sum(cargas == 0L)
    poner(sprintf(
      "%s: cargas entre %d y %d entre quienes salen — diferencia máxima %d%s",
      if (dif <= 1L) "Reparto parejo" else "Cargas desparejas (la disponibilidad manda)",
      min(con_carga), max(con_carga), dif,
      if (libres > 0L) sprintf(" · %d quedan libres (sin cita en sus horarios)", libres) else ""
    ), es_nota)
  }

  openxlsx::setColWidths(wb, hoja, cols = 1:8,
                         widths = c(16, 14, 10, 13, 14, 34, 13, 30))
  invisible(TRUE)
}
