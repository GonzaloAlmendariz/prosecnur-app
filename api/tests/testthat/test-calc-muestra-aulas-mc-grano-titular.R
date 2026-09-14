# Grano del conteo Monte Carlo del sorteo final: pi_mc es la probabilidad de
# salir TITULAR, no la de aparecer en algun lugar del plan.
#
# El defecto: dentro de `.cm_aulas_mc_probabilities` cada corrida simula el plan
# COMPLETO de olas (M1 titulares + M2..Mk reemplazos encadenados) y contaba como
# "aula incluida" a todo lo que sobrevive a un unico filtro: descartar
# `extra_reserve_pool`. Es decir, contaba "el aula salio titular O quedo en una
# cadena de reemplazo". Pero el consumidor de ese numero es el peso del titular:
# `pi_final <- pi_mc` y acto seguido `weight_classroom <- 1 / pi_final`. Los dos
# granos no son el mismo numero y solo uno pondera.
#
# Como muerde: con `replacement_waves >= 2` las cadenas consumen el marco entero,
# `extra_reserve_pool` queda vacio y el filtro no descarta nada -> toda aula
# aparece en toda corrida -> pi_mc = 1.000 para TODAS, weight_classroom = 1 y la
# ponderacion queda anulada en silencio (max_se=0 lo presenta ademas como una
# estimacion perfecta). El default de la casa es `replacement_waves = 5L`
# (calc_muestra_aulas.R:427), asi que el regimen por defecto era el roto.
#
# Por que la suite estaba verde: los e2e de `pool_controlado` corren todos con
# `replacement_waves = 0L`, el UNICO valor donde el bug es invisible (sin olas de
# reemplazo, "aparecer en el plan" y "salir titular" son el mismo evento). Y los
# asserts historicos sobre pi_final son de piso (`> 0`, finito), nunca de techo:
# `1 > 0` pasa. De ahi el contra-caso de abajo, que fija que el estimador MC
# funciona y que lo unico mal era QUE contaba.
#
# ---------------------------------------------------------------------------
# EL INVARIANTE QUE GOBIERNA ESTE ARCHIVO: la pi SUMA el tamano del sorteo.
#
#     suma_{i en el MARCO} pi_i = n          y por estrato      suma_{i en h} pi_i = cuota_h
#
# Es la identidad de todo diseno de tamano fijo, y aqui es exacta: cada corrida
# MC sortea exactamente n titulares, asi que suma_i pi_i = (1/R) * suma_r T_r con
# T_r = titulares de la corrida r; si T_r = n en toda corrida, el promedio es n
# SIN ruido Monte Carlo. El ruido vive en el REPARTO de esa masa entre aulas (SE
# por aula medido: 0.158), no en el total. Medido en el marco de 119 aulas con
# n = 55: suma = 55.0000 con el conteo arreglado y 119.0000 con el dominio viejo
# (`!= "extra_reserve_pool"`), un exceso de 64 aulas que ningun diseno que sortee
# 55 puede producir. Desviacion por estrato: 0.0000 en los 6 estratos.
#
# Por que reemplazo a los asserts que habia aqui:
#   - `any(pi_mc < 0.99)` y `any(weight > 1.05)` eran EXISTENCIALES: pasaban con
#     54 de 55 titulares todavia en pi = 1. Es el mismo defecto de "assert de
#     piso" que denuncia el parrafo de arriba, solo que en la otra direccion. El
#     reemplazo universal esta abajo: se cuenta CUANTAS aulas quedan en pi = 1 y
#     se exige el numero exacto que el diseno permite (0 aqui, 3 en el marco
#     saturado, 12 en el censo).
#   - `mean(pi_mc) < 1.5 * mean(pi_design)` comparaba medias CONDICIONADAS a
#     haber sido seleccionado, sesgadas al alza respecto del marco. Queda
#     subsumida por `suma(pi_mc) = suma(pi_design)` sobre el marco entero, que es
#     la misma comparacion sin condicionar y es exacta (55.000000 vs 55.000000).
#
# GRANO DE LA SUMA: es sobre `aula_frame` (el marco), NO sobre las filas de
# `selection_df`. Sumar solo los titulares mide otra cosa (daria n por
# construccion trivial y no vigilaria nada). El vector pi del marco se obtiene
# llamando a `.cm_aulas_mc_probabilities` directo sobre el aula_frame preparado
# igual que el caller (filtro `included` + `eligible_n` saneado + `stratum`), que
# ademas es MAS BARATO que un sorteo completo: 22 s contra 63 s. Y es el MISMO
# vector que pondera: el amarre `max|pi_mc(sorteo) - pi_marco(directo)| = 0` esta
# asertado abajo, porque el MC es determinista en la semilla.
#
# TOLERANCIA: 0.5 aulas, absoluta. NO se usa 3*SE_MC: esa cota (~1.65 aulas aqui)
# trataria las pi como Bernoulli independientes, cuando por corrida estan atadas
# a sumar T_r; admitiria un deficit de 1.6 aulas que ningun diseno de tamano fijo
# puede producir, y seria otra vez fijar el contrato por el lado debil. El unico
# desvio legitimo es un ajuste de tamano (un estrato que no llena su cuota):
# 0.5 absorbe hasta 5 corridas de 10 cortas en un aula, y sigue a 128 tolerancias
# del valor del bug. Medido: desvio 0.0000.
#
# Costo MEDIDO: 4:16 para el archivo entero (57 asserts). Lo caro son los dos
# regimenes sobre el marco de 119 aulas con `pool_controlado`: un sorteo real
# (63 s) mas una estimacion MC directa (22 s) cada uno. Los dos marcos de abajo
# -saturado y censo- no necesitan 119 aulas para demostrar su punto y corren con
# 15 y 12 (~15 s cada uno, sorteo incluido). El contra-caso sin olas conserva el
# marco de 119 A PROPOSITO aunque uno chico seria mas barato: solo aislando
# `replacement_waves` como UNICA variable sirve de contra-caso. El defecto es
# determinista, no estadistico, asi que 10 corridas MC bastan; subir la precision
# solo compraria tiempo de CPU. Los contextos se memoizan para no pagar dos veces
# el mismo marco (el sorteo y el invariante de suma comparten el suyo).

