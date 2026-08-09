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
    desbordes: nodos.filter((e) => e.scrollWidth > e.clientWidth + 4 && e.clientWidth > 0).length,
    prosaLarga: [...raiz.querySelectorAll('p')].filter((p) => txt(p).trim().length > 180).length,
    cripticos: (t.match(/pi_design|pi_mc|eligible_n|discount_step|classroom_id|stratum|Monte Carlo|seleccion final|comparacion|implementacion|metodos/g) || []).length,
    titulosRepetidos: titulos.length - new Set(titulos).size,
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

- [ ] **L1 · `SEL/titulares`: los 117 desbordes.** Es la peor de la app y la
  que el usuario mira después de sortear. Diagnosticar si es una tabla sin
  `min-width`, una grilla con columnas fijas o KPIs con texto largo
  («Balance por cuotas y tam…» se corta en el tile de método).
- [ ] **L2 · `SEL/titulares`: 55 títulos repetidos y 6.586 px.** Hoy repite
  «196 titulares» y «1.638 / 2.234 reservas» en dos bloques con nombres
  distintos. Elegir uno y partir la vista.
- [ ] **L3 · `SEL/reemplazos`: 94 títulos repetidos.** Es el número más alto
  del módulo; casi seguro una lista que repite el mismo rótulo por fila.
- [ ] **L4 · Los warnings crudos del motor (18 crípticos en 3 pestañas).**
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
- [ ] **L9 · El goo sigue viéndose mal.** El detector cuenta desbordes y
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

_(vacío: el loop lo va llenando)_

## Hallazgos que no son visuales

Se anotan acá y NO se arreglan en este loop; se llevan a su propia unidad.

- El sorteo desde la UI corrió con `cube_balanceado` aunque el workspace tenía
  `sistematico_pps`: el engine del selector no se estaba tomando del config del
  workspace. Confirmado en la corrida `sel_aulas_20260808153925`.
