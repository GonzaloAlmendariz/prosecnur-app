# Checklist — PDF de avance para cliente en estudios de aulas con metas por nivel

Tipo: Checklist de encargo
Estado: En curso
Fecha: 2026-09-28
Autoridad: Evidencia de QA; no reemplaza un ADR

Origen: encargo `CCSSPerfil/5. Campo/ENCARGO_pdf_avance_cliente_aulas_nivel.md`
(2026-09-28). Estudio real: CCSS Perfil 2026-II, corte 25/09 18:00.

## Mapa (hallado, no supuesto)

- El PDF de cliente de aulas **no** es el ejecutivo de acreditación: desde el
  2026-08-27 tiene modelo y render propios en `api/R/monitoreo_aulas_report_pdf.R`
  (`build_monitoreo_aulas_report_model` → `monitoreo_aulas_advance_report_pdf`),
  despachado en `router_monitoreo.R:2485` y `:2808`. No hay que tocar congelados.
- El modelo ya consume `monitoreo_aulas_avance_cuota_del_plan()` una sola vez y
  sus cifras reproducen el corte: niveles 6–9, 324 de 400, 81,0 %, faltan 76.
- Hoy el PDF de CCSS **no se genera**: `.marp_bloque_sexo` revienta porque con
  eje por persona la tabla general no trae columnas de sexo.
- La composición referencial describía 412 personas (incluía las 88 de niveles
  5 y 10) contra una población de 800 de niveles 6–9.

## Decisiones de Gonzalo (2026-09-28)

- Las 106 efectivas fuera de toda meta van como **nota al pie** del resumen, con
  su desglose.
- Composición por carrera y sexo: **alumno por padrón, sólo las 324 que entran
  en una celda**, contra la población de 800.

## Ítems

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | El PDF de CCSS se genera (no revienta sin columnas de sexo) | flujo propio `monitoreo_aulas_report_eje.R`; guard en `.marp_bloque_sexo` (`monitoreo_aulas_report_paginas.R`) | hecho — 4 páginas sobre la copia del 25/09 |
| 2 | Meta y avance por nivel curricular, brecha por nivel sin netear (ADR 0079) | `.marp_eje_pagina_avance` | hecho — 104/119, 112/122, 74/97, 34/62; «faltan 76 = suma; lo que sobra no cubre» |
| 3 | La facultad como encabezado (portada y chip), no como desglose | `.marp_ambito_del_plan` → `model$ambito`, cromo y portada | hecho — «Facultad de Ciencias Sociales» |
| 4 | Composición referencial por carrera y sexo, sin umbrales | `.marp_eje_pagina_composicion` sobre `model$composicion` | hecho — población vs recogido, sin avisos de desvío |
| 5 | La composición describe a quien entró en una celda (324, no 412) | `monitoreo_aulas_avance_cuota.R`, máscara de `monitoreo_aulas_composicion_referencial` | hecho — también cambia el tablero y la hoja de cobertura, que leen el mismo bloque |
| 6 | Ritmo de la recolección | `.marp_pagina_ritmo` (compartida) | hecho — acumulado 136→324 contra 400 |
| 7 | Nota al pie con las 106 fuera de toda meta (17 / 88 / 1) | `.marp_fuera_de_meta` (del invariante) + `.marp_eje_nota_fuera_de_meta` | hecho — «nivel 5: 56; nivel 10: 32» |
| 8 | Sin mecánica interna (cursos-horario, aplicadores) cuando el eje no es del aula | flujo por eje | hecho — `grep -ciw` = 0 |
| 9 | El PDF de HSVG no cambia (invariante) | despacho por `model$eje` en `monitoreo_aulas_advance_report_pdf` | hecho — HSVG26ULT2 (25/09): 11 de 11 páginas idénticas en píxel, texto idéntico, 348 539 bytes |
| 10 | Gate: suites del área con conteos + render visual | `make gate-area AREA=aulas` (patrón report/eje/composición/avance) | hecho — 1328 pass · 0 fail · 0 suites rotas; 27 suites (6 transversales) |

## Aprendido

- Las cifras por carrera del encargo (Economía 224, RR.II. 113…, suman 430) no
  salen de ningún bloque del motor: corresponden a la carrera del curso-horario.
  El PDF usa la del alumno por padrón (decisión de Gonzalo).
- Ritmo por nivel no existe como serie: `.calad_avance_diario` agrupa por la
  facultad del aula. Si se pide, hay que derivarla de la atribución por persona
  del bloque, no del plan.
