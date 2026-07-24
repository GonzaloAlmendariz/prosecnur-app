# Catálogo visual real de Prosecnur

Paquete documental y auditable de la interfaz productiva de Prosecnur. Describe
lo que existe hoy —incluidas variantes, divergencias y elementos de runtime—
sin decidir todavía qué componente debe convertirse en canónico.

La organización fundamental es siempre:

```text
módulo → sección → pestaña
```

## Inicio rápido

| Necesidad | Entrada |
|---|---|
| Explorar y filtrar todos los elementos | [Catálogo interactivo](../manual-identidad.html#catalogo-real) |
| Comprender cada módulo y contexto | [Inventario contextual](docs/inventario-contextual.md) |
| Auditar o procesar el snapshot | [`data/catalogo.json`](data/catalogo.json) |

Desde la raíz del repositorio:

```bash
node scripts/build-visual-catalog.mjs
node scripts/build-visual-catalog.mjs --check
node --test scripts/tests/visual-catalog.test.mjs
```

## Qué contiene y qué no

El catálogo inspecciona todos los archivos productivos `.ts`, `.tsx`, `.js`,
`.jsx` y `.css` bajo `frontend/src`. Excluye pruebas, mocks, snapshots y CSS
minificado. Los totales exactos de cada corrida viven en `summary`; no se
duplican en este README porque cambian con la aplicación.

Este paquete:

- conserva cada ocurrencia JSX, declaración visual y condición de render;
- documenta fuentes, líneas, componentes, clases, estados y variantes;
- mantiene los acentos distintivos de cada módulo;
- individualiza candidatos ambiguos sin presentarlos como UI confirmada;
- describe colecciones de runtime sin inventar instancias.

Este paquete no unifica componentes, no rediseña vistas y no reemplaza la
identidad canónica ni los tokens operativos de la aplicación.

## Cómo navegar

| Si buscas… | Usa… |
|---|---|
| Una vista legible con búsqueda y filtros | El [catálogo interactivo](../manual-identidad.html#catalogo-real) |
| El recorrido módulo → sección → pestaña | El [inventario contextual](docs/inventario-contextual.md) |
| Un elemento exacto y su procedencia | `source`, `renderSource`, `styleSources` y `dynamicProviderSource` en el JSON |
| La razón de una atribución contextual | `contextBasis`, `contextScope` y `contextConfidence` |
| Cobertura, hashes y conteos actuales | `coverage`, `summary`, `files`, `sourceFiles` y `styleFiles` |

## Mapa del paquete

```text
branding/
├── manual-identidad.html                 # integración interactiva canónica
└── catalogo-visual/
    ├── README.md                         # entrada y contrato operativo
    ├── data/
    │   ├── catalogo.json                 # snapshot auditable generado
    │   └── catalogo-data.js              # transporte gzip para file://
    └── docs/
        └── inventario-contextual.md      # índice humano curado

scripts/
├── build-visual-catalog.mjs              # generador y taxonomía
└── tests/
    └── visual-catalog.test.mjs           # contratos automatizados
```

No se conservan copias de compatibilidad en la raíz del paquete: cada artefacto
tiene una sola ubicación y una sola responsabilidad.

## Fuentes de verdad

| Dimensión | Autoridad |
|---|---|
| Interfaz implementada | `frontend/src` |
| Taxonomía, jerarquía y superficies dinámicas | `scripts/build-visual-catalog.mjs` |
| Snapshot auditable de una corrida | `data/catalogo.json` |
| Índice narrativo por contexto | `docs/inventario-contextual.md` |
| Identidad y uso semántico del color | `branding/manual-identidad.html` y fuentes canónicas de branding |
| Operación del paquete | Este `README.md` |

`data/catalogo.json` es la fuente auditable del snapshot, pero no una fuente
editable. Su contenido deriva del frontend y del generador.

## Modelo de datos

| Colección | `sourceType` | Qué representa |
|---|---|---|
| `entries` | `jsx` | Ocurrencias JSX directas |
| `declarations` | `declaración` | Variantes declaradas con sink visual resuelto |
| `unresolvedDeclarations` | `declaración-sin-sink-resuelto` | Evidencia cuyo render no puede confirmarse estáticamente |
| `declarationCandidates` | `auditoría-candidato` | Ledger individual con evidencia y disposición |
| `cssGeneratedContent` | `contenido-generado-css` | Texto, símbolos o `attr(...)` producidos por `content:` |
| `dynamicTemplates` | `plantilla-dinámica` | Colecciones dependientes de datos o librerías de runtime |

El JSON también publica módulos, jerarquía, superficies visuales declaradas,
auditoría de candidatos, resumen y hashes de todas las fuentes.

## Jerarquía contextual

Cada registro usa un módulo, una sección y una pestaña registrados. Cuando el
código no demuestra una sola pestaña local se utiliza un scope explícito:

- `Transversal / sin pestaña local`;
- `Varias pestañas / contexto dinámico`.

Estos scopes conservan la incertidumbre real; nunca convierten un nombre de
archivo o una inferencia débil en una pestaña ficticia.

## Qué se edita y qué se genera

| Archivo | Propiedad | Regla |
|---|---|---|
| `README.md` | Editable | Mantener estable y sin cifras volátiles |
| `docs/inventario-contextual.md` | Editable | Curar por módulo, sección y pestaña |
| `data/catalogo.json` | Generado | No editar manualmente |
| `data/catalogo-data.js` | Generado | No editar manualmente |
| `scripts/build-visual-catalog.mjs` | Editable | Evoluciona el contrato y regenera derivados |
| `scripts/tests/visual-catalog.test.mjs` | Editable | Prueba cobertura y estructura |
| Bloque `VISUAL_CATALOG:START/END` del manual | Generado | Toda edición manual será sobrescrita |

El resto de `branding/manual-identidad.html` se gobierna por el contrato de
identidad visual y permanece fuera de este subpaquete.

## Regeneración

Ejecuta siempre desde la raíz:

```bash
node scripts/build-visual-catalog.mjs
```

El generador actualiza de forma coordinada:

1. `data/catalogo.json`;
2. `data/catalogo-data.js`;
3. el capítulo integrado en `branding/manual-identidad.html`.

Después de cambiar rutas, taxonomía o detección, no edites los derivados para
hacerlos coincidir: corrige el generador y vuelve a ejecutar.

## Validación

```bash
node scripts/build-visual-catalog.mjs --check
node --test scripts/tests/visual-catalog.test.mjs
git diff --check
```

`--check` exige igualdad byte a byte con una regeneración. La suite verifica
cobertura, hashes, jerarquía, procedencia, capas, transporte comprimido,
integración con el manual y acentos de módulo.

El smoke visual final abre
`branding/manual-identidad.html#catalogo-real` y confirma:

- descompresión y carga de filas;
- búsqueda y paginación;
- filtros por módulo, sección, pestaña, categoría y origen;
- ausencia de overflow del documento en viewports de escritorio.

## Colores de módulo

El acento identifica contexto; no comunica éxito, advertencia, error ni estado.
Los colores semánticos mantienen sus propios tokens y señales no cromáticas.

| Contexto | Acento actual |
|---|---:|
| Global | `#002457` |
| Bitácora | `#A16207` |
| Cálculo de muestra | `#7C3AED` |
| Editor de formularios | `#6D5DFC` |
| Hojas de ruta | `#C2410C` |
| Fichas QR | `#106E8C` |
| Monitoreo | `#BE123C` |
| Procesamiento | `#0F766E` |
| Dashboard | `#2563EB` |
| Enciclopedia | `#A16207` |

Los ocho módulos operativos mantienen acentos distintivos. Global usa el navy
de marca y Enciclopedia comparte actualmente el ámbar de Bitácora. El
generador registra el mapa observado; la identidad canónica gobierna su uso.

## Límites conocidos

- Una ocurrencia dentro de `map()` representa el patrón que se repite, no cada
  fila producida en runtime.
- Las colecciones externas se documentan mediante plantilla y proveedor.
- La atribución contextual puede quedar como transversal o dinámica cuando la
  fuente no prueba una pestaña única.
- El inventario humano es curado y debe validarse junto con el JSON y el
  manual, no de manera aislada.
