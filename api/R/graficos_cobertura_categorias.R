# =============================================================================
# graficos_cobertura_categorias.R — cobertura por categorías de una variable frente al universo (ADR 0140)
# =============================================================================
#
# Versión "Por categorías de una variable" de `p_cobertura` (variante `p_cobertura:categorias`, `modo = "categorias"`).
# El analista elige una variable y una o varias bases; por cada categoría el motor cuenta el n y el % de la muestra y el
# analista teclea el universo (`universo_categorias`). La lámina muestra el % de la muestra frente al % del universo y
# la diferencia en puntos.
#
# Reglas del ADR 0140 que este archivo fija:
#   - Denominador: respuestas válidas de la variable (filas tras los filtros, sin NA ni vacío ni 90, 94, 98, 99). Los
#     especiales van en una nota aparte, con su n y su % sobre todos los encuestados de la base.
#   - Sin ponderar. Con pesos en el proyecto, la lámina dice "Sin ponderar".
#   - Una fila de categorías por base, cada una contra su universo; las categorías se alinean por código.
#   - El universo se guarda como se tecleó (conteos más total, o porcentajes); el % se deriva. Con %, una suma fuera de
#     99.5–100.5 se avisa sin reescalar; un total que no calza con la suma de los conteos se avisa y se usa la suma.
#   - Una categoría del universo con n = 0 va con 0 % y diferencia negativa; una de la muestra que el universo no trae
#     sale "sin dato", sin diferencia y con aviso. Sin universo no hay barra del universo y la lámina lo dice. Un
#     universo que ya no calza con la variable o la base se avisa al dibujar; nunca se descarta en silencio.
#   - Precisión completa; se redondea sólo al rotular y la diferencia sale de los valores sin redondear.
#   - Sin prueba de ajuste ni juicio inventado: la tolerancia sólo si el analista la teclea.

.COBCAT_VERSION <- "cobertura_categorias/1"
.COBCAT_ESPECIALES <- c("90", "94", "98", "99")
.COBCAT_ESPECIALES_ROTULO <- c(`90` = "No aplica", `94` = "No sabe / No responde", `98` = "No sabe", `99` = "No responde")
.COBCAT_SUMA_PCT <- c(99.5, 100.5)
.COBCAT_LEYENDA <- c(muestra = "Muestra", universo = "Universo")

# ---- Validación de los args (stop_api con código registrado) --------------------------------------------------------

#' Texto escalar de un arg (lista de uno, vector o NULL): `""` si viene vacío
#' @keywords internal
.cobcat_texto <- function(x) {
  if (is.null(x) || !length(x)) return("")
  v <- as.character(unlist(x, use.names = FALSE))[1]
  if (is.na(v)) "" else trimws(v)
}

#' Número escalar de un arg o `NA` (vacío o nulo); `FALSE` en `ok` si trae algo que no es número
#' @keywords internal
.cobcat_numero <- function(x) {
  if (is.null(x) || !length(x)) return(list(v = NA_real_, ok = TRUE))
  u <- unlist(x, use.names = FALSE)
  if (!length(u) || (length(u) == 1L && is.na(u))) return(list(v = NA_real_, ok = TRUE))
  if (is.character(u) && !nzchar(trimws(u[1]))) return(list(v = NA_real_, ok = TRUE))
  v <- suppressWarnings(as.numeric(gsub(",", ".", as.character(u[1]), fixed = TRUE)))
  list(v = v, ok = is.finite(v))
}

#' La variable de la versión por categorías: un nombre de columna (sin "base$")
#' @keywords internal
.cobcat_variable <- function(variable) {
  if (is.null(variable)) return(NULL)
  if (length(unlist(variable)) > 1L) stop_api(400, "E_COBERTURA_CAT_VARIABLE", "`variable` es una sola pregunta.")
  v <- .cobcat_texto(variable)
  if (!nzchar(v)) return(NULL)
  sub("^.*\\$", "", v)
}

