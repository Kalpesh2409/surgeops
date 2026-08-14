import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface StoreRevenue {
  storeId: string;
  storeName: string;
  city: string;
  revenue: number;
}

interface ProductStat {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: number;
}

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  bestStore: StoreRevenue | null;
  topProduct: ProductStat | null;
  topProducts: ProductStat[];
  revenueByStore: StoreRevenue[];
}

const STORE_COLORS = ["#38bdf8", "#4ade80", "#a78bfa", "#fb923c"];

function formatRupees(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function SalesAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  useEffect(() => {
    async function fetchAnalytics() {
      const token = localStorage.getItem("surgeops-token");

      try {
        const res = await fetch(`${apiUrl}/analytics/sales`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!res.ok) {
          setError(json.error || "Failed to load analytics");
          return;
        }

        setData(json);
      } catch (err) {
        console.error(err);
        setError("Something went wrong while loading analytics.");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [apiUrl]);

  const totalStoreRevenue =
    data?.revenueByStore.reduce((sum, s) => sum + s.revenue, 0) || 0;

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          Sales Analytics
        </h1>
        <p className="text-muted-foreground text-sm mb-6">All-time totals</p>

        {loading && <p className="text-muted-foreground">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="border border-border rounded-xl bg-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center text-lg">
                    💰
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Total Revenue
                  </p>
                </div>
                <p className="text-foreground text-2xl font-bold">
                  {formatRupees(data.totalRevenue)}
                </p>
              </div>

              <div className="border border-border rounded-xl bg-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center text-lg">
                    🛒
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Total Orders
                  </p>
                </div>
                <p className="text-foreground text-2xl font-bold">
                  {data.totalOrders}
                </p>
              </div>

              <div className="border border-border rounded-xl bg-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center text-lg">
                    🏬
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Best-Performing Store
                  </p>
                </div>
                <p className="text-foreground text-lg font-bold">
                  {data.bestStore ? data.bestStore.storeName : "—"}
                </p>
                {data.bestStore && (
                  <p className="text-green-500 text-xs mt-1">
                    {formatRupees(data.bestStore.revenue)}
                  </p>
                )}
              </div>

              <div className="border border-border rounded-xl bg-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-lg">
                    📦
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Top Product
                  </p>
                </div>
                <p className="text-foreground text-lg font-bold">
                  {data.topProduct ? data.topProduct.productName : "—"}
                </p>
                {data.topProduct && (
                  <p className="text-sky-400 text-xs mt-1">
                    {data.topProduct.unitsSold} units sold
                  </p>
                )}
              </div>
            </div>

            {/* Revenue by store — donut chart */}
            <div className="border border-border rounded-xl bg-card p-6 mb-8">
              <h2 className="text-foreground font-semibold mb-4">
                Revenue by Store
              </h2>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-full md:w-64 h-64 relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.revenueByStore}
                        dataKey="revenue"
                        nameKey="storeName"
                        innerRadius={65}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {data.revenueByStore.map((_, i) => (
                          <Cell
                            key={i}
                            fill={STORE_COLORS[i % STORE_COLORS.length]}
                            stroke="none"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#111",
                          border: "1px solid #262626",
                          borderRadius: 8,
                          fontSize: 13,
                        }}
                        formatter={(value: any) => formatRupees(Number(value))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-muted-foreground text-xs">
                      Total Revenue
                    </p>
                    <p className="text-foreground font-bold text-lg">
                      {formatRupees(totalStoreRevenue)}
                    </p>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-3">
                  {data.revenueByStore.map((store, i) => {
                    const pct = totalStoreRevenue
                      ? ((store.revenue / totalStoreRevenue) * 100).toFixed(1)
                      : "0";
                    return (
                      <div
                        key={store.storeId}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              background:
                                STORE_COLORS[i % STORE_COLORS.length],
                            }}
                          />
                          <span className="text-foreground">
                            {store.storeName}
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          {formatRupees(store.revenue)} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Top products table */}
            <div className="border border-border rounded-xl bg-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-foreground font-semibold">
                  Top Selling Products
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left bg-white/[0.03] border-b border-border">
                    <th className="py-3 px-6 font-medium text-muted-foreground">
                      #
                    </th>
                    <th className="py-3 px-6 font-medium text-muted-foreground">
                      Product
                    </th>
                    <th className="py-3 px-6 font-medium text-muted-foreground">
                      Units Sold
                    </th>
                    <th className="py-3 px-6 font-medium text-muted-foreground">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((product, i) => (
                    <tr
                      key={product.productId}
                      className="border-b border-border last:border-0 hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-3 px-6 text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="py-3 px-6 text-foreground font-medium">
                        {product.productName}
                      </td>
                      <td className="py-3 px-6 text-muted-foreground">
                        {product.unitsSold}
                      </td>
                      <td className="py-3 px-6 text-green-500 font-medium">
                        {formatRupees(product.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}