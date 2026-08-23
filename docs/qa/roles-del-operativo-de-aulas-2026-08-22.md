# Quién usa estas pantallas y qué hace con ellas

Gonzalo, después de tres tandas de arreglos puntuales:

> «Sigue todo Monitoreo y Recopiladores francamente horrible y sin formato en sus
> tablas […] debes detenerte a hacerte las grandes preguntas en vez de pulir por
> pulir, hacerte las grandes preguntas como cómo trabaja un agendador, cómo
> trabaja un jefe de campo y un analista, y formular la UI en base a ello.»

Tiene razón y el diagnóstico es preciso: los arreglos de esta serie —códigos
legibles, orden por cadena, columnas sin metadatos— han sido correctos **uno por
uno** y ninguno se preguntó para quién es la pantalla. Este documento es esa
pregunta.

## El error de fondo que arrastran las dos tablas

> «Primordialmente las aulas titulares, por favor. Los reemplazos son esos
> reemplazos que aparecen en caso que no se llegue a lo esperado en el aula
> titular o la titular no haya podido ser efectiva.»

Las tablas listan **700 filas**: 193 titulares y 507 reservas, todas al mismo
nivel. Ordenarlas por cadena fue mejor que barajarlas, pero el mensaje sigue
siendo el mismo: *hay 700 aulas que atender*.

**No las hay.** Hay **193 aulas que visitar** y 507 contingencias que sólo
existen si una titular falla. Una reserva no es trabajo pendiente: es un plan B
que puede no usarse nunca. Con 193 titulares y 507 reservas, la lista dice que el
72 % del trabajo es algo que probablemente no ocurra.

El libro de Excel **ya lo tiene bien**: una fila por titular, con su cadena
desplegada en columnas al lado. La UI copió las filas del plan sin copiar esa
jerarquía.

## Los tres roles

### El agendador — su unidad es el TITULAR

Llama al docente de cada aula titular hasta conseguir fecha y hora. Los 20 campos
del bloque de agenda son literalmente su ciclo de trabajo:

| Para identificar a quién llama | Para llevar la cuenta | Para cerrar |
|---|---|---|
| Curso-horario, docente, **teléfono**, correo, curso, facultad, sesiones y aula | **Medio de contacto**, fecha de llamada, **número de intentos**, status | **Fecha de aplicación**, día, hora, enlace de la ficha, observaciones |

**Qué necesita ver**: sus titulares pendientes, ordenados por urgencia (cuántos
intentos llevan, cuánto hace de la última llamada), con el teléfono a mano.

**Qué NO necesita**: las reservas. No existen para él hasta que una titular se
declara caída. Enseñárselas mezcladas le multiplica la lista por 3,6.

### El jefe de campo — su unidad es el DÍA

Despacha aplicadores a las aulas ya agendadas. Su pregunta es «¿qué se aplica hoy
y quién va?», y la segunda es «¿qué hago con la que se cayó?».

**Qué necesita ver**: la agenda del día —aula, hora, salón, aplicador—, si el
material está listo (ficha QR generada), y **para un aula caída, su siguiente
reserva**, que es el único momento en que la cadena importa.

**Qué NO necesita**: el ciclo de llamadas ya cerrado, ni el banco.

### El analista — su unidad es la CUOTA

Vigila que la muestra se cumpla. No mira aulas: mira **celdas de cuota**
—facultad × sexo— y el ritmo.

**Qué necesita ver**: efectivas contra cuota por celda, brecha, y si el ritmo
alcanza para cerrar. Las aulas sólo le interesan agregadas o cuando una celda
está en riesgo.

**Qué NO necesita**: teléfonos, salones ni códigos de aula uno a uno.

## Lo que se deduce para la UI

1. **La lista primaria es de titulares.** 193 filas, no 700. La cadena de
   reservas se despliega bajo su titular cuando hace falta, y por defecto se
   cuenta —«3 reservas»— sin ocupar tres filas.
2. **El banco no es una lista, es una reserva de capacidad.** Su sitio es un
   contador con acceso, no 1 916 filas.
3. **Cada tabla es de un rol**, y sus columnas salen de la pregunta de ese rol:
   el agendador ve el ciclo de contacto; el jefe de campo, la logística del día;
   el analista, la cuota. Hoy las tres comparten un mismo juego de columnas
   rellenado con lo que trae el payload.
