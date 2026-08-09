# GOAL · Selección se ve como Cálculo y Marco

**Rama**: `revamp/seleccion-visual` · **Abierto**: 2026-08-09 · **Cierra**: solo Gonzalo.

Loop de convergencia permanente. Cada iteración toma UNA superficie, la deja a
la altura de la vara y la commitea. El loop no se detiene por haber terminado
una lista: cuando la lista se agota, se vuelve a medir y nace la siguiente.

---

## Por qué existe

Selección quedó atrás. No es impresión: se midió recorriendo las once pestañas
de las dos secciones sobre el estudio real acreditado (`hsvg2026-aulas-sel`,
corrida `sel_aulas_20260808153925`, 196 titulares y 2.430 filas), contando
sobre el DOM montado.

| Métrica | Cálculo (4 pestañas) | Selección (7 pestañas) |
|---|---|---|
| Elementos con desborde de caja | 2 | **129** |
| Texto crudo del motor (identificadores, sin tildes) | 0 | **18** |
| Títulos repetidos dentro de la misma vista | 15 | **179** |
| Párrafos de más de 180 caracteres | 0 | **8** |
| Badges «cifra validada» | 1 | **29** |

Y por pestaña, el detalle que dice dónde duele:

| Pestaña | Desbordes | Prosa larga | Crípticos | Títulos repetidos | Badges | Alto (px) |
|---|---|---|---|---|---|---|
| SEL/objetivo | 2 | 1 | 0 | 5 | 3 | 1.999 |
| SEL/metodo | 0 | 1 | 6 | 14 | 1 | 2.909 |
| SEL/simulacion | 0 | 1 | 6 | 5 | 4 | 1.725 |
| **SEL/titulares** | **117** | 3 | 0 | **55** | 5 | **6.586** |
| SEL/perfil | 0 | 0 | 0 | 0 | 0 | 1.488 |
| **SEL/reemplazos** | 10 | 2 | 0 | **94** | 4 | 2.427 |
| SEL/sustento | 0 | 1 | 6 | 6 | **12** | 2.019 |

Señal estructural que acompaña: Selección tiene **354 líneas de CSS por
pestaña** contra 1.138 de Marco y 596 de Cálculo, y 109 clases raíz contra 335
de Marco. Un tercio del estilo por superficie, con más superficies que cubrir.

---

## La vara

Lo que Cálculo hace y Selección todavía no. Cada punto es verificable, no una
opinión.

- **V1 · Nada se corta.** Cero elementos con `scrollWidth > clientWidth`. Hoy
  Cálculo tiene 2 y Selección 129.
- **V2 · El motor no habla en la UI.** Ningún identificador interno
  (`pi_design`, `discount_step`, `eligible_n`, `stratum`) ni texto sin tildes
  llega al usuario. Un warning del motor se traduce; si no se sabe traducir, se
  resume y el crudo va detrás de un disclosure.
- **V3 · Un título aparece una vez.** Dos avisos con el mismo título y cuerpos
  distintos son dos cosas distintas y tienen que llamarse distinto.
- **V4 · Sin párrafos-ensayo.** Nada por encima de 180 caracteres corridos. La
  regla de la casa: no parafrasear el título ni escribir la afordancia.
- **V5 · Una cifra, un lugar.** Hoy «196 titulares» y «1.638 reservas» salen
  dos veces por pantalla con dos nombres. Se elige uno.
- **V6 · El badge no es decoración.** «cifra validada» doce veces en una vista
  deja de informar. Se declara una vez por bloque, no por celda.
- **V7 · Jerarquía de tarjeta.** El idioma de Cálculo —tarjeta enmarcada,
  rótulo en el acento del módulo, KPIs con punto de estado y bajada— vale para
  Selección. Los encabezados en versalita gris suelta no.
- **V8 · Altura razonable.** `SEL/titulares` mide 6.586 px: es la superficie
  más larga de la app. Se parte o se colapsa lo secundario.

Y todo lo anterior sin romper lo que ya está: **Contrato de Superficie C1–C5**
(`docs/ui-layout-grammar.md`), tokens `--pulso-*` sin hex nuevo, y la regla de
que cada cifra sale del dato publicado (ADR 0067 rige el Relato).