.MC_GRANO_TOL <- 0.5   # aulas; ver TOLERANCIA en el encabezado
.MC_GRANO_UNO <- 1 - 1e-9

.mc_grano_base <- function(n_aulas, per_class = 4L) {
  n <- n_aulas * per_class
  aula <- rep(seq_len(n_aulas), each = per_class)
  data.frame(
    student_id = paste0("s", seq_len(n)),
    aula_id = paste0("A", aula),
    curso_id = paste0("C", aula),
    curso = paste("Curso", aula),
    horario = rep(c("manana", "tarde", "noche"), length.out = n),
    facultad = paste0("FAC", (aula %% 6L) + 1L),
    programa = paste0("P", (aula %% 12L) + 1L),
    sexo = rep(c("F", "M"), length.out = n),
    edad = 20,
    condicion = "regular",
    nivel = as.character((aula %% 2L) + 1L),
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

# Marco con tamano de clase POR FACULTAD: la cuota se reparte proporcional a la
# masa de elegibles (.cm_aulas_quota_by_stratum), asi que una facultad con pocas
# aulas grandes recibe mas cuota que aulas tiene y queda SATURADA (cuota_h = N_h).
# Con clases iguales no hay forma de saturar un estrato: cuota_h/N_h = n/N.
.mc_grano_base_mixta <- function(specs) {
  filas <- list()
  sid <- 0L
  aid <- 0L
  for (sp in specs) {
    for (k in seq_len(sp$aulas)) {
      aid <- aid + 1L
      m <- sp$por_aula
      filas[[length(filas) + 1L]] <- data.frame(
        student_id = paste0("s", sid + seq_len(m)),
        aula_id = paste0("A", aid),
        curso_id = paste0("C", aid),
        curso = paste("Curso", aid),
        horario = rep(c("manana", "tarde", "noche"), length.out = m),
        facultad = sp$facultad,
        programa = paste0("P", aid),
        sexo = rep(c("F", "M"), length.out = m),
        edad = 20,
        condicion = "regular",
        nivel = as.character((aid %% 2L) + 1L),
        modalidad = "presencial",
        stringsAsFactors = FALSE
      )
      sid <- sid + m
    }
  }
  do.call(rbind, filas)
}

.mc_grano_cfg <- function(n_aulas, replacement_waves, monte_carlo_n = 10L) {
  calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 17L,
      n_aulas = n_aulas,
      replacement_waves = replacement_waves,
      selector_engine = "pool_controlado",
      strata_cols = list("faculty"),
      balance_vars = list("faculty", "program"),
      monte_carlo_n = monte_carlo_n
    )
  ))
}

