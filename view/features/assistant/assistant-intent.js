const VIS = /vis|可视化|这张图|这个图|这图|图表|chart|graph/i;

const LOOKUPS = [
  /(?:看看|看一下|查看|找一下|搜一下)\s*([^，。！？\n]+?)(?:的(?:数据|比赛|档案|表现|战绩|信息))?[。！？\s]*$/,
  /(?:show me|look at|find)\s+(.+?)(?:'s|’s)?(?:\s+data)?[.?\s]*$/i,
];

function cleanName(value) {
  return String(value ?? '')
    .replace(/^[\s"'“”「」]+|[\s"'“”「」。.!?,，]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function interpretAssistant(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return { kind: 'empty' };
  if (VIS.test(raw)) return { kind: 'summary' };
  for (const pattern of LOOKUPS) {
    const name = cleanName(raw.match(pattern)?.[1]);
    if (name && name.length <= 40 && !/^(数据|data)$/i.test(name)) return { kind: 'lookup', name };
  }
  return { kind: 'unknown' };
}
