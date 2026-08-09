import { motion } from "framer-motion";

export default function ProblemSolution() {
  return (
    <section className="w-full bg-black text-white px-6 py-24">
      <div className="max-w-3xl mx-auto space-y-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <h2 className="font-display text-3xl font-bold mb-4">The Problem</h2>
          <p className="font-body text-gray-300 leading-relaxed">
            Quick-commerce businesses face two major pricing challenges: they
            can lose revenue by selling products too cheaply during periods
            of high demand, or lose money when slow-moving inventory remains
            unsold. Managing prices manually across multiple stores and many
            products is difficult and time-consuming.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
        >
          <h2 className="font-display text-3xl font-bold mb-4">The Solution</h2>
          <p className="font-body text-gray-300 leading-relaxed">
            SurgeOps is an AI-powered dynamic pricing and inventory
            management platform. It combines machine learning with
            real-time demand and inventory signals to recommend and adjust
            product prices for each store. This allows businesses to
            respond to changing demand automatically while keeping prices
            within defined business and MRP limits.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="bg-white/5 border border-white/10 rounded-xl p-6"
        >
          <h3 className="font-display text-xl font-semibold mb-3">Example</h3>
          <p className="font-body text-gray-300 leading-relaxed">
            For example, if Coca-Cola normally sells for ₹40 but demand
            suddenly increases, SurgeOps can detect the increase and adjust
            the price. If demand falls, it can reduce the price to
            encourage sales. The system continuously monitors these changes
            and updates the dashboard in real time.
          </p>
        </motion.div>
      </div>
    </section>
  );
}