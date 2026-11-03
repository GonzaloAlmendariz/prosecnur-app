# Checklist — Revamp del explorador de variables (Validación › Explorar)

Pedido de Gonzalo (2026-11-02): «El visor de variables y sus gráficos y sus
opciones de filtro y cruce se puede ver muchísimo mejor». Maqueta aprobada
(«Sí, impleméntala») tras sus cuatro comentarios: faltaban los gráficos por
tipo y por cruce; el cruce debe aceptar cualquier variable, como el módulo
anterior; la calidad no puede inventar reglas que aún no existen; el panel del
formulario era muy simple.

Maqueta: https://claude.ai/artifact/8UdLQMeheKjCC3oNXUorW4 (cinco tableros).

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| E1 | Lista de variables: texto de la pregunta primero, código en mono, tipo como etiqueta, barra de completitud (ámbar bajo 80 %), chips de tipo con su conteo | `components/VariablePicker.tsx` | ◐ visto en acnur_acg a 1440/1024; tipo con el sello del editor y chips en rejilla (45a26ab0d); clasificación de la lista corregida en el motor (89aa0950b), falta verla con el backend relanzado |
| E2 | Cabecera de la pregunta: sección, posición «14 de 94», tipo, n de opciones, condición de aparición | `tabs/explorar/CabeceraVariable.tsx` (sale de `ExplorarTab.tsx`) | ◐ visto en vivo |
| E3 | Una sola barra de lectura: Momento, Filtro, Cruzar por en un renglón | `tabs/explorar/BarraLectura.tsx` + `FiltroCascada`, `CrossBar` | ◐ visto en vivo (sin abrir un filtro) |
| E4 | La base dicha en una frase («642 de 1,283 casos con el filtro activo · 604 responden y 38 quedan sin respuesta») | `BarraLectura` / ficha | ◐ visto en vivo |
| E5 | Tira de cifras clave (Responden, Sin respuesta, Más frecuente, Opciones usadas) en lugar de las tarjetas KPI | `tabs/explorar/TiraCifras.tsx` | ◐ visto en vivo |
| E6 | Gráfico univariado por tipo: única ordenada, escala divergente, múltiple con «cuántas marca», numérica histograma + caja, fecha por día, abierta agrupada | motor `explorador_distribucion.R` (`uni.dist`) + `tabs/explorar/Distribucion*.tsx` | ◐ única, múltiple (una sola variable, 9 opciones) y numérica (histograma + caja) vistas en vivo; fecha y abierta sin ver |
| E7 | Selector de cruce con TODAS las variables, buscable, filtrable por tipo, que anticipa el gráfico del par | `components/CrossBar.tsx` + `tabs/explorar/graficoDelPar.ts` | ◐ visto en vivo: busca entre todas, chips por tipo en 3 columnas y anticipa «Tabla de calor» (4bbf5e480) |
| E8 | Los 25 pares tipo × tipo con gráfico propio (hoy 5) | motor `explorador_cruces.R` (`biv.cruce`) | ◐ inventario abajo (E8a–E8p) |
| E9 | Tabla de calor del cruce categórico: % por columna / por fila / n, ▲▼ a 5 pts del total, Total aparte, «Lo que se aparta del total» | `tabs/explorar/TablaCalor.tsx` | ◐ visto en vivo con consent × sexo: % por columna / fila / n y Total aparte |
| E10 | Panel «En el formulario»: texto y ayuda, tipo y lista, grupo, aparece si, restricción, obligatoria, filtro de opciones, qué abre «Otro», versión, opciones con código/etiqueta/n | motor `explorador_ficha.R` (GET `/api/validacion/v2/explorar/ficha`) + `tabs/explorar/PanelFormulario.tsx` | ◐ visto en vivo; una sola ficha con E11 y columna Código entera (45a26ab0d) |
| E11 | Panel «Lo que se ve en los datos»: sin respuesta, códigos fuera de la lista, textos en «Otro»; reglas sólo cuando existan (hoy: «aún no hay ninguna aplicada») | ficha (`datos`) + `tabs/explorar/PanelDatos.tsx` | ◐ visto en vivo, en la misma tarjeta que E10 |
| E12 | Al cruzar, la lista se pliega en un riel con anterior/siguiente | `ExplorarTab.tsx` layout | ◐ visto en vivo: la lista se pliega en riel con 2/63 y anterior/siguiente |

