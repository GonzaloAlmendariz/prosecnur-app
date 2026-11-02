# ADR 0124: El Planner sale como módulo; el estudio declara un nombre y un tipo desde el Home

Estado: Aceptado (Gonzalo, 2026-11-01, al revisar la pantalla nueva del Planner: «Sí, procede»)

Implementación: backend en b00932653 (un estudio, un tipo); frontend en el commit del retiro (panel «Ficha del estudio» en `features/estudio/`, módulo `diseno-estudio` fuera, `features/bitacora/` borrado, `/planner`, `/bitacora`, `/diseno-estudio` y `/plan-trabajo` → `/?panel=estudio`). Pendiente: retirar el backend dormido de la Bitácora (checklist del retiro, ítem 7)

Fecha: 2026-11-01

Fecha de decisión: 2026-11-01

Reemplaza:

- [ADR 0123](0123-el-planner-solo-define-el-tipo-y-el-camino-del-estudio.md), en lo que sigue vigente de la pantalla:
  §1 (las cuatro definiciones), §3 (secciones y direcciones), §4 (el camino) y §6 (el cronograma). Siguen vigentes
  §2 (lo que vuelve a cada módulo), §5 (el Planner no deduce nada a la vista; el modo se deduce por dentro) y §7
  (schema y modo público).
- [ADR 0122](0122-el-planner-define-el-estudio-y-fija-los-modos.md) §1 (el módulo y sus secciones) y §8 (la
  cardinalidad «uno o más perfiles»).
- [ADR 0047](0047-bitacora-cronograma-canvas-vinculado.md): la Bitácora, su cronograma, su calendario, su registro y
  su lienzo salen de la app.

Extiende: —

## Contexto

La sesión de definición del Planner (1/11) lo fue achicando: ya no es bitácora, no guarda universo, equipo, códigos ni
insumos, y no deduce nada a la vista. Al revisar la pantalla nueva en la app, Gonzalo corrigió dos cosas más:

> «el tipo de estudio es uno solo: acogida es territorial aleatorio, conta es acreditación»

> «¿por qué pide definir poblaciones cuando Monitoreo ya lo permite en monitoreo de acreditación?»

Y sobre lo que quedaba: los canales de acreditación «los define Monitoreo y los crea Material; el Planner solo define
que es acreditación»; la muestra de acreditación «se define en Monitoreo, generalmente con porcentajes». Luego:

> «¿Qué tanto perderíamos si quitamos el Planner por completo a nivel de módulo? Cada vez le veo menos sentido»

Medido en el código, lo único que el Planner aporta es el **tipo de estudio** (de él sale el modo de Cálculo,
Monitoreo, Material, Hojas de ruta y el Home) y el **nombre**. El cronograma, el registro y el lienzo son opcionales y
nadie los necesita: Monitoreo y Hojas de ruta llevan su propia etapa y ventana.

## Decisión

1. **El Planner deja de ser un módulo.** Sale de la navegación, junto con todo lo que heredó de la Bitácora:
   cronograma, calendario, registro de decisiones y lienzo. `/planner`, `/bitacora` y `/diseno-estudio` llevan al
   Home del proyecto.
2. **El estudio declara un nombre y un tipo, una vez, desde el Home**, en el panel «Ficha del estudio»
   (`?panel=estudio`). Ahí se escriben el nombre (obligatorio), el código, el cliente y el objetivo, y se elige el
   tipo.
3. **Un estudio tiene un solo tipo**, con su variante:

   | Tipo | Variante | Diseña la muestra |
   |---|---|---|
   | Territorial | aleatorio (UMP con hoja de ruta) o por conveniencia | Hojas de ruta, o cuotas sin sorteo |
   | Aulas | cursos-horario (conglomerados) o marco de personas | Cálculo de muestra |
   | Telefónico | — | La lista del cliente |
   | Acreditación | — | Monitoreo, con porcentajes por público |

   Quién diseña la muestra sale del tipo; no se pregunta. No se piden poblaciones (son de Monitoreo, ADR 0045) ni
   canales (Monitoreo los define y Material los crea; acreditación abre la campaña de correo, como antes).
4. **Los datos no se mueven.** La clave `planner` (`planner/v1`) sigue guardando la identidad y el tipo, y los módulos
   la leen igual que hoy (`/api/planner/modos`, `.planner_identidad`). Escribir acepta a lo más un perfil
   (`E_PLANNER_INVALIDO` con más); un `.pulso` que ya guardó dos fija el modo con el primero. Las claves de la Bitácora
   (`plan_trabajo`, `diseno_estudio_bitacora`, `bitacora_canvas`) y las secciones del Planner que ya no se escriben se
   conservan en los `.pulso` guardados; nadie las borra.
5. **Lo que leía el cronograma deja de ofrecerse.** El «Alinear la fase» y «Alinear la ventana» de Monitoreo y la
   etapa del Planner en Hojas de ruta sólo aparecían con algo declarado en el Planner; sin pantalla para declararlo,
   no vuelven a aparecer. Su código se retira con la sesión dueña de cada módulo.

## Consecuencias

- Un módulo menos. Un estudio nuevo declara su nombre y su tipo en un solo lugar, y cada módulo sabe en qué modo
  abrir.
- Se pierden el cronograma, el registro y el lienzo, con lo que un proyecto hubiera guardado en ellos (sigue en el
  `.pulso`, sin pantalla).
- Se deshace el 4b de la Q5 (`6151e2779`): el canal presencial con QR ya no abre la campaña de aulas desde el
  Planner.
- Los enlaces de Cálculo y Monitoreo que mandaban a declarar el tipo en el Planner pasan al panel del Home.

## Cumplimiento

- `test-planner.R`: dos perfiles responden `E_PLANNER_INVALIDO`; acreditación abre la campaña de correo y no lee
  canales; un `.pulso` con dos perfiles guardados fija el modo con el primero.
- Frontend: `modulesNavigation` y `auditReadyRoutes` sin el módulo `diseno-estudio`; `/planner`, `/bitacora` y
  `/diseno-estudio` llevan al Home; el panel `estudio` está declarado y deja elegir un solo tipo, sin poblaciones,
  canales ni diseño.
- Proyectos de referencia: los modos de los cinco no cambian (oráculo de `test-planner.R`).

## Notas

- Decisiones de Gonzalo del 1/11, en `docs/qa/inventario-planner-2026-11-01.md` y en
  `docs/qa/checklist-planner-retiro-2026-11-01.md`.
