# Prompt de pulido estético de Monitoreo

Bucle de convergencia sobre la estética de los cuatro modos de Monitoreo. No es
una lista que se agota: es un loop que **solo Gonzalo cierra**. Cuando no queden
superficies sin auditar, se vuelve a empezar con criterio más fino.

Se lanza así:

```bash
/loop Sigue el protocolo de docs/prompt-pulido-monitoreo.md. Elige la siguiente superficie del registro, púlela entera y commitea. No te detengas.
```

El registro de avance vive en `docs/qa/pulido-monitoreo-estado.md` y lo escribe
el propio loop. Si no existe, la primera iteración lo crea con el inventario de
superficies de los cuatro modos.

---

## Misión

Afinar la estética de Monitoreo hasta que se vea de una sola casa: **espaciado
correcto, uniformidad, elegancia y gramática macOS**. En el mismo pase, mejorar
la redacción y la **didáctica de la interfaz** — que cada superficie enseñe qué
es y qué se decide en ella— sin caer en explicar de más.

**No se altera la funcionalidad.** El alcance es CSS y texto visible. Si un
defecto estético solo se arregla tocando lógica, se anota en el registro y se
deja; no se toca.

---

## Una iteración

### 1. Elegir

Toma del registro la primera superficie sin auditar. Una superficie es una
pestaña concreta de un modo concreto —`telefónico › Fuentes › Universo y
barrido`—, no un módulo entero. Si el registro está vacío, constrúyelo
enumerando con `window.__pulsoNav.manifiesto` sobre un proyecto abierto.

**El inventario caduca, así que se reenumera en cada pase.** Las pestañas de
Monitoreo cambian —se añaden, se funden, se renombran—, y ya pasó dos veces que
el registro anunciara superficies que el runtime no monta: el inventario inicial
salió de catálogos estáticos compartidos entre perfiles y prometía en telefónico
tres pestañas que no existen. Antes de elegir, contrasta la sección con
`window.__pulsoNav.pestanasDeLaSeccion()`; si difiere del registro, corrige el
registro primero. Una fila que ya no existe se tacha con el motivo; una nueva
entra como pendiente aunque el resto del modo esté cerrado. **Un modo cerrado
no queda cerrado para siempre**: si sus pestañas cambiaron, vuelve a estar
pendiente.

Y cuando el registro no tenga nada pendiente, no se acaba el loop: se vuelve a
empezar con el criterio más fino de §4, que es más exigente que el del pase
anterior.

### 2. Verla, no leerla

Ábrela con el skill `/ver-ui` y **júzgala en pantalla**. No se diagnostica
leyendo CSS: los defectos que importan —celdas de 2 px, títulos encimados,
texto que se sale de su caja— pasan typecheck y tests sin inmutarse.

Proyecto por modo (ADR 0043):

| Modo | Proyecto |
|---|---|
| telefónico | `api/inst/reference_projects/acnur_pdm/acnur_pdm.pulso` |
| acreditación | `api/inst/reference_projects/acrconta/acrconta.pulso` |
| territorial | `api/inst/reference_projects/acnur_acg/acnur_acg.pulso` |
| cursos-horario | `api/inst/reference_projects/hsvg2026/hsvg2026.pulso` |

Levanta el stack **una vez** y recorre todo en esa sesión: abrir un proyecto de
referencia cuesta 2–4 min y una recarga completa vuelve a pagarlo. Navega con
`window.__pulsoNav.ir(...)`, nunca recargando.

### 3. Medir contra la casa

Las referencias canónicas son **Procesamiento › Gráficos** y el **editor de
formularios**: ahí la gramática está asentada. Mide con `getComputedStyle`, no a
ojo, y compara:

| Nivel | Radio | Materia |
|---|---|---|
| Panel de sección | `--pulso-radius-panel` (16) | borde + `--pulso-shadow-low` |
| Tarjeta | `--pulso-radius-card` (14) | gradiente + luz interior + sombra difusa |
| Control / celda | `--pulso-radius` (10) o 999 en chip | fondo, **sin caja propia** |

La materia de tarjeta son tres cosas **juntas**, y ninguna sobra:

```css
background:
  linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.93)),
  var(--pulso-surface);
box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.86),   /* la luz que da el canto */
  0 4px 12px rgba(0, 36, 87, 0.052);      /* la sombra que la asienta */
```

