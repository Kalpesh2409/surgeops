import { motion } from "framer-motion";

const steps = [
  {
    icon: "🧠",
    tag: "01",
    title: "Learns from Historical Demand",
    text: "Machine Learning analyzes previous sales to understand how each product normally behaves. It considers patterns such as when demand is typically high or low and uses them to establish a baseline price for the current situation.",
  },
  {
    icon: "⚡",
    tag: "02",
    title: "Responds to Real-Time Demand",
    text: "SurgeOps continuously monitors current demand and inventory conditions. When a product suddenly becomes popular or stock becomes limited, the pricing engine can increase the price. When demand is weak and inventory is moving slowly, it can reduce the price to encourage sales.",
  },
  {
    icon: "🛡️",
    tag: "03",
    title: "Protected by Pricing Guardrails",
    text: "Every price passes through business and legal safety checks before it becomes the final price. Most importantly, the system can never charge more than the product's MRP (Maximum Retail Price), even when demand is extremely high.",
  },
];

const flow = [
  { label: "Normal Price", value: "₹40", state: "neutral" },
  { label: "ML Baseline", value: "₹44", state: "neutral" },
  { label: "Demand increases", value: "₹48", state: "neutral" },
  { label: "Demand increases further", value: "₹55", state: "blocked" },
  { label: "MRP Guardrail", value: "₹50", state: "allowed" },
];

export default function HowPricingWorks() {
  return (
    <section className="w-full bg-black text-white px-6 py-16 md:py-24">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center mb-10 md:mb-16"
        >
          <h2 className="font-display text-3xl font-bold mb-2">How SurgeOps Pricing Works</h2>
          <p className="font-body text-gray-400 max-w-2xl mx-auto">
            Every price is calculated using three layers: historical
            patterns, real-time demand, and pricing safety rules.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.15, ease: "easeOut" }}
              whileHover={{
                scale: 1.04,
                y: -4,
                boxShadow: "0 0 25px rgba(56,189,248,0.35)",
              }}
              className="bg-white/5 border border-white/10 rounded-xl p-6 cursor-pointer"
            >
              <div className="text-3xl mb-3">{step.icon}</div>
              <p className="font-body text-sky-400 text-sm font-semibold mb-1">{step.tag}</p>
              <h3 className="font-display text-lg font-semibold mb-2">{step.title}</h3>
              <p className="font-body text-gray-300 text-sm leading-relaxed">{step.text}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="bg-white/5 border border-white/10 rounded-xl p-10 max-w-3xl mx-auto"
        >
          <p className="font-body text-red-400 font-semibold mb-1">🔴 See It Happen</p>
          <p className="font-body text-gray-400 mb-8">
            Coca-Cola — Base Price ₹40 | MRP ₹50
          </p>

          <div className="flex flex-col items-center gap-2">
            {flow.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.6 }}
                transition={{ duration: 0.5, delay: i * 0.3, ease: "easeOut" }}
                className="flex flex-col items-center"
              >
                <div
                  className={`flex items-center gap-3 px-5 py-2 rounded-lg border ${
                    step.state === "blocked"
                      ? "border-red-500/50 bg-red-500/10"
                      : step.state === "allowed"
                      ? "border-green-500/50 bg-green-500/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <span className="font-body text-gray-300 text-sm">{step.label}</span>
                  <span
                    className={`font-body font-bold ${
                      step.state === "blocked"
                        ? "text-red-400 line-through"
                        : step.state === "allowed"
                        ? "text-green-400"
                        : "text-sky-400"
                    }`}
                  >
                    {step.value}
                  </span>
                  {step.state === "blocked" && <span>❌</span>}
                  {step.state === "allowed" && <span>✅</span>}
                </div>
                {i < flow.length - 1 && (
                  <span className="text-gray-600 text-xl">↓</span>
                )}
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false, amount: 0.6 }}
            transition={{ duration: 0.6, delay: flow.length * 0.3 + 0.2 }}
            className="text-center mt-8"
          >
            <p className="font-display text-2xl font-bold text-green-400 mb-2">
              Final Price: ₹50
            </p>
            <p className="font-body text-gray-400 text-sm max-w-md mx-auto">
              Demand pushed the calculated price higher, but the MRP
              guardrail stopped it at ₹50.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}