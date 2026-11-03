# Formato en Monitoreo (2 nov 2026, noche)

Gonzalo: «no es solo un pequeño ajuste, es un tema sistemático que debe solucionarse», y para esta noche «Formato
en Monitoreo». El método es el de Material de campo (`revamp-material-de-campo-construccion-2026-11-02.md`, sección
«Causas compartidas»): por cada patrón, su fuente, su conteo y un guard que impide que vuelva. Alcance de escritura:
`frontend/src/features/monitoreo/` y este doc. El kit (`components/`) y `lib/` se piden a coordinación.

## Medición (2 nov, 22:10)

Script de medición en el scratchpad de la sesión (`medir.mjs`): recorre `features/monitoreo`, separa por perfil
(`profiles/<perfil>/`; el resto es «núcleo»: shell, core, salidas, sync, public…) y no cuenta comentarios.

| # | Patrón | Núcleo | Acreditación | Aulas (cursos-horario) | Telefónico | Territorial | Total | Dónde nace |
|---|---|---|---|---|---|---|---|---|
| P1 | `font-size: Npx` en CSS | 2,024 | 278 | 384 | 367 | 877 | **3,930** | `monitoreo.css` 1,102 y `profiles/profilePage.css` 718 (hojas madre congeladas a crecimiento), `territorialProfile.css` 564, `telefonicoProfile.css` 186. Ninguna hoja usa los roles de `app/tipografia.css` salvo aulas (114) y territorial (32). Aulas tiene además su propia escala (`--aulas-txt/sec/min`, 415 usos) |
| P1 | tamaños más frecuentes | | | | | | | 10 px ×1,155 · 12 ×598 · 11 ×499 · 10.5 ×356 · 13 ×303 · 11.5 ×236 · 12.5 ×161 · 14 ×135 |
| P2 | `<Panel>` del kit / `h2–h4` sueltos | 0 / 3 | 0 / 106 | 5 / 130 | 0 / 44 | 2 / 92 | 7 / 375 | Cada vista arma su cabecera de bloque; las páginas madre (`AcreditacionMonitoreoPage` 32, `TelefonicoMonitoreoPage` 38) concentran los de sus perfiles |
| P3 | « · » en código (sin comentarios) | 42 | 157 | 363 | 159 | 242 | 963 | Frases cosidas en páginas madre (`TelefonicoMonitoreoPage` 137, `AcreditacionMonitoreoPage` 118) y en aulas repartido (`AulasSerieDeRendimiento` 17, `AulasAgendacion` 14…). Los 1,672 del encargo incluían 260 en comentarios y los `.join(" · ")` |
| P4 | `{x.length}` crudo / `toFixed(` | 15 / 5 | 15 / 12 | 17 / 43 | 15 / 6 | 11 / 57 | 73 / 123 | Ya hay guard de porcentaje (`formateadorUnico.contract.test.ts`); los `toFixed` restantes son sobre todo geometría de SVG (`AulasMapaDeLaDeuda` 27, `TerritorialValidationGeoWorkbench` 18), no cifras visibles |
| P5 | Clases propias de vacío o carga (usos en JSX) | 4 | 57 | 34 | 60 | 93 | ~250 | ~70 recetas distintas. Las más repetidas: `mon-sm-empty` 25, `mon-profile-empty` (vía `EmptyPanel` ×2 copias y `VacioConSalida`), `mon-territorial-audit-empty` 7, `mon-territorial-source-empty` 6, `mon-territorial-route-map-loading` 6. `EstadoVacio` del kit: 22 usos (acreditación 16, telefónico 6); `LoadingBlock`: 3 |
| P5 | Reglas CSS de vacío o carga | 77 | 17 | 32 | 22 | 72 | 220 | |
| P6 | Clases propias de chip o estado | 13 | 53 | 43 | 26 | 21 | 156 | Espera a `EstadoChip` y al slot de estado de `ModuleCommandBar` (Material) |
| P8 | `<code>` / reglas `monospace` | 0 / 1 | 0 / 6 | 1 / 6 | 7 / 0 | 6 / 0 | 14 / 13 | `telefonico/insumos/Llave.tsx` 6, `territorial/insumos/MapeoTab.tsx` 3 |

### Decisiones de alcance (reversibles)

- **`public/` queda fuera de P1**, como Dashboard: `monitoreoPublic.css` es el informe público que ve el cliente y su
  letra es la del artefacto publicado (38 literales).