---

## Cómo corre cada iteración

1. **Medir antes.** Abrir la pestaña en el proyecto acreditado y correr el
   medidor de la sección «Medidor» de abajo. Anotar la línea base.
2. **Una superficie por iteración.** La de peor número, salvo que una anterior
   haya quedado a medias.
3. **Arreglar.** Frontend, dentro de
   `frontend/src/features/calcMuestra/universidad/aulas/`.
4. **Medir después.** Mismo medidor. Si la métrica no bajó, la iteración no
   terminó — no se commitea un cambio que no movió el número.
5. **Gate.** `pnpm -C frontend exec tsc --noEmit` y la suite de
   `src/features/calcMuestra`. Si el cambio toca R, además su `test_file`.
6. **Commitear** en `revamp/seleccion-visual`, conventional commit en español,
   con el número antes y después en el cuerpo.
7. **Actualizar este doc**: tachar lo hecho, anotar lo que apareció.

### Regla de aislamiento (importante)

El árbol trae cambios **de otra sesión** (gráficos / serie temporal). El loop
commitea **solo** rutas bajo `frontend/src/features/calcMuestra/universidad/aulas/`,
`docs/qa/goal-loop-seleccion-visual-2026-08-09.md` y, si hiciera falta,
`api/R/calc_muestra_aulas*`. Nunca `git add -A`, nunca `git add .`.

### Medidor

Sobre la pestaña montada, en la consola del navegador:

```js
(() => {
  const raiz = document.querySelector('.cmv2-tab-panel') || document.body;
  const txt = (e) => (e && typeof e.innerText === 'string') ? e.innerText : '';
  const nodos = [...raiz.querySelectorAll('*')];
  const t = txt(raiz);
  const titulos = [...raiz.querySelectorAll('h3,h4,strong')].map((e) => txt(e).trim()).filter(Boolean);
  return {
    // Solo cuenta lo INALCANZABLE. Un carril que scrollea a propósito no es un
    // defecto: C4 pide que todo se pueda alcanzar, no que todo quepa sin mover.
    // Contar el scroll deliberado inflaba la cifra (28 brutos vs 6 reales) y
    // hacía ver como regresión un nodo más ancho que sí mejoraba la lectura.
    desbordes: nodos.filter((e) => {
      if (e.ownerSVGElement != null || e.tagName === 'svg') return false;
      if (!(e.scrollWidth > e.clientWidth + 4 && e.clientWidth > 0)) return false;
      let p = e;
      while (p && p !== raiz) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll') return false;
        p = p.parentElement;
      }
      return true;
    }).length,
    prosaLarga: [...raiz.querySelectorAll('p')].filter((p) => txt(p).trim().length > 180).length,
    cripticos: (t.match(/pi_design|pi_mc|eligible_n|discount_step|classroom_id|stratum|Monte Carlo|seleccion final|comparacion|implementacion|metodos/g) || []).length,
    // Solo RÓTULOS constantes. Los datos repetidos son legítimos: un curso
    // aparece en varias cadenas y una facultad en varias filas. En esta app el
    // dato llega en MAYÚSCULAS desde la fuente y los rótulos que escribe la UI
    // van en oración, así que ese es el discriminador. Contando datos, la peor
    // pestaña marcaba 94 y en realidad tenía 1 defecto.
    // Limitación: un rótulo escrito en mayúsculas se escaparía.
    titulosRepetidos: (() => {
      const c = {};
      for (const s of titulos) if (s !== s.toUpperCase()) c[s] = (c[s] || 0) + 1;
      return Object.values(c).reduce((a, n) => a + (n - 1), 0);
    })(),
    badges: (t.match(/cifra validada/g) || []).length,
    alto: raiz.scrollHeight,
  };
})()
```

### Cómo abrir la vista

El proyecto acreditado (con selección, comparación y objetivo vigentes):

```
outputs/reference-runs/hsvg2026-aulas-sel-20260808-143428/hsvg2026-aulas-sel.pulso
```

Backend `Backend hsvg2026 seleccion (8803)` + `Frontend (dev vs 8803)` de
`.claude/launch.json`; después `window.__pulsoNav.ir("calc-muestra/opinion-universitaria/aulas/<pestaña>")`.
El warm start del proyecto real tarda ~5 min: se levanta UNA vez por sesión y
se recorren todas las pestañas ahí.

