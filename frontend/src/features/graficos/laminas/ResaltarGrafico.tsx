// «Resaltar la barra más alta» ya no es un interruptor aparte (ítem 10 de la oleada del inspector, 2026-11-08): es la
// primera ficha de «Destacar» (DestacarRespuestas.tsx) y su modelo vive en realce.ts. Este módulo queda como alias para
// quien lo importaba (maqueta/fichaModelo.ts lee `GRAFICOS_CON_RESALTE` y `resaltaMayor`).

export { GRAFICOS_CON_RESALTE, resaltaMayor } from "./realce";