Sin la luz interior, el gradiente solo aplana más.

Tipografía, medida en las referencias:

- Título de tarjeta: 13 px, `--pulso-weight-heavy`, `line-height: 1.18`.
- Descripción: 10.75 px, `--pulso-weight-medium`, `line-height: 1.38`.
- Label de campo: **12 px `--pulso-weight-semibold`, en color de texto**.
- Versalitas: **solo el antetítulo de un grupo**. Con todo en versalita nada
  encabeza nada.
- Cifra: 22 px, `--pulso-weight-black`, `font-variant-numeric: tabular-nums`.

### 3b. El detector, y por qué él mismo se audita

Medir a ojo no escala y medir mal es peor que no medir: un informe con cifras
infladas se defiende solo. En un único barrido este detector dio **cuatro**
familias de falso positivo, y las cuatro salieron de contrastar la medición
contra la captura —en un sentido o en el otro—. Están todas excluidas abajo y
**no se quitan**:

1. **Dentro de `<svg>`**: un `<text>` de Plotly mide `scrollWidth > clientWidth`
   y se dibuja entero. No es recorte.
2. **`pulso-sr-only`**: existe solo para el lector de pantalla. No se ve, no se
   puede recortar.
3. **`overflow: visible`**: el texto pinta fuera de su caja y se lee completo.
   Contarlo como recorte es contar el arreglo como si fuera el defecto.
4. **Versalitas que no transforman nada**: `text-transform: uppercase` se hereda,
   y «UMP 2» se ve igual con y sin él. Solo cuenta si el texto tiene minúsculas
   que de verdad cambian.

La exclusión 3 tiene cola, y es la que abre el detector de solapes: **pintar
fuera de la caja puede invadir al vecino**. Un `overflow: visible` puesto para
«arreglar» un recorte metió un número 3 px dentro de su rótulo.

```js
window.__auditar = () => {
  const raiz = document.querySelector(".mon-stage") || document.querySelector(".mon-page") || document.body;
  const EN_ESCALA = new Set(["0px", "10px", "14px", "16px", "999px", "9999px", "9997px", "50%"]);

  const seVe = (el) => {
    if (el.closest("svg")) return false;
    if (el.classList.contains("pulso-sr-only") || el.closest(".pulso-sr-only")) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") return false;
    const b = el.getBoundingClientRect();
    return b.width > 4 && b.height > 4;
  };

  const rotulo = (el) =>
    el.tagName.toLowerCase() + "." + (String(el.className || "").trim().split(/\s+/)[0] || "");

  const fuera = {}, recortes = [], cortados = [], duenos = [], solapes = [];
  const gaps = {}, padsV = {};

  for (const el of raiz.querySelectorAll("*")) {
    if (!seVe(el)) continue;
    const cs = getComputedStyle(el);

    // — escala —
    if (!EN_ESCALA.has(cs.borderRadius)) {
      const k = cs.borderRadius + " " + rotulo(el);
      fuera[k] = (fuera[k] || 0) + 1;
    }

    // — recorte horizontal REAL —
    const puedeScrollX = cs.overflowX === "auto" || cs.overflowX === "scroll";
    const pintaFuera = cs.overflow === "visible" || cs.overflowX === "visible";
    if (el.scrollWidth > el.clientWidth + 1 && !puedeScrollX && !pintaFuera) {
      recortes.push({ el: rotulo(el), enTabla: !!el.closest("table, [class*='-table']"),
                      txt: el.textContent.trim().slice(0, 32) });
    }

    // — alto: contenido perdido vs dueño de scroll —
    if (el.scrollHeight > el.clientHeight + 1) {
      if (cs.overflowY === "auto" || cs.overflowY === "scroll") {
        duenos.push({ el: rotulo(el), ve: el.clientHeight, hay: el.scrollHeight });
      } else if (cs.overflowY === "hidden") {
        // lo peor: se corta y NADIE puede llegar a lo que falta
        cortados.push({ el: rotulo(el), ve: el.clientHeight, hay: el.scrollHeight });
      }
    }

    // — espaciado, para comparar DENTRO de la superficie —
    if (cs.display.includes("grid") || cs.display.includes("flex")) {
      [cs.rowGap, cs.columnGap].forEach((g) => {
        if (g && g !== "normal" && g !== "0px") gaps[g] = (gaps[g] || 0) + 1;
      });
    }
    if (cs.paddingTop !== "0px") padsV[cs.paddingTop] = (padsV[cs.paddingTop] || 0) + 1;

    // — solape entre hermanos en flujo —
    const hijos = [...el.children].filter(
      (h) => seVe(h) && !/absolute|fixed/.test(getComputedStyle(h).position));
    for (let i = 0; i < hijos.length - 1; i++) {
      const a = hijos[i], b = hijos[i + 1];
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const ca = getComputedStyle(a);
      // El borde que de verdad se pinta, no el que mide la caja. Solo en HOJAS:
      // en un contenedor, `scrollWidth` incluye hijos absolutos —un rótulo de
      // tooltip de 71 px dentro de una casilla de 36— y eso no es un solape.
      const esHoja = a.children.length === 0;
      const derecha = (esHoja && (ca.overflow === "visible" || ca.overflowX === "visible"))
        ? ra.left + Math.max(a.scrollWidth, ra.width) : ra.right;
      if (Math.abs(ra.top - rb.top) < 4 && derecha > rb.left + 0.5) {
        solapes.push({ sobre: rotulo(a), invade: rotulo(b),
                       px: Math.round(derecha - rb.left), txt: a.textContent.trim().slice(0, 24) });
      }
    }
  }

  const orden = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  return {
    fueraDeEscala: orden(fuera),
    recortes: { total: recortes.length, enTabla: recortes.filter((r) => r.enTabla).length, muestra: recortes.slice(0, 6) },
    contenidoCortado: cortados,      // ← C4: se pierde en silencio
    duenosDeScroll: duenos,          // ← más de uno anidado es hallazgo
    solapes,
    espaciado: { gaps: orden(gaps), paddingsVerticales: orden(padsV) },
  };
};
```

