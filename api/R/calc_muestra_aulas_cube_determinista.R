# calc_muestra_aulas_cube_determinista.R — el sorteo balanceado da la misma
# muestra en cualquier maquina.
#
# EL DEFECTO. La fase de vuelo del metodo del cubo (Deville-Tille) necesita, en
# cada paso, un vector NO NULO del nucleo de la matriz de balance. Cualquier
# vector del nucleo sirve: la matematica del metodo no distingue entre `u` y
# `-u`, ni entre dos vectores que difieran en la decimoquinta cifra.
# `sampling::fastflightcube` lo obtiene con `svd(X1)$u[, p + 1]`, y ahi esta el
# problema: los vectores singulares estan definidos SALVO SIGNO, LAPACK no fija
# cual devuelve, y cada BLAS (Accelerate en macOS, OpenBLAS en Linux) elige el
# suyo. La direccion del paso decide que unidad se satura primero, asi que dos
# maquinas sortean muestras distintas con la MISMA semilla.
#
# Medido el 2026-08-11 sobre el fixture golden de simulacion: macOS elegia
# A11/A3/A4/A9 y el runner Linux del CI elegia A1/A11/A3/A7. Invirtiendo a mano
# el signo del svd en macOS salian A11/A2/A3/A8: tres muestras distintas del
# mismo diseno, la misma semilla y la misma version de `sampling`.
#
# Por que importa mas alla del CI: Prosecnur se distribuye en Windows y macOS.
# Dos investigadores con el mismo proyecto y la misma semilla obtenian muestras
# distintas, y el ADR 0066 promete justamente que la probabilidad publicada
# describe el sorteo ejecutado. Una seleccion que no se puede reproducir no se
# puede defender ante un comite.
#
# LA REPARACION. No se cambia el metodo: se le quita la ambiguedad. El svd que
# usa la fase de vuelo pasa por `.cm_aulas_svd_canonico()`, que
#   1. fija el signo de cada vector singular con una regla propia (la primera
#      componente significativa es positiva), y
#   2. redondea a `CM_AULAS_CUBE_DIGITS` cifras, para que el ruido de la ultima
#      cifra no decida que unidad entra en la muestra.
# El estimador, las probabilidades de inclusion y el balance no cambian: cambia
# CUAL de los vectores igualmente validos del nucleo se toma, que es lo que
# estaba quedando al azar de la biblioteca de algebra lineal.
#
# Las selecciones ejecutadas ANTES de esta reparacion no son reproducibles; el
# ADR 0073 lo declara y explica que hacer con ellas.

# Cifras significativas a las que se recorta el svd. El valor tiene que caer en
# una ventana estrecha, y por los dos lados:
#
#   · mas fino que 1e-15, el ruido tipico entre implementaciones de LAPACK, no
#     serviria: el redondeo dejaria pasar justo la diferencia que se quiere
#     matar.
#   · mas grueso que 1e-11 tampoco: `sampling` usa EPS = 1e-11 para decidir si
#     un pik ya llego a 0 o a 1. Un error inducido por encima de ese umbral
#     dejaria componentes que deberian estar fijadas viviendo como "todavia
#     fraccionarias", alargando la fase de vuelo y empujando al aterrizaje
#     casos que no le tocaban.
#
# 12 cifras deja el error inducido (1e-12) por debajo del EPS del metodo y tres
# ordenes por encima del ruido de plataforma.
CM_AULAS_CUBE_DIGITS <- 12L

