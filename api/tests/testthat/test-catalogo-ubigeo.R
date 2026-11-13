# Catálogo nacional de ubigeos y su motor compartido (catalogo_ubigeo.R).
#
# Tabla: inst/catalogos/ubigeo_peru.csv.gz, del WFS de la IDE del INEI
# (build_ubigeo_peru.R). Grano: un distrito por fila.

test_that("la tabla del INEI trae los 1,890 distritos, 196 provincias y 25 departamentos, sin huecos", {
  cat <- catalogo_ubigeo_cargar()
  t <- cat$tabla
  expect_identical(names(t), c("ubigeo", "departamento", "provincia", "distrito"))
  expect_identical(nrow(t), 1890L)
  expect_identical(length(unique(substr(t$ubigeo, 1, 4))), 196L)
  expect_identical(length(unique(substr(t$ubigeo, 1, 2))), 25L)
  expect_true(all(grepl("^[0-9]{6}$", t$ubigeo)))
  expect_false(anyDuplicated(t$ubigeo) > 0)
  # Un mismo código de provincia no tiene dos nombres (las capas calzan).
  expect_identical(nrow(unique(data.frame(c = substr(t$ubigeo, 1, 4), p = t$provincia))), 196L)
  meta <- cat$meta
  expect_match(meta$fuente, "INEI")
  expect_match(meta$urls$distrito, "^https://geoespacial.inei.gob.pe/")
  expect_identical(as.integer(meta$n_distritos), 1890L)
})

test_that("coincide con los 164 distritos que ya usa Hojas de ruta (CPV 2025 y nomenclátor 2017)", {
  cat <- catalogo_ubigeo_cargar()
  dir <- system.file("hojas_ruta", package = "prosecnurapp")
  terr <- jsonlite::read_json(file.path(dir, "territorios.json"))
  u <- unique(unlist(lapply(terr$provincias, function(p) unlist(p$distritos))))
  expect_identical(length(u), 164L)
  expect_length(setdiff(u, cat$tabla$ubigeo), 0L)
  n17 <- rbind(
    utils::read.csv(file.path(dir, "inei2017_lima_callao_edad_simple_distrito.csv"), colClasses = "character")[, 1:4],
    utils::read.csv(gzfile(file.path(dir, "inei2017_ciudades_edad_simple_distrito.csv.gz")), colClasses = "character")[, 1:4]
  )
  n17 <- unique(n17)
  j <- merge(n17, cat$tabla, by = "ubigeo", suffixes = c("_17", ""))
  expect_identical(nrow(j), nrow(n17))
  for (nv in c("departamento", "provincia", "distrito")) {
    expect_identical(catalogo_ubigeo_normalizar(j[[paste0(nv, "_17")]]), catalogo_ubigeo_normalizar(j[[nv]]))
  }
})

test_that("normaliza tildes, mayúsculas, ñ, puntuación y espacios", {
  expect_identical(catalogo_ubigeo_normalizar(c("Cañete", " san  martín de PORRES. ", "Jesús-María", "", NA, "NA")),
                   c("CANETE", "SAN MARTIN DE PORRES", "JESUS MARIA", NA, NA, NA))
  r <- catalogo_ubigeo_resolver(c("Rímac", "Breña", "BRENA", "Cuñumbuqui", "COMAs"), "distrito")
  expect_identical(r$estado, c("exacto", "exacto", "exacto", "exacto", "empate"))
  # "COMAs" se reconoce, pero hay un Comas en Lima y otro en Junín.
  expect_setequal(unlist(r$entidades[5]), c("150110", "120206"))
})

