import { useEffect, useState } from "react";

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: string;
  storeId: string | null;
}

export default function AdminDashboard() {
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("surgeops-user");
    if (raw) {
      setUser(JSON.parse(raw));
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <h1 className="text-2xl font-bold text-foreground">
        Welcome, {user ? user.name : "..."}
      </h1>
    </div>
  );
}