import React from "react";

export function cleanText(t) {
  if (!t) return "";
  return String(t)
    .replace(/■/g, "-")
    .replace(/\u25a0/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-");
}

export function parseInlineMarkdown(text) {
  const cleaned = cleanText(text);

  // Match bold (**text**), citations ([Guideline: ...], [Web: ...], [Source: ...]), and italics (*text*)
  const tokenRegex = /(\*\*.*?\*\*|\[(?:Guideline|Web|Source):?\s*[^\]]+\]|\*[^*]+\*)/g;
  const parts = cleaned.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} style={{ fontWeight: 600, color: "var(--foreground)" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return (
        <em key={idx} style={{ color: "var(--muted-foreground)", fontStyle: "italic" }}>
          {part.slice(1, -1)}
        </em>
      );
    }

    if (part.startsWith("[") && part.endsWith("]")) {
      const isWeb = part.toLowerCase().includes("[web");
      const label = part.slice(1, -1);
      return (
        <span
          key={idx}
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: "0.72rem",
            fontWeight: 600,
            padding: "1px 6px",
            borderRadius: "4px",
            marginLeft: "5px",
            backgroundColor: isWeb ? "rgba(16, 185, 129, 0.12)" : "rgba(14, 116, 144, 0.12)",
            color: isWeb ? "#047857" : "#0e7490",
            border: isWeb ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(14, 116, 144, 0.25)",
            verticalAlign: "baseline",
            letterSpacing: "0.01em",
          }}
        >
          {isWeb ? "🌐 " : "📚 "}
          {label}
        </span>
      );
    }

    return part;
  });
}

export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  const lines = cleanText(content).split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // ── Parse Markdown Tables ──
    if (line.startsWith("|") && line.endsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const l = lines[i].trim();
        if (!/^\|[\s\-:\=\|\+]+\|\s*$/.test(l)) {
          tableLines.push(l);
        }
        i++;
      }

      if (tableLines.length > 0) {
        const headerCols = tableLines[0].split("|").slice(1, -1).map((c) => c.trim());
        const bodyRows = tableLines.slice(1).map((r) => r.split("|").slice(1, -1).map((c) => c.trim()));

        blocks.push(
          <div key={`table-${i}`} style={{ overflowX: "auto", margin: "0.75rem 0" }}>
            <table className="data-table" style={{ width: "100%", border: "1px solid var(--border)" }}>
              <thead>
                <tr>
                  {headerCols.map((c, colIdx) => (
                    <th key={colIdx} style={{ backgroundColor: "var(--surface)", padding: "6px 10px", fontSize: "0.75rem", borderBottom: "1px solid var(--border)" }}>
                      {parseInlineMarkdown(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rowIdx) => (
                  <tr key={rowIdx} style={{ backgroundColor: rowIdx % 2 === 0 ? "#ffffff" : "var(--surface)" }}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} style={{ padding: "6px 10px", fontSize: "0.82rem", borderBottom: "1px solid var(--border)" }}>
                        {parseInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    if (!line) {
      i++;
      continue;
    }

    // ── Parse Headers (###, ##, #) ──
    if (line.startsWith("#")) {
      const headingText = line.replace(/^#+\s*/, "");
      blocks.push(
        <h4 key={`hdr-${i}`} style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--primary)", margin: "0.85rem 0 0.35rem 0", letterSpacing: "0.02em" }}>
          {parseInlineMarkdown(headingText)}
        </h4>
      );
    } else if (line.match(/^[-*•]\s+/)) {
      // ── Parse Bullet Lists ──
      const bulletText = line.replace(/^[-*•]\s+/, "");
      blocks.push(
        <div key={`bullet-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", margin: "0.3rem 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
          <span style={{ color: "var(--primary)", fontSize: "0.9rem", lineHeight: 1.4, userSelect: "none" }}>•</span>
          <div style={{ flex: 1 }}>{parseInlineMarkdown(bulletText)}</div>
        </div>
      );
    } else if (line.match(/^\d+\.\s/)) {
      // ── Parse Numbered Lists ──
      const listText = line.replace(/^\d+\.\s*/, "");
      blocks.push(
        <div key={`num-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", margin: "0.3rem 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
          <span className="numeric font-bold" style={{ color: "var(--primary)" }}>{line.match(/^\d+/)[0]}.</span>
          <div style={{ flex: 1 }}>{parseInlineMarkdown(listText)}</div>
        </div>
      );
    } else {
      // ── Standard Paragraph ──
      blocks.push(
        <p key={`p-${i}`} style={{ margin: "0.35rem 0", fontSize: "0.84rem", lineHeight: 1.55 }}>
          {parseInlineMarkdown(line)}
        </p>
      );
    }

    i++;
  }

  return <div>{blocks}</div>;
}
