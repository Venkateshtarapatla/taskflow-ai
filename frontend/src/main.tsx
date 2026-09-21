import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import AuthPage from "./AuthPage";
import { hasValidToken } from "./api";

import "./index.css";

function Root() {
  const [isAuthenticated, setIsAuthenticated] =
    useState<boolean>(() => hasValidToken());

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return (
      <AuthPage
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);