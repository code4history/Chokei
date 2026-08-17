const xpath = require('xpath');
const dom = require('xmldom').DOMParser;
const fs = require("fs-extra");
const svg_to_png = require('svg-to-png');
const path = require("node:path");

const convert_set = [
  { "set": 1, "original": "如来", "rename": "如来", "rename_en": "Buddha (Tathāgata)", "base": "nyorai", "description": "阿弥陀如来のイメージで代表させています。", "description_en": "Stands for the class as a whole; drawn after Amida Nyorai (Amitābha).", "pattern": true },
  { "set": 1, "original": "明王", "rename": "明王", "rename_en": "Wisdom King (Vidyārāja)", "base": "myooh", "description": "不動明王のイメージで代表させています。", "description_en": "Stands for the class as a whole; drawn after Fudō Myōō (Acala).", "pattern": true },
  { "set": 1, "original": "菩薩", "rename": "菩薩", "rename_en": "Bodhisattva", "base": "bosatsu", "description": "聖観音のイメージで代表させています。", "description_en": "Stands for the class as a whole; drawn after Shō Kannon (Avalokiteśvara).", "pattern": true },
  { "set": 1, "original": "地蔵", "rename": "地蔵", "rename_en": "Jizō (Kṣitigarbha)", "base": "jizo", "description": "地蔵は菩薩から独立させています。", "description_en": "Given its own icon rather than folded into the bodhisattva type.", "pattern": true },
  { "set": 1, "original": "馬頭観音", "rename": "馬頭観音", "rename_en": "Batō Kannon (Hayagrīva)", "base": "bato", "description": "馬頭観音は菩薩から独立させています。", "description_en": "Given its own icon rather than folded into the bodhisattva type.", "pattern": true },
  { "set": 1, "original": "如意輪観音", "rename": "如意輪観音", "rename_en": "Nyoirin Kannon (Cintāmaṇicakra)", "base": "nyoirin", "description": "如意輪観音は菩薩から独立させています。", "description_en": "Given its own icon rather than folded into the bodhisattva type.", "pattern": true },
  { "set": 1, "original": "天部男", "rename": "天部 - 男性", "rename_en": "Deva – male", "base": "ten_male", "description": "多聞天のイメージで代表させています。", "description_en": "Stands for the class as a whole; drawn after Tamonten (Vaiśravaṇa).", "pattern": true },
  { "set": 1, "original": "天部女", "rename": "天部 - 女性", "rename_en": "Deva – female", "base": "ten_female", "description": "弁財天のイメージで代表させています。", "description_en": "Stands for the class as a whole; drawn after Benzaiten (Sarasvatī).", "pattern": true },
  { "set": 1, "original": "五輪塔", "rename": "五輪塔", "rename_en": "Gorintō (five-ring pagoda)", "base": "gorinto", "description": "五輪塔のイメージです。", "description_en": "Drawn after a standard gorintō.", "pattern": true },
  { "set": 1, "original": "宝篋印塔", "rename": "宝篋印塔", "rename_en": "Hōkyōintō (jewelled-casket-seal pagoda)", "base": "hokyoin", "description": "宝篋印塔のイメージです。", "description_en": "Drawn after a standard hōkyōintō.", "pattern": true },
  { "set": 1, "original": "板碑", "rename": "板碑", "rename_en": "Itabi (slab stūpa)", "base": "itahi", "description": "キリークの描かれた板碑のイメージです。", "description_en": "An itabi bearing the Siddhaṃ seed syllable *hrīḥ* (Kirīku).", "pattern": true },
  { "set": 1, "original": "浮彫五輪塔", "rename": "浮彫五輪塔", "rename_en": "Relief gorintō", "base": "ukibori_gorin", "description": "五輪塔の舟形背面レリーフのイメージです。", "description_en": "A gorintō carved in relief on a boat-shaped backing stone.", "pattern": true },
  { "set": 1, "original": "供養塔", "rename": "供養塔", "rename_en": "Kuyōtō (memorial stūpa)", "base": "kuyohi", "description": "回国供養塔、念仏供養塔などのイメージです。", "description_en": "Covers pilgrimage (kaikoku) and nenbutsu memorial monuments.", "pattern": true },
  { "set": 1, "original": "名号石碑", "rename": "名号塔", "rename_en": "Myōgōtō (invocation stele)", "base": "myogo", "description": "名号、題目どちらにも使えるよう「南無」と記しました。", "description_en": "Inscribed simply \"Namu\" so that it serves both myōgō (Amida invocation) and daimoku (Lotus invocation) steles.", "pattern": true },
  { "set": 1, "original": "庚申", "rename": "庚申", "rename_en": "Kōshin", "base": "koshin", "description": "庚申の三猿のイメージです。", "description_en": "Drawn after the three monkeys of the Kōshin cult.", "pattern": true },
  { "set": 1, "original": "青面金剛", "rename": "青面金剛", "rename_en": "Shōmen Kongō", "base": "shomen", "description": "青面金剛のイメージです。", "description_en": "Drawn after a standard Shōmen Kongō figure.", "pattern": true },
  { "set": 1, "original": "道祖神", "rename": "道祖神", "rename_en": "Dōsojin", "base": "dosojin", "description": "双体道祖神のイメージです。", "description_en": "Drawn after a paired (sōtai) dōsojin couple.", "pattern": true },
  { "set": 1, "original": "月待塔", "rename": "月待塔", "rename_en": "Tsukimachitō (moon-waiting stele)", "base": "tsukimachi", "description": "月待塔のイメージです。", "description_en": "Drawn after a standard moon-waiting stele.", "pattern": true },
  { "set": 1, "original": "富士塚", "rename": "富士講", "rename_en": "Fujikō", "base": "fujiko", "description": "富士講の信仰対象、富士山のイメージです。", "description_en": "Mount Fuji, the object of worship of the Fujikō confraternities.", "pattern": true },
  { "set": 1, "original": "山岳信仰碑", "rename": "山岳信仰", "rename_en": "Mountain worship", "base": "mount", "description": "大峰、愛宕、出羽三山など山岳信仰のイメージです。", "description_en": "Covers Ōmine, Atago, the Three Mountains of Dewa and other mountain cults.", "pattern": true },
  { "set": 1, "original": "小神社", "rename": "小神社", "rename_en": "Small shrine", "base": "shrine", "description": "石造物ではないですが、奈良の調査で対象にしている関係で作成しました。鳥居や敷地を持つ小神社のイメージです。", "description_en": "Not a stone monument, but included because the Nara survey covers it. A small shrine with its own torii and precinct.", "pattern": true, "no_stone": true },
  { "set": 1, "original": "祠", "rename": "小祠", "rename_en": "Hokora (small wayside shrine)", "base": "hokora", "description": "石造物ではないですが、奈良の調査で対象にしている関係で作成しました。春日造の小祠のイメージです。", "description_en": "Not a stone monument, but included because the Nara survey covers it. A small hokora in the Kasuga-zukuri style.", "pattern": true, "no_stone": true },
  { "set": 1, "original": "石祠", "rename": "石祠", "rename_en": "Stone hokora", "base": "sekishi", "description": "石造流造小祠のイメージです。", "description_en": "A small stone hokora in the nagare-zukuri style.", "pattern": true },
  { "set": 1, "original": "石神お塚", "rename": "石神", "rename_en": "Sekijin (sacred stone)", "base": "sekijin", "description": "稲荷神社や、龍神水神などによく見られる石神、お塚のイメージです。", "description_en": "Sacred stones and otsuka mounds, common at Inari shrines and at dragon- and water-deity sites.", "pattern": true },
  { "set": 1, "original": "神木", "rename": "神木", "rename_en": "Shinboku (sacred tree)", "base": "tree", "description": "神木や野神など、信仰対象植物のイメージです。", "description_en": "Sacred trees, nogami and other plants that are objects of worship.", "pattern": true, "no_stone": true },
  { "set": 1, "original": "忠魂碑", "rename": "忠魂碑", "rename_en": "Chūkonhi (war memorial)", "base": "chukonhi", "description": "戦前によく見られた、篆書で碑銘が書かれた記念碑のイメージです。", "description_en": "The prewar type of memorial, its inscription cut in seal script.", "pattern": true },
  { "set": 1, "original": "記念碑", "rename": "記念碑", "rename_en": "Commemorative stele", "base": "kinenhi", "description": "戦後によく見られる、黒光りする鏡面を持つ記念碑のイメージです。", "description_en": "The postwar type, with a polished black mirror face.", "pattern": true },
  { "set": 1, "original": "道標", "rename": "道標", "rename_en": "Waymarker", "base": "dohyo", "description": "道標とよくわかるよう、道案内板のイメージで描きました。", "description_en": "Drawn as a signboard so that it reads unmistakably as a waymarker.", "pattern": true },
  { "set": 1, "original": "石造物", "rename": "石造物", "rename_en": "Other stone monument", "base": "stone", "description": "上記で用意されていない「その他石造物」のイメージです。", "description_en": "For any stone monument not covered by the types above.", "pattern": true },
  { "set": 1, "original": "新規報告", "rename": "新規", "rename_en": "New", "base": "new", "description": "新規地物の投稿用、新規地物を示すアイコンです。", "description_en": "Marks a newly reported feature; used when submitting one.", "pattern": false, "sys": true },
  { "set": 2, "original": "織部灯篭", "rename": "織部灯篭", "rename_en": "Oribe lantern (Oribe-dōrō)", "base": "oribe_lantern", "description": "織部灯篭のイメージです。", "description_en": "Drawn after a standard Oribe-style stone lantern.", "pattern": true },
  { "set": 2, "original": "暗渠", "rename": "暗渠", "rename_en": "Culvert", "base": "culvert", "description": "石造物ではないですが、観光案内POIデータセットで利用する関係で作成しました。暗渠から開渠になる箇所のイメージです。", "description_en": "Not a stone monument, but included for the sightseeing POI dataset. The point where a culvert opens into an open channel.", "pattern": true, "no_stone": true },
  { "set": 2, "original": "石標", "rename": "石標", "rename_en": "Stone marker post", "base": "stone_display", "description": "寺名標や社名標、下馬標など、石標のイメージです。", "description_en": "Temple- and shrine-name posts, dismount markers and similar marker stones.", "pattern": true },
  { "set": 2, "original": "石灯篭", "rename": "石灯篭", "rename_en": "Stone lantern", "base": "stone_lantern", "description": "石灯籠のイメージです。", "description_en": "Drawn after a standard stone lantern.", "pattern": true },
  { "set": 2, "original": "手水鉢", "rename": "手水鉢", "rename_en": "Chōzubachi (water basin)", "base": "stone_bowl", "description": "石で作られた手水鉢のイメージです。", "description_en": "A water basin for ritual purification, cut in stone.", "pattern": true },
  { "set": 2, "original": "欄干", "rename": "欄干", "rename_en": "Bridge balustrade", "base": "balustrade", "description": "暗渠化などで道端に残った橋の欄干や、橋跡を示す碑などに用いるイメージです。", "description_en": "For bridge railings left at the roadside after culverting, and for steles marking former bridge sites.", "pattern": true },
  { "set": 2, "original": "路地", "rename": "路地", "rename_en": "Alley", "base": "alley", "description": "石造物ではないですが、観光案内POIデータセットで利用する関係で作成しました。街中の小さな路地のイメージです。", "description_en": "Not a stone monument, but included for the sightseeing POI dataset. A small alley in a townscape.", "pattern": true, "no_stone": true },
  { "set": 2, "original": "坂", "rename": "坂", "rename_en": "Slope", "base": "slope", "description": "石造物ではないですが、観光案内POIデータセットで利用する関係で作成しました。街中の小さな坂のイメージです。", "description_en": "Not a stone monument, but included for the sightseeing POI dataset. A small slope in a townscape.", "pattern": true, "no_stone": true },
  { "set": 2, "original": "日待塔", "rename": "日待塔", "rename_en": "Himachitō (sun-waiting stele)", "base": "himachi", "description": "日の出をデザインした、甲子塔や巳待塔など、日待塔に用いるイメージです。", "description_en": "A sunrise design, for himachi steles including kinoene and mimachi monuments.", "pattern": true },
  { "set": 2, "original": "狛犬", "rename": "狛犬", "rename_en": "Komainu (guardian lion-dog)", "base": "komainu", "description": "神社に存在する狛犬のイメージです。", "description_en": "The komainu pair that stand at a shrine.", "pattern": true },
  { "set": 2, "original": "石鳥居", "rename": "石鳥居", "rename_en": "Stone torii", "base": "stone_torii", "description": "石で作られた鳥居のイメージです。", "description_en": "A torii built in stone.", "pattern": true },
  { "set": 2, "original": "墓", "rename": "墓碑", "rename_en": "Gravestone", "base": "tomb", "description": "墓石のイメージです。", "description_en": "A grave marker.", "pattern": true },
  { "set": 2, "original": "石塔", "rename": "石塔", "rename_en": "Stone pagoda", "base": "stone_tower", "description": "石で作られた仏塔のイメージです。", "description_en": "A Buddhist pagoda built in stone.", "pattern": true },
  { "set": 2, "original": "神使", "rename": "神使", "rename_en": "Shinshi (divine messenger animal)", "base": "god_minions", "description": "稲荷の狐、天神の牛など、狛犬以外の神使のイメージです。", "description_en": "Divine messenger animals other than komainu — the fox of Inari, the ox of Tenjin and so on.", "pattern": true },
  { "set": 2, "original": "三界万霊塔", "rename": "三界万霊塔", "rename_en": "Sangai Banreitō (stele for all souls)", "base": "banrei", "description": "三界万霊塔や無縁供養塔のイメージです。", "description_en": "Sangai banrei steles and memorials for the unmourned dead (muen kuyōtō).", "pattern": true }
];

