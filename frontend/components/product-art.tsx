export function ProductArt({
  kind,
  className = "",
}: {
  kind: string;
  className?: string;
}) {
  return (
    <div className={`product-art ${className}`} aria-hidden="true">
      <svg viewBox="0 0 320 250" fill="none">
        <ellipse
          cx="160"
          cy="213"
          rx="87"
          ry="10"
          fill="#332b24"
          opacity=".1"
        />
        {kind === "case" ? (
          <>
            <path
              d="M80 75 Q80 62 95 60 L217 48 Q230 47 234 63 L250 179 Q252 193 237 195 L109 209 Q94 210 92 195Z"
              fill="#73634f"
            />
            <path d="M91 78 L220 63 L236 181 L105 197Z" fill="#a99276" />
            <path d="M95 88 L223 73" stroke="#423d34" strokeWidth="3" />
            <path
              d="M102 96 L225 81 M111 188 L230 173"
              stroke="#d8c2a4"
              strokeDasharray="3 4"
            />
            <rect
              x="140"
              y="122"
              width="48"
              height="27"
              rx="3"
              transform="rotate(-7 140 122)"
              fill="#6a5642"
            />
            <path d="M150 134 L177 131" stroke="#e5cfb1" strokeWidth="2" />
          </>
        ) : kind === "brush" ? (
          <>
            <path
              d="M102 200 L212 65"
              stroke="#b59a7c"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M188 90 L217 54"
              stroke="#d8cbb5"
              strokeWidth="29"
              strokeLinecap="round"
            />
            <path
              d="M195 78 L214 57 M204 83 L225 61 M185 73 L205 49"
              stroke="#8e7860"
              strokeWidth="2"
            />
            <path d="M111 190 L162 128" stroke="#6f5e4d" strokeWidth="2" />
          </>
        ) : kind === "stand" ? (
          <>
            <path d="M76 158 L173 126 L252 162 L152 200Z" fill="#ac8966" />
            <path
              d="M76 158 L152 189 L252 153 L252 170 L152 207 L76 177Z"
              fill="#77583f"
            />
            <path
              d="M115 151 L107 85 Q110 74 121 78 L137 142 M190 143 L180 68 Q183 57 195 62 L213 151"
              fill="#9d7753"
              stroke="#6b4d36"
              strokeWidth="3"
            />
            <path
              d="M91 169 L149 194 M112 162 L158 182"
              stroke="#c59d76"
              strokeWidth="2"
            />
          </>
        ) : (
          <>
            <ellipse
              cx="161"
              cy="127"
              rx="69"
              ry="55"
              transform="rotate(-24 161 127)"
              fill="#514d46"
            />
            <ellipse
              cx="160"
              cy="117"
              rx="69"
              ry="55"
              transform="rotate(-24 160 117)"
              fill="#8d8980"
            />
            <ellipse
              cx="160"
              cy="116"
              rx="39"
              ry="30"
              transform="rotate(-24 160 116)"
              fill="#ece6dc"
            />
            <path
              d="M107 97 Q134 60 174 66"
              stroke="#b7b2a8"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </div>
  );
}

export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="art-grid" />
      <div className="art-caption" dir="ltr">
        THE RIGHT FIT.
        <br />
        <span>PRECISION IN EVERY DETAIL</span>
      </div>
      <div className="assembly">
        <div className="assembly-ring ring-one" />
        <div className="assembly-ring ring-two" />
        <div className="assembly-ring ring-three" />
        <div className="assembly-axis" />
      </div>
      <div className="art-label label-one">
        <span>۰۱</span> اندازه دقیق
      </div>
      <div className="art-label label-two">
        <span>۰۲</span> اتصال سازگار
      </div>
      <div className="art-bottom">
        <span>قطعات، در کنار هم.</span>
        <span dir="ltr">FORM / FIT / FUNCTION</span>
      </div>
    </div>
  );
}
