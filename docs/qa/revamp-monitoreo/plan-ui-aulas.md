# Plan de aplicación a la UI: Monitoreo › Cursos-horario (perfil `aulas`)

Tipo: Plan de implementación
Estado: Vigente
Fecha: 2026-10-25
Autoridad: Gonzalo, textual: «La auditoría de la Meta B es algo que todos los monitoreos deben tener para que no
perdamos ninguna funcionalidad propuesta allí».
Diseño: maqueta Meta B (`docs/qa/maqueta-remasterizacion-2026-10-10/maqueta/m/L10-readiness.html`,
`L26-kit-inputs.html`, `L21-criterios-honestos.html`, `L28-tabla-inspector.html`) y la auditoría de Meta B (fila de
cursos-horario y brecha 2).

## Reglas de ejecución

- Rama `revamp-monitoreo-aulas` en su worktree; sin push, tag ni stash. Commits por nombre de archivo.
- **El modo está en operación real** (HSVG2026 y CCSS en campo, con gente agendando en vivo en los Sheets). No se toca
  lo que la app lee o escribe en Kobo o Sheets (`/aulas/sync`, `/aulas/publicar-distribucion`, el libro y su
  publicación), ni `api/**`, ni la lógica de agenda, reparto o sorteo. Estas tareas son solo de UI y de marcas.
- El «Sistema Pabellón» (`profiles/aulas/sistemaPabellon.ts`) está aprobado y no cambia.
- El rediseño Insumos · Modelo · Control · Avance espera las respuestas de `aulas.md` §0. El botón único «Actualizar»
  (L38) es de otro implementador.
- Gate: `pnpm -C frontend typecheck`, `make gate-front AREA=monitoreo`, capturas a 1440 × 1000 y 1024 × 600 sobre una
  copia de `api/inst/reference_projects/hsvg2026` con `--timeout-ms 420000`, en puertos propios (nunca 8787).

## M2: funciones de Meta B que se aplican hoy

| # | Pedido | Dónde vive | Estado |
|---|---|---|---|
| M2.1 | L10: readiness por pestaña | `navegacion/readinessDeAulas.ts`, `AulasMonitoreoPage.tsx`, `AulasTablasDeAvance.tsx` | Hecho |
| M2.2 | L26: todo booleano es un interruptor | barrido de `profiles/aulas/**` | Hecho (sin cambios necesarios, ver decisiones) |
| M2.3 | L21: ningún vacío ni «0» mientras el dato carga | `railDeAulas.ts`, `AulasMonitoreoPage.tsx`, `VacioSinTablero.tsx` | Hecho en lo que es de UI; pendientes abajo |

### M2.1 Readiness por pestaña (L10)

La página publicaba una sola marca, `monitoreo-aulas`, para las cinco secciones. Ahora publica la dirección de la
vista y sigue en `false` mientras `loading`:

- `monitoreo-aulas-fuentes` (Fuentes no tiene pestañas).
- `monitoreo-aulas-modelo-{agenda,facultad,contacto,carga}`.
- `monitoreo-aulas-calidad-{registro,controles,base,alumnos,abiertas}`.
- `monitoreo-aulas-consultas-{ficha,reemplazos,brechas,parte,extras}`.
- `monitoreo-aulas-avance-{resumen,cuotas,rendimiento,efectividad,salidas}`.

Decisiones:

- La pestaña se escribe tal como está activa. Si no pertenece a la sección no se sustituye por la primera, para que
  una pestaña que no existe no herede la marca de su vecina (regla 1 de L10).
- Cambiar de sección vuelve a pedir el estado, con `loading` en verdadero, así que la marca pasa por `false`. Cambiar
  de pestaña dentro de la sección no pide nada: todas leen el mismo tablero, que ya llegó.
- La única pestaña que lee un endpoint propio es Avance › Salidas (`AulasTablasDeAvance`, las cinco tablas del
  libro). Mientras lee publica una marca anidada en `false` y `aria-busy`. Con las tablas, su vacío o su error, la
  marca desaparece. Queda registrada en `FALSE_TRANSITORIO` de `app/readinessAnidada.contract.test.ts`.
- La página sigue con una sola marca propia, que es lo que exige `components/readinessDeMonitoreo.contract.test.ts`.
- Test: `navegacion/readinessPorPestana.test.ts` (20 marcas distintas, una por vista, y cobertura de todas las
  secciones que monta la página).

### M2.2 Interruptores (L26)

Barrido de `<input type="checkbox">` en `profiles/aulas/**` (sin tests):

