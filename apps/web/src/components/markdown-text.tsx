/*
  Markdown renderer for model-authored text (chat replies, summary blocks).
  Real agents answer in markdown — bold, lists, code — and raw asterisks on
  screen read as broken. Typography rules live in globals.css under `.chat-md`
  so the palette/voice stays in one place with the other brand styles.
*/

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownText({ text }: { text: string }) {
  return (
    <div className="chat-md font-mono text-sm leading-relaxed text-muted">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
