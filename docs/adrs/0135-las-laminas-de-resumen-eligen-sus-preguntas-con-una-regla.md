# ADR 0135: Las láminas de resumen eligen sus preguntas con una regla

Estado: Propuesto (en implementación; espera la ratificación de Gonzalo)

Implementacion: En curso en la rama `claude/estudio-laminas-sintesis`

Fecha: 2026-11-07

Relación: extiende [ADR 0134](0134-los-graficos-del-resumen-ejecutivo-son-nativos.md); **enmienda** [ADR 0104](0104-la-matriz-se-arma-en-la-app.md)
§2 y §4 en lo que toca a Gráficos; respeta [ADR 0103](0103-la-matriz-de-equivalencias-solo-declara-equivalencias.md)
(«la matriz sugiere, la lámina decide»). Propuesta: `docs/qa/propuesta-laminas-de-sintesis-2026-11-07.md`. Checklist:
`docs/qa/checklist-estudio-laminas-sintesis-2026-11-07.md`.

## Contexto

Con el motor del ADR 0134 un panorama de tres públicos pedía 157 clics: las preguntas se agregaban una por una. Además,
el analista tenía que saber de antemano que lo que buscaba se llamaba «Panorama de públicos» o «Brecha entre dos grupos»
con el estilo «resumen». La maqueta `graficos-sintesis`, revisada por Gonzalo en cuatro rondas, fija el camino: se elige
por la pregunta del estudio y las preguntas de una lámina de resumen salen de una regla visible.

Decisiones de Gonzalo del 2026-11-07:

- Entra primero el selector por intención y después el mazo «Resumen ejecutivo», que se construye sobre él.
- El título lo escribe siempre el analista; el motor no lo sugiere.
- La lámina de tendencia entre mediciones queda fuera.
- El emparejado entre públicos vuelve a sugerir por el texto, para confirmar fila por fila.
- El cierre toma sus cifras de otras láminas por referencia viva.

## Decisión

1. **Tres clases de tipo.** Un *gráfico* es una pieza de uso general que va en cualquier lámina. Una *lámina* es una
   composición. Una *lámina de resumen* elige sus preguntas con una regla. La clase es de la **tarjeta** del
   selector, no del graficador: el mismo `p_dumbbell` es un gráfico en estilo recetario y una lámina de resumen con
   estilo `resumen` y `regla`. Se declara en la tabla de tarjetas del front (`clase`: `grafico`, `lamina` o `resumen`) y
   la interfaz la muestra en el selector, el catálogo y el inspector.
2. **La regla.** El arg `regla` de los graficadores de resumen es una lista:
   `{tipo, n, umbral, agregar, quitar}`. Los tipos son:
   - `todas`: todas las candidatas.
   - `comunes`: preguntas presentes en todos los públicos.
   - `mayor_diferencia`: las `n` de mayor diferencia. Con dos grupos se mide el valor absoluto del primero menos el
     segundo; con tres o más, la distancia entre el mayor y el menor, con la misma definición que `contraste/1`.
   - `diferencia_minima`: las de diferencia de al menos `umbral` puntos.
   - `mayor_sin_info`: las `n` con más «Sin información».
   - `bajo_umbral`: las que tienen el indicador bajo `umbral` en algún público.
   - `extremos`: las `n` más altas y las `n` más bajas.
   - `a_mano`: sólo la lista de `agregar`.

   `agregar` y `quitar` son el ajuste a mano y se aplican después de la regla.
   - El orden empata de forma determinista: primero por métrica y después por el orden del instrumento.
   - Sin `regla` el graficador conserva su contrato actual (las `vars` declaradas), así que ningún plan cambia.
3. **Función pura compartida.** `.regla_preguntas_evaluar(indicadores, regla, universo)` en
   `api/R/graficos_regla_preguntas.R` recibe la tabla `(tema, etiqueta, grupo, valor, sin_info, n)` y devuelve los temas
   elegidos en orden, el total de candidatas, la métrica de cada tema y **el texto de la regla para la nota**, por
   ejemplo «Se muestran las 13 de mayor diferencia, de 47 preguntas comunes». La usan el render, la lámina nativa y el
   endpoint de conteo, así que la nota, la lámina y el contador nunca discrepan. «Sin información» se detecta con
   `.graficos_no_sustantivos`, un solo detector.