.mc_grano_memo <- new.env(parent = emptyenv())
.mc_grano_una_vez <- function(clave, valor) {
  if (!exists(clave, envir = .mc_grano_memo, inherits = FALSE)) {
    assign(clave, valor, envir = .mc_grano_memo)  # `valor` se fuerza solo aqui
  }
  get(clave, envir = .mc_grano_memo, inherits = FALSE)
}

# Prepara el aula_frame EXACTAMENTE como lo hace calc_muestra_aulas_seleccionar
# antes del MC (filtro `included`, eligible_n numerico saneado, stratum derivado
# de strata_cols) y estima la pi del marco con la funcion REAL del path final.
# Mismo aula_frame + misma semilla => mismo vector que termina en pi_final.
.mc_grano_ctx <- function(clave, base_madre, cfg) {
  .mc_grano_una_vez(clave, {
    sel <- cfg$selector
    fr <- calc_muestra_aulas_construir(base_madre = base_madre, config = cfg)
    af <- prosecnurapp:::.cm_aulas_as_df(fr$aula_frame, "aula_frame")
    if (!"included" %in% names(af)) af$included <- TRUE
    incluidas <- prosecnurapp:::.cm_aulas_text_key(af$included) %in% c("true", "t", "1", "si", "s")
    if (is.logical(af$included)) incluidas <- af$included %in% TRUE
    af <- af[incluidas, , drop = FALSE]
    af$eligible_n <- suppressWarnings(as.numeric(af$eligible_n))
    af$eligible_n[!is.finite(af$eligible_n)] <- 0
    af$stratum <- prosecnurapp:::.cm_aulas_make_stratum(af, sel$strata_cols)
    # n efectivo: el sorteo capa n_aulas al tamano del marco (caso censo).
    n_ef <- min(nrow(af), max(1L, prosecnurapp:::.cm_aulas_int(sel$n_aulas, 1L)))
    waves <- c("M1", if (sel$replacement_waves > 0L) paste0("M", seq_len(sel$replacement_waves) + 1L) else character(0))
    mc <- prosecnurapp:::.cm_aulas_mc_probabilities(
      af, sel, "pool_controlado", waves,
      runs = prosecnurapp:::.cm_aulas_seleccionar_mc_runs(sel, "pool_controlado", FALSE),
      objective = cfg$objective
    )
    list(
      frame_result = fr,
      aula_frame = af,
      cfg = cfg,
      n = n_ef,
      waves = waves,
      cuotas = prosecnurapp:::.cm_aulas_quota_estratos(af, n_ef, sel),
      pi_marco = as.numeric(mc$pi[af$classroom_id]),
      pi_design = as.numeric(prosecnurapp:::.cm_aulas_design_probabilities(af, sel, "pool_controlado")[af$classroom_id]),
      mc = mc
    )
  })
}

.mc_grano_seleccion <- function(clave, ctx) {
  .mc_grano_una_vez(clave, calc_muestra_aulas_seleccionar(ctx$frame_result, config = ctx$cfg)$selection)
}