#' La tolerancia que tecleó el analista, en puntos; `NULL` si no hay
#' @keywords internal
.cobcat_tolerancia <- function(x) {
  n <- .cobcat_numero(x)
  if (!n$ok || (is.finite(n$v) && n$v <= 0)) {
    stop_api(400, "E_COBERTURA_CAT_TOLERANCIA", "`tolerancia_pts` debe ser un número mayor que cero, en puntos.")
  }
  if (is.finite(n$v)) n$v else NULL
}

#' Normaliza `universo_categorias`: por base, `{modo, total?, variable?, categorias: [{codigo, etiqueta, valor}]}`
#'
#' Se guarda lo tecleado: no se deriva ni se reescala aquí. Un `valor` nulo es una celda que el analista dejó vacía (la
#' categoría queda fuera del universo y sale "sin dato"). Acepta lista o data.frame de categorías.
#' @return Lista nombrada por base o `NULL`.
#' @keywords internal
.cobcat_universo_normalizar <- function(x) {
  falla <- function(...) stop_api(400, "E_COBERTURA_CAT_UNIVERSO", paste0(...))
  if (is.null(x) || !length(x)) return(NULL)
  if (!is.list(x) || is.null(names(x)) || any(!nzchar(trimws(names(x))))) {
    falla("`universo_categorias` es un objeto con una entrada por base: {\"docentes\": {modo, total, categorias}}.")
  }
  out <- list()
  for (b in names(x)) {
    u <- x[[b]]
    if (is.null(u) || !length(u)) next
    if (!is.list(u)) falla("El universo de \"", b, "\" debe ser un objeto {modo, total, categorias}.")
    modo <- .cobcat_texto(u$modo)
    if (!modo %in% c("conteos", "porcentajes")) falla("El universo de \"", b, "\" va en \"conteos\" o en \"porcentajes\" (`modo`).")
    tot <- .cobcat_numero(u$total)
    if (!tot$ok || (is.finite(tot$v) && tot$v < 0)) falla("El total del universo de \"", b, "\" debe ser un número no negativo.")
    cats <- u$categorias %||% list()
    if (is.data.frame(cats)) cats <- lapply(seq_len(nrow(cats)), function(i) as.list(cats[i, , drop = FALSE]))
    if (!is.list(cats)) falla("Las categorías del universo de \"", b, "\" son una lista de {codigo, etiqueta, valor}.")
    filas <- lapply(cats, function(cd) {
      if (!is.list(cd)) falla("Cada categoría del universo de \"", b, "\" es un objeto {codigo, etiqueta, valor}.")
      cod <- .cobcat_texto(cd$codigo)
      if (!nzchar(cod)) falla("Una categoría del universo de \"", b, "\" no tiene código.")
      val <- .cobcat_numero(cd$valor)
      if (!val$ok || (is.finite(val$v) && val$v < 0)) falla("El valor de la categoría ", cod, " del universo de \"", b, "\" debe ser un número no negativo.")
      if (identical(modo, "porcentajes") && is.finite(val$v) && val$v > 100) {
        falla("El porcentaje de la categoría ", cod, " del universo de \"", b, "\" pasa de 100.")
      }
      list(codigo = cod, etiqueta = .cobcat_texto(cd$etiqueta), valor = val$v)
    })
    cods <- vapply(filas, `[[`, "", "codigo")
    if (anyDuplicated(cods)) falla("El universo de \"", b, "\" repite la categoría ", cods[duplicated(cods)][1], ".")
    out[[trimws(b)]] <- list(modo = modo, total = tot$v, variable = .cobcat_texto(u$variable), categorias = filas)
  }
  if (length(out)) out else NULL
}

# ---- Cálculo por base -------------------------------------------------------------------------------------------------

#' ¿Es un valor especial o vacío? NA, texto vacío o 90, 94, 98, 99 (también como número: "99.0")
#' @keywords internal
.cobcat_es_especial <- function(x) {
  s <- trimws(as.character(x))
  num <- suppressWarnings(as.numeric(s))
  is.na(x) | is.na(s) | !nzchar(s) | s %in% .COBCAT_ESPECIALES | (!is.na(num) & num %in% as.numeric(.COBCAT_ESPECIALES))
}

