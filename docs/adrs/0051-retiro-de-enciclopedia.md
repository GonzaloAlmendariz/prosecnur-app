# ADR 0051: Retiro de Enciclopedia

Estado: Aceptado

Implementacion: Completa

Fecha: 2026-07-31

Fecha de decision: 2026-07-31

Reemplaza: —

Extiende: [0044](0044-jerarquia-y-direcciones-de-navegacion.md)

## Contexto

Enciclopedia era una utilidad global —no un módulo del proyecto— que servía
diez fichas metodológicas, un glosario, una tabla maestra de estudios y un
comparador, todo desde JSON estable en `api/inst/catalogos/`. Ocupaba su propia
posición en la barra global, dos rutas (`/enciclopedia` y
`/enciclopedia/metodologia/:id`), un router de seis endpoints, un paso de
warmup y su propia paleta.

La decisión de retirarla es del dueño del producto y es explícita. Este ADR no
la justifica: registra su alcance, porque borrar una superficie completa es
exactamente el tipo de cambio que el repo ya deshizo por accidente antes
—`disenoEstudio` y `planTrabajo` se borraron y restauraron más de una vez— y la
regla de la casa pide que quede asentado qué se fue y qué no.

## Decisión

Se retira la superficie completa y el contenido que solo ella exponía. Se
conserva todo lo que otro módulo consume.

**Se retira:**

- Frontend: `features/enciclopedia/` (dos páginas), `api/enciclopedia.ts`, sus
  dos rutas, el ítem de `PROSECNUR_GLOBAL_NAV_ITEMS`, la entrada de
  `warmupRegistry`, el perfil de `ModuleWarmupBoundary`, el mensaje de
  `BootGate`, las reglas `.pulso-enciclopedia-frame` de `tokens.css` y la
  reexportación del barrel de `api/client.ts`.
- Backend: `router_enciclopedia.R` con sus seis endpoints, su registro en
  `plumber_app.R`, su paso e id en `project_warmup.R` y sus cuatro códigos de
  error en `errors_registry.R`.
- Contenido sin ningún consumidor: `glosario.json`,
  `tabla_maestra_estudios.json` y `preset_acreditacion_pucp.json`. Se verificó
  uno por uno por nombre de archivo, no por palabra.
- `components/TabStrip.tsx` y su test: sus dos únicos consumidores eran las
  páginas de Enciclopedia, así que el retiro lo dejó huérfano. **Se anota
  aparte porque es un componente del kit y no de la feature**: si mañana hace
  falta, está a un `git revert` de distancia.

**Se conserva, y por qué:**

- `catalogo_metodologias.json` y `catalogo_tipos_estudio.json`: los lee
  `router_diseno_estudio.R` en `.diseno_library_summary()` para la biblioteca
  de Bitácora. Nada de esto era visible desde la Enciclopedia.
- `preset_hsvg_pucp.json` y `preset_hsvg_pucp_2025_aulas_demo.json`: los lee
  Cálculo de muestra directamente de disco vía `.cm_locate_catalog()`, sin
  pasar por HTTP.
- Los tokens `--pulso-module-encyclopedia*`: pese al nombre, son la fuente del
  ámbar de Bitácora, que los aliasa como `--pulso-module-workplan*`. Borrarlos
  habría cambiado la paleta de otro módulo. El nombre queda histórico.
- `PROSECNUR_GLOBAL_NAV_ITEMS`, ahora vacío: el contrato distingue módulo del
  proyecto de utilidad global, y esa distinción sigue siendo cierta aunque hoy
  no haya ninguna. Un test fija que la lista esté vacía, para que reintroducir
  una pantalla fuera de la jerarquía de módulos sea una decisión y no un
  descuido.

## Consecuencias

El repo pierde ~68 KB de contenido metodológico que no tenía otro consumidor.
Queda en la historia de git; si se decide reubicar las fichas dentro de los
módulos que las referencian, el material se recupera desde este commit.

`components/Math.tsx` —el envoltorio de KaTeX— se movió al kit **antes** del
retiro, en su propio commit. Vivía dentro de `features/enciclopedia/shared/` y
lo importaba Cálculo de muestra: borrar la carpeta sin moverlo primero habría
roto otro módulo. Es el tipo de acoplamiento que solo aparece al medir, y la
razón por la que el retiro se hizo en dos pasos.

Dos mensajes de `calc_muestra_engine.R` remitían al usuario «a la enciclopedia»
y quedaron reescritos: una superficie retirada no puede seguir siendo el destino
que un error le ofrece a quien lo lee.
