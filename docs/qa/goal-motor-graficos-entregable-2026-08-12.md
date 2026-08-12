# GOAL — el mazo sale sin retoques

Abierto 2026-08-12 desde el checklist de los dos lotes, que ya está cerrado en lo
implementado. Documento vivo: **sólo Gonzalo lo cierra**.

Proyecto de referencia: `~/Documents/Pulso/ACRD CONTA/V3_Conta 11-08 equivalencias (1).pulso`.

## La vara

Un colega toma el `.pulso`, exporta y el mazo se entrega sin tocar nada.

| | Afirmación | Cómo se mide |
|---|---|---|
| V1 | Ninguna cifra desaparece sin que alguien lo haya pedido | Umbrales en 0 por defecto; contar etiquetas rotuladas vs categorías con casos |
| V2 | Cada gráfico dice sobre cuántos habla | Ninguna lámina con una base compartida entre paneles de distinto denominador |
| V3 | El orden de una escala es el que declaró el analista | Dos láminas con la misma variable salen en el mismo orden |
| V4 | El reparto de color y negrita responde a sus mandos | Encender una parte cambia esa parte **y ninguna otra** |
| V5 | Toda tabla es una tabla de PowerPoint | `grep '<a:tbl>'` en los slides ≥ número de tablas del plan |
| V6 | Ningún control del inspector es de un solo estudio | Ningún arg con vocabulario de cliente en el registro |
| V7 | Lo que veo en el QA es lo que sale en PowerPoint | Export con PowerPoint, no con LibreOffice, cuando haya duda |

## La cola

| # | Qué falta | Dónde | Estado |
|---|---|---|---|
| L1 | La base por gráfico en `poblacion_5` y `poblacion_6` | motor | ☑ hecho |
| L2 | La base por gráfico en `poblacion_2` | motor | ☑ hecho · **las cuatro disposiciones de población, por defecto** |
| L3 | ¿Tienen `poblacion_5/6` base de lámina que anular? | motor | ☑ **medido: no la tienen**. `poblacion_2` sólo la escribe si el analista la declara |
| L4 | Negrita de los títulos de bloque en este estudio | proyecto | ⛔ decisión de Gonzalo |
| L5 | Ver el orden manual moviéndose desde la interfaz | verificación | ⛔ los clics del panel no llegan a la página |
| L6 | Retirar la detección heredada de «objetivos educacionales» | motor | ☐ cuando los estudios que dependen de ella declaren `prefijo_grupos` |
| L7 | Auditar el resto de graficadores contra V4 | motor | ☑ **hecho** · 16 medidos sobre el render, 7 mandos muertos reparados |
| L9 | `barras_numericas`: subtítulo y nota al pie no responden | motor | ☑ **hecho** · el segundo bloque de título no declaraba `fontface` |
| L10 | Medir `barras_categoricas`, `divergentes`, `lollipop`, `serie_temporal` | motor | ☑ **hecho** · los cuatro limpios; los errores eran de mi llamada |
| L8 | El subtítulo pierde su cursiva al ponerlo en negrita | motor | ☑ **hecho** · la negrita se suma (`bold.italic`); en **agrupadas** el mando ni se consultaba |

## Trampas — lo que ya costó una conclusión falsa

- **La cadena de QA no ve lo que ve PowerPoint.** LibreOffice renderiza `vert` y
  `vert270` **idénticos** y resuelve un `<p:ph/>` vacío a **horizontal**. Dos
  defectos reales del mazo no salían en mis PNG. Cuando la duda sea tipografía,
  rotación o herencia de placeholder, exportar con PowerPoint:
  `osascript -e 'tell application "Microsoft PowerPoint" … as save as PDF'`.
- **`load_pulso()` devuelve un handle, no el estado.** Tres consultas mías sobre
  el proyecto midieron `NULL` y las di por buenas. El estado se lee del
  `state.rds` dentro del zip.
- **El registro no es el motor**, y **persistir no es aplicar**: un valor
  guardado y visible en pantalla no dice nada del entregable.
- **Un parche puede quedar como código muerto.** El `ph_xml` fue a la rama de
  `props` cuando ese slot pasa por la de coordenadas: el `.pptx` seguía igual.
  Lo delató volver a inspeccionar el XML emitido, no releer el diff.
- **El `fontface` de un canvas no está donde parece.** No es `p$layers[[i]]$aes_params$fontface` ni `gp$fontface`: es **`gp$font`** (1 plana, 2 negrita, 3 cursiva, 4 ambas), y hay que recorrer el gTree de `ggplotGrob()`. Los dos primeros devuelven lo mismo con el interruptor encendido y apagado — un aserto que no distingue nada.
- **Los clics del panel del navegador no llegan a la página** en esta sesión —ni
  foco ni `:hover`, comprobado sobre el propio elemento—, así que la UI se
  verifica por payload servido y por render.