#' Código canónico: "1.0" y "1" son la misma categoría (alineación por código, no por etiqueta)
#' @keywords internal
.cobcat_codigo <- function(x) {
  s <- trimws(as.character(x))
  num <- suppressWarnings(as.numeric(s))
  entero <- !is.na(num) & is.finite(num) & num == round(num)
  s[entero] <- format(num[entero], scientific = FALSE, trim = TRUE)
  s
}

#' Rótulos código → etiqueta de una variable: el instrumento; si no, las etiquetas de la columna (haven)
#' @keywords internal
.cobcat_rotulos <- function(var, inst, x) {
  m <- if (!is.null(inst)) tryCatch(.explorar_map_choices(var, inst), error = function(e) NULL) else NULL
  if (length(m)) return(stats::setNames(as.character(m), .cobcat_codigo(names(m))))
  lb <- attr(x, "labels", exact = TRUE)
  if (length(lb)) return(stats::setNames(as.character(names(lb)), .cobcat_codigo(unname(lb))))
  character(0)
}

#' Orden de los códigos: el del instrumento; después los de la muestra (numéricos primero) y al final los del universo
#' @keywords internal
.cobcat_orden <- function(rot, muestra, universo) {
  resto <- setdiff(c(muestra, universo), names(rot))
  num <- suppressWarnings(as.numeric(resto))
  resto <- resto[order(is.na(num), num, resto)]
  unique(c(intersect(names(rot), c(muestra, universo)), resto))
}

