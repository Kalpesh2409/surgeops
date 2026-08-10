import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const loggedOut = (location.state as { loggedOut?: boolean } | null)?.loggedOut;

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      localStorage.setItem("surgeops-token", data.token);
      localStorage.setItem("surgeops-user", JSON.stringify(data.user));

      navigate("/admin-dashboard");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center p-6">
      <div className="w-full max-w-4xl min-h-[560px] flex rounded-3xl overflow-hidden shadow-2xl">
        {/* Left side — image + welcome message */}
        <div
          className="hidden md:flex md:w-1/2 relative overflow-hidden bg-cover bg-center p-10 flex-col justify-end"
          style={{ backgroundImage: "url('/images/login-visual.png')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="relative z-10 text-white">
            <p className="font-display text-lg font-bold mb-3">SurgeOps</p>
            <h2 className="font-display text-2xl font-bold mb-2 leading-tight">
              Welcome back.
            </h2>
            <p className="font-body text-gray-300 text-sm max-w-xs leading-relaxed">
              Log in to monitor live pricing, inventory, and demand across
              all your stores.
            </p>
          </div>
        </div>

        {/* Right side — white login form */}
        <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-10">
          <div className="w-full max-w-xs">
            <Link
              to="/home"
              className="block text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6"
            >
              ← Back to home
            </Link>

            <h1 className="text-2xl font-bold text-gray-900 mb-1">Log in</h1>
            <p className="text-sm text-gray-500 mb-6">
              Enter your email and password to access your account.
            </p>

            {loggedOut && (
              <p className="text-sm text-green-600 mb-4">
                Logged out successfully.
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-500 hover:bg-sky-400 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? "Logging in..." : "Log in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}