test_that("el artículo inicial es opcional solo sin ambigüedad", {
  r <- catalogo_ubigeo_resolver(c("EL RIMAC", "BANDA DE SHILCAYO", "LA LOS OLIVOS"), "distrito")
  expect_identical(r$estado[1:2], c("sin_articulo", "sin_articulo"))
  expect_identical(unlist(r$entidades[1]), "150128")
  expect_identical(unlist(r$entidades[2]), "220909")
  # Un catálogo donde "PORVENIR" y "EL PORVENIR" son distritos distintos: sin
  # artículo, "LA PORVENIR" no puede elegir y no se reconoce.
  propio <- catalogo_ubigeo_desde_tabla(data.frame(
    ubigeo = c("01", "02", "03"), departamento = "A", provincia = "B",
    distrito = c("EL PORVENIR", "PORVENIR", "OTRO")))
  r2 <- catalogo_ubigeo_resolver(c("LA PORVENIR", "PORVENIR", "EL PORVENIR"), "distrito", propio)
  expect_identical(r2$estado, c("no_reconocido", "exacto", "exacto"))
})

test_that("informa empates y el nombre escrito en otro nivel; ninguno se descarta", {
  r <- catalogo_ubigeo_resolver(c("SANTIAGO", "CHICLAYO", "AV COSTANERA", ""), "distrito")
  expect_identical(r$estado[1], "empate")
  expect_identical(r$n_entidades[1], 2L)
  expect_match(r$causa[1], "Santiago \\(Cusco, Cusco\\); Santiago \\(Ica, Ica\\)")
  expect_identical(r$estado[2], "exacto")
  expect_identical(r$estado[3], "no_reconocido")
  expect_identical(r$causa[3], "Nombre no reconocido: \"AV COSTANERA\"")
  expect_identical(r$estado[4], "vacio")
  d <- catalogo_ubigeo_resolver("CHICLAYO", "departamento")
  expect_identical(d$estado, "otro_nivel")
  expect_identical(d$causa, "Chiclayo, escrito como departamento, es una provincia de Lambayeque")
  u <- catalogo_ubigeo_resolver(c("80101", "080101", "999999", "SJM"), "ubigeo")
  expect_identical(u$estado, c("sin_cero", "exacto", "no_reconocido", "no_reconocido"))
})

test_that("revisa la pertenencia distrito, provincia y departamento con la causa por caso", {
  r <- catalogo_ubigeo_revisar(list(
    departamento = c("PIURA", "LIMA", "LIMA", "LIMA", NA, "CHICLAYO"),
    provincia = c("SULLANA", "LIMA", "CALLAO", "LIMA", NA, "CHICLAYO"),
    distrito = c("LOS OLIVOS", "COMAS", "VENTANILLA", "AV COSTANERA", NA, "CHICLAYO")))
  expect_identical(r$estado, c("error", "ok", "error", "no_reconocido", "sin_datos", "error"))
  expect_identical(r$marca, c(TRUE, FALSE, TRUE, TRUE, FALSE, TRUE))
  expect_identical(r$causa[1], "Los Olivos no es un distrito de Sullana (Piura)")
  expect_identical(r$causa[3], "Callao no es una provincia de Lima")
  expect_identical(r$causa[4], "Nombre no reconocido: \"AV COSTANERA\"")
  expect_identical(r$causa[6], "Chiclayo, escrito como departamento, es una provincia de Lambayeque")
  # Candidatos: el lugar que de verdad contiene al más chico; nunca se aplican.
  c1 <- r$candidatos[[1]]
  expect_identical(vapply(c1, `[[`, "", "rol"), "provincia")
  expect_identical(c1[[1]]$valor, "Lima")
  expect_identical(c1[[1]]$causa, "Los Olivos está en ese lugar")
  c6 <- r$candidatos[[6]]
  expect_identical(c6[[1]]$rol, "departamento")
  expect_identical(c6[[1]]$valor, "Lambayeque")
  # Sin candidato: a investigar.
  expect_identical(r$a_investigar, c(FALSE, FALSE, FALSE, TRUE, FALSE, FALSE))
})

