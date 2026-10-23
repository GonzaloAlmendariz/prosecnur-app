# =============================================================================
# monitoreo_supervision_estratificada.R — Supervisión del monitoreo telefónico
# =============================================================================
#
# Revamp de Monitoreo › Telefónico, T9 (Control › Supervisión). Decisiones en
# `docs/qa/revamp-monitoreo/procedimientos-respondidos.md`:
#   - Se rellama una muestra de EFECTIVAS de Kobo (una por CodPulso), no de
#     las filas de la base: `monitoreo_supervision_sample` (monitoreo_engine.R)
#     sorteaba sobre todo el corte y sigue ahí para los otros modos.
#   - P5: reparto proporcional a las efectivas de cada enumerador, por mayor
#     resto, y al menos un caso por enumerador con efectivas (PDM 20 → 26).
#   - P6: el proyecto declara una CANTIDAD (`supervision_n`); la app muestra el
#     porcentaje equivalente. Semilla `supervision_seed`: misma semilla, misma
#     lista.
#   - P7: la hoja de resultados es una fuente propia y opcional, de solo
#     lectura (rol `supervision`, modelada sobre «Supervisión_Ronda3»). Se cruza
#     por «Código PULSO» o, si no, por proGres, y da por caso el resultado de la
#     rellamada y si lo que dijo la persona coincide con Kobo.
#
# Bloques (solo lectura):
#   - `supervision_resumen`: Indicador · Valor (Base, Declarados, Casos,
#     Semilla, Hoja).
#   - `supervision_reparto`: Enumerador · Efectivas · Casos · Mínimo.
#   - `supervision_casos`: N · CodPulso · proGres · Enumerador · Categoría ·
#     Fecha Kobo · Response ID · Resultado · Status final · Coincide ·
#     Observación.
# =============================================================================

.MONITOREO_SUPERVISION_ROL <- "supervision"

#' Reparto de `n` casos entre enumeradores en proporción a sus efectivas.
#'
#' Mayor resto; luego cada enumerador con efectivas recibe al menos uno, y
#' nadie recibe más casos que efectivas. Devuelve un entero por enumerador con
#' los nombres de `efectivas`.
#' @noRd
.monitoreo_supervision_reparto <- function(efectivas, n, minimo = TRUE) {
  efectivas <- efectivas[!is.na(efectivas) & efectivas > 0]
  if (!length(efectivas)) return(stats::setNames(integer(0), character(0)))
  n <- max(0L, as.integer(n))
  total <- sum(efectivas)
  cuota <- efectivas / total * min(n, total)
  casos <- floor(cuota)
  resto <- min(n, total) - sum(casos)
  if (resto > 0) {
    # Redondeado: 2.4 − 2 y 0.4 − 0 son el mismo resto y el empate lo decide
    # quien tiene más efectivas, no el error de coma flotante.
    orden <- order(-round(cuota - casos, 9), -efectivas, names(efectivas))
    casos[orden[seq_len(resto)]] <- casos[orden[seq_len(resto)]] + 1
  }
  if (isTRUE(minimo)) casos <- pmax(casos, 1)
  casos <- pmin(casos, efectivas)
  stats::setNames(as.integer(casos), names(efectivas))
}

.monitoreo_supervision_texto <- function(x) {
  v <- trimws(as.character(x %||% ""))
  v[is.na(v)] <- ""
  v
}

# Columna de la hoja de supervisión por alias (nombre de la hoja o su forma
# normalizada).
.monitoreo_supervision_col <- function(df, aliases) {
  col <- .monitoreo_report_col(df, aliases)
  if (nzchar(col)) col else ""
}

