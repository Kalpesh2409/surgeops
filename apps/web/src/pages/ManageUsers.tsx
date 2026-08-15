import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import CreateUserModal from "@/components/CreateUserModal";
import { useToast } from "@/components/ui/use-toast";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  storeId: string | null;
  isActive: boolean;
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
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<UserRow | null>(null);
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState<UserRow | null>(null);
  const [permanentDeleteInput, setPermanentDeleteInput] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

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

    const storedUser = localStorage.getItem("surgeops-user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUserId(parsed.id);
      } catch (err) {
        console.error("Failed to parse stored user:", err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  async function handleConfirmDeactivate() {
    if (!confirmDeactivate) return;
    const token = localStorage.getItem("surgeops-token");

    try {
      const res = await fetch(`${apiUrl}/users/${confirmDeactivate.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to deactivate user");
        setConfirmDeactivate(null);
        return;
      }

      const deactivatedName = confirmDeactivate.name;
      setConfirmDeactivate(null);
      fetchUsers();
      toast({ description: `${deactivatedName} was deactivated.` });
    } catch (err) {
      console.error(err);
      setError("Something went wrong while deactivating the user.");
      setConfirmDeactivate(null);
    }
  }

  async function handleReactivate(user: UserRow) {
    const token = localStorage.getItem("surgeops-token");

    try {
      const res = await fetch(`${apiUrl}/users/${user.id}/reactivate`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reactivate user");
        return;
      }

      fetchUsers();
      toast({ description: `${user.name} was reactivated.` });
    } catch (err) {
      console.error(err);
      setError("Something went wrong while reactivating the user.");
    }
  }

  async function handleConfirmPermanentDelete() {
    if (!confirmPermanentDelete) return;
    const token = localStorage.getItem("surgeops-token");

    try {
      const res = await fetch(`${apiUrl}/users/${confirmPermanentDelete.id}/permanent`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to permanently delete user");
        setConfirmPermanentDelete(null);
        setPermanentDeleteInput("");
        return;
      }

      const deletedName = confirmPermanentDelete.name;
      setConfirmPermanentDelete(null);
      setPermanentDeleteInput("");
      fetchUsers();
      toast({ description: `${deletedName} was permanently deleted.` });
    } catch (err) {
      console.error(err);
      setError("Something went wrong while deleting the user.");
      setConfirmPermanentDelete(null);
      setPermanentDeleteInput("");
    }
  }

  const nameMatches =
    confirmPermanentDelete && permanentDeleteInput.trim() === confirmPermanentDelete.name.trim();

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
                  <th className="py-3 px-5 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="py-3 px-5 font-medium text-muted-foreground text-right">
                    Actions
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
                    <td className="py-3 px-5">
                      {user.isActive ? (
                        <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-400">
                          Active
                        </span>
                      ) : (
                        <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-red-500/10 text-red-400">
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-white/[0.03] transition-colors"
                        >
                          Edit
                        </button>
                        {user.id !== currentUserId && user.isActive && (
                          <button
                            onClick={() => setConfirmDeactivate(user)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            Deactivate
                          </button>
                        )}
                        {user.id !== currentUserId && !user.isActive && (
                          <button
                            onClick={() => handleReactivate(user)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors"
                          >
                            Reactivate
                          </button>
                        )}
                        {user.id !== currentUserId && !user.isActive && (
                          <button
                            onClick={() => setConfirmPermanentDelete(user)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/90 text-white hover:bg-red-500 transition-colors"
                          >
                            Delete Permanently
                          </button>
                        )}
                      </div>
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
          onSaved={fetchUsers}
        />
      )}

      {editingUser && (
        <CreateUserModal
          onClose={() => setEditingUser(null)}
          onSaved={fetchUsers}
          editingUser={editingUser}
        />
      )}

      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-foreground mb-2">
              Deactivate {confirmDeactivate.name}?
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              They will no longer be able to log in. This can be reversed
              later if needed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="flex-1 py-2 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-white/[0.03] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeactivate}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-400 transition-colors"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPermanentDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-red-500/40 rounded-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-foreground mb-2">
              Permanently delete {confirmPermanentDelete.name}?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              This cannot be undone. Their account will be completely
              removed. Type their name below to confirm.
            </p>
            <p className="text-xs text-muted-foreground mb-1">
              Type <span className="font-semibold text-foreground">{confirmPermanentDelete.name}</span> to confirm
            </p>
            <input
              type="text"
              value={permanentDeleteInput}
              onChange={(e) => setPermanentDeleteInput(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-red-500 mb-5"
              placeholder="Type full name here"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setConfirmPermanentDelete(null);
                  setPermanentDeleteInput("");
                }}
                className="flex-1 py-2 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-white/[0.03] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPermanentDelete}
                disabled={!nameMatches}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}