---

## Lo que la vista tiene que responder (C5 · suficiencia)

Dicho por Gonzalo el 2026-08-09 mirando la corrida real. Va PRIMERO porque no
es pulido: es que la superficie no entrega lo que su función promete. Una
pestaña bonita que no contesta estas preguntas sigue estando mal.

- **P1 · ¿Cuáles son todos mis titulares?** Hoy no se entiende cuáles son. La
  lista tiene que ser legible y completa, no una cifra agregada con una tabla
  a medias.
- **P2 · ¿Cómo se reparten por facultad?** La lectura no está estratificada.
  Facultad es la unidad con la que el equipo piensa el campo, y es además la
  variable de estrato del sorteo: la vista tiene que agrupar por ahí.
- **P3 · ¿Quién dicta cada curso-horario?** No se da la info del docente
  principal. Sin eso la lista no sirve para coordinar.
- **P4 · ¿Qué reemplazos respaldan a cada titular?** La relación de
  cursos-horario no muestra los reemplazos de cada uno en positivo — se ven
  como agregado («1.638 reservas») en vez de «este titular tiene estas
  reservas, en este orden».

Estas cuatro mandan sobre la cola de abajo. Una iteración que mejora un número
pero deja P1–P4 sin responder no cuenta como avance.

## Cola de trabajo

Ordenada por daño medido, **debajo** de P1–P4. Se re-ordena al volver a medir.

- [x] ~~**L1 · `SEL/titulares`: los 117 desbordes.**~~ Hecho. Eran 84 nombres
  de curso cortados. Con el medidor corregido (solo lo inalcanzable) la vista
  queda en **6**, y los seis son la misma cadena: el tile de método con
  «Balance por cuotas y tamaño» (271 px en 206).
- [x] ~~**P3 · el docente principal.**~~ Hecho en el mapa de selección.
- [ ] **L2 · `SEL/titulares`: 55 títulos repetidos y 6.586 px.** Hoy repite
  «196 titulares» y «1.638 / 2.234 reservas» en dos bloques con nombres
  distintos. Elegir uno y partir la vista.
- [x] ~~**L3 · `SEL/reemplazos`: 94 títulos repetidos.**~~ Hecho: con el
  medidor corregido queda en **0**. De los 94 brutos, 93 eran datos repetidos
  legítimos y el defecto era uno solo, repetido 24 veces.
- [x] ~~**L4 · Los warnings crudos del motor (18 crípticos en 3 pestañas).**~~
  Hecho: 18 → **0**. Quedan los crípticos que el regex todavía no nombra (L10).
  Texto original de la línea:
  «Comparacion de metodos con descuento secuencial aplicado al sorteo: las pi
  de esta tarjeta son referenciales del diseno estatico (pi_design)…» llega
  literal, sin tildes. Y «Fallback metodológico» aparece dos veces seguidas
  con cuerpos distintos. Traducir en el borde de presentación, no en R.
- [ ] **L5 · Los 29 badges «cifra validada».** Uno por bloque, no por celda.
- [ ] **L6 · Los 8 párrafos-ensayo.** Empezando por el de `SEL/titulares`
  («Ninguno de estos cursos-horario se eligió "a dedo"…»).
- [ ] **L7 · Jerarquía de tarjeta en las 7 pestañas**, tomando de Cálculo el
  patrón de tarjeta + rótulo con acento + KPI con punto y bajada.
- [ ] **L8 · La banda de KPIs se corta** («P1 · Universidad · R · fr…») en
  1280 de ancho. Es compartida, así que tocarla exige revisar Cálculo y Marco.
- [x] ~~**L9 · El goo sigue viéndose mal.**~~ Hecho en su parte medible: 0
  pares de bolas solapadas y 0 rótulos encimados. Queda lo cualitativo (tirantes
  vivos y propagación por grafo), que es el pendiente del motor rAF.
  Texto original: El detector cuenta desbordes y
  títulos, y de eso no se entera. Lo que falla es composición: bolas que se
  tocan, rótulos encima de rótulos, y la cola perdiéndose cuando hay muchos
  estratos cortos. Se mide distinto — distancia mínima entre centros contra
  suma de radios, y cajas de texto que se solapan— y se arregla en
  `relato/escenas/` sin romper los contratos del ADR 0067.