const patterns = [
  {"id": "no", "suffix": "", "remove": []},
  {"id": "normal", "suffix": "", "remove": ["画像なし", "要調査", "消失"]},
  {"id": "missing", "suffix": "_missing", "remove": ["画像なし", "要調査"]},
  {"id": "action", "suffix": "_action", "remove": ["画像なし", "消失"]},
  {"id": "noimg", "suffix": "_noimg", "remove": ["要調査", "消失"]}
];

// 種別の節見出し。言語別に「完成したラベル」を持つ（設計 §7.6.5 / 限定授権 A-2）。
// 現行は語幹（"石造物"）へ生成側で「アイコン」を連結していたが、英語では
// "Non-stone-monument" のように複合語のハイフンが要るなど連結が成立しない
// ∴ 生成側での継ぎ足しをやめ、表側へ完成形を置く。
const type_strings = {
  "ja": {
    "stone": "石造物アイコン",
    "nostone": "非石造物アイコン",
    "sys": "管理用途アイコン"
  },
  "en": {
    "stone": "Stone monument icons",
    "nostone": "Non-stone-monument icons",
    "sys": "Administrative icons"
  }
};

// 集合の見出し（設計 §7.6.5 / 限定授権 A-4）。
const set_strings = {
  "ja": (index) => `第${index + 1}弾`,
  "en": (index) => `Series ${index + 1}`
};