El detector de solapes se comprobó **por mutación**, que es la única forma de
saber que no está simplemente ciego: se inyecta el defecto real —un `<strong>`
de 24 px con `overflow: visible` pintando «150» sobre su rótulo—, se confirma
que lo marca con los píxeles exactos, se retira y se confirma que vuelve a cero.
Si tocas el detector, repite esa comprobación antes de fiarte de un informe
limpio.

**Sobre el espaciado, y esto importa: la casa no tiene escala de espaciado.**
Medida en una superficie de referencia, los `gap` conviven en 1, 2, 4, 6, 8, 10,
11, 12 y 14 px, y no hay tokens `--pulso-space-*` que arbitren. Así que el
detector **informa, no reprueba**: no inventes una escala global y la impongas
—eso es una decisión de diseño de Gonzalo, no del loop—. Lo que sí es defecto,
y se arregla, es la incoherencia **dentro de una misma superficie**: dos gaps de
1 px de diferencia en el mismo nivel, o un panel cuyo padding no guarda relación
con el de sus hermanos. Si al medir aparece un patrón que pide escala global,
se anota en el registro como propuesta y se sigue.

### 4. Qué buscar

**Geometría y espaciado**

- Radios de un mismo nivel que no coinciden entre superficies hermanas.
- Tarjetas sin materia: rectángulos con una línea gris.
- Cajas concéntricas. Más de dos marcos y el ojo no sabe cuál es la unidad.
- Grupos pares sin `equal`: una tarjeta que colapsa a su contenido convierte
  cualquier diferencia de datos en desalineación.
- Recorte de dato operativo. Elipsis en etiqueta larga sí; en dato, nunca.
- Toolbars desbalanceados: `1fr` inanicia los lados.
- Vacío exterior sin dueño y scroll anidado (un solo dueño de scroll por
  pantalla).

**Encimados, alto y scroll** — lo que reportan `solapes`, `contenidoCortado` y
`duenosDeScroll`:

- **Elementos que se pisan.** Dos hermanos en flujo no deben cruzarse nunca. El
  caso típico no es un `position` mal puesto sino un ítem flex al que un
  `min-width: 0` deja encoger por debajo de su contenido: la caja mide menos de
  lo que pinta y el texto entra en el vecino. Se arregla donde está la causa
  —que el ítem no encoja— y no tapando con `overflow: hidden`, que cambia un
  solape por un recorte.
