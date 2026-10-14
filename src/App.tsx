import { StrictMode, useEffect } from "react";
import { ensurePersistence } from "./lib/persist.ts";
import { Router } from "./routes/router.tsx";

export default function App() {
  useEffect(() => {
    void ensurePersistence();
  }, []);
  return (
    <StrictMode>
      <Router />
    </StrictMode>
  );
}