// 言語ごとの書き出し先と、行の中身を引く key（限定授権 A-5）。
// 言語別の実装を作らず、1つの実装がこの表を引いて両言語を組み立てる。
const languages = [
  { "id": "en", "file": "./README.md", "rename_key": "rename_en", "description_key": "description_en" },
  { "id": "ja", "file": "./README.ja.md", "rename_key": "rename", "description_key": "description" }
];

const table_htmls = {};
const convert_src = [];

// 列見出し（設計 §7.6.5 / 限定授権 A-3）。
const table_header = {
  "ja": `| 画像  | アイコン種別  | ファイル名(拡張子なし)  | デザイン方向性  |
|---------|---------|---------|---------|`,
  "en": `| Image  | Icon type  | File name (without extension)  | Design intent  |
|---------|---------|---------|---------|`
};

// 表生成のみを実行する経路（限定授権 A-6）。
// 追跡下の svg/ png/ を再生成せずに冪等性を測るために要る（設計 §7.5.3）。
const readme_only = process.argv.includes("--readme-only");

const marker_begin = "<!--icon_all-->";
const marker_end = "<!--/icon_all-->";

/** 1行分を全言語の表へ足す（限定授権 A-5。言語ごとに別実装を作らない）。 */
function append_table_row(line, type) {
  languages.forEach((language) => {
    const label = line[language.rename_key];
    const description = line[language.description_key];
    if (!table_htmls[language.id]) table_htmls[language.id] = [];
    const sets = table_htmls[language.id];
    if (!sets[line.set - 1]) sets[line.set - 1] = {};
    const htmls = sets[line.set - 1];
    if (!htmls[type]) htmls[type] = `##### ${type_strings[language.id][type]}\n\n${table_header[language.id]}\n`;
    htmls[type] = `${htmls[type]}| ![${label}](https://raw.githubusercontent.com/code4history/Chokei/master/png/${line.base}.png)  | ${label}  | ${line.base}  | ${description}  |\n`;
  });
}

