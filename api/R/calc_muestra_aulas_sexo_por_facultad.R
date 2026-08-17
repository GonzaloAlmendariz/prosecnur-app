#' El balance de sexo de la selección, POR FACULTAD
#'
#' El informe de representatividad publica el eje sexo en una sola fila: en
#' HSVG2026, 53,8 % de mujeres en el marco contra 52,1 % en lo seleccionado,
#' dentro de tolerancia. Ese agregado cuadra y esconde lo que pasa por dentro:
#' en la misma corrida, ARTE Y DISEÑO ofrece 62 % de mujeres donde su cuota pide
#' 78 %, y CIENCIAS Y ARTES DE LA COMUN. 57 % donde pide 64 %.
#'
#' El motor ya cruza los dos ejes —los estratos del sorteo son
#' `FACULTAD / SEXO / GRUPO`— y cada aula del marco lleva su composición
#' (`sex_top_1`, `sex_top_1_n`, `sex_top_2`, `sex_top_2_n`). Lo que faltaba era
#' publicar el cruce: la cuota de hombres y mujeres es **por facultad**, así que
#' un balance global no responde la pregunta que el analista tiene delante.
#'
#' La proporción del marco por facultad ES la cuota de esa facultad: el reparto
#' por sexo se construye proporcional a la población de cada facultad, así que
#' en ARTE Y DISEÑO la cuota pide 286 de 369 mujeres (77,5 %) y su población
#' tiene 792 de 1.021 (77,6 %). Comparar seleccionado contra marco por facultad
#' es, por construcción, comparar contra la cuota.
#'
#' **No se emite veredicto.** Con dos o tres aulas en una facultad ninguna
#' selección puede caer dentro de una tolerancia pensada para el agregado, así
#' que marcar esas filas como incumplidas sería un aviso falso. Se publican las
#' dos proporciones, la brecha en puntos y cuántas aulas la sostienen; el umbral
#' y la decisión son del analista.
#'
#' @keywords internal
NULL

#' Mujeres y hombres de una fila de aula, a partir del top-2 de sexo
#'
#' El marco no guarda el conteo completo por sexo: guarda las dos categorías más
#' frecuentes con su n. En una base de dos sexos eso es el conteo entero; si
#' apareciera una tercera categoría, esta cuenta se queda con lo que el marco
#' publica y no la inventa.
#'
#' @keywords internal
.cm_aulas_sexo_conteos <- function(df) {
  vacio <- list(f = rep(NA_real_, nrow(df)), m = rep(NA_real_, nrow(df)))
  if (!is.data.frame(df) || !nrow(df)) return(list(f = numeric(0), m = numeric(0)))
  cols <- c("sex_top_1", "sex_top_1_n", "sex_top_2", "sex_top_2_n")
  if (!all(cols %in% names(df))) return(vacio)
  clave <- function(x) {
    k <- toupper(trimws(as.character(x)))
    ifelse(substr(k, 1, 1) %in% c("F", "M"), substr(k, 1, 1), NA_character_)
  }
  k1 <- clave(df$sex_top_1); k2 <- clave(df$sex_top_2)
  n1 <- suppressWarnings(as.numeric(df$sex_top_1_n))
  n2 <- suppressWarnings(as.numeric(df$sex_top_2_n))
  n1[!is.finite(n1)] <- 0; n2[!is.finite(n2)] <- 0
  list(
    f = ifelse(k1 %in% "F", n1, 0) + ifelse(k2 %in% "F", n2, 0),
    m = ifelse(k1 %in% "M", n1, 0) + ifelse(k2 %in% "M", n2, 0)
  )
}

