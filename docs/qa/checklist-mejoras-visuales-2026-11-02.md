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
| D1 | **La medición no alcanza Material ni Monitoreo**: ningún proyecto de referencia tiene una campaña de Material ni un modo de Monitoreo elegido. Las 3 secciones de Material salen idénticas (1 md5 de 3) y las 4 de Monitoreo también (1 de 4). Gate verde por ausencia: `routeDeviations=0` aunque `?seccion=` no se haya aplicado. | `material-campo-seccion-*`, `monitoreo-seccion-*` (dis-hsvg) | Revamp (runner) + hojas-material / monitoreo-calculo (semilla de referencia) | M | ☐ |
| D2 | **Vocabulario de Hojas de ruta**: `CLAUDE.md` lista la sección «entrega», pero el id es `seleccion`. Su rótulo es «Selección» y en modo cuotas «Entrega»: un mismo id con dos nombres. `?seccion=entrega` aterriza en silencio en Territorio. | `hojas-ruta-seccion-entrega` = `territorio` (mismo md5) | Revamp (doc) · hojas-material (rótulo) | S | ◐ doc corregido; rótulo pendiente |
| D3 | **Cálculo: la cinta de cifras repite «no consta de qué bases salió · reconstruye» cuatro veces**. A 1280, el bloque «Sin cifra todavía» salta a la izquierda y se parte en 4 renglones; a 1440 va abajo con ícono. Son dos geometrías para la misma cinta. | `calc-muestra-1280x720` vs `-1440x1000` | monitoreo-calculo | M | ☑ 20a32ef3d: la procedencia va una vez en la cabecera de la franja y «Sin cifra todavía» sale de la rejilla; captura dis_hsvg 1280 y 1440 ok=true |
| D4 | **Cálculo: dos «Universo» a la vista con cifras distintas**. La cinta dice 29,090 estudiantes y el Mapa del recorrido dice 136,284 «filas leídas». El segundo es un conteo de filas, no un universo. | `calc-muestra-1440x1000` | monitoreo-calculo | S | ☑ c84e78c53: el recorrido rotula «Filas leídas · del archivo, antes de depurar» |
| D5 | **Cálculo: dos navegaciones para la misma dimensión**. Las secciones de la barra superior (Datos · Marco · Cálculo · Selección · Entrega) y el recorrido (Definir → … → Seleccionar) avanzan por las mismas etapas. El rail de íconos a la izquierda es de pestañas y se queda. Tocarlo exige decidir cuál manda. | `calc-muestra-1440x1000` | monitoreo-calculo | L | 🔒 para la mañana |
| D6 | **Cálculo a 1280×720: el chrome se come la pantalla**. Barra, cinta, cabecera de tarjeta y recorrido llegan hasta y≈500; el formulario empieza en la mitad inferior. | `calc-muestra-1280x720` | monitoreo-calculo | M | ◐ con D3 la franja baja a dos renglones a 1280×720; el resto del alto es cabecera de tarjeta y recorrido, que decide D5 → 🔒 con D5 para la mañana |
| D7 | **Monitoreo sin modo: doble titular y bordes que no alinean**. «¿Qué tipo de estudio vas a monitorear?» va a 14 px y «Declara el propósito de Monitoreo» a 167 px. El texto promete «opciones de acreditación», pero sólo se ofrece cursos-horario. Además, ADR 0124 dice que el tipo de la Ficha fija el modo, y aquí aparece «Sugerido» pero igual lo pregunta. | `monitoreo-seccion-avance-1440x1000` | monitoreo-calculo | S | ☑ ccb50620c: un titular, alineado al título, sin la promesa de acreditación · pendiente de decisión: que el tipo de la Ficha fije el modo sin preguntar (ADR 0124) |
| D8 | **Material sin campañas: dos «Nueva campaña» primarios** (cabecera y vacío) en la misma pantalla. Debe quedar uno. | `material-campo-seccion-catalogo-1280x720` | hojas-material | S | ☐ |
| D9 | **Hojas › Muestra: las barras del reparto van en azul marino**. No llevan el tono del módulo ni el color del distrito, que sí lleva el punto. | `hojas-ruta-seccion-muestra-1280x720` | hojas-material | S | ☐ |
| D10 | **Hojas: «Campo real», «Re-sortear» y «12 por revisar» se leen como botones con tres tintes**. No se distingue cuál es estado y cuál es acción. | `hojas-ruta-seccion-territorio-1280x720` | hojas-material | S | ☐ |
| D11 | **Hojas › Territorio: los rótulos del mapa quedan debajo de los globos** (Callao, Bellavista). Son archivos del mapa: sólo se anota. | `hojas-ruta-seccion-territorio-1280x720` | hojas-material | M | ☐ (sólo nota) |
| D12 | **Monitoreo › faltantes a 1024: Saldo y Cubre quedan fuera** y se alcanzan con scroll horizontal (C4 se cumple, pero lo que se lee primero esconde la cifra). Ya se pasó a la sesión. | barrido previo | monitoreo-calculo | S | ☑ 62361f04e (y 192274eb8 para la Bandeja) |
| D13 | **`/calc-muestra` a 1280: 4 errores de página** «useSession must be used within SessionProvider» y un 500 sobre `modules.ts?t=`. Parece HMR por una edición concurrente; hay que reverificarlo en frío. | `dis-hsvg/report.json` | Revamp | S | ☑ reverificado en frío (dis_hsvg, bundle de producción, 1280 y 1440): pageErrors=0, sin «useSession must be used within SessionProvider»; era HMR |

## Aprendido

- Los proyectos de referencia no ejercitan Material ni los modos de Monitoreo: una matriz visual de esos dos módulos
  sobre ellos mide una sola pantalla repetida. Antes de juzgar diseño ahí hace falta sembrar una campaña y un modo
  (o usar el `.pulso` de trabajo de la sesión dueña).
- La corrida de `acnur_acg` murió en Monitoreo con «Execution context was destroyed»: un recargo de HMR por la
  edición de otra sesión. Capturar con árbol compartido exige Vite propio y quieto.
