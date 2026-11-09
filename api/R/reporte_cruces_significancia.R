# Tablas de cruces con la regla de diferencias del estudio (ADR 0128, que unifica el ADR 0127)
# ===========================================================================================
#
# Las tablas marcaban con la z de muestreo aleatorio simple y Bonferroni por fila mientras las láminas del mismo estudio
# pasaban a Rao-Scott con BH del informe: la doble vara que el dictamen de CCSS 2026-II encontró (268 de 9.029 pares
# cambian de veredicto, letras en grupos de 6 y 11 casos). Con la regla del estudio vigente en el worker
# (`prosecnur.sig_informe`), la tabla usa la misma evaluación que la lámina y la misma familia de BH, así que dan las
# mismas letras. Sin regla vigente (un llamador viejo, un script), la tabla sigue con el modo simple del ADR 0127.
#
# Del ADR 0127 se conservan, aplicados a la regla del estudio: el estrato anidado en el conglomerado (si varía dentro de
# alguno, la tabla no asigna letras y dice por qué), la marca `.b` de la columna sin base o sin conglomerados
# suficientes, y la configuración de `analitica_config$cruces$significancia`, que pasa a leerse como migración de la
# regla y como el `spec` del modo simple y de las medias.
#
# En la tabla se marcan las dos filas de una dicotómica (es una referencia exhaustiva), pero la familia cuenta esa
# prueba una sola vez. La letra en minúscula es la frágil, porque una celda de Excel no tiene contorno.

#' La regla del estudio en la forma `spec` del ADR 0127 (modo, conglomerado, estrato, corrección, bases)
#' @keywords internal
.sig_spec_de_regla <- function(regla) {
  if (!is.list(regla)) return(NULL)
  list(
    metodo = if (identical(regla$prueba, "rao_scott")) "diseno" else "simple",
    conglomerado = regla$conglomerado %||% NULL, estrato = regla$estrato %||% NULL,
    correccion = if (identical(regla$correccion, "bh_informe")) "BH" else "bonferroni",
    base_minima = as.integer(regla$base_minima %||% 30L),
    min_conglomerados = as.integer(regla$conglomerados_minimos %||% 8L)
  )
}

#' `spec` vigente: el de la regla del estudio si el worker la fijó; si no, el que trae el llamador
#' @keywords internal
.sig_spec_vigente <- function(spec = NULL) {
  ctx <- .sig_informe_vigente()
  if (is.null(ctx)) return(spec)
  .sig_spec_de_regla(ctx$regla)
}

#' Motivo por el que el diseño de la regla no se puede usar en esta base, o NULL (ADR 0127 §1: estrato anidado)
#' @keywords internal
.sig_diseno_invalido <- function(data, regla, weight_col = "peso") {
  if (!is.list(regla) || !identical(regla$prueba, "rao_scott")) return(NULL)
  # Multibase sin la columna en esta base: muestreo aleatorio simple (ADR 0138 «Conglomerado», `.sig_regla_de_base`).
  if (!is.null(attr(regla, "mas_sin_conglomerado"))) return(NULL)
  dis <- .cruces_sig_diseno_base(data, .sig_spec_de_regla(regla), weight_col = weight_col)
  if (isTRUE(dis$ok)) NULL else dis$reason
}

