# Checklist · la matriz de equivalencias sólo declara equivalencias (ADR 0102)

Tipo: Checklist de implementación
Estado: Vigente
Fecha: 2026-10-14
Autoridad: ADR 0102 (aceptado); decisión de Gonzalo del 2026-10-14. Sólo Gonzalo da por terminado un ítem

Pedido de Gonzalo (2026-10-14): «la matriz de equivalencia no debería decir ni el tipo de gráfico ni la lámina en la que
va o diapositiva, es solo una matriz de equivalencias». Alcance elegido: «Matriz pura; láminas en Gráficos». Salvedad:
«para el caso de los PPT de ACNUR sí es necesario […] tener sus configuraciones activables». Sólo Gonzalo da por terminado
un ítem.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| E1 | La forma plana y su lectura/escritura sin `diapositiva`, `enunciado`, `grafico`, `corte`, `estilo` | `api/R/equivalencias_publicos.R` | hecho, por verificar: lectura (las columnas se ignoran y se cuentan), plantilla y guardado sin ellas; la revisión pasa a `r3:` sin ellas. El enunciado de la matriz por bloques (texto de la pregunta en cada medición) se queda |
| E2 | La importación de Excel ignora esas columnas y avisa cuántas filas traían cada una | `api/R/router_equivalencias.R` | hecho, por verificar: la importación devuelve `avisos` con «no se usaron las columnas diapositiva (N filas), …; las láminas se arman en Gráficos» |
| E3 | El plan consolidado sin bloque derivado de la matriz; retiro de `.graficos_plan_desde_equivalencias` | `api/R/graficos_plan_consolidado.R`, `graficos_plan_equivalencias.R` | hecho, por verificar (backend): borrado `graficos_plan_equivalencias.R`; el consolidado propone sin bloque derivado; `fuente = "equivalencias"` responde 410 `E_GRAFICOS_PLAN_EQUIVALENCIAS_RETIRADO`. Front: «Armar desde…» sin la fuente «Equivalencias» ni «Sincronizar»; sin sello `equivalencias_revision` en el store, el autosave ni la siembra; retirados `declaracionAplicada.ts` y `sincronizarEquivalentes.ts` con sus pruebas |
| E4 | La matriz en el front sin columnas de lámina ni gráfico; retiro de la vista de reparto en diapositivas | `frontend/src/features/carga/Equivalencias*.tsx` | hecho, por verificar: la tabla sin columna «Lámina»; retirados `EquivalenciasDiapositivas.tsx`, `BloqueGrafico.tsx` y su CSS (1318 → 785 líneas); la subida avisa las columnas ignoradas. Gate carga 729/729 |
| E5 | Los selectores de Gráficos que leen equivalencias siguen funcionando (públicos por tema, radar, brecha, serie) | `frontend/src/features/graficos` | hecho, por verificar: los selectores leen el estado de la matriz, que no cambió; gate graficos 1701/1701. Falta verlo en la app |
| E6 | ACNUR: su perfil `acnur_kobo_cruncher_plus` y su plan propio siguen activables; una prueba lo fija | `api/R/graficos_metadata.R` | hecho, por verificar: prueba en `test-graficos-plan-consolidado.R` (perfil, plantilla `acnur_16_9`, sin «Otros» automático y plan con láminas) |

## Lo medido antes de empezar

- Las columnas viven en `.EQUIV_COL_DIAPOSITIVA`, `_ENUNCIADO`, `_GRAFICO`, `_CORTE` y `_ESTILO`
  (`equivalencias_publicos.R`, ~26–60) y se usan en `equivalencias_publicos.R`, `graficos_plan_equivalencias.R` y
  `router_equivalencias.R`; en el front, en `EquivalenciasTabla.tsx`, `EquivalenciasDiapositivas.tsx`,
  `EquivalenciasPanel.tsx` y los clientes `api/equivalencias.ts`, `api/cargaFuentes.ts` y `api/graficos.ts`.
- El plan consolidado arma su bloque comparativo con `.graficos_plan_desde_equivalencias`
  (`graficos_plan_consolidado.R:113`).
- En Acreditación Contabilidad la matriz traía 133 de 154 filas asignadas a 44 diapositivas (ADR 0063).
