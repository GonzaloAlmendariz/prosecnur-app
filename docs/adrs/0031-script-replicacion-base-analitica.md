# ADR 0031: Script de replicacion (.R) de la base de Analitica

Estado: Propuesto

Fecha: 2026-07-10

## Contexto

Clientes academicos (PULSO PUCP, ACNUR, universidades) piden, como parte del
entregable, un archivo `.R` que les permita **replicar por su cuenta** la base
final que presentamos en Analitica (la que exportamos en Excel), partiendo del
**crudo que ellos mismos descargan de Kobo**. Es una expectativa metodologica de
reproducibilidad: el cliente quiere poder correr un script y llegar exactamente a
la misma base, sin depender de Prosecnur.

Hoy el camino del dato pasa por varios pasos internos antes de llegar a Analitica:
filtrado de universo en Monitoreo (validada/revision, exclusion de no defendibles
y **tachas/anulaciones caso por caso**), handoff a Procesamiento, normalizacion
contra el XLSForm (nombres planos, reconstruccion de `select_multiple`),
decisiones de limpieza, codificacion (recodes, dummies, valores especiales) y
preparacion de Analitica (exclusiones, etiquetas, orden de variables). Ese
recorrido tiene **metadata interna** (mecanica de tachas, flags de QA, columnas
de auditoria) que **no debe filtrarse** al cliente.

## Decision

Se agrega un **entregable opcional** en **Analitica -> Base de datos**: un boton
"Descargar script de replicacion (.R)" que genera un archivo `.R` **elegante,
autocontenido y comentado en lenguaje de investigacion** (no jerga interna) que,
corrido sobre el crudo de Kobo, reproduce **exactamente** la base final.

### Pasos que emite el script (sanitizados)

1. Carga del crudo (export de Kobo que el cliente ya tiene).
2. Filtro de casos al universo final (criterios observables: consentimiento,
   completitud, etc.) **mas** la exclusion de casos por control de calidad.
3. Normalizacion de columnas: nombres planos (sin prefijo de grupo),
   reconstruccion de `select_multiple` (madre + dummies) en **orden de la lista de
   opciones del XLSForm**.
4. Recodificacion: abiertas -> codigos, valores especiales 90-99.
5. Etiquetado confirmado.
6. Seleccion y orden de variables finales (orden XLSForm), sin columnas
   internas/metadata.
7. Salida = base identica a la del Excel de Analitica.

Base R o dependencias minimas, para que el cliente lo corra sin friccion.

### Regla de sanitizacion (innegociable)

- **Reproduccion exacta** (no solo por reglas): el script debe producir una base
  identica a la entregada, incluidas las tachas manuales.
- Las tachas se quitan **caso por caso**, pero el script **solo reporta el
  `_uuid`** de los casos excluidos, presentado como *"casos fuera del universo
  final por control de calidad"*. **Nunca** nombres, ni el motivo interno, ni el
  vocabulario "tacha"/"anulacion", ni columnas de metadata/auditoria interna. El
  `_uuid` ya existe en el crudo del cliente, asi que permite reproducir exacto sin
  revelar quien ni por que.
- El script se lee como una metodologia de limpieza estandar y defendible, no como
  un volcado del pipeline interno.

## Consecuencias

- **Engine nuevo** (par de los motores PDF/codebook): introspecta las decisiones
  realmente aplicadas en la sesion (filtros de universo, uuids excluidos, recodes,
  exclusiones, etiquetas, expansion/orden de dummies) y las emite como R limpio y
  parametrizado. Debe tener test que verifique que la base resultante del script
  coincide con la base de Analitica sobre un fixture real.
- Endpoint nuevo en Analitica + boton opcional en el pane Base de datos.
- Contrato de fidelidad: el script tiene que reproducir la base al 100%; cualquier
  paso no capturado (una decision de limpieza no emitida) rompe la reproducibilidad
  y es un bug de correctitud, no cosmetico.
- Riesgo de fuga de metadata: la regla de sanitizacion es parte del contrato del
  engine, no un detalle de presentacion. Todo lo que el script exponga debe pasar
  por un filtro que garantice UUID-only en las exclusiones y cero columnas internas.

## Pendiente

Construir el engine como **unidad limpia propia** (idealmente en una sesion/branch
sin el entrelazado actual del working tree). Este ADR fija el diseno y la regla de
sanitizacion para que la implementacion no improvise.