# «Coincide» desde la hoja: una columna explícita si la hay; si no, el status
# final o de supervisión leído por su texto. Vacío cuando no se puede decir.
.monitoreo_supervision_coincide <- function(explicita, status) {
  e <- .monitoreo_text_key(explicita)
  s <- .monitoreo_text_key(status)
  out <- rep("", length(s))
  si <- grepl("^(si|yes|1|true)$|coincide|conforme|valid", s) & !grepl("no coincide|no conforme|invalid", s)
  no <- grepl("no coincide|no conforme|discrep|inconsist|invalid|falsa|rechaz", s)
  out[si] <- "Sí"
  out[no] <- "No"
  out[grepl("^(si|yes|1|true|x)$", e)] <- "Sí"
  out[grepl("^(no|0|false)$", e)] <- "No"
  out
}

#' Resultados de la hoja de supervisión, una fila por llave (Código PULSO o
#' proGres en clave normalizada).
#' @noRd
.monitoreo_supervision_resultados <- function(hoja) {
  vacio <- list(por_pulso = list(), por_progres = list())
  if (is.null(hoja) || !is.data.frame(hoja) || !nrow(hoja)) return(vacio)
  col_pulso <- .monitoreo_supervision_col(hoja, c("Código PULSO", "Codigo PULSO", "CodPulso", "Cod Pulso", "Código Pulso"))
  col_progres <- .monitoreo_supervision_col(hoja, c("COD.proGres", "Código proGres", "Codigo proGres", "proGres"))
  col_resultado <- .monitoreo_supervision_col(hoja, c("Status supervisión", "Status supervision", "Estado supervisión", "Resultado supervisión"))
  col_final <- .monitoreo_supervision_col(hoja, c("Status final", "Estado final"))
  col_coincide <- .monitoreo_supervision_col(hoja, c("Coincide", "Respuestas coinciden", "Coinciden"))
  col_obs <- .monitoreo_supervision_col(hoja, c("Observaciones re barrido", "Observaciones supervisión", "Observaciones"))
  leer <- function(col) if (nzchar(col)) .monitoreo_supervision_texto(hoja[[col]]) else rep("", nrow(hoja))
  resultado <- leer(col_resultado)
  final <- leer(col_final)
  filas <- lapply(seq_len(nrow(hoja)), function(i) list(
    resultado = resultado[[i]],
    final = final[[i]],
    coincide = .monitoreo_supervision_coincide(leer(col_coincide)[[i]], if (nzchar(final[[i]])) final[[i]] else resultado[[i]]),
    observacion = leer(col_obs)[[i]]
  ))
  clave <- function(col) if (nzchar(col)) .monitoreo_text_key(leer(col)) else rep("", nrow(hoja))
  armar <- function(claves) {
    out <- list()
    for (i in seq_along(claves)) if (nzchar(claves[[i]]) && is.null(out[[claves[[i]]]])) out[[claves[[i]]]] <- filas[[i]]
    out
  }
  list(por_pulso = armar(clave(col_pulso)), por_progres = armar(clave(col_progres)))
}

