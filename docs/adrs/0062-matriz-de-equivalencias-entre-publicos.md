# ADR 0062: La equivalencia entre públicos se declara, no se adivina

Estado: Aceptada

Implementacion: En curso

Fecha: 2026-08-06

Fecha de decision: 2026-08-06

Reemplaza: —

Extiende: ADR 0061 (la config de Analítica pertenece a su base)

Relacionados: ADR 0036 (el filtro de universo se materializa en Carga y se
hereda), ADR 0044 (jerarquía módulo→sección→pestaña y direcciones enlazables),
ADR 0043 (Acreditación Contabilidad como proyecto de referencia donde se mide
este caso)

## Contexto

En un estudio multiactor con bases separadas, la misma pregunta vive en cada
público con un nombre de variable distinto. Medido en Acreditación Contabilidad:

| Pregunta | docentes | estudiantes | egresados | administrativos |
|---|---|---|---|---|
| ¿Conoce el servicio de salud? | `p13_1` | `p11_1` | `p18_1` | `p10_1` |
| ¿Ha utilizado el servicio de salud? | `p14_1` | `p12_1` | `p19_1` | `p11_1` |
| Satisfacción con el servicio de salud | `p15_1` | `p13_1` | `p20_1` | `p12_1` |

**El modelo no tiene dónde guardar esa tabla.** Cada base conoce su instrumento
y ninguna conoce su correspondencia con las demás, así que comparar públicos es
hoy un acto de memoria del analista frente a un selector que no lo ayuda.

Dos consecuencias medidas sobre ese estudio:

1. **La comparación falla en silencio.** En la lámina «prueba 2» del PPT
   entregado, un grupo comparaba docentes `p13_2` (¿Conoce bienestar
   psicológico?, 90 %) contra estudiantes `p12_2` (¿Ha utilizado bienestar
   psicológico?, 31 %) bajo el título «Servicio de salud». Se lee como una
   brecha enorme entre públicos y son preguntas distintas. El guard de escalas
   no podía verlo: ambas son Sí/No, misma firma.
2. **El selector no desambigua.** El importador de SurveyMonkey traduce una
   matriz a `note` con el enunciado más N `select_one` etiquetados sólo con el
   texto de la fila, así que cada base ofrece tres variables que dicen
   literalmente «Servicio de salud» y sólo la lista de opciones las separa. El
   ADR 0061 evitó que la etiqueta curada de una base contamine a otra, pero no
   provee la etiqueta ni la correspondencia.

El equipo ya resolvió las dos cosas **fuera de la app**, a mano, en una matriz de
sistematización: 154 filas con el código de cada público, una etiqueta estándar
curada (152 de 154), la sección temática y en cuántos públicos existe cada
pregunta. Los códigos calzan con los instrumentos sin una sola pérdida
—100/100, 87/87, 73/73, 35/35— traduciendo con la misma regla lexical del
normalizador (`q0013_0001` → `p13_1`).

Es decir: el dato existe, es correcto y hoy no entra al sistema.

## Decision

**El estudio puede declarar la equivalencia de sus preguntas entre públicos, y
esa declaración es un insumo de Carga que Analítica y Gráficos consumen.**

1. **Vive en Carga, como pestaña propia.** Carga es donde el estudio declara qué
   es cada base y cómo se relacionan; Plan ya pregunta cuántas bases hay y qué
   relación tienen. La equivalencia es una afirmación sobre las fuentes, no un
   análisis. Analítica y Gráficos la consumen; no la definen.

2. **Es opcional y condicional.** La pestaña sólo se ofrece cuando el estudio
   tiene bases que no comparten instrumento, con el **mismo predicado** que el
   ADR 0061 usa para scopear la configuración
   (`.analitica_config_es_por_base`): topología `separate`/`independent` con más
   de una base. Un estudio de una sola tabla, o de bases integradas, no la
   necesita y no la ve. Una regla, un sitio.

3. **Dos direcciones: el editor y el Excel.** *(Enmendada el 2026-08-06; la
   redacción original ponía al Excel como vía principal. Ver «Enmienda» al
   final.)* El mapeo se hace en la pestaña. Además, la app **emite** una
   plantilla poblada con las variables y etiquetas de cada base y **acepta** un
   archivo en ese formato, para estudios que ya lo tienen resuelto por fuera.
   Que el formato lo produzca quien lo consume es lo que evita la deriva entre
   lo que el Excel trae y lo que el importador espera.

