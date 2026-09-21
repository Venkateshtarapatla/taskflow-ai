import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { login, register } from "./api";
import { setToken } from "./auth";
import "./AuthPage.css";

interface AuthPageProps {
  onAuthenticated: () => void;
}

type AuthMode = "login" | "register";

function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isLogin = mode === "login";

  useEffect(() => {
    const sessionExpired =
      sessionStorage.getItem("taskflow_session_expired");

    if (sessionExpired === "true") {
      setError(
        "Your session has expired. Please sign in again.",
      );
      sessionStorage.removeItem("taskflow_session_expired");
    }
  }, []);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters.",
      );
      return;
    }

    try {
      setLoading(true);

      const response = isLogin
        ? await login({
            email: cleanEmail,
            password,
          })
        : await register({
            email: cleanEmail,
            password,
          });

      setToken(response.access_token);

      setSuccess(
        isLogin
          ? "Login successful. Loading your workspace..."
          : "Account created successfully. Loading your workspace...",
      );

      setEmail("");
      setPassword("");

      setTimeout(() => {
        onAuthenticated();
      }, 400);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          isLogin
            ? "Unable to log in. Please try again."
            : "Unable to create your account. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(isLogin ? "register" : "login");
    setError("");
    setSuccess("");
    setPassword("");
    setShowPassword(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-background">
        <div className="auth-orb auth-orb-one" />
        <div className="auth-orb auth-orb-two" />
        <div className="auth-grid" />
      </div>

      <main className="auth-container">
        <section className="auth-card">
          <div className="auth-brand">
            <div className="auth-logo">✓</div>

            <div>
              <h1>TaskFlow AI</h1>
              <p>Work smarter. Get more done.</p>
            </div>
          </div>

          <div className="auth-heading">
            <h2>
              {isLogin
                ? "Welcome back"
                : "Create your account"}
            </h2>

            <p>
              {isLogin
                ? "Sign in to continue to your workspace."
                : "Start organizing your work with AI-powered task management."}
            </p>
          </div>

          <form
            className="auth-form"
            onSubmit={handleSubmit}
          >
            <div className="auth-field">
              <label htmlFor="auth-email">
                Email address
              </label>

              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="auth-password">
                  Password
                </label>

                {isLogin && (
                  <span className="auth-password-hint">
                    Minimum 6 characters
                  </span>
                )}
              </div>

              <div className="auth-password-wrapper">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete={
                    isLogin
                      ? "current-password"
                      : "new-password"
                  }
                  disabled={loading}
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  title={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-message auth-message-error">
                <span>!</span>
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="auth-message auth-message-success">
                <span>✓</span>
                <p>{success}</p>
              </div>
            )}

            <button
              type="submit"
              className="auth-submit-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  {isLogin
                    ? "Signing in..."
                    : "Creating account..."}
                </>
              ) : (
                <>
                  {isLogin
                    ? "Sign in"
                    : "Create account"}
                  <span className="auth-arrow">→</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <div className="auth-switch">
            <span>
              {isLogin
                ? "Don't have an account?"
                : "Already have an account?"}
            </span>

            <button
              type="button"
              onClick={switchMode}
              disabled={loading}
            >
              {isLogin
                ? "Create account"
                : "Sign in"}
            </button>
          </div>

          <div className="auth-footer">
            <span>🔐</span>
            <p>
              Your tasks are private and protected
              by secure authentication.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default AuthPage;