#' Bloques de supervisión estratificada.
#'
#' `efectivas`: `control_tiempo_kobo` completo (CodPulso, Actor, Responsable
#' plataforma, Fecha Kobo, Response ID). `progres`: proGres por CodPulso
#' (nombres = CodPulso). `hoja`: filas de la fuente con rol `supervision`, o
#' NULL.
#' @noRd
.monitoreo_supervision_estratificada_blocks <- function(efectivas, cfg = list(), progres = character(0), hoja = NULL) {
  declarados <- max(1L, .monitoreo_int(cfg$supervision_n, 20L))
  semilla <- .monitoreo_int(cfg$supervision_seed, 20260514L)
  base <- if (is.data.frame(efectivas) && nrow(efectivas)) efectivas else data.frame(CodPulso = character(0))
  if (nrow(base)) {
    base$CodPulso <- .monitoreo_supervision_texto(base$CodPulso)
    base <- base[nzchar(base$CodPulso) & !duplicated(base$CodPulso), , drop = FALSE]
  }
  enumerador <- if (nrow(base)) {
    v <- .monitoreo_supervision_texto(base[["Responsable plataforma"]])
    ifelse(nzchar(v), v, "Sin enumerador")
  } else character(0)
  conteo <- table(enumerador)
  por_enumerador <- stats::setNames(as.integer(conteo), names(conteo))
  reparto <- .monitoreo_supervision_reparto(por_enumerador, declarados)
  proporcional <- .monitoreo_supervision_reparto(por_enumerador, declarados, minimo = FALSE)

  set.seed(semilla)
  elegidas <- integer(0)
  for (nombre in sort(names(reparto))) {
    filas <- which(enumerador == nombre)
    k <- reparto[[nombre]]
    elegidas <- c(elegidas, if (length(filas) <= k) filas else sort(sample(filas, k)))
  }
  hojas <- .monitoreo_supervision_resultados(hoja)
  conectada <- is.data.frame(hoja) && nrow(hoja) > 0L
  casos <- if (length(elegidas)) {
    cod <- base$CodPulso[elegidas]
    pg <- unname(ifelse(cod %in% names(progres), progres[cod], ""))
    pg[is.na(pg)] <- ""
    res <- lapply(seq_along(cod), function(i) {
      hits <- hojas$por_pulso[[.monitoreo_text_key(cod[[i]])]]
      if (is.null(hits) && nzchar(pg[[i]])) hits <- hojas$por_progres[[.monitoreo_text_key(pg[[i]])]]
      hits %||% list(resultado = "", final = "", coincide = "", observacion = "")
    })
    out <- data.frame(
      N = seq_along(cod),
      CodPulso = cod,
      proGres = pg,
      Enumerador = enumerador[elegidas],
      `Categoría` = .monitoreo_supervision_texto(base$Actor[elegidas]),
      `Fecha Kobo` = .monitoreo_supervision_texto(base[["Fecha Kobo"]][elegidas]),
      `Response ID` = .monitoreo_supervision_texto(base[["Response ID"]][elegidas]),
      Resultado = vapply(res, function(r) r$resultado, ""),
      `Status final` = vapply(res, function(r) r$final, ""),
      Coincide = vapply(res, function(r) r$coincide, ""),
      `Observación` = vapply(res, function(r) r$observacion, ""),
      check.names = FALSE, stringsAsFactors = FALSE
    )
    out <- out[order(out$Enumerador, out$CodPulso), , drop = FALSE]
    out$N <- seq_len(nrow(out))
    rownames(out) <- NULL
    out
  } else {
    data.frame(N = integer(0), CodPulso = character(0), proGres = character(0), Enumerador = character(0),
               `Categoría` = character(0), `Fecha Kobo` = character(0), `Response ID` = character(0),
               Resultado = character(0), `Status final` = character(0), Coincide = character(0),
               `Observación` = character(0), check.names = FALSE, stringsAsFactors = FALSE)
  }
  reparto_df <- data.frame(
    Enumerador = names(reparto),
    Efectivas = as.integer(conteo[names(reparto)]),
    Casos = unname(reparto),
    # El caso existe por el mínimo de P5, no por la proporción.
    `Mínimo` = unname(reparto) > unname(proporcional[names(reparto)]),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  reparto_df <- reparto_df[order(-reparto_df$Efectivas, reparto_df$Enumerador), , drop = FALSE]
  rownames(reparto_df) <- NULL
  resumen <- data.frame(
    Indicador = c("Base", "Declarados", "Casos", "Semilla", "Hoja"),
    Valor = c(as.character(nrow(base)), as.character(declarados), as.character(nrow(casos)), as.character(semilla),
              if (conectada) "conectada" else "sin_hoja"),
    stringsAsFactors = FALSE
  )
  list(
    .monitoreo_report_block("supervision_resumen", "Supervisión: resumen del sorteo", resumen),
    .monitoreo_report_block("supervision_reparto", "Supervisión: reparto por enumerador", reparto_df,
                            "Proporcional a las efectivas de cada enumerador, con al menos un caso por enumerador con efectivas."),
    .monitoreo_report_block("supervision_casos", "Supervisión: casos sorteados", casos,
                            if (conectada) "Resultado de la rellamada según la hoja de supervisión." else "Sin hoja de supervisión conectada.")
  )
}