## E8 — inventario de los 25 pares (2026-11-03)

«Hoy 5» quiere decir cinco **formas**: el motor ya entrega los 25 pares (`.explorador_cruces_catalogo`), pero el
front los pinta con cinco componentes genéricos (`Cruce.tsx` → `TablaCalor`, `CruceCajas`, `CruceDispersion`,
`CruceSerie`, `CruceLista`) sin mirar el par. Filas = la variable que se lee (x); columnas = la del cruce (y).
Las 16 familias suman los 25 pares.

| # | Pares (x × y) | Gráfico del contrato | Hoy | Qué debería mostrar | Dónde vive | Estado |
|---|---|---|---|---|---|---|
| E8a | so × so | Tabla de calor | `TablaCalor`: % por columna, por fila y n, Total aparte | Lo mismo: cada caso cae en una celda y las tres lecturas son honestas | `explorarModelo.modeloCalor` | ◐ ya visto en vivo (E9); falta repasarlo con los demás pares |
| E8b | so × sm | % que marca, por categoría | `TablaCalor` genérica. La columna Total suma menciones (un caso cuenta en cada opción que marca) y la lectura por fila divide entre menciones | Por categoría (fila), el % de sus casos que marca cada opción. Denominador = casos de la categoría que responden la múltiple, que el motor no publica hoy (`tabla.filas[].n`) | motor `explorador_cruces.R` + `modeloCalor` | ☐ metodología: revisor |
| E8c | sm × so | % que marca cada opción, por categoría | `TablaCalor` genérica. «Cada columna suma 100%» es falso (las opciones se solapan); el Total de la lectura por fila divide entre menciones | Por categoría (columna), el % que marca cada opción, sobre los casos de la categoría (`columnas[].n`); la columna Total, % de la base que marca la opción. Sin lectura «cada columna suma 100» | `modeloCalor` | ☐ metodología: revisor |
| E8d | sm × sm | Coocurrencia de opciones | `TablaCalor` genérica: la diagonal sale 100 % y los totales suman menciones | Entre quienes marcan la opción de la columna, el % que también marca la de la fila; la diagonal no aporta nada y se dice | `modeloCalor` | ☐ metodología: revisor |
| E8e | so × num, num × so, sm × num, num × sm | Cajas por categoría / por opción marcada | `CruceCajas`: una caja por grupo en la misma escala | Lo mismo; con múltiple, avisar que un caso entra en cada opción que marca | `CruceCajas` | ◐ revisar en vivo |
| E8f | fecha × so, fecha × sm | Días por categoría / por opción marcada | `CruceCajas` sobre «días desde la fecha mínima»: el eje dice 0…N, no fechas | Cajas con el eje en fechas (fecha mínima + días). El motor no publica la fecha de origen | motor (`origen` en `cajas`) + `CruceCajas` | ☐ |
| E8g | fecha × fecha | Diferencia en días | `CruceCajas` con una sola caja, sin unidad | Una caja de la diferencia en días, con la unidad en el eje y el signo explicado («y menos x») | `CruceCajas` | ☐ |
| E8h | num × num | Dispersión con tendencia | `CruceDispersion` con recta de mínimos cuadrados | Lo mismo | `CruceDispersion` | ◐ revisar en vivo |
| E8i | fecha × num | Fecha frente a la numérica | `CruceDispersion` con x en días desde la mínima: el eje horizontal no dice fechas | Dispersión con el eje horizontal en fechas | motor (`origen` en `dispersion`) + `CruceDispersion` | ☐ |
| E8j | so × fecha | Casos por día, apilados | `CruceSerie`: una línea por categoría, no apiladas. El título promete otra cosa | Barras apiladas por día (casos), o el título dice «líneas» | `CruceSerie` | ☐ |
| E8k | sm × fecha | % que marca, por día | `CruceSerie`: líneas por opción; el eje no dice que es % | Líneas con el eje en % | `CruceSerie` | ☐ |
| E8l | num × fecha | Mediana por día | `CruceSerie` con banda p25–p75 | Lo mismo, con la banda nombrada en la bajada | `CruceSerie` | ◐ revisar en vivo |
| E8m | so × texto, texto × so, sm × texto, texto × sm | Respuestas por categoría / por opción marcada | `CruceLista`: hasta 8 respuestas por grupo | Lo mismo | `CruceLista` | ◐ revisar en vivo |
| E8n | num × texto, texto × num | Respuestas ordenadas por valor / por tramos | El motor hace lo mismo en los dos (tramos por cuartil): «ordenadas por valor» no es lo que se ve | Los dos por tramos, con el mismo nombre, o num × texto ordena de verdad | motor + `graficoDelPar.ts` | ☐ |
| E8o | fecha × texto, texto × fecha | Respuestas por día | `CruceLista` por día (hasta 20 días con más respuestas) | Lo mismo, con la fecha legible | `CruceLista` | ◐ revisar en vivo |
| E8p | texto × texto | Dos abiertas lado a lado | `CruceLista`: respuestas de x agrupadas por cada respuesta de y | Lo mismo; el nombre promete «lado a lado» | `CruceLista` + nombre | ☐ |

