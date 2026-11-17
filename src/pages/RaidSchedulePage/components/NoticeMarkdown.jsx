import { useState } from "react";

// Render the Discord-style Markdown saved as plain text in the sheet.
// React escapes all source text; no raw HTML is injected into the page.
const INLINE_TOKENS = /(!?\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^\s)]+\)|<https?:\/\/[^\s>]+>|<a?:[\w]+:\d+>|https?:\/\/[^\s<]+|`[^`\n]+`|\|\|[^|\n]+?\|\||\*\*\*[^*\n]+?\*\*\*|\*\*[^*\n]+?\*\*|__[^_\n]+?__|~~[^~\n]+?~~|(?<!\w)\*[^*\n]+\*(?!\w)|(?<!\w)_[^_\n]+_(?!\w))/g;

function Spoiler({ children, styles }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      className={`${styles.noticeSpoiler} ${revealed ? styles.noticeSpoilerRevealed : ""}`}
      role="button"
      tabIndex={0}
      aria-label={revealed ? "스포일러 다시 가리기" : "스포일러 내용 보기"}
      onClick={(event) => { event.stopPropagation(); setRevealed((value) => !value); }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          setRevealed((value) => !value);
        }
      }}
    >{children}</span>
  );
}

function renderInline(text, styles, depth = 0) {
  if (depth > 6) return text;
  const result = [];
  let previous = 0;
  for (const match of String(text).matchAll(INLINE_TOKENS)) {
    const token = match[0];
    const position = match.index;
    if (position > previous) result.push(text.slice(previous, position));
    const key = `token-${position}`;
    const child = (value) => renderInline(value, styles, depth + 1);
    const markdownLink = token.match(/^(!?)\[([^\]]+)\]\(([^)]+)\)$/);
    const discordEmoji = token.match(/^<(a?):([\w]+):(\d+)>$/);
    if (markdownLink) {
      const [, image, label, url] = markdownLink;
      if (image) {
        result.push(<img key={key} src={url} alt={label} loading="lazy" />);
      } else {
        result.push(<a key={key} href={url} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{label}</a>);
      }
    } else if (discordEmoji) {
      const [, animated, name, id] = discordEmoji;
      result.push(<img key={key} className={styles.noticeEmoji} src={`https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}`} alt={`:${name}:`} loading="lazy" />);
    } else if (token.startsWith("<http") || token.startsWith("http")) {
      const url = token.startsWith("<") ? token.slice(1, -1) : token;
      result.push(<a key={key} href={url} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{url}</a>);
    } else if (token.startsWith("`")) {
      result.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("||")) {
      result.push(<Spoiler key={key} styles={styles}>{child(token.slice(2, -2))}</Spoiler>);
    } else if (token.startsWith("***")) {
      result.push(<strong key={key}><em>{child(token.slice(3, -3))}</em></strong>);
    } else if (token.startsWith("**")) {
      result.push(<strong key={key}>{child(token.slice(2, -2))}</strong>);
    } else if (token.startsWith("__")) {
      result.push(<u key={key}>{child(token.slice(2, -2))}</u>);
    } else if (token.startsWith("~~")) {
      result.push(<del key={key}>{child(token.slice(2, -2))}</del>);
    } else {
      result.push(<em key={key}>{child(token.slice(1, -1))}</em>);
    }
    previous = position + token.length;
  }
  if (previous < text.length) result.push(text.slice(previous));
  return result;
}

function listMarker(line) {
  const match = line.match(/^(\s{0,6})([-+*]|\d+[.)])\s+(.+)$/);
  return match ? { indent: match[1].length, ordered: /^\d/.test(match[2]), content: match[3] } : null;
}

function renderList(lines, start, styles, depth) {
  const first = listMarker(lines[start]);
  const items = [];
  let index = start;
  while (index < lines.length) {
    const marker = listMarker(lines[index]);
    if (!marker || marker.indent < first.indent || (marker.indent === first.indent && marker.ordered !== first.ordered)) break;
    if (marker.indent > first.indent) {
      const nested = renderList(lines, index, styles, depth + 1);
      if (items.length) items[items.length - 1].nested.push(nested.node);
      index = nested.next;
      continue;
    }
    items.push({ content: marker.content, nested: [] });
    index++;
  }
  const Tag = first.ordered ? "ol" : "ul";
  return {
    next: index,
    node: <Tag key={`list-${start}`}>{items.map((item, number) => <li key={number}>{renderInline(item.content, styles)}{item.nested}</li>)}</Tag>,
  };
}

function isBlockStart(line) {
  return /^ {0,3}(?:#{1,6}\s|-#\s|>{1,3}\s?|`{3,}|~{3,})/.test(line)
    || /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)
    || Boolean(listMarker(line));
}

function renderBlocks(source, styles, depth = 0) {
  if (depth > 10) return <p>{source}</p>;
  const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})([\w+-]*)\s*$/);
    if (fence) {
      const content = [];
      const closing = new RegExp(`^\\s{0,3}${fence[1]}\\s*$`);
      index++;
      while (index < lines.length && !closing.test(lines[index])) content.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push(<pre key={`code-${index}`}><code>{content.join("\n")}</code></pre>);
      continue;
    }
    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+)$/);
    if (heading) {
      const Tag = `h${heading[1].length}`;
      blocks.push(<Tag key={`heading-${index}`}>{renderInline(heading[2], styles)}</Tag>);
      index++;
      continue;
    }
    const subtext = line.match(/^ {0,3}-#\s+(.+)$/);
    if (subtext) {
      blocks.push(<small key={`subtext-${index}`}>{renderInline(subtext[1], styles)}</small>);
      index++;
      continue;
    }
    if (/^ {0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(line)) {
      blocks.push(<hr key={`hr-${index}`} />);
      index++;
      continue;
    }
    if (/^ {0,3}>>>\s?/.test(line)) {
      const quote = [line.replace(/^ {0,3}>>>\s?/, ""), ...lines.slice(index + 1)].join("\n");
      blocks.push(<blockquote key={`quote-${index}`}>{renderBlocks(quote, styles, depth + 1)}</blockquote>);
      break;
    }
    if (/^ {0,3}>\s?/.test(line)) {
      const quote = [];
      const start = index;
      while (index < lines.length && /^ {0,3}>\s?/.test(lines[index])) {
        quote.push(lines[index++].replace(/^ {0,3}>\s?/, ""));
      }
      blocks.push(<blockquote key={`quote-${start}`}>{renderBlocks(quote.join("\n"), styles, depth + 1)}</blockquote>);
      continue;
    }
    if (listMarker(line)) {
      const list = renderList(lines, index, styles, depth);
      blocks.push(list.node);
      index = list.next;
      continue;
    }
    const paragraph = [];
    const start = index;
    while (index < lines.length && lines[index].trim() && (index === start || !isBlockStart(lines[index]))) {
      paragraph.push(lines[index++]);
    }
    blocks.push(<p key={`paragraph-${start}`}>{paragraph.map((text, row) => <span key={row}>{row > 0 && <br />}{renderInline(text, styles)}</span>)}</p>);
  }
  return blocks;
}

export default function NoticeMarkdown({ text, styles }) {
  return <div className={styles.noticeMarkdown}>{renderBlocks(text, styles)}</div>;
}
