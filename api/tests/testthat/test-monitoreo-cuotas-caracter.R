# Carácter y estado común de una cuota (ADR 0126): meta frente a referencial.

test_that("sin declaración, el carácter reproduce lo que cada perfil hace hoy", {
  # La meta 0 de telefónico hoy sale «Cumple»: sigue siendo meta.
  expect_identical(.monitoreo_cuota_caracter("", 0)$caracter, "meta")
  expect_identical(.monitoreo_cuota_caracter("", 25)$caracter, "meta")
  # Sin número no hay veredicto: referencial.
  expect_identical(.monitoreo_cuota_caracter("", NA)$caracter, "referencial")
  expect_identical(.monitoreo_cuota_caracter(NULL, NA)$caracter, "referencial")
})

test_that("lo declarado manda, y una meta sin número se muestra referencial con su aviso", {
  expect_identical(.monitoreo_cuota_caracter("referencial", 40)$caracter, "referencial")
  expect_identical(.monitoreo_cuota_caracter("META", 40)$caracter, "meta")
  sin_numero <- .monitoreo_cuota_caracter("meta", NA)
  expect_identical(sin_numero$caracter, "referencial")
  expect_match(sin_numero$aviso, "sin número")
  expect_identical(.monitoreo_cuota_caracter("meta", 0)$caracter, "referencial")
  # Un valor fuera del vocabulario cuenta como no declarado.
  expect_identical(.monitoreo_cuota_caracter("obligatoria", 10)$caracter, "meta")
})

test_that("estado común: cumple, falta, sin_base, referencial y sin_comparador", {
  estado <- .monitoreo_cuota_estado(
    caracter  = c("meta", "meta", "meta", "meta", "referencial", "referencial"),
    meta      = c(10, 10, 10, 0, 10, NA),
    efectivas = c(12, 4, 4, 0, 3, 3),
    universo  = c(50, 50, 0, 0, 40, 0)
  )
  expect_identical(estado, c("cumple", "falta", "sin_base", "cumple", "referencial", "sin_comparador"))
})

test_that("universo cero no da 0 % ni Inf: no hay comparador", {
  expect_identical(.monitoreo_cuota_estado("referencial", NA, 0, 0), "sin_comparador")
  expect_identical(.monitoreo_cuota_estado("referencial", NA, 0, NA), "sin_comparador")
})

test_that("celda vacía: referencial con universo y ninguna efectiva", {
  expect_identical(
    .monitoreo_cuota_celda_vacia(c("referencial", "referencial", "meta", "referencial"),
                                 c(0, 2, 0, 0), c(30, 30, 30, 0)),
    c(TRUE, FALSE, FALSE, FALSE)
  )
})

test_that("`caracter` sobrevive la lista blanca de goals; un valor ajeno no entra", {
  cfg <- monitoreo_normalize_config(list(goals = list(
    list(filters = list(Sede = "SJL"), meta = 40, caracter = "referencial", objetivo = "minimo"),
    list(filters = list(Sede = "SMP"), meta = 30, caracter = "obligatoria"),
    list(filters = list(Sede = "PL"), meta = 20)
  )))
  g <- cfg$goals
  expect_identical(g[[1]]$caracter, "referencial")
  expect_identical(g[[1]]$objetivo, "minimo")
  expect_null(g[[2]]$caracter)
  expect_null(g[[3]]$caracter)
  # Y vuelve a entrar igual: ida y vuelta.
  expect_identical(monitoreo_normalize_config(list(goals = g))$goals, g)
})