# SVD canonico: mismo subespacio, un solo representante.
#
# Envuelve `base::svd` fijando el signo de cada vector singular y recortando el
# ruido de la ultima cifra. Es la unica pieza que la fase de vuelo necesita que
# sea estable entre plataformas. Interna, como el resto de `.cm_aulas_*`: no
# lleva `@export` ni entra al NAMESPACE.
.cm_aulas_svd_canonico <- function(x, nu = min(dim(x)), nv = min(dim(x)),
                                   LINPACK = FALSE) {
  s <- base::svd(x, nu = nu, nv = nv)

  # El signo se decide por la PRIMERA componente que no es ruido, recorriendo en
  # orden de indice. Es una regla del repositorio, no de LAPACK: da igual cual
  # sea mientras sea la misma en toda maquina.
  tol <- 10^(-CM_AULAS_CUBE_DIGITS)
  signo_de <- function(columna) {
    significativas <- which(abs(columna) > tol)
    if (!length(significativas)) return(1)
    if (columna[significativas[1L]] < 0) -1 else 1
  }

  if (!is.null(s$u) && length(s$u)) {
    s$u <- as.matrix(s$u)
    for (j in seq_len(ncol(s$u))) {
      sg <- signo_de(s$u[, j])
      s$u[, j] <- sg * s$u[, j]
      # `v` acompana a `u`: invertir uno solo romperia x = u d v'.
      if (!is.null(s$v) && length(s$v) && j <= ncol(as.matrix(s$v))) {
        s$v <- as.matrix(s$v)
        s$v[, j] <- sg * s$v[, j]
      }
    }
    s$u <- round(s$u, CM_AULAS_CUBE_DIGITS)
  }
  if (!is.null(s$v) && length(s$v)) s$v <- round(as.matrix(s$v), CM_AULAS_CUBE_DIGITS)
  if (!is.null(s$d) && length(s$d)) s$d <- round(s$d, CM_AULAS_CUBE_DIGITS)
  s
}

# Copias de `samplecube` y `fastflightcube` cuyo `svd` es el canonico. Se
# construyen una vez por sesion: `environment()` sobre una copia no toca el
# namespace de `sampling`, que esta sellado.
#
# El acoplamiento a la estructura interna del paquete es deliberado y esta
# acotado: si `sampling` deja de exportar alguna de las dos, o de resolver `svd`
# por busqueda lexica, `.cm_aulas_cube_determinista()` devuelve NULL y quien
# llama decide. Nunca se sortea a medias.
.cm_aulas_cube_determinista <- function() {
  if (!requireNamespace("sampling", quietly = TRUE)) return(NULL)
  ns <- asNamespace("sampling")
  if (!exists("fastflightcube", envir = ns, inherits = FALSE)) return(NULL)
  if (!exists("samplecube", envir = ns, inherits = FALSE)) return(NULL)

  vuelo <- get("fastflightcube", envir = ns)
  if (!is.function(vuelo)) return(NULL)
  env_vuelo <- new.env(parent = ns)
  assign("svd", .cm_aulas_svd_canonico, envir = env_vuelo)
  environment(vuelo) <- env_vuelo

  cubo <- get("samplecube", envir = ns)
  if (!is.function(cubo)) return(NULL)
  env_cubo <- new.env(parent = ns)
  assign("fastflightcube", vuelo, envir = env_cubo)
  # La fase de aterrizaje tambien puede resolver algebra lineal: se le da el
  # mismo svd para que el determinismo no dependa de por donde salga el sorteo.
  aterrizaje <- if (exists("landingcube", envir = ns, inherits = FALSE)) {
    get("landingcube", envir = ns)
  } else {
    NULL
  }
  if (is.function(aterrizaje)) {
    env_aterrizaje <- new.env(parent = ns)
    assign("svd", .cm_aulas_svd_canonico, envir = env_aterrizaje)
    environment(aterrizaje) <- env_aterrizaje
    assign("landingcube", aterrizaje, envir = env_cubo)
  }
  environment(cubo) <- env_cubo
  cubo
}

# Sorteo por metodo del cubo, reproducible entre plataformas. Devuelve los
# indices seleccionados, o NULL si el sorteo no pudo ejecutarse.
.cm_aulas_samplecube_estable <- function(x, pik) {
  cubo <- .cm_aulas_cube_determinista()
  if (is.null(cubo)) return(NULL)
  tryCatch(
    which(as.numeric(cubo(x, pik, order = 1, comment = FALSE)) > 0),
    error = function(e) NULL
  )
}
