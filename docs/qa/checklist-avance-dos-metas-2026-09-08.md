# Checklist — Avance con las dos metas, por sexo, en el Sheets y en la app

**Fecha:** 2026-09-08 · **Origen:** conversación guiada tras detener el loop
(`docs/qa/checklist-loop-estetica-sheets-app-2026-09-07.md`). Gonzalo: «vamos
cerrando lo pendiente y nos centramos en cosas puntuales que quiero ver contigo y
me preguntes cómo se vería o entendería mejor. Me interesa que veamos avance,
tanto en el sheets como en la app».

## Las cuatro decisiones (respuestas textuales de Gonzalo, 2026-09-08)

1. **La meta.** «Dos metas una real y otra referencial (aunque no debe decir que
   lo es), la de 2500 y la de 3750. Además debe estar clarísimo la meta de
   hombres y mujeres en total y por facultad en muestra y sobremuestra. Debe
   haber una fila de total al final y todo debe estar muy estético e intuitivo.»
   → Las dos metas se llaman **Muestra** (2 500) y **Sobremuestra** (3 750) y
   reciben el mismo trato: meta, conseguidas, avance y faltan, en total, por sexo
   y por facultad. Ninguna nota dice «referencial» ni «no es una meta».
2. **Facultades:** «Barras por facultad» — una fila por facultad con la barra de
   avance partida en mujeres y hombres, las cifras al lado, y chips de estado
   sólo cuando algo cambia (cumplida o le falta poco).
3. **El día:** «Por día y por facultad» — cada día se abre por facultad.
4. **Qué preside Avance:** «Efectivas sobre la cuota (212 de 2,500 · 8,5 %)».

## Lo que ya se sabía del dato (para no reinvestigarlo)

- `design_targets` trae `meta_diseno` 2 500, `sobremuestra` 1 250,
  `meta_operativa` 3 750, y por facultad `cuota` con `cuota_sexo {F, M}`. La suma
  de cuotas por facultad es 2 500 en HSVG2026 (`total_cuota`). **No trae la
  sobremuestra por facultad ni por sexo**: se reparte con el ratio del diseño
  (3 750 / 2 500 = ×1,5) por resto mayor, para que las partes sumen el total.
- El bloque «Avance contra la meta» de hoy abre con «Encuestas de la meta 3 158»,
  que es la suma de `expected_valid` por curso-horario del plan: una tercera
  cifra que Gonzalo no pidió. Deja de presidir; se conserva sólo como
  denominador de «llegaron a SU meta» (que es por curso-horario) y como
  respaldo cuando el estudio no trae cuotas del diseño.
- La brecha nunca se compensa entre celdas (ADR 0079): «Faltan» suma lo que
  falta en cada facultad × sexo, en la muestra y en la sobremuestra por igual.
- La atribución respuesta → curso-horario → facultad es una sola
  (`.maac_atribucion`, tres claves); el avance diario por facultad la reutiliza
  en vez de cruzar por su cuenta.

