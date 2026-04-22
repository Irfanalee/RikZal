import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import MorningBrief from "./windows/MorningBrief";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MorningBrief />
  </StrictMode>
);
