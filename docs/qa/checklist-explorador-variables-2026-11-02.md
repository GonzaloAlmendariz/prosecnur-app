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
| E6 | Gráfico univariado por tipo: única ordenada, escala divergente, múltiple con «cuántas marca», numérica histograma + caja, fecha por día, abierta agrupada | motor `explorador_distribucion.R` (`uni.dist`) + `tabs/explorar/Distribucion*.tsx` | ◐ única vista en vivo; numérica, fecha, múltiple y abierta sin ver |
| E7 | Selector de cruce con TODAS las variables, buscable, filtrable por tipo, que anticipa el gráfico del par | `components/CrossBar.tsx` + `tabs/explorar/graficoDelPar.ts` | ☐ |
| E8 | Los 25 pares tipo × tipo con gráfico propio (hoy 5) | motor `explorador_cruces.R` (`biv.cruce`) | ☐ |
| E9 | Tabla de calor del cruce categórico: % por columna / por fila / n, ▲▼ a 5 pts del total, Total aparte, «Lo que se aparta del total» | `tabs/explorar/TablaCalor.tsx` | ☐ |
| E10 | Panel «En el formulario»: texto y ayuda, tipo y lista, grupo, aparece si, restricción, obligatoria, filtro de opciones, qué abre «Otro», versión, opciones con código/etiqueta/n | motor `explorador_ficha.R` (GET `/api/validacion/v2/explorar/ficha`) + `tabs/explorar/PanelFormulario.tsx` | ◐ visto en vivo; una sola ficha con E11 y columna Código entera (45a26ab0d) |
| E11 | Panel «Lo que se ve en los datos»: sin respuesta, códigos fuera de la lista, textos en «Otro»; reglas sólo cuando existan (hoy: «aún no hay ninguna aplicada») | ficha (`datos`) + `tabs/explorar/PanelDatos.tsx` | ◐ visto en vivo, en la misma tarjeta que E10 |
| E12 | Al cruzar, la lista se pliega en un riel con anterior/siguiente | `ExplorarTab.tsx` layout | ☐ |

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
cruce: { tipo_x, tipo_y, grafico, forma: "tabla"|"cajas"|"dispersion"|"serie"|"lista", base_n,
  tabla?: { filas: [{codigo, etiqueta}], columnas: [{codigo, etiqueta, n}], n: number[][] },   # n[fila][col]
  cajas?: { grupos: [{etiqueta, n, min, p25, mediana, p75, max, n_atipicos}] },
  dispersion?: { puntos: [[x, y]], tendencia: {pendiente, intercepto}|null, n },
  serie?: { puntos: [{fecha, valor, baja|null, alta|null, serie|null}] },
  lista?: { grupos: [{etiqueta, respuestas: [{texto, n}]}] } }
```

Filas = la variable que se lee (`var_x`); columnas = la del cruce (`var_y`).

## Aprendido

- Hoy el motor sólo cruza so×so, so×sm, so×num, num×so, num×num; el resto cae
  en «Cruce no soportado» (`explorador_view_builders.R`, final de
  `build_view_bivariado`). El selector (`CrossBar.tsx`) sólo lista so/sm/num.
- Fecha no tiene univariado propio (`.explorar_chart_univariado`).
- Las reglas de validación aún no se aplican por pregunta: el panel no puede
  mostrar semáforos de reglas.
