# Significancia estadistica en el motor de graficos
# =================================================
#
# PROBLEMA. La casa YA calcula diferencias significativas entre columnas: el
# exportador de cruces (`reporte_cruces.R`) corre pruebas z de diferencia de
# proporciones con correccion de Bonferroni y escribe letras por columna. Ese
# rigor vive solo en el XLSX. Un grafico de barras agrupadas por un cruce
# muestra 44% contra 37% sin decir si esa distancia es real o es ruido, y el
# lector la interpreta como real. La tabla y la lamina del mismo estudio
# afirmaban cosas distintas sobre los mismos datos.
#
# DISEÑO. Este archivo NO reimplementa la prueba: consume
# `comparar_columnas_sig()` de `reporte_cruces.R`, la misma funcion que produce
# las letras del XLSX. Tampoco recalcula denominadores. El render de barras
# agrupadas ya construyo el conteo por grupo (`cols_n` sobre `df_long`) y el
# total por grupo (`group_totals`); esas dos piezas SON el `n_mat` y el `N_vec`
# que la prueba espera. Recalcularlos desde los datos crudos habria sido la via
# directa a que la lamina y la tabla discrepen —el defecto que esta feature
# existe para cerrar—, porque cada camino aplica sus propias exclusiones de
# opciones y su propio filtro de validos.
#
# Vive aparte de `reporte_plan_ppt.R` porque ese archivo esta en
# `policy.frozen_growth_files`: la regla de la casa es que la funcionalidad
# nueva estrena archivo y el grande la llama.
#
# LIMITE DECLARADO. La prueba z asume observaciones independientes. Cuando el
# diseño no lo garantiza —grupos repeat, donde una persona aporta varias filas—
# este motor SE ABSTIENE de asignar letras y lo dice en la nota, en vez de
# publicar una significancia que el diseño no sostiene. Es la misma postura que
# toma `reporte_cruces.R` ante un `repeat_design` insuficiente.

# Letra de columna. Se mantiene `LETTERS` para que la lamina y el XLSX usen el
# mismo alfabeto: un lector que ve "B" en la tabla debe ver "B" en el grafico.
.graficos_sig_letra_columna <- function(j) {
  if (j >= 1L && j <= length(LETTERS)) LETTERS[[j]] else paste0("col", j)
}

# Matriz de conteos y vector de bases a partir de lo que el render YA calculo.
#
# `df_long` es el tibble ancho del render (una fila por categoria, una columna
# de conteo por grupo); `cols_n` mapea cada columna de porcentaje a su columna
# de conteo; `group_totals` trae la base de cada grupo. El orden de las
# columnas lo fija `cols_porcentaje`, que es el mismo orden en que el grafico
# dibuja las series: asi la letra "B" senala siempre a la segunda barra.
.graficos_sig_matrices <- function(df_long,
                                   cols_n,
                                   group_totals,
                                   cols_porcentaje,
                                   var_categoria = "categoria") {
  if (is.null(df_long) || !nrow(df_long)) return(NULL)
  cols_porcentaje <- as.character(cols_porcentaje)
  cols_porcentaje <- cols_porcentaje[nzchar(cols_porcentaje)]
  if (length(cols_porcentaje) < 2L) return(NULL)

  categorias <- as.character(df_long[[var_categoria]])
  n_mat <- matrix(
    NA_real_,
    nrow = length(categorias),
    ncol = length(cols_porcentaje),
    dimnames = list(categorias, cols_porcentaje)
  )
  N_vec <- stats::setNames(rep(NA_real_, length(cols_porcentaje)), cols_porcentaje)

  for (j in seq_along(cols_porcentaje)) {
    col_pct <- cols_porcentaje[[j]]
    col_n <- cols_n[[col_pct]] %||% NA_character_
    if (is.na(col_n) || !nzchar(col_n) || !col_n %in% names(df_long)) return(NULL)
    n_mat[, j] <- suppressWarnings(as.numeric(df_long[[col_n]]))
    # `group_totals[[col_pct]]` aborta si el nombre no esta —el render puede
    # haber saltado un grupo sin base—, y un abort aqui tumba el mazo entero por
    # una anotacion opcional. Se indexa por posicion del nombre.
    pos <- match(col_pct, names(group_totals))
    N_vec[[j]] <- if (is.na(pos)) 0 else suppressWarnings(as.numeric(group_totals[[pos]]))
  }

  n_mat[!is.finite(n_mat)] <- 0
  N_vec[!is.finite(N_vec)] <- 0
  if (all(N_vec <= 0)) return(NULL)

  list(n_mat = n_mat, N_vec = N_vec)
}

