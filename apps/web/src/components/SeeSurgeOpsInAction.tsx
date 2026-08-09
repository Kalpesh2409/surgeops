import { motion } from "framer-motion";
import { useEffect, useState } from "react";

type Side = "left" | "right";

function TimelineStep({
  side,
  children,
}: {
  side: Side;
  children: React.ReactNode;
}) {
  const isLeft = side === "left";

  return (
    <div className="relative flex items-center justify-center mb-16 md:mb-24">
      {/* Center line dot for this step */}
      <div className="hidden md:block absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-sky-400 z-10" />

      <div
        className={`w-full md:w-1/2 flex ${
          isLeft ? "md:justify-end md:pr-12" : "md:order-2 md:justify-start md:pl-12"
        }`}
      >
        <motion.div
          initial={{ opacity: 0, x: isLeft ? -60 : 60 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false, amount: 0.6 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative z-10 bg-white/5 border border-white/10 rounded-xl p-6 max-w-md w-full"
        >
          {children}
        </motion.div>
      </div>

      {/* Empty spacer for the other side on desktop */}
      <div className={`hidden md:block w-1/2 ${isLeft ? "md:order-2" : ""}`} />
    </div>
  );
}

function LiveDemandCounter() {
  const [count, setCount] = useState(8);

  useEffect(() => {
    const target = 11;
    const interval = setInterval(() => {
      setCount((c) => (c < target ? c + 1 : c));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return <span className="text-2xl font-bold text-sky-400">{count}</span>;
}

export default function SeeSurgeOpsInAction() {
  return (
    <section className="relative w-full bg-black text-white px-6 py-24 overflow-hidden">
      {/* Soft ambient glow, purely decorative, no animation */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-sky-400/5 rounded-full blur-[100px]" />

        {/* Faint static dots for texture */}
        <div className="absolute top-[10%] left-[15%] w-1 h-1 bg-sky-400/40 rounded-full" />
        <div className="absolute top-[25%] right-[20%] w-1 h-1 bg-sky-400/30 rounded-full" />
        <div className="absolute top-[45%] left-[8%] w-1.5 h-1.5 bg-sky-400/20 rounded-full" />
        <div className="absolute top-[60%] right-[12%] w-1 h-1 bg-sky-400/30 rounded-full" />
        <div className="absolute top-[75%] left-[25%] w-1 h-1 bg-sky-400/25 rounded-full" />
        <div className="absolute top-[90%] right-[30%] w-1.5 h-1.5 bg-sky-400/20 rounded-full" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center mb-4"
        >
          <h2 className="text-3xl font-bold mb-3">See SurgeOps in Action</h2>
          <p className="text-gray-400 max-w-lg mx-auto">
            Follow a single customer order from purchase to a live pricing
            decision — and see how SurgeOps reacts in real time.
          </p>
          <p className="text-gray-600 text-xs mt-3 italic">
            Demo visualization — illustrates the real pricing flow using a
            scripted example.
          </p>
        </motion.div>

        {/* Center vertical line spanning the whole timeline (desktop only) */}
        <div className="relative">
          <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-white/10" />

          <div className="pt-16">
            {/* Step 1 — Customer Website */}
            <TimelineStep side="left">
              <p className="text-gray-400 text-sm mb-3">QuickCart</p>
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">Coca-Cola</span>
                <span className="text-sky-400 font-bold">₹40.00</span>
              </div>
              <div className="bg-sky-500 text-black text-center rounded-md py-2 text-sm font-semibold">
                Add to Cart
              </div>
              <p className="text-green-400 text-sm mt-3">✓ Product added to cart</p>
            </TimelineStep>

            {/* Step 2 — Order Placed */}
            <TimelineStep side="right">
              <p className="text-gray-400 text-sm mb-3">Order #1042</p>
              <div className="flex items-center justify-between mb-3 text-sm">
                <span>Coca-Cola × 1</span>
                <span className="text-sky-400 font-bold">₹40.00</span>
              </div>
              <div className="bg-sky-500 text-black text-center rounded-md py-2 text-sm font-semibold">
                Place Order
              </div>
              <p className="text-green-400 text-sm mt-3">✓ Order placed successfully</p>
            </TimelineStep>

            {/* Step 3 — API Receives Order */}
            <TimelineStep side="left">
              <p className="font-semibold mb-3">SurgeOps API</p>
              <p className="text-gray-500 text-xs font-mono mb-3">POST /orders</p>
              <p className="text-green-400 text-sm">✓ Order received</p>
              <p className="text-green-400 text-sm">✓ Inventory updated</p>
            </TimelineStep>

            {/* Step 4 — Live Demand Changes */}
            <TimelineStep side="right">
              <p className="font-semibold mb-3">⚡ Live Demand</p>
              <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                <span>Previous</span>
                <span>8 orders</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-gray-400">Current</span>
                <LiveDemandCounter />
              </div>
              <p className="text-yellow-400 text-sm">Demand is increasing</p>
            </TimelineStep>

            {/* Step 5 — ML Baseline */}
            <TimelineStep side="left">
              <p className="font-semibold mb-3">🧠 ML Demand Prediction</p>
              <p className="text-gray-400 text-sm mb-3">
                Historical sales patterns indicate higher demand.
              </p>
              <p className="text-sky-400 font-bold text-lg">
                ML baseline price: ₹42.00
              </p>
            </TimelineStep>

            {/* Step 6 — Live Pricing Adjustment */}
            <TimelineStep side="right">
              <p className="font-semibold mb-3">⚡ Dynamic Pricing Engine</p>
              <div className="text-sm text-gray-400 space-y-1 mb-3">
                <p>ML baseline: ₹42.00</p>
                <p>Live demand adjustment: +₹2.00</p>
              </div>
              <p className="text-sky-400 font-bold text-lg">
                Calculated price: ₹44.00
              </p>
            </TimelineStep>

            {/* Step 7 — MRP Guardrail */}
            <TimelineStep side="left">
              <p className="font-semibold mb-3">🛡️ MRP Guardrail</p>
              <div className="text-sm text-gray-400 space-y-1 mb-3">
                <p>Calculated price: ₹44.00</p>
                <p>Maximum Retail Price: ₹50.00</p>
              </div>
              <p className="text-green-400 text-sm mb-4">✓ Price allowed</p>

              <div className="border-t border-white/10 pt-4 text-sm text-gray-500">
                <p>If demand were higher:</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="line-through text-red-400">₹55</span>
                  <span>❌</span>
                  <span className="mx-2">→</span>
                  <span className="text-green-400 font-semibold">₹50</span>
                  <span>✓</span>
                </div>
              </div>
            </TimelineStep>

            {/* Step 8 — SSE Update */}
            <TimelineStep side="right">
              <p className="font-semibold mb-3">📡 Live Price Update</p>
              <p className="text-gray-400 text-sm mb-2">
                SurgeOps → Store Manager Dashboard
              </p>
              <p className="text-gray-500 text-xs font-mono">SSE connection</p>
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                whileInView={{ x: 20, opacity: [0, 1, 0] }}
                viewport={{ once: false, amount: 0.6 }}
                transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.5 }}
                className="w-2 h-2 rounded-full bg-sky-400 mt-4"
              />
            </TimelineStep>

            {/* Step 9 — Dashboard Update */}
            <TimelineStep side="left">
              <p className="font-semibold mb-3">Coca-Cola</p>
              <div className="text-sm text-gray-400 space-y-1 mb-3">
                <p>Base Price: ₹40.00</p>
                <p className="text-sky-400 font-bold text-base">
                  Live Price: ₹44.00
                </p>
              </div>
              <span className="inline-block bg-yellow-500/20 text-yellow-400 text-xs px-3 py-1 rounded-full mb-3">
                🟡 Elevated Demand
              </span>
              <p className="text-green-400 text-sm">Updated automatically</p>
            </TimelineStep>
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.5 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center text-gray-400 max-w-lg mx-auto mt-4"
        >
          One order can change demand. SurgeOps turns that signal into a
          controlled pricing decision — and delivers the update to
          operations instantly.
        </motion.p>
      </div>
    </section>
  );
}