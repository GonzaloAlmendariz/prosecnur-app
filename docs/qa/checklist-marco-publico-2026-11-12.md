# Checklist: motor del marco de un público (fase 5 del rediseño de Cálculo de muestra)

Fase 5 del expediente "Rediseño de Cálculo de muestra" (artefacto WZgqJJfGT7ASrDSigXFgVw): motor del marco
para estudios por correo o teléfono (barrido, ADR 0143). Se aprobó empezar por el motor el 2026-11-12.
Esta tanda deja el motor y sus rutas sin estado; guardar la receta del marco en el estudio entra con D6 y D7.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | CSV con punto y coma y con tildes en Latin-1 (como exporta Excel en español) | `api/R/calc_muestra_marco_publico.R` (`.cm_marco_leer_csv`), usado también por `.cm_aulas_read_table` | Hecho |
| 2 | Reconocer la hoja de datos de un libro y descartar la consulta (SQL) y las notas | `calc_muestra_marco_hojas` | Hecho |
| 3 | Perfil de columnas por contenido: tipo, valores, vacíos, distribución y uso sugerido (identificador, correo, dato personal, para cuotas, no se usa) | `calc_muestra_marco_perfil` | Hecho |
| 4 | Reglas de quién se invita: excluir valores de una columna, excluir sin correo, una sola encuesta por persona entre públicos comparando por correo; embudo con la resta de cada regla | `calc_muestra_marco_invitados` | Hecho |
| 5 | Rutas `POST /api/calc-muestra/marco-publico/leer` e `/invitados` | `api/R/router_calc_muestra_marco_publico.R`, montado en `plumber_app.R` | Hecho |
| 6 | Guardar en el estudio la receta del marco (columnas, reglas) y que viaje en el `.pulso` | Fase 7, con D6 y D7 | Pendiente |
| 7 | Asignación entre públicos (a cuál va una persona que figura en dos) | D9, acordada el 2026-11-12: el motor ya recibe el orden en `otros`; falta usarlo en la propuesta y en el listado (ítems 8 y 9) | Decidido |
| 8 | En la propuesta cada público se cuenta con su base completa y el cruce con otros públicos se dice y se muestra, sin descontarlo; si el cruce puede dejar una meta sin alcanzar, se avisa con la respuesta que exigiría | Propuesta (Resultados y PPT), fase 7 | Pendiente |
| 9 | En el listado de envío se elige, para cada par de públicos, a cuál van las personas compartidas; el listado no se descarga hasta decidir cada cruce | Selección, fase 3 | Pendiente |

## Verificación

Pruebas: `test-calc-muestra-marco-publico.R` (45 comprobaciones) y `make gate-area AREA=calc-muestra` con el patrón
`marco|encabezado|explorar|csv` más los transversales: 2,748 pasan, 0 fallan. El lector anterior leía un CSV con punto y
coma en Latin-1 como una sola columna; el nuevo lo lee con sus columnas y sus tildes.

Sobre las bases reales de un estudio de acreditación (seis libros, fuera del repo): en los seis se sugirió la hoja de
datos, con el encabezado en la fila 1, 7, 11 o 13 según el libro; las dos hojas con la consulta SQL pegada en una celda
salen como "consulta". El perfil de la base de docentes coincide con el del prototipo (identificador, correo, datos
personales, cuatro columnas para cuotas, edad y antigüedad como número). El embudo reproduce la cifra del prototipo
cuando solo un público tiene prioridad; si todos los demás públicos la tienen, los invitados de ese público bajan un 6 %.
Como el orden de prioridad cambia cuántos se invitan, D9 separa los dos momentos: en la propuesta el cruce se muestra sin descontar y la asignación se decide con el cliente en el listado de envío.
