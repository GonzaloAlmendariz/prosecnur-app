import { getMonitoreoCuotas, type MonitoreoCuotasEstado } from "../../../../../api/monitoreoCuotas";

// Último estado de cuotas leído en esta sesión del perfil. Cada visita a
// Insumos, Modelo o Avance › Por cuota volvía a pedir `GET /api/monitoreo/cuotas`
// y la vista esperaba la respuesta en blanco (3.6 s medidos al volver a
// Insumos). Ahora pinta con lo último leído y revalida igual al montar: la cifra
// final es siempre la del motor. Publicos y Fuentes montan a la vez y antes
// pedían dos veces; la lectura en vuelo se comparte.
//
// Cambiar de proyecto no recarga la pestaña, así que el recuerdo muere con
// `pulso:project-closed` (cerrar y volver a elegir) y con
// `pulso:session-changed` (abrir o crear otro desde el menú con la suite
// montada: `/api/project/open` entrega un sid nuevo). Sin eso el proyecto
// siguiente pintaba las cuotas del anterior. La generación impide además que
// una lectura o un guardado en vuelo del proyecto anterior se le entregue al
// nuevo o reescriba su recuerdo.

let ultimo: MonitoreoCuotasEstado | null = null;
let enVuelo: Promise<MonitoreoCuotasEstado> | null = null;
let generacion = 0;

export function olvidarCuotas() {
  generacion += 1;
  ultimo = null;
  enVuelo = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("pulso:project-closed", olvidarCuotas);
  window.addEventListener("pulso:session-changed", olvidarCuotas);
}

export function cuotasRecientes() {
  return ultimo;
}

export function generacionDeCuotas() {
  return generacion;
}

/** `desde`: la generación tomada antes de la petición que trajo `estado`. */
export function recordarCuotas(estado: MonitoreoCuotasEstado | null, desde = generacion) {
  if (desde === generacion) ultimo = estado;
}

export function leerCuotas(): Promise<MonitoreoCuotasEstado> {
  if (enVuelo) return enVuelo;
  const propia = generacion;
  const peticion = getMonitoreoCuotas()
    .then((estado) => {
      if (propia === generacion) ultimo = estado;
      return estado;
    })
    .finally(() => {
      if (enVuelo === peticion) enVuelo = null;
    });
  enVuelo = peticion;
  return peticion;
}
