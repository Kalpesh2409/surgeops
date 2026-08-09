import { Link, useLocation, useNavigate } from "react-router-dom";

export default function PublicHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleHomeClick = () => {
    if (location.pathname === "/preview-3d") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/preview-3d");
    }
  };

  return (
    <header className="sticky top-0 left-0 w-full z-50 bg-black/70 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="font-display text-lg font-bold text-white">
          SurgeOps
        </span>

        <nav className="flex items-center gap-8">
          <button
            onClick={handleHomeClick}
            className="font-body text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            Home
          </button>
          <Link
            to="/about"
            className="font-body text-sm text-gray-400 hover:text-white transition-colors"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}