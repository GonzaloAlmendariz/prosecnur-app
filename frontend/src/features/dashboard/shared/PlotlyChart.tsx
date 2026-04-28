// Re-export del wrapper compartido en `lib/`. Mantenido aquí para no
// romper imports existentes del Dashboard. La implementación vive en
// `frontend/src/lib/PlotlyChart.tsx` para que Validación pueda
// reusarla sin crear dependencia cruzada entre features.
export { PlotlyChart } from "../../../lib/PlotlyChart";
