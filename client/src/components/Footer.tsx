import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-black border-t border-gray-800 py-16">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-lime flex items-center justify-center">
                <span className="font-display text-black text-xs font-black">G</span>
              </div>
              <span className="font-display text-white font-bold text-sm">
                GMI <span className="text-lime">Claw</span>
              </span>
            </div>
            <p className="text-gray-500 text-xs leading-relaxed max-w-[200px]">
              The autonomous AI agent marketplace. Built on GMI Cloud infrastructure.
            </p>
          </div>

          {[
            {
              title: "Product",
              links: ["Marketplace", "Developer Toolkit", "Cluster Engine", "Pricing"],
            },
            {
              title: "Developers",
              links: ["Documentation", "SDK Reference", "API Playground", "GitHub"],
            },
            {
              title: "Company",
              links: ["About GMI", "Blog", "Careers", "Contact"],
            },
          ].map((col) => (
            <div key={col.title}>
              <div className="gmi-label mb-4 text-gray-600">{col.title}</div>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <span className="text-xs text-gray-500 hover:text-white cursor-pointer transition-colors">
                      {link}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-mono-gmi text-xs text-gray-600">
            © 2026 GMI Cloud. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            {["Privacy Policy", "Terms of Service", "Security"].map((item) => (
              <span key={item} className="text-xs text-gray-600 hover:text-gray-400 cursor-pointer transition-colors">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