# Diseño de la fuente: "cluster" si la base es hija de un repeat, si no
# "independiente".
#
# El ctx del motor PPT no adjunta el `is_repeat` que sí expone el runtime de
# Gráficos, así que la señal se deriva del instrumento: una base con
# `repeat_grain` o con `parent_base`/`repeat_group` es una base donde una misma
# persona aporta varias filas. Se lee tanto del atributo como del campo porque
# el runtime pobla uno u otro segun el camino de carga.
.graficos_sig_diseno_de_fuente <- function(inst) {
  if (is.null(inst)) return("desconocido")
  grain <- attr(inst, "repeat_grain", exact = TRUE) %||%
    (if (is.list(inst)) inst$repeat_grain else NULL)
  if (is.list(grain) && length(grain)) {
    marcas <- c(
      grain$base_name %||% NULL,
      grain$repeat_group %||% NULL,
      grain$parent_base %||% NULL
    )
    marcas <- as.character(marcas)
    if (any(!is.na(marcas) & nzchar(trimws(marcas)))) return("cluster")
  }
  if (is.list(inst)) {
    directas <- as.character(c(inst$parent_base %||% NULL, inst$repeat_group %||% NULL))
    if (any(!is.na(directas) & nzchar(trimws(directas)))) return("cluster")
  }
  "independiente"
}

# Motivo por el que no se emiten letras, o NULL si se pueden emitir.
#
# Devolver el motivo y no un simple FALSE es deliberado: la nota al pie tiene
# que poder decir POR QUE no hay letras. Un grafico sin letras y sin
# explicacion se lee como "no hay diferencias", que es la lectura opuesta.
.graficos_sig_motivo_abstencion <- function(diseno, n_series, n_bases_validas) {
  diseno <- as.character(diseno %||% "independiente")[1]
  if (identical(diseno, "cluster")) {
    return(paste0(
      "No se asignan letras: el diseno tiene grupos repeat y una misma persona ",
      "aporta varias filas, de modo que las observaciones no son independientes."
    ))
  }
  if (identical(diseno, "desconocido")) {
    return("No se asignan letras: no se pudo establecer si las observaciones son independientes.")
  }
  if (n_series < 2L) {
    return("No se asignan letras: hace falta al menos un cruce con dos grupos.")
  }
  if (n_bases_validas < 2L) {
    return("No se asignan letras: menos de dos grupos tienen base suficiente.")
  }
  NULL
}

# Calculo de letras. Delega en `comparar_columnas_sig()` — la MISMA funcion que
# firma las letras del XLSX de cruces— y no reimplementa la prueba.
.graficos_sig_calcular <- function(n_mat, N_vec, alpha = 0.05, diseno = "independiente") {
  motivo <- .graficos_sig_motivo_abstencion(
    diseno = diseno,
    n_series = ncol(n_mat),
    n_bases_validas = sum(N_vec > 0)
  )
  if (!is.null(motivo)) return(list(letras = NULL, motivo = motivo))

  res <- tryCatch(
    comparar_columnas_sig(n_mat = n_mat, N_vec = N_vec, alpha = alpha),
    error = function(e) NULL
  )
  if (is.null(res) || is.null(res$letras)) {
    return(list(letras = NULL, motivo = "No se asignan letras: la prueba no pudo ejecutarse."))
  }
  list(letras = res$letras, motivo = NULL)
}

# Sufijos por celda para el graficador.
#
# `comparar_columnas_sig` marca la columna excluida del contraste con ".a"
# (proporcion 0 o 1). Ese marcador es util en una tabla densa y es ruido sobre
# una barra, donde el 0% ya se ve; aqui se descarta y la nota lo explica.
.graficos_sig_sufijos <- function(letras, var_categoria = "categoria") {
  if (is.null(letras) || !length(letras)) return(NULL)
  categorias <- rownames(letras)
  cols <- colnames(letras)
  filas <- list()
  for (j in seq_along(cols)) {
    for (i in seq_along(categorias)) {
      txt <- trimws(letras[i, j])
      if (!nzchar(txt) || identical(txt, ".a")) next
      # `comparar_columnas_sig` acumula con `paste`, que deja espacios dobles.
      partes <- Filter(nzchar, strsplit(txt, "[[:space:]]+")[[1]])
      partes <- setdiff(partes, ".a")
      if (!length(partes)) next
      filas[[length(filas) + 1L]] <- data.frame(
        .categoria = categorias[[i]],
        .col_pct   = cols[[j]],
        .sufijo    = paste0(" ", paste(partes, collapse = "")),
        stringsAsFactors = FALSE
      )
    }
  }
  if (!length(filas)) return(NULL)
  out <- do.call(rbind, filas)
  names(out)[names(out) == ".categoria"] <- var_categoria
  out
}

