// 文字化けの実物データ（D6 実験3）。
// ブラウザには Shift_JIS や EUC-JP の変換表が入っていないので、
// 実際に各方式で保存して別の方式で読み直した結果を、あらかじめ計算して置いてある。
// （Python の cp932 / euc_jp / utf-8 / utf-16-be で生成）

export type MojibakeSample = {
  text: string;
  bytes: Record<string, { hex: string; bytes: number }>;
  /** 「保存した方式>読んだ方式」→ 画面に出る文字列 */
  pairs: Record<string, string>;
};

export const MOJIBAKE_ENCODINGS = ["UTF-8", "Shift_JIS", "EUC-JP", "UTF-16"] as const;

export const mojibakeSamples: MojibakeSample[] = [
  {
    "text": "情報AI 2026",
    "bytes": {
      "UTF-8": {
        "hex": "E6 83 85 E5 A0 B1 41 49 20 32 30 32 36",
        "bytes": 13
      },
      "Shift_JIS": {
        "hex": "8F EE 95 F1 41 49 20 32 30 32 36",
        "bytes": 11
      },
      "EUC-JP": {
        "hex": "BE F0 CA F3 41 49 20 32 30 32 36",
        "bytes": 11
      },
      "UTF-16": {
        "hex": "60 C5 58 31 00 41 00 49 00 20 00 32 00 30 00 32 00 36",
        "bytes": 18
      }
    },
    "pairs": {
      "UTF-8>UTF-8": "情報AI 2026",
      "UTF-8>Shift_JIS": "諠�蝣ｱAI 2026",
      "UTF-8>EUC-JP": "������AI 2026",
      "UTF-8>UTF-16": "藥ꂱ䅉′〲�",
      "Shift_JIS>UTF-8": "���AI 2026",
      "Shift_JIS>Shift_JIS": "情報AI 2026",
      "Shift_JIS>EUC-JP": "����AI 2026",
      "Shift_JIS>UTF-16": "迮闱䅉′〲�",
      "EUC-JP>UTF-8": "����AI 2026",
      "EUC-JP>Shift_JIS": "ｾI 2026",
      "EUC-JP>EUC-JP": "情報AI 2026",
      "EUC-JP>UTF-16": "뻰쫳䅉′〲�",
      "UTF-16>UTF-8": "`�X1AI 2026",
      "UTF-16>Shift_JIS": "`ﾅX1AI 2026",
      "UTF-16>EUC-JP": "`�X1AI 2026",
      "UTF-16>UTF-16": "情報AI 2026"
    }
  },
  {
    "text": "明石南高校",
    "bytes": {
      "UTF-8": {
        "hex": "E6 98 8E E7 9F B3 E5 8D 97 E9 AB 98 E6 A0 A1",
        "bytes": 15
      },
      "Shift_JIS": {
        "hex": "96 BE 90 CE 93 EC 8D 82 8D 5A",
        "bytes": 10
      },
      "EUC-JP": {
        "hex": "CC C0 C0 D0 C6 EE B9 E2 B9 BB",
        "bytes": 10
      },
      "UTF-16": {
        "hex": "66 0E 77 F3 53 57 9A D8 68 21",
        "bytes": 10
      }
    },
    "pairs": {
      "UTF-8>UTF-8": "明石南高校",
      "UTF-8>Shift_JIS": "譏守浹蜊鈴ｫ俶｡",
      "UTF-8>EUC-JP": "�����喝��蕭����",
      "UTF-8>UTF-16": "軧龳韩ꮘ�",
      "Shift_JIS>UTF-8": "���Γ썂�Z",
      "Shift_JIS>Shift_JIS": "明石南高校",
      "Shift_JIS>EUC-JP": "���������Z",
      "Shift_JIS>UTF-16": "难郎鏬趂赚",
      "EUC-JP>UTF-8": "������⹻",
      "EUC-JP>Shift_JIS": "ﾌﾀﾀﾐﾆ鋠篁ｻ",
      "EUC-JP>EUC-JP": "明石南高校",
      "EUC-JP>UTF-16": "쳀샐웮맢릻",
      "UTF-16>UTF-8": "fw�SW��h!",
      "UTF-16>Shift_JIS": "fwW壓h!",
      "UTF-16>EUC-JP": "fw�SW��h!",
      "UTF-16>UTF-16": "明石南高校"
    }
  },
  {
    "text": "こんにちは 2026",
    "bytes": {
      "UTF-8": {
        "hex": "E3 81 93 E3 82 93 E3 81 AB E3 81 A1 E3 81 AF 20 32 30 32 36",
        "bytes": 20
      },
      "Shift_JIS": {
        "hex": "82 B1 82 F1 82 C9 82 BF 82 CD 20 32 30 32 36",
        "bytes": 15
      },
      "EUC-JP": {
        "hex": "A4 B3 A4 F3 A4 CB A4 C1 A4 CF 20 32 30 32 36",
        "bytes": 15
      },
      "UTF-16": {
        "hex": "30 53 30 93 30 6B 30 61 30 6F 00 20 00 32 00 30 00 32 00 36",
        "bytes": 20
      }
    },
    "pairs": {
      "UTF-8>UTF-8": "こんにちは 2026",
      "UTF-8>Shift_JIS": "縺薙ｓ縺ｫ縺｡縺ｯ 2026",
      "UTF-8>EUC-JP": "�����������＜�� 2026",
      "UTF-8>UTF-16": "鏣芓ꯣ膡꼠㈰㈶",
      "Shift_JIS>UTF-8": "����ɂ��� 2026",
      "Shift_JIS>Shift_JIS": "こんにちは 2026",
      "Shift_JIS>EUC-JP": "���������� 2026",
      "Shift_JIS>UTF-16": "花英苉芿苍′〲�",
      "EUC-JP>UTF-8": "����ˤ��� 2026",
      "EUC-JP>Shift_JIS": "､ｳ､ﾋ､ﾁ､ﾏ 2026",
      "EUC-JP>EUC-JP": "こんにちは 2026",
      "EUC-JP>UTF-16": "꒳ꓳ꓋꓁꓏′〲�",
      "UTF-16>UTF-8": "0S0�0k0a0o 2026",
      "UTF-16>Shift_JIS": "0S0�0k0a0o 2026",
      "UTF-16>EUC-JP": "0S0�0k0a0o 2026",
      "UTF-16>UTF-16": "こんにちは 2026"
    }
  },
  {
    "text": "Akashi 2026",
    "bytes": {
      "UTF-8": {
        "hex": "41 6B 61 73 68 69 20 32 30 32 36",
        "bytes": 11
      },
      "Shift_JIS": {
        "hex": "41 6B 61 73 68 69 20 32 30 32 36",
        "bytes": 11
      },
      "EUC-JP": {
        "hex": "41 6B 61 73 68 69 20 32 30 32 36",
        "bytes": 11
      },
      "UTF-16": {
        "hex": "00 41 00 6B 00 61 00 73 00 68 00 69 00 20 00 32 00 30 00 32 00 36",
        "bytes": 22
      }
    },
    "pairs": {
      "UTF-8>UTF-8": "Akashi 2026",
      "UTF-8>Shift_JIS": "Akashi 2026",
      "UTF-8>EUC-JP": "Akashi 2026",
      "UTF-8>UTF-16": "䅫慳桩′〲�",
      "Shift_JIS>UTF-8": "Akashi 2026",
      "Shift_JIS>Shift_JIS": "Akashi 2026",
      "Shift_JIS>EUC-JP": "Akashi 2026",
      "Shift_JIS>UTF-16": "䅫慳桩′〲�",
      "EUC-JP>UTF-8": "Akashi 2026",
      "EUC-JP>Shift_JIS": "Akashi 2026",
      "EUC-JP>EUC-JP": "Akashi 2026",
      "EUC-JP>UTF-16": "䅫慳桩′〲�",
      "UTF-16>UTF-8": "Akashi 2026",
      "UTF-16>Shift_JIS": "Akashi 2026",
      "UTF-16>EUC-JP": "Akashi 2026",
      "UTF-16>UTF-16": "Akashi 2026"
    }
  }
];
