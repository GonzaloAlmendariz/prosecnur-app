# Checklist — Revisión de diseño de Material, Cálculo, Hojas de ruta y Monitoreo

Pedido (coordinación, 2026-11-02): revisar «con ojo de diseño» los cuatro módulos con los proyectos de
referencia a 1280 y 1440, un ítem por hallazgo con captura, dueño y esfuerzo. Lo transversal (kit, tokens,
chrome, vocabulario) lo arregla la sesión Revamp; lo de cada módulo va a su sesión dueña. Criterio para «se
entiende qué hace cada módulo»: [ADR 0125](../adrs/0125-material-arma-monitoreo-sigue.md) — Material arma y
configura, Monitoreo lee y sigue, cada traspaso es un endpoint o una foto con nombre.

Capturas: `ui-quick-check` sobre copias de `hsvg2026` (Material, Cálculo, Monitoreo) y `acnur_acg` (Hojas de
ruta), en el scratchpad de la sesión Revamp (`qa/dis-hsvg/`, `qa/dis-acnur/`). No se versionan.

Dueños: **Revamp** (transversal), **monitoreo-calculo** (Monitoreo y Cálculo de muestra), **hojas-material**
(Hojas de ruta y Material de campo). Esfuerzo: S (< 1 h), M (media tanda), L (tanda o más).