/** 言語1つ分の表 HTML を組み立てる（限定授権 A-4 / A-5）。 */
function build_table_html(language) {
  const sets = table_htmls[language.id] || [];
  return sets.reduce((prev, htmls, index) => {
    prev = `${prev}\n#### ${set_strings[language.id](index)}\n`;
    ["stone", "nostone", "sys"].forEach((type) => {
      if (htmls[type]) prev = `${prev}${htmls[type]}`;
    });
    return prev;
  }, "");
}

/**
 * マーカー欠落 guard（限定授権 A-6 後段）。
 * 開始・終了マーカーが単独行としてちょうど1組ずつ、この順で無ければ非0で終了する。
 * 差し込み自体は reduce であり、マーカーが無いと黙って原文を書き戻す ∴ guard が無いと
 * 片方の README だけが更新される事故を検出できない（設計 §7.5.3）。
 * **書き出しの前に全言語を検査する** — 1ファイルでも欠けていれば1文字も書かずに落とす。
 */
function assert_markers(language) {
  const readme = fs.readFileSync(language.file, "utf-8").split(/\r?\n/);
  const begins = readme.filter((line) => line === marker_begin).length;
  const ends = readme.filter((line) => line === marker_end).length;
  if (begins !== 1 || ends !== 1 || readme.indexOf(marker_begin) > readme.indexOf(marker_end)) {
    console.error(
      `${language.file}: アイコン表のマーカーが単独行としてちょうど1組ありません` +
      `（${marker_begin}=${begins} / ${marker_end}=${ends}）`
    );
    process.exit(1);
  }
}

