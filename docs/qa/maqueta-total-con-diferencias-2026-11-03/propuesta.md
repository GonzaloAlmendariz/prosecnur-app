# Total + diferencias en una sola lámina: evaluación y maqueta

Tipo: Propuesta de diseño
Estado: Vigente
Fecha: 2026-11-03
Autoridad: diseño aprobado por Gonzalo el 2026-11-03 (propuesta 8, tarjetas de diferencias); registrado en el [ADR 0129](../../adrs/0129-tarjetas-de-diferencias-junto-al-total.md)

Documento de diseño de Procesamiento, Gráficos. Esta copia es la que se versiona: las cifras de resultados del estudio que servía de ejemplo se retiraron porque el repositorio es público.

**Situación al cerrar la maqueta: diseño aprobado por Gonzalo el 3 de noviembre de 2026** (propuesta 8, tarjetas de diferencias, en PPT y Word, con su lámina y su apartado de lectura). Artefacto: https://claude.ai/artifact/BHWYdGayRdhQQf4CLPLPma. Queda pendiente la evaluación de viabilidad en el motor y la decisión abierta sobre la definición de "débil" de "Historias del informe".

Las imágenes con datos de CCSS **no se versionan** (el repositorio es público). Viven en la carpeta del estudio: `7. Entregables/Maqueta total con diferencias 2026-11-03/img/` (`r1/` diagnóstico, `r2/` exploración, `r3/` dirección elegida, `referentes/`). Los generadores (`generadores/`) tampoco se versionan: eran scripts de un solo uso para dibujar las variantes.

## 1. Cómo se generan las maquetas

| Paso | Archivo | Qué hace |
|---|---|---|
| Datos | `generadores/datos.R` | Lee el `.pulso` CCSS v6.1 extraído y prueba cada (pregunta, cruce, fila) con la prueba **real** del motor (`.sig_contrastes` de `graficos_significancia_diseno.R`, rama `claude/integracion-ccss-v6`): Rao-Scott por aula, en pares y frente al resto. BH sobre la familia de la maqueta (441 pares y 343 frente al resto), no sobre las 8.596 del estudio |
| Exploración | `generadores/maquetas.mjs` | V1 a V5 (§2) |
| Refinamiento | `generadores/final.mjs`, `generadores/visuales.mjs` | Texto en línea, barras finas (A), pista de puntos (B) y tabla a la derecha (T) |
| PNG | `generadores/render.sh` | Chrome sin cabeza a 2000×1125 (16:9) o A4 |

## 2. Lo que se probó y por qué se descartó

| Variante | Resultado |
|---|---|
| V1, Mini-tabla por fila (el modelo de 2021, limpio) | Tablitas sueltas a distintas alturas; el ojo no encuentra columnas |
| V2, Texto en línea bajo la barra | **Gonzalo: "no me resulta visualmente intuitivo".** La diferencia se lee, no se ve |
| V3, Frases destacadas | Legible, pero las cifras quedan enterradas y el texto automático arriesga redacciones malas |
| V4 / B, Rango o pista de puntos | La más fiel a la magnitud, pero los rótulos se pisan y pide aprender a leerla |
| V5, Matriz fija con celdas vacías | Panel gris casi vacío: las baterías tienen pocas diferencias |
| A, Barras finas bajo el total | Intuitiva por longitud, pero 10 opciones y 6 cruces llenan la lámina (4.73 in de 4.72) |
| **T, Tabla a la derecha, solo cruces con diferencia** | **Dirección elegida.** Columnas fijas (Área, Nivel, Sexo, Estudios de padres), fila de bases, fila alineada con su barra; en cada fila solo aparece el cruce que difiere, con todos sus grupos |

Gonzalo, sobre la tabla con todas las cifras en gris: "fíjate cómo las diferencias que no son significativas no se muestran" (en el modelo). Mostrar todo invitaba a leer brechas que la prueba rechaza.

## 3. Cómo lo hacen consultoras profesionales

Revisión del 2026-11-03: Pew Research Center, Ipsos y el software de tabulación más usado en investigación de mercados en EE. UU. (Q / Displayr).

