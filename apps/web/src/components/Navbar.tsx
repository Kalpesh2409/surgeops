import { Link, useNavigate } from "react-router-dom";

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: string;
  storeId: string | null;
}

export default function Navbar() {
  const navigate = useNavigate();
  const raw = localStorage.getItem("surgeops-user");
  const user: StoredUser | null = raw ? JSON.parse(raw) : null;

  function handleLogout() {
    localStorage.removeItem("surgeops-token");
    localStorage.removeItem("surgeops-user");
    navigate("/home", { state: { loggedOut: true } });
  }

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
      <span className="font-bold text-lg text-foreground">SurgeOps</span>

      <div className="flex items-center gap-6 text-sm">
        <Link to="/admin-dashboard" className="text-foreground hover:underline">
          Admin Dashboard
        </Link>
        <Link to="/manage-users" className="text-foreground hover:underline">
          Manage Users
        </Link>
        {user && <span className="text-muted-foreground">{user.name}</span>}
        <button
          onClick={handleLogout}
          className="text-red-500 hover:underline cursor-pointer"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
