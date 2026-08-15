import { Link, useLocation, useNavigate } from "react-router-dom";

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: string;
  storeId: string | null;
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const raw = localStorage.getItem("surgeops-user");
  const user: StoredUser | null = raw ? JSON.parse(raw) : null;

  function handleLogout() {
    localStorage.removeItem("surgeops-token");
    localStorage.removeItem("surgeops-user");
    navigate("/home", { state: { loggedOut: true } });
  }

  const dashboardRoutes: Record<string, string> = {
    ADMIN: "/admin-dashboard",
    STORE_MANAGER: "/store-dashboard",
    REGIONAL_MANAGER: "/regional-dashboard",
  };
  const dashboardPath = user ? dashboardRoutes[user.role] || "/admin-dashboard" : "/admin-dashboard";

  // Every role sees Dashboard and Store Overview. Sales Analytics and Users
  // are limited based on role — Store Manager sees neither, Regional
  // Manager sees Sales Analytics but not Users, Admin sees everything.
  const links = [
    { label: "Dashboard", icon: "🏠", to: dashboardPath },
    ...(user?.role !== "STORE_MANAGER"
      ? [{ label: "Sales Analytics", icon: "📊", to: "/sales-analytics" }]
      : []),
    { label: "Store Overview", icon: "🏬", to: "/operations" },
    ...(user?.role === "ADMIN"
      ? [{ label: "Users", icon: "👥", to: "/manage-users" }]
      : []),
  ];

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <aside className="w-56 min-h-screen bg-[#0d0d0d] border-r border-[#1f1f1f] flex flex-col p-4">
      <div className="font-display text-lg font-bold text-white mb-8 px-2">
        SurgeOps
      </div>

      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-sky-500/10 text-sky-400"
                  : "text-gray-400 hover:bg-[#161616] hover:text-gray-200"
              }`}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-[#1f1f1f] flex flex-col gap-3 px-2">
        <div className="w-8 h-8 rounded-full bg-sky-500 text-black flex items-center justify-center text-xs font-bold">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm truncate">{user?.name || "—"}</p>
          <p className="text-gray-600 text-xs">{user?.role || ""}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-red-500 hover:bg-red-500/10 text-xs font-medium cursor-pointer px-2 py-1 rounded-md transition-colors"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}