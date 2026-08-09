import { motion } from "framer-motion";
import PublicHeader from "../components/PublicHeader";
import Footer from "../components/Footer";

export default function About() {
  return (
    <div className="min-h-screen bg-neutral-950 p-3 md:p-6">
      <div className="border border-white/10 rounded-3xl bg-black text-white">
        <PublicHeader />

        <div className="pt-16 pb-24 px-6 max-w-3xl mx-auto space-y-20">
          {/* 1 — About SurgeOps */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="pt-16"
          >
            <h1 className="font-display text-4xl font-bold mb-4">
              About SurgeOps
            </h1>
            <p className="font-body text-gray-300 leading-relaxed">
              SurgeOps is a dynamic pricing and inventory management
              platform designed for multi-store grocery and quick-commerce
              businesses.
            </p>
          </motion.div>

          {/* 2 — The Real-World Problem */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h2 className="font-display text-2xl font-bold mb-4">
              The Real-World Problem
            </h2>
            <p className="font-body text-gray-300 leading-relaxed mb-4">
              Managing multiple stores is difficult. Imagine a grocery
              business owner has 4 stores — for example, in Pune, Mumbai,
              Nashik, and Delhi. Each store can have a different situation:
            </p>
            <ul className="font-body text-gray-300 space-y-2 mb-4 list-disc list-inside">
              <li>Store A is selling Coca-Cola very quickly.</li>
              <li>Store B has plenty of Coca-Cola in stock.</li>
              <li>Store C has low demand for the same product.</li>
              <li>Store D is experiencing a sudden rush.</li>
            </ul>
            <p className="font-body text-gray-300 leading-relaxed">
              If the owner manages everything manually, they have to
              constantly check: Orders → Demand → Inventory → Prices →
              Store performance. Doing this across multiple stores becomes
              difficult as the business grows.
            </p>
          </motion.div>

          {/* 3 — The Idea Behind SurgeOps */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h2 className="font-display text-2xl font-bold mb-4">
              The Idea Behind SurgeOps
            </h2>
            <p className="font-body text-gray-300 leading-relaxed mb-4">
              SurgeOps brings these operations into one platform. Instead
              of the owner checking every store separately, SurgeOps
              continuously monitors the available data and helps the
              operator understand:
            </p>
            <ul className="font-body text-gray-300 space-y-2 mb-4 list-disc list-inside">
              <li>What is selling?</li>
              <li>Where is demand increasing?</li>
              <li>Which products are running low?</li>
              <li>Which prices should change?</li>
            </ul>
            <p className="font-body text-gray-300 leading-relaxed">
              This gives the business operator a single view of what's
              happening across their stores.
            </p>
          </motion.div>
        </div>

        {/* 4 — Before/After diagram, full-width section with ambient glow */}
        <section className="relative w-full py-20 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-[120px]" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="text-center mb-12"
            >
              <h2 className="font-display text-2xl font-bold">
                The Transformation
              </h2>
            </motion.div>

            <div className="flex flex-col md:flex-row items-center gap-6">
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.4 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="flex-1 w-full bg-white/5 border border-red-500/20 rounded-2xl p-8"
              >
                <div className="text-3xl mb-3">😵‍💫</div>
                <p className="font-display font-semibold text-red-400 mb-5 text-lg">
                  Before SurgeOps
                </p>
                <div className="font-body text-sm text-gray-400 space-y-3">
                  <p>Store 1 → Check manually</p>
                  <p>Store 2 → Check manually</p>
                  <p>Store 3 → Check manually</p>
                  <p>Store 4 → Check manually</p>
                </div>
                <div className="border-t border-white/10 mt-5 pt-5">
                  <p className="text-gray-300 font-medium">
                    Owner has to monitor everything
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: false, amount: 0.6 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-sky-400 text-3xl font-bold rotate-90 md:rotate-0"
              >
                →
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.4 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="flex-1 w-full bg-white/5 border border-green-500/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(74,222,128,0.08)]"
              >
                <div className="text-3xl mb-3">✨</div>
                <p className="font-display font-semibold text-green-400 mb-5 text-lg">
                  With SurgeOps
                </p>
                <div className="font-body text-sm text-gray-300 space-y-2 text-center">
                  <p className="font-semibold">4 Stores</p>
                  <p className="text-gray-600">↓</p>
                  <p className="text-sky-400 font-bold">SurgeOps</p>
                  <p className="text-gray-600">↓</p>
                  <p>Demand + Inventory</p>
                  <p className="text-gray-600">↓</p>
                  <p>Pricing Engine</p>
                  <p className="text-gray-600">↓</p>
                  <p className="font-semibold">Manager Dashboard</p>
                </div>
              </motion.div>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="font-display text-xl font-semibold text-center mt-14"
            >
              One platform. Multiple stores. Real-time visibility.
            </motion.p>
          </div>
        </section>

        <div className="px-6 max-w-3xl mx-auto space-y-20 pb-24">
          {/* 5 — What SurgeOps is trying to demonstrate */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h2 className="font-display text-2xl font-bold mb-4">
              What SurgeOps Is Trying to Demonstrate
            </h2>
            <p className="font-body text-gray-300 leading-relaxed">
              SurgeOps was built to explore how modern software systems can
              help solve this operational problem by combining machine
              learning, real-time event processing, automated pricing
              logic, inventory data, and a live management dashboard.
            </p>
          </motion.div>

          {/* 6 — Built By */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="bg-white/5 border border-white/10 rounded-xl p-8 text-center"
          >
            <p className="font-display text-lg font-semibold mb-2">
              Built by Kalpesh Wahurwagh
            </p>
            <p className="font-body text-gray-400 text-sm leading-relaxed">
              SurgeOps is a hands-on engineering project focused on
              building a production-style system using modern full-stack,
              backend, machine-learning, and real-time technologies.
            </p>
          </motion.div>
        </div>

        <Footer />
      </div>
    </div>
  );
}