test_that("compara el ubigeo con el nombre y propone el candidato por el código", {
  r <- catalogo_ubigeo_revisar(list(
    ubigeo = c("150133", "80101", "999999", "150110", NA, "150132"),
    distrito = c("COMAS", "CUSCO", "COMAS", NA, "SJM", "SJL")))
  expect_identical(r$estado, c("error", "ok", "no_reconocido", "incompleto", "incompleto", "ok"))
  expect_identical(r$causa[1], "Ubigeo 150133 corresponde a San Juan de Miraflores (Lima, Lima), no a Comas")
  expect_identical(r$causa[3], "Ubigeo no reconocido: \"999999\"")
  expect_identical(unlist(r$notas[[2]]), "Ubigeo escrito sin el cero inicial (080101)")
  # Error código-nombre: el distrito por el código y el código por el distrito
  # (Comas existe en Lima y en Junín: empate, van los dos).
  c1 <- r$candidatos[[1]]
  expect_identical(c1[[1]]$valor, "San Juan de Miraflores")
  expect_identical(c1[[1]]$causa, "por el ubigeo 150133")
  expect_setequal(vapply(c1[-1], `[[`, "", "valor"), c("150110", "120206"))
  # Incompleto: el papel vacío se completa con el lugar resuelto.
  expect_identical(r$candidatos[[4]][[1]]$valor, "Comas")
  expect_identical(r$candidatos[[4]][[1]]$causa, "por el ubigeo 150110")
  expect_identical(r$candidatos[[5]][[1]]$valor, "150133")
  expect_false(any(r$marca[4:5]))
  marcados <- catalogo_ubigeo_revisar(list(ubigeo = c("150110", NA), distrito = c(NA, "SJM")), marcar_incompletos = TRUE)
  expect_identical(marcados$marca, c(TRUE, TRUE))
  # Un candidato trae la entidad completa para reemplazar todas las columnas.
  e <- r$candidatos[[1]][[1]]$entidad
  expect_identical(e, list(ubigeo = "150133", departamento = "Lima", provincia = "Lima",
                           distrito = "San Juan de Miraflores"))
})

test_that("un nombre mal escrito tiene candidato parecido; en empate van todos", {
  r <- catalogo_ubigeo_revisar(list(provincia = c("CUSCO", "LAMAS", "LIMA"),
                                    distrito = c("SAN GERONIMO", "CUNIMBUQUE", "XQZ")))
  expect_identical(r$estado, c("no_reconocido", "no_reconocido", "no_reconocido"))
  expect_identical(r$candidatos[[1]][[1]]$valor, "San Jeronimo")
  expect_identical(r$candidatos[[1]][[1]]$entidad$ubigeo, "080104")
  expect_identical(r$candidatos[[1]][[1]]$causa, "nombre parecido")
  expect_identical(r$candidatos[[2]][[1]]$valor, "Cuñumbuqui")
  expect_true(r$a_investigar[3])
  # Con un ubigeo que apunta a otro lugar (otra numeración), van los dos
  # candidatos: el lugar del código y el nombre parecido.
  u <- catalogo_ubigeo_revisar(list(ubigeo = "210305", distrito = "CUÑUMBUQUE"))
  causas <- vapply(u$candidatos[[1]], `[[`, "", "causa")
  valores <- vapply(u$candidatos[[1]], `[[`, "", "valor")
  expect_identical(valores[causas == "por el ubigeo 210305"], "Corani")
  expect_identical(valores[causas == "nombre parecido"], "Cuñumbuqui")
  # Sin provincia, "SAN GERONIMO" está a un cambio de tres San Jerónimo: empate.
  e <- catalogo_ubigeo_revisar(list(departamento = "PERU X", distrito = "SAN GERONIMO"))
  expect_gte(length(Filter(function(c) c$rol == "distrito", e$candidatos[[1]])), 3L)
})

test_that("lo omitido se cuenta aparte y no se marca", {
  r <- catalogo_ubigeo_revisar(list(departamento = c("VENEZUELA", "venezuela", "LIMA"),
                                    provincia = c("CARACAS", "X", "LIMA"),
                                    distrito = c("LOS TEQUES", "Y", "NO RECUERDA")),
                               omitir = c("Venezuela", "No recuerda"))
  expect_identical(r$estado, c("omitido", "omitido", "omitido"))
  expect_false(any(r$marca))
})