- **Contenido cortado en silencio** (`overflow: hidden` + desbordado). Es el
  peor caso de los tres, porque no hay barra que avise ni forma de llegar a lo
  que falta. Si la superficie necesita un tope de alto, el tope va con
  `overflow: auto`, no con `hidden`.
- **Alto máximo que no se respeta**, en los dos sentidos: un contenedor que
  crece sin límite y empuja el resto fuera de pantalla, y un `max-height` que
  recorta sin dar scroll. En una superficie con datos, la lista larga scrollea
  dentro y el marco se queda quieto.
- **El vacío no hereda el alto de lo lleno.** Un envoltorio con `height: 100%`
  para que la tabla llene el panel es correcto con datos y, sin ellos, convierte
  un aviso de una línea en cientos de píxeles de blanco enmarcado que se leen
  como carga fallida. Con `:has()` se distingue el caso vacío y se ciñe.

**Paneles y sideovers.** Es donde más se rompe el espaciado. Los de **agregar
fuente** en acreditación y en telefónico están señalados por Gonzalo como los
más flojos hoy y todavía no se han medido: son el primer objetivo del pase.
Qué se comprueba en ellos:

- El panel ocupa el alto completo y reparte cabecera, cuerpo y pie con un solo
  dueño de scroll: el cuerpo. Cabecera y pie no se van con el scroll.
- Padding uniforme en los cuatro lados del cuerpo, y el mismo que usan los
  paneles de la sección. Un sideover con padding propio se nota enseguida.
- Los pasos del guion respiran igual entre sí. Un paso activo puede tener más
  materia, no más margen.
- El pie con las acciones queda siempre alcanzable, también en 1024×600 y con el
  contenido más largo que el panel admita.

**Ausencias que se notan al llenar**

Si la superficie se auditó sin datos, no puede darse por cerrada: márcala
**parcial** en el registro y di explícitamente qué no se ha visto nunca. Un modo
entero puede pasar por conforme solo porque estaba vacío.

**Redacción**

- Antetítulos que repiten el nombre de la pestaña activa que el chrome ya dice.
- Subtítulos que parafrasean su título.
- Frases que describen una afordancia («pasa el cursor por…»).
- Rótulos que nombran el proveedor o la estructura interna (`snapshot`,
  `payload`, `raw`, `asset`, nombres de servicio) en vez de la pregunta del
  estudio.
- El mismo dato en dos sitios de la misma pantalla; la misma etiqueta sobre dos
  denominadores distintos.
- Identificadores opacos ocupando el sitio de un enlace o de un nombre humano.
- **Rótulos heredados que mienten.** Un nombre puede venir de la planilla con la
  que se operaba y significar otra cosa: en el Excel de cursos-horario, `CORTAS`
  y `LARGAS` no eran minutos sino rutas del cuestionario, y `VÁLIDO` no era
  validez metodológica sino haber alcanzado el 70 % del denominador. Cuando el
  rótulo engaña, se cambia el rótulo —eso es texto, entra en el alcance—; lo que
  no se toca es el cálculo que hay debajo.

**Cómo se reconoce el AI slop**

La prueba es una sola: **tapa la frase y pregunta qué se pierde.** Si no se
pierde nada, era slop. Ese hueco de la pantalla es para el dato.

Las cuatro formas que más aparecen aquí:

1. **Parafrasear el título.** «Cuotas» y debajo «Aquí se gestionan las cuotas».
2. **Escribir la afordancia.** «Haz clic para ver el detalle» sobre algo
   clicable. Si no se entiende que es clicable, el defecto es el estilo.
3. **Rellenar una ausencia.** Prosa donde debería haber una cifra que el
   producto todavía no calcula. Eso se anota en el registro, no se maquilla.
4. **Filtrar el nombre del campo.** `selection_run_id`, `snapshot`, `payload`
   puestos como si fueran texto de interfaz. El usuario no puede accionar el
   nombre de una variable.

Y el reverso, que también es slop: **el superlativo vacío**. Un rótulo no
necesita decir que es «completo», «avanzado» o «inteligente».

**Elegancia, en concreto**