#' Una base: n por categoría, % de la muestra y % del universo, con los avisos de esa base
#'
#' @param data Data frame de la base (sin filtrar). @param inst Instrumento de la base.
#' @param base Nombre de la base. @param variable Variable pedida (se resuelve a su `_recod` si existe).
#' @param universo Entrada de la base en `universo_categorias` normalizado, o `NULL`.
#' @param filtros Filtros de la lámina. @param base_minima Base mínima de la regla del estudio.
#' @return Lista con `base`, `variable_usada`, `recodificada`, `n_encuestados`, `n_validos`, `especiales`
#'   (data.frame codigo, etiqueta, n, pct), `filas` (data.frame por categoría), `sin_universo`, `avisos`.
#' @keywords internal
.cobcat_base <- function(data, inst, base, variable, universo = NULL, filtros = list(), base_minima = 30,
                         todas_las_del_instrumento = FALSE) {
  publico <- .radar_mb_capitalizar(base)
  d <- .apply_named_filters_safe(data, filters = filtros %||% list(), arg_name = "filtros de la cobertura")
  var_usada <- .reporte_plan_resolve_recod_var(variable, d)
  if (!var_usada %in% names(d)) var_usada <- .reporte_plan_resolve_recod_var(variable, data)
  if (!var_usada %in% names(data)) {
    stop_api(400, "E_COBERTURA_CAT_VARIABLE", sprintf("La variable \"%s\" no está en la base \"%s\".", variable, base))
  }
  x <- if (var_usada %in% names(d)) d[[var_usada]] else data[[var_usada]][0]
  rot <- .cobcat_rotulos(var_usada, inst, data[[var_usada]])
  avisos <- character(0)
  esp <- .cobcat_es_especial(x)
  cod <- .cobcat_codigo(if (inherits(x, "haven_labelled")) as.vector(x) else x)
  n_enc <- length(x); n_val <- sum(!esp)
  # Especiales con código (no los NA ni el vacío): la nota aparte, sobre todos los encuestados de la base.
  cod_esp <- cod[esp & !is.na(cod) & nzchar(cod)]
  tab_esp <- table(cod_esp)
  especiales <- data.frame(codigo = names(tab_esp), n = as.integer(tab_esp), stringsAsFactors = FALSE)
  especiales$etiqueta <- vapply(especiales$codigo, function(k) .cobcat_o(rot[k], .cobcat_o(.COBCAT_ESPECIALES_ROTULO[k], k)), "")
  especiales$pct <- if (n_enc > 0) 100 * especiales$n / n_enc else rep(NA_real_, nrow(especiales))
  tab <- table(cod[!esp])
  muestra_cod <- names(tab)
  # El universo de la base, como se tecleó; los especiales del universo no entran (avisado).
  sin_universo <- is.null(universo)
  u_cod <- character(0); u_pct <- numeric(0); u_etq <- character(0)
  if (!sin_universo) {
    cats <- universo$categorias
    u_cod <- .cobcat_codigo(vapply(cats, `[[`, "", "codigo"))
    u_val <- vapply(cats, function(cd) as.numeric(cd$valor), 0)
    u_etq <- vapply(cats, `[[`, "", "etiqueta")
    esp_u <- .cobcat_es_especial(u_cod)
    if (any(esp_u & is.finite(u_val))) {
      avisos <- c(avisos, sprintf("El universo de %s trae %s, que no entra en las barras (es un valor especial).", publico,
                                  paste(u_cod[esp_u & is.finite(u_val)], collapse = ", ")))
    }
    keep <- !esp_u & is.finite(u_val)
    u_cod <- u_cod[keep]; u_val <- u_val[keep]; u_etq <- u_etq[keep]
    suma <- sum(u_val)
    if (!length(u_cod) || suma <= 0) {
      sin_universo <- TRUE
      avisos <- c(avisos, sprintf("El universo de %s no trae cifras: no se dibuja su barra.", publico))
    } else if (identical(universo$modo, "porcentajes")) {
      if (suma < .COBCAT_SUMA_PCT[1] || suma > .COBCAT_SUMA_PCT[2]) {
        avisos <- c(avisos, sprintf("Los porcentajes del universo de %s suman %s%%, fuera de 99.5 a 100.5: se dibujan como se teclearon, sin reescalar.",
                                    publico, .pulso_fmt_half_up(suma, 1L)))
      }
      u_pct <- u_val
    } else {
      if (is.finite(universo$total) && abs(universo$total - suma) > 1e-9) {
        avisos <- c(avisos, sprintf("El total del universo de %s (%s) no coincide con la suma de sus categorías (%s): se usa la suma.",
                                    publico, .dumbbell_fmt_casos(universo$total), .dumbbell_fmt_casos(suma)))
      }
      u_pct <- 100 * u_val / suma
    }
    # Universo viejo: guardado con otra variable, o con categorías que la variable ya no tiene.
    if (nzchar(universo$variable %||% "") && !universo$variable %in% c(variable, var_usada)) {
      avisos <- c(avisos, sprintf("El universo de %s se tecleó para \"%s\" y la lámina usa \"%s\": revísalo.", publico, universo$variable, var_usada))
    }
    conocidas <- c(names(rot), muestra_cod)
    ajenas <- setdiff(u_cod, conocidas)
    if (length(ajenas) && length(conocidas)) {
      avisos <- c(avisos, sprintf("El universo de %s trae categorías que \"%s\" no tiene (%s): se dibujan con 0%% en la muestra; revísalo.",
                                  publico, var_usada, paste(ajenas, collapse = ", ")))
    }
  }
  if (sin_universo && is.null(universo)) avisos <- c(avisos, sprintf("%s no tiene universo tecleado: no se dibuja su barra.", publico))
  # Una categoría del instrumento que nadie marcó y el universo no trae no aporta nada a la lámina; la tabla del universo
  # (el endpoint) sí la ofrece, para que el analista teclee su cifra.
  del_inst <- if (isTRUE(todas_las_del_instrumento)) names(rot)[!.cobcat_es_especial(names(rot))] else character(0)
  codigos <- .cobcat_orden(rot, unique(c(muestra_cod, del_inst)), if (sin_universo) character(0) else u_cod)
  n <- as.integer(ifelse(codigos %in% muestra_cod, tab[codigos], 0L))
  pct_m <- if (n_val > 0) 100 * n / n_val else rep(NA_real_, length(codigos))
  pct_u <- if (sin_universo) rep(NA_real_, length(codigos)) else unname(u_pct[match(codigos, u_cod)])
  etq <- vapply(seq_along(codigos), function(i) {
    k <- codigos[i]
    r <- rot[k]
    if (!is.na(r) && nzchar(r)) return(unname(r))
    j <- match(k, u_cod)
    if (!is.na(j) && nzchar(u_etq[j])) return(u_etq[j])
    k
  }, "")
  estado <- if (sin_universo) rep("sin_universo", length(codigos)) else ifelse(is.na(pct_u), "sin_dato", "ok")
  filas <- data.frame(codigo = codigos, etiqueta = etq, n = n, pct_muestra = pct_m, pct_universo = pct_u,
                      diferencia = pct_m - pct_u, estado = estado, stringsAsFactors = FALSE)
  if (n_val == 0L) {
    avisos <- c(avisos, sprintf("%s no tiene respuestas válidas en \"%s\"%s: no hay %% de la muestra.", publico, var_usada,
                                if (n_enc == 0L) " (la base queda sin casos)" else " (sólo valores especiales)"))
  }
  sd <- filas$etiqueta[filas$estado == "sin_dato"]
  if (length(sd)) avisos <- c(avisos, sprintf("El universo de %s no trae %s: sale \"sin dato\", sin diferencia.", publico, paste(sd, collapse = ", ")))
  # n = 0 no es una lectura frágil: es el hallazgo (la categoría no entró en la muestra).
  chicas <- filas$n > 0L & filas$n < base_minima
  if (any(chicas)) {
    avisos <- c(avisos, sprintf("En %s, %s con menos de %s casos: lectura referencial.", publico,
                                paste(sprintf("%s (n = %d)", filas$etiqueta[chicas], filas$n[chicas]), collapse = ", "), format(base_minima)))
  }
  filas$chica <- filas$n > 0L & filas$n < base_minima
  list(base = base, publico = publico, variable = variable, variable_usada = var_usada, recodificada = !identical(var_usada, variable),
       n_encuestados = n_enc, n_validos = n_val, especiales = especiales, filas = filas, sin_universo = sin_universo,
       avisos = avisos)
}

