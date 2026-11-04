# Checklist — Arte ACRD 2026: bases, libros de códigos y anexos (2026-11-04)

Pedido de Gonzalo (2026-11-04) para cerrar la entrega de Arte y Diseño PUCP.
La guía, los cuestionarios y el informe consolidado (Word, PDF y PPT) los ve él;
aquí solo va lo que pidió explícitamente.

Fuente: `Arte_v1-12.pulso` (29-10-2026, multibase: administrativos, docentes,
estudiantes). Se generó con los motores de la app sobre una copia, en un backend
aparte (8871). Destino:
`Documents/Pulso/01_Estudios/2026_PUCP_ArteACRD/Entrega de bases de datos y anexos de la encuesta/` (estructura del Drive del cliente: «1. Bases de datos y Libros de códigos» y «4. Anexos (Tablas de frecuencia simple)» con archivos; «2. Instrumentos» y «3. Informes consolidados» vacías, las llenan otros).

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | Base de administrativos (Excel y SAV, anónima) | motor `/api/analitica/bases/xlsx` y `/bases/sav`, proyecto v1-12 | generada (85 × 34), sin PII ni IDs técnicos — falta tu visto bueno |
| 2 | Base de docentes (Excel y SAV, anónima) | ídem | generada (115 × 93), sin PII ni IDs técnicos — falta tu visto bueno |
| 3 | Base de estudiantes (Excel y SAV, anónima) | ídem | generada (279 × 77), sin `p4` (código PUCP), sin PII ni IDs técnicos — falta tu visto bueno |
| 4 | Libro de códigos de administrativos (Excel y PDF) | motor `/api/analitica/codebook` (`reporte_codebook.R`, `reporte_codebook_pdf.R`) | generado, PDF revisado en render — falta tu visto bueno |
| 5 | Libro de códigos de docentes (Excel y PDF) | ídem | generado, PDF revisado en render — falta tu visto bueno |
| 6 | Libro de códigos de estudiantes (Excel y PDF) | ídem | regenerado sin `p4`, PDF revisado en render — falta tu visto bueno |
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

## Coherencia entre .sav, bases, tablas, PPT y Word (2026-11-04)

Pedido de Gonzalo: «todo debe ser coherente». El Word y el PPT no se tocan: los
corrige otra persona. Aquí solo se registra lo encontrado.

| Cruce | Resultado |
|---|---|
| Base ↔ anexo de frecuencias (3 actores) | 197 de 197 bloques se reproducen contando la base; código → etiqueta igual en instrumento, base y libro. Chequeo probado rompiendo un conteo y una etiqueta: cayeron los dos |
| `.sav` 28-10 ↔ base de estudiantes | 279 de 279 casos emparejados por `respondent_id`; todas las variables idénticas celda a celda. Única diferencia: género, que el proyecto agrupa (fluido y agénero en «No binario») igual que la columna `q0003_n` del `.sav`, con otros códigos; misma partición 60/199/6/14 |
| PPT FINAL_v4 ↔ proyecto v1-12 | El mazo regenerado desde v1-12 es idéntico texto por texto; solo difiere un punto final en la lámina 25 |
| PPT FINAL_v4 ↔ anexo | 168 bloques pregunta × actor y 20 TTB de competencias cuadran (TTB = suma de lo rotulado, regla del recetario; en las láms. 37-38, sin partes rotuladas, TTB de la suma exacta). Chequeo probado rompiendo una cifra, un TTB y un Sí/No: cayeron los tres |
| **PPT lám. 12 y Word gráficos 19-20** | **Títulos corridos.** El gráfico titulado «servicio de Bienestar psicológico» muestra Servicio de salud (docentes 16/53/9/23, TTB 62); el titulado «oferta de actividades culturales» muestra Bienestar psicológico (docentes 3/17/42/9/30, TTB 51). Actividades culturales sale correcta en la lám. 13 / gráfico 21, así que figura dos veces y «Servicio de salud» no figura. Vive en el plan del proyecto (títulos del plan); se reproduce al regenerar. Lo corrige quien ve el informe |
| Word ↔ PPT | Los gráficos del Word son imágenes. Los títulos de Bienestar repiten el error de arriba; las cifras de competencias citadas en el texto coinciden con el PPT. No se comparó imagen por imagen el resto |

Observaciones menores, sin acción tomada:

- Las tablas de frecuencias rotulan la residual «Otros» y el instrumento, la base y el
  libro, «Otro (especifique)».
- El anexo de estudiantes lista «Género Fluido 0» y «Agénero 0» tras la agrupación en
  «No binario» (6); es correcto, pero puede leerse como contradicción con el PPT.
- La base de estudiantes trae `p4` (código PUCP de los 279) y las tres bases,
  `respondent_id` y `collector_id`: ver ítem 3.

## Bases anónimas en Excel y SAV (2026-11-04, segunda tanda)

Criterio de Gonzalo: las bases son anónimas, sin datos personales ni información
técnica; sólo variables preguntadas y de control; en SAV y Excel, con etiquetas y
códigos.

- Fuera de las tres bases: `respondent_id`, `collector_id`; de estudiantes, `p4`
  (código PUCP). La exclusión del motor es global por nombre y `p4` es otra
  pregunta en docentes (grado) y administrativos («Pertenece a»), así que se
  generaron dos corridas y de cada una se tomó su base.
- **Defecto de motor encontrado y arreglado:** el SAV, el CSV y el alias
  `/analitica/spss` sólo quitaban `variables_excluidas`; el Excel además quitaba
  internas, vacías y extra no declaradas. El SAV salía con `email_address` y
  `first_name` de 105 docentes y 78 administrativos, `ip_address` de los 479 casos,
  y `CollectorNm`, fechas, `anio` y `filtro`. Ahora los cuatro exportadores usan
  `.analitica_bases_cols_fuera` (test `test-analitica-bases-sin-pii-en-todo-formato.R`).
- Verificado: SAV y Excel con las mismas columnas en el mismo orden y los mismos
  valores en las tres bases; ninguna PII ni técnica en ningún formato; el SAV lleva
  etiqueta de variable en todas y etiquetas de valor en todas las categóricas (las
  que no, son numéricas o texto abierto); el Excel trae hoja `codigos` y hoja
  `etiquetas`. Pasada de coherencia repetida: 197 de 197 bloques del anexo se
  reproducen con las bases nuevas.
- Los textos abiertos (`*_other`) se revisaron: no traen datos personales.

## Nombres y carpetas (formato del Drive)

`1. Bases de datos y Libros de códigos/` con `Bases de datos/` y `Libro de códigos/`;
`4. Anexos (Tablas de frecuencia simple)/`. Nombres `Tipo_Actor FAD_04.11.26`, por
ejemplo `Base de Datos_Docentes FAD_04.11.26.sav`,
`Libro de Códigos_Personal Administrativo FAD_04.11.26.pdf`,
`Anexos_Tablas de Frecuencia Simple_Estudiantes FAD_04.11.26.xlsx`. Sigla FAD y
anexos en tres Excel por decisión de Gonzalo.