- **Excepciones de P1 que se declaran y no se convierten**: los `font-size` menores de 9 px son unidades de un
  `viewBox` SVG escalado (rótulos de calles del mapa, el donut de validación), no píxeles de pantalla; los de 24 px o
  más son cifras héroe (40 px del resumen de acreditación y de aulas, 44 px del faltante telefónico) que el rol `kpi`
  (21 px) achicaría. Son 33 en 20 hojas y quedan como línea base del ratchet.
- **Escala propia de aulas** (`--aulas-txt: 12px`, `--aulas-sec: 11px`, `--aulas-min: 10px`): no la cuenta el ratchet
  porque no son literales en reglas. Se anota para la pasada de aulas; reasignarla a roles cambia 415 usos de un golpe.

### Orden de trabajo (decisión de la noche)

La línea base visual tarda ~50 min (40 capturas con warm start) y el checkout no puede cambiar mientras corre. Por eso
P5 se hace primero en dos worktrees aislados (telefónico, acreditación y núcleo / territorial y aulas) y se fusiona
después; P1 es un script determinista (`p1.mjs`, regla de Material) que se corre sobre el árbol ya fusionado, así que
no choca con las reglas CSS que P5 borra.

## Estado

| Paso | Estado | Commit | Nota |
|---|---|---|---|
| Medición | ☑ | (este doc) | |
| Línea base visual «antes» (5 copias D1 × 4 secciones × 1440 y 1280) | ☑ | — | `cap/antes-*` en el scratchpad: 40 capturas, 40 md5 distintos. Antes de tocar nada: UMP `textosFuera=2 columnasOcultas=1`; cuotas `desplazamientoH=1` (la columna «Por día» de Distritos, cortada a 1280); telefónico `textosFuera=1`; aulas y acreditación limpias. Acreditación sale de `acrconta` (referencia), copiada con permiso de escritura |
| P1 letra por rol | ☑ | 179b89015, 848fca579 | 3,930 → 69, línea por línea con la regla de Material (`p1.mjs`): ≥18 px → kpi; 15–17 → title; 12–14.5 → subtitle si seminegrita, body si no; 10.6–11.5 → eyebrow si versalitas, caption si no; ≤10.5 → micro. `features/monitoreo` entra en `letraPorRol` y deja de estar fuera de `pisoTipografico`. Quedan declarados 31 (SVG con `viewBox` y cifras héroe de 24–44 px) y `public/` (38). Gate 630 suites |
| P5 vacíos y cargas por el kit | ☑ | f727e832c y e9c25e1e3 (barridos, ver abajo) + el cierre | ~360 recetas propias → 0. Todo vacío va por `EstadoVacio` y toda carga por `LoadingBlock` o `CargaDeBloque` (kit, 651a38e23). `EmptyPanel` ×2 y `VacioConSalida` pintan `EstadoVacio` por dentro, así que arreglan a todos sus llamadores. Las tarjetas vacías de territorial y la Semana vacía de la Agenda de aulas miden su contenido en vez de estirarse (`align-self: start`). −183 líneas de reglas huérfanas en `monitoreo.css` y `profilePage.css`, y −237/−229 en `territorialProfile.css` y `aulasMonitoreo.css`. Declaradas: la pantalla de preparación del perfil (`mon-territorial-loading*`, `mon-acr-loading-card*`) y las fichas de capa del mapa. Guard: `features/monitoreo/vaciosYCargasDelKit.contract.test.ts` con meta 0. Gate: tsc 0, `gate-front monitoreo` 630 suites y 6,615 tests, audit OK |
| P2 cabecera de bloque | ☑ telefónico | f8bf56a1f | La cabecera de PESTAÑA ya era una (L14, `a517d2ece`; el rótulo en la tarjeta es el §2a-bis, `93d3e1615`). La deuda estaba en la cabecera de BLOQUE de telefónico: 22 bloques con un antetítulo en versalitas como título («STATUS DEL CLIENTE» junto a «Listado por sede») pasan a `mon-ctl-panel-cabecera` (`<b>título</b><span>meta</span>`). Guard `profiles/telefonico/cabeceraDeBloque.contract.test.ts` (meta 0; detecta los 22 sobre 179b89015). Acreditación y aulas usan el antetítulo como rótulo de sub-bloque dentro de una tarjeta con título: se quedan. Candidatos no tocados: Equipo «Sin barrer», CuotasFaltante «Listado por…», Ritmo «Fecha de la hoja», FaltanteDiario, Cuotas «Avance de cada meta» |
| P3 / P4 / P8 | ☑ | (fusión de las 00:15) | « · » en código: ~963 → 31 líneas (quedan los que LEEN el punto medio de un dato del backend o del Sheets, y el que marca una celda vacía). Listas por `lib/enumerar`, jerarquía de dirección con « › » en los tres rieles («Control › Casos»), «P884, Norma Flores Bustamante» por `rotuloDeAplicador`; la copia local de `enumerar` en `territorial/rotulos.ts` se borra. Cifras por `lib/formatoNumero` (~180 `toLocaleString`/`toFixed` visibles); sólo cambia el cero de relleno («2.0 s» → «2 s»). `<code>` de metadatos 14 → 0 (`<data>` o `<span>` con la letra del sistema). Guard `features/monitoreo/formatoDeTexto.contract.test.ts`: ratchet por archivo de « · » (31), `toLocaleString` (39) y `{x.length}` crudo (63), y `<code>` con meta 0. Pendiente: `content: "·"` en tres hojas de aulas y los decimales fijos («3.0») que `formatoNumero` no ofrece |
| P6 estado frente a acción | ☑ | 5bb924281, f8bf56a1f | Regla: chip con modificador de tono = estado = `EstadoChip` (00281fc94, span desde ccb72d437); chip sin tono = etiqueta de dato y se queda. Territorial 32, cursos-horario 20, acreditación ~33, telefónico y núcleo ~20, más las píldoras de caso de las páginas congeladas (`core/tonosDeCaso.ts`). Se quedan: etiquetas, filtros, el color de identidad del canal, el Sistema Pabellón (`aulas-chip`), `aulas-estado-chip` (colores de resultado de los gráficos, B33) y los estados anidados en un botón o disparador de popover (esperan `forwardRef` en el kit). El cruce logrado va en `info` en todas partes (en Consultas una regla local lo pintaba verde). La barra del modo NO suma `estado` al slot de `ModuleCommandBar`: su píldora ya vive aparte de «Actualizar» en `BarraDelModo` |

