const topics = [
  ["圣别", "Holiness", "利十九2；彼前一15；来二11、十10、十二10、十三12"],
  ["长子名分", "Birthright", "创二五29-34；二七34-36；申二一17；代上五1-2；雅一18；启二26-27"],
  ["恩典", "Grace", "约一16-17；罗六14；加四21-31；来四16、十19、十三9；林前十五10"],
  ["国度", "Kingdom", "但二44；哈二6-7；太六33；西一13；罗十四17；提后四7-8；启十一15"]
];

const chinese = "創 出 利 民 申 書 士 得 撒上 撒下 王上 王下 代上 代下 拉 尼 斯 伯 詩 箴 傳 歌 賽 耶 哀 結 但 何 珥 摩 俄 拿 彌 鴻 哈 番 該 亞 瑪 太 可 路 約 徒 羅 林前 林後 加 弗 腓 西 帖前 帖後 提前 提後 多 門 來 雅 彼前 彼後 約壹 約貳 約參 猶 啟".split(" ");
const simplified = "创 出 利 民 申 书 士 得 撒上 撒下 王上 王下 代上 代下 拉 尼 斯 伯 诗 箴 传 歌 赛 耶 哀 结 但 何 珥 摩 俄 拿 弥 鸿 哈 番 该 亚 玛 太 可 路 约 徒 罗 林前 林后 加 弗 腓 西 帖前 帖后 提前 提后 多 门 来 雅 彼前 彼后 约壹 约贰 约参 犹 启".split(" ");
const english = await fetch("books.json").then(response => response.json());
const short = "Gen|Exo|Lev|Num|Deut|Josh|Judg|Ruth|1 Sam|2 Sam|1 Kings|2 Kings|1 Chron|2 Chron|Ezra|Neh|Esth|Job|Psa|Prov|Eccl|S.S.|Isa|Jer|Lam|Ezek|Dan|Hos|Joel|Amos|Obad|Jonah|Micah|Nah|Hab|Zeph|Hag|Zech|Mal|Matt|Mark|Luke|John|Acts|Rom|1 Cor|2 Cor|Gal|Eph|Phil|Col|1 Thes|2 Thes|1 Tim|2 Tim|Titus|Philem|Heb|James|1 Pet|2 Pet|1 John|2 John|3 John|Jude|Rev".split("|");
const digits = "○一二三四五六七八九";
const key = name => name.toLowerCase().replace(/[.\s]/g, "");
const aliases = new Map();
english.forEach((name, index) => {
  [name, short[index], chinese[index], simplified[index]].forEach(alias => aliases.set(key(alias), index));
});
["歷代志上", "历代志上", "歷上", "历上", "歷", "历"].forEach(alias => aliases.set(alias, 12));
["歷代志下", "历代志下", "歷下", "历下"].forEach(alias => aliases.set(alias, 13));
const bookPrefixes = [...aliases.keys()].sort((a, b) => b.length - a.length);
const topicKey = value => value.trim().toLowerCase().replace(/[圣长国]/g, letter => ({圣:"聖",长:"長",国:"國"})[letter]);
const chapterNumber = value => {
  if (!value.includes("十")) return Number(value.replace(/[○零〇一二三四五六七八九]/g, digit => Math.max(0, digits.indexOf(digit))));
  const [tens, units] = value.split("十");
  return (tens ? digits.indexOf(tens) : 1) * 10 + Math.max(0, digits.indexOf(units));
};

function parse(input) {
  let book, chapter;
  return input.normalize("NFKC").replace(/[–—~～]/g, "-").split(/[;、,\n]+/).filter(piece => piece.trim()).map(piece => {
    let ref = key(piece);
    const name = bookPrefixes.find(prefix => ref.startsWith(prefix));
    if (name) {
      book = aliases.get(name);
      chapter = undefined;
      ref = ref.slice(name.length);
    }
    const match = ref.match(/^(?:([○零〇一二三四五六七八九十]+):?|(\d+):)?(\d+)(?:-(\d+))?$/u);
    if (!match) throw Error(piece.trim());
    const [, han, arabic, first, last = first] = match;
    if (han || arabic) chapter = chapterNumber(han || arabic);
    if (!chapter && [30, 56, 62, 63, 64].includes(book)) chapter = 1;
    if (book === undefined || !chapter || chapter > 150 || +first < 1 || +last < +first || +last > 176) throw Error(piece.trim());
    return {book, chapter, first:+first, last:+last};
  });
}

const $ = id => document.getElementById(id);
const input = $("refs");
const status = $("status");
const buttons = topics.map(([zh, en, refs], index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = zh + " · " + en;
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    input.value = refs;
    lookup(index);
  });
  $("topics").append(button);
  return button;
});

let pending;

function render(verses) {
  const cards = verses.map(verse => {
    const card = document.createElement("article");
    card.className = "verse";
    const heading = document.createElement("h2");
    heading.textContent = verse.reference;
    const zh = document.createElement("p");
    zh.lang = "zh-Hans";
    zh.textContent = verse.chinese ?? "未找到中文经文。";
    const en = document.createElement("p");
    en.lang = "en";
    en.textContent = verse.english ?? "English verse unavailable.";
    card.append(heading, zh, en);
    return card;
  });
  $("results").replaceChildren(...cards);
}

async function lookup(selected = -1) {
  pending?.abort();
  const lookupRequest = new AbortController();
  pending = lookupRequest;
  const typed = input.value.trim();
  const match = topics.findIndex(([zh, en, refs]) => [zh, en, refs].some(item => topicKey(item) === topicKey(typed)));
  if (selected < 0) selected = match;
  if (match >= 0) input.value = topics[match][2];
  buttons.forEach((button, index) => button.setAttribute("aria-pressed", String(index === selected)));
  $("results").replaceChildren();
  $("results").setAttribute("aria-busy", "true");
  status.className = "";
  status.textContent = "正在查找经文… / Looking up verses…";
  try {
    const passages = parse(input.value);
    if (!passages.length) throw Error("请输入经文出处。");
    const ids = [...new Set(passages.flatMap(({book, chapter, first, last}) =>
      Array.from({length:last-first+1}, (_, offset) => [book+1, chapter, first+offset].join("."))
    ))];
    if (ids.length > 100) throw Error("每次最多查询 100 节。 / Limit 100 verses per search.");
    const response = await fetch("/api/verses?" + new URLSearchParams({ids:ids.join(",")}), {signal:lookupRequest.signal});
    const data = await response.json();
    if (lookupRequest.signal.aborted) return;
    if (!response.ok) throw Error(data.error);
    const verses = data.verses.map((verse, index) => {
      const [book, chapter, number] = ids[index].split(".").map(Number);
      return {...verse, reference: simplified[book-1] + " " + chapter + ":" + number + " · " + english[book-1] + " " + chapter + ":" + number};
    });
    render(verses);
    const paired = verses.filter(verse => verse.chinese && verse.english).length;
    status.textContent = paired === verses.length
      ? paired + " 节中英对照 · " + paired + " paired verses"
      : paired + " / " + verses.length + " 节完整配对 · Some verses were unavailable";
  } catch (error) {
    if (lookupRequest.signal.aborted) return;
    status.className = "error";
    status.textContent = "查询失败 / Lookup failed · " + error.message;
  } finally {
    if (!lookupRequest.signal.aborted) $("results").setAttribute("aria-busy", "false");
  }
}

$("lookup").addEventListener("submit", event => {
  event.preventDefault();
  lookup();
});
buttons[0].click();
