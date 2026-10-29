# Checklist — unir una lámina suelta como bloque de otra (2026-10-29)

Origen: prueba en la app sobre una copia de Arte (lámina 39, Sí/No «¿Conoce los objetivos formativos de Formación
General?», unida como bloque 2 a la lámina 40, multiapiladas de Estudiantes con Top Two Box). 18 acciones; funcionó con
los defectos de abajo. Gonzalo: «Sí, corrígelos».

| # | Defecto | Dónde vive | Estado |
|---|---|---|---|
| D2 | Tras guardar y recargar, el editor muestra el Top Two Box del bloque apagado aunque el PPT lo dibuja | front: lectura de la barra extra del bloque (`barraExtraDeBloque`, barraExtra.ts) contra lo que guarda el back (`overrides.barra_extra`) | ☑ causa: el JSON del motor escribe una opción sola como texto (`"top2box"`, auto_unbox) y el front sólo leía arreglos; además el bloque no miraba sus `overrides`. Ahora lee las dos cosas como el motor; al decidir la barra del bloque se limpia la de `overrides` |
| D1 | Pasar la lámina a «Bloques» apaga el Top Two Box que traía (el bloque 1 lo pierde) | front: `MultiApiladasBuilder.tsx`, siembra del bloque 1 | ☐ |
| D3 | La base de la lámina unida dice «176 estudiantes»; el 279 del bloque Sí/No desaparece; la maqueta dice 279 | motor (base de la multilista) y maqueta | ☐ |
| D4 | Aviso «no comparten una escala… usa Combinar bloques» aparece dos veces estando ya en «Bloques» | front: aviso de escala del builder | ☐ |
| D5 | El buscador de preguntas abre filtrado en «docentes» desde la fila de Estudiantes | front: picker del bloque | ☐ |