4. **Conteo en vivo.** `POST /api/graficos/resumenes/regla` recibe `{graficador, args}` y devuelve
   `{total, seleccionadas, candidatas: [{tema, etiqueta, metrica, seleccionada}], texto_regla, avisos}`. Las candidatas
   sirven para el ajuste a mano en el inspector.
5. **Universo de candidatas por tipo.**
   - Panorama, escala, aperturas y fortalezas: las preguntas de escala de cada base. Una pregunta de escala es una
     `select_one` de diseño independiente con el corte y al menos cuatro opciones sustantivas.
   - Contraste entre públicos: los pares comunes. Lo son las filas declaradas en la matriz de equivalencias (sin
     `sugerida`, con la misma firma de escala) y los pares confirmados en la lámina. Si las bases comparten instrumento,
     los pares son las variables del mismo nombre.
6. **Láminas de resumen nuevas**, cada una con especificación pura, lámina nativa y test:
   - **Fortalezas y alertas** (`p_fortalezas`, `fortalezas/1`): las `n` más altas y las `n` más bajas de un público,
     lado a lado.
   - **Cobertura y participación** (`p_cobertura`, `cobertura/1`): por público, los casos, el padrón, la cobertura y la
     meta. El padrón y la meta se *proponen* desde Cálculo de muestra (`marco_validado`, `meta`) y, si no hay, desde
     Monitoreo (`Universo`, `Meta`), con su origen a la vista. El analista los confirma y quedan escritos en el payload
     (`universos`, `metas`), porque el render no tiene sesión. Nada se infiere: sin padrón confiable, sólo `n`.
   - **Cierre con hallazgos** (`p_slide_cierre_hallazgos`): de tres a cinco hallazgos `{lamina, cifra, texto}`. La cifra
     es una **referencia viva**: el id de la lámina de origen y la clave estable de una cifra de su especificación (por
     ejemplo `diferencia:<tema>`, `mediana:<publico>`, `bajo:<publico>`, `cobertura:<publico>`). Al exportar, la cifra se
     lee de esa lámina con su mismo cálculo y nunca se recalcula aparte. El texto lo escribe el analista. Si la lámina
     de origen desaparece o la cifra cambió desde que se escribió el texto, la lámina avisa.
7. **Enmienda al ADR 0104 (Gráficos).** En la revisión del emparejado entre públicos, una pregunta sin par puede recibir
   una sugerencia por parecido de texto (`sugerida`), con estas condiciones:
   - Se confirma, se cambia o se descarta **fila por fila**. No hay confirmación en bloque.
   - No entra en la lámina ni en la regla mientras no se confirme.
   - «Guardar lo confirmado en la matriz» funde lo confirmado en la declaración (GET, unión, POST), sin reemplazarla.

   Carga › Equivalencias sigue sin «Proponer emparejados».
8. **Inspector uniforme.** La configuración de cada gráfico vive en el inspector, en las pestañas Lámina y Gráfico, con
   las secciones **Datos, Cálculo y Aspecto** para todos los graficadores. Empieza por los de resumen. Cada control lleva
   su rótulo y un «?», sin párrafos de ayuda debajo.
9. **Fuera de este ADR**: la tendencia entre mediciones y los títulos sugeridos.

### Supuestos de la escala (revisión metodológica del 2026-11-07)

- En la barra divergente el porcentaje es sobre el total de respondientes de la pregunta, con «Sin información» dentro
  del denominador y en su columna; si se excluyen opciones, sobre quienes quedan, y el pie lo dice. Con filtros o
  pesos, «total de respondientes» es el del subconjunto filtrado o ponderado.
- El detector único reconoce como no sustantivo SÓLO lo que declara la lista (`choices$especial`/`no_sustantivo`),
  los códigos 90 a 99 y los rótulos de no respuesta («No tengo información suficiente», «No aplica», «Prefiero no
  responder», «No precisa», «Sin opinión», «Ninguna de las anteriores», «Otro»…), en cualquier extremo de la lista. El
  rango de los códigos ya no decide: tres revisiones metodológicas mostraron que cada heurística de saltos rompía otro
  caso (escalas codificadas de dos en dos, huecos, códigos sueltos). «Ninguno»/«Ninguna» como nivel es sustantivo. Un
  rótulo de no respuesta que el patrón no conozca queda como nivel; se corrige declarándolo en la lista.
- El Top Two Box de la lámina es la suma de los segmentos ya redondeados; puede diferir en un punto del redondeo de la
  suma exacta.