4. **Una tabla que rellena con lo que sobra no es una tabla, es un volcado.** Ese
   es el origen literal de «sin formato»: `preferredColumns` + relleno del
   payload produce una rejilla distinta según qué datos existan ese día.

## Lo que este documento NO decide

El rediseño completo de las tres superficies es un trabajo de producto que
excede un tick y toca decisiones de Gonzalo (qué ve cada rol primero, si hay una
vista por rol o una con modos). Lo que sí queda decidido y es reparable ya:

**la lista primaria son las titulares, y las reservas cuelgan de ellas.**


---

## Aplicado: la lista primaria son las titulares

Primer cambio derivado del análisis, en la tabla del plan de Recopiladores.

| | Antes | Ahora |
|---|---|---|
| Resumen | «2 468 unidades» | «**175 cursos-horario**» |
| Listado | 2 468 filas al mismo nivel | 175 filas, **una por titular** |
| Reservas | una fila cada una | «**11 reservas**», desplegable |
| Banco | 746 filas de trabajo | «**+746 en banco**», fuera de la lista |
| Paginación | 1 de 50 | **1 de 4** |

Tres decisiones que sostienen el cambio:

1. **La cadena se cuenta, no se despliega por defecto.** La reserva importa el
   día que su titular se cae, no antes. El botón declara `aria-expanded`.
2. **Una titular sin reservas lo dice** —«sin reservas»— en vez de dejar la celda
   muda: significa que si esa aula cae hay que ir al banco.
3. **Nada se pierde.** Una reserva cuyo titular no está en el plan, o un rol que
   el motor todavía no traduce, salen al final como huérfanos con «sin titular en
   el plan». Perder una fila en silencio es peor que enseñarla sin sitio — y eso
   lo destapó un test existente, no yo: al agrupar, un rol desconocido
   desaparecía de la tabla.

**Un defecto propio que cazó otro test**: agrupaba a los titulares sólo por su
código operativo, pero `replacement_for` apunta al **nombre** del aula en los
planes venidos del libro. Sus reservas se quedaban huérfanas con la titular
delante. Ahora el titular se registra por código **y** por nombre.

### Lo que queda de la lista

- La barra del módulo sigue diciendo «UNIDADES 2468»: es otro componente.
- Monitoreo tiene el mismo modelo plano en su tabla de agenda.
- Las columnas por rol —agendador, jefe de campo, analista— siguen sin
  diferenciarse: es el trabajo grande que este documento describe y que no cabe
  en un tick.


## Aplicado también en Monitoreo: la agenda es del agendador

La tabla de agenda listaba las 700 filas del plan al mismo nivel. Es **la vista
del agendador**, y él llama titular por titular: una reserva sólo entra en juego
el día que su titular se declara caída.

- La tabla lista **titulares**. Ni el banco —capacidad— ni las reservas de cadena.
- Las reservas **no se esconden**: se cuentan junto al título, «193
  cursos-horario · 507 reservas detrás». Desaparecer 507 filas sin dejar rastro
  sería peor que listarlas.
- La cuenta mira **sólo** las de cadena: sumar el banco diría 1 916 reservas
  donde hay 507.

3 asertos. **Verificación visual pendiente**: la sesión de la app se reinició al
relanzar la API y el plan hay que reimportarlo; el cambio es un filtro y su
efecto está en test, pero no se ha visto en pantalla y eso queda dicho en vez de
darse por hecho.

---

# Qué hace Cálculo de cursos-horario que las otras dos no hacen

> «Siento que la UI de Monitoreo aún le faltan años luz, igual que a
> Recopiladores. Enorme diferencia si la comparamos con Cálculo de
> cursos-horario.» —Gonzalo

Hay un referente **dentro de la misma app** y hay que copiarlo, no inventar. Esto
es el catálogo de lo que hace, mirado en pantalla con el proyecto real.

## Los siete patrones

### 1. Banda de KPIs persistente, y cada cifra dice de dónde sale

