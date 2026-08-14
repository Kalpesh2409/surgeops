import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import CreateUserModal from "@/components/CreateUserModal";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  storeId: string | null;
  store: { name: string; city: string } | null;
  createdAt: string;
}

const roleStyles: Record<string, string> = {
  ADMIN: "bg-sky-500/10 text-sky-400",
  STORE_MANAGER: "bg-purple-500/10 text-purple-400",
  REGIONAL_MANAGER: "bg-amber-500/10 text-amber-400",
};

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ManageUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  async function fetchUsers() {
    const token = localStorage.getItem("surgeops-token");

    try {
      const res = await fetch(`${apiUrl}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load users");
        return;
      }

      setUsers(data.users);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while loading users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 p-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-foreground">
            Manage Users
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-sky-500 text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-sky-400 transition-colors"
          >
            + Create User
          </button>
        </div>
        <p className="text-muted-foreground text-sm mb-6">
          {users.length} {users.length === 1 ? "account" : "accounts"} total
        </p>

        {loading && <p className="text-muted-foreground">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-white/[0.03] border-b border-border">
                  <th className="py-3 px-5 font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="py-3 px-5 font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="py-3 px-5 font-medium text-muted-foreground">
                    Role
                  </th>
                  <th className="py-3 px-5 font-medium text-muted-foreground">
                    Store
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-0 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-sky-500 text-black flex items-center justify-center text-xs font-bold shrink-0">
                          {initialsOf(user.name)}
                        </div>
                        <span className="text-foreground font-medium">
                          {user.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="py-3 px-5">
                      <span
                        className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${
                          roleStyles[user.role] ||
                          "bg-gray-500/10 text-gray-400"
                        }`}
                      >
                        {user.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-muted-foreground">
                      {user.store
                        ? `${user.store.name} (${user.store.city})`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchUsers}
        />
      )}
    </div>
  );
}