import { createRoot } from "react-dom/client";
import MvpApp from "./app/mvp/MvpApp";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<MvpApp />);