4. **Acepta nombres crudos de plataforma.** El importador normaliza `q00NN_000M`
   a `pNN_M` con la regla existente del normalizador, además de aceptar los
   nombres ya canónicos. Exigir sólo la forma canónica invalidaría las matrices
   que los equipos ya tienen escritas contra el export de la plataforma.

5. **La declaración alimenta, no sustituye.** El importador escribe la etiqueta
   estándar en `analitica_config_por_base[[base]]`, **nunca** en la
   configuración global del proyecto. Escribirla en la global reintroduciría el
   defecto del ADR 0061 a mayor escala: en el estudio medido serían 152
   etiquetas filtrándose entre públicos en vez de 10.

6. **Una edición manual posterior gana, y se declara.** Si el analista edita una
   etiqueta en Analítica → Datos después de importar, esa edición manda: es
   posterior y explícita. La pestaña muestra qué filas de la matriz están
   sobreescritas, para que nadie crea aplicada una etiqueta que no lo está.

7. **La declaración se sella contra los instrumentos que la validaron.** Al
   importar se guarda, por base, la huella del conjunto de variables del
   instrumento. Si un instrumento cambia después, la pestaña lo dice en vez de
   seguir aplicando una correspondencia que pudo dejar de ser cierta. Un
   artefacto externo y manual no puede avisar por sí solo de su propio desfase;
   el sello es lo que lo convierte en verificable.

8. **Lo que la app calcula no se le pide al analista.** En cuántos públicos
   existe una pregunta se deriva de las columnas llenas, no se escribe. Se usa
   para advertir cuando una comparación cubre menos públicos de los que el
   estudio tiene.

## Consecuencias

**A favor**

- La comparación entre públicos deja de depender de la memoria: se elige la
  pregunta y cada lámina resuelve la variable de su base.
- La etiqueta ambigua que deja el importador de matrices se resuelve una vez y
  para las cuatro bases, con el texto que el equipo ya redactó.
- El error de la lámina «prueba 2» pasa a ser detectable: comparar dos filas
  distintas de la matriz es un dato, no una intuición.

**En contra, y asumido**

- **Es trabajo manual del analista.** Emparejar 154 filas cuesta, aunque la
  plantilla llegue poblada. Se acepta porque la alternativa —inferir la
  correspondencia por parecido de etiquetas— produce emparejamientos plausibles
  y falsos, que es peor que no tenerlos: un emparejamiento inventado se ve igual
  que uno correcto en la lámina resultante.
- **Puede quedar desfasada.** El sello lo detecta, no lo impide. Un estudio que
  cambie su instrumento tendrá que revisar la matriz.
- **Añade una pestaña a Carga**, que ya tiene cinco. Se acota con la
  condicionalidad: la mayoría de estudios no la verá nunca.

**Invalidado por esta decisión**

- Inferir equivalencia entre públicos por similitud de etiquetas o por posición.
- Comparar variables de bases distintas sin declaración previa, en cualquier
  superficie que produzca un entregable.
- Escribir la etiqueta estándar en la configuración global del proyecto.

## Cumplimiento

- Un caso comprueba que la pestaña **no** se ofrece con topología
  `integrated`/`single` ni con una sola base, y sí con `separate`/`independent`
  y más de una, reusando el predicado del ADR 0061.
- Un caso de ida y vuelta: generar la plantilla de un estudio, rellenarla,
  importarla y comprobar que la equivalencia resultante es la esperada.
- Un caso comprueba que los códigos crudos de plataforma (`q0013_0001`) y los
  canónicos (`p13_1`) producen la misma equivalencia.
- Un caso comprueba que la etiqueta estándar aterriza en
  `analitica_config_por_base[[base]]` y que la configuración global **no** se
  toca — el guard directo contra la regresión del ADR 0061.
- Un caso comprueba que, cambiado el instrumento de una base, el sello deja de
  coincidir y la declaración se reporta desfasada.
- Verificación sobre estudio real: importar la matriz de Acreditación
  Contabilidad y comprobar las 152 etiquetas aplicadas en las cuatro bases, y
  que la comparación de la lámina «prueba 2» queda señalada como preguntas
  distintas.

## Notas

- Formato canónico de la plantilla: una fila por pregunta; `seccion` (se rellena
  hacia abajo, como en las matrices reales, donde vive en celdas combinadas),
  `etiqueta_estandar`, y por cada base una columna con el nombre de la variable
  más una columna de etiqueta **de sólo lectura** que la app rellena para que el
  analista reconozca la fila.

### Dónde encaja en la red de decisiones