#' `a` si es un texto presente; si no, `b`
#' @keywords internal
.cobcat_o <- function(a, b) if (length(a) && !is.na(a[1]) && nzchar(a[1])) unname(a[1]) else b

#' Las categorías de una variable por base, para prellenar la tabla del universo (endpoint)
#'
#' @return Lista por base `{base, variable_usada, recodificada, n_encuestados, n_validos, categorias: [{codigo, etiqueta, n}],
#'   especiales: [{codigo, etiqueta, n}]}`. Trae las categorías del instrumento aunque nadie las haya marcado (n = 0).
#' @keywords internal
.cobcat_categorias_por_base <- function(data_sources, inst_sources, variable, bases = NULL, filtros = list()) {
  variable <- .cobcat_variable(variable)
  if (is.null(variable)) stop_api(400, "E_COBERTURA_CAT_VARIABLE", "Falta la `variable`.")
  bases <- .cobcat_bases(bases, names(data_sources))
  lapply(bases, function(b) {
    r <- .cobcat_base(data_sources[[b]], inst_sources[[b]], b, variable, universo = NULL, filtros = filtros,
                      todas_las_del_instrumento = TRUE)
    f <- r$filas
    list(base = b, variable_usada = r$variable_usada, recodificada = r$recodificada, n_encuestados = r$n_encuestados,
         n_validos = r$n_validos,
         categorias = lapply(seq_len(nrow(f)), function(i) list(codigo = f$codigo[i], etiqueta = f$etiqueta[i], n = f$n[i])),
         especiales = lapply(seq_len(nrow(r$especiales)), function(i) list(codigo = r$especiales$codigo[i],
                                                                           etiqueta = r$especiales$etiqueta[i], n = r$especiales$n[i])))
  })
}

#' Bases pedidas (vacío = todas las del estudio, sin las ediciones de una serie); una que no está es un 400
#' @keywords internal
.cobcat_bases <- function(bases, disponibles) {
  bs <- trimws(as.character(unlist(bases %||% character(0))))
  bs <- unique(bs[!is.na(bs) & nzchar(bs)])
  if (!length(bs)) bs <- .cobertura_bases_publico(disponibles)
  faltan <- setdiff(bs, disponibles)
  if (length(faltan)) stop_api(400, "E_COBERTURA_CAT_BASE", sprintf("La base \"%s\" no está en el estudio.", faltan[1]))
  bs
}