#' Letras de una tabla con la regla del estudio
#'
#' Devuelve la forma de `.cruces_sig_comparar` (`letras`, `sig`, `method`, `reason`, `solitario`) y la regla. Las
#' columnas que no se comparan en una fila llevan `.b`.
#' @keywords internal
.cruces_comparar_con_regla <- function(data, var, opciones, codes_row, estratos, var_estrato, tp, weight_col,
                                       regla, familia = NULL) {
  opciones <- as.character(opciones); codes_row <- as.character(codes_row); estratos <- as.character(estratos)
  regla <- .sig_regla_de_datos(.sig_informe_vigente(), regla, data)   # multibase: la base sin conglomerado, como MAS
  motivo <- .sig_diseno_invalido(data, regla, weight_col)
  if (!is.null(motivo)) {
    out <- .cruces_sig_vacio(codes_row, estratos, "descriptivo", motivo)
    out$regla <- regla
    return(out)
  }
  Y <- vapply(codes_row, function(code) .repeat_outcome_for_code(data, var, code, codes_row, tp), numeric(nrow(data)))
  if (!is.matrix(Y)) Y <- matrix(Y, nrow = nrow(data))
  colnames(Y) <- opciones
  w <- get_pesos(data, weight_col)
  ind <- list(Y = Y, codigos = stats::setNames(as.list(codes_row), opciones), tipo = tp, w = w,
              en_base = rowSums(!is.na(Y)) > 0)
  filas <- .sig_filas_a_probar(opciones, ind$codigos, regla, solo_principal = FALSE)
  cl <- if (identical(regla$prueba, "rao_scott") && !is.null(regla$conglomerado) && regla$conglomerado %in% names(data))
    data[[regla$conglomerado]] else NULL
  st <- if (!is.null(regla$estrato) && regla$estrato %in% names(data)) data[[regla$estrato]] else NULL
  ev <- .sig_evaluar(ind, as.character(data[[var_estrato]]), estratos, estratos, cluster = cl, estrato = st,
                     regla = regla, filas = filas, binaria = !identical(tp, "sm") && length(filas) == 2L)
  ev <- .sig_veredictos(ev, regla, familia)
  letras <- matrix("", length(opciones), length(estratos), dimnames = list(opciones, estratos))
  sig <- matrix(FALSE, length(opciones), length(estratos), dimnames = list(opciones, estratos))
  m <- ev$marcas
  if (!is.null(m)) for (k in seq_len(nrow(m))) {
    txt <- if (nzchar(m$letras[k])) m$letras[k] else m$flecha[k]
    letras[m$fila[k], m$grupo[k]] <- if (isTRUE(m$fragil[k])) tolower(txt) else txt
    sig[m$fila[k], m$grupo[k]] <- TRUE
  }
  # `.b` (ADR 0127 §4): la columna que en esa fila no se compara por base o conglomerados insuficientes.
  ce <- ev$celdas
  if (!is.null(ce)) {
    chicas <- ce[!ce$comparable & ce$n > 0, , drop = FALSE]
    for (k in seq_len(nrow(chicas))) letras[chicas$fila[k], chicas$grupo[k]] <- ".b"
  }
  list(letras = letras, sig = sig, method = paste0("regla_", regla$prueba), reason = "", solitario = FALSE,
       regla = regla)
}

#' Nota de la tabla con la regla del estudio, desde la fuente única de textos
#' @keywords internal
.cruces_nota_regla <- function(regla, razones = character(0)) {
  magnitud <- if ((regla$umbral_puntos %||% 0) > 0) sprintf(" y de al menos %s puntos", .sig_num(regla$umbral_puntos)) else ""
  base <- if (.sig_por_conglomerado(regla)) {
    sprintf("\".b\" indica una columna con menos de %s casos o de %s %ss, que no se compara.", .sig_num(regla$base_minima),
            regla$conglomerados_minimos, .sig_nombre_conglomerado(regla$conglomerado))
  } else {
    sprintf("\".b\" indica una columna con menos de %s casos, que no se compara.", .sig_num(regla$base_minima))
  }
  txt <- paste0("Las letras comparan las columnas de una misma variable de cruce: la letra marca la columna superada, con ",
                "diferencia significativa", magnitud, ". En minúscula, frágil (p ajustado entre 0.01 y ",
                .sig_num(regla$alfa), "). ", base, " ", .sig_texto_metodo(regla))
  razones <- unique(Filter(nzchar, as.character(razones)))
  if (length(razones)) txt <- paste0(txt, " Sin letras en parte de la tabla: ", paste(sub("\\.?$", ".", razones), collapse = " "))
  txt
}
