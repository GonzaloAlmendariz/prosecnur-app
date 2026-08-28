# GOAL — Cálculo de muestra, mirado desde el segundo sorteo de HSVG 2026

Tipo: GOAL QA fechado
Estado: En curso
Fecha: 2026-08-28
Autoridad: Evidencia de las mediciones que documenta; no reemplaza contratos ejecutables ni ADR aceptados

Encargo de Gonzalo, textual: **«ya no estamos en el proyecto ULTI uno, sino en
el proyecto ULTI dos, que es el segundo sorteo… la idea es ver allí estas nuevas
pestañas que creaste en cálculo de muestra si se están viendo bien, y todas
estas nuevas funcionalidades que finalmente desarrollamos para generar este
sorteo, si ya están adecuadamente en la aplicación, si se ven bien.»**

**La vara**: una pestaña está cerrada cuando, abierta sobre ULT2, se ve bien en
la matriz de viewports **y la funcionalidad que se usó para generar el segundo
sorteo está en la app y se ve**. Una capacidad que ninguna pantalla consume no
cuenta como cerrada.

## Tablero

| # | Etapa | Estado |
|---|---|---|
| E1 | Inventario: qué usó ULT2 y qué de eso tiene pantalla | ☑ |
| E2 | Matriz visual de las pestañas nuevas | ☑ |
| E3 | Las pestañas antiguas de Cálculo | ☑ |
| E4 | Lo que el inventario marcó sin superficie | ☑ |
| E5 | Cierre estético del módulo entero | ☑ |

Pendiente único, **no autorizado**: cargar en bloque las 120 aulas de la DAA.
El mecanismo existe (`manualExcludedClassrooms`, motor y frontend) pero se llena
de a una; falta pegar o importar una lista.

## La cadena del marco del segundo sorteo

Reconstruida y verificada contra
`HSVG2026_descuento_marco_muestral_27_08_26.xlsx`:

| paso | CH | ¿en la app? |
|---|---|---|
| criterios de la app | 1.632 | — |
| − niveles 11–12 en C&I y Derecho | −59 | **sí** · `courseLevelRanges`, `min 2 max 10` |
| = marco inicial del Excel | 1.573 | |
| − selección de la DAA | −120 | mecanismo sí, carga masiva no |
| − sin información del aula | −61 | **sí, desde hoy** |
| = marco final del sorteo | **1.392** | |

El filtro de niveles es **indicación interna no publicable** (Gonzalo). Se
comprobó que `courseLevelRanges` / `rangos_nivel_curso` / `nivel_por_unidad`
aparecen sólo en criterios y motor: ningún motor de reporte, ficha, sustento,
PDF, PPT, Word ni XLSX los toca, y `salidas/` tampoco.

## El criterio «Aula asignada»

Commits `69b71d46` → `fa44cf0d` → `6057997a`.

- Lee **`venue`**, el aula que `calc_muestra_aulas_anotar_sesiones()` extrae de
  la columna `SESIONES` con la gramática `DIA HH:MM-HH:MM <letra de tipo> <aula>`.
  **No** lee `classroom_label` crudo: esa columna trae la cadena entera y su
  alias `aula` captura columnas ajenas — la trampa que ya costó que 1.512 fichas
  se titularan «A501».
- Es **presencia, no identidad**: dos categorías, «Con aula asignada» y «Sin aula
  asignada». La primera versión enumeraba el nombre del salón y daba una tarjeta
  con 1.041 fichas.
- Se enumera sólo si al menos un aula viene poblada; si no, sería verde por
  ausencia.
- Sobre ULT2: **4.150 con aula, 1.119 sin ella** de 5.269; entre los 1.632
  elegibles, **65 sin aula**.
- Cruce contra el Excel: mis 65 **contienen las 61**, ninguna se escapa, y
  ninguna está en la lista de la DAA. Las 4 de más son `1ind57_1031..1034`,
  «Gestión de la Innovación», con `course_level_num = 0`, que el rango `[2,10]`
  ya excluía. **65 − 4 = 61, exacto.**

