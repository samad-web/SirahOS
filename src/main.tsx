import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App.tsx";
import { initSentry } from "./lib/sentry";
import "./index.css";

// Initialize Sentry BEFORE rendering so the error boundary can forward events.
initSentry();

createRoot(document.getElementById("root")!).render(
  // `reducedMotion="user"` makes framer-motion honour the OS/browser
  // `prefers-reduced-motion` setting globally — no per-component wiring.
  <MotionConfig reducedMotion="user">
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </MotionConfig>
);
