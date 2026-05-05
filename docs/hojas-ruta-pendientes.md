# Hojas De Ruta: Pendientes Operativos

## Decision actual

El modulo debe comportarse como un asistente de muestreo y campo. La prioridad no es exportar archivos, sino acompanar al usuario desde una pregunta simple: cuantos casos quiere, en que territorios y con que cortes.

## Estado aplicado

1. Marco muestral y cartografia emparejados.
   - Estado actual: `inei2017_lima_callao_manzanas_full.csv.gz` contiene 117,409 manzanas urbanas unicas para 50 distritos.
   - Poblacion y viviendas se extraen desde INEI REDATAM CPV2017 por `Manzana.NMANZ`.
   - El ID del marco se transforma a `ID_MANZANA`/`cartografia_id`, compatible con la cartografia local.
   - Cuando la cartografia divide una manzana censal en subgeometrias, el conteo REDATAM se distribuye por area dentro de la misma clave de manzana.

2. Rendimiento del mapa.
   - Distritos medianos se renderizan en SVG interactivo.
   - Distritos densos se renderizan en canvas, evitando miles de nodos DOM.
   - La cartografia se sirve localmente por distrito y ya no se consulta internet desde la UI.

3. PDFs de campo con minimapa.
   - Cada hoja integrada intenta dibujar el distrito y resaltar la manzana seleccionada.
   - Si una geometria faltara, el PDF lo declara explicitamente.

4. Metodos muestrales explicados.
   - La UI muestra tarjetas visuales para PPS, sistematico y conglomerado fijo.
   - El usuario puede cambiar de metodo desde las tarjetas o desde el selector.

5. Paquete local comprimido.
   - La cartografia por manzana queda en `geojson.gz` por distrito.
   - El peso bajo de aproximadamente 82 MB a 12 MB.
   - El instalador sigue copiando estos archivos dentro de `api/inst`, sin dependencia de internet.

## Pendientes residuales

1. Separar con claridad tres capas de datos en la UI y en el informe.
   - Cuotas: poblacion INEI 2017 por edad simple y sexo.
   - Marco muestral: manzanas con viviendas/poblacion usada como medida de tamano.
   - Cartografia: geometria para visualizar, revisar y entregar campo.
   - Callao debe mostrarse como mezcla trazable: poblacion 2017, geometria 2019.

2. Mejorar el mapa de supervision.
   - Primer nivel: distritos cubiertos.
   - Segundo nivel: zoom por distrito con manzanas.
   - Tercer nivel: manzanas seleccionadas, entrevistas asignadas y alertas.
   - Mantener distritos limitrofes como contexto visual, sin mezclarlos en la muestra.
   - No consultar internet de forma silenciosa desde la UI operativa.
   - Estado actual: distrito y manzana estan integrados en un solo explorador; el click abre manzanas y el minimapa mantiene el distrito resaltado.

3. Mantener cuotas flexibles.
   - Sexo debe ser una subcuota opcional, no obligatoria.
   - El default recomendado sigue siendo distrito x edad x sexo.
   - El usuario puede trabajar distrito x edad sin sexo cuando el estudio lo requiera.

4. Hacer explicables los metodos de seleccion.
   - PPS estratificado: usar viviendas o poblacion como medida de tamano.
   - Sistematico: ordenar marco y seleccionar con salto constante y arranque aleatorio.
   - Conglomerado fijo: usar cargas estables por manzana para simplificar campo.
   - Pendiente: agregar ejemplos numericos en el informe tecnico.

5. Endurecer entregables.
   - El informe tecnico debe listar fuente, version, checksum, semilla, exclusiones y alertas.
   - El ZIP operativo debe incluir fichas por manzana solo cuando la manzana tenga geometria y datos de campo suficientes.
   - Cuando falte geometria, el PDF debe decirlo explicitamente.
   - Pendiente: agregar instrucciones de recorrido cuando exista una fuente operativa de campo.

## Fuentes registradas

- INEI REDATAM CPV2017 para edad simple y sexo.
- IMP PlanMet 2040, catalogo de datos, capa `Manzanas Urbanas`.
- Capa ArcGIS `Manzanas_Urbanas/FeatureServer/0`, fuente declarada INEI 2017 / PlanMet / IMP 2020.
- Capa ArcGIS `B_070101_Distrito/FeatureServer/693` para distritos de Callao.
- Capa ArcGIS `B_070101_Manzanas/FeatureServer/0` para manzanas de Callao, fuente declarada `META 6 - PCC 2019`.
