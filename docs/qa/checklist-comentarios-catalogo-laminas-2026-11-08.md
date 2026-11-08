# Checklist: comentarios de Gonzalo sobre el catálogo de láminas (2026-11-08)

Tipo: Checklist de trabajo
Estado: Vigente
Fecha: 2026-11-08
Autoridad: comentarios de Gonzalo en el catálogo visual (artefacto privado), transmitidos por la sesión «Catálogo visual de láminas y gráficos». Gonzalo: «pásaselos y cuando ya tenga todo resuelto que te diga que vuelva a armar el artefacto actualizado y más claro». Sólo Gonzalo da el checklist por terminado.

| # | Indicación (cita textual) | Dónde vive | Estado |
|---|---|---|---|
| 1 | Cinco gráficos: «A este le falta intercalar entre tres arriba y dos abajo y viceversa» | `p_slide_5_graficos_poblacion`, layouts en `construir_plantilla_ppt.R` (congelado a OOXML) y `reporte_slides_composicion*.R` | Pendiente |
| 2 | Grupo «Resumir el informe» (hallazgos, resumen de diferencias, cierre con hallazgos): «Estos son las que menos entiendo y las que siento que deben tener un rol más claro en el programa y a la hora de su construcción» | `p_slide_hallazgos`, `p_slide_resumen_diferencias`, `p_slide_cierre_hallazgos`, selector `laminas/selectores/` | Pendiente: primero propuesta de rol (qué resume cada una, de dónde salen sus cifras) |
| 3 | Diferencias significativas entre públicos: «Pensé que esta forma de mostrar significancia ya estaba desfasada en favor de otra más moderna con tarjetas» | `p_significancia_publicos` (tabla de letras) frente a las tarjetas del ADR 0129 | Decidido por Gonzalo el 2026-11-08 («Sí, retíralos con ADR»): se retira con ADR 0137; inventario de impacto en curso |
| 4 | Mapa de resultado por distrito frente a mapa de distribución: «¿Cuál es la diferencia…? (que me parece más moderno y sofisticado)» | mapas territoriales en `api/R/` | Pendiente: el de resultado adopta el lenguaje visual del de distribución, conservando su función |
| 5 | Mapa de calor por criterio: «Esto aún se ve bastante mal» | `p_dim_heatmap_criterios` | Se resuelve con el 7 (se retira) |
| 6 | Comparativo de dimensiones: «Aún se ve bastante mal» | `p_dim_comparativo_radarbar` | Se resuelve con el 7 (se retira) |
| 7 | Familia de dimensiones: «Creo que gráficos exclusivos para dimensiones ya ni tienen cabida en la app» | `p_dim_radar`, `p_dim_heatmap`, `p_dim_heatmap_criterios`, `p_dim_comparativo_radarbar`, `p_dim_foda` | Decidido por Gonzalo el 2026-11-08 («Sí, retíralos con ADR»): se retira la familia con ADR 0137; inventario de impacto en curso |
| 8 | Objetivo con ícono: «¿Aquí no tiene 5 variantes?» | `lamina_objetivo_variantes.R` (hoy 3: clásica, panel, dimensiones) frente al recetario de referencia | Pendiente: verificar cuántas trae el recetario; si son 5, faltan 2 |
| 9 | Comparar públicos y divergentes: «Todos estos gráficos no deberían ser sólo del resumen ejecutivo… sino gráficos abiertos a todo tipo de láminas de gráficos» | Panorama, Fortalezas, Cobertura, dumbbell y divergente con estilo resumen en ranuras de 2 y 4 | Pendiente: medir si salen nativos en ranuras de 2 y 4 o caen al respaldo |
| 10 | Defecto del render: Cobertura lista `estudiantes_2018` y `estudiantes_2021` (bases de serie) como públicos, con nombre técnico y sin barras | `p_cobertura`, `GET /api/graficos/resumenes/padron` | En curso (writer de entregables, ola 2) |
| 11 | Defecto del render: Resumen de diferencias sale con cabecera y cuerpo vacío, sin aviso | `p_slide_resumen_diferencias` | En curso (writer de entregables, ola 2) |

Al cerrar todo: avisar a la sesión del catálogo para que rehaga el artefacto con un render nuevo.
