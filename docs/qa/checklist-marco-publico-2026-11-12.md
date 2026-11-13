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
| 10 | Fase 6: cruce de dos columnas de una base, con los vacíos como "Sin dato" | `calc_muestra_segmentos.R` (`calc_muestra_segmento_cruce`) | Hecho |
| 11 | Fase 6: tabla de conteos del cliente: termina en la primera fila vacía, reconoce Total, % y Meta (y las columnas suma o proporción) como calculadas, quita la fila Total y avisa si no cuadra | `calc_muestra_conteos_leer` | Hecho |
| 12 | Fase 6: grupos de celdas (D7): cada celda a un grupo, las que quedan sin grupo se publican, una celda en dos grupos es un error | `calc_muestra_segmento_agrupar` | Hecho |
| 13 | Fase 6: cuotas (D8) por celda, con la segunda variable como control o con mínimo por celda sumado encima; celdas chicas y margen por fila | `calc_muestra_cuotas_cruce` | Hecho |
| 14 | Fase 6: rutas `POST /api/calc-muestra/marco-publico/cruce` y `/conteos` | `router_calc_muestra_marco_publico.R` | Hecho |
| 15 | Rótulos en minúscula con tilde y corregibles ("EDUCACION" a "Educación") | Pendiente de diseño: necesita las correcciones del usuario, no un diccionario fijo | Pendiente |
| 16 | Secciones en el orden del trabajo: Actores, Marco, Meta, Contexto, Selección, Resultados (pedido del 2026-11-12) | `lib/modules.ts`, `general/railAcreditacion.ts`, `MesaAcreditacion.tsx` | Hecho |
| 17 | Actores: nombre propio de cada público (antes el de la categoría: posgrado salía como "Estudiantes pregrado") y canal | `ActoresAcreditacion.tsx`, `catalogos.ts` (`actorVisual`) | Hecho |
| 18 | Marco: recorrido de cuatro pasos sobre la base y marco guardado con su receta; sin base, la población se escribe a mano | `MarcoAcreditacion.tsx`, `marcoPublico/` | Hecho |
| 19 | Meta: población del marco, respuesta esperada, meta, margen editable y respuesta que exige, con las propuestas A, B y C | `MetaAcreditacion.tsx` | Hecho |
| 20 | Cuotas en pantalla: en Meta, la meta de un actor con base se reparte por sus segmentos, con una segunda variable opcional, por celda, con control o con mínimo de 10 | `RepartoAcreditacion.tsx`, ruta `/marco-publico/cuotas` | Hecho |
| 21 | Tabla de conteos como fuente del marco en pantalla (un actor sin base por persona, como pregrado en el DCI) | Marco, paso Archivo | Pendiente |

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

Fase 6, sobre la misma base real (facultad por sexo): las cuotas por celda, con control y con mínimo reproducen las
cifras del prototipo para las tres propuestas (celdas con menos de 10, margen de la facultad más chica y encuestas que
suma el mínimo). La tabla de conteos del resumen del estudio se lee con sus columnas Total, % y Meta reconocidas como
calculadas y sin avisos. Pruebas: `test-calc-muestra-segmentos.R` (46 comprobaciones) y el gate del área (1,069 pasan,
0 fallan).

Secciones (2026-11-12): recorrido completo sobre la base real de docentes en la app (1440x1000 y 1024x600): archivo y hoja
reconocidos, usos por columna, una regla de exclusión, cruce de dos columnas con un grupo nuevo y marco guardado; el actor
queda con su población desde la base y sus segmentos, y Meta la lee. `make gate-front AREA=calcMuestra`: solo falla el
contrato de comillas por un archivo de Validación de otra sesión.
