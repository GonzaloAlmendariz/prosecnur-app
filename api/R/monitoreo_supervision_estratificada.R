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
#     resto, y al menos un caso por enumerador con efectivas. El enumerador es
#     la persona: grafías que solo difieren en tildes, mayúsculas o espacios
#     (y las equivalencias confirmadas) son un solo estrato.
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
#     Semilla, Hoja [`conectada` | `sin_hoja`], En hoja, Controles).
#   - `supervision_reparto`: Enumerador · Efectivas · Casos · Mínimo.
#   - `supervision_casos`: N · CodPulso · proGres · Enumerador · Categoría ·
#     Fecha Kobo · Response ID · Resultado · Status final · Coincide ·
#     Observación · En hoja · Supervisor · Status barrido · Status supervisión ·
#     Intentos supervisión · Observaciones · Controles · Controles coinciden ·
#     Coincide según (`controles` | `hoja` | "").
#   - `supervision_controles`: CodPulso · Pregunta · Hoja · Kobo · Coincide,
#     una fila por pregunta de control y caso sorteado que está en la hoja.
# Pregunta de control = columna de la hoja con valores que también existe en
# Kobo (por nombre o por su etiqueta) y que no es un campo propio de la hoja.
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

# Campos propios de «Supervisión_Ronda3»: nunca son pregunta de control.
.MONITOREO_SUPERVISION_PROPIAS <- c(
  "N", "Fecha", "COD.proGres", "Código proGres", "Codigo proGres", "proGres", "Código PULSO", "Codigo PULSO",
  "CodPulso", "Cod Pulso", "Nombre del encuestador/a", "Nombre del encuestador", "Encuestador", "Nombre",
  "Telefono_final", "Teléfono final", "Tef1", "Tef2", "Tef3", "Observaciones", "Responsable de la supervisión",
  "Responsable de la supervision", "Status", "Status supervisión", "Status supervision", "Intentos supervisión",
  "Intentos supervision", "Observaciones re barrido", "Status final", "Estado final", "Coincide",
  "Respuestas coinciden", "Coinciden"
)

# Columna por nombre exacto (normalizado). «Status» no debe caer en
# «Status final» como haría la búsqueda por subcadena.
.monitoreo_supervision_col_exacta <- function(df, aliases) {
  nombres <- .monitoreo_text_key(names(df))
  for (alias in .monitoreo_text_key(aliases)) {
    idx <- which(nombres == alias)
    if (length(idx)) return(names(df)[idx[[1]]])
  }
  ""
}

# Iguales sin tildes, mayúsculas ni espacios; los números por su valor.
.monitoreo_supervision_igual <- function(a, b) {
  ka <- .monitoreo_text_key(a)
  kb <- .monitoreo_text_key(b)
  na <- suppressWarnings(as.numeric(ka))
  nb <- suppressWarnings(as.numeric(kb))
  ifelse(!is.na(na) & !is.na(nb), abs(na - nb) < 1e-9, ka == kb)
}

#' Preguntas de control: columna de la hoja → columna de Kobo.
#' @noRd
.monitoreo_supervision_controles_cols <- function(hoja, respuestas) {
  if (!is.data.frame(respuestas) || !nrow(respuestas) || !ncol(hoja)) return(character(0))
  con_valor <- function(df, col) any(nzchar(.monitoreo_supervision_texto(df[[col]])))
  propias <- .monitoreo_text_key(.MONITOREO_SUPERVISION_PROPIAS)
  kobo_cols <- names(respuestas)[vapply(names(respuestas), function(col) con_valor(respuestas, col), logical(1))]
  kobo_cols <- kobo_cols[!startsWith(kobo_cols, ".")]
  etiquetas <- .monitoreo_variable_label_map(respuestas)
  etiquetas <- etiquetas[names(etiquetas) %in% kobo_cols]
  out <- character(0)
  for (col in names(hoja)) {
    if (startsWith(col, ".") || .monitoreo_text_key(col) %in% propias || !con_valor(hoja, col)) next
    kobo <- if (col %in% kobo_cols) col else {
      hit <- names(etiquetas)[.monitoreo_text_key(etiquetas) == .monitoreo_text_key(col)]
      if (length(hit)) hit[[1]] else ""
    }
    if (nzchar(kobo)) out[[col]] <- kobo
  }
  out
}

