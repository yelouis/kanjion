/**
 * Case-insensitive glyph mapping with symbol & keyword representations.
 */
export const GLYPH_DICTIONARY: Record<string, string[]> = {
  '🍀': ['clover', '🍀', 'クローバー'],
  '◯': ['circle', '◯', '○', 'maru', 'まる'],
  '△': ['triangle', '△', 'sankaku', 'さんかく'],
  '×': ['cross', '×', 'batsu', 'ばつ'],
  '▶': ['arrow', '▶', 'right arrow', '確定へ'],
  '◀': ['left arrow', '◀', 'back arrow', '戻る'],
};

/**
 * Color dictionary mapping canonical colors to English, Romaji, and Japanese tokens.
 */
export const COLOR_DICTIONARY: Record<string, string[]> = {
  green: ['green', 'emerald', 'midori', 'みどり', '緑', '#059669', 'グリーン'],
  red: ['red', 'aka', 'あか', '赤', '赤ボタン', '#dc2626'],
  blue: ['blue', 'ao', 'あお', '青', '#2563eb'],
  white: ['white', 'shiro', '白', '#ffffff'],
  gray: ['gray', 'grey', 'haiiro', 'グレー', '灰', '#f5f5f5', '#d4d4d4'],
  grey: ['gray', 'grey', 'haiiro', 'グレー', '灰', '#f5f5f5', '#d4d4d4'],
};
