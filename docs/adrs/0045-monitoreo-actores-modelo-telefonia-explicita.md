# ADR 0045: Fuentes gobierna actores y canales; Modelo gobierna la estrategia

Estado: Aceptado

Fecha: 2026-07-27

## Contexto

Monitoreo de Acreditación ya declara en Fuentes qué actor alimenta cada fuente
y por qué canal. Esa declaración vive en `sources[*].dimensions$actor` y
`sources[*].dimensions$canal`, y aparece en la interfaz como matriz
actor–canal. Crear un segundo registro de actores en Modelo duplicaría la
autoridad: el mismo actor podría tener dos nombres, desaparecer de Modelo pese
a seguir conectado o entrar/salir de Teléfono desde dos controles distintos.

La decisión afecta el schema persistido en `.pulso`, la identidad de actores y
el ownership entre dos secciones de Monitoreo. No puede resolverse únicamente
con controles visuales ni usando el nombre visible como llave.

## Decisión

Fuentes es la fuente de verdad del roster de actores, sus nombres operativos y
los canales que alimentan cada actor. La unidad canónica se deriva de las
declaraciones de fuente, por ejemplo:

```r
source$dimensions <- list(
  actor = "Egresados",
  canal = "Telefonico"
)
```

El actor participa en Teléfono cuando al menos una fuente activa del actor está
declarada con canal `Telefonico`. Cero actores telefónicos es válido cuando no
existe esa declaración. No se decide por presencia de números, texto libre,
nombre de la encuesta ni mera existencia de una base de barrido.

`monitoreo_profile$units` puede conservar referencias o ajustes operativos por
compatibilidad, pero no crea, renombra ni elimina actores y tampoco decide su
canal. Un `units=[]` nunca borra un roster que Fuentes ya declaró.

Modelo consume ese roster en solo lectura y gobierna lo que sí le corresponde:
objetivo por actor (`barrido` o `minimo`), meta y porcentaje, prioridades y
reglas operativas, calendario de campo y cortes de reporte. Sus tarjetas usan
alturas iguales y capacidad interior acotada aunque un actor tenga pocas
fuentes. El nombre se edita en Fuentes y se refleja en Modelo.

Teléfono consume reportes filtrados por actores con canal telefónico declarado
en Fuentes. Cuando ninguno existe muestra un estado vacío útil que dirige a
Fuentes, no a Modelo.

## Consecuencias

Beneficios:

- una sola sección crea y nombra actores;
- la matriz de Fuentes explica exactamente quién participa en Teléfono;
- los proyectos pueden declarar que ningún actor es telefónico;
- configuración, reportes y `.pulso` quedan reproducibles y auditables.

Costos y riesgos:

- proyectos legacy conservan directamente los actores y canales ya declarados
  en Fuentes;
- barridos sin actor vinculado dejan de asignarse implícitamente a todos;
- frontend, endpoint y generador de reportes deben compartir el mismo contrato.

No se crea una nueva key top-level de sesión. El estado viaja dentro de
`monitoreo_config`, por lo que conserva el contrato portable existente y no
introduce secretos ni outputs en `.pulso`.

## Cumplimiento

- El normalizador debe derivar y deduplicar actores desde dimensiones de
  fuentes sin dejar que `units` borre o renombre ese roster.
- Pruebas backend deben cubrir 0, 1 y N actores telefónicos declarados por
  canal, `units` vacío y ausencia de activación heurística.
- Pruebas frontend deben comprobar que Modelo no ofrece CRUD de actores, que
  muestra el nombre proveniente de Fuentes y que Teléfono vacío remite a
  Fuentes.
- El QA visual debe recorrer Modelo y todas las pestañas de Teléfono en
  escritorio y compacto, comprobando marcos, scroll y estados 0/pocos/muchos.

## Notas

Complementa [ADR 0010](0010-monitoreo-centro-control-operativo-sheets.md) y
[ADR 0040](0040-flujo-acreditacion-formularios-monitoreo-procesamiento-ppt.md).
La implementación se divide en contrato persistido, filtrado de reportes y UI
para mantener cada reparación falsable.

## Gobierna

- `monitoreo/acreditacion/fuentes`
