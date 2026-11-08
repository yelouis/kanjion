import type { ElementDef, PuzzleData } from '../../../types/puzzle_data';

const NAV_NEWS_ELEMENT: ElementDef = {
  mark: 11,
  key: 'nav_news',
  role: 'button',
  label: 'お知らせ',
  effects: {
    CLICK: [{ op: 'navigate', pageId: 'MV-08' }],
  },
};

const PROMO_INSURANCE_ELEMENT: ElementDef = {
  mark: 12,
  key: 'promo_insurance',
  role: 'button',
  label: '今すぐ申し込む',
  visual: { color: 'red' },
  effects: {
    CLICK: [
      { op: 'set', field: 'insuranceAttached', value: true },
      { op: 'shake' },
    ],
  },
};

function makePageTitle(label: string): ElementDef {
  return {
    mark: 90,
    key: 'page_title',
    role: 'heading',
    label,
    effects: {},
  };
}

export const CASE_001_PUZZLE: PuzzleData = {
  id: '001',
  caseNumber: '#001',
  title: 'Tokyo–Osaka Shinkansen',
  initialPageId: 'MV-01',
  initialFields: {
    selectedRoute: 'none',
    passengerName: '',
    trainName: 'none',
    seatClass: 'none',
    fare: 0,
    greenCarSelected: false,
    timedWindowHit: false,
    signatureStroke: '',
    insuranceAttached: false,
    finalConfirmed: false,
    confirmedWithInsurance: false,
  },
  pages: [
    {
      id: 'MV-01',
      slug: 'route-select',
      title: 'STEP 1: ご利用になる新幹線路線を選択してください',
      elements: [
        NAV_NEWS_ELEMENT,
        PROMO_INSURANCE_ELEMENT,
        makePageTitle('STEP 1: ご利用になる新幹線路線を選択してください'),
        {
          mark: 1,
          key: 'route_tokaido',
          role: 'card',
          label: '東海道新幹線 東京⇒新大阪',
          visual: { color: 'green' },
          effects: {
            CLICK: [
              { op: 'set', field: 'selectedRoute', value: 'tokyo_osaka' },
              { op: 'navigate', pageId: 'MV-02' },
            ],
          },
        },
        {
          mark: 2,
          key: 'route_tohoku',
          role: 'card',
          label: '東北・北海道新幹線',
          effects: {
            CLICK: [
              { op: 'set', field: 'selectedRoute', value: 'tohoku' },
              { op: 'navigate', pageId: 'MV-10' },
            ],
          },
        },
        {
          mark: 3,
          key: 'route_hokuriku',
          role: 'card',
          label: '北陸・上越新幹線',
          effects: {
            CLICK: [
              { op: 'set', field: 'selectedRoute', value: 'hokuriku' },
              { op: 'navigate', pageId: 'MV-11' },
            ],
          },
        },
        {
          mark: 4,
          key: 'route_points',
          role: 'card',
          label: 'かんじおんポイント・ICカード連携',
          effects: {
            CLICK: [{ op: 'navigate', pageId: 'MV-12' }],
          },
        },
      ],
    },
    {
      id: 'MV-02',
      slug: 'passenger',
      title: 'STEP 2: 乗車条件・搭乗者名（ローマ字）の入力',
      elements: [
        NAV_NEWS_ELEMENT,
        PROMO_INSURANCE_ELEMENT,
        makePageTitle('STEP 2: 乗車条件・搭乗者名（ローマ字）の入力'),
        {
          mark: 14,
          key: 'back',
          role: 'button',
          label: '◀ 路線選択へ戻る',
          effects: {
            CLICK: [
              { op: 'set', field: 'selectedRoute', value: 'none' },
              { op: 'set', field: 'passengerName', value: '' },
              { op: 'navigate', pageId: 'MV-01' },
            ],
          },
        },
        {
          mark: 17,
          key: 'passenger_name',
          role: 'input',
          label: '搭乗者名',
          effects: {
            TYPE: [
              { op: 'setFromText', field: 'passengerName' },
              { op: 'navigate', pageId: 'MV-03' },
            ],
          },
        },
      ],
    },
    {
      id: 'MV-03',
      slug: 'seats',
      title: 'STEP 3: 列車・座席指定（タイムセール特割 空席照会）',
      elements: [
        NAV_NEWS_ELEMENT,
        PROMO_INSURANCE_ELEMENT,
        makePageTitle('STEP 3: 列車・座席指定（タイムセール特割 空席照会）'),
        {
          mark: 14,
          key: 'back',
          role: 'button',
          label: '◀ 条件変更',
          effects: {
            CLICK: [{ op: 'navigate', pageId: 'MV-02' }],
          },
        },
        {
          mark: 21,
          key: 'seat_hikari_free',
          role: 'button',
          label: '◯ ¥13,870',
          visual: { color: 'white', glyphs: ['◯'], row: 1, column: 1 },
          effects: {
            CLICK: [
              { op: 'set', field: 'trainName', value: 'Hikari 515' },
              { op: 'set', field: 'seatClass', value: 'ordinary_free' },
              { op: 'set', field: 'fare', value: 13870 },
              { op: 'set', field: 'greenCarSelected', value: false },
            ],
          },
        },
        {
          mark: 22,
          key: 'seat_hikari_reserved',
          role: 'button',
          label: '△ ¥14,520',
          visual: { glyphs: ['△'], row: 1, column: 2 },
          effects: {
            CLICK: [
              { op: 'set', field: 'trainName', value: 'Hikari 515' },
              { op: 'set', field: 'seatClass', value: 'ordinary_reserved' },
              { op: 'set', field: 'fare', value: 14520 },
              { op: 'set', field: 'greenCarSelected', value: false },
            ],
          },
        },
        {
          mark: 23,
          key: 'seat_nozomi_free',
          role: 'button',
          label: '◯ ¥13,870',
          visual: { color: 'white', glyphs: ['◯'], row: 2, column: 1 },
          effects: {
            CLICK: [
              { op: 'set', field: 'trainName', value: 'Nozomi 24' },
              { op: 'set', field: 'seatClass', value: 'ordinary_free' },
              { op: 'set', field: 'fare', value: 13870 },
              { op: 'set', field: 'greenCarSelected', value: false },
            ],
          },
        },
        {
          mark: 24,
          key: 'seat_nozomi_reserved',
          role: 'button',
          label: '◯ ¥14,720',
          visual: { glyphs: ['◯'], row: 2, column: 2 },
          effects: {
            CLICK: [
              { op: 'set', field: 'trainName', value: 'Nozomi 24' },
              { op: 'set', field: 'seatClass', value: 'ordinary_reserved' },
              { op: 'set', field: 'fare', value: 14720 },
              { op: 'set', field: 'greenCarSelected', value: false },
            ],
          },
        },
        {
          mark: 25,
          key: 'seat_nozomi_green',
          role: 'button',
          label: '🍀 ◯ ¥13,870 (特割)',
          visual: { color: 'green', glyphs: ['🍀', '◯'], row: 2, column: 3, timedColumn: 2 },
          effects: {
            CLICK: [
              { op: 'set', field: 'trainName', value: 'Nozomi 24' },
              { op: 'set', field: 'seatClass', value: 'green_car' },
              { op: 'set', field: 'fare', value: 19590 },
              { op: 'set', field: 'greenCarSelected', value: true },
              { op: 'set', field: 'timedWindowHit', value: false },
              { op: 'navigate', pageId: 'MV-04' },
            ],
            TIMED_CLICK: [
              { op: 'set', field: 'trainName', value: 'Nozomi 24' },
              { op: 'set', field: 'seatClass', value: 'green_car' },
              { op: 'set', field: 'fare', value: 13870 },
              { op: 'set', field: 'greenCarSelected', value: true },
              { op: 'set', field: 'timedWindowHit', value: true },
              { op: 'navigate', pageId: 'MV-04' },
            ],
          },
        },
      ],
    },
    {
      id: 'MV-04',
      slug: 'confirm',
      title: 'STEP 4: ご予約内容の確認・本人自署サイン',
      elements: [
        NAV_NEWS_ELEMENT,
        PROMO_INSURANCE_ELEMENT,
        makePageTitle('STEP 4: ご予約内容の確認・本人自署サイン'),
        {
          mark: 14,
          key: 'back',
          role: 'button',
          label: '◀ 座席表へ戻る',
          effects: {
            CLICK: [
              { op: 'set', field: 'trainName', value: 'none' },
              { op: 'set', field: 'seatClass', value: 'none' },
              { op: 'set', field: 'fare', value: 0 },
              { op: 'set', field: 'greenCarSelected', value: false },
              { op: 'set', field: 'timedWindowHit', value: false },
              { op: 'navigate', pageId: 'MV-03' },
            ],
          },
        },
        {
          mark: 27,
          key: 'signature_pad',
          role: 'canvas',
          label: '自署・サイン欄',
          effects: {
            DRAW: [{ op: 'setFromStroke', field: 'signatureStroke' }],
          },
        },
        {
          mark: 28,
          key: 'insurance_checkbox',
          role: 'checkbox',
          label: '旅行キャンセル保険を追加',
          effects: {
            CLICK: [{ op: 'toggle', field: 'insuranceAttached' }],
          },
        },
        {
          mark: 29,
          key: 'cancel_booking',
          role: 'button',
          label: '予約を取消',
          visual: { color: 'grey' },
          effects: {
            CLICK: [{ op: 'navigate', pageId: 'MV-07' }],
          },
        },
        {
          mark: 30,
          key: 'confirm_booking',
          role: 'button',
          label: '予約内容を確認・確定へ ▶',
          visual: { color: 'blue', glyphs: ['▶'] },
          effects: {
            CLICK: [
              { op: 'set', field: 'finalConfirmed', value: true },
              { op: 'copy', from: 'insuranceAttached', to: 'confirmedWithInsurance' },
              { op: 'navigate', pageId: 'MV-05' },
            ],
          },
        },
      ],
    },
    {
      id: 'MV-05',
      slug: 'ticket',
      title: '🎉 新幹線 eチケットのご予約・発券が完了しました',
      elements: [
        NAV_NEWS_ELEMENT,
        PROMO_INSURANCE_ELEMENT,
        makePageTitle('🎉 新幹線 eチケットのご予約・発券が完了しました'),
      ],
    },
    {
      id: 'MV-07',
      slug: 'cancel',
      title: '予約を取り消しますか？',
      elements: [
        makePageTitle('予約を取り消しますか？'),
        {
          mark: 71,
          key: 'cancel_confirm',
          role: 'button',
          label: '取り消す',
          effects: {
            CLICK: [
              { op: 'resetFields' },
              { op: 'navigate', pageId: 'MV-01' },
            ],
          },
        },
        {
          mark: 72,
          key: 'cancel_dismiss',
          role: 'button',
          label: '戻る',
          effects: {
            CLICK: [{ op: 'navigate', pageId: 'MV-04' }],
          },
        },
      ],
    },
    {
      id: 'MV-08',
      slug: 'news',
      title: 'お知らせ',
      elements: [
        NAV_NEWS_ELEMENT,
        PROMO_INSURANCE_ELEMENT,
        makePageTitle('お知らせ'),
        {
          mark: 81,
          key: 'news_back',
          role: 'button',
          label: '◀ 戻る',
          effects: {
            CLICK: [{ op: 'navigate', pageId: '$previous' }],
          },
        },
      ],
    },
    {
      id: 'MV-10',
      slug: 'tohoku',
      title: '東北・北海道新幹線（東京 ⇒ 仙台・新青森・新函館北斗）',
      elements: [
        NAV_NEWS_ELEMENT,
        PROMO_INSURANCE_ELEMENT,
        makePageTitle('東北・北海道新幹線（東京 ⇒ 仙台・新青森・新函館北斗）'),
        {
          mark: 14,
          key: 'back',
          role: 'button',
          label: '◀ 路線選択トップへ戻る',
          effects: {
            CLICK: [
              { op: 'set', field: 'selectedRoute', value: 'none' },
              { op: 'navigate', pageId: 'MV-01' },
            ],
          },
        },
      ],
    },
    {
      id: 'MV-11',
      slug: 'hokuriku',
      title: '北陸・上越新幹線（東京 ⇒ 長野・金沢・敦賀 / 新潟）',
      elements: [
        NAV_NEWS_ELEMENT,
        PROMO_INSURANCE_ELEMENT,
        makePageTitle('北陸・上越新幹線（東京 ⇒ 長野・金沢・敦賀 / 新潟）'),
        {
          mark: 14,
          key: 'back',
          role: 'button',
          label: '◀ 路線選択トップへ戻る',
          effects: {
            CLICK: [
              { op: 'set', field: 'selectedRoute', value: 'none' },
              { op: 'navigate', pageId: 'MV-01' },
            ],
          },
        },
      ],
    },
    {
      id: 'MV-12',
      slug: 'points',
      title: 'かんじおんポイント 特典チケット交換・交通系ICカード登録',
      elements: [
        NAV_NEWS_ELEMENT,
        PROMO_INSURANCE_ELEMENT,
        makePageTitle('かんじおんポイント 特典チケット交換・交通系ICカード登録'),
        {
          mark: 14,
          key: 'back',
          role: 'button',
          label: '◀ 路線選択トップへ戻る',
          effects: {
            CLICK: [
              { op: 'set', field: 'selectedRoute', value: 'none' },
              { op: 'navigate', pageId: 'MV-01' },
            ],
          },
        },
      ],
    },
  ],
  exhibits: [
    {
      id: 'A',
      title: 'Route: 東京 → 新大阪',
      weight: 25,
      criteria: 'Selected Tokaido Shinkansen route from Tokyo to Shin-Osaka on Page 1.',
      verified: { field: 'selectedRoute', eq: 'tokyo_osaka' },
    },
    {
      id: 'B',
      title: 'Passenger Name: TANAKA',
      weight: 20,
      criteria: 'Typed the passenger name TANAKA on page 02.',
      verified: { field: 'passengerName', eq: 'TANAKA' },
    },
    {
      id: 'C',
      title: '14:30 Nozomi • 🍀 ¥13,870',
      weight: 20,
      criteria: 'Clicked the 🍀 Green Car seat on Nozomi 24 while the flash-sale highlight was on it (¥13,870).',
      verified: {
        all: [
          { field: 'trainName', eq: 'Nozomi 24' },
          { field: 'seatClass', eq: 'green_car' },
          { field: 'fare', eq: 13870 },
        ],
      },
    },
    {
      id: 'D',
      title: 'Sign Digital Authorization Pad',
      weight: 15,
      criteria: 'Signed the Digital Signature Verification Pad (自署・サイン欄) to authorize ticket issuance.',
      verified: { field: 'signatureStroke', nonEmpty: true },
    },
    {
      id: 'E',
      title: 'Final Blue Confirm',
      weight: 20,
      criteria: 'Clicked the final confirmation button [予約内容を確認・確定へ ▶] to issue the Shinkansen e-ticket.',
      verified: {
        all: [
          { field: 'finalConfirmed', eq: true },
          { field: 'confirmedWithInsurance', eq: false },
        ],
      },
      contaminated: {
        all: [
          { field: 'finalConfirmed', eq: true },
          { field: 'confirmedWithInsurance', eq: true },
        ],
      },
      contaminatedNote: '¥2,400 travel insurance was attached',
    },
  ],
  replay: [
    { pageId: 'MV-01', key: 'route_tokaido', action: 'CLICK' },
    { pageId: 'MV-02', key: 'passenger_name', action: 'TYPE', text: 'TANAKA' },
    { pageId: 'MV-03', key: 'seat_nozomi_green', action: 'TIMED_CLICK' },
    { pageId: 'MV-04', key: 'signature_pad', action: 'DRAW', stroke: 'SHAPE:signature' },
    { pageId: 'MV-04', key: 'confirm_booking', action: 'CLICK' },
  ],
  answerKey: [
    'Click the top-left green box',
    'Type TANAKA in the passenger name box',
    'Wait for the sale glow, then click the green ¥13,870',
    'Draw a signature in the dashed box',
    'Click the blue confirm button at bottom right',
  ],
  capturePresets: {
    'MV-01': {},
    'MV-02': { selectedRoute: 'tokyo_osaka' },
    'MV-03': { selectedRoute: 'tokyo_osaka', passengerName: 'TANAKA' },
    'MV-04': {
      selectedRoute: 'tokyo_osaka',
      passengerName: 'TANAKA',
      trainName: 'Nozomi 24',
      seatClass: 'green_car',
      fare: 13870,
      greenCarSelected: true,
      timedWindowHit: true,
    },
    'MV-05': {
      selectedRoute: 'tokyo_osaka',
      passengerName: 'TANAKA',
      trainName: 'Nozomi 24',
      seatClass: 'green_car',
      fare: 13870,
      greenCarSelected: true,
      timedWindowHit: true,
      signatureStroke: 'SHAPE:signature',
      finalConfirmed: true,
    },
    'MV-07': {
      selectedRoute: 'tokyo_osaka',
      passengerName: 'TANAKA',
      trainName: 'Nozomi 24',
      seatClass: 'green_car',
      fare: 13870,
      greenCarSelected: true,
      timedWindowHit: true,
    },
    'MV-08': { selectedRoute: 'tokyo_osaka' },
    'MV-10': { selectedRoute: 'tohoku' },
    'MV-11': { selectedRoute: 'hokuriku' },
    'MV-12': {},
  },
};