- **ADR 0061** es la precondición. Sin la configuración scopeada por base, este
  ADR sería dañino en vez de útil: escribir 152 etiquetas en una configuración
  compartida multiplicaría por quince el defecto que el 0061 cerró. Por eso la
  regla 5 —escribir siempre en `analitica_config_por_base`— no es una precaución
  sino la condición que hace seguro a este ADR.
- **ADR 0036** fija el precedente de forma: una declaración del analista que se
  materializa **en Carga** y se hereda hacia abajo. El filtro de universo dice
  qué filas son entrevistas reales; la equivalencia dice qué preguntas son la
  misma. Ambas son afirmaciones sobre las fuentes, no análisis, y por eso viven
  en la misma sección.
- **ADR 0044** gobierna dónde se cuelga la pestaña y cómo se alcanza: la
  dirección es `procesamiento/carga/equivalencias`, enlazable como cualquier
  otra, y la condicionalidad se declara en el catálogo de pestañas —el mismo
  mecanismo que ya usa `analitica/multibase`— y no con un condicional suelto en
  la página.
- **ADR 0043** es el banco de prueba: Acreditación Contabilidad es el proyecto de
  referencia donde este caso está medido, y es contra él que se verifica la
  importación de punta a punta.
- El origen de la ambigüedad que hace necesaria la etiqueta estándar está en
  `api/R/surveymonkey_api.R`, rama `fam == "matrix"`. Conservar el enunciado de
  la matriz en una columna propia del survey sigue siendo trabajo aparte y
  reduciría —sin eliminar— la necesidad de curar etiquetas a mano.


## Enmienda — 2026-08-06: la vía principal es el editor

**Qué cambia.** La decisión 3 ponía al Excel como vía principal. Se invierte: el
mapeo se hace en la pestaña y el Excel queda como import/export.

**Por qué.** La plantilla generada sale con **300 filas sin emparejar** —una por
variable de cada base— frente a las **154 ya emparejadas** de la matriz que el
equipo mantenía a mano. La forma sin emparejar es correcta *para un archivo*: en
un Excel una sugerencia se vuelve indistinguible de una decisión y termina en una
lámina sin que nadie lo note. Pero es peor para trabajar, y el juicio del usuario
fue directo: «el formato de Excel que te pasé es mucho más intuitivo».

En una herramienta el dilema no existe. Una propuesta puede **verse como
propuesta** —marcada, con su chip, confirmable de un clic— y no se guarda mientras
nadie la confirme. Eso conserva la prohibición original sin pagar su costo.

**Qué se conserva sin cambios.** Las reglas 1, 2, 4, 5, 6, 7 y 8. En particular la
5 —escribir siempre en `analitica_config_por_base`— que es la que hace seguro a
este ADR frente al 0061.

**Qué se añade.**

- **Propuestas de emparejado** por la terna (etiqueta normalizada, firma de
  escala, ordinal de aparición). Las dos primeras no bastan: en el estudio medido
  «Servicio de salud» con escala Sí/No aparece dos veces por base —«¿Conoce?» y
  «¿Ha utilizado?»— y sólo el orden las separa. Medido contra las cuatro bases
  reales: 84 propuestas, 17 en los cuatro públicos y 28 en tres, que coinciden
  con los conteos de la matriz hecha a mano.
- **Una etiqueta que se repite entre propuestas no se prellena.** Ofrecer
  «Servicio de salud» como etiqueta estándar de tres filas distintas reproduce la
  ambigüedad que este ADR existe para eliminar, y encima invita a confirmarla de
  un clic. El campo vacío pide lo único que el analista tiene que aportar.
- **`diapositiva` por fila.** La matriz real ya la traía como `Diapo` —133 de 154
  filas asignadas a 44 láminas, 42 de ellas con más de una pregunta—. Declararla
  es lo que permite que Gráficos derive el mazo en vez de armarlo lámina por
  lámina. **El consumo desde Gráficos lo decide el ADR 0063.**

**Invariantes nuevos, verificados por test.**

- Una propuesta sin confirmar **no se guarda**.
- Una variable **no puede estar en dos filas**: serían dos preguntas donde hay
  una, y el conteo por público —y el gráfico que salga de él— quedaría mal sin
  ninguna señal en pantalla.
- Una propuesta que choca con algo ya decidido **se descarta entera**, no a
  medias: aceptarla parcialmente produciría una fila que dice ser la misma
  pregunta en tres públicos cuando el analista sólo confirmó dos.