| Quién | Qué hace | Qué se toma |
|---|---|---|
| **Ipsos Public Affairs** (Singapur, *Trust and Confidence in News Sources*, 2018) | Total en barra apilada arriba y, debajo, **una tabla de banner** con columnas fijas (Total, Género, Edad, Educación), una fila de **bases** y la fila del *top two*. Las celdas significativas llevan **color y flecha ↑↓**; se compara **cada subgrupo contra el resto de la población** al 95%. Las no significativas se muestran en negro | El modo **frente al resto** (es el D7 del ADR 0128), las **columnas fijas por cruce** y la **fila de bases**. No se toma el rojo/verde: falla con daltonismo; aquí van forma ▲▼ + fondo + peso |
| **Ipsos UK** (*Public opinion towards Donald Trump*, septiembre 2025) | Barras apiladas "Among all", luego bloques "By age" y "By GE2024 vote". Sin marcas en el gráfico: la nota metodológica dice que hace falta en general **unos 10 puntos** para hablar de diferencia significativa y llama "slight" a 5–9 | Coincide con el **umbral de 10 puntos** del ADR 0128 |
| **Pew Research Center** (*People with less education express more positive views about right-wing populist parties*, mayo 2026) | Dot plot por grupos, con la nota "Only statistically significant differences are shown" | **Solo lo significativo, y la nota lo declara.** Es la regla que pidió Gonzalo |
| **Pew** (*The Gender Gap in AI*, octubre 2026) | Barras agrupadas hombres/mujeres y, **a la derecha, una columna "DIFF"** con la brecha en puntos, **en negrita si es significativa** | Posible columna de **brecha en puntos** (decisión abierta, §5) |
| **Pew** (mismo informe) | Barra apilada con la fila del total y debajo solo los grupos que interesan | Confirma la jerarquía: total primero, grupos después |
| **Q / Displayr** (ayuda oficial) | Por defecto, **flechas** que comparan cada celda contra su complemento ("exception test"); las **letras** son comparaciones por pares. Advierte que ambas pueden no coincidir | Los dos modos son estándar. Hay que **declarar cuál se usa** y no mezclarlos en un mismo informe sin decirlo (riesgo de §4) |

Conclusión: el formato no es una rareza del informe de 2021. Es el patrón de Ipsos (total + banner con flechas contra el resto) y Pew lo usa con la regla de mostrar solo lo significativo. Lo que la maqueta T agrega frente a Ipsos es **alinear la tabla con cada barra** (Ipsos muestra un solo indicador por lámina) y **no depender del color**.

## 4. Riesgo metodológico que los referentes vuelven visible

El mazo actual marca **letras por pares** (▲A). Este formato marca **frente al resto** (▲▼). No dicen lo mismo. En la maqueta, para una opción de respuesta múltiple cruzada por nivel:

- por pares, la diferencia es **Nivel 8 > Nivel 7** (frágil);
- frente al resto, la diferencia es **Nivel 7 < resto** (frágil).

Con dos grupos (área, sexo, estudios de padres) las dos pruebas son la misma. Con nivel (cuatro grupos) no. Si el informe usa las dos lecturas, la familia de BH y la nota tienen que decir cuál vale en cada lámina.

## 5. Diez propuestas y la elegida: tarjetas de hallazgos (P08)

