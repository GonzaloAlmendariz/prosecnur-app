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
# LA SOBREMUESTRA, Y POR QUÉ AHORA SÍ SE PUBLICA
#
# Hasta el 2026-08-30 esta cabecera decía que la sobremuestra «no viaja al
# libro»: `design_targets` traía sólo `facultad`, `cuota`, `cuota_sexo` y `tau`.
# Era cierto, y **dejó de serlo el 2026-08-31**, cuando el bloque pasó a
# publicar `meta_diseno`, `sobremuestra` y `meta_operativa` (2 500 · 1 250 ·
# 3 750 en HSVG2026). Una salvedad correcta que caduca por un arreglo propio no
# avisa sola: seguía aquí escrita como un hecho.
#
# Lo que el diseño fija es el TOTAL, no un reparto por facultad. Así que el
# techo de cada una se deriva del ratio global —3 750 / 2 500 = ×1,5 exacto— y
# la hoja lo dice en su nota: es una derivación declarada, no una cifra que el
# estudio haya calculado facultad a facultad. Sin esa nota sería inventarla, que
# es justo lo que la versión anterior evitaba.

#' Avance por facultad y sexo contra la cuota del diseño.
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
  # El operativo son los titulares más las reservas que se activaron: es el mismo
  # conjunto que cuenta «Aulas del operativo» en el encabezado de la hoja.
  # TITULARES, el mismo conjunto que cuenta «Aulas del operativo» en el
  # encabezado de la hoja. Contó además las reservas con fecha y la columna sumó
  # 175 al lado de un encabezado que decía 174: una reserva activada SUSTITUYE a
  # su titular, no se suma a él —es la misma regla que la app enuncia en su
  # recorrido— así que contarla dos veces infla el denominador.
  del_operativo <- vapply(unidades, function(u) {
    identical(tolower(.cai_txt(u$sample_role)), "titular")
  }, logical(1))

  # El ratio del diseño: techo operativo entre meta. Sale del bloque, no se
  # supone: si el estudio no publica las dos cifras, la columna queda en NA y la
  # nota de la hoja lo dice. Un 1,5 por defecto sería inventar el aforo.
  meta_dis <- suppressWarnings(as.numeric(cuotas$meta_diseno %||% NA))
  oper_dis <- suppressWarnings(as.numeric(cuotas$meta_operativa %||% NA))
  ratio_sm <- if (is.finite(meta_dis) && meta_dis > 0 && is.finite(oper_dis)) oper_dis / meta_dis else NA_real_

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

  filas <- lapply(facs, function(f) {
    k <- .cai_txt(f$faculty_key %||% .cm_criterios_fac_key(.cai_txt(f$facultad)))
    idx <- clave == k
    cuota <- .cai_num(f$cuota)
    cs <- f$cuota_sexo %||% list()
    # Cero y «no lo sabemos» son dos noticias distintas: con la variable de sexo
    # declarada y el cruce hecho, una facultad sin respuestas tiene CERO
    # conseguidas de cada sexo; sin variable declarada, la columna calla.
    sin_reparto <- if (length(sexo_aula)) c(F = 0, M = 0) else c(F = NA_real_, M = NA_real_)
    sx <- sexo_por_fac[[k]] %||% sin_reparto
    conseguidas <- if (is.null(efectivas)) NA_real_ else sum(ef_fila[idx], na.rm = TRUE)
    data.frame(
      Facultad = .cai_txt(f$facultad),
      # LA MUESTRA es la cuota del diseño, no la suma de metas por aula: son dos
      # denominadores y el segundo está estructuralmente por encima (ADR 0079).
      Muestra = cuota,
      `Muestra mujeres` = .cai_num(cs$F),
      `Muestra hombres` = .cai_num(cs$M),
      `Aulas aplicadas` = sum(idx & apl),
      # **Las aulas DEL OPERATIVO, no las del banco.** Contaba `sum(idx)` sobre
      # el plan entero —1 347 unidades— y la columna sumaba 1 347 mientras el
      # encabezado de la hoja decía «Aulas del operativo: 174». Dos universos con
      # el mismo nombre en la misma hoja.
      `Aulas del plan` = sum(idx & del_operativo),
      Conseguidas = conseguidas,
      `Conseguidas mujeres` = unname(sx[["F"]]),
      `Conseguidas hombres` = unname(sx[["M"]]),
      # El techo con sobremuestra: hasta dónde se compró aforo. NO es una
      # segunda meta —lo que decide el cierre sigue siendo `Muestra`— sino el
      # margen que el operativo tiene antes de quedarse sin campo pagado.
      `Techo con sobremuestra` = if (is.finite(cuota) && is.finite(ratio_sm)) round(cuota * ratio_sm) else NA_real_,
      Avance = if (is.finite(cuota) && cuota > 0 && is.finite(conseguidas)) conseguidas / cuota else NA_real_,
      # A4 (2026-09-08): la MISMA brecha que el tablero (ADR 0079, una función
      # para los dos): por celda de sexo cuando el diseño la reparte y el
      # estudio declara la variable de sexo; el neto cuando no.
      Faltan = if (is.finite(conseguidas)) monitoreo_aulas_brecha_facultad(
        cuota, conseguidas,
        if (length(sexo_aula)) list(
          list(target = .cai_num(cs$F), observed = unname(sx[["F"]])),
          list(target = .cai_num(cs$M), observed = unname(sx[["M"]]))
        ) else list()
      ) else NA_real_,
      check.names = FALSE, stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, filas)
  # Por lo que FALTA y no alfabético: la facultad que peor va abre la tabla, que
  # es lo que se mira primero.
  out[order(-ifelse(is.finite(out$Faltan), out$Faltan, -1)), , drop = FALSE]
}
