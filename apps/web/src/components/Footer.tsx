export default function Footer() {
  return (
    <footer className="w-full bg-black text-white border-t border-white/10 px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8">
          <div className="text-center md:text-left">
            <p className="font-display text-lg font-bold text-white mb-1">
              SurgeOps
            </p>
            <p className="font-body text-sm text-gray-500">
              Dynamic pricing for quick-commerce, built to scale.
            </p>
          </div>

          <a
            href="https://github.com/Kalpesh2409/surgeops"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-white/10 hover:border-white/30 rounded-lg px-4 py-2 transition-colors group"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-gray-400 group-hover:text-white transition-colors"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.535-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.655 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span className="font-body text-sm text-gray-400 group-hover:text-white transition-colors">
              View on GitHub
            </span>
          </a>
        </div>

        <div className="border-t border-white/10 pt-6">
          <p className="font-body text-xs text-gray-600 text-center">
            © 2026 SurgeOps. Built by Kalpesh Wahurwagh. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}