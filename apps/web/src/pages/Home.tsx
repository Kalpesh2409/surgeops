import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
import Hero from "../components/Hero";
import ProblemSolution from "../components/ProblemSolution";
import HowPricingWorks from "../components/HowPricingWorks";
import SeeSurgeOpsInAction from "../components/SeeSurgeOpsInAction";
import TechStack from "../components/TechStack";
import Footer from "../components/Footer";

export default function Home() {
  const location = useLocation();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const loggedOut = (location.state as { loggedOut?: boolean } | null)
      ?.loggedOut;

    if (loggedOut) {
      setShowToast(true);
      window.history.replaceState({}, document.title);

      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  return (
    <div className="w-full bg-black relative">
      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-green-500 text-black text-sm font-semibold px-5 py-2.5 rounded-lg shadow-lg">
          Logged out successfully
        </div>
      )}

      <PublicHeader />
      <Hero />
      <ProblemSolution />
      <HowPricingWorks />
      <SeeSurgeOpsInAction />
      <TechStack />
      <Footer />
    </div>
  );
}