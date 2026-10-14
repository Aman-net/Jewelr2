import { StrictMode } from "react";
import { Router } from "./routes/router.tsx";

export default function App() {
  return (
    <StrictMode>
      <Router />
    </StrictMode>
  );
}