| Control | Archivo | Decisión | Motivo |
|---|---|---|---|
| Valores que cuentan de cada condición de efectiva | `AulasFiltrosDeEfectiva.tsx:178` | Se conserva como casilla | Es una selección múltiple dentro de una lista desplegable: elegir N valores de una variable. No es un booleano que queda puesto, y la regla de L26 deja fuera la selección de elementos |
| «Concentrar el día del aplicador» | `AulasAsignacionDeAplicadores.tsx:555` | Ya es `Switch` (`components/Switch.tsx`) | Dictado del 2026-09-04: «no debe ser un check, debe ser un switch». El comentario de la línea 544 todavía dice «checkbox»: es histórico, no un control |

Los botones con `aria-pressed` del perfil (chips de sexo, días, vistas, fijar un aplicador en una celda, elegir
facultad o curso-horario) son selecciones de una opción entre varias o acciones por celda, no booleanos de
configuración, y se quedan. Los chips del Sistema Pabellón no se tocan.

### M2.3 Vacíos y ceros honestos mientras carga (L21)

Ya estaba bien:

- La banda de KPI declara «todavía se está leyendo el proyecto» en vez de ceros (`AulasKpiBand`, `cargando`).
- Mientras `loading`, el contenido es «Preparando vista» y la marca está en `false`.
- Las tablas de Salidas dicen «Leyendo las tablas de avance...» y ahora además retienen la readiness.

Corregido:

- **Rail**: sin tablero, `brechas` y `reemplazos` valían cero y Resumen, Reemplazos y Brechas se declaraban «listo»
  encima de «Preparando vista». Ahora, sin tablero, ninguna pestaña publica estado ni contador
  (`railDeAulas.ts`, con test).
- **Estado del rail**: «Última actualización: Sin actualización» mientras se leía el proyecto. Ahora dice «Leyendo el
  proyecto…» hasta que llega el estado.
- **Lectura fallida**: con el estado en `null` por un error, el vacío decía «Falta importar el plan» debajo del
  error, porque `planImportado` era falso por no haber leído nada. Ahora dice «No se pudo leer el monitoreo» y ofrece
  «Reintentar» (`VacioSinTablero.tsx`, con test).

Pendientes (fuera del glob o de la tarea):

- **Chrome del módulo** (`shell/MonitoreoModuleChrome.tsx`, compartido): mientras el estado no llega publica
  «Registros 0» y «Sincronizado: Sin sincronizar», porque recibe `nRows` como número y no tiene estado de carga.
  Hace falta una prop `cargando` en el shell; afecta a los cuatro perfiles.
- **Fuentes tras una lectura fallida**: la sección se monta sin tablero y cuenta las fuentes del estado vacío. Solo
  ocurre después de un error (no mientras carga), y el error ya se ve arriba. Se deja para el rediseño de Insumos.
- **Cifras con su base**: los ceros que vienen de un campo ausente en el tablero ya cargado son lógica de datos del
  motor, no de carga, y no se tocan aquí.

## Verificación M2

- `pnpm -C frontend typecheck` (`tsc -b`): sin errores.
- `make gate-front AREA=monitoreo`: 538 archivos y 5994 tests en verde.
- Capturas a 1440 × 1000 y 1024 × 600 sobre una copia de `hsvg2026.pulso`, con `--sembrar "Monitoreo de cursos-horario"`
  porque el proyecto de referencia no trae el modo declarado (`cobertura.monitoreo: false`). Hay 12 capturas, todas
  distintas por md5, y cada una publica su marca (`monitoreo-aulas-fuentes`, `-avance-resumen`, `-avance-salidas`,
  `-calidad-registro`, `-consultas-reemplazos`, `-modelo-agenda`). La línea base de `main` publicaba `monitoreo-aulas`
  en todas.
- **C5, limitación de fixture**: `hsvg2026` no tiene plan de monitoreo importado. Las cifras en 0 y S/D son el vacío
  legítimo de un estudio sin plan, ya cargado, no ceros durante la carga. Con el mismo proyecto, `main` y la rama dan
  los mismos tres hallazgos, así que ninguno viene de este cambio: 409 de `/aulas/avance-tablas` (sin plan),
  `capacity-drift` de 4–5 px en la cabecera de «Aulas agendadas» (Agenda) y un desborde de la cabecera de «Respuestas
  que pide el plan» a 1024 × 600 (Resumen). Quedan para el rediseño visual. Falta una cardinalidad alta: no hay un
  `.pulso` de referencia anonimizado con monitoreo de aulas en curso.
- Capturas: la carpeta `aulas-m2/captura/` del scratchpad de la sesión
  (rama) y `aulas-m2/antes/` del mismo scratchpad (`main`).
