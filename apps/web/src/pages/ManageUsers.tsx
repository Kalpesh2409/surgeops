import { useEffect, useState } from "react";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  storeId: string | null;
  store: { name: string; city: string } | null;
  createdAt: string;
}

export default function ManageUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  useEffect(() => {
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

    fetchUsers();
  }, [apiUrl]);

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="text-xl font-bold text-foreground mb-4">Manage Users</h1>

      {loading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && (
        <table className="w-full text-sm text-foreground border-collapse">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Store</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border">
                <td className="py-2 pr-4">{user.name}</td>
                <td className="py-2 pr-4">{user.email}</td>
                <td className="py-2 pr-4">{user.role}</td>
                <td className="py-2 pr-4">
                  {user.store ? `${user.store.name} (${user.store.city})` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}