import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { followColorScheme } from "./colorScheme";
import "./styles.css";

followColorScheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
