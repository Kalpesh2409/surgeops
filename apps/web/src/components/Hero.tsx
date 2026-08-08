import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Hero3D from "./Hero3D";

export default function Hero() {
  return (
    <section className="relative w-full h-screen bg-black overflow-hidden">
      <div className="absolute inset-0">
        <Hero3D />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-4xl md:text-6xl font-bold text-white mb-4"
        >
          Pricing That Thinks Ahead
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="text-lg md:text-xl text-gray-300 max-w-2xl mb-8"
        >
          SurgeOps watches demand and stock across your dark stores in real
          time, and adjusts prices automatically - so you never sell too
          cheap or sit on dead stock.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
        >
          <Link
            to="/login"
            className="inline-block bg-sky-500 hover:bg-sky-400 text-black font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Staff Login
          </Link>
        </motion.div>
      </div>
    </section>
  );
}