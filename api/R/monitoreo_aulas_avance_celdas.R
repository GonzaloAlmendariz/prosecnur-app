# El avance por celdas de N variables — ADR 0121, fase F2.
#
# F1 publicó lo que el estudio PROMETIÓ (`representatividad_declarada`: universo,
# variables de cuota y celdas con meta). F2 publica lo que LLEVA, celda a celda,
# y el avance por cada variable sumando celdas.
#
# No se reinventa la atribución: cada variable reutiliza la que ya decide el
# motor.
#   - La variable que es el EJE (ADR 0086) toma `eje_atr$clave`: aula o persona,
#     con sus bolsas `sin_eje` y `duplicadas` ya resueltas.
#   - `sexo` toma la clave F/M de la respuesta (`monitoreo_aulas_sexo_key`).
#   - Otra variable por AULA se lee del plan en la fila a la que se atribuyó la
#     respuesta (`atr$fila`), con el mismo buscador de columnas del eje.
#   - Otra variable por PERSONA se resuelve con `monitoreo_aulas_eje_atribucion`
#     con esa dimensión como eje.
# Cuenta lo mismo que cuenta el bloque `avance_cuota` (`eje_atr$cuenta`): F2 no
# cambia ninguna cifra, sólo la reparte por celdas.
#
# La brecha se suma CELDA A CELDA (ADR 0079): un hombre de más no cubre a una
# mujer que falta, así que la brecha de un marginal es la suma de las brechas de
# sus celdas, nunca su meta menos sus logradas.

.maacel_brecha <- function(cuota, logradas) {
  if (!is.finite(cuota)) return(NA_real_)
  max(0, cuota - logradas)
}

# El valor de una variable para cada respuesta, ya como clave. El centinela
# «sin_<variable>» de las claves del eje se vuelve "": una respuesta sin valor no
# es una categoría.
.maacel_valores <- function(v, eje, eje_atr, sexo_key, atr, plan_df, responses, cfg, padron) {
  out <- .maacel_valores_crudos(v, eje, eje_atr, sexo_key, atr, plan_df, responses, cfg, padron)
  out[is.na(out) | out == paste0("sin_", .monitoreo_scalar(v$clave, ""))] <- ""
  out
}

.maacel_valores_crudos <- function(v, eje, eje_atr, sexo_key, atr, plan_df, responses, cfg, padron) {
  n <- nrow(atr)
  clave <- .monitoreo_scalar(v$clave, "")
  if (identical(clave, .monitoreo_scalar(eje$clave, "facultad"))) return(as.character(eje_atr$clave))
  if (identical(clave, "sexo")) return(if (length(sexo_key) == n) sexo_key else rep("", n))
  dim <- .MONITOREO_AULAS_EJES[[clave]]
  if (is.null(dim)) return(rep("", n))
  if (identical(.monitoreo_scalar(dim$atribucion, "aula"), "persona")) {
    otro <- monitoreo_aulas_eje_atribucion(atr, plan_df = plan_df, responses = responses, cfg = cfg,
                                           eje = dim, padron = padron)
    return(as.character(otro$clave))
  }
  col <- monitoreo_aulas_columna_eje(plan_df, dim)
  if (!nzchar(col)) return(rep("", n))
  val_plan <- .maac_chr_col(plan_df, col)
  out <- rep("", n)
  ok <- !is.na(atr$fila)
  out[ok] <- .maac_eje_key(val_plan[atr$fila[ok]], dim)
  out
}

# La clave de un valor declarado en una celda, en el mismo espacio que las
# respuestas: el sexo ya viene F/M; las dimensiones del catálogo pasan por su
# normalizador.
.maacel_clave_celda <- function(valor, clave_variable) {
  if (identical(clave_variable, "sexo")) return(toupper(trimws(valor)))
  dim <- .MONITOREO_AULAS_EJES[[clave_variable]] %||% list(clave = clave_variable)
  .maac_eje_key(valor, dim)
}

#' Avance por celdas de las variables de cuota declaradas (ADR 0121, F2).
#'
#' @param cfg config de aulas (de ahí sale la representatividad declarada).
#' @param eje el eje resuelto del estudio.
#' @param eje_atr la atribución del eje (`monitoreo_aulas_eje_atribucion`).
#' @param sexo_key clave F/M de cada respuesta ("" sin sexo).
#' @param atr la atribución de cada respuesta a su fila del plan.
#' @param plan_df,responses,padron insumos de la atribución de otras variables.
#' @return lista `avance_por_celdas_v1`, o `NULL` sin representatividad declarada.
#' @keywords internal
monitoreo_aulas_avance_por_celdas <- function(cfg, eje, eje_atr, sexo_key, atr, plan_df,
                                              responses = data.frame(), padron = NULL) {
  rep <- monitoreo_aulas_representatividad_declarada(cfg, plan = plan_df, padron = padron)
  if (is.null(rep) || !is.data.frame(atr)) return(NULL)
  claves <- vapply(rep$variables, function(v) .monitoreo_scalar(v$clave, ""), "")
  cuenta <- as.logical(eje_atr$cuenta) %in% TRUE
  valores <- lapply(rep$variables, .maacel_valores, eje = eje, eje_atr = eje_atr, sexo_key = sexo_key,
                    atr = atr, plan_df = plan_df, responses = responses, cfg = cfg, padron = padron)
  names(valores) <- claves

  en_celda <- rep(FALSE, length(cuenta))
  celdas <- lapply(rep$celdas, function(c) {
    mask <- cuenta
    for (k in claves) {
      objetivo <- .maacel_clave_celda(.monitoreo_scalar(c$valores[[k]], ""), k)
      mask <- mask & valores[[k]] == objetivo
    }
    en_celda <<- en_celda | mask
    cuota <- suppressWarnings(as.numeric(.monitoreo_scalar(c$cuota, NA)))
    logradas <- as.integer(sum(mask))
    list(valores = c$valores, cuota = cuota, logradas = logradas, brecha = .maacel_brecha(cuota, logradas))
  })

  marginales <- stats::setNames(lapply(claves, function(k) {
    grupos <- vapply(celdas, function(c) .monitoreo_scalar(c$valores[[k]], ""), "")
    lapply(unique(grupos), function(g) {
      suyas <- celdas[grupos == g]
      cuotas <- vapply(suyas, function(c) as.numeric(c$cuota), 0)
      list(
        valor = g,
        cuota = if (all(is.finite(cuotas))) sum(cuotas) else NA_real_,
        logradas = as.integer(sum(vapply(suyas, `[[`, 0L, "logradas"))),
        brecha = sum(vapply(suyas, function(c) if (is.finite(c$brecha)) c$brecha else 0, 0))
      )
    })
  }), claves)

  cuotas <- vapply(celdas, function(c) as.numeric(c$cuota), 0)
  list(
    schema = "avance_por_celdas_v1",
    variables = as.list(claves),
    celdas = celdas,
    marginales = marginales,
    total = list(
      cuota = if (all(is.finite(cuotas))) sum(cuotas) else NA_real_,
      logradas = as.integer(sum(en_celda)),
      brecha = sum(vapply(celdas, function(c) if (is.finite(c$brecha)) c$brecha else 0, 0))
    ),
    # Lo que cuenta para el estudio y no cae en ninguna celda declarada: un
    # valor sin meta (niveles 5 y 10 en CCSS) o una variable sin valor.
    fuera_de_celdas = as.integer(sum(cuenta & !en_celda)),
    sin_valor = stats::setNames(lapply(claves, function(k) as.integer(sum(cuenta & !nzchar(valores[[k]])))), claves)
  )
}
