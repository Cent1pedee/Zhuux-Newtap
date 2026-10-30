/**
 * 内置语录库（PRD 4.3）：随包静态数据，离线可用、零网络请求。
 * 分类：励志（inspire）/ 技术（tech）/ 文艺（literary）
 */

export type QuoteCategory = "inspire" | "tech" | "literary";

export type Quote = { text: string; from: string; category: QuoteCategory };

export const QUOTES: Quote[] = [
  { text: "把每件小事做到极致，就是最好的简历。", from: "佚名", category: "inspire" },
  { text: "慢一点没关系，只要方向是对的。", from: "佚名", category: "inspire" },
  { text: "你不需要很厉害才能开始，但你需要开始才会很厉害。", from: "佚名", category: "inspire" },
  { text: "真正的自由，是有能力拒绝不想要的生活。", from: "佚名", category: "inspire" },
  { text: "今天多走的一步，都是明天少求的一次人。", from: "佚名", category: "inspire" },
  { text: "别急，好东西都在路上。", from: "佚名", category: "inspire" },
  { text: "把注意力从「我不能」挪到「我试试」。", from: "佚名", category: "inspire" },
  { text: "长期主义者赢在别人放弃的那一天。", from: "佚名", category: "inspire" },
  { text: "先完成，再完美。", from: "佚名", category: "inspire" },
  { text: "行动是治愈恐惧的唯一良药。", from: "威廉·詹姆斯", category: "inspire" },
  { text: "所有伟大的事，都始于一个决定开始的瞬间。", from: "佚名", category: "inspire" },
  { text: "与其焦虑未来，不如把今天过好。", from: "佚名", category: "inspire" },

  { text: "过早优化是万恶之源。", from: "Donald Knuth", category: "tech" },
  { text: "简单是可靠的先决条件。", from: "Edsger Dijkstra", category: "tech" },
  { text: "任何足够先进的技术，都与魔法无异。", from: "Arthur C. Clarke", category: "tech" },
  { text: "程序是写给人读的，只是顺带让机器执行。", from: "Martin Fowler", category: "tech" },
  { text: "让代码比你来时更干净一点。", from: "童子军军规", category: "tech" },
  { text: "先让它跑起来，再让它正确，最后让它快。", from: "Kent Beck", category: "tech" },
  { text: "复杂度不会消失，它只会转移。", from: "佚名", category: "tech" },
  { text: "能被自动化的重复劳动，都值得被自动化。", from: "佚名", category: "tech" },
  { text: "好的抽象隐藏细节，坏的抽象隐藏问题。", from: "佚名", category: "tech" },
  { text: "文档是写给三个月后的自己看的。", from: "佚名", category: "tech" },
  { text: "Bug 不会自己消失，它只会在上线那天出现。", from: "佚名", category: "tech" },
  { text: "测试不是为了证明正确，而是为了允许改变。", from: "Michael Feathers", category: "tech" },

  { text: "生活不是等待暴风雨过去，而是学会在雨中起舞。", from: "佚名", category: "literary" },
  { text: "我们都在阴沟里，但仍有人仰望星空。", from: "王尔德", category: "literary" },
  { text: "愿你在被打击时，记起你的珍贵。", from: "佚名", category: "literary" },
  { text: "山有峰顶，海有彼岸，漫漫长途，终有回转。", from: "佚名", category: "literary" },
  { text: "所谓无底深渊，下去，也是前程万里。", from: "木心", category: "literary" },
  { text: "人间忽晚，山河已秋。", from: "佚名", category: "literary" },
  { text: "总有一天，你会成为自己的屋檐。", from: "佚名", category: "literary" },
  { text: "月亮不会因为你在黑暗中而拒绝照亮你。", from: "佚名", category: "literary" },
  { text: "所有的相遇，都是久别重逢。", from: "佚名", category: "literary" },
  { text: "心有猛虎，细嗅蔷薇。", from: "西格夫里·萨松", category: "literary" },
  { text: "与其互为人间，不如自成宇宙。", from: "佚名", category: "literary" },
  { text: "风吹过的地方，都值得被记住。", from: "佚名", category: "literary" },
];

export function quotesByCategory(category: string): Quote[] {
  if (category === "all" || !category) return QUOTES;
  const list = QUOTES.filter((q) => q.category === category);
  return list.length ? list : QUOTES;
}

/** 按日期取一条（每日一言稳定，同一天不变） */
export function quoteOfDay(category: string, date = new Date()): Quote {
  const list = quotesByCategory(category);
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return list[seed % list.length];
}

/** 随机取一条，尽量避开上一条 */
export function randomQuote(category: string, avoidText?: string): Quote {
  const list = quotesByCategory(category);
  if (list.length <= 1) return list[0];
  for (let i = 0; i < 8; i += 1) {
    const pick = list[Math.floor(Math.random() * list.length)];
    if (pick.text !== avoidText) return pick;
  }
  return list[Math.floor(Math.random() * list.length)];
}
