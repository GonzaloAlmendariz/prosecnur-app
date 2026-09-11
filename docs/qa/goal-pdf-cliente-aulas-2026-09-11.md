# El PDF de avance a cliente de cursos-horario — 2026-09-11

Qué se construyó, con qué reglas, y qué NO hay que volver a hacer. Lo dictó
Gonzalo en una sesión de treinta iteraciones mirando el documento renderizado.

El motor vive en `api/R/monitoreo_aulas_report_pdf.R` (modelo + ensamblado),
`monitoreo_aulas_report_paginas.R` (cada página), `monitoreo_aulas_report_ritmo.R`
(serie diaria, defectos de portada y **plan del documento**) y el kit compartido
`pulso_pdf_dashboard.R` / `pulso_pdf_portada.R` / `pulso_pdf_theme.R`.

## El encargo, textual

- «un reporte de avance a cliente elegante, el PDF con gráficas profesionales de
  avance diarios y las tablas increíbles que ya tenemos en avance»
- «recuerda que es para cliente, entonces lo relacionado con rendimiento y todo
  lo demás es interno; lo que a ellos les importa es el avance en sí mismo»
- «apaisado, portada pero editable desde la UI»
- «no importa usar más página con tal de que se vea bien»

## Las reglas que fijó, y que gobiernan todo texto nuevo

1. **Un rótulo nombra; no enseña.** Antes de dejar una línea de prosa: ¿lo dice
   ya el dibujo o la cifra de al lado? ¿lo diría así el cliente, o es como
   hablamos nosotros del operativo? Si cualquiera de las dos, fuera. Él quitó
   cuatro frases que yo había defendido: «cada sexo tiene su propia cuota…»,
   «en plataforma», «reparto por sexo», y el pie que narraba el gráfico de
   encima. **El defecto por defecto es escribir de más.**
2. **El color se gana distinguiendo.** Texto corrido, cifras de tabla y rótulos
   van en `ink`/`soft`. Sobrevive el verde del cero —la cuota cerrada es el único
   estado que cambia de naturaleza— y los dos colores de sexo, que separan series.
3. **Una serie se trata siempre igual.** Nada de escribir unas cifras dentro de
   la barra y otras fuera según su altura: dos tratamientos para el mismo dato es
   lo que hace que una página parezca descuidada.
4. **Toda medida se deriva; ninguna se teclea.** Anchos de columna, altos de
   fila, capacidad de hoja. Y donde se pueda, con `stopifnot`.
5. **Lo que sobrepasa su meta se pinta al 100 %**; el rótulo dice el 123 %.

## El defecto que apareció CINCO veces

Siempre la misma forma: **un valor que gobierna el comportamiento, escrito en
más de un sitio, con una copia que envejece sola**. Nunca falla ruidosamente:
produce una página que se ve *casi* bien.

| Qué estaba duplicado | Cuánto | Cómo se resolvió |
|---|---|---|
| Cuerpos de versalitas | 4 valores (5,8 · 6,0 · 6,2 · 6,4) | rol `eyebrow` en `pulso_pdf_type()` |
| Pesos de regla | 8 valores (0,28 a 0,9) | `pulso_pdf_pesos()`: fila · columna · bloque · acento |
| Regla de reparto de filas | 3 copias, una a medias | `.marp_reparto_de_filas()` |
| Marco de página | 7 techos y 5 suelos | `.MARP_MARCO`, y lo que lo desplaza se resta |
| Total de páginas | suma de 6 sumandos a mano | `monitoreo_aulas_plan_del_documento()` |

## Defectos que sólo se veían RENDERIZANDO

Los tests estaban verdes en todos estos casos.

- **El «apaisado» no era apaisado**: se pedía `geo$w_in`/`geo$h_in`, que no
  existen en el kit, y `pdf()` caía en silencio a 7×7 pulgadas. Ahora
  `pulso_pdf_abrir()` valida la geometría y un test mide el MediaBox.
- **La línea del acumulado salía plana**: la escala usaba `.ppd_num()`, que
  devuelve el primer elemento.
- **Un solo rótulo de facultad**: `.form_pdf_clean_text()` es escalar y colapsa
  el vector.
- **«Aulas planificadas» contaba el banco de reservas** (1.392 en vez de 174).
- **El acumulado parecía saltarse días**: el punto y su cifra se dibujaban en el
  mismo bucle, así que espaciar los rótulos borraba también los puntos.
- **Media hoja de paneles en blanco** dos veces: el reparto parejo no llegaba a
  los paneles, y luego la rejilla la elegía cada hoja en vez del total.

## Lo que NO es un defecto, y está documentado como tal

- `include_targets` se **ignora a propósito** en este motor: el reporte se define
  contra la cuota, así que un documento sin metas no sería una variante sino otro
  documento, vacío. La casilla «Incluir metas» del panel se oculta en
  cursos-horario (`ofreceMetasOpcionales`), y las dos mitades se citan entre sí.
- `titulo`/`subtitulo` son el último recurso de la portada: lo que se imprime
  sale de `model$portada_defecto` y de lo que el usuario escriba.

## Accesibilidad, medida

- Todo color de texto llega a 4,5:1 sobre blanco. `faint` estaba en 3,15:1 y es
  el color de casi todos los rótulos pequeños → `#6e7784`.
- **Azul y rosa son el mismo gris** (luminancias 0,160 y 0,163): impreso en
  blanco y negro los dos carriles son indistinguibles. Por eso «Metas por
  facultad» escribe la inicial H/M bajo cada carril. Un test fija esa cercanía
  para que nadie retire la inicial creyendo que el color basta.

## Cómo se verifica

Runners en el scratchpad de la sesión (mueren con ella; el contrato durable es
el test):

- `render_pdf_cliente.R` — corte real desde una copia del `.pulso`.
- `render_serie_larga.R` — quince jornadas sintéticas. **Úsalo siempre que
  toques un gráfico**: con cinco días todo compone bien.
- `render_bordes.R` — una facultad, sin ritmo, cuatro facultades, sin
  sobremuestra.

Contrato reproducible: `test-monitoreo-aulas-report-bordes.R` arma modelos
sintéticos, renderiza y contrasta el plan del documento con las páginas del PDF.
**El proyecto de referencia `hsvg2026` NO sirve** para esto: trae el plan vacío,
sin snapshot de monitoreo y sin cuotas.

## Pendiente

- `R CMD INSTALL` del paquete R para que el job del backend vivo tome la firma
  nueva del runner (`portada`). Sin eso, generar el PDF desde la app falla con
  «unused argument». **Sólo con el go de Gonzalo**: el install borra el paquete
  antes de escribirlo y deja la UI caída varios minutos.
- Enriquecer `api/inst/reference_projects/hsvg2026/` con un snapshot de
  monitoreo, para que el bucle de verificación sea reproducible fuera de sesión.
