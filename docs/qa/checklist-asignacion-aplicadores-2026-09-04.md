# Checklist · Asignación de aplicadores (dictados del 2026-09-04)

Superficie: Monitoreo › cursos-horario › Modelo › Carga › **Asignación**
(`AulasAsignacionDeAplicadores.tsx`, motor `monitoreo_aulas_reparto.R`).

Tres dictados seguidos sobre la misma vista. Un ítem por indicación, con dónde
vive y su estado. Sólo el usuario lo da por terminado.

| # | Indicación (sus palabras) | Dónde vive | Estado |
|---|---|---|---|
| 1 | «Seleccionable o no; en este caso sí quiero que se active»: concentrar los cursos-horario de un aplicador en uno o dos días | motor `monitoreo_aulas_reparto()` + config `reparto_concentrado` (default TRUE) + toggle en el panel de mandos | **hecho, verificado en el operativo real** |
| 2 | «La asignación nunca va a ser total; siempre voy a tener que establecer una fecha de asignación» | control de rango B75, ya existía; faltaba **declarar** el estado sin fechas | **hecho** |
| 3 | «Quiénes no tienen asignación deben estar al principio» y luego los de mayor carga | orden del rail de CARGAS | **hecho** |
| 4 | «En cuántos días toma en cuenta esa asignación» | marca de días junto a la cifra de carga | **hecho** |
| 5 | «Si le doy clic a un aplicador, que me diga: aplica este día y este otro, en estos horarios» | desglose al fijar la fila del rail | **hecho** |
| 6 | «Que yo pueda cambiarlo, ya no me gustó esa asignación, se la cambio a esta otra persona» | selector por cita (B36) | **ya existía, verificado** |
| 7 | «El nombre normalizado: apellido, coma, nombre y nombre. Y en mayúsculas donde sea y en minúsculas donde corresponde» | helper de presentación nuevo; el nombre crudo sigue siendo la identidad que viaja al motor | pendiente |
| 8 | «Automático no necesita una palabra grandota y un guion, eso es muy AI slop; necesita tener el nombre» | opciones del selector de la tabla | pendiente |
| 9 | «Automático debe ser un aviso pequeño, no el brillito cliché de siempre; y si lo cambias, cambia de loguito y se pone manual» | sello automática/manual junto al selector | pendiente |
| 10 | «Rango de aplicación quizás necesite mejores etiquetas y claridad sobre cómo se está aplicando»; y hay ancho libre a la derecha sin usar | columna de horas de la tabla | pendiente |
| 11 | «Basta de los em dashes» | todo texto visible de la vista | pendiente |
| 12 | «Los avisos deben permitir hacer algo: qué cursos se quedan sin aula, por qué no hay disponibilidad a esa hora, quiénes sí tienen disponibilidad a esa hora» | veredicto de equidad y bloque de descubiertos; **exige la malla de disponibilidad, que hoy no llega a este componente** | pendiente |

## Lo aprendido, para no reinvestigarlo

- **La concentración funciona y se puede medir.** Sobre `HSVG26ULT2.pulso`, con
  las mismas 29 aplicaciones repartidas: encendida moviliza **21 personas en 21
  días-persona**; apagada, **28 personas en 29 días-persona**. Ocho viajes al
  campus de diferencia.
- **De dónde sale cada dato del aviso accionable (ítem 12).** La oferta vive en
  `dashboard.disponibilidad`: `dias[].franjas[]` con `{inicio, fin, disponibles,
  nombres[]}` por día de semana. Hoy `AulasCargaDeCampo` la recibe pero **no la
  pasa** a `AulasAsignacionDeAplicadores`; sin ese cable el aviso sólo puede
  describir, no resolver.
- **La identidad del aplicador es el nombre crudo del motor.** `fijadas` mapea
  código a ese nombre exacto, así que el ítem 7 se resuelve en presentación y
  nunca normalizando lo que viaja de vuelta.
- **La vista Asignación no es direccionable.** El conmutador Patrón/Calendario/
  Disponibilidad/Asignación es un `useState` local en `AulasCargaDeCampo`, así
  que no hay `?vista=` que la abra y `__pulsoNav.listo()` responde
  `sin-marca-de-readiness` en esta pestaña. Fuera del alcance de estos dictados,
  pero es deuda de contrato anotada.