#' Resultados de la hoja de supervisión, una fila por llave (Código PULSO o
#' proGres en clave normalizada). Las filas del `data` combinado traen las
#' columnas de las otras fuentes vacías: solo cuentan las que tienen valor.
#' @noRd
.monitoreo_supervision_resultados <- function(hoja, respuestas = NULL) {
  vacio <- list(por_pulso = list(), por_progres = list(), controles = character(0))
  if (is.null(hoja) || !is.data.frame(hoja) || !nrow(hoja)) return(vacio)
  hoja <- hoja[, vapply(names(hoja), function(col) any(nzchar(.monitoreo_supervision_texto(hoja[[col]]))), logical(1)), drop = FALSE]
  col <- function(aliases) .monitoreo_supervision_col_exacta(hoja, aliases)
  col_pulso <- col(c("Código PULSO", "Codigo PULSO", "CodPulso", "Cod Pulso", "Código Pulso"))
  col_progres <- col(c("COD.proGres", "Código proGres", "Codigo proGres", "proGres"))
  leer <- function(c) if (nzchar(c)) .monitoreo_supervision_texto(hoja[[c]]) else rep("", nrow(hoja))
  campo <- list(
    resultado = leer(col(c("Status supervisión", "Status supervision", "Estado supervisión", "Resultado supervisión"))),
    final = leer(col(c("Status final", "Estado final"))),
    coincide_hoja = leer(col(c("Coincide", "Respuestas coinciden", "Coinciden"))),
    observacion = leer(col(c("Observaciones re barrido", "Observaciones supervisión"))),
    observaciones = leer(col("Observaciones")),
    supervisor = leer(col(c("Responsable de la supervisión", "Responsable de la supervision"))),
    status_barrido = leer(col(c("Status", "Status barrido"))),
    intentos = leer(col(c("Intentos supervisión", "Intentos supervision")))
  )
  controles <- .monitoreo_supervision_controles_cols(hoja, respuestas)
  filas <- lapply(seq_len(nrow(hoja)), function(i) {
    f <- lapply(campo, function(v) v[[i]])
    f$coincide <- .monitoreo_supervision_coincide(f$coincide_hoja, if (nzchar(f$final)) f$final else f$resultado)
    f$controles <- stats::setNames(vapply(names(controles), function(c) .monitoreo_supervision_texto(hoja[[c]][[i]]), ""), names(controles))
    f
  })
  clave <- function(c) if (nzchar(c)) .monitoreo_text_key(leer(c)) else rep("", nrow(hoja))
  armar <- function(claves) {
    out <- list()
    for (i in seq_along(claves)) if (nzchar(claves[[i]]) && is.null(out[[claves[[i]]]])) out[[claves[[i]]]] <- filas[[i]]
    out
  }
  list(por_pulso = armar(clave(col_pulso)), por_progres = armar(clave(col_progres)), controles = controles)
}

# Sorteo con semilla sin tocar el RNG de la sesión.
.monitoreo_supervision_con_semilla <- function(semilla, expr) {
  previa <- if (exists(".Random.seed", envir = globalenv(), inherits = FALSE)) get(".Random.seed", envir = globalenv()) else NULL
  on.exit({
    if (is.null(previa)) {
      if (exists(".Random.seed", envir = globalenv(), inherits = FALSE)) rm(".Random.seed", envir = globalenv())
    } else assign(".Random.seed", previa, envir = globalenv())
  }, add = TRUE)
  set.seed(semilla)
  force(expr)
}

.MONITOREO_SUPERVISION_CASOS_COLS <- c(
  "N", "CodPulso", "proGres", "Enumerador", "Categoría", "Fecha Kobo", "Response ID", "Resultado", "Status final",
  "Coincide", "Observación", "En hoja", "Supervisor", "Status barrido", "Status supervisión", "Intentos supervisión",
  "Observaciones", "Controles", "Controles coinciden", "Coincide según", "Ronda", "Origen", "Resultado de"
)