/** 言語1つ分の README のマーカー内側を差し替える（限定授権 A-5）。 */
function write_icon_table(language) {
  const table_html = build_table_html(language);
  const readme = fs.readFileSync(language.file, "utf-8").split(/\r?\n/);
  let skip = false;
  const new_readme = readme.reduce((prev, line, index) => {
    if (skip) {
      if (line === marker_end) {
        prev = `${prev}${line}\n`;
        skip = false;
      }
    } else {
      prev = `${prev}${line}`;
      if (line === marker_begin) {
        prev = `${prev}\n${table_html}`;
        skip = true;
      } else {
        if (index !== readme.length - 1) {
          prev = `${prev}\n`;
        }
      }
    }
    return prev;
  }, "");
  fs.writeFileSync(language.file, new_readme, "utf-8");
}

convert_set.forEach((line, index) => {
  const original = line.original;
  const rename = line.rename;
  const base = line.base;
  const description = line.description;
  const set = line.set;
  const type = line.no_stone ? "nostone" : line.sys ? "sys" : "stone";
  const l_patterns = patterns.filter((pat) => {
    return pat.id === "no" ? !line.pattern : line.pattern;
  });
  // Create table HTML（限定授権 A-5。SVG 変換より前に置くことで、A-6 の早期 return が
  // SVG 変換ロジックを1文字も動かさずに済む — 設計 §14.4.2 #4 の推奨形）
  append_table_row(line, type);
  if (readme_only) return;
  const xml = fs.readFileSync(`./original/${original}.svg`, "utf-8");
  l_patterns.forEach((pattern) => {
    const suffix = pattern.suffix;
    const doc = new dom().parseFromString(xml);
    const select = xpath.useNamespaces({
      "a": "http://www.w3.org/2000/svg"
    });
    const root = select("/a:svg", doc, true);
    pattern.remove.forEach((target) => {
      const node = select(`/a:svg/a:g[@id='${target}']`, doc, true);
      root.removeChild(node);
    });
    const out_file = `./svg/${base}${suffix}.svg`;
    convert_src.push(path.resolve(__dirname, out_file));
    let output = doc.toString();
    //output = output.replace(/ id="[^"]+"/gm, "");
    //output = output.replace(/<!--[^>]+-->[\n\r]+/gm, "");
    //output = output.replace(" xmlns:xlink=\"http://www.w3.org/1999/xlink\"", "");
    //output = output.replace(/(">|;})[\n\r]+\t?(\.st|<\/st)/gm, "$1 $2");
    //output = output.replace(/(\d|z| )[\n\r]+\t+([^\t])/gm, "$1$2");
    //output = output.replace(/(points="[\d,\. ]+\d)[ \t]+"/gm, "$1\"");
    //output = output.replace(/>[ \r\n\t]+</gm, "><");
    fs.writeFileSync(out_file, output, "utf-8");
  });
});

// 両言語の README を1つの実装で書き出す（限定授権 A-5）。
// guard は全言語ぶんを先に通す（限定授権 A-6 後段。片方だけ書き換わる状態を作らない）。
languages.forEach((language) => assert_markers(language));
languages.forEach((language) => write_icon_table(language));

// 表生成のみの経路（限定授権 A-6）。以降の PNG 変換は追跡下の png/ を書き換えるため通らない。
if (readme_only) return;

svg_to_png.convert(convert_src, path.resolve(__dirname, "./png"), {defaultWidth: 28, defaultHeight: 40}) // async, returns promise
  .then( function(){
    // Do tons of stuff
  });
