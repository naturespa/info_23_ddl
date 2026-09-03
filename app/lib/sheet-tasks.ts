// 応用ミッションにつける、表計算の練習問題。
// 単元ごとに、その単元で出てくる関数を練習できるようにしてある。
// 答えの値は、同じデータで実際に計算して確かめた数値。

import type { SheetData } from "./sheet";
import type { SheetTask } from "./mini-sheet";

export type SheetDrill = { data: SheetData; tasks: SheetTask[]; caption?: string };

export const sheetDrills: Record<string, SheetDrill> = {
  /* ---------- A1 データの種類と度数分布 ---------- */
  organize: {
    caption: "数える系の関数（COUNT・COUNTA・COUNTIF）を練習します。",
    data: {
      header: ["番号", "得点", "通学手段"],
      rows: [
        [1205, 62, "電車"],
        [1206, 75, "自転車"],
        [1207, 48, "徒歩"],
        [1208, 90, "電車"],
        [1209, 55, "自転車"],
        [1210, 71, "電車"],
        [1211, 83, "徒歩"],
        [1212, 66, "自転車"],
        [1213, 58, "電車"],
        [1214, 77, "電車"]
      ]
    },
    tasks: [
      {
        ask: "① 得点が入っているセルが何個あるか（＝データの個数）を求めなさい。",
        functions: ["COUNT"],
        answer: 10,
        note: "COUNT は「数値が入っているセル」を数えます。空欄や文字は数えません。",
        sample: "=COUNT(B2:B11)"
      },
      {
        ask: "② 得点が70点以上の人が何人いるかを求めなさい。",
        functions: ["COUNTIF"],
        answer: 5,
        note: "COUNTIF(範囲, 条件) で、条件に合うセルだけを数えられます。度数分布表は、これを階級の数だけ並べたものです。",
        sample: '=COUNTIF(B2:B11,">=70")'
      },
      {
        ask: "③ 通学手段が「電車」の人が何人いるかを求めなさい。",
        functions: ["COUNTIF"],
        answer: 5,
        note: "文字の条件も同じように書けます。質的データの集計は、この形が基本です。",
        sample: '=COUNTIF(C2:C11,"電車")'
      }
    ]
  },

  /* ---------- A2 代表値と四分位数 ---------- */
  center: {
    caption: "代表値の関数（SUM・AVERAGE・MEDIAN・MODE.SNGL・MAX・MIN）を練習します。",
    data: {
      header: ["番号", "点数"],
      rows: [
        [1, 2],
        [2, 3],
        [3, 3],
        [4, 4],
        [5, 8],
        [6, 3],
        [7, 5],
        [8, 4],
        [9, 9],
        [10, 4]
      ]
    },
    tasks: [
      {
        ask: "① 点数の合計を求めなさい。",
        functions: ["SUM"],
        answer: 45,
        note: "SUM は合計。平均は、この合計を個数で割った値です。",
        sample: "=SUM(B2:B11)"
      },
      {
        ask: "② 点数の平均値を求めなさい。",
        functions: ["AVERAGE"],
        answer: 4.5,
        note: "=SUM(B2:B11)/COUNT(B2:B11) と書いても同じ値になります。AVERAGE はその近道です。",
        sample: "=AVERAGE(B2:B11)"
      },
      {
        ask: "③ 中央値を求めなさい。平均値とちがう値になるはずです。",
        functions: ["MEDIAN"],
        answer: 4,
        note: "平均4.5、中央値4。8や9という大きい値に平均だけが引っぱられています。",
        sample: "=MEDIAN(B2:B11)"
      },
      {
        ask: "④ 最頻値（いちばん多く出てくる値）を求めなさい。",
        functions: ["MODE.SNGL", "MODE"],
        answer: 3,
        note: "3が3回で最多です。MODE.SNGL は、いちばん多い値を1つだけ返します。",
        sample: "=MODE.SNGL(B2:B11)"
      },
      {
        ask: "⑤ 最大値から最小値を引いた値（範囲）を求めなさい。",
        functions: ["MAX", "MIN"],
        answer: 7,
        note: "9 − 2 ＝ 7。範囲は、いちばん単純な散らばりの指標です。",
        sample: "=MAX(B2:B11)-MIN(B2:B11)"
      }
    ]
  },

  /* ---------- A3 分散・標準偏差と偏差値 ---------- */
  spread: {
    caption: "散らばりの関数（VAR.P・STDEV.P）を練習します。平均が同じ2クラスのデータです。",
    data: {
      header: ["番号", "1組", "2組"],
      rows: [
        [1, 48, 30],
        [2, 49, 40],
        [3, 50, 50],
        [4, 51, 60],
        [5, 52, 70]
      ]
    },
    tasks: [
      {
        ask: "① 1組と2組の平均を、それぞれ求めなさい。まず1組から。",
        functions: ["AVERAGE"],
        answer: 50,
        note: "2組も =AVERAGE(C2:C6) で50。平均は同じです。",
        sample: "=AVERAGE(B2:B6)"
      },
      {
        ask: "② 1組の分散を求めなさい（クラス全員ぶんのデータなので VAR.P を使います）。",
        functions: ["VAR.P", "VARP"],
        answer: 2,
        note: "分散は「偏差の2乗の平均」。VAR.P はその計算をまとめてやってくれます。",
        sample: "=VAR.P(B2:B6)"
      },
      {
        ask: "③ 2組の標準偏差を求めなさい。",
        functions: ["STDEV.P", "STDEVP"],
        answer: 14.1421,
        note: "1組は約1.41、2組は約14.14。平均が同じでも、散らばりは10倍ちがいます。",
        sample: "=STDEV.P(C2:C6)"
      },
      {
        ask: "④ 2組の3番の人（50点）の偏差値を求めなさい。50 ＋ 10 ×（得点 − 平均）÷ 標準偏差 です。",
        functions: ["AVERAGE", "STDEV.P", "STDEVP"],
        answer: 50,
        note: "平均ちょうどの人の偏差値は必ず50になります。散らばりがいくつでも、ここは変わりません。",
        sample: "=50+10*(C4-AVERAGE(C2:C6))/STDEV.P(C2:C6)"
      }
    ]
  },

  /* ---------- A4 確率分布と正規分布 ---------- */
  normal: {
    caption: "平均と標準偏差から、z得点と偏差値を組み立てます。",
    data: {
      header: ["番号", "得点"],
      rows: [
        [1, 52],
        [2, 61],
        [3, 48],
        [4, 73],
        [5, 55],
        [6, 67],
        [7, 80],
        [8, 59],
        [9, 64],
        [10, 70]
      ]
    },
    tasks: [
      {
        ask: "① 得点の平均を求めなさい。",
        functions: ["AVERAGE"],
        answer: 62.9,
        note: "この値が、正規分布の μ にあたります。",
        sample: "=AVERAGE(B2:B11)"
      },
      {
        ask: "② 得点の標準偏差を求めなさい（この10人が全員なので STDEV.P）。",
        functions: ["STDEV.P", "STDEVP"],
        answer: 9.4069,
        note: "この値が σ にあたります。μ と σ の2つで、山の形が決まります。",
        sample: "=STDEV.P(B2:B11)"
      },
      {
        ask: "③ 4番の人（73点）の z得点を求めなさい。（得点 − 平均）÷ 標準偏差 です。",
        functions: ["AVERAGE", "STDEV.P", "STDEVP"],
        answer: 1.0737,
        note: "平均から標準偏差1個ぶんより少し上、ということ。上位およそ14%の位置です。",
        sample: "=(B5-AVERAGE(B2:B11))/STDEV.P(B2:B11)"
      },
      {
        ask: "④ 同じ人の偏差値を求めなさい。50 ＋ 10 × z です。",
        functions: ["AVERAGE", "STDEV.P", "STDEVP"],
        answer: 60.7368,
        note: "z得点を、見慣れた偏差値に言い直しただけです。中身は同じものです。",
        sample: "=50+10*(B5-AVERAGE(B2:B11))/STDEV.P(B2:B11)"
      }
    ]
  },

  /* ---------- A5 相関・回帰と因果関係 ---------- */
  relation: {
    caption: "2つの列の関係を1つの数にする関数（CORREL）を練習します。",
    data: {
      header: ["月", "自習時間", "小テスト"],
      rows: [
        [1, 1, 62],
        [2, 2, 64],
        [3, 3, 66],
        [4, 4, 70],
        [5, 5, 71],
        [6, 6, 75],
        [7, 7, 78],
        [8, 8, 80]
      ]
    },
    tasks: [
      {
        ask: "① 自習時間と小テストの相関係数を求めなさい。",
        functions: ["CORREL"],
        answer: 0.9953,
        note: "1に近いので、強い正の相関です。ただし「だから自習が原因だ」とは、これだけでは言えません。",
        sample: "=CORREL(B2:B9,C2:C9)"
      },
      {
        ask: "② 小テストの平均点を求めなさい。",
        functions: ["AVERAGE"],
        answer: 70.75,
        note: "相関を見るときも、まず平均と散らばりを押さえておきます。",
        sample: "=AVERAGE(C2:C9)"
      },
      {
        ask: "③ 小テストが70点以上だった月が何回あるかを求めなさい。",
        functions: ["COUNTIF"],
        answer: 5,
        note: "散布図の右上に集まっている点の数と一致します。",
        sample: '=COUNTIF(C2:C9,">=70")'
      }
    ]
  },

  /* ---------- A6 乱数とシミュレーション ---------- */
  simulation: {
    caption: "試行の結果を数える練習です。シミュレーションの集計は、ほぼこの形です。",
    data: {
      header: ["回", "出た目"],
      rows: [
        [1, 3],
        [2, 6],
        [3, 1],
        [4, 4],
        [5, 4],
        [6, 2],
        [7, 5],
        [8, 6],
        [9, 3],
        [10, 4],
        [11, 2],
        [12, 6],
        [13, 5],
        [14, 1],
        [15, 4],
        [16, 3],
        [17, 6],
        [18, 2],
        [19, 4],
        [20, 5]
      ]
    },
    tasks: [
      {
        ask: "① 何回ふったかを求めなさい。",
        functions: ["COUNT"],
        answer: 20,
        note: "試行回数です。これが分母になります。",
        sample: "=COUNT(B2:B21)"
      },
      {
        ask: "② 4の目が出た回数を求めなさい。",
        functions: ["COUNTIF"],
        answer: 5,
        note: "20回中5回なので、割合は0.25。理論値の 1/6 ≒ 0.167 より多く出ています。",
        sample: '=COUNTIF(B2:B21,4)'
      },
      {
        ask: "③ 5以上の目が出た割合を求めなさい（回数 ÷ 試行回数）。",
        functions: ["COUNTIF"],
        answer: 0.35,
        note: "理論値は 2/6 ≒ 0.333。20回では、まだこれくらいずれます。回数を増やすほど理論値に近づきます。",
        sample: '=COUNTIF(B2:B21,">=5")/COUNT(B2:B21)'
      }
    ]
  },

  /* ---------- A7 仮説検定と区間推定 ---------- */
  test: {
    caption: "検定の前に必要な、平均・不偏分散・個数を求める練習です。",
    data: {
      header: ["番号", "A組", "B組"],
      rows: [
        [1, 72, 65],
        [2, 68, 60],
        [3, 75, 70],
        [4, 80, 63],
        [5, 66, 58],
        [6, 71, 67],
        [7, 78, 62],
        [8, 74, 69]
      ]
    },
    tasks: [
      {
        ask: "① A組の平均を求めなさい。",
        functions: ["AVERAGE"],
        answer: 73,
        note: "B組は =AVERAGE(C2:C9) で64.25。差は8.75点です。",
        sample: "=AVERAGE(B2:B9)"
      },
      {
        ask: "② A組の分散を求めなさい。ここは「全体から取り出した一部」なので VAR.S を使います。",
        functions: ["VAR.S", "VAR"],
        answer: 22.5714,
        note: "標本から母集団を推測するときは、n ではなく n−1 で割ります（不偏分散）。VAR.P とはちがう値になります。",
        sample: "=VAR.S(B2:B9)"
      },
      {
        ask: "③ B組の標準偏差（不偏）を求めなさい。",
        functions: ["STDEV.S", "STDEV"],
        answer: 4.2678,
        note: "平均の差8.75点が、この散らばりに対して大きいかどうかを判断するのが検定です。",
        sample: "=STDEV.S(C2:C9)"
      },
      {
        ask: "④ 2組の平均の差（A組 − B組）を求めなさい。",
        functions: ["AVERAGE"],
        answer: 8.75,
        note: "この差を、標準誤差で割ったものが t 値になります。",
        sample: "=AVERAGE(B2:B9)-AVERAGE(C2:C9)"
      }
    ]
  },

  /* ---------- A8 時系列データとAIによる分析 ---------- */
  timeseries: {
    caption: "移動平均と前年比を、式で組み立てる練習です。",
    data: {
      header: ["年", "来場者数"],
      rows: [
        [2016, 120],
        [2017, 132],
        [2018, 128],
        [2019, 145],
        [2020, 150],
        [2021, 148],
        [2022, 161],
        [2023, 170],
        [2024, 168],
        [2025, 180]
      ]
    },
    tasks: [
      {
        ask: "① 2016年から2018年までの3期間移動平均を求めなさい（3つの平均）。",
        functions: ["AVERAGE"],
        answer: 126.6667,
        note: "移動平均とは、範囲を1つずつずらしながらこの計算をくり返したものです。",
        sample: "=AVERAGE(B2:B4)"
      },
      {
        ask: "② 2016年から2020年までの5期間移動平均を求めなさい。",
        functions: ["AVERAGE"],
        answer: 135,
        note: "平均する年数を広げるほど、なめらかになります。そのぶん両端で計算できない年が増えます。",
        sample: "=AVERAGE(B2:B6)"
      },
      {
        ask: "③ 2025年は2024年の何倍かを求めなさい（前年比）。",
        functions: [],
        answer: 1.0714,
        note: "1より大きいので増えています。%にするなら、1を引いて100をかけて 約7.1% 増です。",
        sample: "=B11/B10"
      },
      {
        ask: "④ 10年間の来場者数の合計を求めなさい。",
        functions: ["SUM"],
        answer: 1502,
        note: "合計を出したあと、=SUM(B2:B11)/COUNT(B2:B11) とすれば10年の平均も出せます。",
        sample: "=SUM(B2:B11)"
      }
    ]
  }
};