.tcc_phone <- function() {
  data.frame(
    Sede = c(rep("SJL", 4L), rep("SMP", 3L), rep("PL", 2L)),
    Status = c("Completa", "Completa", "Sin respuesta", "No contesta",
               "Completa", "Sin respuesta", "Sin respuesta",
               "Sin respuesta", "Sin respuesta"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

.tcc_cuotas <- function(goals) {
  phone <- .tcc_phone()
  .monitoreo_report_phone_quota_df(phone, profile = list(family = "telefonico"),
                                   cfg = list(control_vars = list("Sede"), goals = goals),
                                   effective_mask = phone$Status == "Completa")
}

.tcc_fila <- function(q, valor) q[q$Actor == "Total" & q$Valor == valor, , drop = FALSE]

test_that("telefónico sin `caracter`: Estado cuota y Brecha no cambian; se añaden carácter, fuente y estado", {
  q <- .tcc_cuotas(list(
    list(filters = list(Sede = "SJL"), meta = 2),
    list(filters = list(Sede = "SMP"), meta = 3),
    list(filters = list(Sede = "PL"), meta = 0),
    list(filters = list(Sede = "Ate"), meta = 5)
  ))
  sjl <- .tcc_fila(q, "SJL"); smp <- .tcc_fila(q, "SMP"); pl <- .tcc_fila(q, "PL"); ate <- .tcc_fila(q, "Ate")
  expect_identical(sjl$`Estado cuota`, "Cumple"); expect_identical(sjl$estado_cuota, "cumple")
  expect_identical(smp$`Estado cuota`, "Brecha"); expect_identical(smp$estado_cuota, "falta")
  expect_identical(smp$Brecha, 2L)
  # La meta 0 sigue «Cumple» y meta.
  expect_identical(pl$`Estado cuota`, "Cumple"); expect_identical(pl$Caracter, "meta")
  # Una categoría sin listado: «Sin base».
  expect_identical(ate$`Estado cuota`, "Sin base"); expect_identical(ate$estado_cuota, "sin_base")
  expect_true(all(q$Fuente[q$Actor == "Total"] == "declarada"))
})

test_that("telefónico: una cuota declarada referencial deja de juzgarse y no suma a las brechas", {
  q <- .tcc_cuotas(list(
    list(filters = list(Sede = "SJL"), meta = 2),
    list(filters = list(Sede = "SMP"), meta = 3, caracter = "referencial")
  ))
  smp <- .tcc_fila(q, "SMP")
  expect_identical(smp$Caracter, "referencial")
  expect_identical(smp$estado_cuota, "referencial")
  expect_identical(smp$`Estado cuota`, "Sin meta")
  expect_true(is.na(smp$Brecha))
  # El número pasa a `Referencia`: las tarjetas y la barra del modo leen `Meta`
  # como meta y no deben contar una referencia como piso.
  expect_true(is.na(smp$Meta))
  expect_identical(smp$Referencia, 3L)
  expect_true(is.na(.tcc_fila(q, "SJL")$Referencia))
  expect_identical(sum(grepl("brecha", q$`Estado cuota`, ignore.case = TRUE)), 0L)
})

test_that("la fila de un actor lee la meta de ESE actor, aunque una global referencial vaya antes", {
  goals <- list(
    list(filters = list(Sede = "SJL"), meta = 9, caracter = "referencial"),
    list(filters = list(Actor = "Egresados", Sede = "SJL"), meta = 2)
  )
  expect_identical(.monitoreo_cuota_goal_de_fila(goals, "Egresados", "Sede", "SJL")$meta, 2)
  expect_identical(.monitoreo_cuota_goal_de_fila(goals, "Total", "Sede", "SJL")$caracter, "referencial")
  expect_null(.monitoreo_cuota_goal_de_fila(goals, "Docentes", "Sede", "SJL"))
})

test_that("aulas: cada fila de avance_cuota publica carácter, fuente y estado común; fuera del diseño no", {
  filas <- .monitoreo_cuotas_marcar_aulas(list(
    list(facultad = "A", cuota = 10, respuestas_validas = 12, estado = "ok", fuente_fila = "diseno"),
    list(facultad = "B", cuota = 10, respuestas_validas = 4, estado = "ok", fuente_fila = "plan"),
    list(facultad = "C", cuota = 10, respuestas_validas = 0, estado = "sin_aulas_en_plan", fuente_fila = "diseno"),
    list(facultad = "D", cuota = NA, respuestas_validas = 3, estado = "sin_cuota", fuente_fila = "sin_cuota"),
    list(facultad = "E", cuota = NA, respuestas_validas = 2, estado = "fuera_del_diseno", fuente_fila = "fuera_del_diseno")
  ))
  expect_identical(vapply(filas[1:4], function(f) f$estado_cuota, ""), c("cumple", "falta", "sin_base", "sin_comparador"))
  expect_identical(vapply(filas[1:4], function(f) f$caracter, ""), c("meta", "meta", "meta", "referencial"))
  expect_identical(filas[[1]]$fuente, "declarada")
  expect_identical(filas[[2]]$fuente, "respaldo")
  expect_null(filas[[5]]$caracter)
  # El estado de siempre no cambia.
  expect_identical(filas[[3]]$estado, "sin_aulas_en_plan")
})

test_that("aulas: muestra se juzga por celda sin compensar; sobremuestra compara el total y lo declara", {
  # Total 2 600 sobre 2 500, pero una celda con brecha: la muestra NO se cumple.
  n <- .monitoreo_aulas_niveles_de_meta(2500, 3750, list(respuestas_validas = 2600, brecha = 40))
  expect_identical(vapply(n, function(x) x$nivel, ""), c("muestra", "sobremuestra"))
  expect_identical(n[[1]]$estado_cuota, "falta")
  expect_false(n[[1]]$compensa)
  expect_identical(n[[2]]$estado_cuota, "falta")
  expect_true(n[[2]]$compensa)
  expect_identical(.monitoreo_aulas_niveles_de_meta(2500, 3750, list(respuestas_validas = 3800, brecha = 0))[[2]]$estado_cuota, "cumple")
  expect_length(.monitoreo_aulas_niveles_de_meta(NA, NA, list()), 0L)
})