.monitoreo_supervision_casos_vacio <- function() {
  tipos <- list(N = integer(0), Controles = integer(0), `Controles coinciden` = integer(0), Ronda = integer(0))
  cols <- lapply(.MONITOREO_SUPERVISION_CASOS_COLS, function(c) tipos[[c]] %||% character(0))
  as.data.frame(stats::setNames(cols, .MONITOREO_SUPERVISION_CASOS_COLS), check.names = FALSE, stringsAsFactors = FALSE)
}

.monitoreo_supervision_controles_vacio <- function() {
  data.frame(CodPulso = character(0), Pregunta = character(0), Hoja = character(0), Kobo = character(0),
             Coincide = character(0), check.names = FALSE, stringsAsFactors = FALSE)
}

#' Base de la supervisión: una fila por CodPulso efectivo de Kobo, con su
#' proGres, el enumerador (la persona) y la fecha de Kobo. Es el universo de
#' todas las rondas (monitoreo_supervision_rondas.R) y la del bloque
#' `supervision_base`.
#'
#' `efectivas`: `control_tiempo_kobo` completo (CodPulso, Actor, Responsable
#' plataforma, Fecha Kobo, Response ID). `progres`: proGres por CodPulso.
#' `respuestas`: filas de Kobo, para el enumerador por Response ID.
#' @noRd
.monitoreo_supervision_base <- function(efectivas, cfg = list(), progres = character(0), respuestas = NULL) {
  vacia <- data.frame(CodPulso = character(0), proGres = character(0), Enumerador = character(0),
                      `Categoría` = character(0), `Fecha Kobo` = character(0), `Response ID` = character(0),
                      check.names = FALSE, stringsAsFactors = FALSE)
  if (!is.data.frame(efectivas) || !nrow(efectivas) || !"CodPulso" %in% names(efectivas)) return(vacia)
  base <- efectivas
  base$CodPulso <- .monitoreo_supervision_texto(base$CodPulso)
  base <- base[nzchar(base$CodPulso) & !duplicated(base$CodPulso), , drop = FALSE]
  if (!nrow(base)) return(vacia)
  col <- function(nombre) if (nombre %in% names(base)) .monitoreo_supervision_texto(base[[nombre]]) else rep("", nrow(base))
  # El enumerador de Kobo por Response ID (alias de plataforma o la pregunta
  # del formulario, ver `.monitoreo_kobo_enumerador`); si no, el de
  # control_tiempo_kobo. Luego la persona (P5).
  v <- col("Responsable plataforma")
  por_id <- .monitoreo_kobo_enumerador_por_id(respuestas)
  if (length(por_id)) {
    w <- unname(por_id[col("Response ID")])
    v[!is.na(w) & nzchar(w)] <- w[!is.na(w) & nzchar(w)]
  }
  v <- .monitoreo_enumerador_persona(v, cfg$monitoreo_profile)
  data.frame(
    CodPulso = base$CodPulso, proGres = .monitoreo_discrepancias_progres_de(base$CodPulso, progres),
    Enumerador = ifelse(nzchar(v), v, "Sin enumerador"), `Categoría` = col("Actor"),
    `Fecha Kobo` = col("Fecha Kobo"), `Response ID` = col("Response ID"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

#' Sorteo estratificado sobre `base`: `n` casos repartidos por enumerador en
#' proporción a sus efectivas, con al menos uno por enumerador (P5), con
#' semilla. Devuelve list(elegidas = índices de `base`, reparto = data.frame).
#' @noRd
.monitoreo_supervision_sorteo <- function(base, n, semilla) {
  enumerador <- base$Enumerador %||% character(0)
  conteo <- table(enumerador)
  por_enumerador <- stats::setNames(as.integer(conteo), names(conteo))
  reparto <- if (n > 0L) .monitoreo_supervision_reparto(por_enumerador, n) else stats::setNames(integer(0), character(0))
  proporcional <- if (n > 0L) .monitoreo_supervision_reparto(por_enumerador, n, minimo = FALSE) else reparto
  elegidas <- .monitoreo_supervision_con_semilla(semilla, {
    out <- integer(0)
    for (nombre in sort(names(reparto))) {
      filas <- which(enumerador == nombre)
      k <- reparto[[nombre]]
      out <- c(out, if (length(filas) <= k) filas else sort(sample(filas, k)))
    }
    out
  })
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
  list(elegidas = elegidas, reparto = reparto_df)
}

#' Ronda 1 sin guardar: el sorteo de `supervision_n` sobre todas las efectivas,
#' igual que antes de las rondas (paridad). Desaparece cuando se guarda la
#' primera ronda.
#' @noRd
.monitoreo_supervision_ronda_virtual <- function(base, cfg) {
  declarados <- max(1L, .monitoreo_int(cfg$supervision_n, 20L))
  semilla <- .monitoreo_int(cfg$supervision_seed, 20260514L)
  sorteo <- .monitoreo_supervision_sorteo(base, declarados, semilla)
  casos <- base[sorteo$elegidas, , drop = FALSE]
  casos$Origen <- rep("sorteo", nrow(casos))
  list(
    numero = 1L, guardada = FALSE, generada_el = "", semilla = semilla, porcentaje = NA_real_,
    cantidad = declarados, universo = nrow(base), corte_anterior = "", corte = "",
    universo_claves = .monitoreo_nombre_clave(base$CodPulso), casos = casos, reparto = sorteo$reparto,
    publicada = NULL
  )
}

#' Bloques de supervisión estratificada.
#'
#' Una ronda o varias: las guardadas (`cfg$monitoreo_profile$supervision_rondas`,
#' que el estado inyecta desde la sesión) o, si no hay ninguna, la Ronda 1 sin guardar.
#' `hoja`: filas de la fuente con rol `supervision`, o NULL. `respuestas`:
#' filas de Kobo, para comparar las preguntas de control por Response ID.
#' @noRd
.monitoreo_supervision_estratificada_blocks <- function(efectivas, cfg = list(), progres = character(0), hoja = NULL, respuestas = NULL) {
  base <- .monitoreo_supervision_base(efectivas, cfg, progres, respuestas)
  guardadas <- .monitoreo_supervision_rondas_de_cfg(cfg)
  rondas <- if (length(guardadas)) guardadas else list(.monitoreo_supervision_ronda_virtual(base, cfg))
  ultima <- rondas[[length(rondas)]]

  hojas <- .monitoreo_supervision_resultados(hoja, respuestas)
  # Cada ronda lee primero su propia pestaña «Ronda N» (leída por
  # monitoreo_supervision_rondas.R) y, si el caso no está ahí, la declarada.
  hojas_ronda <- lapply(rondas, function(r) {
    filas <- (r$resultados %||% list())$filas
    if (is.data.frame(filas) && nrow(filas)) .monitoreo_supervision_resultados(filas, respuestas) else NULL
  })
  conectada <- (is.data.frame(hoja) && nrow(hoja) > 0L) || any(!vapply(hojas_ronda, is.null, logical(1)))
  kobo_ids <- if (is.data.frame(respuestas) && nrow(respuestas)) .monitoreo_report_first_values(respuestas, .MONITOREO_KOBO_ID_ALIAS) else character(0)
  controles_largo <- list()
  casos_de <- function(k) {
    ronda <- rondas[[k]]
    propia <- hojas_ronda[[k]]
    sel <- ronda$casos
    if (!is.data.frame(sel) || !nrow(sel)) return(NULL)
    cod <- .monitoreo_supervision_texto(sel$CodPulso)
    rid <- .monitoreo_supervision_texto(sel[["Response ID"]])
    pg <- .monitoreo_supervision_texto(sel$proGres)
    buscar <- function(h, i) {
      if (is.null(h)) return(NULL)
      hit <- h$por_pulso[[.monitoreo_text_key(cod[[i]])]]
      if (is.null(hit) && nzchar(pg[[i]])) hit <- h$por_progres[[.monitoreo_text_key(pg[[i]])]]
      hit
    }
    res <- lapply(seq_along(cod), function(i) {
      hit <- buscar(propia, i)
      fuente <- hojas
      de <- sprintf("Ronda %d", as.integer(ronda$numero))
      if (is.null(hit)) {
        hit <- buscar(hojas, i)
        de <- "hoja declarada"
      } else {
        fuente <- propia
      }
      if (is.null(hit)) return(list(en_hoja = FALSE))
      hit$en_hoja <- TRUE
      hit$de <- de
      fila_kobo <- if (nzchar(rid[[i]])) match(rid[[i]], kobo_ids) else NA_integer_
      cmp <- character(0)
      for (pregunta in names(fuente$controles)) {
        en_hoja <- hit$controles[[pregunta]] %||% ""
        if (!nzchar(en_hoja) || is.na(fila_kobo)) next
        en_kobo <- .monitoreo_supervision_texto(respuestas[[fuente$controles[[pregunta]]]][[fila_kobo]])
        igual <- .monitoreo_supervision_igual(en_hoja, en_kobo)
        cmp[[pregunta]] <- if (igual) "Sí" else "No"
        controles_largo[[length(controles_largo) + 1L]] <<- data.frame(
          CodPulso = cod[[i]], Pregunta = pregunta, Hoja = en_hoja, Kobo = en_kobo, Coincide = cmp[[pregunta]],
          check.names = FALSE, stringsAsFactors = FALSE
        )
      }
      hit$n_controles <- length(cmp)
      hit$n_iguales <- sum(cmp == "Sí")
      # Las respuestas de control mandan; sin ellas, lo que diga la hoja.
      if (length(cmp)) {
        hit$coincide <- if (all(cmp == "Sí")) "Sí" else "No"
        hit$segun <- "controles"
      } else {
        hit$segun <- if (nzchar(hit$coincide)) "hoja" else ""
      }
      hit
    })
    campo <- function(k, vacio = "") vapply(res, function(r) if (isTRUE(r$en_hoja)) as.character(r[[k]] %||% vacio) else vacio, "")
    out <- data.frame(
      N = seq_along(cod), CodPulso = cod, proGres = pg, Enumerador = .monitoreo_supervision_texto(sel$Enumerador),
      `Categoría` = .monitoreo_supervision_texto(sel[["Categoría"]]),
      `Fecha Kobo` = .monitoreo_supervision_texto(sel[["Fecha Kobo"]]),
      `Response ID` = rid,
      Resultado = campo("resultado"), `Status final` = campo("final"), Coincide = campo("coincide"),
      `Observación` = campo("observacion"),
      `En hoja` = ifelse(vapply(res, function(r) isTRUE(r$en_hoja), logical(1)), "Sí", "No"),
      Supervisor = campo("supervisor"), `Status barrido` = campo("status_barrido"),
      `Status supervisión` = campo("resultado"), `Intentos supervisión` = campo("intentos"),
      Observaciones = campo("observaciones"),
      Controles = vapply(res, function(r) as.integer(r$n_controles %||% 0L), integer(1)),
      `Controles coinciden` = vapply(res, function(r) as.integer(r$n_iguales %||% 0L), integer(1)),
      `Coincide según` = campo("segun"),
      Ronda = rep(as.integer(ronda$numero), length(cod)),
      Origen = .monitoreo_supervision_texto(sel$Origen %||% rep("sorteo", length(cod))),
      `Resultado de` = campo("de"),
      check.names = FALSE, stringsAsFactors = FALSE
    )
    out <- out[order(out$Origen != "sorteo", out$Enumerador, out$CodPulso), .MONITOREO_SUPERVISION_CASOS_COLS, drop = FALSE]
    out$N <- seq_len(nrow(out))
    out
  }
  partes <- Filter(Negate(is.null), lapply(seq_along(rondas), casos_de))
  casos <- if (length(partes)) do.call(rbind, partes) else .monitoreo_supervision_casos_vacio()
  rownames(casos) <- NULL
  controles_df <- if (length(controles_largo)) do.call(rbind, controles_largo) else .monitoreo_supervision_controles_vacio()
  if (nrow(controles_df)) {
    controles_df <- controles_df[order(controles_df$CodPulso, controles_df$Pregunta), , drop = FALSE]
    rownames(controles_df) <- NULL
  }
  reparto_df <- do.call(rbind, lapply(rondas, function(r) {
    rep_df <- r$reparto
    if (!is.data.frame(rep_df) || !nrow(rep_df)) {
      return(data.frame(Enumerador = character(0), Efectivas = integer(0), Casos = integer(0), `Mínimo` = logical(0),
                        Ronda = integer(0), check.names = FALSE, stringsAsFactors = FALSE))
    }
    rep_df$Ronda <- rep(as.integer(r$numero), nrow(rep_df))
    rep_df[, c("Enumerador", "Efectivas", "Casos", "Mínimo", "Ronda"), drop = FALSE]
  }))
  rownames(reparto_df) <- NULL
  vistos <- unique(unlist(lapply(rondas, function(r) c(r$universo_claves, .monitoreo_nombre_clave(r$casos$CodPulso)))))
  claves_base <- .monitoreo_nombre_clave(base$CodPulso)
  sin_ronda <- if (length(guardadas)) sum(!claves_base %in% vistos) else 0L
  resumen <- data.frame(
    Indicador = c("Base", "Declarados", "Casos", "Semilla", "Hoja", "En hoja", "Controles",
                  "Rondas", "Rondas guardadas", "Efectivas sin ronda"),
    Valor = c(as.character(nrow(base)), as.character(ultima$cantidad), as.character(nrow(casos)), as.character(ultima$semilla),
              if (conectada) "conectada" else "sin_hoja", as.character(sum(casos$`En hoja` == "Sí")),
              as.character(length(unique(c(names(hojas$controles), unlist(lapply(hojas_ronda, function(h) names(h$controles))))))),
              as.character(length(rondas)), as.character(length(guardadas)),
              as.character(sin_ronda)),
    stringsAsFactors = FALSE
  )
  caso_ronda <- stats::setNames(
    unlist(lapply(rondas, function(r) rep(as.character(r$numero), nrow(r$casos %||% data.frame())))),
    unlist(lapply(rondas, function(r) .monitoreo_nombre_clave(r$casos$CodPulso)))
  )
  base_df <- base
  base_df$Ronda <- unname(ifelse(claves_base %in% names(caso_ronda), caso_ronda[claves_base], ""))
  base_df$Disponible <- ifelse(nzchar(base_df$Ronda), "No", "Sí")
  list(
    .monitoreo_report_block("supervision_resumen", "Supervisión: resumen del sorteo", resumen),
    .monitoreo_report_block("supervision_reparto", "Supervisión: reparto por enumerador", reparto_df,
                            "Proporcional a las efectivas de cada enumerador, con al menos un caso por enumerador con efectivas."),
    .monitoreo_report_block("supervision_casos", "Supervisión: casos sorteados", casos,
                            if (conectada) "Resultado de la rellamada según la hoja de supervisión." else "Sin hoja de supervisión conectada."),
    .monitoreo_report_block("supervision_controles", "Supervisión: preguntas de control frente a Kobo", controles_df,
                            if (!conectada) "Sin hoja de supervisión conectada." else if (!length(controles_largo)) "La hoja no trae preguntas que existan en Kobo." else ""),
    .monitoreo_report_block("supervision_rondas", "Supervisión: rondas", .monitoreo_supervision_rondas_df(rondas),
                            if (length(guardadas)) "" else "Ronda 1 sin guardar: el sorteo de supervision_n sobre todas las efectivas."),
    .monitoreo_report_block("supervision_avisos", "Supervisión: avisos de la hoja", .monitoreo_supervision_avisos_df(rondas)),
    .monitoreo_report_block("supervision_base", "Supervisión: efectivas de Kobo", base_df,
                            "Universo de las rondas: una fila por CodPulso efectivo. «Disponible» = nunca elegido en una ronda.")
  )
}
