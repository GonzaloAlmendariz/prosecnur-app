# Un plan de prueba con un titular y sus reservas.
#
# Vive en un helper porque lo usan varios archivos de test del libro: tenerlo en
# uno de ellos obligaba a copiarlo al escribir el siguiente, y una copia de un
# fixture se separa igual que una copia de codigo.
.libro_de_prueba <- function(n_reservas = 2L) {
  titular <- list(
    operational_code = "CH 1", titular_operational_code = "CH 1",
    sample_role = "titular", faculty = "Letras y Ciencias Humanas",
    course_name = "HISTORIA Y TEORIA DE LA ARQUITECTURA CONTEMPORANEA",
    teacher = "Docente CH 1", eligible_n = 40, scheduled_date = "2026-08-11"
  )
  reservas <- lapply(seq_len(n_reservas), function(i) list(
    operational_code = sprintf("R 1.%d", i), titular_operational_code = "CH 1",
    sample_role = "chain_reserve", replacement_order = i,
    faculty = "Letras y Ciencias Humanas", course_name = "CURSO DE RESERVA",
    eligible_n = 30
  ))
  c(list(titular), reservas)
}