«Más profesional» no es un criterio accionable, así que se traduce en cosas
medibles: una sola escala de radios por nivel; materia de tarjeta completa —las
tres capas, sin la luz interior el gradiente solo aplana—; una sola familia de
sombra; cifras en `tabular-nums` para que las columnas no bailen; versalitas
únicamente donde encabezan; y ningún borde de más. El borde se gana: si no
codifica estado ni separa dos superficies distintas, sobra.

**Didáctica**

Cada superficie declara qué es y qué se decide en ella. Guiar es **nombrar el
siguiente paso concreto**, no explicar el concepto. Un estado pendiente dice la
acción que lo resuelve; un estado completo no añade prosa. Cuando un dato falta
por una razón que el usuario puede corregir, se dice esa razón en el sitio donde
se corrige.

Y cuando una cifra convive con su denominador, el denominador se nombra. Una
tasa por encima del 100 % no es necesariamente un error —puede ser un
denominador desactualizado o gente de otra sección—, así que se explica en vez
de esconderse o de bloquear.

### 5. Reglas duras

- **Funcionalidad intacta.** CSS y texto. Nada de lógica, contratos ni datos.
- **No se maquilla una ausencia.** Si una superficie se ve pobre porque le falta
  una pieza que el producto todavía no tiene, eso se anota en el registro con su
  referencia y se deja tal cual. Rellenar el hueco con copy es exactamente el
  AI slop que este loop existe para quitar.
- **Tokens `--pulso-*`.** Ningún hex en CSS de feature.
- **Archivos congelados** (`agentic/manifest.json`): lo nuevo va a archivo
  propio. Comprueba con `node agentic/sync-agentic-os.mjs --audit`.
- **Iconos** por el shim `src/vendor/lucide-react`.
- **Scope por perfil.** Un cambio para telefónico se scopea a
  `.is-telefonico-profile`; tocar `profilePage.css` a pelo alcanza a los cuatro
  modos y no los has mirado todos.
- **Sin `!important`** salvo que exista y se explique el empate de cascada.

### 6. Verificar

Antes de commitear, y con el alcance acotado al diff:

- La superficie en pantalla, en **1440×1000** y **1024×600**.
- `pnpm -C frontend exec tsc --noEmit --pretty false`.
- `pnpm -C frontend exec vitest run src/features/monitoreo`.

Verde por conformidad, no por ausencia. Si un caso falla, córrelo aislado antes
de acusar a tu cambio: `MonitoringProfilesReadinessContract` recorre el AST de
los page-files completos y cae por contención en la suite, no por regresión.

### 7. Cerrar y seguir

Un commit por superficie, conventional en español, describiendo **lo medido**
—«radio 9 y sin sombra contra 14 con materia»— y no la intención. Actualiza el
registro con lo hecho, lo que dejaste fuera y por qué.

**Y pasa a la siguiente sin preguntar.** No pidas permiso para continuar: la
instrucción de correr el loop es la aprobación. Solo interrumpes si un cambio
exigiría tocar funcionalidad, si dos criterios se contradicen sin árbitro, o si
lo que encuentras es un bug de datos y no de estética —eso se reporta y se
sigue—.

No detenerse es la regla que más se incumple, y siempre de la misma forma: no
parando de golpe sino **programando una espera cuando no hay nada que esperar**.
Si el trabajo es tuyo y está por delante, encadena la siguiente superficie en el
mismo turno; una espera solo se justifica cuando hay algo externo de verdad
—una corrida, un servidor levantando—, y aun así se elige por lo que tarda eso,
no por costumbre.

Tampoco cuenta como avance dar una superficie por buena sin haberla medido
después del cambio. **El pase no termina en el commit, termina en la
comprobación**: se vuelve a correr `__auditar()` sobre la superficie ya tocada y
se mira la captura. Dos veces en un mismo barrido se escribieron reglas que no
llegaban a aplicar y el registro las dio por hechas.

Cuando el registro se quede sin pendientes, se reenumera todo (§1) y se vuelve
a empezar. El loop lo cierra Gonzalo, no el inventario.

---

## Cursos-horario: el único modo con especificación previa

