import { motion } from "framer-motion";

const stack = [
  {
    icon: "🟢",
    name: "Node.js + Express",
    text: "API server handling requests and business logic.",
  },
  {
    icon: "🔷",
    name: "TypeScript",
    text: "Type-safe code across the whole stack.",
  },
  {
    icon: "🐍",
    name: "Python + FastAPI",
    text: "Machine learning service for demand prediction.",
  },
  {
    icon: "🐘",
    name: "PostgreSQL",
    text: "Stores products, orders, pricing rules, and users.",
  },
  {
    icon: "🔴",
    name: "Redis",
    text: "Caching and fast real-time data access.",
  },
  {
    icon: "⚛️",
    name: "React",
    text: "The interactive dashboard and this website.",
  },
];

export default function TechStack() {
  return (
    <section className="w-full bg-black text-white px-6 py-24">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl font-bold mb-2">
            Built With a Real Production Stack
          </h2>
          <p className="font-body text-gray-400 max-w-2xl mx-auto">
            No shortcuts — SurgeOps runs on the same kind of stack used by
            real production systems.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {stack.map((tech, i) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
              whileHover={{
                scale: 1.03,
                y: -3,
                boxShadow: "0 0 20px rgba(56,189,248,0.25)",
              }}
              className="bg-white/5 border border-white/10 rounded-xl p-6 cursor-pointer"
            >
              <div className="text-3xl mb-3">{tech.icon}</div>
              <h3 className="font-display text-lg font-semibold mb-1">
                {tech.name}
              </h3>
              <p className="font-body text-gray-400 text-sm leading-relaxed">
                {tech.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}