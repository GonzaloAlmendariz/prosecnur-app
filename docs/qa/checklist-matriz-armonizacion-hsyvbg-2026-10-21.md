# Checklist: lo que falló al armar la matriz de armonización de HSyVbG

Tipo: Checklist vivo
Estado: En curso
Fecha: 2026-10-21
Autoridad: Gonzalo, sobre el `.pulso` que Ulises terminó con la 0.9.3 («le ha resultado extremadamente difícil y muchas cosas son bugs que no ha podido solucionar»; «sí me parece necesario que la app no tenga estos problemas de cara a un próximo estudio»). Sólo él da por terminado un ítem.

Proyecto medido: `3. Caracteristicas sociodemográficas RECOD.pulso` (Tercera semana), 3 bases (2024 SAV, 2025 SAV, 2026 xlsx), 212 filas en la matriz. Auditoría con el motor real (`load_pulso` + `.armz_preparar` + `reporte_comparativo_simple`) en una copia; el original no se tocó.

| # | Lo que pasó | Cifra medida | Dónde vive | Estado |
|---|---|---|---|---|
| A1 | Las filas con la MISMA escala en todas las bases, sin «Armonizar» abierto, no entran al comparativo. Sexo, las 14 de prevalencia VbG/HS, instancias, conocimiento… | 71 de 212 filas fuera, las 71 con firma de escala idéntica en las 3 bases | `analitica_armonizada_implicita.R` (`.armz_completar_implicitas`), llamado desde `.armz_preparar`; el estado de Equivalencias marca `misma_escala` y el recorrido ya no las cuenta como pendientes | hecho, por verificar: con el `.pulso` de Ulises sin tocar, el comparativo pasa de 138 a 212 preguntas (Sexo incluida) |
| A2 | Esas filas salen sin decirlo: la hoja «Preguntas omitidas» sólo lista 3 | 71 filas ausentes, 0 avisos | `.armz_completar_implicitas` → `omitidas` con motivo `sin_armonizar`, hoja «Preguntas omitidas» y aviso | hecho, por verificar: test con escalas distintas sin armonizar; el motivo dice que se abra Equivalencias > Armonizar |
| A3 | En una opción de selección múltiple (dummy 0/1) el «0» queda fuera del denominador: cada opción sale al 100 % | 129 filas dummy, 376 avisos «sin correspondencia (códigos 0)» | `.armz_marcar_no_menciona` + `.armz_conteo` | hecho, por verificar: «Angustia» 2024 sale 209 de 695 (30,1 %) y no 100 %; de 376 avisos «códigos 0» quedan 0 |
| A4 | El sello que detecta una matriz desfasada ordena con la colación del sistema: guardado en Windows, abierto en Mac marca «desfasada» las 3 bases sin cambio alguno | 3 de 3 bases desfasadas al abrir | `.equiv_sello_instrumento(orden = "radix")`; el estado acepta también el sello anterior | hecho, por verificar: los proyectos guardados desde ahora tienen el mismo sello en Windows y Mac. El de Ulises sigue marcado al abrirlo en Mac porque su sello viejo se calculó con la colación de Windows y no se puede reproducir; se corrige al volver a guardar la matriz |
| A5 | Un mapa identidad une códigos que significan otra cosa: 2025 «Año de ingreso» va en orden inverso (1 = desde 2023) y se sumó a «hasta 2019» | 1.386 casos (56 %) de 2025 en la categoría equivocada | armonización por fila (falta aviso) | pendiente: avisar cuando un mapa identidad une códigos con etiquetas distintas. En la copia corregida el mapa de 2025 quedó invertido (1→3, 3→1) |
| A6 | Una pregunta que en el SAV no trae etiquetas de valor (2025 P21 y P50, «la que más te afectó») no se puede armonizar por código y termina «no comparable», aunque sus códigos son los mismos | 2 filas con 2025 en «n.c.» | editor de armonización / catálogo de opciones | pendiente: los códigos de 2025 son los mismos (distribución 1–7 y 1–16 calza con 2024); falta que el editor ofrezca el mapa valor por valor para una variable numérica sin etiquetas |
| A7 | El universo de 2026 (`seleccionado = 1`) no estaba declarado: el comparativo usó 3.318 casos y no 2.500, sin que nada lo advirtiera | 3.318 frente a 2.500 | Validación > caso válido / comparativo | bloqueado: decidir si el comparativo avisa cuando una base trae una columna de selección sin universo declarado |

## Lo aprendido

- Ya existe «Confirmar en bloque las filas Misma escala» en la UI (`mismaEscalaModel.ts`, F5 de la prueba real). El defecto es que el motor dependa de que alguien lo pulse: la regla vive en el frontend y el motor no la conoce.
- La copia corregida a mano (identidad en las 71 filas, «No mencionó» en las 129 dummies, mapa invertido de 2025, P21/P50 de 2025 comparables, universo 2026) deja el comparativo en 212 preguntas, 0 avisos y N 2026 = 2.500. Está en el scratchpad de la sesión del 2026-10-21 (`recod/corregido.pulso`).