## Contrato congelado (front ↔ motor)

**Ficha** — `GET /api/validacion/v2/explorar/ficha?var=&fuente=raw|final`:

```
{ ok, var, label, hint|null, tipo, tipo_xlsform|null, lista|null,
  grupo: {name,label}|null, relevant|null, constraint|null,
  constraint_message|null, required: bool|null, choice_filter|null,
  appearance|null, abre: [{var,label}], version_formulario|null,
  opciones: [{codigo, etiqueta, n}],
  datos: { n_total, n_responden, n_sin_respuesta, n_fuera_de_lista, n_otro_textos|null } }
```

**Univariado** — la respuesta de `/explorar/univariado` suma `dist` (se mantiene `chart`):

```
dist: { tipo, ordinal: bool, base_n,
  filas?: [{codigo, etiqueta, n, pct}],            # so/sm; en sm pct sobre quienes responden
  cuantas_marca?: [{k: "1"|"2"|"3+", n, pct}],     # sm
  num?: { bins: [{desde, hasta, n}], min, p25, mediana, p75, max, media, n_atipicos },
  fecha?: { dias: [{fecha, n}] },
  texto?: { grupos: [{texto, n}] } }
```

**Bivariado** — la respuesta de `/explorar/bivariado` suma `cruce` (se mantiene `view`):

```
cruce: { tipo_x, tipo_y, grafico, forma: "tabla"|"cajas"|"dispersion"|"serie"|"lista", base_n, n_x, n_y,
  tabla?: { filas: [{codigo, etiqueta, n}], columnas: [{codigo, etiqueta, n}], n: number[][] },   # n[fila][col]
  cajas?: { grupos: [{etiqueta, n, min, p25, mediana, p75, max, n_atipicos}] },
  dispersion?: { puntos: [[x, y]], tendencia: {pendiente, intercepto}|null, n },
  serie?: { puntos: [{fecha, valor, baja|null, alta|null, serie|null}] },
  lista?: { grupos: [{etiqueta, respuestas: [{texto, n}]}] } }
```

Filas = la variable que se lee (`var_x`); columnas = la del cruce (`var_y`).
`filas[].n` y `columnas[].n` son CASOS de la base en esa fila o columna, nunca sumas de celdas (con una múltiple, un
caso está en varias): son los denominadores de porcentajes y totales. `n_x` / `n_y`: casos que responden cada una con los
mismos filtros. Cruzar una variable consigo misma responde 400 `E_EXPLORAR_CRUCE_MISMA_VARIABLE` (revisión metodológica,
2026-11-03).

## Aprendido

- Hoy el motor sólo cruza so×so, so×sm, so×num, num×so, num×num; el resto cae
  en «Cruce no soportado» (`explorador_view_builders.R`, final de
  `build_view_bivariado`). El selector (`CrossBar.tsx`) sólo lista so/sm/num.
- Fecha no tiene univariado propio (`.explorar_chart_univariado`).
- Las reglas de validación aún no se aplican por pregunta: el panel no puede
  mostrar semáforos de reglas.
- En acnur_acg el XLSForm dice `D1_information` y la base `d1_information.*`; los
  `calculate` llegan como texto con «NaN» de Kobo. Ambas cosas rompían la lista
  (89aa0950b, 3d700f8b4): de 94 «variables» quedan 63 preguntas.
