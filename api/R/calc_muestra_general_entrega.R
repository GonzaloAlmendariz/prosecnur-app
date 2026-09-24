# Entrega del sorteo de Muestra general (ADR 0090, E6): memoria de cálculo y
# libro XLSX con la corrida, los estratos y el listado.
#
# La memoria no describe la fórmula: la SUSTITUYE. Cada paso lleva la fórmula,
# los valores puestos en ella y el resultado, que es lo que un comité revisa
# para defender el n. Sale del mismo resultado que publicó el motor, no de un
# recálculo: si difieren, el que miente es el motor y así se ve.

.cm_general_num <- function(x, digits = 4L) {
  if (is.null(x) || !length(x) || is.na(x)) return("—")
  trimws(formatC(as.numeric(x), format = "fg", digits = digits, big.mark = ""))
}

#' Memoria de cálculo sustituida de un componente probabilístico de elementos.
#'
#' @param comp componente normalizado (técnica, parámetros, marco).
#' @param resultado resultado del motor para ese componente.
#' @return data.frame(paso, formula, sustitucion, resultado).
calc_muestra_general_memoria <- function(comp, resultado) {
  # Sólo los diseños de elementos se resuelven con esta cadena; los demás
  # (conglomerados, dominios, cobertura, cuotas) tienen su propia fórmula y
  # mostrarles ésta sería inventar la defensa.
  if (!comp$tecnica %in% .CM_TECNICAS_DE_ELEMENTOS) {
    return(data.frame(paso = "Memoria no disponible", formula = "",
                      sustitucion = sprintf("La técnica «%s» no se calcula con la fórmula de elementos.", comp$tecnica),
                      resultado = "", stringsAsFactors = FALSE))
  }
  par <- comp$parametros %||% list()
  N <- as.numeric(comp$marco$marco_validado %||% NA)
  z <- as.numeric(par$z); p <- as.numeric(par$p); e <- as.numeric(par$e)
  deff <- if (identical(comp$tecnica, "prob_aleatorio_simple") || identical(comp$tecnica, "sistematico")) 1 else as.numeric(par$deff)
  rr <- as.numeric(par$tasa_respuesta %||% 1)
  os <- as.numeric(par$oversample_pct %||% 0)
  n0 <- z^2 * p * (1 - p) * deff / e^2
  n_fpc <- if (is.finite(N) && N > 0) n0 / (1 + (n0 - 1) / N) else n0
  base <- ceiling(as.numeric(resultado$n_objetivo) / rr)
  filas <- list(
    list("Tamaño sin corrección (Cochran)",
         "n0 = z² · p · (1 − p) · deff / e²",
         sprintf("%s² · %s · %s · %s / %s²", .cm_general_num(z), .cm_general_num(p),
                 .cm_general_num(1 - p), .cm_general_num(deff), .cm_general_num(e)),
         .cm_general_num(n0, 6L)),
    list("Corrección por población finita",
         "n = n0 / (1 + (n0 − 1) / N)",
         sprintf("%s / (1 + (%s − 1) / %s)", .cm_general_num(n0, 6L), .cm_general_num(n0, 6L),
                 .cm_general_num(N, 10L)),
         sprintf("%s → %s", .cm_general_num(n_fpc, 6L), as.integer(resultado$n_teorico))),
    list("Encuestas completas objetivo",
         "n objetivo = n (o la meta declarada, si la hay)",
         sprintf("%s", as.integer(resultado$n_teorico)),
         as.character(as.integer(resultado$n_objetivo))),
    list("Casos a abordar por no respuesta",
         "⌈n objetivo / tasa de respuesta⌉",
         sprintf("⌈%s / %s⌉", as.integer(resultado$n_objetivo), .cm_general_num(rr)),
         as.character(as.integer(base))),
    list("n a campo",
         "casos a abordar + ⌈casos · sobremuestra⌉, con tope en N",
         sprintf("%s + ⌈%s · %s⌉", as.integer(base), as.integer(base), .cm_general_num(os)),
         as.character(as.integer(resultado$n_operativo))),
    list("Margen de error alcanzado",
         "e = z · √(p(1 − p) · deff · (N − n) / (n (N − 1)))",
         sprintf("con n = %s y N = %s", as.integer(resultado$n_objetivo), .cm_general_num(N, 10L)),
         .cm_general_num(resultado$precision_alcanzada, 4L))
  )
  data.frame(
    paso = vapply(filas, `[[`, "", 1L),
    formula = vapply(filas, `[[`, "", 2L),
    sustitucion = vapply(filas, `[[`, "", 3L),
    resultado = vapply(filas, `[[`, "", 4L),
    stringsAsFactors = FALSE
  )
}