**Siete listas paralelas** hubo que tocar; faltar en una deja el criterio
guardado y sin filtrar, en silencio: el registro, el bucket vacío, los
candidatos de columna del catálogo, el esqueleto de señales, el valor por llave,
el relleno de la columna sintética, y `vals` + `orden` + la enumeración.

## Lo demás que se reparó

| commit | qué |
|---|---|
| `88ed2b26` | el escenario por defecto se leía como decisión tomada |
| `f06716e6` | el validador no conocía el origen que el motor ya declaraba |
| `fc969584` | las fijaciones aterrizaban en el componente apagado |
| `93875a57` | el titular certificado compensaba subidas con bajadas (165→173) |
| `9711b130` | el botón del escenario quedaba muerto |
| `0652ef7d` | «Llevar las N a su mínimo» |
| `473254c2` | un estrato con dos decisiones perdía la primera |
| `3293f83e` | la tira dice de qué está hecho el número: **165 + 8 + 1** |
| `4c42e13e` | el desglose sobrevive a la franja corta |
| `59b21150` | el desglose a 9px |
| `f81aa23f` | recalcular mostraba el código interno |
| `2f0c825f` | la certeza descartada seguía en pantalla como validada |
| `11fb33ea` | el limpiador de avisos se comía errores recién nacidos |
| `e00b2cc4`, `e955d732`, `3a3c283a` | medida de lectura en todo el módulo |
| `62cc84b4` | una limpieza duplicada apagaba su propia regresión |

## Barrido estético: qué se tocó y qué no

Las 21 pestañas medidas en vivo a 1440×1000. Prosa llevada a 760px en seis
reglas. **No se tocan** filas de tabla, leyendas, pies y rótulos de una línea, ni
el párrafo de 299 caracteres dentro de `.cmv2-aviso-copy` en Selección › Método
—eso exige una regla sobre todos los avisos del módulo, que es otra decisión—.

El detector **estático** (CSS con `line-height ≥ 1.4` y sin `max-width`)
sobre-reporta sin remedio: 145 candidatos, porque casi siempre el ancho lo limita
el contenedor. Lo que funciona es medir en vivo el ancho renderizado de cada
párrafo de más de 130 caracteres y quedarse con los que pasan de 800px.

## Lecciones

- **Coincidir con un componente no prueba que el número sea de ese criterio**:
  lo decide contra qué cuotas se certifica.
- **Una redundancia apaga su propia regresión**: dos limpiezas del mismo campo,
  el test mockeaba una y la otra sostenía el comportamiento. Barrido todo
  `api/R`: no se repite.
- **Para juzgar si una pantalla avisa, leer el texto completo de `main`**, no
  buscar por rol ni por las palabras que uno espera. Me equivoqué tres veces.
- Los estratos viven en `componente.marco.estratos`, no en `componente.estratos`;
  y `aulas_base_fijas` vale 0, no `null`.

## Trampas del entorno

- **iCloud desaloja archivos en pleno trabajo.** 303 de 427 `api/R/*.R` a 0K se
  disfrazaron de «FAIL 16» con «could not find function». Se cuenta con `du -k`
  y se repara con `find … | xargs -n 40 -P 6 brctl download`, que es
  **asíncrono**: comprobar al instante da un falso negativo. Sobre directorios no
  hace nada. También le pasó a `node_modules` y al packfile de git.
- `/api/system/bootstrap` y `?pulso=` son de **un solo uso**.
- El warm start de estos proyectos tarda 1–3 min; el launcher reinstala el
  paquete (~5 min) si el instalado quedó viejo, y eso no se interrumpe.
- `scripts/ui-quick-check.mjs` aborta con `--ir` («no hay puente de navegación»)
  y elige puertos libres: una vez tomó el **8788**, que es de Gonzalo.