# ---- Especificación de la lámina ------------------------------------------------------------------------------------

#' Texto del filtro activo de la lámina: "Filtro: Sexo = Mujer"; el universo tecleado es del total
#' @keywords internal
.cobcat_filtro_texto <- function(filtros, inst = NULL) {
  if (is.null(filtros) || !length(filtros)) return(NULL)
  partes <- vapply(names(filtros), function(v) {
    val <- filtros[[v]]
    var <- sub("^.*\\$", "", v)
    etq_var <- tryCatch({ s <- inst$survey; l <- s$label[match(var, s$name)]; if (length(l) && !is.na(l) && nzchar(l)) l else var },
                        error = function(e) var)
    if (is.data.frame(val) || (is.list(val) && !is.null(names(val)))) return(etq_var)
    cods <- trimws(as.character(unlist(val)))
    rot <- if (!is.null(inst)) tryCatch(.explorar_map_choices(var, inst), error = function(e) NULL) else NULL
    etq <- vapply(cods, function(k) .cobcat_o(rot[k], k), "")
    paste0(etq_var, " = ", paste(etq, collapse = ", "))
  }, "")
  paste0("Filtro: ", paste(partes, collapse = "; "), " (el universo es del total)")
}

#' Especificación de la cobertura por categorías (`cobertura_categorias/1`, con `tipo = "cobertura"`)
#'
#' @param bloques Lista de `.cobcat_base()` (una por base, en su orden).
#' @param tolerancia Puntos que tecleó el analista, o `NULL`.
#' @param ponderado ¿El proyecto tiene pesos? La lámina dice "Sin ponderar".
#' @param filtro_texto Texto del filtro activo (`.cobcat_filtro_texto`) o `NULL`.
#' @param base_minima Base mínima de la regla del estudio.
#' @return Lista `cobertura_categorias/1`: `bloques` (cada uno con `filas` y sus textos), `escala_max`, `colores`,
#'   `leyenda`, `notas_pie`, `avisos`, `tolerancia`, `decimales`.
#' @keywords internal
.espec_cobertura_categorias <- function(bloques, tolerancia = NULL, ponderado = FALSE, filtro_texto = NULL, base_minima = 30,
                                        decimales = 1L) {
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0L) dec <- 1L
  pct <- function(v) ifelse(is.finite(v), paste0(.pulso_fmt_half_up(v, dec), "%"), "")
  dif_txt <- function(v) ifelse(is.finite(v), paste0(ifelse(.pulso_round_half_up(v, dec) > 0, "+", ""), .pulso_fmt_half_up(v, dec)), "")
  avisos <- unlist(lapply(bloques, `[[`, "avisos"))
  bloques <- lapply(bloques, function(b) {
    f <- b$filas
    f$texto_n <- sprintf("n = %s", vapply(f$n, .dumbbell_fmt_casos, ""))
    f$texto_muestra <- ifelse(is.finite(f$pct_muestra), pct(f$pct_muestra), "sin casos")
    f$texto_universo <- ifelse(f$estado == "sin_dato", "sin dato", pct(f$pct_universo))
    f$texto_diferencia <- dif_txt(f$diferencia)
    f$dentro <- if (is.null(tolerancia)) rep(NA, nrow(f)) else ifelse(is.finite(f$diferencia), abs(f$diferencia) <= tolerancia + 1e-9, NA)
    b$filas <- f
    b$texto_n_validos <- sprintf("%s respuestas válidas", .dumbbell_fmt_casos(b$n_validos))
    b
  })
  todos <- unlist(lapply(bloques, function(b) c(b$filas$pct_muestra, b$filas$pct_universo)))
  escala <- if (any(is.finite(todos))) max(todos[is.finite(todos)]) else 100
  escala <- max(escala, 1)
  # El pie: la base de cada público, el universo, el filtro, el peso, lo que queda fuera de las barras y la tolerancia.
  bases_txt <- vapply(bloques, function(b) paste(b$publico, .dumbbell_fmt_casos(b$n_validos)), "")
  notas <- if (length(bloques) == 1L) sprintf("Base: %s respuestas válidas", bases_txt) else paste0("Base: respuestas válidas, ", .excluir_grupos_enumerar(bases_txt))
  hay_universo <- any(!vapply(bloques, `[[`, TRUE, "sin_universo"))
  if (hay_universo) notas <- c(notas, "Universo: cifras ingresadas por el analista")
  sin_u <- vapply(Filter(function(b) isTRUE(b$sin_universo), bloques), `[[`, "", "publico")
  if (length(sin_u)) notas <- c(notas, sprintf("Sin universo para %s: no se dibuja su barra", .excluir_grupos_enumerar(sin_u)))
  if (!is.null(filtro_texto)) notas <- c(notas, filtro_texto)
  if (isTRUE(ponderado)) notas <- c(notas, "Sin ponderar")
  for (b in bloques) {
    e <- b$especiales
    if (!nrow(e)) next
    partes <- sprintf("%s %s (%s)", e$etiqueta, vapply(e$n, .dumbbell_fmt_casos, ""), pct(e$pct))
    quien <- if (length(bloques) > 1L) paste0(" en ", b$publico) else ""
    notas <- c(notas, sprintf("Fuera de las barras%s: %s de %s encuestados", quien, paste(partes, collapse = ", "),
                              .dumbbell_fmt_casos(b$n_encuestados)))
  }
  chicas <- any(vapply(bloques, function(b) any(b$filas$chica), TRUE))
  if (chicas) notas <- c(notas, sprintf("Con menos de %s casos, lectura referencial", format(base_minima)))
  if (!is.null(tolerancia)) {
    d <- unlist(lapply(bloques, function(b) b$filas$dentro))
    d <- d[!is.na(d)]
    tol <- .pulso_fmt_half_up(tolerancia, if (tolerancia == round(tolerancia)) 0L else 1L)
    notas <- c(notas, sprintf("Dentro de ±%s pts fijado por el analista: %d de %d categorías", tol, sum(d), length(d)))
  }
  list(version = .COBCAT_VERSION, tipo = "cobertura", modo = "categorias",
       bloques = bloques, escala_max = escala,
       colores = c(muestra = .std_color("azul"), universo = .std_color("tarjeta_total")),
       leyenda = if (hay_universo) .COBCAT_LEYENDA else .COBCAT_LEYENDA["muestra"],
       hay_universo = hay_universo, encabezado_diferencia = "Diferencia (pts)",
       notas_pie = notas, avisos = unique(avisos), tolerancia = tolerancia, decimales = dec,
       base_minima = base_minima, ponderado = isTRUE(ponderado))
}

