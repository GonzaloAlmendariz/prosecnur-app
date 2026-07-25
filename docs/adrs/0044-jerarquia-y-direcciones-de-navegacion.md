# ADR 0044: Jerarquía canónica de navegación y direcciones enlazables

Estado: Aceptado

Fecha: 2026-07-24

## Contexto

Prosecnur usaba tres vocabularios distintos para los mismos tres niveles de
navegación, y el desorden no era cosmético: hacía imposible enlazar una vista
profunda y tumbaba al inspector visual a mitad de recorrido.

El inventario del 2026-07-24, antes de este ADR:

| Nivel | Monitoreo | Hojas de ruta | Cálculo de muestra | Bitácora | Procesamiento |
|---|---|---|---|---|---|
| Modo | `family` / `sectionSets` / "camino" | — | `mesa` / `desk` / `tipo` | — | — |
| Sección | `?tab=` + `WorkbenchView` | `?stage=` | rail section | `?tab=` | rutas hermanas |
| Pestaña | `OperationalModelMode` (¡se llamaba *mode*!) | `?tab=` | tabs | — | `?step=`, `?reporte=` |
| Overlay | no direccionable | no direccionable | no direccionable | no direccionable | no direccionable |

Tres problemas concretos salían de ahí:

1. **`tab` significaba cosas distintas según el módulo.** En Monitoreo y
   Bitácora nombraba una *sección*; en Hojas de ruta, una *pestaña* dentro de
   la sección `stage`. Ningún parser podía resolverlo sin saber el módulo.
2. **La pestaña no existía en la URL.** En Monitoreo —el módulo con la
   jerarquía más profunda— la pestaña activa solo se alcanzaba con un click
   sobre su etiqueta visible. No había forma de enlazarla.
3. **Ningún overlay era alcanzable.** Popovers, sideovers y diálogos solo se
   abrían por interacción, así que no se podían enlazar ni auditar.

Como consecuencia, el inspector visual navegaba haciendo click sobre texto
visible (`--click-tab "Avance"`, `getByRole("tab", {name})` en
`scripts/visual-qa.mjs`). Ese método falla por tres vías independientes: una
etiqueta renombrada, una etiqueta truncada en viewport compacto, o una etiqueta
que todavía no está pintada porque el warm start no terminó. Con proyectos de
referencia reales, donde el warm start tarda decenas de segundos, la tercera es
la regla y no la excepción.

## Decisión

### 1. Una sola jerarquía, con nombres en español

```
Módulo → [Modo] → Sección → Pestaña → Panel
```

- **Módulo**: familia de trabajo con homepage y paleta propia. Vive en el
  `pathname`.
- **Modo** (opcional): variante del módulo que **reescribe su juego de
  secciones**. Lo determina el estudio del proyecto, no un click del usuario:
  no se navega entre modos, se aterriza en el que corresponde. Solo Monitoreo
  (acreditación, territorial, cursos-horario, telefónico) y Cálculo de muestra
  (la mesa del estudio) tienen modos.
- **Sección**: el recorrido del módulo; la top bar.
- **Pestaña**: subdivisión dentro de una sección.
- **Panel**: superficie superpuesta —popover, sideover, drawer, diálogo,
  inspector—. Es el quinto nivel y también se enlaza.

`foco` es ortogonal y no es un nivel: identifica la entidad seleccionada dentro
de un nodo (una variable, un actor, una manzana).

Estos nombres son los mismos en la URL, en los tipos TypeScript y en los
atributos `data-*`. UI nueva se cuelga de uno de esos cinco niveles; nunca se
duplica la navegación de un nivel en otro (regla ya vigente de
`docs/ui-layout-grammar.md`).

### 2. Ruta = módulo, query = el resto

```
/<modulo>?modo=<modo>&seccion=<seccion>&pestana=<pestana>&panel=<panel>&foco=<id>
```

`pestana` va sin eñe a propósito, para que sea ASCII-safe en una URL.

Ejemplos reales:

```
/monitoreo?modo=territorial&seccion=avance&pestana=ump
/hojas-ruta?seccion=entrega&pestana=titulares
/codificacion?pestana=matrices
/monitoreo?seccion=avance&panel=filtros
```