| # | Hallazgo | Captura | Dueño | Esf. | Estado |
|---|---|---|---|---|---|
| D1 | **La medición no alcanza Material ni Monitoreo**: ningún proyecto de referencia tiene una campaña de Material ni un modo de Monitoreo elegido. Las 3 secciones de Material salen idénticas (1 md5 de 3) y las 4 de Monitoreo también (1 de 4). Gate verde por ausencia: `routeDeviations=0` aunque `?seccion=` no se haya aplicado. | `material-campo-seccion-*`, `monitoreo-seccion-*` (dis-hsvg) | Revamp (runner) + hojas-material / monitoreo-calculo (semilla de referencia) | M | ◐ copias de trabajo y matriz listas: 33 capturas, 33 md5 distintos (ver «Matriz D1»); aulas sólo ejercita vacíos (D17) |
| D2 | **Vocabulario de Hojas de ruta**: `CLAUDE.md` lista la sección «entrega», pero el id es `seleccion`. Su rótulo es «Selección» y en modo cuotas «Entrega»: un mismo id con dos nombres. `?seccion=entrega` aterriza en silencio en Territorio. | `hojas-ruta-seccion-entrega` = `territorio` (mismo md5) | Revamp (doc) · hojas-material (rótulo) | S | ☑ rótulo: `?seccion=entrega` se reescribe a `seleccion` (9628a2416); el doble rótulo por modo es deliberado, el id es uno solo |
| D3 | **Cálculo: la cinta de cifras repite «no consta de qué bases salió · reconstruye» cuatro veces**. A 1280, el bloque «Sin cifra todavía» salta a la izquierda y se parte en 4 renglones; a 1440 va abajo con ícono. Son dos geometrías para la misma cinta. | `calc-muestra-1280x720` vs `-1440x1000` | monitoreo-calculo | M | ☑ 20a32ef3d: la procedencia va una vez en la cabecera de la franja y «Sin cifra todavía» sale de la rejilla; captura dis_hsvg 1280 y 1440 ok=true |
| D4 | **Cálculo: dos «Universo» a la vista con cifras distintas**. La cinta dice 29,090 estudiantes y el Mapa del recorrido dice 136,284 «filas leídas». El segundo es un conteo de filas, no un universo. | `calc-muestra-1440x1000` | monitoreo-calculo | S | ☑ c84e78c53: el recorrido rotula «Filas leídas · del archivo, antes de depurar» |
| D5 | **Cálculo: dos navegaciones para la misma dimensión**. Las secciones de la barra superior (Datos · Marco · Cálculo · Selección · Entrega) y el recorrido (Definir → … → Seleccionar) avanzan por las mismas etapas. El rail de íconos a la izquierda es de pestañas y se queda. Tocarlo exige decidir cuál manda. | `calc-muestra-1440x1000` | monitoreo-calculo | L | ☑ decisión de coordinación: la barra manda; el recorrido queda como indicador (sin clics) y en pantallas bajas se adelgaza |
| D6 | **Cálculo a 1280×720: el chrome se come la pantalla**. Barra, cinta, cabecera de tarjeta y recorrido llegan hasta y≈500; el formulario empieza en la mitad inferior. | `calc-muestra-1280x720` | monitoreo-calculo | M | ☑ formulario de y≈543 a y≈464 a 1280×720 (recorrido delgado + «Ver otros tipos» oculto, el indicador «Tipo» abre lo mismo); captura ok |
| D7 | **Monitoreo sin modo: doble titular y bordes que no alinean**. «¿Qué tipo de estudio vas a monitorear?» va a 14 px y «Declara el propósito de Monitoreo» a 167 px. El texto promete «opciones de acreditación», pero sólo se ofrece cursos-horario. Además, ADR 0124 dice que el tipo de la Ficha fija el modo, y aquí aparece «Sugerido» pero igual lo pregunta. | `monitoreo-seccion-avance-1440x1000` | monitoreo-calculo | S | ☑ ccb50620c (titular y promesa) + D7b: con un tipo en la Ficha, entra al modo sin preguntar (efecto: «sin guardar» al fijarlo) |
| D8 | **Material sin campañas: dos «Nueva campaña» primarios** (cabecera y vacío) en la misma pantalla. Debe quedar uno. | `material-campo-seccion-catalogo-1280x720` | hojas-material | S | ☑ un primario: el del vacío; el de la cabecera queda secundario (9628a2416) |
| D9 | **Hojas › Muestra: las barras del reparto van en azul marino**. No llevan el tono del módulo ni el color del distrito, que sí lleva el punto. | `hojas-ruta-seccion-muestra-1280x720` | hojas-material | S | ☑ la barra toma el color de su distrito (9628a2416) |
| D10 | **Hojas: «Campo real», «Re-sortear» y «12 por revisar» se leen como botones con tres tintes**. No se distingue cuál es estado y cuál es acción. | `hojas-ruta-seccion-territorio-1280x720` | hojas-material | S | ☑ «Re-sortear» → «Sorteo con reparto anterior», un estado; la acción en su detalle (9628a2416) |
| D11 | **Hojas › Territorio: los rótulos del mapa quedan debajo de los globos** (Callao, Bellavista). Son archivos del mapa: sólo se anota. | `hojas-ruta-seccion-territorio-1280x720` | hojas-material | M | ☑ los nombres se pintan después de las fichas y no las pisan (b826248fd) |
| D12 | **Monitoreo › faltantes a 1024: Saldo y Cubre quedan fuera** y se alcanzan con scroll horizontal (C4 se cumple, pero lo que se lee primero esconde la cifra). Ya se pasó a la sesión. | barrido previo | monitoreo-calculo | S | ☑ 62361f04e (y 192274eb8 para la Bandeja) |
| D13 | **`/calc-muestra` a 1280: 4 errores de página** «useSession must be used within SessionProvider» y un 500 sobre `modules.ts?t=`. Parece HMR por una edición concurrente; hay que reverificarlo en frío. | `dis-hsvg/report.json` | Revamp | S | ☑ reverificado en frío (dis_hsvg, bundle de producción, 1280 y 1440): pageErrors=0, sin «useSession must be used within SessionProvider»; era HMR |
| D14 | **Monitoreo territorial con envío por cuotas: 500** «$ operator is invalid for atomic vectors» en `/api/monitoreo/state?include_reports=1` (los cuatro `report_scope`) y en `/api/monitoreo/territorial/muestra-enviada`. Avance muestra el error y, debajo, «Faltante por UMP · Sin cuota territorial configurada», cuando por cuotas no hay UMP (ADR 0125 §2). | `d1/cap-cuotas/monitoreo-seccion-*` | monitoreo-calculo | M | ☑ f811172fd (el 500: `$` casaba `sample_fingerprint`) + 87c5afb76 (Avance por zona y celda en lugar de «Faltante por UMP»; captura d1_cuotas 1440 y 1280 ok). Avance por cuotas completo sobre el diseño aprobado: a13f76356 (meta desde las zonas, distrito por el ubigeo del caso, sin cruce GPS sin manzanas, equipo, ritmo y duración por zona; revisión metodológica aplicada), 81fb51017 (nombre de cada código; nadie se nombra con la lista en DNI) y 70ef65a9a (Resumen, Faltante, Mapa por casos y UMP por zona; lo que falta en granate). Captura d1_cuotas 1440x1000 y 1280x720 ok=true en las cuatro vistas; verificador APROBADO. Queda observado: a 1280, la columna Por día de Resumen deja 43 px tras un desplazamiento alcanzable |
| D15 | **Material › Unidades (UMP): la columna «Estado» va vacía en las 300 filas.** O se llena o no se muestra (C5). | `d1/cap-ump/material-campo-modo-territorial-seccion-unidades` | hojas-material | S | ☐ |
| D16 | **Material › Paquetes (UMP): la tabla por distrito esconde columnas** (`columnasOcultas=1` en `pulso-table`). | `d1/cap-ump/…-seccion-paquetes` | hojas-material | S | ☐ |
| D17 | **Aulas sólo muestra vacíos**: hsvg2026 no trae selección de cursos-horario, así que Material › Unidades dice «Sin unidades en el plan» y Monitoreo › Avance «Sin plan importado». Para juzgar diseño de aulas hace falta una copia con selección hecha en Cálculo de muestra. | `d1/cap-aulas/*` | Revamp (semilla) | M | ☐ |
| D18 | **Material › Casos (telefónico): los segmentados «Uno · Dos · Tres · Cuatro» y «Observación · Observaciones» no muestran cuál está elegido**: la opción activa apenas se distingue por el borde. | `d1/cap-telefonico/material-campo-modo-telefonica-seccion-casos` | hojas-material | S | ☐ |