Ocho tarjetas fijas arriba en **todas** las secciones: universo de estudiantes,
universo de cursos-horario, estudiantes elegibles, cursos-horario elegibles,
muestra objetivo, sobremuestra operativa, cómo se dimensiona, aulas titulares.

Lo decisivo no es que haya KPIs: es la **tercera línea de cada uno**. Debajo de
«29,027» dice «base completa»; debajo de «190», «P1 · Universidad · 8 · marco
vigente». **Cada cifra lleva su procedencia pegada.**

En Monitoreo los KPIs cambian por sección y su pista, cuando existe, describe la
métrica —no de dónde sale.

### 2. Un rastro conceptual, no una ruta

`DISEÑO VIGENTE · Universo → elegibles → operación → aulas`. No es la navegación:
es **el razonamiento** del que salen las cifras de al lado.

Monitoreo tiene secciones (Fuentes, Agenda, Validación, Consultas, Avance) y
ningún hilo que las una.

### 3. El recorrido ilustrado con «Estás aquí»

Seis pasos en círculos —Definir · Subir bases · Mapear variables · Construir
marco · Calcular · Seleccionar— **con los conectores etiquetados**: «con esto
claro», «ya en Excel», «columnas listas», «sobre eso n», «para cubrir n». Y un
badge morado marcando dónde estás.

Es exactamente lo que Gonzalo pidió como «elementos no diagramados de explicación
ilustrativa». **Monitoreo no tiene ninguno.**

### 4. El mapa del recorrido: el embudo con sus deltas

Vertical, a la derecha: 137,919 filas leídas → **−28,182 excluidas** → 109,737
elegibles → 21,920 población → 2,500 muestra → 193 titulares. Cada escalón con
una línea que lo explica.

Contesta «¿de dónde salió este número?» sin salir de la pantalla. En Monitoreo
esa pregunta no tiene respuesta en ninguna vista.

### 5. La cadena de conversión, explicada en prosa

«Conversión de N a cursos-horario»: 2,500 → 11–40 → 190 → 288, y **debajo el
párrafo que lo explica**:

> «El divisor son estudiantes elegibles por curso-horario (no matriculados
> totales), calculado **por facultad**: por eso va de 11–40 […] Cada curso-horario
> rinde alrededor del 58 % de sus elegibles. Cada titular lleva R1–R11 reservas
> equivalentes +1 curso-horario de reserva operativa por facultad — **no cambian
> la muestra**.»

Un analista que abre eso entiende el cálculo. **Ninguna pantalla de Monitoreo
explica lo que enseña.**

### 6. Estado declarado por cifra

Badges «cifra validada» en verde junto a los números que ya están cerrados, y
«Guardado» / «Cálculo listo» arriba. Se sabe **qué es firme y qué no**.

Monitoreo declara estados de aulas, no de sus propias cifras.

### 7. Tablas con columnas del dominio y una columna de acción

«Detalle por facultad»: FACULTAD · CUOTA · EST./CURSO-HORARIO · TITULARES ·
RESERVAS · EXTRA · **A COORDINAR** —la última en negrita, porque es lo que hay
que hacer—.

Las tablas de Monitoreo y Recopiladores llevan las columnas que trae el payload,
sin jerarquía y sin ninguna que diga qué hacer.

## Lo que se deduce

La diferencia no es estética. Cálculo **enseña a leerse**: cada cifra tiene
origen, cada paso tiene sitio en un recorrido, y lo que no es obvio está
explicado en prosa al lado. Monitoreo y Recopiladores **muestran datos y esperan
que el lector sepa**.

Los siete patrones son reutilizables tal cual y ya existen como componentes en el
módulo de Cálculo. El trabajo no es diseñar: es **trasladarlos** con el contenido
de cada rol —el agendador, el jefe de campo, el analista— que este mismo
documento describe arriba.


---

## Trasladado el patrón 4: el recorrido del operativo

Primer patrón del catálogo llevado a Monitoreo, reutilizando el componente que ya
existe —`FlujoVertical`, que soporta etapas con valor, detalle, estado y **merma
en la arista**—.

En pantalla, sección Fuentes, con el proyecto de 193:

> **Del plan a las encuestas que cuentan** · *dónde está cada curso-horario ahora
> mismo*
>
> **193** cursos-horario del plan · *titulares sorteados* → **−193 sin aplicar
> todavía** → **0** aplicadas en campo