- Sin declarar, el reparto deja la mitad de los niveles sustantivos en cada lado (`floor(k/2)`) y el central como neutro
  si son impares; en escalas de 4 y 5 puntos coincide con el recetario, y en las de 3, 7 u 11 corrige el sesgo que
  dejaba sólo dos niveles en desacuerdo.
- Un rótulo ambiguo («Rechazo», «No conoce», «No uso») sigue siendo nivel si otra opción de la misma lista comparte su
  raíz («Rechazo totalmente», «Conoce poco», «Uso poco»): regla de hermanos.
- Un código 90 a 99 es siempre no sustantivo salvo que la lista lo declare `especial = no`; «Sin opinión» como punto
  medio de una escala va a Sin información y la escala queda sin neutro (decisión, no error).
- Cada cifra se redondea por separado y el total de cada lado es la suma de lo rotulado (como en la lámina 71): con
  empates en ,5 la suma puede llegar a 102.
- Una lámina guardada con `n_negativas` explícito (el recetario fija 2) conserva su reparto; las nuevas sin declarar
  usan la mitad por lado, y el campo de la UI muestra el valor que se aplica.
- La regla de las láminas de resumen sólo considera escalas de al menos cuatro opciones sustantivas que forman batería
  o están declaradas ordinales; una escala de tres puntos se dibuja, pero ninguna regla la elige.
- Una raíz ambigua es nivel sólo si está en la mitad negativa de la lista; al final de una escala que ya tiene su cero
  («Nunca … Siempre / No he usado el servicio») es no respuesta.
- La escala del resumen con varios públicos calcula cada fila sobre su propia base (pregunta y público) y le pone el
  sufijo del público; ordenar o cortar entre públicos compara porcentajes de bases de distinto tamaño, sin total
  combinado. Los mismos filtros se aplican a todas las bases.
- **Escalas distintas en una lámina** (como la p. 4 del resumen de Arte, que junta acuerdo y satisfacción). La leyenda
  es la escala más frecuente del universo de la regla (si la regla elige filas de una sola escala, la de esas filas).
  Otra escala se alinea **por posición** sólo si: tiene el mismo número de opciones sustantivas; su tema es acuerdo,
  satisfacción, importancia, confianza, utilidad o probabilidad, y la leyenda también lo es (frecuencia y temas no
  reconocidos sólo se juntan con su misma firma, porque «nunca/nada» no dice si el polo es bueno o malo; «Desconfío
  mucho … Confío mucho» tiene tema pero un sentido que no se reconoce y queda fuera); va en el mismo sentido negativo a positivo; reparte igual sus
  niveles; si tiene punto medio, éste es neutral en ambas («ni … ni», neutral, indiferente) o son del mismo tema; y no
  trae una opción sin información que la leyenda no tenga (con más de una, deben coincidir por etiqueta). Cada fila
  conserva su cifra y su base; sólo cambia la columna donde cae cada nivel. El pie agrega «en <tema>, de <extremo
  negativo> a <extremo positivo>» por cada escala alineada, sin decir qué fila usa cuál. Una exclusión de opciones se
  traduce a la escala alineada por posición (sustantiva) o por ser especial, para que todas las filas compartan
  denominador; una exclusión que no está en la escala de la leyenda no se aplica a ninguna fila y se avisa («La
  exclusión "No sabe" no está en la escala de la leyenda y no se aplica.»). Lo que no se alinea queda fuera con su causa: «otro número de opciones», «de tema no reconocido»,
  «sentido contrario», «reparten sus niveles distinto», «su punto medio no es neutral», «opciones sin información
  distintas». Medido en Arte: el universo pasa de 145 a 157 y las dos filas de satisfacción coinciden con la p. 4.
- Con regla, una fila que no se puede calcular (sin respuestas, vacía tras las exclusiones) queda fuera con aviso y el
  conteo la descuenta; sin regla, la tabla sigue estricta.
- La mitad negativa depende de la dirección declarada de la escala (`direccion_escala`): una lista invertida sin
  declararla pinta la polaridad al revés, como ya pasaba. Con «Nunca» en la lista, «No he X» es no respuesta.
- El detector quedó aprobado tras seis revisiones metodológicas (2026-11-07); los probes viven en el scratchpad de la
  sesión y los casos, en `test-graficos-divergentes-no-sustantivos.R`.
- Pendiente: el dibujo de respaldo (ggplot) apila el gris de «Sin información» detrás del acuerdo; la lámina nativa no.

### Precisiones de la implementación