## Pendientes de UI conocidos

| Pendiente | Estado | Nota |
|---|---|---|
| Vacíos de aulas que estiran su marco (Agenda, Cursos-horario) | ◐ | cdf9c1b29 arregló el vacío «sin tablero», pero la captura D1 de las 12:38 (después del fix) aún muestra el panel «Semana» vacío estirado hasta el pie dentro del tablero listo. Va con P5 (aulas) |
| «Sin act.» cortado al pie del riel de aulas | ☑ | 8fafef653: «Sin / corte» en dos líneas. Se ve bien en la captura D1 de aulas |
| A 1024, Bandeja y Faltante territoriales esconden columnas | ◐ | 192274eb8 (Bandeja) y 62361f04e (Faltante) dicen resuelto; falta reverificar a 1024 |
| A 1280, la columna «Por día» de Avance › Resumen territorial deja 43 px tras un desplazamiento | ☐ | |
| `.cmg-metodos` y `.cmv2-aulas-modalidad` fuera del ratchet `indicadorDelKit` | fuera de alcance | Viven en `features/calcMuestra/`: son de la sesión de Cálculo de muestra (avisado a coordinación) |

## Incidente: P5 entró en commits ajenos (2 nov, 22:35–22:40)

`git apply --3way` deja en el índice todo lo que aplica, y el índice es compartido entre sesiones. Al fusionar
los dos worktrees de P5 en `main` quedaron ~130 archivos staged, y los dos `git commit -m` siguientes de la
sesión de Cálculo se los llevaron: `f727e832c` (telefónico, acreditación y núcleo) y `e9c25e1e3` (territorial y
aulas). El segundo dejó HEAD sin compilar: tres imports apuntaban a `recopiladores/CargaDeBloque`, que el kit ya
había mudado a `components/` (651a38e23). No se revirtió nada; el commit de cierre de P5 corrige los imports.
**Regla desde aquí: nada queda staged. Se fusiona con `git apply` sin `--3way` (o se resuelve y se commitea
en el mismo paso) y se commitea con `git commit -m "…" -- <rutas>`.**

## Aprendido

- **vitest no ve una clave duplicada en un objeto literal; tsc sí (TS1117).** P1 se cerró con `gate-front` verde y
  sin `tsc` porque «sólo tocaba CSS», pero también tocaba el `.ts` del ratchet: la excepción de `public/` entró dos
  veces y el árbol entero dejó de compilar hasta 848fca579 (lo avisó la sesión de Cálculo). Si el diff toca un
  `.ts`, aunque sea un test de contrato, `tsc` va en el gate.
- **`git apply --3way` deja staged lo que aplica** (ver «Incidente»).
