# Rótulos humanos de las claves de dominio que publica el reporte de Cálculo de
# muestra (L28 del loop de mejoras, 2026-09-27). El reporte imprimía las claves
# tal cual —«prob_estratificado», «estudio_propio»,
# «representatividad_estadistica»— en un documento que va al cliente. Los
# rótulos de técnica son los de la mesa (general/catalogos.ts) para que el
# reporte diga lo mismo que la pantalla. Viajan en el bundle: la plantilla
# Quarto no llama funciones internas del paquete.

.cm_reporte_rotulos <- function() {
  list(
    tecnica = c(
      prob_aleatorio_simple = "Probabilístico clásico",
      prob_estratificado = "Estratificado",
      prob_estratificado_independiente = "Dominios independientes",
      sistematico = "Sistemático",
      prob_conglomerado_multietapico = "Por conglomerados",
      intencion_censal = "Cobertura censal",
      barrido = "Barrido operativo",
      no_prob_cuotas = "Cuotas controladas",
      no_prob_conveniencia = "Conveniencia con pisos",
      medicion_recurrente = "Medición recurrente",
      listado_externo_meta_fija = "Listado externo con meta fija"
    ),
    naturaleza = c(prob = "Probabilística", no_prob = "No probabilística", operativo = "Operativa"),
    origen_tamano = c(
      formula = "Fórmula", meta_contractual = "Meta contractual",
      cobertura_esperada = "Cobertura esperada",
      matriz_perfiles_cualitativa = "Matriz de perfiles"
    ),
    nivel_respaldo = c(
      representatividad_estadistica = "Representatividad estadística",
      representatividad_operacional = "Representatividad operacional",
      representatividad_teorica_controlada = "Representatividad teórica controlada",
      cobertura_balanceada = "Cobertura balanceada",
      evidencia_descriptiva = "Evidencia descriptiva"
    ),
    macro_familia = c(
      acreditacion = "Acreditación", encuesta_estudiantes = "Encuesta a estudiantes",
      hsvg_universitario = "Hostigamiento sexual universitario", territorial = "Territorial",
      listado_telefonico = "Listado telefónico", linea_base_servicios = "Línea de base de servicios",
      estudio_propio = "Estudio propio"
    ),
    estado_marco = c(
      no_definido = "no definido", bruto = "bruto", validado = "validado",
      contactable = "contactable", listado_externo = "listado externo", operativo = "operativo"
    )
  )
}
