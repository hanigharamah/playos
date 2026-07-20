import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";
import { initAnalytics } from "./lib/analytics";

initAnalytics();
registerServiceWorker();
createRoot(document.getElementById("root")!).render(<App />);
