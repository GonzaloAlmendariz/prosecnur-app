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
| P1 letra por rol | ☐ | | |
| P5 vacíos y cargas por el kit | ☑ | f727e832c y e9c25e1e3 (barridos, ver abajo) + el cierre | ~360 recetas propias → 0. Todo vacío va por `EstadoVacio` y toda carga por `LoadingBlock` o `CargaDeBloque` (kit, 651a38e23). `EmptyPanel` ×2 y `VacioConSalida` pintan `EstadoVacio` por dentro, así que arreglan a todos sus llamadores. Las tarjetas vacías de territorial y la Semana vacía de la Agenda de aulas miden su contenido en vez de estirarse (`align-self: start`). −183 líneas de reglas huérfanas en `monitoreo.css` y `profilePage.css`, y −237/−229 en `territorialProfile.css` y `aulasMonitoreo.css`. Declaradas: la pantalla de preparación del perfil (`mon-territorial-loading*`, `mon-acr-loading-card*`) y las fichas de capa del mapa. Guard: `features/monitoreo/vaciosYCargasDelKit.contract.test.ts` con meta 0. Gate: tsc 0, `gate-front monitoreo` 630 suites y 6,615 tests, audit OK |
| P2 cabecera de bloque | ☐ | | La cabecera de PESTAÑA ya es una (L14, `a517d2ece`: `TabHeading variante="seccion"` en los cuatro modos; el rótulo dentro de la primera tarjeta es la forma declarada del §2a-bis, `93d3e1615`). La deuda está en la cabecera de BLOQUE: ~120 antetítulos en versalitas que hacen de título (`mon-ctl-antetitulo` 53, `acr-av-antetitulo` 51, `mon-cola-antetitulo` 10, `mon-tel-cuotas-antetitulo` 6) junto a títulos de bloque en letra de título en la misma vista (Telefónico › Control › Barrido: «STATUS DEL CLIENTE» frente a «Listado por sede»; Avance › Cuotas: «FALTAN PARA LA META» frente a «Cuotas») |
| P3 / P4 / P8 | ☐ | | Desbloqueados (coordinación, 2 nov): P3 → `lib/enumerar.ts` (`enumerar(partes, "y"\|"o")`, a167c8a51); la copia local `profiles/territorial/rotulos.ts` debe converger ahí. P4 → `lib/formatoNumero.ts` (`formatoConteo`, `formatoDecimal`, `formatoConteoDe`), sin helpers nuevos. Van al final |
| P6 estado frente a acción | bloqueado | | espera `EstadoChip` y el slot de `ModuleCommandBar` de Material |

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
