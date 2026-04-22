import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "jotai";
import "./index.css";
import MorningBrief from "./windows/MorningBrief";
import Sidebar from "./windows/Sidebar";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider>
      <MorningBrief />
      <Sidebar />
    </Provider>
  </StrictMode>
);