#' ¿Alguna base del render tiene pesos? (columna `peso` o `attr(data, "var_peso")`)
#' @keywords internal
.cobcat_ponderado <- function(data_sources, bases) {
  any(vapply(bases, function(b) {
    d <- data_sources[[b]]
    !is.null(attr(d, "var_peso", exact = TRUE)) || "peso" %in% names(d)
  }, TRUE))
}

#' La especificación desde las fuentes del render (la usan el render y los tests)
#' @keywords internal
.cobcat_desde_fuentes <- function(data_sources, inst_sources, variable, bases = NULL, universo = NULL, filtros = list(),
                                  tolerancia = NULL, decimales = 1L) {
  variable <- .cobcat_variable(variable)
  if (is.null(variable)) stop_api(400, "E_COBERTURA_CAT_VARIABLE", "La cobertura por categorías necesita la `variable`.")
  bases <- .cobcat_bases(bases, names(data_sources))
  ctx <- tryCatch(.sig_contexto_render(data_sources[[bases[1]]], bases[1]), error = function(e) NULL)
  nmin <- suppressWarnings(as.numeric((ctx$regla %||% list())$base_minima %||% 30)[1]); if (!is.finite(nmin)) nmin <- 30
  universo <- .cobcat_universo_normalizar(universo)
  clave_u <- if (length(universo)) .contraste_clave(names(universo)) else character(0)
  bloques <- lapply(bases, function(b) {
    j <- match(.contraste_clave(b), clave_u)
    .cobcat_base(data_sources[[b]], inst_sources[[b]], b, variable, universo = if (is.na(j)) NULL else universo[[j]],
                 filtros = filtros, base_minima = nmin)
  })
  ajenas <- names(universo)[!clave_u %in% .contraste_clave(bases)]
  e <- .espec_cobertura_categorias(bloques, tolerancia = tolerancia, ponderado = .cobcat_ponderado(data_sources, bases),
                                   filtro_texto = .cobcat_filtro_texto(filtros, inst_sources[[bases[1]]]), base_minima = nmin,
                                   decimales = decimales)
  if (length(ajenas)) {
    e$avisos <- c(e$avisos, sprintf("El universo trae %s, que no está entre las bases de la lámina: no se dibuja.", paste(ajenas, collapse = ", ")))
  }
  e$variable <- variable
  e
}

