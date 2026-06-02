# ADR 0001: Aplicacion local de escritorio

Estado: Aceptado

Fecha: 2026-05-31

## Contexto

Prosecnur trabaja con bases de encuestas, instrumentos, decisiones de limpieza,
codificacion y entregables metodologicos. Esos datos suelen ser sensibles y el
flujo principal lo ejecuta una persona analista en su maquina.

La alternativa seria convertir Prosecnur en una plataforma web colaborativa con
backend remoto, usuarios y almacenamiento centralizado. Eso podria mejorar la
colaboracion, pero aumentaria la complejidad operacional, los riesgos de datos
y la superficie de seguridad.

## Decision

Prosecnur se define siempre como una aplicacion local de escritorio. Electron
abre la interfaz, Plumber/R corre por defecto en `127.0.0.1:8787` y la sesion
principal vive en el proceso local.

La aplicacion puede realizar conexiones salientes controladas cuando el usuario
las configura y las dispara, por ejemplo SurveyMonkey, Kobo o la publicacion de
un dashboard en Hugging Face. Eso no cambia la naturaleza local de Prosecnur:
son integraciones de borde o artefactos derivados, no una conversion a
plataforma SaaS.

## Consecuencias

Se gana privacidad, control sobre archivos, trabajo offline para el flujo base y
reproducibilidad del entorno de analisis. Tambien se reduce la infraestructura
necesaria para usar la app.

Se sacrifica colaboracion en tiempo real, control centralizado de permisos y
observabilidad remota. El analista tambien depende de que su maquina tenga el
runtime necesario o use un paquete local preparado.

## Cumplimiento

- `run_app()` debe mantener `127.0.0.1` como host por defecto.
- Las rutas que sirvan un artefacto publicado deben pasar por una whitelist
  explicita.
- Las conexiones salientes deben ser iniciadas por el usuario o por un flujo
  documentado, usando secretos fuera del `.pulso`.
- El README debe presentar Prosecnur como aplicacion local todo-en-uno.
- Las nuevas capacidades colaborativas requieren un ADR propio.

## Notas

Relacionado con [ADR 0004](0004-monolito-modular-microkernel.md),
[ADR 0007](0007-integraciones-salientes-dashboard-publicable.md) y la
[guia arquitectonica](../arquitectura-prosecnur.md).
