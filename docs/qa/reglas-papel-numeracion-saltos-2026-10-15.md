# Reglas del papel — numeración, saltos, condiciones y campos de control

Tipo: Regla metodológica
Estado: Vigente
Fecha: 2026-10-15
Autoridad: Revisión metodológica independiente sobre el corpus de 43 instrumentos reales; umbrales decididos por delegación de Gonzalo («toma todas las decisiones por mí»)

**Por qué existe.** El corpus de instrumentos reales (`api/scripts/corpus_instrumentos.R`)
mostró que el motor de papel numeraba con el nombre de la variable (`censo_2025` → P2025),
imprimía saltos a destinos equivocados («Sí, acepto → Fin de la encuesta») y perdía el
29,7 % de los filtros. Estas reglas corrigen las decisiones 39, 40, 41, 44 y 46 de
`checklist-exportacion-formulario-2026-10-15.md`. Gobiernan `formulario_pdf_build_model()`,
así que valen para el PDF y para el Word.

## Supuestos

1. El papel se aplica en el orden de impresión y el entrevistador sólo sigue las instrucciones que tiene delante.
2. Una variable no preguntada vale vacío, con la semántica de ODK.
3. El vínculo con la base va por la etiqueta `[var]` cuando el número impreso no coincide con la variable.
4. Fecha, hora y número de cuestionario se anotan a mano en papel aunque en CAPI sean automáticos.

## 39 · Numeración — global por instrumento

1. `paper_number` manda siempre; `-` es «sin número».
2. Esquema derivado `[prefijo][N][(_|.)k…][letra]`: se quita el prefijo genérico (`p`, `P`, `preg`, `pregunta`, `q`), se conserva el de módulo de una a tres letras (`A`, `SPF`), `_` y `-` pasan a `.` (`p14_1` → 14.1, `A6_1` → A6.1, `P7_1_A` → 7.1a).
3. El esquema derivado se usa sólo si se cumplen **todas**:
   - inyectivo (dos variables no dan el mismo número);
   - una sola familia de prefijo;
   - orden no decreciente en el orden de impresión, dentro de cada módulo;
   - plausible: sin cifras de cuatro dígitos ni 19xx/20xx, y ninguno mayor que 3 × el total de preguntas;
   - cobertura ≥ **90 %** de las preguntas numerables;
   - enteros faltantes ≤ **10 %** de N, siempre listados en un aviso (una pregunta retirada entre olas es legítima).
4. Si falla una, numeración secuencial, y el aviso dice cuál falló con su ejemplo («p36 → p6 no es creciente»).
5. En modo secuencial, todo número que no coincide con su variable lleva la etiqueta `[var]` en cuerpo menor.
6. Una matriz consume **un** número X y sus filas son X.1…X.k, con o sin tenor; en modo derivado, X es el prefijo común de las filas.
7. Una letra final se imprime pegada al número («14a») y los saltos usan ese mismo rótulo.
8. El «Especifique» en línea (44) no consume número.

## 40 · Saltos — un solo evaluador

1. Para cada opción v de la pregunta origen S se evalúa cada `relevant` con S = v y lo demás desconocido. Una variable excluida aguas arriba vale vacío: `=` y `selected()` dan FALSO; `!=` y `not(selected())`, VERDADERO; `!= ''`, FALSO. AND con FALSO es FALSO; OR con VERDADERO es VERDADERO. Tres valores: excluida, incluida, desconocida. Un grupo excluido excluye su contenido.
2. Destino de S = v: la primera pregunta **numerada** posterior a S que no esté definitivamente excluida. Notas, calculados, ocultos y «Especifique» en línea no cuentan ni como destino ni como bloque.
3. No se imprime un salto a la pregunta siguiente, ni hacia atrás, ni a sí misma. Si el bloque condicionado está antes de S, no es salto: va como condición (41), con aviso.
4. «Fin de la encuesta» si y sólo si todas las preguntas numeradas posteriores quedan excluidas para v. Una nota condicionada a v con texto de cierre se imprime junto al Fin.
5. **Salto de salida:** si una pregunta Q condicionada a S ∈ V va seguida de una pregunta excluida para todo v ∈ V, bajo Q se imprime «Pase a Pk», con Pk el primer destino común no excluido.
6. Una pregunta excluida por **otra** condición queda «desconocida»: el salto se detiene ahí y ella lleva su propia condición.
7. `paper_skip` manual manda sobre el inferido. El salto se calcula una vez por opción, sin «el primero que aparezca».
8. El consentimiento sale de la regla 4, sin heurística de «toda opción que no sea la primera».

