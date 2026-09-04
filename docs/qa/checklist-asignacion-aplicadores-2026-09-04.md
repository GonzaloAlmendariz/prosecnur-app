# Checklist · Asignación de aplicadores (dictados del 2026-09-04)

Superficie: Monitoreo › cursos-horario › Modelo › Carga › **Asignación**
(`AulasAsignacionDeAplicadores.tsx`, motor `monitoreo_aulas_reparto.R`).

Cuatro dictados seguidos sobre la misma vista. Un ítem por indicación, con
dónde vive y su estado. Sólo el usuario lo da por terminado.

| # | Indicación (sus palabras) | Dónde vive | Estado |
|---|---|---|---|
| 1 | «Seleccionable o no; en este caso sí quiero que se active»: concentrar los cursos-horario de un aplicador en uno o dos días | motor `monitoreo_aulas_reparto()` + config `reparto_concentrado` (default TRUE) + mando del panel | **hecho, verificado en el operativo real** |
| 2 | «La asignación nunca va a ser total; siempre voy a tener que establecer una fecha de asignación» | control de rango B75, ya existía; faltaba **declarar** el estado sin fechas | **hecho** |
| 3 | «Quiénes no tienen asignación deben estar al principio» y luego los de mayor carga | orden del rail de CARGAS | **hecho** |
| 4 | «En cuántos días toma en cuenta esa asignación» | marca de días junto a la cifra de carga | **hecho** |
| 5 | «Si le doy clic a un aplicador, que me diga: aplica este día y este otro, en estos horarios» | desglose al fijar la fila del rail | **hecho** |
| 6 | «Que yo pueda cambiarlo, ya no me gustó esa asignación, se la cambio a esta otra persona» | selector por cita (B36) | **ya existía, verificado** |
| 7 | «El nombre normalizado: apellido, coma, nombre y nombre. Y en mayúsculas donde sea y en minúsculas donde corresponde» | `nombreDeAplicador.ts`, sólo presentación; el crudo sigue siendo la identidad | **hecho** |
| 8 | «Automático no necesita una palabra grandota y un guion, eso es muy AI slop; necesita tener el nombre» | opciones del selector de la tabla | **hecho** |
| 9 | «Automático debe ser un aviso pequeño, no el brillito cliché; y si lo cambias, cambia de loguito y se pone manual» | sello automática/manual; el manual es además el camino de vuelta | **hecho, probado con un cambio real y revertido** |
| 10 | «Rango de aplicación quizás necesite mejores etiquetas y claridad sobre cómo se está aplicando»; y hay ancho libre sin usar | columna **Horario**: recoge, sale, aplica de X a Y | **hecho** |
| 11 | «Basta de los em dashes» | todo texto visible de la vista y del aviso que se copia al chat | **hecho, con test que lo sujeta** |
| 12 | «Los avisos deben permitir hacer algo: qué cursos se quedan sin aula, por qué no hay disponibilidad a esa hora, quiénes sí tienen disponibilidad a esa hora» | `salidasDelReparto.ts` + bloque de causa en descubiertos + bloque de libres | **hecho** |
| 13 | «No debe ser un check, debe ser un switch» | `components/Switch.tsx` sobre la clase `.pulso-switch` que ya existía en el tema | **hecho** |
| 14 | «Le falta formato a este box» | panel de mandos: rótulo «Cómo se reparte», aire y alturas parejas | **hecho** |
| 15 | «Y al texto de arriba» | vigencia partida en dos renglones; el protocolo, tres pasos con divisor | **hecho** |
| 16 | *(defecto encontrado al mirar su captura)* el nombre largo se montaba sobre la cifra en el rail | un `<button>` computa `white-space: nowrap`; se declara `normal` | **hecho** |

## Lo aprendido, para no reinvestigarlo

- **La concentración funciona y se puede medir.** Sobre `HSVG26ULT2.pulso`, con
  las mismas 29 aplicaciones repartidas: encendida moviliza **21 personas en 21
  días-persona**; apagada, **28 personas en 29 días-persona**. Ocho viajes al
  campus de diferencia.
- **El bloque de libres destapó algo que conviene decidir.** Con la
  concentración encendida, `Rodríguez Zárate, Marco` y `Simon Cosme, Jhonny
  Cesar` declaran **lunes a sábado de 08:00 a 22:00** y se quedan en cero. No es
  que sus horarios no calcen: es que el criterio llena la jornada de quien ya
  está antes de abrir a otra persona, y con pocos días de operativo nunca se
  llega a ellos. Es el precio de concentrar, y ahora se ve.
- **Los tres switches del repo.** El estilo canónico es `.pulso-switch` en
  `app/theme.css` (44×24, encendido en `--pulso-primary`). `analitica` escribía
  el botón a mano y `calcMuestra/universidad/criterios` mantiene una geometría
  propia de 34×20 con acento morado. `components/Switch.tsx` es ahora la pieza a
  la que las dos deberían converger; migrarlas es otra tanda.
- **La identidad del aplicador es el nombre crudo del motor.** `fijadas` mapea
  código a ese nombre exacto, así que el ítem 7 se resolvió en presentación y
  nunca normalizando lo que viaja de vuelta.
- **La vista Asignación no es direccionable.** El conmutador Patrón/Calendario/
  Disponibilidad/Asignación es un `useState` local en `AulasCargaDeCampo`, así
  que no hay `?vista=` que la abra y `__pulsoNav.listo()` responde
  `sin-marca-de-readiness` en esta pestaña. Fuera del alcance de estos dictados,
  pero es deuda de contrato anotada.
- **Cuatro rojos del perfil son anteriores a esta tanda** y siguen abiertos:
  `denominadorDeclarado` (dos), `ejesDeAulas.contract` y `vaciosQueDiagnostican`.
  Leen archivos que esta tanda no tocó, y sus frases tampoco están en HEAD.
