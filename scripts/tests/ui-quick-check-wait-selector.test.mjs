import assert from "node:assert/strict";
import test from "node:test";

import { desvioDeRuta, summarize } from "../ui-quick-check.mjs";

// Una captura limpia: sin hallazgos y con ambas esperas cumplidas.
function captura(extra = {}) {
  return {
    route: "/graficos?pestana=laminas",
    viewport: { width: 1440, height: 1000 },
    screenshot: "x.png",
    waitSelectorMatched: true,
    postClickWaitSelectorMatched: true,
    ...extra,
  };
}

test("una captura que nunca casa el --post-click-wait-selector no aprueba", () => {
  const limpia = summarize([captura()], { api: "real" });
  assert.equal(limpia.ok, true);
  assert.equal(limpia.postClickWaitSelectorMisses, 0);

  // El caso real: se pidió un panel de Gráficos por `/procesamiento?seccion=graficos`,
  // la página fue otra, el panel nunca apareció en ninguna captura y el gate dio verde.
  const resumen = summarize([
    captura({ postClickWaitSelectorMatched: false, readinessMarca: "validacion-explorar" }),
    captura({ postClickWaitSelectorMatched: false, readinessMarca: "validacion-explorar" }),
  ], { api: "real" });
  assert.equal(resumen.ok, false);
  assert.equal(resumen.postClickWaitSelectorMisses, 2);
  assert.equal(resumen.waitSelectorMisses, 0, "la espera de carga sí casó: cada contador dice la suya");
});

test("el --wait-selector de carga sigue contando aparte", () => {
  const resumen = summarize([captura({ waitSelectorMatched: false })], { api: "real" });
  assert.equal(resumen.ok, false);
  assert.equal(resumen.waitSelectorMisses, 1);
  assert.equal(resumen.postClickWaitSelectorMisses, 0);
});

test("la ruta desviada se cuenta y se detalla, pero no falla por sí sola", () => {
  const motivo = desvioDeRuta("/carga?pestana=fuentes", "http://localhost:5173/validacion?pestana=explorar");
  assert.match(motivo, /\/carga → \/validacion/);

  const resumen = summarize([
    captura({ routeDeviation: motivo, finalUrl: "http://localhost:5173/validacion", readinessMarca: "validacion-explorar" }),
  ], { api: "real" });
  assert.equal(resumen.routeDeviations, 1);
  assert.equal(resumen.routeDeviationDetalle[0].readiness, "validacion-explorar");
  assert.equal(resumen.ok, true);
});

test("pedirle una sección a /procesamiento es un desvío aunque el pathname no cambie", () => {
  // `/procesamiento` es "Estado del estudio" y no lee la query: la URL final
  // conserva el pathname y ningún nivel se reescribe, pero la pantalla es otra.
  const motivo = desvioDeRuta(
    "/procesamiento?seccion=graficos&pestana=laminas&panel=guias",
    "http://localhost:5173/procesamiento?seccion=graficos&pestana=laminas&panel=guias",
  );
  assert.match(motivo, /Estado del estudio/);
  assert.match(motivo, /no lee seccion, pestana, panel/);
  assert.match(motivo, /pide la sección por su pathname/);
  // La misma petición también es desvío si la app limpia la query.
  assert.match(desvioDeRuta("/procesamiento?seccion=carga", "http://localhost:5173/procesamiento"), /Estado del estudio/);
  // Pedir la entrada sin niveles es pedir "Estado del estudio": no es desvío.
  assert.equal(desvioDeRuta("/procesamiento", "http://localhost:5173/procesamiento?devPulso=x"), null);
  assert.equal(desvioDeRuta("/procesamiento/", "http://localhost:5173/procesamiento"), null);
});

test("desvioDeRuta tolera la sección implícita y señala un nivel reescrito", () => {
  // `/graficos` no escribe `seccion=`: faltar no es desviarse.
  assert.equal(
    desvioDeRuta("/graficos?seccion=graficos&pestana=laminas", "http://localhost:5173/graficos?pestana=laminas&devPulso=x"),
    null,
  );
  assert.equal(desvioDeRuta("/carga/", "http://localhost:5173/carga"), null);
  assert.match(
    desvioDeRuta("/graficos?pestana=laminas", "http://localhost:5173/graficos?pestana=graficadores"),
    /pestana=laminas terminó como pestana=graficadores/,
  );
});