test_that("propone los papeles por contenido, con nombres de columna arbitrarios y varios grupos", {
  set.seed(1)
  n <- 60
  nac <- data.frame(d = c("LIMA", "CUSCO", "SAN MARTIN", "LORETO"), p = c("LIMA", "CUSCO", "SAN MARTIN", "MAYNAS"),
                    t = c("COMAS", "WANCHAQ", "MORALES", "IQUITOS"), stringsAsFactors = FALSE)
  dom <- data.frame(u = c("150110", "80108", "220910", "150128"), t = c("COMAS", "WANCHAQ", "MORALES", "RIMAC"),
                    stringsAsFactors = FALSE)
  i <- sample(4, n, TRUE); j <- sample(4, n, TRUE)
  datos <- data.frame(
    zz_9 = dom$t[j], col_a = nac$d[i], otra = sample(c("si", "no"), n, TRUE), q17 = nac$t[i],
    xyz = nac$p[i], k = dom$u[j], stringsAsFactors = FALSE)
  pr <- catalogo_ubigeo_proponer_roles(datos)
  expect_identical(pr$propuesta, list(departamento = "col_a", provincia = "xyz", distrito = "q17", ubigeo = NA_character_))
  expect_length(pr$propuestas, 2L)
  expect_identical(pr$propuestas[[2]]$roles, list(departamento = NA_character_, provincia = NA_character_,
                                                  distrito = "zz_9", ubigeo = "k"))
  partes <- stats::setNames(lapply(pr$columnas, `[[`, "parte"), vapply(pr$columnas, `[[`, "", "columna"))
  expect_false("otra" %in% names(partes))
  expect_equal(partes$k$ubigeo, 1)
  # El nombre de la columna no decide: renombradas, la propuesta sigue al contenido.
  names(datos) <- c("distrito", "ubigeo", "departamento", "provincia", "region", "nombre")
  pr2 <- catalogo_ubigeo_proponer_roles(datos)
  expect_identical(pr2$propuesta, list(departamento = "ubigeo", provincia = "region", distrito = "provincia",
                                       ubigeo = NA_character_))
})

test_that("busca por texto con la ruta completa y recorre en cascada", {
  b <- catalogo_ubigeo_buscar("olivos", nivel = "distrito")
  expect_identical(b[[1]]$ruta, "Los Olivos (Lima, Lima)")
  expect_identical(b[[1]]$ubigeo, "150117")
  todos <- catalogo_ubigeo_buscar("cusco")
  expect_identical(vapply(todos, `[[`, "", "nivel")[1:3], c("distrito", "provincia", "departamento"))
  expect_identical(catalogo_ubigeo_buscar("1501", limite = 3L)[[1]]$ubigeo, "150101")
  expect_length(catalogo_ubigeo_buscar(""), 0L)
  deps <- catalogo_ubigeo_cascada()
  expect_identical(deps$nivel, "departamento")
  expect_length(deps$items, 25L)
  provs <- catalogo_ubigeo_cascada("San Martín")
  expect_identical(provs$nivel, "provincia")
  expect_length(provs$items, 10L)
  dists <- catalogo_ubigeo_cascada("lima", "lima")
  expect_length(dists$items, 43L)
  expect_error(catalogo_ubigeo_cascada("Narnia"), class = "api_error")
})

test_that("otro catálogo se pasa como parámetro y uno desconocido falla con su causa", {
  propio <- catalogo_ubigeo_desde_tabla(data.frame(
    ubigeo = c("A1", "A2", "B1"), departamento = c("NORTE", "NORTE", "SUR"),
    provincia = c("UNO", "UNO", "DOS"), distrito = c("ALFA", "BETA", "GAMMA")), id = "ficticio")
  r <- catalogo_ubigeo_revisar(list(provincia = c("UNO", "DOS"), distrito = c("ALFA", "ALFA")), propio)
  expect_identical(r$estado, c("ok", "error"))
  expect_identical(r$causa[2], "Alfa no es un distrito de Dos (Sur)")
  err <- tryCatch(catalogo_ubigeo_cargar("narnia"), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_REGLA_INVALIDA")
})