Las diez propuestas están en el artefacto privado "Total con diferencias" (https://claude.ai/artifact/BHWYdGayRdhQQf4CLPLPma), generadas por `generadores/diez.mjs`. **Gonzalo eligió la P08** (2026-11-03) y pidió desarrollarla también para opción única. Generador: `generadores/tarjetas.mjs`. Imágenes: `img/r5-p08-tarjetas/` en la carpeta del estudio.

| Lámina | Tipo | Caso de la maqueta |
|---|---|---|
| T1 | Respuesta múltiple | Seis tarjetas: dos firmes de un cruce, una de otro y tres frágiles |
| T2 | Dicotómica | Un nivel por encima del resto (firme) y otro por debajo (frágil) |
| T3 | Nominal | Una categoría en la que los dos sexos difieren |
| T4 | Ordinal | Diferencias por nivel y por área en la categoría más alta |
| T5 | Batería de escala | Un ítem en el que las dos áreas difieren |
| T6 | Sin diferencias | Ningún cruce difiere |
| T7 | Capacidad | T1 con tope de 4 tarjetas: la cuarta resume las demás |

Reglas del formato:

1. **Qué es una tarjeta.** Múltiple y batería: una por (opción o ítem, cruce). Dicotómica: una por (grupo, cruce), solo sobre "Sí". Nominal y ordinal: **una por cruce**, con la distribución completa de cada grupo; la categoría que difiere lleva recuadro rojo y ▲▼. Motivo: en opción única, si "3 veces" sube, "4 o más" baja; son la misma diferencia y dos tarjetas la contarían dos veces.
2. **Con dos grupos** la diferencia se atribuye al grupo mayor (el otro es el resto). Con cuatro niveles, cada nivel que difiere es su propia tarjeta (nivel 9 ▲ y nivel 6 ▼ no se funden).
3. **Orden:** firmes primero, de mayor a menor brecha; después las frágiles (borde punteado, "frágil").
4. **Contenido de la tarjeta:** brecha en puntos (columna "DIFF" de Pew), barras del grupo y del resto, bases.
5. **Opción única:** el total usa los mismos colores que la tarjeta y hace de leyenda.
6. **Capacidad:** 6 tarjetas; con más, 5 y una de resumen que remite a las tablas de cruces.
7. **Sin diferencias:** una tarjeta que lo dice y nombra los cruces probados con sus bases.

Hallazgo de la maqueta: en T3 la diferencia sale **firme** con la familia de BH de la maqueta y era **frágil** en la familia depurada del estudio ("Historias del informe"). La familia cambia el veredicto. Con la regla del informe completo, la tarjeta llevaría borde punteado y el título no debería afirmarla.

### 5.1 Versión 2 (vigente)

Indicaciones de Gonzalo sobre la v1: "si no hay significancia no se muestre" y "aún se ve bastante mal". Generador: `generadores/tarjetas2.mjs`. Imágenes: `img/r6-p08-v2/` en la carpeta del estudio. El artefacto quedó solo con esta versión.

| Cambio | Antes (v1) | Ahora (v2) |
|---|---|---|
| Grupos sin diferencia | Aparecían en gris (p. ej. nivel 8) | No aparecen; con dos grupos se muestran los dos porque el otro es el resto |
| Pregunta sin diferencias | Tarjeta que lo explicaba | Sin tarjetas: el total ocupa la lámina y la nota lo dice en una línea |
| Opción única | Barras apiladas por grupo, con recuadro | Una tarjeta por cruce con la categoría de mayor diferencia, en barras simples |
| Referencia | Brecha en puntos y bases en la tarjeta | Una línea roja con el total en las barras; bases al pie |
| Enlace con el total | Números en círculos | La fila del total con tarjeta va en negrita |
| Letra | 7 a 8.5 pt | 9.5 a 11 pt |
| Tarjetas angostas (2 columnas) | Barras de menos de 1 in | Nombre encima de la barra; la barra usa todo el ancho |

### 5.1 bis Dos niveles de significancia con notación académica (versión 3)

Gonzalo pidió dejar "frágil" y, después, "al límite" ("no suena muy académico"). Las tarjetas indican ahora el nivel como se hace en las tablas académicas: *p* < 0.01 (antes "firme") y *p* < 0.05 (antes "frágil"), sobre el *p* ajustado por Benjamini-Hochberg. El nivel se define **solo por el *p***; la magnitud ya la filtra el umbral de 10 puntos. Las diferencias significativas de menos de 10 puntos (las "slight" de Ipsos UK) no se muestran.

| Quién | Nivel fuerte | Nivel débil | No se muestra |
|---|---|---|---|
| JMP, Qualtrics, Q/Displayr | *p* < 0.05 (mayúscula) | 0.05 ≤ *p* < 0.10 (minúscula, "direccional") | *p* ≥ 0.10 |
| Pew, Ipsos UK | Un solo nivel; lo pequeño se modera en la redacción | — | Ipsos UK muestra todo sin marcar |
| Esta propuesta | *p* ajustado < 0.01 | 0.01 ≤ *p* ajustado < 0.05 | *p* ajustado ≥ 0.05, o menos de 10 puntos |

**Versión 4 (vigente).** Gonzalo: mostrar la *p* "es difícil de entender". Eligió **un solo rótulo en la lámina**: la tarjeta no lleva etiqueta de nivel; el segundo nivel se distingue solo por el borde punteado y el △▽ hueco, y la nota al pie lo dice en lenguaje de nivel de confianza ("con 99% de confianza" / "con 95%"). Se agrega una **lámina de lectura** ("Cómo leer las tarjetas de diferencias", `v2-t0-como-leer`), una vez al inicio del informe: tarjeta real ampliada con cinco llamadas (cruce, respuesta, grupo que difiere, con quién se compara, total) y tres bloques (cuándo aparece una tarjeta, qué indica el borde, qué no aparece), con frases cortas y sin relleno.

**Versión 5 (vigente).** Indicaciones de Gonzalo: el total "sigue sin verse bien", "no veo ninguna flecha hacia abajo" y las tarjetas deben ocupar "1/3 del ancho" en una columna y "50%" en dos.

- **El total es la primera fila de la tarjeta, en gris** (como Pew: el total y debajo los grupos). Se eliminan la línea roja y su etiqueta.
- **▲ y ▼ en los dos grupos de un cruce de dos.** Antes solo se marcaba el mayor (regla "sin complementos" del ADR 0128 para las barras agrupadas), y el ▼ casi no aparecía. En la tarjeta, el grupo menor también difiere del resto (que es el otro grupo), así que lleva ▼ con el mismo nivel de confianza.
- **Ancho del panel:** una columna = 1/3 del ancho útil de la lámina; dos columnas = 1/2. El gráfico del total usa el resto. Nombres de grupo abreviados en ambos anchos.
- **Lámina de lectura rehecha** con anotaciones directas (cruce, respuesta, total, ▲ mayor, ▼ menor) unidas a la tarjeta por líneas finas, y tres columnas con el mismo tratamiento: cuándo aparece una tarjeta, qué indica el borde, qué no se muestra.

**Versión 6 (vigente).** Más indicaciones de Gonzalo (2026-11-03):

- **Título = pregunta, sin subtítulo por defecto.** El hallazgo no se dibuja.
- **El gráfico del total conserva el tamaño del mazo** (rótulos de 11 pt, cifras de 12 pt, barras de hasta 0.36 in, escala con segmentos de 0.4 in y acuerdo a 15 pt): las tarjetas no son razón para achicarlo.
- **Nota al pie mínima:** qué indican ▲▼ y el borde, la referencia a la lámina de lectura y las bases. El método vive en la lámina de lectura.
- **Tope de 6 tarjetas, las principales** (99% de confianza primero, de mayor a menor diferencia). Las demás no se dibujan; la nota dice cuántas quedan y que están en las tablas de cruces. Con 7 a 9, una cuadrícula de 3 × 3 es opción excepcional. Se descartó la segunda lámina ("1 de 2") y la tarjeta de resumen en texto.
- **Decidido (Gonzalo, 2026-11-03): "Mitad con 6".** Con 5 o 6 tarjetas el panel pasa a dos columnas y ocupa la mitad de la lámina; el gráfico del total queda más angosto que en el mazo, pero con la misma letra. Con 4 o menos, una columna y un tercio.

**Word A4** (`generadores/tarjetas2.mjs`, páginas `a4-*`; imágenes en `img/r7-word-a4/` de la carpeta del estudio). Página vertical con márgenes de 1 in (6.27 in de texto):

- el gráfico del total arriba, a todo el ancho del texto, con la letra del Word (8.5 pt en los rótulos);
- debajo, el rótulo "Diferencias entre grupos" y las tarjetas en dos columnas: la misma tarjeta del PPT, diseñada a 3.6 in y reducida a 0.8;
- la figura lleva su número y la pregunta, sin subtítulo; la nota es de una o dos líneas;
- la lectura pasa a un recuadro ("Cómo leer las diferencias entre grupos") una sola vez al inicio: partes de la tarjeta y las tres reglas.

El caso más cargado de CCSS (respuesta múltiple con seis tarjetas, más el párrafo) cabe en una página.

**Sin notas por lámina ni por figura** (Gonzalo, 2026-11-03: "innecesario cuando ya se definió al inicio"). Cada lámina y cada figura del Word llevan solo la línea de base y fuente. La lámina de lectura (PPT) y el recuadro de lectura (Word) concentran, una sola vez, los símbolos, el método, las bases por grupo y el tope de 6 tarjetas. El espacio liberado pasa al gráfico.

**Lectura según las referencias de la casa (Gonzalo, 2026-11-03).**

- **PPT:** formato de "Cómo leer las escalas" (lámina 4 del mazo): antetítulo "CÓMO LEER ESTE INFORME", título "Cómo leer las diferencias entre grupos", una frase que define, la tarjeta de ejemplo con anotación directa (llave sobre los grupos), fila de leyenda y el método en una línea. Sin pasos numerados ni encabezados intermedios.
- **Word:** formato de los informes anteriores de Pulso (`Referencias/1. Informes de referencia`, Acreditación Derecho y AMDT 2026), no el del Word que genera el motor. Logos PUCP y PULSO en el encabezado; subsección "2.8. Pautas para la lectura del informe" en prosa justificada, con "como se muestra en la siguiente imagen"; gráficos con "Gráfico N°…" en cursiva centrada y "N = … estudiantes. Fuente: PULSO PUCP 2026." debajo; folio centrado. Las tarjetas van debajo del gráfico, dentro de la misma figura.

Decisión abierta: "Historias del informe" marca además como débil toda diferencia de menos de 12 puntos. Hay que unificarla con esta regla, que usa solo el *p*.

### 5.2 De dónde salen los dos criterios (significativa y de al menos 10 puntos)

No los decidió esta maqueta. Vienen del plan de análisis de CCSS 2026-II, los aplica "Historias del informe" y los fijó el ADR 0128 (D5: 10 puntos por defecto, editable entre 0, 5, 10 y 15). La razón es que responden a preguntas distintas: la prueba (Rao-Scott por aula con Benjamini-Hochberg) dice si la diferencia probablemente existe en la población; el umbral dice si es lo bastante grande para contarla. Con muestras grandes, diferencias de 3 o 4 puntos pueden ser significativas sin cambiar ninguna conclusión. Ipsos UK usa una regla práctica similar (unos 10 puntos; "leve" entre 5 y 9).

## 6. Pendiente

- Escala apilada con la tabla a la derecha (como `top two box` del mazo) y lámina **sin diferencias** (batería de docentes: ningún cruce difiere).
- Word A4.
- Decisión: ¿columna de brecha en puntos al estilo Pew, o solo la tabla?
- Crítica independiente contra el Contrato de Superficie y la armonía visual.
- Evaluación de viabilidad en el motor (graficador o lámina nueva, contrato de datos, opciones del plan, archivos y fases) y recomendación.

## Fuentes

- Ipsos Public Affairs, *Trust and Confidence in News Sources*, septiembre 2018: https://www.ipsos.com/sites/default/files/ct/news/documents/2018-10/ipsos_report_fake_news_updated_3_oct_2018.pdf
- Ipsos UK, *Public opinion towards Donald Trump*, septiembre 2025: https://www.ipsos.com/sites/default/files/ct/news/documents/2025-09/Ipsos%20UK%20Sep%2025_Public%20opinion%20towards%20Donald%20Trump_charts.pdf
- Pew Research Center, *People with less education express more positive views about right-wing populist parties*: https://www.pewresearch.org/chart/people-with-less-education-express-more-positive-views-about-right-wing-populist-parties/
- Pew Research Center, *The Gender Gap in AI*, 16 de octubre de 2026: https://www.pewresearch.org/short-reads/2026/10/16/the-gender-gap-in-ai/
- Q Research Software, *How to Interpret Inconsistent Statistical Testing Results*: https://help.qresearchsoftware.com/hc/en-us/articles/4428761779215-How-to-Interpret-Inconsistent-Statistical-Testing-Results
- Q Research Software, *How to Show Statistical Significance in Q*: https://help.qresearchsoftware.com/hc/en-us/articles/4453394063887-How-to-Show-Statistical-Significance-in-Q