- [ ] **L10 · Barrido de crípticos más allá del regex.** El medidor solo caza
  una lista fija de identificadores; Gonzalo sigue viendo texto que no se
  entiende. Cada iteración de esta línea toma UNA pestaña, lee su texto
  renderizado de punta a punta y reescribe lo que un coordinador de campo no
  podría explicar en voz alta. El regex se amplía con lo que aparezca.

## Hecho

### Iteración 1 · `SEL/titulares`: los nombres de curso se leen (P1)

99 desbordes reales → **19**. Los 84 que faltaban eran el nombre del
curso-horario en `.cmv2-selection-map-node`: caja fija de 116 px con el texto
en una línea, así que TODO nombre salía cortado.

**La trampa**: quitar `white-space: nowrap` de la regla del span no alcanzó. El
nodo es un `<button>` y el reset global trae `button { white-space: nowrap }`,
que se hereda; el computado seguía en `nowrap`. Hay que pisarlo con
`white-space: normal`, no omitirlo.

Al leerse los nombres quedó a la vista que la pestaña **ya** estaba
estratificada por facultad (P2) y **ya** mostraba los reemplazos de cada
titular (P4) — «EDUCACION · 3 CH · 19 reemplazos», `CH 4` → `R 4.5, R 4.4…`.
No faltaban: estaban ilegibles. **P3 (docente principal) sigue ausente.**

Medido antes/después con el proyecto acreditado; gate: tsc 0 errores, 1.223
tests de calcMuestra.

### Iteración 5 · el goo se lee (L9)

El medidor de esta línea es otro, porque el problema no era desborde:
**distancia entre centros contra suma de radios**, y **cajas de rótulo que se
intersecan**.

Medido: **0 pares de bolas solapadas** —eso ya lo había resuelto la escala por
densidad— y **11 pares de rótulos encimados** de 60. O sea que lo que se veía
sucio no eran las bolas: eran las etiquetas.

Sesenta nombres simultáneos no se leen, y no es lo que la escena cuenta: la
escena cuenta QUÉ pasa ahora. El rótulo fijo queda solo en la bola recién
encendida; el resto conserva su código en hover y en el `<title>`, y la
secuencia completa ya vivía en la lista «Orden real del sorteo» debajo del SVG
— nada deja de ser alcanzable (C4). 11 → **0**.

Tres guards nuevos congelan lo aprendido en las últimas iteraciones: el rótulo
fijo colgado de `esReciente` y no de `encendida`, la escala por densidad, y la
espiral continua en vez de la de Vogel.

### Iteración 4 · una regla se dice una vez (V3, L3)

`SEL/reemplazos` marcaba 94 títulos repetidos, el peor del módulo. El defecto
era **uno**: cada una de las 24 tarjetas de cadena traía un bloque idéntico
«Activación ordenada» con una frase que solo cambiaba el código del titular.
Una regla que vale para todas las cadenas, dicha veinticuatro veces. Ahora se
dice una vez, arriba de la lista. 24 → 0.

**El medidor volvía a inflar**, y esta vez al revés que la anterior: contaba
como defecto los datos repetidos —«ÉTICA» en 6 cadenas, «DERECHO» en 5—, que
son legítimos. Corregido con el discriminador que esta app permite: el dato
llega en MAYÚSCULAS desde la fuente y los rótulos de la UI van en oración.
Con eso, el panorama real de rótulos repetidos en Selección es **24**, no 179,
y `SEL/reemplazos` —«la peor»— queda en **0**. La cola se reordena:
`SEL/titulares` (11) y `SEL/metodo` (8) son ahora las que quedan.

### Iteración 3 · el motor deja de hablar en la UI (V2, L4)

18 crípticos en `SEL/metodo`, `SEL/simulacion` y `SEL/sustento` → **0**.

