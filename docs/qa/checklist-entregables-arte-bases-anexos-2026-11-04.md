# Checklist — Arte ACRD 2026: bases, libros de códigos y anexos (2026-11-04)

Pedido de Gonzalo (2026-11-04) para cerrar la entrega de Arte y Diseño PUCP.
La guía, los cuestionarios y el informe consolidado (Word, PDF y PPT) los ve él;
aquí solo va lo que pidió explícitamente.

Fuente: `Arte_v1-12.pulso` (29-10-2026, multibase: administrativos, docentes,
estudiantes). Se generó con los motores de la app sobre una copia, en un backend
aparte (8871). Destino:
`Documents/Pulso/01_Estudios/2026_PUCP_ArteACRD/Bases, libros de códigos y anexos/`.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | Base de administrativos (Excel) | motor `/api/analitica/bases/xlsx`, proyecto v1-12 | generado (85 × 36) — falta tu visto bueno |
| 2 | Base de docentes (Excel) | ídem | generado (115 × 95) — falta tu visto bueno |
| 3 | Base de estudiantes (Excel) | ídem | **bloqueado**: trae `p4` = código PUCP de los 279 estudiantes; decidir si sale |
| 4 | Libro de códigos de administrativos (Excel y PDF) | motor `/api/analitica/codebook` (`reporte_codebook.R`, `reporte_codebook_pdf.R`) | generado, PDF revisado en render — falta tu visto bueno |
| 5 | Libro de códigos de docentes (Excel y PDF) | ídem | generado, PDF revisado en render — falta tu visto bueno |
| 6 | Libro de códigos de estudiantes (Excel y PDF) | ídem | generado, PDF revisado en render — falta tu visto bueno |
| 7 | Anexo: frecuencias simples de administrativos | motor `/api/analitica/frecuencias` (`reporte_frecuencias.R`) | generado sin secciones y en orden del cuestionario — falta tu visto bueno |
| 8 | Anexo: frecuencias simples de docentes | ídem | ídem |
| 9 | Anexo: frecuencias simples de estudiantes | ídem | ídem |

## Notas

- Los N coinciden con el informe FINAL_v4: 85 administrativos, 115 docentes y
  279 estudiantes. Las bases parciales de las preguntas filtradas que aparecen en
  las frecuencias (77, 98, 176, 184, 242…) son las mismas que cita el PPT.
- Arreglos en el motor que salieron de esta entrega:
  - Frecuencias sin secciones configuradas ordenaba las páginas del instrumento
    en orden alfabético (PAG1, PAG10, PAG11… PAG2). Ahora respeta el orden del
    cuestionario (`.secciones_desde_instrumento`, test
    `test-analitica-secciones-orden-instrumento.R`).
  - PDF del libro de códigos: el subtítulo se montaba sobre el título, la
    primera fila de cada tabla quedaba pegada a la cabecera y, con un subtítulo
    de dos líneas, la regla tachaba la segunda (ahora baja con él).
- Las tres bases incluyen `respondent_id` y `collector_id` de SurveyMonkey.
- Configuración usada en la copia (el `.pulso` v1-12 no se modificó): frecuencias
  sin separadores de sección (pedido de Gonzalo), título del PDF
  «Libro de códigos de docentes» (y equivalentes), subtítulo «Estudio de opinión
  sobre la Formación General de la Facultad de Arte y Diseño PUCP», periodo
  «Octubre, 2026». Sin puntos medios ni guiones en títulos ni nombres de archivo
  (corrección de Gonzalo).
