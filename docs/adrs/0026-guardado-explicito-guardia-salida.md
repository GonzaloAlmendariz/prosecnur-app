# ADR 0026: Guardado explicito y guardia de salida

Estado: Aceptado

Fecha: 2026-06-26

## Contexto

Prosecnur usa proyectos `.pulso` como archivo portable del trabajo local. El
guardado silencioso del archivo cada pocos minutos reducia friccion, pero
tambien hacia menos claro cuando el estado habia sido escrito realmente en
disco y podia competir con cierres, cambios de proyecto y flujos que generan
estado derivado.

La aplicacion ya mantiene una sesion local en memoria y muchos modulos guardan
su configuracion en esa sesion con debounce. Esa persistencia interna es util
para la fluidez de la interfaz, pero no debe confundirse con escribir el
archivo `.pulso` portable.

## Decision

El archivo `.pulso` se guarda por accion explicita del usuario: Guardar,
Guardar como, Guardar y volver al selector, o Guardar y cerrar. Los modulos
pueden seguir persistiendo estado editable en la sesion local, pero no deben
ejecutar `build_pulso()` ni `POST /api/project/save` de forma silenciosa.

Cuando el usuario intenta volver al selector o cerrar Prosecnur con cambios
pendientes, la suite muestra una guardia de salida comun. La accion recomendada
guarda primero y continua solo si el guardado termina bien. El usuario aun
puede continuar sin guardar, con una accion secundaria/destructiva explicita.

El cierre de ventana, Cmd+Q/Salir, el boton de cierre del Home y el menu
Archivo > Cerrar proyecto pasan por el mismo guard del frontend mientras haya
un proyecto activo. Si la app esta en BootGate o no hay guard activo, Electron
puede cerrar directamente.

## Consecuencias

El analista ve con mas claridad que el archivo portable se actualiza cuando
elige guardar. A cambio, algunos cambios pueden quedar solo en la sesion local
hasta que se ejecute un guardado manual; por eso la UI debe marcar el proyecto
como pendiente y proteger las salidas con una confirmacion.

Los autosaves internos de configuracion siguen siendo validos como mecanismo
de sesion. No son una promesa de persistencia del archivo `.pulso`.

## Cumplimiento

- `ProjectShell` concentra los intentos de salida de proyecto y aplicacion.
- El bridge Electron expone solo eventos de intento de cierre y confirmacion
  de cierre.
- No debe existir un hook global que guarde el `.pulso` por intervalo.
- Los autosaves de modulo no deben llamar `apiProjectSave(null)` ni
  `build_pulso()` salvo que el usuario haya solicitado guardar.
- Revision de PR: buscar `apiProjectSave(null)`, `build_pulso(` y textos de
  autoguardado antes de aceptar cambios de persistencia.

## Notas

Relacionado con ADR 0002 (`.pulso`) y ADR 0021 (arranque con proyecto y warm
start).
