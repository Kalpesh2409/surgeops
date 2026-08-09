import PublicHeader from "../components/PublicHeader";
import Hero from "../components/Hero";
import ProblemSolution from "../components/ProblemSolution";
import HowPricingWorks from "../components/HowPricingWorks";
import SeeSurgeOpsInAction from "../components/SeeSurgeOpsInAction";
import TechStack from "../components/TechStack";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div className="w-full bg-black">
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