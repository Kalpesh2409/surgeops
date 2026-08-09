import { Link } from "react-router-dom";

export default function PublicHeader() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-black/70 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="font-display text-lg font-bold text-white">
          SurgeOps
        </span>

        <nav className="flex items-center gap-8">
          <button
            onClick={scrollToTop}
            className="font-body text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            Home
          </button>
          <Link
            to="/about"
            className="font-body text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
