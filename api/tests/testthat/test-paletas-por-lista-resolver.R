# ADR 0097 — la paleta de una lista se resuelve por nombre, por vínculo o por firma de opciones; la opción que no
# nombra sale gris con aviso, nunca por posición, y una escala sin paleta toma la Likert del recetario.

.pl_env <- function(paletas, vinculos = NULL) .graficos_palette_env(paletas, parent = emptyenv(), vinculos = vinculos)
.pl_avisos <- function(expr) {
  out <- character(0)
  withCallingHandlers(expr, message = function(m) { out <<- c(out, conditionMessage(m)); invokeRestart("muffleMessage") })
  out[grepl(.PULSO_AVISO_SELLO, out, fixed = TRUE)]
}
.pl_acuerdo <- list("Totalmente en desacuerdo" = "#111111", "En desacuerdo" = "#222222",
                    "De acuerdo" = "#333333", "Totalmente de acuerdo" = "#444444")

test_that("una paleta de acuerdo_4 se aplica a lst_p14 por firma, aunque cambien caja, tildes y espacios", {
  env <- .pl_env(list(acuerdo_4 = .pl_acuerdo))
  opciones <- c("TOTALMENTE en  desacuerdo", "En desacuérdo", "De Acuerdo", "Totalmente de acuerdo")
  r <- .paleta_resolver("lst_p14", opciones, env)
  expect_identical(r$origen, "firma")
  expect_identical(r$clave, "acuerdo_4")
  expect_identical(unname(r$colores[["De acuerdo"]]), "#333333")
  expect_length(r$desconocidas, 0L)
  expect_true(r$usuario)
  # Mutante: una opción de más (o de menos) ya no es la misma firma.
  expect_null(.paleta_resolver("lst_p14", c(opciones, "SIN INF"), env)$colores)
  expect_null(.paleta_resolver("lst_p14", opciones[-1], env)$colores)
})

test_that("el nombre manda sobre el vínculo y el vínculo sobre la firma", {
  otra <- stats::setNames(as.list(c("#AAAAAA", "#BBBBBB", "#CCCCCC", "#DDDDDD")), names(.pl_acuerdo))
  env <- .pl_env(list(acuerdo_4 = .pl_acuerdo, escala_cliente = otra, lst_p14 = list(Si = "#000000")),
                 vinculos = list(lst_p15 = "escala_cliente", lst_p14 = "escala_cliente"))
  # (a) nombre exacto, con plural en s.
  expect_identical(.paleta_resolver("lst_p14", names(.pl_acuerdo), env)$origen, "nombre")
  expect_identical(.paleta_resolver("lst_p14s", NULL, env)$clave, "lst_p14")
  # (b) vínculo explícito, aunque la firma calce con otra paleta.
  r <- .paleta_resolver("lst_p15", names(.pl_acuerdo), env)
  expect_identical(r$origen, "vinculo"); expect_identical(r$clave, "escala_cliente")
  expect_identical(unname(r$colores[["De acuerdo"]]), "#CCCCCC")
  # Un vínculo a una paleta que no existe no resuelve por sí solo: sigue la firma.
  env2 <- .pl_env(list(acuerdo_4 = .pl_acuerdo), vinculos = list(lst_p16 = "no_existe"))
  expect_identical(.paleta_resolver("lst_p16", names(.pl_acuerdo), env2)$origen, "firma")
})

test_that("sin nombre, vínculo ni firma no resuelve nada y el motor queda como estaba", {
  env <- .pl_env(list(acuerdo_4 = .pl_acuerdo))
  r <- .paleta_resolver("lst_ciclo", c("Quinto", "Sexto"), env)
  expect_null(r$colores); expect_null(r$origen); expect_false(r$usuario)
  expect_null(.paleta_resolver_colores("lst_ciclo", c("Quinto", "Sexto"), env))
  expect_null(.paleta_resolver("", character(0), env)$colores)
  expect_null(.paleta_resolver("lst_p14", names(.pl_acuerdo), NULL)$colores)
})

test_that("una paleta copiada de un perfil se reconoce como del perfil; editada o ampliada, es del usuario", {
  perfil <- .ppt_style_profile_acreditacion()$paletas$acuerdo_4
  env <- .pl_env(list(acuerdo_4 = perfil))
  expect_false(.paleta_resolver("acuerdo_4", NULL, env)$usuario)
  expect_false(.paleta_es_de_usuario(.paleta_resolver_colores("lst_p14", names(perfil), env)))
  # Mutante: un color cambiado la vuelve del usuario.
  editada <- perfil; editada[["De acuerdo"]] <- "#123456"
  expect_true(.paleta_resolver("acuerdo_4", NULL, .pl_env(list(acuerdo_4 = editada)))$usuario)
  # Mutante: una etiqueta de más también.
  ampliada <- c(perfil, list("SIN INF" = "#BFBFBF"))
  expect_true(.paleta_resolver("acuerdo_4", NULL, .pl_env(list(acuerdo_4 = ampliada)))$usuario)
  # Con dos firmas iguales gana la del usuario aunque la del perfil se llame antes.
  env3 <- .pl_env(list(acuerdo_4 = perfil, zz_mia = stats::setNames(as.list(rep("#0F0F0F", 4)), names(perfil))))
  expect_identical(.paleta_resolver("lst_p14", names(perfil), env3)$clave, "zz_mia")
})

