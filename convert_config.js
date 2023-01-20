const xpath = require('xpath');
const dom = require('xmldom').DOMParser;
const fs = require("fs-extra");
const svg_to_png = require('svg-to-png');
const path = require("node:path");

const convert_set = [
  { "set": 1, "original": "如来", "rename": "如来", "base": "nyorai", "description": "阿弥陀如来のイメージで代表させています。", "pattern": true },
  { "set": 1, "original": "明王", "rename": "明王", "base": "myooh", "description": "不動明王のイメージで代表させています。", "pattern": true },
  { "set": 1, "original": "菩薩", "rename": "菩薩", "base": "bosatsu", "description": "聖観音のイメージで代表させています。", "pattern": true },
  { "set": 1, "original": "地蔵", "rename": "地蔵", "base": "jizo", "description": "地蔵は菩薩から独立させています。", "pattern": true },
  { "set": 1, "original": "馬頭観音", "rename": "馬頭観音", "base": "bato", "description": "馬頭観音は菩薩から独立させています。", "pattern": true },
  { "set": 1, "original": "如意輪観音", "rename": "如意輪観音", "base": "nyoirin", "description": "如意輪観音は菩薩から独立させています。", "pattern": true },
  { "set": 1, "original": "天部男", "rename": "天部 - 男性", "base": "ten_male", "description": "多聞天のイメージで代表させています。", "pattern": true },
  { "set": 1, "original": "天部女", "rename": "天部 - 女性", "base": "ten_female", "description": "弁財天のイメージで代表させています。", "pattern": true },
  { "set": 1, "original": "五輪塔", "rename": "五輪塔", "base": "gorinto", "description": "五輪塔のイメージです。", "pattern": true },
  { "set": 1, "original": "宝篋印塔", "rename": "宝篋印塔", "base": "hokyoin", "description": "宝篋印塔のイメージです。", "pattern": true },
  { "set": 1, "original": "板碑", "rename": "板碑", "base": "itahi", "description": "キリークの描かれた板碑のイメージです。", "pattern": true },
  { "set": 1, "original": "浮彫五輪塔", "rename": "浮彫五輪塔", "base": "ukibori_gorin", "description": "五輪塔の舟形背面レリーフのイメージです。", "pattern": true },
  { "set": 1, "original": "供養塔", "rename": "供養塔", "base": "kuyohi", "description": "回国供養塔、念仏供養塔などのイメージです。", "pattern": true },
  { "set": 1, "original": "名号石碑", "rename": "名号塔", "base": "myogo", "description": "名号、題目どちらにも使えるよう「南無」と記しました。", "pattern": true },
  { "set": 1, "original": "庚申", "rename": "庚申", "base": "koshin", "description": "庚申の三猿のイメージです。", "pattern": true },
  { "set": 1, "original": "青面金剛", "rename": "青面金剛", "base": "shomen", "description": "青面金剛のイメージです。", "pattern": true },
  { "set": 1, "original": "道祖神", "rename": "道祖神", "base": "dosojin", "description": "双体道祖神のイメージです。", "pattern": true },
  { "set": 1, "original": "月待塔", "rename": "月待塔", "base": "tsukimachi", "description": "月待塔のイメージです。", "pattern": true },
  { "set": 1, "original": "富士塚", "rename": "富士講", "base": "fujiko", "description": "富士講の信仰対象、富士山のイメージです。", "pattern": true },
  { "set": 1, "original": "山岳信仰碑", "rename": "山岳信仰", "base": "mount", "description": "大峰、愛宕、出羽三山など山岳信仰のイメージです。", "pattern": true },
  { "set": 1, "original": "小神社", "rename": "小神社", "base": "shrine", "description": "石造物ではないですが、奈良の調査で対象にしている関係で作成しました。鳥居や敷地を持つ小神社のイメージです。", "pattern": true },
  { "set": 1, "original": "祠", "rename": "小祠", "base": "hokora", "description": "石造物ではないですが、奈良の調査で対象にしている関係で作成しました。春日造の小祠のイメージです。", "pattern": true },
  { "set": 1, "original": "石祠", "rename": "石祠", "base": "sekishi", "description": "石造流造小祠のイメージです。", "pattern": true },
  { "set": 1, "original": "石神お塚", "rename": "石神", "base": "sekijin", "description": "稲荷神社や、龍神水神などによく見られる石神、お塚のイメージです。", "pattern": true },
  { "set": 1, "original": "神木", "rename": "神木", "base": "tree", "description": "神木や野神など、信仰対象植物のイメージです。", "pattern": true },
  { "set": 1, "original": "忠魂碑", "rename": "忠魂碑", "base": "chukonhi", "description": "戦前によく見られた、篆書で碑銘が書かれた記念碑のイメージです。", "pattern": true },
  { "set": 1, "original": "記念碑", "rename": "記念碑", "base": "kinenhi", "description": "戦後によく見られる、黒光りする鏡面を持つ記念碑のイメージです。", "pattern": true },
  { "set": 1, "original": "道標", "rename": "道標", "base": "dohyo", "description": "道標とよくわかるよう、道案内板のイメージで描きました。", "pattern": true },
  { "set": 1, "original": "石造物", "rename": "石造物", "base": "stone", "description": "上記で用意されていない「その他石造物」のイメージです。", "pattern": true },
  { "set": 1, "original": "新規報告", "rename": "新規", "base": "new", "description": "新規地物の投稿用、新規地物を示すアイコンです。", "pattern": false },
  { "set": 2, "original": "キリシタン灯篭", "rename": "キリシタン灯篭", "base": "christ_lantern", "description": "キリシタン灯篭のイメージです。", "pattern": true },
  { "set": 2, "original": "暗渠", "rename": "暗渠", "base": "culvert", "description": "石造物ではないですが、観光案内POIデータセットで利用する関係で作成しました。暗渠から開渠になる箇所のイメージです。", "pattern": true },
  { "set": 2, "original": "石標", "rename": "石標", "base": "stone_display", "description": "寺名標や社名標、下馬標など、石標のイメージです。", "pattern": true },
  { "set": 2, "original": "石灯篭", "rename": "石灯篭", "base": "stone_lantern", "description": "石灯籠のイメージです。", "pattern": true },
  { "set": 2, "original": "手水鉢", "rename": "手水鉢", "base": "stone_bowl", "description": "石で作られた手水鉢のイメージです。", "pattern": true },
  { "set": 2, "original": "欄干", "rename": "欄干", "base": "balustrade", "description": "暗渠化などで道端に残った橋の欄干や、橋跡を示す碑などに用いるイメージです。", "pattern": true },
  { "set": 2, "original": "路地", "rename": "路地", "base": "alley", "description": "石造物ではないですが、観光案内POIデータセットで利用する関係で作成しました。街中の小さな路地のイメージです。", "pattern": true },
  { "set": 2, "original": "坂", "rename": "坂", "base": "slope", "description": "石造物ではないですが、観光案内POIデータセットで利用する関係で作成しました。街中の小さな坂のイメージです。", "pattern": true },
  { "set": 2, "original": "日待塔", "rename": "日待塔", "base": "himachi", "description": "日の出をデザインした、甲子塔や巳待塔など、日待塔に用いるイメージです。", "pattern": true },
  { "set": 2, "original": "狛犬", "rename": "狛犬", "base": "komainu", "description": "神社に存在する狛犬のイメージです。", "pattern": true },
  { "set": 2, "original": "石鳥居", "rename": "石鳥居", "base": "stone_torii", "description": "石で作られた鳥居のイメージです。", "pattern": true },
  { "set": 2, "original": "墓", "rename": "墓碑", "base": "tomb", "description": "墓石のイメージです。", "pattern": true },
  { "set": 2, "original": "石塔", "rename": "石塔", "base": "stone_tower", "description": "石で作られた仏塔のイメージです。", "pattern": true },
  { "set": 2, "original": "神使", "rename": "神使", "base": "god_minions", "description": "稲荷の狐、天神の牛など、狛犬以外の神使のイメージです。", "pattern": true },
  { "set": 2, "original": "三界万霊塔", "rename": "三界万霊塔", "base": "banrei", "description": "三界万霊塔や無縁供養塔のイメージです。", "pattern": true }
];