# Desvios del invariante de tamano fijo. Devuelve numeros, no asserts, para que
# el fallo se lea en el test que lo pide y no en este helper.
.mc_grano_desvios <- function(ctx) {
  af <- ctx$aula_frame
  estratos <- names(ctx$cuotas)
  list(
    suma = sum(ctx$pi_marco),
    global = sum(ctx$pi_marco) - ctx$n,
    estratos = vapply(estratos, function(st) sum(ctx$pi_marco[af$stratum == st]) - ctx$cuotas[[st]], numeric(1)),
    contra_design = sum(ctx$pi_marco) - sum(ctx$pi_design),
    # Precondicion del invariante por estrato: una cuota mayor que las aulas del
    # estrato se capa dentro de .cm_aulas_inclusion_probabilities y la suma seria
    # N_h, no cuota_h. En estos marcos no ocurre; si un dia ocurre, que falle
    # aqui con un mensaje claro y no en el invariante con uno confuso.
    cuota_alcanzable = all(vapply(estratos, function(st) ctx$cuotas[[st]] <= sum(af$stratum == st), logical(1)))
  )
}

.mc_grano_ctx_olas <- function() .mc_grano_ctx("olas", .mc_grano_base(119L), .mc_grano_cfg(55L, 5L))
.mc_grano_ctx_sin_olas <- function() .mc_grano_ctx("sin_olas", .mc_grano_base(119L), .mc_grano_cfg(55L, 0L))

test_that("pi_mc del titular no colapsa a 1 cuando las cadenas de reemplazo cubren el marco", {
  ctx <- .mc_grano_ctx_olas()
  df <- .mc_grano_seleccion("sel_olas", ctx)
  tit <- df[df$sample_role == "titular", , drop = FALSE]

  # Precondiciones del regimen que dispara el defecto. No son el contrato: estan
  # para que este test no pueda quedar verde POR AUSENCIA (si manana el sorteo
  # dejara aulas fuera del plan, los asserts de abajo pasarian sin que el conteo
  # se haya arreglado, y eso seria un falso verde).
  expect_equal(nrow(tit), 55L)
  expect_true("chain_reserve" %in% df$sample_role)     # hay olas de reemplazo
  expect_false("extra_reserve_pool" %in% df$sample_role) # el plan consume el marco
  expect_equal(unique(df$probability_source)[[1]], "monte_carlo_after_optimization")

  # El contrato, en universal y no en existencial: 55 de 119 aulas salen
  # titulares por corrida, asi que NINGUNA aula puede tener certeza de salir.
  # Con el bug vivo eran 55 de 55 en pi = 1; el `any(pi < 0.99)` que habia aqui
  # se conformaba con que UNA bajara. El numero exacto que el diseno permite es
  # cero, y es lo que se exige.
  expect_equal(sum(tit$pi_final >= .MC_GRANO_UNO), 0L)
  expect_equal(sum(tit$pi_mc >= .MC_GRANO_UNO), 0L)

  # El peso es el consumidor del numero: identidad exacta con 1/pi y, sobre todo,
  # DISCRIMINA entre aulas (con el bug era 1 para las 55, sd = 0).
  # El motor redondea el peso a 6 decimales (calc_muestra_aulas.R:4489), asi que
  # la identidad se afirma con esa cota y no con igualdad exacta.
  expect_lt(max(abs(tit$weight_classroom - 1 / tit$pi_final)), 1e-6)
  expect_true(all(is.finite(tit$weight_classroom) & tit$weight_classroom > 1))
  expect_gt(stats::sd(tit$weight_classroom), 0)

  # Amarre con el invariante de suma del test siguiente: la pi que mide sobre el
  # MARCO es, byte a byte, la que pondera a estos titulares (el MC es
  # determinista en la semilla). Sin esto, el invariante podria estar vigilando
  # un numero distinto del que llega al peso.
  pi_marco_tit <- ctx$pi_marco[match(tit$classroom_id, ctx$aula_frame$classroom_id)]
  expect_equal(max(abs(tit$pi_mc - pi_marco_tit)), 0)
})