test_that("los colores resueltos llevan su procedencia y el reparto por nivel la conserva", {
  env <- .pl_env(list(acuerdo_4 = .pl_acuerdo))
  pal <- .paleta_resolver_colores("lst_p14", names(.pl_acuerdo), env)
  expect_identical(attr(pal, "paleta_origen"), "firma")
  expect_identical(attr(pal, "paleta_lista"), "lst_p14")
  expect_true(.paleta_es_de_usuario(pal))
  out <- .reporte_plan_palette_for_levels("lst_p14", rev(names(.pl_acuerdo)), palette = pal)
  expect_identical(as.vector(unname(out)), c("#444444", "#333333", "#222222", "#111111"))
  expect_true(.paleta_es_de_usuario(out))
})

test_that("la opción que la paleta no nombra sale gris residual con aviso; ninguna toma color por posición", {
  pal <- c("De acuerdo" = "#333333", "En desacuerdo" = "#222222")
  av <- .pl_avisos(out <- .reporte_plan_palette_for_levels("lst_p14", c("En desacuerdo", "De acuerdo", "No sabe"), palette = pal))
  expect_identical(unname(out[["No sabe"]]), .paleta_gris_residual())
  expect_identical(.paleta_gris_residual(), "#8A93A8")
  expect_identical(unname(out[["En desacuerdo"]]), "#222222")
  expect_length(av, 1L)
  expect_match(av, "La opción «No sabe» no tiene color en la paleta de «lst_p14»", fixed = TRUE)
  # Mutante del respaldo posicional: con etiquetas ajenas, nadie hereda el color de otra por su lugar.
  av2 <- .pl_avisos(out2 <- .reporte_plan_palette_for_levels("lst_x", c("A", "B"), palette = c(Z = "#111111", Y = "#222222")))
  expect_identical(unname(out2), rep(.paleta_gris_residual(), 2))
  expect_length(av2, 2L)
  # Una paleta sin nombres no dice de quién es cada color: se trata como si no hubiera paleta.
  expect_null(.reporte_plan_palette_for_levels("lst_x", c("A", "B"), palette = c("#111111", "#222222")))
  # Sin opciones desconocidas no hay aviso.
  expect_length(.pl_avisos(.reporte_plan_palette_for_levels("lst_p14", "De acuerdo", palette = pal)), 0L)
})

test_that("una escala sin paleta toma la Likert del recetario, no la rampa que arrancaba en rojo", {
  lk <- unname(.std_paleta("likert"))
  niveles <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF")
  out <- .reporte_plan_pulso_palette_for_levels(niveles)
  expect_identical(unname(out), lk)
  # Pasos que son sólo números: la misma rampa del recetario, negativo primero.
  expect_identical(unname(.reporte_plan_pulso_palette_for_levels(c("1", "2", "3", "4"))), lk[1:4])
  expect_identical(unname(.reporte_plan_pulso_palette_for_levels(as.character(1:5))), unname(.std_paleta("likert_neutro")))
  # Con el polo negativo al final, la rampa se invierte.
  inv <- .reporte_plan_pulso_palette_for_levels(rev(niveles[1:4]))
  expect_identical(unname(inv), rev(lk[1:4]))
  # Mutante de la rampa vieja: ningún color de `approval`.
  expect_false(any(c("#CA5651", "#E4A34C", "#85BB85", "#4F8A3E") %in% out))
  # Lo que no es escala no cambia: dicotomía y categorías sin recorrido.
  expect_identical(unname(.reporte_plan_pulso_palette_for_levels(c("Sí", "No"))), c("#081F5C", "#9EC3E6"))
  expect_identical(unname(.reporte_plan_pulso_palette_for_levels(c("Lima", "Arequipa", "Cusco"))[1]), "#081F5C")
})

test_that("paletas_vinculos se normaliza como clave conocida, se guarda sólo como decisión y viaja con las paletas", {
  cfg <- .graficos_normalize_config(list(paletas = list(acuerdo_4 = .pl_acuerdo),
                                         paletas_vinculos = list(lst_p14 = "acuerdo_4", " " = "x", lst_y = "", lst_z = "lst_z")))
  expect_identical(cfg$paletas_vinculos, list(lst_p14 = "acuerdo_4"))
  expect_null(cfg$`_unknown`$paletas_vinculos)
  expect_identical(attr(cfg$paletas, "paletas_vinculos"), list(lst_p14 = "acuerdo_4"))
  # Alias camelCase del front.
  cfg2 <- .graficos_normalize_config(list(paletas = list(), paletasVinculos = list(a = "b")))
  expect_identical(cfg2$paletas_vinculos, list(a = "b"))
  expect_null(cfg2$`_unknown`$paletasVinculos)
  # Ausente = sin vínculo: la clave no se escribe y las paletas no llevan atributo.
  cfg3 <- .graficos_normalize_config(list(paletas = list(acuerdo_4 = .pl_acuerdo)))
  expect_false("paletas_vinculos" %in% names(cfg3))
  expect_null(attr(cfg3$paletas, "paletas_vinculos"))
  # El JSON del config no cambia por el atributo.
  expect_identical(as.character(jsonlite::toJSON(cfg3$paletas, auto_unbox = TRUE)),
                   as.character(jsonlite::toJSON(cfg$paletas, auto_unbox = TRUE)))
  # El worker lo recibe dentro de `paletas` (RDS) y el entorno lo usa.
  viajada <- unserialize(serialize(cfg$paletas, NULL))
  env <- .graficos_palette_env(viajada, parent = emptyenv())
  expect_identical(get(".paletas_vinculos", envir = env), list(lst_p14 = "acuerdo_4"))
  expect_identical(.paleta_resolver("lst_p14", NULL, env)$origen, "vinculo")
  expect_identical(get(".paletas_origen", envir = env), c(acuerdo_4 = "usuario"))
})