.CM_GENERAL_METODO_ROTULO <- c(
  mas = "Muestreo aleatorio simple sin reemplazo",
  sistematico = "Sistemático con intervalo fraccional y arranque aleatorio",
  pps = "Probabilidad proporcional al tamaño (sistemático, con certezas)"
)

#' Escribe el libro de entrega de una corrida.
#'
#' Hojas: «Corrida» (qué se hizo y cómo repetirlo), «Memoria de cálculo»,
#' «Estratos» y «Listado» (titulares y reservas, con π y peso base).
calc_muestra_general_exportar_workbook <- function(corrida, marco, comp, resultado, path) {
  pal <- pulso_xlsx_palette()
  font <- pulso_xlsx_font()
  titulo <- openxlsx::createStyle(fontName = font, fontSize = 13, textDecoration = "bold",
                                  fontColour = pal$ink)
  cab <- openxlsx::createStyle(fontName = font, fontSize = 10, textDecoration = "bold",
                               fontColour = pal$ink, border = "bottom",
                               borderColour = pal$rule_strong, wrapText = TRUE)
  cuerpo <- openxlsx::createStyle(fontName = font, fontSize = 10, fontColour = pal$ink,
                                  wrapText = TRUE, valign = "top")
  nota <- openxlsx::createStyle(fontName = font, fontSize = 9, fontColour = pal$ink_soft,
                                wrapText = TRUE)
  prob <- openxlsx::createStyle(fontName = font, fontSize = 10, numFmt = "0.000000")
  peso <- openxlsx::createStyle(fontName = font, fontSize = 10, numFmt = "0.0000")

  wb <- openxlsx::createWorkbook()
  cr <- corrida$corrida
  col <- marco$columnas %||% list()

  # --- Corrida -------------------------------------------------------------
  pulso_xlsx_new_sheet(wb, "Corrida")
  openxlsx::writeData(wb, "Corrida", "Sorteo de la muestra", startRow = 1, startCol = 1)
  openxlsx::addStyle(wb, "Corrida", titulo, rows = 1, cols = 1)
  ficha <- data.frame(
    campo = c("Componente", "Método de selección", "Universo (N del marco)",
              "n a campo sorteado", "Titulares", "Reservas", "Semilla",
              "Generador aleatorio", "Versión de R", "Identificador de corrida",
              "Hash del marco (SHA-256)", "Hash de la configuración",
              "Archivo del marco", "Hoja", "Columna id", "Columna estrato",
              "Columna tamaño", "Fecha del sorteo (UTC)"),
    valor = c(comp$actor %||% "", .CM_GENERAL_METODO_ROTULO[[cr$metodo]] %||% cr$metodo,
              as.character(cr$N), as.character(corrida$n_fuente), as.character(cr$n_titulares),
              as.character(cr$n_reservas), as.character(cr$semilla), cr$rng_kind, cr$r_version,
              cr$run_id, cr$marco_hash, cr$config_hash, marco$file_id %||% "", marco$hoja %||% "",
              col$id %||% "", if (nzchar(col$estrato %||% "")) col$estrato else "—",
              if (nzchar(col$tamano %||% "")) col$tamano else "—", corrida$sorteado_at %||% ""),
    stringsAsFactors = FALSE
  )
  openxlsx::writeData(wb, "Corrida", ficha, startRow = 3, colNames = FALSE)
  openxlsx::addStyle(wb, "Corrida", cuerpo, rows = 3:(2 + nrow(ficha)), cols = 1:2, gridExpand = TRUE)
  fila_nota <- 4 + nrow(ficha)
  notas <- c(
    "Para repetir el sorteo: el mismo archivo de marco (mismo hash), la misma semilla y el mismo método dan el mismo listado en cualquier máquina.",
    "El peso base de cada titular es 1/π. Las reservas no tienen π propia: si se libera un lote, la π del estrato se recalcula como (n_h + liberadas)/N_h."
  )
  if (isTRUE(cr$piso_incumplible)) notas <- c(notas, "El piso por estrato no cabía en n: se repartió proporcional sin piso.")
  if (isTRUE(cr$reservas_omitidas_pps)) notas <- c(notas, "En PPS no se sortean reservas: su π al liberarlas no sería exacta.")
  openxlsx::writeData(wb, "Corrida", notas, startRow = fila_nota, startCol = 1)
  openxlsx::addStyle(wb, "Corrida", nota, rows = fila_nota:(fila_nota + length(notas) - 1), cols = 1)
  openxlsx::setColWidths(wb, "Corrida", cols = 1:2, widths = c(30, 70))

  # --- Memoria de cálculo --------------------------------------------------
  memoria <- calc_muestra_general_memoria(comp, resultado)
  names(memoria) <- c("Paso", "Fórmula", "Sustitución", "Resultado")
  pulso_xlsx_new_sheet(wb, "Memoria de cálculo")
  openxlsx::writeData(wb, "Memoria de cálculo", memoria, startRow = 1)
  openxlsx::addStyle(wb, "Memoria de cálculo", cab, rows = 1, cols = 1:4, gridExpand = TRUE)
  openxlsx::addStyle(wb, "Memoria de cálculo", cuerpo, rows = 2:(1 + nrow(memoria)), cols = 1:4, gridExpand = TRUE)
  openxlsx::setColWidths(wb, "Memoria de cálculo", cols = 1:4, widths = c(30, 42, 42, 18))

  # --- Estratos ------------------------------------------------------------
  est <- corrida$estratos
  est_out <- data.frame(Estrato = est$clave, N_h = est$N_h, n_h = est$n_h, `π` = est$pi,
                        `Peso base` = ifelse(is.na(est$pi) | est$pi <= 0, NA_real_, 1 / est$pi),
                        Reservas = est$n_reservas, check.names = FALSE, stringsAsFactors = FALSE)
  pulso_xlsx_new_sheet(wb, "Estratos")
  openxlsx::writeData(wb, "Estratos", est_out, startRow = 1)
  openxlsx::addStyle(wb, "Estratos", cab, rows = 1, cols = 1:6, gridExpand = TRUE)
  if (nrow(est_out)) {
    openxlsx::addStyle(wb, "Estratos", prob, rows = 2:(1 + nrow(est_out)), cols = 4)
    openxlsx::addStyle(wb, "Estratos", peso, rows = 2:(1 + nrow(est_out)), cols = 5)
  }
  openxlsx::setColWidths(wb, "Estratos", cols = 1:6, widths = c(24, 10, 10, 12, 12, 10))

  # --- Listado -------------------------------------------------------------
  u <- corrida$unidades
  u <- u[order(u$estado != "titular", u$estrato, u$orden, method = "radix"), , drop = FALSE]
  listado <- data.frame(Id = u$id, Estrato = u$estrato,
                        Estado = ifelse(u$estado == "titular", "Titular", "Reserva"),
                        Orden = u$orden, `Lote de reserva` = u$lote_reserva,
                        `π` = u$pi, `Peso base` = u$peso_base,
                        check.names = FALSE, stringsAsFactors = FALSE)
  pulso_xlsx_new_sheet(wb, "Listado")
  openxlsx::writeData(wb, "Listado", listado, startRow = 1)
  openxlsx::addStyle(wb, "Listado", cab, rows = 1, cols = 1:7, gridExpand = TRUE)
  if (nrow(listado)) {
    openxlsx::addStyle(wb, "Listado", prob, rows = 2:(1 + nrow(listado)), cols = 6)
    openxlsx::addStyle(wb, "Listado", peso, rows = 2:(1 + nrow(listado)), cols = 7)
  }
  openxlsx::freezePane(wb, "Listado", firstRow = TRUE)
  openxlsx::setColWidths(wb, "Listado", cols = 1:7, widths = c(18, 20, 10, 8, 10, 12, 12))

  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}