test_that("la pi del titular suma el tamano del sorteo sobre el MARCO, global y por estrato", {
  ctx <- .mc_grano_ctx_olas()
  d <- .mc_grano_desvios(ctx)

  # Precondiciones: el grano de la suma es el marco entero, no la seleccion.
  expect_equal(nrow(ctx$aula_frame), 119L)
  expect_equal(ctx$n, 55L)
  expect_equal(sum(ctx$cuotas), 55L)
  expect_true(d$cuota_alcanzable)

  # Invariante de tamano fijo. Con el conteo arreglado da 55.0000; con el dominio
  # viejo (`!= "extra_reserve_pool"`) daba 119.0000 sobre el mismo marco y las
  # mismas semillas: 64 aulas de exceso, 128 veces la tolerancia.
  expect_lt(abs(d$global), .MC_GRANO_TOL)
  # Por estrato es estrictamente mas fuerte: atrapa un fix que conserve el total
  # pero mueva masa entre estratos. Medido: 0.0000 en los 6.
  expect_lt(max(abs(d$estratos)), .MC_GRANO_TOL)
  # pi_mc y pi_design estiman LO MISMO (la probabilidad de salir titular) por
  # vias distintas -simulacion vs formula-, y sobre el marco ambas suman n. Esta
  # es la comparacion sin condicionar que reemplaza a la de medias entre
  # seleccionados, que estaban sesgadas al alza respecto del marco.
  expect_lt(abs(d$contra_design), .MC_GRANO_TOL)
  expect_lt(abs(sum(ctx$pi_design) - 55), 1e-6) # la pi de diseno ya renormaliza a n

  expect_true(all(is.finite(ctx$pi_marco) & ctx$pi_marco >= 0 & ctx$pi_marco <= 1))
})

test_that("sin olas de reemplazo el MC ya estima bien la pi del titular (contra-caso)", {
  # Este es el regimen donde "aparecer en el plan" y "salir titular" coinciden,
  # y donde la suite historica vive. Debe quedar verde ANTES y DESPUES del fix:
  # lo que se corrige es el DOMINIO del conteo, no el estimador. El invariante de
  # suma es el MISMO -no se relaja por ser contra-caso-: 55.000000 medido.
  ctx <- .mc_grano_ctx_sin_olas()
  df <- .mc_grano_seleccion("sel_sin_olas", ctx)
  tit <- df[df$sample_role == "titular", , drop = FALSE]
  d <- .mc_grano_desvios(ctx)

  expect_equal(nrow(tit), 55L)
  expect_false("chain_reserve" %in% df$sample_role) # sin olas: solo titulares

  expect_true(d$cuota_alcanzable)
  expect_lt(abs(d$global), .MC_GRANO_TOL)
  expect_lt(max(abs(d$estratos)), .MC_GRANO_TOL)
  expect_equal(sum(ctx$pi_marco >= .MC_GRANO_UNO), 0L)
  expect_true(all(is.finite(tit$pi_mc) & tit$pi_mc > 0))

  # Y el peso que sale de ahi discrimina entre aulas, que es para lo que existe.
  expect_true(all(is.finite(tit$weight_classroom) & tit$weight_classroom > 1))
  expect_gt(stats::sd(tit$weight_classroom), 0)
})