#' Proporción de mujeres por facultad en un conjunto de aulas
#'
#' Devuelve `NA` —no cero— cuando una facultad no trae conteos utilizables: un
#' cero se leería como «medido y sin mujeres», que es una afirmación distinta.
#'
#' @keywords internal
.cm_aulas_sexo_por_facultad <- function(df) {
  out <- list()
  if (!is.data.frame(df) || !nrow(df) || !"faculty" %in% names(df)) return(out)
  cuentas <- .cm_aulas_sexo_conteos(df)
  if (!length(cuentas$f)) return(out)
  claves <- vapply(
    as.character(df$faculty),
    function(x) .cm_aulas_scalar(.cm_criterios_fac_key(x), ""),
    character(1), USE.NAMES = FALSE
  )
  for (k in unique(claves[nzchar(claves)])) {
    idx <- claves == k
    f <- sum(cuentas$f[idx], na.rm = TRUE)
    m <- sum(cuentas$m[idx], na.rm = TRUE)
    total <- f + m
    out[[k]] <- list(
      etiqueta = .cm_aulas_scalar(df$faculty[idx][1], k),
      aulas = sum(idx),
      f = f, m = m,
      prop_f = if (total > 0) f / total else NA_real_
    )
  }
  out
}

#' Aviso con las dos proporciones y la brecha que las separa
#'
#' Sin las cifras el aviso es una impresión. Con ellas el analista ve de una vez
#' qué pide la cuota de esa facultad, qué ofrecen sus aulas titulares y sobre
#' cuántas descansa la diferencia.
#'
#' Sólo habla cuando la brecha supera la tolerancia que el propio estudio se
#' fijó para el eje sexo. Por debajo de ella el estudio ya acepta la diferencia
#' en el agregado, así que anunciarla por facultad sería ruido: ocho avisos de
#' un punto entierran el de nueve, que es el que hay que leer.
#'
#' @keywords internal
.cm_aulas_aviso_sexo_facultad <- function(facultad, prop_marco, prop_sel, aulas,
                                          tolerancia = 0.025) {
  if (!is.finite(prop_marco) || !is.finite(prop_sel)) return("")
  tol <- suppressWarnings(as.numeric(tolerancia))
  if (!is.finite(tol) || tol < 0) tol <- 0.025
  if (abs(prop_sel - prop_marco) <= tol) return("")
  brecha <- round(abs(prop_sel - prop_marco) * 100)
  n <- suppressWarnings(as.integer(aulas))
  una <- identical(n, 1L)
  sprintf(
    paste("%s: %s %s ofrece%s %s%% de mujeres y la cuota de esta facultad",
          "pide %s%% — %s %s por %s."),
    facultad,
    if (una) "su única" else paste("sus", format(n)),
    if (una) "aula titular" else "aulas titulares",
    if (una) "" else "n",
    format(round(prop_sel * 100)), format(round(prop_marco * 100)),
    format(brecha), if (brecha == 1) "punto" else "puntos",
    if (prop_sel < prop_marco) "debajo" else "encima"
  )
}

#' Tolerancia que el estudio se fijó para el eje sexo
#'
#' Se lee del objetivo de representatividad del propio marco. No se inventa un
#' umbral: se aplica al detalle el que ya rige en el agregado.
#'
#' @keywords internal
.cm_aulas_tolerancia_sexo <- function(frame) {
  vars <- NULL
  if (is.list(frame)) vars <- frame$config$objective$variables
  if (is.data.frame(vars) && all(c("variable", "tolerance") %in% names(vars))) {
    fila <- vars[as.character(vars$variable) %in% "sex", , drop = FALSE]
    if (nrow(fila)) {
      tol <- suppressWarnings(as.numeric(fila$tolerance[[1]]))
      if (is.finite(tol) && tol >= 0) return(tol)
    }
  }
  0.025
}

