import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initTelegram } from "./lib/telegram";

async function bootstrap() {
  await initTelegram();
  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