## Tablero

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| V1 | Tabla por facultad con las columnas que dictó Gonzalo (2026-09-08, con pantallazo del Sheets vivo, textual: «Facultad, muestra, muestra mujeres, muestra hombres, efectivas, efectivas hombres, efectivas mujeres, faltantes (sobre muestra), faltantes hombre, faltantes mujeres, aulas aplicadas, sobremuestra, sobremuestra mujeres, sobremuestra hombres, faltantes (sobre la sobremuestra)»). Se van «Aulas del plan», «Avance» y «Techo con sobremuestra». La sobremuestra por facultad y por sexo se reparte por resto mayor desde el ratio del diseño, para que las partes sumen el total. **Decisión propia a confirmar**: el dictado alterna el orden de los sexos (mujeres→hombres en muestra y sobremuestra, hombres→mujeres en efectivas y faltantes); se deja mujeres→hombres en los cuatro grupos, como en el resto del libro y de la app | `carga_aulas_libro_avance_facultad.R` (`.calaf_sobremuestra_reparto`) · PDF `monitoreo_aulas_report_pdf.R` (columnas por nombre) · tests `test-aulas-libro-avance-facultad.R`, `test-monitoreo-aulas-conteos-control.R`, `test-monitoreo-aulas-avance-facultad-paridad.R` | ☑ `ed17d4ee` — medido sobre el estado real: Total 2 500 (1 239 M / 1 261 H) · Efectivas 212 (77 / 135) · Faltantes 2 288 (1 162 / 1 126) · Aulas aplicadas 9 · Sobremuestra 3 750 (1 859 / 1 891) · Faltantes para la sobremuestra 3 538; facultad 79, xlsx 67, Sheets 90, paridad, conteos y report-model en verde; render real revisado |
| V2 | Fila «Total» al final de la tabla por facultad, en xlsx y Sheets: sumas de personas y de aulas, faltantes sumados (ADR 0079) | `.calaf_fila_total()` en `carga_aulas_libro_avance_total.R` (nuevo) · xlsx `aulas_libro_escribir_indicadores` · Sheets `aulas_libro_hoja_avance` · banda «Total» de `.maaf_requests` (`.maaf_FILA_TOTAL`, la misma del diario) | ☑ `ed17d4ee` — negrita con filete arriba en el xlsx; banda de cierre en Sheets; el test S5 del diario aprendió a buscar SU «Total» después de «Dia» |
| V3 | Bloque «Avance contra la meta» con las dos metas por sexo: tabla «Por sexo · Total · Mujeres · Hombres» con filas Efectivas conseguidas · Muestra · Avance a la muestra · Faltan para la muestra · Sobremuestra · Avance a la sobremuestra · Faltan para la sobremuestra; debajo, cursos-horario del operativo y los que llegaron a su meta. Sin cuotas del diseño, el bloque de hoy (meta del plan) | modelo `ind$metas` en `carga_aulas_libro_avance_metas.R` (nuevo) · xlsx · Sheets · `.maaf_CABECERAS_TABLA` gana «Por sexo» | ☑ — medido sobre el estado real: titular «Efectivas sobre la cuota: 212 de 2 500 (8.5 % de la muestra; 5.7 % de la sobremuestra)»; tabla Efectivas 212 (77/135) · Muestra 2 500 (1 239/1 261) · Avance 8.5 % (6.2 %/10.7 %) · Faltan 2 288 (1 162/1 126) · Sobremuestra 3 750 (1 859/1 891) · Avance 5.7 % (4.1 %/7.1 %) · Faltan 3 538 (1 782/1 756); mujeres + hombres = total en las cinco filas de conteo. «Encuestas de la meta» (3 158) sale del bloque y sólo vuelve sin cuotas del diseño. Render xlsx→PDF→PNG revisado. Tests: 35 nuevos en `test-aulas-libro-avance-metas.R`; los dos pins de `test-monitoreo-aulas-formato-avance.R` que citaban «Encuestas de la meta» ahora citan «Efectivas conseguidas» |
| V4 | «Avance diario» por día y por facultad: una fila por día, una columna por facultad (mismo orden que la tabla de arriba), «Sin curso-horario» sólo si hay, «Total del día», «Efectivas acumuladas», «Faltan para la muestra» y «Faltan para la sobremuestra» (por celdas, ADR 0079); fila «Total» al cierre. Sin diseño: «Falta para la meta» del plan como hoy | `carga_aulas_libro_avance_diario.R` (nuevo, usa `.maac_atribucion`) · `.cali_cierre_diario` generalizada · xlsx · Sheets | ☐ |
| V5 | Cabeceras agrupadas (Muestra / Sobremuestra / Conseguidas / Cursos-horario) fusionadas sobre sus columnas, en xlsx y Sheets | xlsx `mergeCells` · `.maaf_requests` (fila de grupo detectada por contenido) | ☐ después del núcleo |
| V6 | Notas de la hoja sin «referencial» ni «no es una segunda meta»; el ratio del reparto se declara en una frase | `.calaf_nota_metas()` en `carga_aulas_libro_avance_total.R`, UNA para xlsx y Sheets | ☑ `ed17d4ee` — «Muestra (2 500) y sobremuestra (3 750) son las dos metas del estudio, cada una por facultad y por sexo. Faltantes se mide contra la muestra; la última columna, contra la sobremuestra. La sobremuestra de cada facultad y de cada sexo reparte la del diseño con su ratio (x1.5).»; test prohíbe «referencial», «margen», «segunda meta» y «techo» |
| V7 | Render real (xlsx → PDF → PNG con LibreOffice) y publicación al Sheets de prueba `.pulso` del loop, nunca al del operativo | scratchpad de la sesión `87ed0566`, `render_v1/avance_v1.R` (reproduce el xlsx desde `disk_1559/state.rds` del scratchpad `83ff848b`) · backend 8837 | ◐ render hecho y enviado a Gonzalo (`avance_v1-1.png`); la pestaña del Sheets sale con la próxima publicación del libro desde la app, que exige build y relanzar el backend; nada publicado al operativo |
| A1 | La banda de Avance abre con «Efectivas sobre la cuota»: valor «212 de 2 500», pista con el 8,5 % de la muestra y el 5,7 % de la sobremuestra (3 750); sustituye a «Efectivas» a secas | `kpisDeAulas.ts` (`efectivasSobreLaCuotaKpi`) · test `kpisDeAulas.test.ts` | ☐ |
| A2 | Panel «Cuota asignada y encuestas logradas» pasa de tabla a **barras por facultad**: una fila por facultad, un carril por sexo contra SU cuota con la sobremuestra como tramo extra, cifras al lado, chip sólo «Cuota cumplida» o «Le falta poco», fila Total al final; encabezado con las dos metas por sexo | `AulasBarrasPorFacultad.tsx` (nuevo) + `barrasPorFacultad.ts` (view-model) + css; `AulasAvanceParaCliente.tsx` lo monta | ☐ |
| A3 | Avance diario por facultad en la app: bloque `avance_diario_facultad` en el tablero (la MISMA función del libro) y panel en Avance › Cuotas | backend `monitoreo_aulas_universitarias.R` (reports) · `api/monitoreo.ts` tipo · `AulasAvanceDiarioPorFacultad.tsx` (nuevo) | ☐ |
| A4 | Con A2 en pantalla, la pirámide de cuotas dice lo mismo en otra forma: preguntar a Gonzalo si se retira o se funde | `AulasPiramideCuota.tsx` | ☐ pregunta |

