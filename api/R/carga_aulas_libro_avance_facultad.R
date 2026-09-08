# El avance por FACULTAD y por SEXO de la hoja «Avance de campo».
#
# Gonzalo, pidiendo la tabla de avance para el cliente: «centrarse en el reporte
# de avance por facultad por sexo a la muestra y la sobremuestra y la cantidad
# de aulas aplicadas».
#
# La hoja ya existía y ya traía el agregado del estudio —meta, conseguidas,
# avance, producción por aplicador y la serie diaria—. Lo que NO tenía es el
# corte que decide el operativo: **la cuota es por facultad y dentro por sexo, y
# no se compensa entre celdas** (ADR 0079). Un 98,7 % global puede convivir con
# tres facultades cortas, y el agregado las esconde.
#
# Vive en archivo propio: `carga_aulas_libro_indicadores.R` sólo lo llama.
#
# LAS COLUMNAS SON LAS QUE DICTÓ GONZALO (2026-09-08, con el Sheets vivo delante)
#
# Textual: «Facultad, muestra, muestra mujeres, muestra hombres, efectivas,
# efectivas hombres, efectivas mujeres, faltantes (sobre muestra), faltantes
# hombre, faltantes mujeres, aulas aplicadas, sobremuestra, sobremuestra
# mujeres, sobremuestra hombres, faltantes (sobre la sobremuestra)». Antes la
# tabla traía «Aulas del plan», «Techo con sobremuestra» y «Avance» (un
# porcentaje) y ninguna de las tres está en el dictado: se van. El único cambio
# sobre el dictado es el orden de los sexos, que él alterna (mujeres→hombres en
# muestra y sobremuestra, hombres→mujeres en efectivas y faltantes) y aquí va
# siempre mujeres→hombres, como en el resto del libro y de la app: una tabla
# que cambia el orden de un grupo a otro obliga a releer la cabecera en cada
# columna. Si lo quiere al revés, es un cambio de rótulos.
#
# Las DOS metas reciben el mismo trato: la muestra (la cuota del diseño, 2 500
# en HSVG2026) y la sobremuestra (3 750). Gonzalo: «dos metas, una real y otra
# referencial, aunque no debe decir que lo es». Por eso ninguna nota de la hoja
# llama «referencial» ni «margen» a la sobremuestra.
#
# LA SOBREMUESTRA SE REPARTE, NO SE MULTIPLICA
#
# Lo que el diseño fija es el TOTAL (`meta_diseno` y `meta_operativa`), no un
# reparto por facultad ni por sexo. Hasta el 2026-09-08 el techo de cada
# facultad era `round(cuota * ratio)`, y quince redondeos no tienen por qué
# sumar 3 750: la fila «Total» de la tabla habría dicho una cifra y el bloque de
# meta otra. Se reparte por RESTO MAYOR —proporcional a la cuota, con los enteros
# ajustados para que las partes sumen exactamente el total— y dentro de cada
# facultad se reparte igual entre sus dos sexos. El ratio sale del bloque, no se
# supone: sin las dos cifras del diseño la columna queda en NA y la nota lo
# dice. Un 1,5 por defecto sería inventar el aforo.

# Reparto por resto mayor: enteros no negativos, proporcionales a `pesos`, que
# suman exactamente `total`. Los empates de resto los decide el orden de
# llegada, que en esta hoja es el del diseño.
.calaf_repartir <- function(total, pesos) {
  pesos <- suppressWarnings(as.numeric(pesos))
  pesos[!is.finite(pesos) | pesos < 0] <- 0
  n <- length(pesos)
  total <- suppressWarnings(as.numeric(total))
  if (!n || length(total) != 1L || !is.finite(total) || total < 0 || sum(pesos) <= 0) {
    return(rep(NA_real_, n))
  }
  total <- round(total)
  crudo <- total * pesos / sum(pesos)
  base <- floor(crudo)
  resto <- as.integer(round(total - sum(base)))
  if (resto > 0) {
    orden <- order(-(crudo - base), seq_len(n))
    base[orden[seq_len(resto)]] <- base[orden[seq_len(resto)]] + 1
  }
  base
}

