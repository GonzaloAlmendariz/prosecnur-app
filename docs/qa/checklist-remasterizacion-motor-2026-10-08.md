# Checklist — Remasterización de los motores de PPT y Word, y su editor (2026-10-08)

Vara y plan en [goal-remasterizacion-motor-2026-10-08.md](goal-remasterizacion-motor-2026-10-08.md). ADR [0092](../adrs/0092-el-recetario-es-el-estandar-del-motor.md).

## Indicaciones de Gonzalo

| # | Indicación (textual) | Dónde vive | Estado |
|---|---|---|---|
| R1 | «el recetario moderno de PPT, y el recetario moderno de Word… son la base fundamental y central en la cual debe basarse la completa remasterización de los actuales motores» | ADR 0092, `estandar_pulso.json` | ◐ estándar exportado |
| R2 | «cuando me refiero al motor, no solo me refiero al motor que genera los gráficos, sino a la interfaz que permite la generación de los mismos gráficos» | F6 | ☐ |
| R3 | «la UI… tiene muchos fallos, como por ejemplo el selector dinámico que te permite ampliar o disminuir el tamaño de ciertos placeholders» | F6, `ChartLayoutPopover.tsx` | ☐ |
| R4 | «un repensamiento completo, pero manteniendo todo lo bueno que ya tiene ProSecNur a nivel de interfaz usuaria» | F6 | ☐ |
| R5 | «de PPT y de Word, las paletas, los diseños» | F1 a F4 | ☐ |
| R6 | «que sea muy fino, muy cuidadoso, que respete las proporciones, que respete los estándares que ya están establecidos en los recetarios» | banco de conformidad F0, todas las fases | ☐ |
| R7 | Estilos: «El recetario es el estándar»; perfiles de cliente sólo cambian logo y paleta | F1 | ☐ |
| R8 | Proyectos: «Migran solos», con aviso de lo que no tenga equivalente | F5 | ☐ |
| R9 | Word: «El documento completo» | F4 | ☐ |
| R10 | Ritmo: «Loop con hitos y commits», tick de 300 s | loop | ☑ abierto |

## Fases

| Fase | Contenido | Estado |
|---|---|---|
| F0 | Contrato: `estandar_pulso.json` (☑), ADR 0092 (☑), banco de comparación y reglas de conformidad en `verificar_mazo` (☐) | ◐ |
| F1 | Tokens en el motor: `estandar_tokens.R`, presets derivados, defaults de graficadores a tokens, paletas al núcleo | ☐ |
| F2 | Graficadores conformes (grosor por filas, cifras chicas, Top/Bottom Two Box, leyendas, dicotómica, dumbbell, serie, histograma, radar, calor, mapas) y gráficos nuevos (metas, matriz, forest, cambio, peso, competencias) | ☐ |
| F3 | Lámina PPT: plantilla `plantilla_pulso_2026.pptx`, antetítulo, pregunta fuera de la imagen, 22 tipos, láminas de identidad | ☐ |
| F4 | Word completo: `reporte_word_documento.R` e identidad, estilos, SEQ, índices, secciones, «Cómo leer» | ☐ |
| F5 | Migración de planes y `.pulso`, con avisos | ☐ |
| F6 | Editor: selector de 22 tipos, distribución del espacio estable, vista previa fiel, «Estilo global» reducido | ☐ |
| F7 | Cierre integral con proyectos de referencia, verificador y notas | ☐ |