const patterns = [
  {"id": "no", "suffix": "", "remove": []},
  {"id": "normal", "suffix": "", "remove": ["画像なし", "要調査", "消失"]},
  {"id": "missing", "suffix": "_missing", "remove": ["画像なし", "要調査"]},
  {"id": "action", "suffix": "_action", "remove": ["画像なし", "消失"]},
  {"id": "noimg", "suffix": "_noimg", "remove": ["要調査", "消失"]}
];

const convert_src = [];

convert_set.forEach((line, index) => {
  const original = line.original;
  const rename = line.rename;
  const base = line.base;
  const description = line.description;
  const set = line.set;
  const l_patterns = patterns.filter((pat) => {
    return pat.id === "no" ? !line.pattern : line.pattern;
  });
  const xml = fs.readFileSync(`./dest/${original}.svg`, "utf-8");
  console.log(original);
  console.log(l_patterns);
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
    fs.writeFileSync(out_file, doc.toString(), "utf-8");
  });
});

svg_to_png.convert(convert_src, path.resolve(__dirname, "./png"), {defaultWidth: 28, defaultHeight: 40}) // async, returns promise
  .then( function(){
    // Do tons of stuff
  });


/*const converter = new Converter()
  .import("svg")
  .export("png", ["28x40"]);

converter.run("./svg", "./png");
*/
