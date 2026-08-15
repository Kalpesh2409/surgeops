import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface Store {
  id: string;
  name: string;
  city: string;
}

interface ExistingUser {
  id: string;
  name: string;
  email: string;
  role: string;
  storeId: string | null;
}

interface CreateUserModalProps {
  onClose: () => void;
  onSaved: () => void;
  editingUser?: ExistingUser | null;
}

export default function CreateUserModal({
  onClose,
  onSaved,
  editingUser,
}: CreateUserModalProps) {
  const isEditing = !!editingUser;

  const [name, setName] = useState(editingUser?.name || "");
  const [email, setEmail] = useState(editingUser?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(editingUser?.role || "STORE_MANAGER");
  const [storeId, setStoreId] = useState(editingUser?.storeId || "");
  const [stores, setStores] = useState<Store[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  // Load the list of stores once, so the Store dropdown has real options
  // instead of a hardcoded list.
  useEffect(() => {
    async function fetchStores() {
      try {
        const res = await fetch(`${apiUrl}/stores`);
        const data = await res.json();
        if (data.success) {
          setStores(data.data);
        }
      } catch (err) {
        console.error("Failed to load stores:", err);
      }
    }
    fetchStores();
  }, [apiUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name || !email || (!isEditing && !password)) {
      setError("Name and email are required.");
      return;
    }

    if (role === "STORE_MANAGER" && !storeId) {
      setError("Please assign a store for this Store Manager.");
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem("surgeops-token");

    try {
      const url = isEditing
        ? `${apiUrl}/users/${editingUser!.id}`
        : `${apiUrl}/users`;
      const method = isEditing ? "PATCH" : "POST";

      const payload: Record<string, unknown> = {
        name,
        email,
        role,
        storeId: role === "STORE_MANAGER" ? storeId : undefined,
      };
      if (!isEditing) {
        payload.password = password;
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save user.");
        setSubmitting(false);
        return;
      }

      onSaved();
      onClose();
      toast({
        description: isEditing
          ? `${name} was updated successfully.`
          : `${name} was created successfully.`,
      });
    } catch (err) {
      console.error(err);
      setError("Something went wrong while saving the user.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">
          {isEditing ? "Edit User" : "Create New User"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-sky-500"
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-sky-500"
              placeholder="name@example.com"
            />
          </div>

          {!isEditing && (
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-sky-500"
                placeholder="Temporary password"
              />
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground block mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-sky-500"
            >
              <option value="STORE_MANAGER">Store Manager</option>
              <option value="REGIONAL_MANAGER">Regional Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          {role === "STORE_MANAGER" && (
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                Assigned Store
              </label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-sky-500"
              >
                <option value="">Select a store</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} ({store.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-white/[0.03] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 rounded-lg bg-sky-500 text-black text-sm font-semibold hover:bg-sky-400 transition-colors disabled:opacity-50"
            >
              {submitting
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
