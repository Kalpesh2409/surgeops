import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

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
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome, {user ? user.name : "..."}
        </h1>
      </div>
    </div>
  );
}