- **Cifras del cierre.** No se guardan en la espec (contraste, fortalezas y divergentes ya usan `cifras` para su dibujo):
  `.cifras_clave(espec)` las deriva con el mismo texto que la lámina. Claves: `diferencia:<tema>`,
  `valor:<tema>:<grupo>`, `mediana:<publico>`, `bajo:<publico>`, `valor:<tema>`, `casos|tasa|meta:<publico>`,
  `t2b|sin_info:<tema>`; cada cifra trae `{clave, rotulo, texto, valor, unidad}`. El id de la lámina de origen viaja en
  `meta$lamina_id`, que copian los tres rearmados del plan (job, router y vista previa). Si se guarda
  `cifra_al_escribir`, la lámina avisa cuando la cifra cambió desde que se escribió la frase.
- **Emparejado sugerido.** `POST /api/graficos/resumenes/emparejado`: Jaccard sobre palabras normalizadas (sin tildes,
  minúsculas, sin palabras vacías), misma firma de escala, puntaje mínimo 0,2, hasta tres candidatas; sólo lectura.
- **Endpoints.** `POST /api/graficos/resumenes/regla`, `GET /api/graficos/resumenes/padron`,
  `POST /api/graficos/resumenes/cifras`, `POST /api/graficos/resumenes/emparejado`.
- **Códigos.** `E_REGLA_PREGUNTAS_INVALIDA`, `E_EMPAREJADO_INVALIDO`, `E_CIFRAS_INVALIDO` (400).
- **Pregunta de escala.** Es de escala la `select_one` de diseño independiente cuya lista comparten al menos tres
  preguntas de su base (batería) o que el estudio declara ordinal; una demográfica de cuatro o más opciones (edad, grado)
  no lo es. Medido en Arte: sin este criterio entraban 3, 2 y 1 preguntas demográficas por público.

### Rótulos y tope de la escala (prueba con Arte, 2026-11-07)

- Las láminas de resumen usan el rótulo corto del estudio si existe; si no, el rótulo completo en hasta tres líneas,
  con la letra bajando hasta 10,5 pt y recorte con «…» que conserva el sufijo del público. Una oración larga ya no manda
  la lámina a imagen. Medido en Arte: con los rótulos completos de 100 a 200 caracteres, el respaldo ggplot dejaba el
  panel en cero (un rectángulo de color sin marcas).
- La escala del resumen admite hasta 20 filas en la lámina nativa (el resumen de Arte tiene 18); **enmienda el tope de
  14 del ADR 0134 §5 para esta lámina**. Con más filas no se recorta: la escala sale por el respaldo y la regla y el
  render avisan con la causa («22 preguntas bajo 60%; la lámina nativa admite 20…»). En Arte la regla «bajo 60%» da
  22, las mismas que cuenta el panorama del cliente (p. 3: 2 de 60, 16 de 73, 4 de 24); la p. 4 muestra 18 porque el
  cliente omitió cuatro (dos de docentes, dos de administrativos), no por otro criterio. En estilo resumen la columna del no sustantivo se rotula siempre «Sin
  información».
- Con la regla «mayor diferencia», el contraste ordena por la diferencia absoluta, la brecha más grande arriba.

## Consecuencias

- `p_panorama`, `p_dumbbell` (estilo `resumen`) y `p_barras_divergentes` (estilo `resumen`) ganan `regla`.
- Aparecen tres tipos nuevos en el registro y los contratos que enumeran tipos suben sus conteos.
- Se suma un error `E_REGLA_PREGUNTAS_INVALIDA` (`E_REGLA_INVALIDA` ya era de las reglas de validación). El arg se rotula «Regla de preguntas» para no repetir «Preguntas» de `vars`. Una regla implica el estilo `resumen`; con `estilo = "recetario"` explícito, el constructor la rechaza.
- Un padrón confirmado en la lámina puede envejecer si Cálculo de muestra cambia. La tarjeta muestra el origen y avisa
  cuando ya no coincide.

## Cumplimiento

- `test-graficos-regla-preguntas.R`: cada tipo de regla, desempate, ajuste a mano y texto.
- Tests de especificación y lámina nativa de los tres tipos nuevos.
- Contratos del registro y del front.
- QA con las cifras del resumen de Arte junto al PDF.

## Notas

- Probado contra el resumen ejecutivo de Formación General, Arte y Diseño 2026 (copia de trabajo fuera del repo); las diferencias que quedan están explicadas en `docs/qa/checklist-estudio-laminas-sintesis-2026-11-07.md`.