# ---- Render (dibujo de respaldo y enganche desde `.render_cobertura`) -------------------------------------------------

#' Cobertura por categorías como dibujo de respaldo (ggplot), con la misma especificación que la lámina nativa
#' @keywords internal
.graficar_cobertura_categorias <- function(espec, titulo = NULL, font_family = "Arial") {
  filas <- do.call(rbind, lapply(espec$bloques, function(b) {
    f <- b$filas
    data.frame(publico = b$publico, etiqueta = paste0(f$etiqueta, " (", f$texto_n, ")"), muestra = f$pct_muestra,
               universo = f$pct_universo, t_m = f$texto_muestra, t_u = f$texto_universo, stringsAsFactors = FALSE)
  }))
  filas$y <- rev(seq_len(nrow(filas)))
  largo <- rbind(
    data.frame(y = filas$y + 0.18, valor = filas$muestra, texto = filas$t_m, serie = espec$leyenda[["muestra"]], stringsAsFactors = FALSE),
    if (isTRUE(espec$hay_universo)) data.frame(y = filas$y - 0.18, valor = filas$universo, texto = filas$t_u, serie = .COBCAT_LEYENDA[["universo"]],
                                                 stringsAsFactors = FALSE))
  largo$valor[!is.finite(largo$valor)] <- 0
  cols <- stats::setNames(unname(espec$colores[names(espec$leyenda)]), unname(espec$leyenda))
  tope <- espec$escala_max * 1.25
  p <- ggplot2::ggplot(largo) +
    ggplot2::geom_tile(ggplot2::aes(x = .data$valor / 2, y = .data$y, width = .data$valor, height = 0.32, fill = .data$serie)) +
    ggplot2::geom_text(ggplot2::aes(x = .data$valor + tope * 0.01, y = .data$y, label = .data$texto), hjust = 0, size = 3,
                       colour = .std_color("texto_suave"), family = font_family) +
    ggplot2::scale_fill_manual(values = cols, name = NULL) +
    ggplot2::scale_y_continuous(breaks = filas$y, labels = filas$etiqueta) +
    ggplot2::scale_x_continuous(limits = c(0, tope), breaks = NULL, expand = c(0, 0)) +
    ggplot2::labs(title = titulo, x = NULL, y = NULL, caption = paste(espec$notas_pie, collapse = ". ")) +
    ggplot2::theme_minimal(base_family = font_family) +
    ggplot2::theme(panel.grid = ggplot2::element_blank(), legend.position = "top")
  attr(p, "pulso_espec") <- espec
  p
}

#' Render de la versión por categorías (lo llama `.render_cobertura` cuando `modo = "categorias"`)
#' @keywords internal
.render_cobertura_categorias <- function(el, data_sources, preset_args = list()) {
  inst_sources <- dynGet("instrument_sources", ifnotfound = NULL) %||% list()
  dec <- (utils::modifyList(as.list(preset_args %||% list()), as.list(el$overrides %||% list())))$valores_decimales %||% 1L
  espec <- .cobcat_desde_fuentes(data_sources, inst_sources, el$variable, bases = el$bases, universo = el$universo_categorias,
                                 filtros = el$filtros, tolerancia = el$tolerancia_pts, decimales = dec)
  p <- .graficar_cobertura_categorias(espec, titulo = el$title_slide %||% NULL)
  for (a in espec$avisos) warning(a, call. = FALSE)
  p
}
