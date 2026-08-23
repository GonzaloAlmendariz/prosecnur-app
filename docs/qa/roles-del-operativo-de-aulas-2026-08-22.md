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