La lista de riesgos ya escondía el crudo tras un disclosure, pero solo
reconocía `paquete::funcion`. El resto de la jerga pasaba entera: identificadores
internos (`pi_design`) y castellano sin tildes, que es la huella de una cadena
escrita en R en ASCII. Ahora la detección cubre las tres marcas y hay
diccionario para los avisos conocidos, en `avisosDelMotor.ts` — traducido en el
BORDE de presentación, no en R: el mensaje literal tiene que seguir existiendo
para quien audita, solo deja de ser lo primero que se lee.

De paso arregla títulos repetidos: R mandaba dos avisos distintos bajo un mismo
«Fallback metodológico». Con título propio cada uno, los repetidos bajaron
14→13, 5→4 y 6→5.

### Iteración 2 · el docente principal, y un medidor que mentía (P3)

El pie del nodo decía «Misma celda» **también en el titular**, donde no
significa nada: la equivalencia mide cuánto se parece un REEMPLAZO al titular
que cubre. En la cabeza de la cadena era un rótulo constante repetido una vez
por cadena. Ahí va ahora el docente — 15 de 15 titulares visibles lo muestran,
y «Misma celda» en titular bajó a 0.

**El medidor estaba inflado.** Contaba como desborde el carril de reemplazos,
que scrollea a propósito. Con nodos más anchos el bruto subió de 19 a 28 y
parecía una regresión, cuando lo inalcanzable eran **6**. Corregido: solo
cuenta lo que ningún ancestro desplazable puede revelar, que es lo que C4
pide. Las cifras de este doc anteriores a esta iteración son brutas.

## Hallazgos que no son visuales

Se anotan acá y NO se arreglan en este loop; se llevan a su propia unidad.

- El sorteo desde la UI corrió con `cube_balanceado` aunque el workspace tenía
  `sistematico_pps`: el engine del selector no se estaba tomando del config del
  workspace. Confirmado en la corrida `sel_aulas_20260808153925`.

### De la revisión del informe metodológico externo (2026-08-09)

Llegó una revisión del paquete de Kamila contrastado contra el motor. Lo que
deja tarea, con lo que agrega esta sesión:

- **PII sin anonimizar — lo más urgente.** `Muestreo Hostigamiento.xlsx` trae
  nombres, correos institucionales y celulares de docentes. No entra al repo ni
  a un `.pulso` sin pasar por `api/scripts/pulso_anonimizar.R`. Y ojo con el
  orden: hasta hoy ese anonimizador **destruía las dimensiones categóricas**
  (F111, `538eb68f`); un fixture construido antes de ese fix queda con las
  facultades inservibles. Anonimizar con el código actual, no con un build viejo.
- **Dimensionar al 95% en vez de al centro.** El motor dimensiona con
  `aulas = ceil(cuota / (tamaño × tau))`, que apunta a que alcance *en
  promedio*. El criterio del informe —cuántas aulas hacen falta para que
  alcance el 95% de las veces— es mejor y no está en la app. Adoptarlo como
  criterio, no portar su código.
- **El lazo barato que propone la revisión depende de algo que estaba roto.**
  Sugiere correr el MC sobre estudiantes únicos NETOS, apoyándose en el
  descuento secuencial del motor. Correcto, pero el descuento se apagaba solo
  en todo proyecto reabierto porque el guardado borraba `unique_student_ids`
  (F114, `a859b321`). Sin ese fix el lazo no podía funcionar. Ya está reparado.
- **El recorrido de Madow solo se publica sin descuento.** La revisión acierta
  en que `calc_muestra_aulas_recorrido.R` es Madow (arranque + paso 1, recta de
  π). Pero con el descuento secuencial ACTIVO el sistemático deja de caminar
  una recta: sortea de a uno recalculando la MOS neta, y el recorrido se
  declara inaplicable con motivo `descuento_secuencial`. Quien porte el
  criterio del 95% tiene que decidir cuál de los dos diseños simula — es
  exactamente el defecto que la revisión le señala al informe (simular un
  diseño distinto del que se ejecuta).
- **Rendimiento efectivo = asistencia × respuesta.** El motor descuenta con
  `tau` (asistencia) y no con la no-respuesta dentro del aula. Es un cambio de
  `calc_muestra_asistencia_referencia.R`, no de esta rama.
- **Piso por facultad `máx(3, 10% del máximo)`.** `minEligible.byFaculty`
  acepta un valor por facultad pero no la fórmula. Gap chico.
