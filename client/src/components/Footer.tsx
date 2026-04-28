/* ─────────────────────────────────────────────────────────────────────────
   GMI CLAW MARKETPLACE — Footer Component
   Design: Cyber Industrial Terminal
   - 1px borders, Geist Mono, #DDEA4D accent, Pure Black
   ───────────────────────────────────────────────────────────────────────── */

export default function Footer() {
  return (
    <footer
      style={{
        background: "#000000",
        borderTop: "1px solid #222222",
        fontFamily: "'GeistMono', monospace",
      }}
    >
      {/* Top grid row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          borderBottom: "1px solid #1a1a1a",
        }}
      >
        {/* Brand column */}
        <div
          style={{
            padding: "2rem",
            borderRight: "1px solid #1a1a1a",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
            <div
              style={{
                width: "20px",
                height: "20px",
                background: "#DDEA4D",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "0.5rem",
                  color: "#000000",
                  fontWeight: 400,
                }}
              >
                G
              </span>
            </div>
            <span
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "0.5625rem",
                color: "#ffffff",
                letterSpacing: "0.05em",
              }}
            >
              GMI <span style={{ color: "#DDEA4D" }}>CLAW</span>
            </span>
          </div>
          <p
            style={{
              fontSize: "0.5625rem",
              color: "#444444",
              lineHeight: 1.7,
              maxWidth: "200px",
              letterSpacing: "0.03em",
            }}
          >
            The AI Claw marketplace. Built on{" "}
            <a
              href="https://gmi.ai"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#DDEA4D", textDecoration: "none" }}
            >
              GMI Cloud
            </a>{" "}
            infrastructure.
          </p>
          <div
            style={{
              marginTop: "1.25rem",
              fontSize: "0.5rem",
              color: "#333333",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            © 2026 GMI Cloud, Inc.
          </div>
        </div>

        {/* Product column */}
        <div style={{ padding: "2rem", borderRight: "1px solid #1a1a1a" }}>
          <div
            style={{
              fontSize: "0.5rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#DDEA4D",
              marginBottom: "1rem",
              paddingBottom: "0.5rem",
              borderBottom: "1px solid #1a1a1a",
            }}
          >
            PRODUCT
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {["Marketplace", "Developer Toolkit", "Cluster Engine"].map((item) => (
              <li key={item}>
                <span
                  style={{
                    fontSize: "0.5625rem",
                    color: "#444444",
                    cursor: "pointer",
                    letterSpacing: "0.03em",
                    transition: "color 0.1s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#aaaaaa")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#444444")}
                >
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Developers column */}
        <div style={{ padding: "2rem", borderRight: "1px solid #1a1a1a" }}>
          <div
            style={{
              fontSize: "0.5rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#DDEA4D",
              marginBottom: "1rem",
              paddingBottom: "0.5rem",
              borderBottom: "1px solid #1a1a1a",
            }}
          >
            DEVELOPERS
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {["Documentation", "SDK Reference", "API Playground", "GitHub"].map((item) => (
              <li key={item}>
                <span
                  style={{
                    fontSize: "0.5625rem",
                    color: "#444444",
                    cursor: "pointer",
                    letterSpacing: "0.03em",
                    transition: "color 0.1s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#aaaaaa")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#444444")}
                >
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Company column */}
        <div style={{ padding: "2rem" }}>
          <div
            style={{
              fontSize: "0.5rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#DDEA4D",
              marginBottom: "1rem",
              paddingBottom: "0.5rem",
              borderBottom: "1px solid #1a1a1a",
            }}
          >
            COMPANY
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[
              { label: "About GMI", href: "https://gmi.ai/about" },
              { label: "Blog", href: "https://gmi.ai/blog" },
              { label: "Careers", href: "https://gmi.ai/careers" },
              { label: "Contact", href: "https://gmi.ai/contact" },
            ].map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "0.5625rem",
                    color: "#444444",
                    textDecoration: "none",
                    letterSpacing: "0.03em",
                    transition: "color 0.1s ease",
                    display: "block",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#aaaaaa")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#444444")}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 2rem",
        }}
      >
        <div
          style={{
            fontSize: "0.5rem",
            color: "#333333",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          POWERED BY GMI CLUSTER ENGINE · v2.0
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          {["Privacy Policy", "Terms of Service", "Security"].map((item) => (
            <span
              key={item}
              style={{
                fontSize: "0.5rem",
                color: "#333333",
                cursor: "pointer",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                transition: "color 0.1s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#888888")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#333333")}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