Se descartó poner todo en el path (`/monitoreo/territorial/avance/ump`): obliga
a reescribir el router de los nueve módulos, rompe enlaces guardados y encaja
mal con Procesamiento, cuyas secciones son rutas hermanas (`/carga`,
`/validacion`…) y no hijas de `/procesamiento`.

Esa asimetría de Procesamiento se absorbe en la capa de direcciones: la
dirección lógica trata `/carga` como `{modulo: "procesamiento", seccion:
"carga"}` igual que en cualquier otro módulo, y solo el mapeo a URL difiere.
Serializar esa dirección devuelve `/carga`, no `/carga?seccion=carga`.

### 3. Los nombres viejos se leen, nunca se escriben

`tab`, `stage`, `mesa`, `desk`, `tipo`, `step`, `reporte`, `perfil`, `agregar`,
`settings` siguen entrando como alias **por módulo** —que es la única forma de
desambiguar `tab`—. La app nunca los emite: normalizar una URL vieja es el
momento de migrarla, y una URL a medias (`?tab=x&seccion=y`) es peor que no
haberla tocado.

### 4. La dirección sobrevive al warm start

El deep-link de dev abre el `.pulso` con `?pulso=` y luego lo consume. Esa
limpieza saca **solo** el param de proyecto: los cinco niveles sobreviven
intactos. Es lo que permite que un enlace profundo aterrice donde prometió en
vez de caer en el landing del módulo.

### 5. La app expone su navegación al inspector

En dev y bajo QA visual, `window.__pulsoNav` publica:

- `manifiesto`: **todas** las vistas direccionables, enumeradas desde
  `lib/modules.ts`. Explorar deja de ser adivinar.
- `ir("monitoreo/territorial/avance")`: navegación por clave estable, sin
  depender del texto visible. Conserva el proyecto abierto.
- `listo()`: readiness real, que distingue "todavía en warm start" de "esta
  vista no declara readiness" — la diferencia entre esperar y reportar.
- `paneles()`: paneles declarados y los efectivamente montados, para detectar
  deriva entre el catálogo y la realidad.

Los runners aceptan `--ir <clave>`. `--click-tab` sigue existiendo como
fallback, documentado como frágil.

## Consecuencias

- Un enlace reproduce cualquier vista de la app, incluidos overlays.
- El recorrido de QA es determinista y enumerable: mismo orden en cada corrida,
  evidencias diffables.
- Renombrar una etiqueta visible deja de romper corridas de QA, porque los
  `id` son estables e independientes del copy.
- Los `id` de nodo pasan a ser contrato: cambiarlos rompe enlaces guardados.
- **`family` se queda como está en el cable.** Es el campo del contrato R↔React
  y del `.pulso` (`monitoreo_profile.family`, presente en 82 archivos de
  `api/R/`). El concepto de navegación se llama `modo` en TypeScript, URL y
  `data-*`; la traducción vive aislada en el borde de la API. Renombrar el
  campo persistido era desproporcionado y habría mezclado un refactor de
  contrato de datos con uno de navegación.
- Los paneles se adoptan de forma incremental. El catálogo declara **solo** los
  ya conectados, porque el inspector compara declarado contra montado y
  declarar de más produciría falsos rojos.

## Alternativas descartadas

- **Vocabulario en inglés** (`?mode=&section=&tab=`): coincidía con el código
  existente, pero dejaba la UI en español y el contrato en inglés. El dominio
  del repo ya es español.
- **Resolver `tab` globalmente**: imposible sin conocer el módulo. Era la causa
  raíz, no un detalle de implementación.
- **Dejar la pestaña fuera de la URL** y que el inspector siga clickeando: no
  arregla nada de lo que motivó este ADR.

## Implementación

- `frontend/src/lib/navegacion/direccion.ts` — gramática, parser, serializador,
  alias legacy por módulo.
- `frontend/src/lib/navegacion/manifiesto.ts` — enumeración de nodos.
- `frontend/src/lib/navegacion/paneles.ts` — quinto nivel.
- `frontend/src/lib/navegacion/runtime.ts` — `window.__pulsoNav`.
- `scripts/ui-quick-check.mjs`, `scripts/visual-qa.mjs` — `--ir`.