Tres decisiones que lo hacen honesto:

1. **Sin plan no hay embudo.** Un recorrido de ceros no explica nada y ocupa el
   sitio de un vacío que sí podría decir qué falta.
2. **Las respuestas sólo entran si la plataforma trajo algo.** Sin fuentes
   conectadas, dos escalones en cero dirían que se perdió todo el camino.
3. **La merma no acusa**: lo que falta por aplicar es trabajo pendiente, no una
   pérdida, y el rótulo lo dice —«sin aplicar todavía»—.

7 asertos. **Deuda declarada**: `FlujoVertical` vive en `features/calcMuestra/` y
se importa entre features. Moverlo a `components/` tocaría muchos imports de otra
feature a la vez; queda anotado en el propio import.

### Lo que sigue del catálogo

Patrones 1 (KPIs con procedencia), 3 (recorrido con «estás aquí»), 5 (explicación
en prosa), 6 (estado por cifra) y 7 (columna de acción). El 2 —el rastro
conceptual— exige decidir antes cuál es el hilo que une las secciones de
Monitoreo, y eso es una decisión de producto.


## Trasladado el patrón 1: cada cifra dice de dónde sale

En Cálculo, bajo «29,027» dice «base completa» y bajo «190», «P1 · Universidad ·
8 · marco vigente». En Monitoreo la pista decía sólo **qué** se cuenta.

El KPI del plan pasa de «titulares y sus reservas encadenadas» a **«titulares y
reservas · sorteo del 22 de agosto»**. Conserva lo que ya resolvía —un equívoco
de denominador real, documentado— y añade lo que faltaba: con dos corridas en el
mismo estudio, de cuál salen esas 700.

Verificado en pantalla. Y comprobado antes de escribirlo que `selection_run_id`
**viaja en el dashboard** (`monitoreo_aulas_universitarias.R:1847`), en vez de
darlo por hecho.

Tres abstenciones: sin corrida se conserva la pista de siempre —un plan venido
del libro no la trae, e inventarle una fecha sería peor—; una corrida con forma
rara no produce «Invalid Date»; y la fecha sale del id, no del reloj.

### Un efecto colateral de mi propio cambio, cazado al mirar

Desde que la agenda lista titulares, su aviso seguía diciendo «ninguno de los
**700** cursos-horario» al pie de una tabla de **193**: dos denominadores en la
misma pantalla otra vez. Es el mismo patrón que dejó «Libro de 2616 aulas» sobre
un libro de 190 — **al cambiar lo que se cuenta hay que revisar quién lo cuenta**.
Ahora usa los titulares.

4 asertos del KPI; 711 tests del perfil en verde.


## Trasladado el patrón 5: la explicación debajo de las cifras

Cálculo pone bajo su cadena de conversión un párrafo que explica **por qué** el
divisor son elegibles y por qué las reservas no cambian la muestra. Un analista
que lo abre entiende el cálculo. Monitoreo no explicaba nada de lo que enseña.

En pantalla, bajo el recorrido:

> Un curso-horario cuenta como aplicado cuando su parte de campo lo declara,
> aunque todavía no haya llegado ninguna respuesta: el parte lo escribe quien
> estuvo en el aula y las respuestas llegan por la plataforma, que es otro camino.
>
> Las reservas no aparecen en este recorrido: entran sólo cuando su titular se
> cae, y entonces lo sustituyen — el plan sigue teniendo 193 cursos-horario que
> visitar, no uno más.

**Cada frase corresponde a una regla del motor, no a una intuición**, y las
referencias están escritas en el código:

| Frase | Regla |
|---|---|
| aplicado ≠ con respuestas | `:1211` los combina con un OR, no con un AND |
| una reserva sustituye, no suma | la cadena es un slot con respaldos |
| cuentan las que pasan **todos** los filtros, y una columna ausente no descarta | `:974` |

El tercer párrafo —el de los filtros— **no aparece** hasta que la plataforma trae
respuestas: explicar un filtro que todavía no se aplicó sería ruido.

5 asertos, escritos para que si una de esas reglas cambia, la frase deje de ser
verdad y el test lo diga.