**Cierre de la sesión `87ed0566` (2026-09-08 ~10:15, por pedido de Gonzalo):** V1, V2 y V6
en `main`; el resto pasa a otra sesión con el traspaso
`docs/qa/traspaso-avance-dos-metas-2026-09-08.md`.

**Cierre de la sesión `5b6d6a68` (2026-09-08 ~10:45, por pedido de Gonzalo: «cierra
v3 y republica, no podemos hacer todo ahora»):** V3 en `main`. V4, V5 y A1–A4
siguen abiertos con el mismo traspaso. Dos cosas que la sesión aprendió y no
están en el traspaso:

- **La suite del área NO se puede correr en un solo proceso de R.** Los 104
  archivos `test-(carga-aulas-libro|aulas-libro|monitoreo-aulas)*` en un
  `Rscript` daban 115 rojos; los mismos archivos, uno por proceso, daban 15.
  Los 100 restantes eran contaminación de estado entre archivos (color-eslabon
  8→0, generar 34→1, roundtrip 15→2, conversar 15→0, publicar-libro 10→0,
  sheets-formato 6→0). Localizar antes de creerle al contador.
- **Este árbol lo comparte otra sesión.** Los 15 rojos restantes viven en
  `api/NAMESPACE`, `carga_aulas_libro_generar.R`, `carga_base_control.R` y
  `monitoreo_aulas_conteos_control.R`, modificados en el working tree por
  trabajo ajeno; en `HEAD` esos cinco archivos de test están en verde. Commitear
  por nombre, nunca `git add -A`, y no tocar esos cuatro archivos.

## Preguntas que quedan para Gonzalo (se hacen viendo la pantalla, no antes)

- Q5: ¿la pirámide se retira una vez que las barras por facultad llevan la
  proyección y el foco? (A4)
- Q6: en el «Avance diario» del Sheets, ¿los días como filas y las facultades
  como columnas (lo implementado), o al revés?
