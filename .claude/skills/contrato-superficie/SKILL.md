---
name: contrato-superficie
description: Contrato de Superficie de Prosecnur — las cinco cláusulas (C1 declaración, C2 estabilidad, C3 pertenencia, C4 alcance, C5 suficiencia) que toda superficie de UI debe cumplir, y cómo se verifica cada una. Usar al construir o modificar cualquier superficie visual, al revisar geometría, al preguntar "¿revisaste el contrato de superficie?", al clasificar una pestaña vacía, o antes de aprobar un revamp. Cargar ANTES de declarar terminada una superficie, no después.
---

# Contrato de Superficie

> Toda superficie **declara** qué es, **mantiene** su marco pase lo que pase con
> sus datos, **contiene** su propio vacío, deja todo su contenido **alcanzable**
> y **entrega** la información que su función promete.

Norma canónica: `docs/ui-layout-grammar.md#contrato-de-superficie`. Este skill es
el handle operativo — las cláusulas, sus checks y sus trampas. Cuando norma y
skill difieran, manda la gramática.

**Se cita por código.** Un veredicto dice `C2 en Modelo > Cuotas`, no "las
tarjetas están desparejas". Un pendiente dice `C5 categoría 2 en Telefónico`, no
"falta data".

## Criterio de validación

> ### Verde por conformidad, no por ausencia

Un gate solo aprueba lo que **comprobó**. Que no haya hallazgos porque nada
estaba declarado no es un pase: es una laguna de cobertura y se reporta como tal.
El runner reporta **tres** números, no uno: conformes / no conformes / **no
declaradas**.

Corolarios que ya rigen:

- Un modo de Monitoreo no auditado en la vuelta → cobertura pendiente declarada.
  No se infiere de los otros tres.
- Una superficie vacía sin clasificar (C5) → pendiente de triaje, no "está bien".
- Reportes inválidos por readiness se conservan etiquetados. **Prohibido el
  verde compuesto**: nunca se suman para producir una aprobación.

## Las cinco cláusulas

### C1 — Declaración · `geometry-undeclared`

Lo no declarado no existe para el gate.

- `data-qa-geometry-group` nombra el grupo.
- `data-qa-geometry-contract`: `equal` (pares y variantes repetidas) o
  `intrinsic` (secciones independientes). **El runner no adivina cuál es.**
- `data-qa-geometry-member` cuando el hijo directo no es el miembro.
- `data-qa-geometry-capacity="owned"` marca quién posee el vacío interior,
  **limitado al contenedor visible de datos** — nunca al panel ni al workbench.

Con `--require-geometry`, el runner infiere colecciones candidatas de hermanos
visibles equivalentes y emite `geometry-undeclared`. Excluye navegación, tablas,
tabs, toolbars, menús y controles.

**Trampa:** declarar el grupo en el `section` en vez del wrapper de datos hace
que 3–4 px de padding de encabezado se lean como capacidad inflada.

### C2 — Estabilidad · `equal-frame-drift`

El marco se deriva del **rol y del viewport, nunca de `items.length`**.

- Hermanos del mismo rol comparten alto **y ancho**, tolerancia 2 px.
- Un estado vacío, dos elementos y el máximo previsto conservan la misma caja.
- La variación se resuelve **dentro**: estado vacío, scroll interno, paginación,
  virtualización o divulgación progresiva.
- Al cambiar de régimen responsive el alto objetivo puede cambiar, pero cambia
  para **todo el grupo**, no tarjeta por tarjeta.

**Trampa:** igualar marcos no autoriza estirar filas, textos ni controles
internos. Un `1fr` o `minmax(0,1fr)` que iguala el borde comprimiendo el
contenido es un rechazo, no una reparación.

### C3 — Pertenencia · `capacity-drift`

Todo vacío pertenece a un contenedor visible.

| Situación | Decisión |
|---|---|
| Tabla con cientos de filas en un shell bajo | Entregarle el alto disponible: mostrar más datos |
| Dos cards pares, una con menos información | Mismo marco; el vacío interior es capacidad legítima |
| Sección independiente con dos casos | Altura intrínseca; el siguiente bloque empieza tras el gutter |
| Card repetida sin casos | Geometría de su variante + estado vacío dentro |

**Un hueco sin borde, material, propósito ni dueño no es aire: es rotura de
composición.** La frontera visible del contenedor es lo que distingue aire
profesional de composición rota.

### C4 — Alcance · `scroll-jail`, `scroll-unreachable`, `placeholder-clipped`

