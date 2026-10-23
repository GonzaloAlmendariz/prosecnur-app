# Checklist · T2 metas por cuota + revisión visual de Correo (2026-10-22)

Tipo: Checklist de pedido con varias indicaciones
Estado: En curso
Fecha: 2026-10-22
Autoridad: Pedido de Gonzalo (citado abajo); sólo él da por terminado un ítem

Pedido de Gonzalo: «Dale con T2, luego revisa la UI porque se ve altamente simple, plana y le falta
profesionalismo».

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | Metas por cuota: por público y variable de su base (dedicación, facultad, puesto), meta por categoría y efectivas por categoría tomadas del universo cruzado por token | `api/R/monitoreo_acreditacion_cuotas.R` + `api/R/router_monitoreo_cuotas.R` (nuevos) | hecho: `monitoreo_cuotas_modelo` + rutas; `test-monitoreo-acreditacion-cuotas.R` 29 pass; gate 276 pass con transversales |
| 2 | Propuesta de metas como la hoja «Metas de encuestas»: meta = personas de la categoría × cobertura, redondeada hacia arriba; cobertura editable | ídem (`/proponer`) | hecho: `/proponer`; sin cobertura usa meta del público / universo |
| 3 | Pestaña Avance › Cuotas: leer el avance por categoría y configurar las cuotas | `frontend/.../profiles/acreditacion/AvanceCuotas*.tsx` | implementado (agente frontend-react): `AvanceCuotas*.tsx`, `avanceCuotasModelo.ts`, panel direccionable `?panel=cuota`; tsc y gate front verdes en su entrega. **Falta verlo con datos reales en pantalla** |
| 4 | Comprobar con las cifras reales del Excel (Docentes Campus por dedicación: TPA 605, DTC 197, TPC20 10 con cobertura 0.312) | prueba con la copia de trabajo de 45 mil | hecho: Docentes Campus · Dedicación con 0.312 → TPA 1939/605, DTC 631/197, TPC20 29/10 (igual al Excel); pregrado · facultad con 0.199 suma 4,547 frente a 4,542 por el redondeo hacia arriba de cada categoría, como advierte el Excel. Administrativos · Puesto: 91 categorías, por eso el tope de variables elegibles es 150 |
| 5 | Correo deja de ser plano: jerarquía, visualizaciones y lectura profesional | `AvanceCorreo*.tsx` + `AvanceCorreo.css` | implementado: embudo héroe, matriz de públicos con barras y mini-serie, cronología por público, inválidos con reparto; paleta de públicos determinista. Revisado en vivo con datos reales a 1440: el embudo y la matriz leen bien; corregido el chip de ritmo que bajaba de línea con nombres largos. **Falta la pasada completa a 1024 y la página entera** |
| 6 | Cuotas nace con el mismo estándar visual que Correo | ídem 3 | implementado con el mismo lenguaje; **falta la revisión visual con datos** |
| 7 | QA: 1440x1000 y 1024x600, antes y después, `ui-quick-check --require-geometry`, verificador | — | **pendiente para la próxima sesión.** El `ui-quick-check` se colgó en Correo: sin el cruce en caché, `/mailchimp/estado` lo recalculaba en el hilo de la API (330 s en frío) y `/cuotas` tardaba 54 s. Corregido: las dos rutas leen solo el tablero de Consultas que deja el warmup y, si aún no está, responden «preparando» (la vista reintenta cada 15 s y publica `vacio:preparando`); llaves vectorizadas. Falta: repetir `ui-quick-check --full-page --require-geometry` en correo, cuotas y `panel=cuota` a 1440 y 1024 sobre `qa/acred_qa.pulso` (scratchpad de la sesión), y el verificador |

## Contrato T2 (congelado)

Persistencia: `s$monitoreo_cuotas` (viaja en el `.pulso`, sin datos personales):

```r
list(schema = "monitoreo_cuotas_v1", cuotas = list(list(
  id, actor, variable, cobertura,          # cobertura: proporción 0–1 o NA si las metas se escribieron a mano
  metas = list(<categoria> = <entero>),
  actualizada_at
)))
```

Rutas:

- `GET /api/monitoreo/cuotas` → `{ ok, publicos, cuotas, avisos }`
  - `publicos: [{ actor, universo, efectivas, meta, variables: [{ variable, categorias }] }]`. `meta` es la del público
    (`config$goals`). `variables` son las columnas de su base con 2 a 150 categorías: se pueden usar como cuota.
  - `cuotas: [{ id, actor, variable, cobertura, universo, meta, efectivas, avance, categorias_cumplidas, categorias_total,
    sin_dato, categorias: [{ categoria, universo, meta, efectivas, falta, avance, tasa, estado }] }]`
    - `avance = efectivas / meta`, tope en el dato real (puede pasar de 1).
    - `tasa = efectivas / universo` de la categoría.
    - `estado`: `cumplida` (efectivas ≥ meta > 0) | `en_curso` (0 < efectivas < meta) | `sin_avance` (0 efectivas,
      meta > 0) | `sin_meta` (meta 0).
    - Orden: de mayor a menor universo. «Sin dato» va al final como categoría propia si existe.
- `POST /api/monitoreo/cuotas/proponer` `{ actor, variable, cobertura? }` →
  `{ ok, actor, variable, cobertura, categorias: [{ categoria, universo, meta }] }`.
  Sin cobertura, se usa `meta del público / universo del público`. Meta = ceiling(universo × cobertura).
- `POST /api/monitoreo/cuotas` `{ cuotas: [{ id?, actor, variable, cobertura?, metas: {cat: n} }] }` reemplaza la
  configuración y devuelve lo mismo que el GET.

Reglas: la categoría de cada persona sale de **su fila en la base** (la columna `variable` del universo de su público),
no de la respuesta. La efectiva se cruza por la llave de la base (`key_rules$universe_fields`, el token en este estudio)
contra el `case_rollup` de Monitoreo (`counts_in_advance`).

## Para retomar

- Proyecto de QA con datos en ambas pestañas: lectura real de Mailchimp del piloto y las cuatro cuotas del estudio con las coberturas del Excel. Se arma con `scratchpad/qa/armar.R` de la sesión `monitoreo-acred-inst`.
- La máquina estaba saturada al cerrar (load average > 100). Las mediciones de tiempo de esta tanda no son comparables.
- Pendientes del agente: `PANEL_CUOTA` no está en `PANELES_POR_MODULO` (`lib/navegacion/manifiesto.ts`). El paso del embudo quedó como «Enviados» y no «Invitados», porque cuenta correos y no personas.