# La sobremuestra de cada facultad y de cada sexo, en el orden de `facs`.
# `NULL` sin ratio: la columna calla en vez de inventar.
.calaf_sobremuestra_reparto <- function(facs, ratio) {
  if (!length(facs) || !is.finite(ratio) || ratio <= 0) return(NULL)
  cuotas <- vapply(facs, function(f) .cai_num(f$cuota), numeric(1))
  if (!any(is.finite(cuotas))) return(NULL)
  objetivo <- round(sum(cuotas[is.finite(cuotas)]) * ratio)
  por_fac <- .calaf_repartir(objetivo, ifelse(is.finite(cuotas), cuotas, 0))
  lapply(seq_along(facs), function(i) {
    if (!is.finite(cuotas[[i]])) return(list(total = NA_real_, F = NA_real_, M = NA_real_))
    cs <- facs[[i]]$cuota_sexo %||% list()
    f <- .cai_num(cs$F)
    m <- .cai_num(cs$M)
    sx <- if (is.finite(f) && is.finite(m) && (f + m) > 0) {
      .calaf_repartir(por_fac[[i]], c(f, m))
    } else {
      c(NA_real_, NA_real_)
    }
    list(total = por_fac[[i]], F = sx[[1]], M = sx[[2]])
  })
}

#' Avance por facultad y sexo contra la muestra y la sobremuestra del diseño.
#'
#' @param unidades filas del plan.
#' @param efectivas vector con nombre por código operativo (efectivas de
#'   PLATAFORMA; el parte es otra cuenta y no entra aquí).
#' @param cuotas bloque `design_targets` de la config de Monitoreo.
#' @param responses respuestas, para el reparto por sexo.
#' @param validas vector lógico por fila de `responses`.
#' @param cfg config de aulas, para localizar la columna de sexo.
#' @return `data.frame` con una fila por facultad, o `NULL` sin cuotas.
#' @keywords internal
.calaf_avance_por_facultad <- function(unidades, efectivas = NULL, cuotas = NULL,
                                       responses = NULL, validas = NULL, cfg = list(),
                                       partes = list()) {
  facs <- if (is.list(cuotas)) (cuotas$facultades %||% list()) else list()
  if (!length(facs)) return(NULL)

  # Índice del plan: código operativo -> facultad, y si el aula se aplicó.
  cod <- vapply(unidades, function(u) .cai_txt(u$operational_code), character(1))
  fac <- vapply(unidades, function(u) .cai_txt(u$faculty), character(1))
  # **El eje de aplicación NO es `operational_status`.** Lo era, y el 2026-09-07
  # esta tabla salía publicada con «Aulas aplicadas: 0» en las quince
  # facultades mientras ocho aulas producían encuestas: `operational_status` es
  # el eje del CIRCUITO —planificada, agendada, reemplazada— y el libro no lo
  # mueve a «aplicada» nunca. La definición vive en un solo sitio,
  # `monitoreo_aulas_aula_aplicada()`, y la comparten esta tabla, la Base de
  # control y el Plan del día.
  apl <- monitoreo_aulas_aula_aplicada(unidades, partes = partes, efectivas = efectivas)
  clave <- .cm_criterios_fac_key(fac)

  # El ratio del diseño: sobremuestra entre muestra. Sale del bloque, no se
  # supone: si el estudio no publica las dos cifras, las columnas de
  # sobremuestra quedan en NA y la nota de la hoja lo dice.
  meta_dis <- suppressWarnings(as.numeric(cuotas$meta_diseno %||% NA))
  oper_dis <- suppressWarnings(as.numeric(cuotas$meta_operativa %||% NA))
  ratio_sm <- if (is.finite(meta_dis) && meta_dis > 0 && is.finite(oper_dis)) oper_dis / meta_dis else NA_real_
  sobremuestra <- .calaf_sobremuestra_reparto(facs, ratio_sm)

  ef_de <- function(codigo) {
    if (is.null(efectivas)) return(NA_real_)
    i <- match(codigo, names(efectivas))
    if (is.na(i)) 0 else suppressWarnings(as.numeric(efectivas[[i]]))
  }
  ef_fila <- vapply(cod, ef_de, numeric(1))

  # **El reparto por sexo de lo conseguido sale del MISMO cruce que el total.**
  #
  # Había un segundo cruce aquí, propio, que mapeaba la respuesta a su facultad
  # por `classroom_id` con `collection_unit_id` de respaldo. En HSVG2026 el QR
  # viaja con el CÓDIGO OPERATIVO —`CH 7`, mientras `classroom_id` es el código
  # de la DTI `1iee12_0521`— así que ninguna respuesta encontraba su aula y las
  # quince facultades salían con el reparto por sexo vacío. El comentario que
  # había aquí advertía justo del error inverso, cometido en otro estudio.
  #
  # Dos cruces del mismo dato se separan en cuanto uno cambia. Éste se apoya en
  # `monitoreo_aulas_efectivas_por_sexo()`, que ya resuelve las tres claves y ya
  # aplica el criterio de validez, y sólo agrega por facultad.
  sexo_por_fac <- list()
  sexo_aula <- tryCatch(
    monitoreo_aulas_efectivas_por_sexo(unidades, responses, cfg),
    error = function(e) NULL
  )
  if (length(sexo_aula)) {
    for (n in seq_along(cod)) {
      v <- sexo_aula[[cod[[n]]]] %||% NULL
      if (!length(v)) next
      k <- clave[[n]]
      if (!nzchar(k)) next
      et <- monitoreo_aulas_sexo_key(names(v), cfg)
      acc <- sexo_por_fac[[k]] %||% c(F = 0, M = 0)
      if (any(et == "F")) acc[["F"]] <- acc[["F"]] + sum(as.numeric(v[et == "F"]))
      if (any(et == "M")) acc[["M"]] <- acc[["M"]] + sum(as.numeric(v[et == "M"]))
      sexo_por_fac[[k]] <- acc
    }
  }
  con_reparto <- length(sexo_aula) > 0L

  filas <- lapply(seq_along(facs), function(i) {
    f <- facs[[i]]
    k <- .cai_txt(f$faculty_key %||% .cm_criterios_fac_key(.cai_txt(f$facultad)))
    idx <- clave == k
    cuota <- .cai_num(f$cuota)
    cs <- f$cuota_sexo %||% list()
    cuota_f <- .cai_num(cs$F)
    cuota_m <- .cai_num(cs$M)
    # Cero y «no lo sabemos» son dos noticias distintas: con la variable de sexo
    # declarada y el cruce hecho, una facultad sin respuestas tiene CERO
    # efectivas de cada sexo; sin variable declarada, la columna calla.
    sin_reparto <- if (con_reparto) c(F = 0, M = 0) else c(F = NA_real_, M = NA_real_)
    sx <- sexo_por_fac[[k]] %||% sin_reparto
    conseguidas <- if (is.null(efectivas)) NA_real_ else sum(ef_fila[idx], na.rm = TRUE)
    sm <- if (is.null(sobremuestra)) list(total = NA_real_, F = NA_real_, M = NA_real_) else sobremuestra[[i]]

    # A4 (2026-09-08): la MISMA brecha que el tablero (ADR 0079, una función
    # para los dos): por celda de sexo cuando el diseño la reparte y el estudio
    # declara la variable de sexo; el neto cuando no. Contra la muestra y
    # contra la sobremuestra por igual: dos metas, una regla.
    celdas <- function(t_f, t_m) if (con_reparto) list(
      list(target = t_f, observed = unname(sx[["F"]])),
      list(target = t_m, observed = unname(sx[["M"]]))
    ) else list()
    brecha <- function(meta, cel) {
      if (!is.finite(conseguidas)) NA_real_ else monitoreo_aulas_brecha_facultad(meta, conseguidas, cel)
    }
    # Lo que falta en UNA celda: sólo con reparto y con su meta; nunca negativo.
    falta_sexo <- function(meta_sexo, obs) {
      if (!con_reparto || !is.finite(meta_sexo) || !is.finite(obs)) NA_real_ else max(0, meta_sexo - obs)
    }

    data.frame(
      Facultad = .cai_txt(f$facultad),
      # LA MUESTRA es la cuota del diseño, no la suma de metas por aula: son dos
      # denominadores y el segundo está estructuralmente por encima (ADR 0079).
      Muestra = cuota,
      `Muestra mujeres` = cuota_f,
      `Muestra hombres` = cuota_m,
      Efectivas = conseguidas,
      `Efectivas mujeres` = unname(sx[["F"]]),
      `Efectivas hombres` = unname(sx[["M"]]),
      Faltantes = brecha(cuota, celdas(cuota_f, cuota_m)),
      `Faltantes mujeres` = falta_sexo(cuota_f, unname(sx[["F"]])),
      `Faltantes hombres` = falta_sexo(cuota_m, unname(sx[["M"]])),
      `Aulas aplicadas` = sum(idx & apl),
      Sobremuestra = sm$total,
      `Sobremuestra mujeres` = sm$F,
      `Sobremuestra hombres` = sm$M,
      `Faltantes para la sobremuestra` = brecha(sm$total, celdas(sm$F, sm$M)),
      check.names = FALSE, stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, filas)
  # Por lo que FALTA y no alfabético: la facultad que peor va abre la tabla, que
  # es lo que se mira primero.
  out[order(-ifelse(is.finite(out$Faltantes), out$Faltantes, -1)), , drop = FALSE]
}