test_that("con un estrato saturado pi = 1 es LEGITIMO y el invariante de suma se cumple igual", {
  # El caso que impide que un fix futuro degenere en "prohibir pi = 1". FAC1 tiene
  # 3 aulas de 20 alumnos y FAC2 doce de 5: la cuota, proporcional a la masa de
  # elegibles, reparte 3 y 3 sobre n = 6. FAC1 queda SATURADA (cuota_h = N_h = 3)
  # y sus 3 aulas entran con certeza en toda corrida -> pi = 1 correcta. La suma
  # sigue valiendo: 3 unos suman 3 = cuota_h. En el marco real medido hay 20 de
  # 119 aulas en esta situacion, asi que no es un caso de laboratorio.
  # 15 aulas bastan para demostrarlo: no hace falta pagar el marco de 119.
  ctx <- .mc_grano_ctx("saturado", .mc_grano_base_mixta(list(
    list(facultad = "FAC1", aulas = 3L, por_aula = 20L),
    list(facultad = "FAC2", aulas = 12L, por_aula = 5L)
  )), .mc_grano_cfg(6L, 5L))
  af <- ctx$aula_frame
  d <- .mc_grano_desvios(ctx)

  # Precondiciones del escenario: un estrato saturado y otro lejos de saturar.
  expect_equal(nrow(af), 15L)
  expect_equal(ctx$n, 6L)
  expect_equal(as.integer(ctx$cuotas[["FAC1"]]), 3L)
  expect_equal(sum(af$stratum == "FAC1"), 3L)    # cuota_h = N_h -> saturado
  expect_equal(as.integer(ctx$cuotas[["FAC2"]]), 3L)
  expect_equal(sum(af$stratum == "FAC2"), 12L)   # 3 de 12 -> pi muy lejos de 1

  # La certeza es exactamente la que el diseno concede: ni una aula mas.
  expect_equal(sum(ctx$pi_marco >= .MC_GRANO_UNO), 3L)
  expect_true(all(ctx$pi_marco[af$stratum == "FAC1"] >= .MC_GRANO_UNO))
  expect_true(all(ctx$pi_marco[af$stratum == "FAC2"] < .MC_GRANO_UNO))

  # Y el invariante se cumple con las certezas dentro (6.0000 medido). Con el
  # dominio viejo esta misma suma daba 15.0000, el marco entero.
  expect_true(d$cuota_alcanzable)
  expect_lt(abs(d$global), .MC_GRANO_TOL)
  expect_lt(max(abs(d$estratos)), .MC_GRANO_TOL)

  # El consumidor: un titular de estrato saturado pesa 1 con todo derecho, y los
  # demas pesan mas. Prohibir el peso 1 romperia esta certeza legitima.
  df <- .mc_grano_seleccion("sel_saturado", ctx)
  tit <- df[df$sample_role == "titular", , drop = FALSE]
  expect_equal(nrow(tit), 6L)
  expect_lt(max(abs(tit$weight_classroom - 1 / tit$pi_final)), 1e-6)
  expect_true(all(tit$weight_classroom[tit$stratum == "FAC1"] == 1))
  expect_true(all(tit$weight_classroom[tit$stratum == "FAC2"] > 1))
})

test_that("en censo (n >= N) toda pi vale 1, suma N y sigue siendo legitimo", {
  # Caso limite del anterior: el marco entero es la muestra. n_aulas = 20 pedido
  # sobre N = 12 -> el sorteo capa n a 12 y cada estrato queda saturado, asi que
  # las 12 pi valen 1 y suman 12 = N = n. Aqui el dominio viejo NO discrimina
  # (sin aulas fuera de la muestra, "titular" y "no es extra_reserve_pool" son el
  # mismo conjunto: 12 y 12): el test no esta para atrapar ESE bug sino para que
  # un fix que "arregle" pi = 1 prohibiendola no pase por aqui.
  ctx <- .mc_grano_ctx("censo", .mc_grano_base_mixta(list(
    list(facultad = "FAC1", aulas = 4L, por_aula = 4L),
    list(facultad = "FAC2", aulas = 4L, por_aula = 4L),
    list(facultad = "FAC3", aulas = 4L, por_aula = 4L)
  )), .mc_grano_cfg(20L, 5L))
  af <- ctx$aula_frame
  d <- .mc_grano_desvios(ctx)

  expect_equal(nrow(af), 12L)
  expect_equal(ctx$n, 12L)                       # n_aulas = 20 capado al marco
  expect_equal(sum(ctx$cuotas), 12L)
  expect_true(all(as.integer(ctx$cuotas) == 4L)) # los 3 estratos saturados

  expect_equal(sum(ctx$pi_marco >= .MC_GRANO_UNO), 12L)
  expect_true(all(ctx$pi_marco == 1))
  expect_lt(abs(d$global), .MC_GRANO_TOL)
  expect_lt(max(abs(d$estratos)), .MC_GRANO_TOL)
  expect_equal(ctx$mc$error, 0)                  # sin varianza: no hay azar que simular

  # Sin aulas fuera de la muestra no queda nada que reservar: el plan de olas es
  # solo M1 aunque se pidieran 5 olas. Es la precondicion que explica por que
  # este caso no separa los dos dominios de conteo.
  df <- .mc_grano_seleccion("sel_censo", ctx)
  expect_false("chain_reserve" %in% df$sample_role)
  tit <- df[df$sample_role == "titular", , drop = FALSE]
  expect_equal(nrow(tit), 12L)
  expect_true(all(tit$pi_final == 1))
  expect_true(all(tit$weight_classroom == 1))    # peso 1 legitimo: nadie representa a nadie mas
})
