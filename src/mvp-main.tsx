import { createRoot } from "react-dom/client";
import MvpApp from "./app/mvp/MvpApp";
import "./styles/index.css";

// Entry for the PRD-aligned MVP shell (01_PRD_Customer_Forms_Hub_v1).
// Runs alongside the original App until the team switches the main entry:
// http://localhost:<port>/mvp.html

createRoot(document.getElementById("root")!).render(<MvpApp />);