# Nota metodologica al pie.
#
# El XLSX de cruces escribe esta misma nota en un parrafo de una celda ancha.
# Sobre una lamina no cabe: el primer render real salio con el texto cortado por
# los DOS lados, porque el caption del graficador no envuelve. Aqui la nota se
# dice en el minimo de palabras que sostiene la afirmacion y se envuelve a un
# ancho explicito; el mapa de letras va en su propia linea porque es lo que el
# lector consulta, no lo que lee.
.graficos_sig_nota <- function(etiquetas_series,
                               alpha = 0.05,
                               motivo = NULL,
                               hay_letras = TRUE,
                               # 96 caracteres tocaban el borde derecho del
                               # lienzo en el render de prueba y el caption va
                               # alineado a la derecha, asi que el desborde se
                               # come el principio de la linea. 72 deja margen
                               # en la lamina 16:9 con `size_nota_pie` de la
                               # casa; el motor puede subirlo si el slot es mas
                               # ancho.
                               ancho = 72) {
  envolver <- function(txt) {
    ancho <- suppressWarnings(as.integer(ancho)[1])
    if (!is.finite(ancho) || ancho < 20L) ancho <- 96L
    if (!requireNamespace("stringr", quietly = TRUE)) return(txt)
    paste(vapply(
      strsplit(txt, "\n", fixed = TRUE)[[1]],
      function(linea) stringr::str_wrap(linea, width = ancho),
      character(1)
    ), collapse = "\n")
  }

  if (!is.null(motivo)) return(envolver(motivo))
  if (!isTRUE(hay_letras)) {
    return(envolver(paste0(
      "Ninguna diferencia entre grupos resulto significativa ",
      "(prueba z, correccion de Bonferroni, alpha = ", alpha, ")."
    )))
  }
  mapa <- vapply(
    seq_along(etiquetas_series),
    function(j) paste0(.graficos_sig_letra_columna(j), " = ", etiquetas_series[[j]]),
    character(1)
  )
  envolver(paste0(
    "Las letras marcan al grupo superado con diferencia significativa ",
    "(prueba z, correccion de Bonferroni, alpha = ", alpha, ").\n",
    paste(mapa, collapse = "  |  ")
  ))
}

# Orquestador que llama el motor.
#
# Devuelve la lista de argumentos ya enriquecida: el sufijo por celda para el
# graficador y la nota al pie. Si no hay nada que anotar devuelve `base_args`
# intacto, para que apagar la opcion deje el render exactamente como estaba.
.graficos_sig_aplicar <- function(base_args,
                                  df_long,
                                  cols_n,
                                  group_totals,
                                  cols_porcentaje,
                                  etiquetas_series,
                                  activo = FALSE,
                                  alpha = 0.05,
                                  diseno = "independiente",
                                  var_categoria = "categoria") {
  if (!isTRUE(activo)) return(base_args)

  alpha <- suppressWarnings(as.numeric(alpha)[1])
  if (!is.finite(alpha) || alpha <= 0 || alpha >= 1) alpha <- 0.05

  mats <- .graficos_sig_matrices(
    df_long        = df_long,
    cols_n         = cols_n,
    group_totals   = group_totals,
    cols_porcentaje = cols_porcentaje,
    var_categoria  = var_categoria
  )

  etiquetas_txt <- unname(as.character(etiquetas_series))

  if (is.null(mats)) {
    base_args$nota_pie_significancia <- .graficos_sig_nota(
      etiquetas_series = etiquetas_txt,
      alpha = alpha,
      motivo = .graficos_sig_motivo_abstencion(
        diseno = diseno,
        n_series = length(etiquetas_txt),
        n_bases_validas = 0L
      ) %||% "No se asignan letras: los datos del cruce no permiten el contraste."
    )
    return(base_args)
  }

  res <- .graficos_sig_calcular(
    n_mat  = mats$n_mat,
    N_vec  = mats$N_vec,
    alpha  = alpha,
    diseno = diseno
  )

  sufijos <- .graficos_sig_sufijos(res$letras, var_categoria = var_categoria)

  base_args$sufijos_etiqueta <- sufijos
  base_args$nota_pie_significancia <- .graficos_sig_nota(
    etiquetas_series = etiquetas_txt,
    alpha = alpha,
    motivo = res$motivo,
    hay_letras = !is.null(sufijos)
  )
  base_args
}
