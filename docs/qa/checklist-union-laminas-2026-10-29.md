# Checklist — unir una lámina suelta como bloque de otra (2026-10-29)

Origen: prueba en la app sobre una copia de Arte (lámina 39, Sí/No «¿Conoce los objetivos formativos de Formación
General?», unida como bloque 2 a la lámina 40, multiapiladas de Estudiantes con Top Two Box). 18 acciones; funcionó con
los defectos de abajo. Gonzalo: «Sí, corrígelos».

| # | Defecto | Dónde vive | Estado |
|---|---|---|---|
| D2 | Tras guardar y recargar, el editor muestra el Top Two Box del bloque apagado aunque el PPT lo dibuja | front: lectura de la barra extra del bloque (`barraExtraDeBloque`, barraExtra.ts) contra lo que guarda el back (`overrides.barra_extra`) | ☑ visto en la app tras recargar; causa: el JSON del motor escribe una opción sola como texto (`"top2box"`, auto_unbox) y el front sólo leía arreglos; además el bloque no miraba sus `overrides`. Ahora lee las dos cosas como el motor; al decidir la barra del bloque se limpia la de `overrides` |
| D1 ☑ | Pasar la lámina a «Bloques» apaga el Top Two Box que traía (el bloque 1 lo pierde) | front: `MultiApiladasBuilder.tsx`, siembra del bloque 1 | ◐ 1.er intento (7165c37c2) sólo copiaba la barra DECLARADA y falló en la app: la lámina de Arte no la declara, la hereda del recetario, y en «Bloques» un bloque sin barra declarada sale sin ella. 2.º (e2b1fba23): el bloque 1 se siembra con la barra EFECTIVA (`leerTwoBox`). ☑ visto en la app: el bloque 1 queda con TTB sin tocarlo y el render dibuja 85 % y 89 % |
| D3 ☑ | La base de la lámina unida dice «176 estudiantes»; el 279 del bloque Sí/No desaparece | motor | Gonzalo «A, como Conta»: el pie da la base MAYOR por público (`.base_ref_de_mayor_n`, reporte_plan_base_mayor.R) y la pregunta con menos casos lleva «N = 176» en azul sobre su barra (G16), también con rótulo de público. Visto en los dos órdenes de bloques. Ubicación del N: ver ítem 10 de checklist-arte-vs-conta |
| D4 | Aviso «no comparten una escala… usa Combinar bloques» aparece dos veces estando ya en «Bloques» | front: aviso de escala del builder | ☑ en «Bloques» no se compara entre bloques (cada uno revisa su escala); el aviso dice «pestaña Bloques» |
| D5 | El buscador de preguntas abre filtrado en «docentes» desde la fila de Estudiantes | front: picker del bloque | ☑ `VariablePicker` acepta `fuenteInicial` y cada fila de `TemasPorPublico` le pasa su base |