#' Añade `sexo_por_facultad` a la selección
#'
#' Aditivo: no toca ninguna cifra que el sorteo haya aplicado.
#'
#' Se mide sobre las **titulares**, que son las que se visitan y las que
#' entregan la cuota. Contar también las reservas daría una composición que
#' nadie va a encuestar: en HSVG2026 son 30 titulares y 330 reservas, así que
#' decir «sus 36 aulas» de una facultad con 3 titulares sería una cifra falsa.
#' Si la selección no distingue roles se cae a todo lo que no sea bolsa extra y
#' el bloque lo declara en `base`.
#'
#' @param selection Selección publicada por `calc_muestra_aulas_seleccionar`.
#' @param frame Marco de aulas; de ahí salen la proporción de referencia y la
#'   tolerancia del eje sexo.
#' @return La selección con el bloque `sexo_por_facultad`, o intacta si no hay
#'   con qué medir.
#' @keywords internal
calc_muestra_aulas_adjuntar_sexo_facultad <- function(selection, frame = NULL) {
  if (!is.list(selection)) return(selection)
  sel_df <- selection$selection
  if (!is.data.frame(sel_df) || !nrow(sel_df)) return(selection)
  roles <- if ("sample_role" %in% names(sel_df)) as.character(sel_df$sample_role) else rep("", nrow(sel_df))
  elegidas <- sel_df[roles %in% "titular", , drop = FALSE]
  base <- "titulares"
  if (!nrow(elegidas)) {
    elegidas <- sel_df[!roles %in% "extra_reserve_pool", , drop = FALSE]
    base <- "seleccion_sin_bolsa_extra"
  }
  if (!nrow(elegidas)) return(selection)
  tolerancia <- .cm_aulas_tolerancia_sexo(frame)

  af <- if (is.list(frame)) frame$aula_frame else NULL
  marco <- if (is.data.frame(af) && "included" %in% names(af)) {
    .cm_aulas_sexo_por_facultad(af[af$included %in% TRUE, , drop = FALSE])
  } else list()
  sel <- .cm_aulas_sexo_por_facultad(elegidas)
  if (!length(sel)) return(selection)

  filas <- lapply(names(sel), function(k) {
    s <- sel[[k]]
    r <- marco[[k]]
    prop_marco <- if (is.null(r)) NA_real_ else r$prop_f
    etiqueta <- s$etiqueta
    list(
      faculty_key = k,
      facultad = etiqueta,
      aulas_titulares = as.integer(s$aulas),
      marco_mujeres = if (is.null(r)) NA_integer_ else as.integer(r$f),
      marco_hombres = if (is.null(r)) NA_integer_ else as.integer(r$m),
      marco_prop_mujeres = if (is.finite(prop_marco)) round(prop_marco, 4) else NA_real_,
      titulares_mujeres = as.integer(s$f),
      titulares_hombres = as.integer(s$m),
      titulares_prop_mujeres = if (is.finite(s$prop_f)) round(s$prop_f, 4) else NA_real_,
      brecha_pp = if (is.finite(prop_marco) && is.finite(s$prop_f)) {
        round((s$prop_f - prop_marco) * 100, 1)
      } else NA_real_,
      estado = if (is.finite(prop_marco) && is.finite(s$prop_f)) "medido" else "sin_dato",
      aviso = .cm_aulas_aviso_sexo_facultad(
        etiqueta, prop_marco, s$prop_f, s$aulas, tolerancia
      )
    )
  })
  orden <- order(vapply(filas, function(x) {
    b <- x$brecha_pp
    if (is.finite(b)) b else Inf
  }, numeric(1)))

  selection$sexo_por_facultad <- list(
    schema = "calc_muestra_aulas_sexo_por_facultad_v1",
    owner = "calc_muestra_aulas_selection_v1.sexo_por_facultad",
    grain = "facultad",
    unit = "estudiante_elegible",
    referencia = "marco_incluido",
    base = base,
    tolerancia = tolerancia,
    # El agregado ya existe en `representativity`; esto es su desglose, no un
    # criterio nuevo: no se emite veredicto por fila.
    veredicto = "ninguno",
    filas = filas[orden]
  )
  selection
}
