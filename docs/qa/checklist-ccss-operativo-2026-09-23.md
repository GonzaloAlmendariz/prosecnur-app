# Checklist — CCSS Perfil 2026-II: composición por nivel, Sheets y UI listos (2026-09-23)

Pedido de Gonzalo, 2026-09-23 (tras el avance del 22/09):

> «la app no sabe cuántos alumnos de cada nivel hay en las aulas agendadas», pero
> podría saberlo, no hay nada que lo impida. Veamos eso. Dejemos los Sheets
> listos para que Traer respuestas los lea y publique también, y dejemos la UI de
> Monitoreo lista para poder abrir el archivo .pulso desde hoy y actualizar la
> data en la app y en los Sheets desde allí también.

Proyecto: `CCSSPerfil/4. Seleccion/CCSS2026_campo_MARTES_22-09.pulso` → desde hoy se abre `CCSS2026_campo_MIERCOLES_23-09.pulso` (el del 22/09 + composición por nivel; el original intacto).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | La app sabe cuántos alumnos de cada nivel hay en cada curso-horario (y proyecta por nivel lo agendado) | marco: `level_composition` por aula (`calc_muestra_aulas_composicion_nivel.R`, tras el sello) → plan (`normalize_plan`) → proyector de Metas (`monitoreo_aulas_composicion_eje.R`) · CCSS: respaldo en copia nueva del `.pulso` | hecho `59be4529` — Metas proyecta por nivel y el banco busca por composición; CCSS con la composición en `CCSS2026_campo_MIERCOLES_23-09.pulso` |
| 2 | Los Sheets quedan listos: «Traer respuestas» los lee y publica | config de aulas del `.pulso` (libro destino, agenda del equipo, Kobo) + secretos locales | verificado sin publicar: libro `1whv…` recordado, 5 pestañas se leen sin fallos, Google y Kobo (`pulsoeu`) abren |
| 3 | La UI de Monitoreo queda lista para abrir el `.pulso` y actualizar app + Sheets desde allí | build del front (`api/inst/www`) + paquete R instalado (los jobs `callr` usan el instalado) + recorrido real | hecho — front compilado; paquete reinstalado 09:29 con `59be4529`; el `.pulso` de hoy abre en la app |
| 4 | Distribución de aplicadores hasta el 5/10, con los 5 aplicadores alrededor de 10 aplicaciones cada uno | reparto (`monitoreo_aulas_reparto.R`) + `reparto_rango` del `.pulso` + Sheets «Distribución de aplicaciones» (`1bsx…`, una pestaña por semana) | hecho — publicado 23/09 con el go de Gonzalo (asignación manual intacta): «Semana 2» 28/09–02/10 (37 filas) y «Semana 3» 05–09/10 (32); «Semana 1» idéntica. `6be802f6` (equidad) y `62587c34` (una fila suelta del 28/09 en «Semana 1» se tragaba la semana 2). Respaldo previo en el scratchpad de la sesión |

## Notas de investigación

### Ítem 1
- El `.pulso` NO trae la base de matrícula (solo `state.rds`).
- `aula_frame$unique_student_ids` existe para las 136 aulas del plan, pero con
  `student_ids_policy = "subrogados_sin_mapa"` (F114): enteros densos sin mapa.
  Cruzados con el padrón dan 0 coincidencias.
- El padrón en sesión: 1.354 filas `{codigo, nivel, carrera, sexo}`.
- El proyector acumula esperadas por `(facultad del plan, sexo)`; las celdas del
  eje (`grano = "eje"`, faculty = nivel) no casan con ninguna fila → `previsto`
  NA y `aporte_pendiente` 0. La frase «si hace falta aula adicional se lee en
  Metas» (a4f31c70) promete una proyección que Metas no tiene todavía.
- ADR 0089 dice de dónde salen los códigos reales: hojas `Data` + `Excluidos`
  de `3. Marco muestral/CCSS2026_base_alumnos_marco_07_09_26.xlsx` (juntas
  127.791 filas), elegibilidad según `config$criterios_seleccion`
  (`CONDICION_MATRICULA` en blanco cuenta; `CONDICION` es la beca, no filtrar).

### Ítem 1 — resuelto así (2026-09-23)
- No hacían falta los códigos reales (ADR 0089): basta el CONTEO por nivel de
  cada aula, que no identifica a nadie, igual que `sex_top_*_n`.
- Se calcula en el constructor del marco DESPUÉS de `frame_hash_estable`
  (misma regla que la efectividad): no cambia la firma de ningún estudio.
- CCSS: marco reconstruido desde `Data` + `Excluidos` (127.791 filas): las 4.596
  aulas con el mismo `eligible_n` y composición que suma `eligible_n` en todas;
  las 136 del plan idénticas nivel a nivel a `5. Campo/CCSS2026_elegibles_por_aula_22-09.xlsx`
  (reconstrucción independiente del 22/09). El hash del marco NO coincide
  (2f25… vs 2b5c…) pese a eso: por eso la composición se inyecta en el `.pulso`
  y NO se reemplaza el marco.
- Metas al cierre del 22/09 (τ 0,50): nivel 6 108/119 con lo agendado, 7 156/122,
  8 86/97, **9 30/62 y 55/62 aun con todo el plan** → el 9 necesita reservas o
  aulas adicionales de nivel 9.

### Ítem 2 — notas
- «Traer respuestas» = job de fuentes (Kobo) → `/api/monitoreo/aulas/sync` →
  `monitoreo_aulas_conversar_libro()`: LEE las hojas del equipo y REPUBLICA las
  de la app. La distribución de aplicadores es otro flujo y no entra.
- La agenda del equipo no trae `program`: no pisa el plan (la carrera sale del
  plan). Las 85 reservas salen «sin cadena» en la hoja porque no lleva la
  columna del titular; la cadena vive en el plan.
- Secretos: `koboeu` y `perfil_unhcr` bloqueados (cambio de red del 08/09), pero
  CCSS usa `pulsoeu`, que abre.

### Ítem 4 — notas
- Pedido (2026-09-23): «la distribución hasta el 5 […] tratando de mantener que
  los 5 aplicadores tengan alrededor de 10 aplicaciones».
- Defecto encontrado: la disponibilidad guarda el nombre crudo (MAYÚSCULAS) y
  las fijadas adoptadas del Sheets vuelven normalizadas; la equidad las tomaba
  por aplicadores externos (10 en vez de 5). Arreglado en `6be802f6`.
- Con el rango al 05/10, por aplicador (asignadas con fecha desde el 22/09 +
  fijadas sin fecha): Chamorro 7+1=8 · Chávez 3+4=7 · Cruzado 5+4=9 ·
  Simón 5+3=8 · Uribe 5+6=11. Total 43.
- La disponibilidad NO explica a Chávez (libre salvo martes tarde): el
  desbalance viene de las fijadas del equipo y de que después del 25/09 sólo hay
  8 citas agendadas (28/09: 5 · 29/09: 2 · 05/10: 1). Las titulares sin fecha
  irán, al agendarse, al aplicador con menos carga.
- Publicar a la distribución exige el go explícito de Gonzalo (regla del
  operativo); lo manual del equipo manda y publicar no lo pisa.