## Matriz D1 (2026-11-02)

Copias de trabajo en el scratchpad de Revamp (`d1/`), sin datos de cliente: salen de los proyectos de referencia y
se siembran por la API (`d1-tools/sembrar.mjs`): perfil del Planner, modo de Monitoreo, envío de Hojas cuando aplica
y campaña de Material. Matriz en `d1-tools/matriz.sh`, una corrida por perfil a 1440×1000.

| Copia | Sale de | Perfil · modo · campaña | Capturas | md5 distintos | Resultado |
|---|---|---|---|---|---|
| `d1_ump` | acnur_acg | territorial ump_aleatoria · territorial · territorial (re-sorteo + envío ump) | 9 | 9 | ok · D15, D16 |
| `d1_cuotas` | acnur_acg | territorial conveniencia · territorial · territorial (envío cuotas) | 8 | 8 | 6 errores de API · D14 |
| `d1_aulas` | hsvg2026 | aulas · aulas_universitarias · aulas | 9 | 9 | ok, sólo vacíos · D17 |
| `d1_telefonico` | acnur_pdm | telefonico · telefonico · telefonica | 7 | 7 | ok · D18 |

Ninguna captura se repite entre perfiles. Las copias no se versionan: hacerlo exige el gate de PII
(`make reference-project-verify`) y se propone antes a coordinación.


## Aprendido

- Los proyectos de referencia no ejercitan Material ni los modos de Monitoreo: una matriz visual de esos dos módulos
  sobre ellos mide una sola pantalla repetida. Antes de juzgar diseño ahí hace falta sembrar una campaña y un modo
  (o usar el `.pulso` de trabajo de la sesión dueña).
- La corrida de `acnur_acg` murió en Monitoreo con «Execution context was destroyed»: un recargo de HMR por la
  edición de otra sesión. Capturar con árbol compartido exige Vite propio y quieto.

- `acnur_acg` no se puede enviar a Material tal como viene: su sorteo es del reparto anterior (`E_HOJAS_RUTA_ENVIO_SORTEO_V1`) y hay que re-sortear antes (`/api/hojas-ruta/sample-preview`).
- Esperar `.js-plotly-plot` en vistas sin Plotly agota el tope de 420 s en cada vista: en Material y Hojas se corre sin ese flag.