- Un solo dueño de scroll por pantalla; sin cadenas anidadas.
- El dueño recorre `0 / maxScroll÷2 / maxScroll`, alcanza `atEnd` y deja visible
  el último contenido **realmente pintado**.
- Cero recorte de texto operativo: nombre de fuente, rango, identificador,
  placeholder. Elipsis en etiqueta larga es aceptable; en dato operativo, no.
- Descendientes de `details:not([open])` no cuentan hasta abrirlo; cerrado, solo
  el `summary` participa de la geometría.

### C5 — Suficiencia · *exige juicio*

La superficie entrega lo que su `label`/`detail` prometen. Triaje obligatorio
de toda superficie vacía; **solo una categoría autoriza añadir contenido**:

| | Qué significa | Qué se hace |
|---|---|---|
| **1. Vacío legítimo** | El proyecto no tiene esos datos | Estado vacío dentro de la caja de su variante, que diga qué falta y cómo se llena |
| **2. Vacío por fixture** | El dato existe pero no en el proyecto de referencia | Deuda declarada. No se repara. **No se fabrican datos** |
| **3. Vacío por desconexión** | El backend ya lo calcula y el frontend no lo consume | Defecto real. Aquí sí se añade |

La categoría 3 no es hipotética: el engine de Monitoreo ya calcula estados por
encuestador, plataforma-vs-Sheets y el conflicto de enlace, y el frontend no
consume ninguno (`docs/plan-monitoreo-telefonico-2026-07.md`).

**C5 no cierra con el gate visual.** Pasa por `dominio-prosecnur` (¿pertenece a
esa pestaña y a ese nivel?), `revisor-metodologico` (grano, denominador,
trazabilidad) y `guardian-contratos` si cruza React↔R.

## Las cláusulas no se validan por separado

Una cláusula conforme puede ser la que esconde la vecina rota. Caso medido: una
pareja **cumplía C2** —marcos exactamente iguales— y por eso nadie miró que
`align-content: start` dejaba sus cuatro métricas comprimidas en una franja con
casi todo el alto libre: **C3 violado bajo un C2 verde**. Al repararlo apareció
además `Δ=130.94 px` de ancho que la comprobación de alto no veía.

Regla: cuando una cláusula pase, comprueba explícitamente la adyacente.
C2 verde obliga a mirar C3 (¿el contenido usa el marco igualado?); C3 verde
obliga a mirar C4 (¿ese vacío tiene dueño alcanzable?); C1 verde no dice nada
sobre C5 (¿la superficie declarada entrega lo que promete?).

## Cómo se verifica

```bash
node scripts/ui-quick-check.mjs --project /ruta/proyecto.pulso --route /monitoreo --ir monitoreo/territorial/avance --require-geometry
```

- `--geometry-group "equal::SELECTOR"` / `"intrinsic::SELECTOR"` mide un grupo
  puntual. Sirve como evidencia de esa corrida, **no** como guard permanente:
  para eso la declaración va al markup (C1/A3).
- `--require-geometry` activa la detección de no declaradas.
- Navegar con `--ir` y dirección canónica. `--click-tab` es fallback frágil:
  depende de una etiqueta que puede renombrarse, truncarse en compacto o no
  existir por warm start.
- Matriz mínima: `1440×1000` y `1024×600`. Añadir `1710×1107` y `1280×800`
  cuando la vista lo justifique.
- Proyecto real en copia temporal escribible; el original intacto; el **mismo**
  proyecto antes y después.

## Quién usa qué

- **Construyendo** (`frontend-react`): una superficie nueva no está terminada sin
  C1, igual que no lo está sin ser enlazable.
- **Dirigiendo** (`revamp-visual`): C1 es precondición para congelar dirección,
  no un resultado del QA.
- **Midiendo** (`qa-visual-desktop`): reporta por cláusula — conformes / no
  conformes / no declaradas.
- **Gateando** (`verificador`): rechaza un `visualIssues=0` acompañado de
  superficies no declaradas o de vacíos sin clasificar.

## Lo que el contrato no autoriza

- Copy, explicaciones o texto ornamental **para llenar espacio**. La única
  excepción es C5 categoría 3, resuelta en el triaje y nunca a ojo durante una
  reparación visual.
- Reducir la tipografía para esconder un recorte.
- Abreviar con siglas artificiales.
- Estimar, proyectar o inferir un dato que no existe. Si no está, se declara
  deuda.
- Eliminar una superficie porque "parece duplicada" sin comprobar que su función
  lo sea.
- Estirar secciones semánticamente independientes para igualarlas.
- Convertir capacidad interior legítima en "espacio a recuperar".