## 41 · Condiciones — el papel nunca pierde un filtro

1. Primero reducir: OR de igualdades o `selected()` sobre una variable → conjunto (cubre la 40); AND de `!=` sobre una variable → conjunto complemento; quitar lo implicado por el contexto (condición del grupo, consentimiento ya resuelto con Fin).
2. Una pregunta condicionada no lleva condición impresa sólo si su `relevant` cubre una sola variable S, todas las opciones que la excluyen tienen salto posterior a ella y todas las numeradas entre S y ella también quedan excluidas. En cualquier otro caso se imprime la condición, también en modo «saltos».
3. Redacción imperativa, con número impreso, código y rótulo, y alcance cerrado: «FILTRO — Aplique sólo si P7 = 1 «Sí» y P12 = 2 «No». Si no, pase a P15.» En módulo: «Aplique este módulo sólo si …; si no, pase a P21.» Comparaciones: «si P4 es 18 o más». `!= ''`: «si respondió P4».
4. Las notas condicionadas llevan su condición aunque no tengan número.
5. Átomos no imprimibles: metadatos y guardas técnicas (`${collectorID} != ''`) se asumen verdaderos, se quitan y se avisa; un `calculate` usa su rótulo o da aviso bloqueante; referencias a notas o grupos dan aviso de dato; una referencia a una pregunta posterior se imprime con su número y aviso.
6. Invariante: ningún salto impreso desde S = v aterriza en una pregunta cuya condición impresa es falsa bajo S = v. Por construcción, salto y condición salen del mismo evaluador.
7. Nunca se imprime XPath crudo (`${`, `selected(`, `!=`).

## 44 · Campos sin rótulo y campos de control

| Caso | Qué se hace |
|---|---|
| `date` con `today()`, `start`, `end` | Campo de control **sin número**: «Fecha de entrevista: __/__/____», «Hora de inicio», «Hora de término», con etiqueta `[var]` |
| Número de cuestionario (`n_cuestionario`, `num_encuesta`) | Se vincula a la casilla «N.º de cuestionario» de la cabecera; si está apagada, campo de control sin número |
| Filas `appearance=label` (cabecera de table-list) | Se omiten en silencio; su lista es la cabecera de la matriz siguiente, sin cortar su detección |
| geopoint y similares | Se omiten con aviso |
| Variables de proceso (`_recod`, `_cod`, agrupaciones como `edadg`) | Se omiten con aviso, aunque tengan rótulo |
| «Otro, especifique» | Detección **estructural**: `text` cuyo `relevant` es simple sobre la pregunta inmediatamente anterior, con rótulo vacío o genérico («Especifique»). Va en línea bajo la opción, sin número, con `[var]`. Con rótulo sustantivo sigue siendo pregunta |

## 46 · Selección múltiple

Nunca un salto por opción con origen múltiple, ni para una opción exclusiva. La condición va en la pregunta destino: «Aplique sólo si en P14 marcó «Otro» (96)», «si marcó «A» o «B»», «si NO marcó «Ninguno»», «si marcó dos o más».

## Cómo se verifica

Un **simulador de recorrido** sobre el modelo impreso: para cada opción de cada origen (con combinaciones para los AND), el conjunto de preguntas alcanzadas siguiendo números, saltos, saltos de salida y condiciones debe ser igual al que declaran los `relevant` evaluados. Además, en el artefacto: números únicos; en modo secuencial, sin huecos; toda pregunta con número distinto a su variable lleva `[var]`; ningún número impreso mayor que N; ningún XPath en el texto; toda variable de captura tiene lugar en el papel o figura en el aviso de omitidas.

Esperados en el corpus: CCSS `acepta` 1 sin salto, 2 → Fin; Polarización `consentimiento` 0 → Fin y `grupo` sin salto; Contabilidad p1 2 → Fin; MedVida y MDV `Consent` No → Fin; CCSS A6: 2 → A6.1, 4/5 → A7, y A6.1 con «Pase a A7»; MedVida no imprime ningún número mayor que N.
