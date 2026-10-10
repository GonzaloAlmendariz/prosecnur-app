---
tipo: seccion
ruta_app: "/calc-muestra?modo=marco-disponible&seccion=seleccion"
nodo: "calc-muestra/marco-disponible/seleccion"
padres: ["[[Muestra general]]"]
orden: 3
documentacion: completa
verificado_contra: "819ece7c"
tags:
  - Seccion
fuentes:
  - "frontend/src/features/calcMuestra/general/SeleccionGeneral.tsx"
  - "api/R/calc_muestra_general_sorteo.R"
  - "api/R/calc_muestra_general_marco.R"
  - "api/R/calc_muestra_general_entrega.R"
  - "frontend/src/features/calcMuestra/general/FichaCorrida.tsx"
  - "frontend/src/features/calcMuestra/general/TablaUnidades.tsx"
  - "docs/adrs/0090-muestra-general-sortea-de-un-marco-real.md"
---
# Selección
> Sortea las unidades del marco declarado y publica, por cada una, su probabilidad de inclusión y su peso.
## Objetivo
Pasar del n calculado a un listado reproducible: qué unidades se abordan, con qué π y en qué orden se liberan las reservas.
## Antes de empezar
- Declarar el archivo del marco en **Marco** (columna id; estrato y tamaño si existen). El N del cálculo sale de ese archivo.
- Tener el n a campo calculado en **Método**: es el número de titulares que se sortea.
## Elementos de la pantalla
| Elemento | Para qué sirve | Qué cambia o produce |
|---|---|---|
| Método | MAS, sistemático (intervalo fraccional) o PPS (con certezas) | La π de cada unidad |
| Semilla | Fija el sorteo | Misma semilla + mismo marco = mismo listado |
| Reemplazos por estrato | Réplicas del mismo estrato, en orden aleatorio | Se liberan por lotes completos; no en PPS |
| Ficha de la corrida | Método, semilla, RNG, versión de R, run_id y huellas | Lo necesario para repetir el sorteo |
| Tabla por estrato | N_h, n_h a campo y π | Comprueba el reparto |
| Listado | Principales y reemplazos con π y peso base | Lo que va a campo |
| Descargar listado (XLSX) | Libro con Corrida, Memoria de cálculo, Estratos y Listado | Entregable |
## Reglas que no se ven
- El marco se ordena por id antes de sortear: el orden del archivo no cambia la muestra.
- La semilla de cada estrato sale de su clave, no de su posición.
- Un marco que cambió después de declararse no se sortea: hay que volver a declararlo.
- La π viaja sin redondear (una π de 0,0000371 viajaba como 0 con el serializador global).
- Con técnica censal el listado es el marco entero en orden de contacto (π = 1); con cuotas o conveniencia no hay sorteo; conglomerados y dominios independientes sólo se dimensionan aquí y se sortean en el modo de aulas.
## Pestañas
- [[Selección aleatoria]]: método, semilla y reemplazos; el botón que selecciona.
- [[Resumen de la selección]]: cifras, traza para repetir, reparto por estrato y descarga del libro.
- [[Unidades seleccionadas]]: el listado con π, peso base, estado y lote.
## Validación
Monte Carlo en `docs/qa/montecarlo-muestra-general-2026-09-24.md`: insesgado en los cuatro diseños; el error queda dentro del margen declarado.