Antes de tocar ese modo, lee `docs/plan-monitoreo-aulas-2026-07.md`. Es la
auditoría del Excel con el que se operó PUCP 2025 —`Base de control`, 47
columnas, 194 curso-horario— convertida en requisitos. Cambia cómo se audita el
modo en tres cosas.

### Sabes qué secciones debe tener

Cinco: **Fuentes, Agenda, Avance, Validación y Consultas**, y la §5 del plan
dice qué responde cada una. Si una superficie no responde lo suyo, el defecto no
es de espaciado. Anótalo como hallazgo estructural y sigue puliendo lo que sí
está.

### Sabes qué cifras deben cuadrar

El plan trae una línea base histórica que sirve de oráculo:

| Indicador | 2025 |
|---|---:|
| Registros de campo | 196 |
| Aplicaciones reales | 194 |
| Respuestas crudas | 3.708 |
| Respuestas atribuibles | 3.698 |
| Sin curso–horario | 10 |
| Exclusiones de ruta | 394 |
| Elegibles | 3.304 |
| Mujeres / hombres | 1.741 / 1.563 |
| Cumplen 70 % de población | 58 |

No es para hardcodearla ni para exigir que `hsvg2026` la reproduzca —es otro
estudio—. Es para reconocer la **forma** de las relaciones: los tres filtros
suman las exclusiones, elegibles más exclusiones son las atribuibles, mujeres
más hombres son los elegibles. Si una pantalla muestra cifras que no cierran
así, es un bug de datos: se reporta y se sigue con la estética.

### Sabes qué está ausente y no debe maquillarse

El plan documenta piezas que el producto todavía no tiene, y el guion de
conexión declara dos fuentes donde la especificación exige cuatro. Lo que
encuentres de esta lista se anota, no se rellena:

- **Estado de contacto y estado de aplicación en la misma columna.** En el Excel
  hacía figurar dos aplicaciones reales como agendadas. Son dos campos.
- **Asistencia pegada a mano** en vez de derivada de eventos de campo: iba 85
  asistentes por detrás de la fuente.
- **Aula planificada tratada como aula real.** Son `planned_room` y
  `actual_room`, y ocho cursos ni siquiera permitían extraer la planificada.
- **Elegibles calculados restando tres negativas**, que deja pasar como elegible
  cualquier respuesta con los consentimientos vacíos.
- **Reemplazos sin cadena longitudinal** hasta su titular.

Y hay diez preguntas metodológicas abiertas en la §8 del plan —qué es el 70 %,
qué separa elegible de validada, cuándo se activa un reemplazo—. Ninguna la
decide este loop. Si una superficie depende de una de ellas, se anota con el
número de la pregunta y se deja.

---

## El registro

`docs/qa/pulido-monitoreo-estado.md`, con una fila por superficie:

```markdown
| Modo | Sección › Pestaña | Estado | Hallazgos | Commit |
|---|---|---|---|---|
| telefónico | Fuentes › Fuentes activas | hecho | escala 9→14, celdas sin caja | 5b8d3db9 |
| cursos-horario | Agenda | pendiente | | |
```

Los hallazgos que no son estéticos van a una segunda tabla del mismo archivo,
separados por tipo —pieza ausente, bug de datos, pregunta metodológica—, con la
referencia al plan que los respalda. Esa tabla es la que convierte el loop en
algo más que un pase de CSS.

Cuando todas las superficies estén en `hecho`, empieza otra vuelta: baja el
umbral —alineación óptica, ritmo vertical, coherencia de estados entre modos— y
marca todo como `pendiente (vuelta 2)`.

---

## Lo que ya está hecho

Para no repetir trabajo, lee antes:

- `docs/lecciones-monitoreo-2026-07.md` — las 13 lecciones del rediseño de
  Acreditación y Telefónico, cada una con qué evaluar en los demás modos.
- `docs/plan-fuentes-legibles-2026-07.md` — Fuentes en los cuatro modos.
- `docs/plan-monitoreo-aulas-2026-07.md` — la especificación de cursos-horario.
- `docs/ui-layout-grammar.md` — la norma de layout y el Contrato de Superficie.

Telefónico › Fuentes quedó pulido el 2026-07-30 y sirve de patrón. **Territorial
y cursos-horario no se han mirado**, y el guion de conexión de Acreditación está
cubierto por test pero nunca se abrió en la app.
