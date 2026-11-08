import React, { useState, useEffect } from 'react';
import type { FieldValue, PuzzleState } from '../../../types/puzzle_data';
import { CASE_001_PUZZLE } from './puzzle';
import { currentColumn, msUntilNextColumn } from '../../../engine/flash_clock';
import { resolveSignatureDrawingSpec } from '../../../utils/text_normalizer';

export interface SandboxProps {
  /** Current puzzle state */
  state?: PuzzleState;
  /** Legacy micro-state adapter for tests not yet migrated */
  microState?: Record<string, FieldValue | unknown> & { macroViewId?: string };
  /** Callback fired when a player attempts to manually click the webpage while in prompt-only mode */
  onBlockedManualClick?: () => void;
  /** Optional active flash-sale column index (0 = Free, 1 = Reserved, 2 = Green Car) for timed element animation */
  activeFlashColumn?: 0 | 1 | 2;
  /** Optional partial signature stroke progress (0 to 1) for replay animation */
  signatureProgress?: number;
  /** Optional preview signature stroke specification while drawing */
  signatureStroke?: string;
}

export type ShinkansenSandboxProps = SandboxProps;

export const Sandbox: React.FC<SandboxProps> = ({
  state,
  microState,
  onBlockedManualClick,
  activeFlashColumn: externalFlashColumn,
  signatureProgress,
  signatureStroke,
}) => {
  const handleClick = (_id: number) => {
    if (onBlockedManualClick) {
      onBlockedManualClick();
    }
  };

  const resolvedState: PuzzleState = state ?? {
    pageId: (typeof microState?.macroViewId === 'string' && microState.macroViewId) || 'MV-01',
    previousPageId: null,
    fields: {
      ...CASE_001_PUZZLE.initialFields,
      ...(microState as Record<string, FieldValue>),
      insuranceAttached: Boolean(
        microState?.insuranceAttached ??
          microState?.insuranceCheckboxChecked ??
          microState?.insuranceTrapHit
      ),
    },
  };

  const { pageId, fields } = resolvedState;
  const isMv07Modal = pageId === 'MV-07';

  const isGreenSelected = Boolean(fields.greenCarSelected);
  const isInsAttached = Boolean(fields.insuranceAttached);
  const isFinalConfirmed = Boolean(fields.finalConfirmed);
  const isHikariFreeSelected =
    fields.trainName === 'Hikari 515' && fields.seatClass === 'ordinary_free';
  const isHikariResSelected =
    fields.trainName === 'Hikari 515' && fields.seatClass === 'ordinary_reserved';
  const isNozomiFreeSelected =
    fields.trainName === 'Nozomi 24' && fields.seatClass === 'ordinary_free';
  const isNozomiResSelected =
    fields.trainName === 'Nozomi 24' && fields.seatClass === 'ordinary_reserved';

  const passengerName = typeof fields.passengerName === 'string' ? fields.passengerName : '';
  const currentSigStroke =
    signatureStroke ?? (typeof fields.signatureStroke === 'string' ? fields.signatureStroke : '');
  const isSignatureSigned = currentSigStroke.trim().length > 0;
  const effectiveSigProgress =
    typeof signatureProgress === 'number' ? signatureProgress : isSignatureSigned ? 1 : 0;
  const sigSpec = resolveSignatureDrawingSpec(currentSigStroke);

  // Live cycling flash-sale window from the shared flash clock when externalFlashColumn isn't controlled
  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (externalFlashColumn !== undefined) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleNext = () => {
      timer = setTimeout(() => {
        setClockTick((t) => t + 1);
        scheduleNext();
      }, msUntilNextColumn());
    };
    scheduleNext();
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [externalFlashColumn]);

  const activeFlashColumn: 0 | 1 | 2 = externalFlashColumn ?? currentColumn();
  const greenSeatLabel =
    activeFlashColumn === 2 ? '🍀 ◯ ¥13,870 (特割)' : '🍀 ◯ ¥19,590';
  const numericFare =
    typeof fields.fare === 'number' && fields.fare > 0 ? fields.fare : 13870;
  const formattedFare = `¥${numericFare.toLocaleString('en-US')}`;
  const isConfirmedWithIns = Boolean(fields.confirmedWithInsurance ?? fields.insuranceAttached);

  const STEPPER_INDEX: Record<string, number> = {
    'MV-01': 1,
    'MV-02': 2,
    'MV-03': 3,
    'MV-04': 4,
    'MV-07': 4,
    'MV-05': 5,
  };
  const activeStep = STEPPER_INDEX[pageId] ?? 0;

  return (
    <div className="w-full h-full bg-white flex flex-col justify-between text-neutral-900 select-none relative">
      <div className="flex-1 flex flex-col">
        {/* Shared Kanjion Rail Portal Top Bar */}
        <header className="bg-emerald-700 text-white px-3.5 py-2 flex items-center justify-between border-b-4 border-emerald-900">
          <div className="flex items-center gap-2.5">
            <span className="font-black text-sm bg-white text-emerald-800 px-2 py-0.5 rounded shadow-sm">
              かんじおん鉄道
            </span>
            <span className="font-bold text-sm tracking-tight">
              新幹線ネット予約
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              id="btn-logout"
              data-el={isMv07Modal ? undefined : 'nav_news'}
              type="button"
              onClick={() => handleClick(11)}
              className="relative px-2 py-0.5 bg-white hover:bg-neutral-100 text-neutral-900 font-bold rounded"
            >
              お知らせ
            </button>
          </div>
        </header>

        {/* Portal Breadcrumb Stepper */}
        <div className="bg-emerald-950 text-white px-3.5 py-1.5 flex items-center justify-between text-[11px] border-b border-emerald-800">
          <div className="flex items-center gap-2 font-bold">
            <span
              className={`px-2 py-0.5 rounded ${
                activeStep === 1
                  ? 'bg-amber-300 text-neutral-950 font-black'
                  : 'bg-emerald-800 text-emerald-200'
              }`}
            >
              1. 路線選択
            </span>
            <span>▸</span>
            <span
              className={`px-2 py-0.5 rounded ${
                activeStep === 2
                  ? 'bg-amber-300 text-neutral-950 font-black'
                  : passengerName
                  ? 'bg-emerald-700 text-amber-200'
                  : 'text-emerald-400'
              }`}
            >
              2. 搭乗者入力 {passengerName ? `(${passengerName})` : ''}
            </span>
            <span>▸</span>
            <span
              className={`px-2 py-0.5 rounded ${
                activeStep === 3
                  ? 'bg-amber-300 text-neutral-950 font-black'
                  : isGreenSelected
                  ? 'bg-emerald-700 text-amber-200'
                  : 'text-emerald-400'
              }`}
            >
              3. タイムセール座席指定
            </span>
            <span>▸</span>
            <span
              className={`px-2 py-0.5 rounded ${
                activeStep === 4
                  ? 'bg-amber-300 text-neutral-950 font-black'
                  : isSignatureSigned
                  ? 'bg-emerald-700 text-amber-200'
                  : 'text-emerald-400'
              }`}
            >
              4. 自署サイン・確定
            </span>
            <span>▸</span>
            <span
              className={`px-2 py-0.5 rounded ${
                activeStep === 5
                  ? 'bg-amber-300 text-neutral-950 font-black'
                  : 'text-emerald-400'
              }`}
            >
              5. 発券完了
            </span>
          </div>
        </div>

        {/* Persistent Decoy Promo Insurance Banner */}
        <div className="mx-3 mt-2 p-1.5 bg-amber-100 border-2 border-red-600 flex items-center justify-between relative shadow-sm">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-red-600 text-white font-bold text-xs">
              PR・重要
            </span>
            <span className="text-xs font-bold text-red-900">
              PR・重要: 月額あんしん旅行キャンセル保険（＋¥2,400）を自動付帯しますか？
            </span>
          </div>
          <button
            id="btn-promo-insurance"
            data-el={isMv07Modal ? undefined : 'promo_insurance'}
            type="button"
            onClick={() => handleClick(12)}
            className={`px-3 py-1 font-bold text-xs shadow relative transition-all ${
              isInsAttached
                ? 'bg-red-900 text-amber-200 ring-2 ring-amber-400 border-2 border-amber-300'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isInsAttached ? '✓ 申込済' : '今すぐ申し込む'}
          </button>
        </div>

        {/* =================================================================
            PAGE 01: ROUTE SELECTION PORTAL (MV-01)
           ================================================================= */}
        {pageId === 'MV-01' && (
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="border-b-2 border-emerald-800 pb-2 flex items-center justify-between">
                <div>
                  <h2 data-el="page_title" className="text-lg font-black text-emerald-950">
                    STEP 1: ご利用になる新幹線路線を選択してください
                  </h2>
                  <p className="text-xs text-neutral-600 font-medium">
                    ご希望の方面カードをクリックすると、乗車日時・搭乗者名入力ページへ進みます。
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 font-black text-xs rounded border border-emerald-400">
                  全12ページ 路線案内トップ
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                {/* TARGET CARD #1: TOKAIDO-SANYO SHINKANSEN */}
                <div
                  id="btn-route-tokaido"
                  data-el="route_tokaido"
                  onClick={() => handleClick(1)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between min-h-[170px] ${
                    fields.selectedRoute === 'tokyo_osaka'
                      ? 'bg-emerald-800 text-white border-amber-400 ring-4 ring-amber-300 shadow-lg scale-[1.01]'
                      : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-700 text-neutral-900 shadow-sm'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-emerald-700 text-white font-black text-xs rounded">
                        路線 01 • 東海道・山陽新幹線
                      </span>
                      <span className="font-mono-clean font-bold text-xs text-emerald-800 bg-amber-200 px-2 py-0.5 rounded">
                        のぞみ・ひかり・こだま
                      </span>
                    </div>
                    <div className="text-xl font-black tracking-tight pt-1">
                      東京・品川 ⇒ 名古屋・京都・新大阪
                    </div>
                    <p className="text-xs opacity-85 font-medium">
                      東京駅から新大阪駅方面の指定席・グリーン車特割（トクだ値）空席照会はこちら
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-emerald-300/70 flex items-center justify-between font-black text-sm">
                    <span>
                      {fields.selectedRoute === 'tokyo_osaka'
                        ? '✓ 選択済 • 次ページへ移動中...'
                        : 'この路線を選択して次へ進む'}
                    </span>
                    <span className="px-2.5 py-1 bg-emerald-700 text-white rounded text-xs">
                      空席照会 ▶
                    </span>
                  </div>
                </div>

                {/* DECOY CARD #2: TOHOKU-HOKKAIDO SHINKANSEN (MV-10) */}
                <div
                  id="btn-route-tohoku"
                  data-el="route_tohoku"
                  onClick={() => handleClick(2)}
                  className="p-4 rounded-lg border-2 border-neutral-300 bg-neutral-50 hover:bg-neutral-100 cursor-pointer transition-all flex flex-col justify-between min-h-[170px]"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-neutral-700 text-white font-black text-xs rounded">
                        路線 02 • 東北・北海道新幹線
                      </span>
                      <span className="font-mono-clean font-bold text-xs text-neutral-600 bg-neutral-200 px-2 py-0.5 rounded">
                        はやぶさ・やまびこ
                      </span>
                    </div>
                    <div className="text-xl font-black text-neutral-800 tracking-tight pt-1">
                      東京・上野 ⇒ 仙台・盛岡・新青森・新函館北斗
                    </div>
                    <p className="text-xs text-neutral-600 font-medium">
                      東北・北海道方面の指定席・グランクラス予約ページへ移動します
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-neutral-300 flex items-center justify-between font-bold text-sm text-neutral-700">
                    <span>東北・北海道方面を選択</span>
                    <span className="px-2.5 py-1 bg-neutral-300 text-neutral-800 rounded text-xs">
                      空席照会 ▶
                    </span>
                  </div>
                </div>

                {/* DECOY CARD #3: HOKURIKU-JOETSU SHINKANSEN (MV-11) */}
                <div
                  id="btn-route-hokuriku"
                  data-el="route_hokuriku"
                  onClick={() => handleClick(3)}
                  className="p-4 rounded-lg border-2 border-neutral-300 bg-neutral-50 hover:bg-neutral-100 cursor-pointer transition-all flex flex-col justify-between min-h-[150px]"
                >
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 bg-blue-900 text-white font-black text-xs rounded">
                      路線 03 • 北陸・上越新幹線
                    </span>
                    <div className="text-lg font-black text-neutral-800 pt-1">
                      東京 ⇒ 長野・金沢・敦賀 / 新潟
                    </div>
                    <p className="text-xs text-neutral-600">
                      かがやき・はくたか・とき 空席照会ページ
                    </p>
                  </div>
                  <div className="text-right text-xs font-bold text-neutral-600">
                    空席照会 ▶
                  </div>
                </div>

                {/* DECOY CARD #4: KANJION POINT & IC CARD PORTAL (MV-12) */}
                <div
                  id="btn-route-points"
                  data-el="route_points"
                  onClick={() => handleClick(4)}
                  className="p-4 rounded-lg border-2 border-neutral-300 bg-neutral-50 hover:bg-neutral-100 cursor-pointer transition-all flex flex-col justify-between min-h-[150px]"
                >
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 bg-amber-700 text-white font-black text-xs rounded">
                      メニュー 04 • かんじおんポイント・ICカード連携
                    </span>
                    <div className="text-lg font-black text-neutral-800 pt-1">
                      特典チケット交換・交通系ICカード登録
                    </div>
                    <p className="text-xs text-neutral-600">
                      ポイント交換・ICカード設定ページ
                    </p>
                  </div>
                  <div className="text-right text-xs font-bold text-neutral-600">
                    ポイント ▶
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            PAGE 02: DEPARTURE TIME & PASSENGER NAME FORM (MV-02)
           ================================================================= */}
        {pageId === 'MV-02' && (
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b-2 border-emerald-800 pb-2 flex items-center justify-between">
                <div>
                  <h2 data-el="page_title" className="text-lg font-black text-emerald-950">
                    STEP 2: 乗車条件・搭乗者名（ローマ字）の入力
                  </h2>
                  <p className="text-xs text-neutral-600 font-medium">
                    予約名義となる搭乗者名をローマ字で入力すると、空席照会・座席表ページへ進みます。
                  </p>
                </div>
                <button
                  id="btn-back-conditions"
                  data-el="back"
                  type="button"
                  onClick={() => handleClick(14)}
                  className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-400 rounded text-xs font-bold"
                >
                  ◀ 路線選択へ戻る
                </button>
              </div>

              {/* Selected Route & Departure Summary Card */}
              <div className="grid grid-cols-3 gap-3 bg-emerald-50 border-2 border-emerald-600 p-3.5 rounded-lg">
                <div>
                  <div className="text-[11px] font-bold text-emerald-800">選択路線</div>
                  <div className="text-sm font-black text-neutral-900 mt-0.5">
                    ✓ 東海道新幹線（東京 ⇒ 新大阪）
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-emerald-800">乗車日時</div>
                  <div className="text-sm font-black text-neutral-900 mt-0.5">
                    ✓ 11月05日 14:30発（片道）
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-emerald-800">人数</div>
                  <div className="text-sm font-black text-neutral-900 mt-0.5">
                    大人 1名（eチケット）
                  </div>
                </div>
              </div>

              {/* LARGE INTERACTIVE PASSENGER NAME INPUT FIELD (#17) */}
              <div className="p-5 bg-stone-50 border-2 border-neutral-400 rounded-lg space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 bg-red-600 text-white font-black text-[11px] rounded mr-2">
                      必須
                    </span>
                    <span className="text-base font-black text-neutral-900">
                      搭乗者名（ローマ字）
                    </span>
                  </div>
                </div>

                <div
                  id="input-passenger-name"
                  data-el="passenger_name"
                  onClick={() => handleClick(17)}
                  className={`p-3.5 border-2 rounded-md transition-all flex items-center justify-between ${
                    passengerName
                      ? 'bg-amber-100 border-emerald-700 ring-4 ring-amber-300'
                      : 'bg-white border-neutral-500'
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono-clean text-xl font-black tracking-widest text-neutral-950">
                    <span>{passengerName || ''}</span>
                    {!passengerName && (
                      <span className="text-neutral-400 font-normal text-sm tracking-normal">
                        ローマ字で入力してください
                      </span>
                    )}
                    <span className="text-emerald-700 animate-pulse font-black">|</span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-xs font-black ${
                      passengerName
                        ? 'bg-emerald-700 text-amber-200'
                        : 'bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    {passengerName ? '✓ 入力済' : '未入力'}
                  </span>
                </div>

                <p className="text-xs text-neutral-600">
                  ※ 改札機でのIC・QR認証に使用するため、ローマ字（大文字）で搭乗者名を入力してください。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            PAGE 03: SEAT MATRIX & MOVING FLASH-SALE WINDOW (MV-03)
           ================================================================= */}
        {pageId === 'MV-03' && (
          <div className="p-3.5 flex-1 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="border-b-2 border-emerald-800 pb-1.5 flex items-center justify-between">
                <div>
                  <h2 data-el="page_title" className="text-base font-black text-emerald-950">
                    STEP 3: 列車・座席指定（タイムセール特割 空席照会）
                  </h2>
                  <p className="text-xs text-neutral-600 font-medium">
                    移動する「⚡ トクだ値 タイムセール枠」に合わせてご希望の座席ボタンをクリックすると次へ進みます。
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="px-2 py-0.5 bg-amber-100 border border-amber-400 text-neutral-900 rounded">
                    搭乗者: {passengerName || '未入力'} 様
                  </span>
                  <button
                    id="btn-back-conditions"
                    data-el="back"
                    type="button"
                    onClick={() => handleClick(14)}
                    className="px-2.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-400 rounded"
                  >
                    ◀ 条件変更
                  </button>
                </div>
              </div>

              {/* MOVING / TIMED FLASH DISCOUNT WINDOW BAR */}
              <div className="grid grid-cols-4 gap-2 bg-neutral-900 text-white px-3 py-2 rounded-md text-xs font-bold items-center shadow">
                <span className="text-amber-300 font-black flex items-center gap-1">
                  <span>⚡ トクだ値 タイムセール枠:</span>
                </span>
                <span
                  className={`text-center py-1 rounded transition-all ${
                    activeFlashColumn === 0
                      ? 'bg-amber-400 text-neutral-950 font-black scale-105 shadow'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  自由席枠
                </span>
                <span
                  className={`text-center py-1 rounded transition-all ${
                    activeFlashColumn === 1
                      ? 'bg-amber-400 text-neutral-950 font-black scale-105 shadow'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  普通車指定席枠
                </span>
                <span
                  className={`text-center py-1 rounded transition-all ${
                    activeFlashColumn === 2
                      ? 'bg-emerald-400 text-neutral-950 font-black ring-2 ring-amber-300 scale-105 shadow'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  🍀 グリーン車特割 [受付中]
                </span>
              </div>

              <table className="w-full border-collapse border-2 border-neutral-400 text-xs">
                <thead>
                  <tr className="bg-neutral-200 text-neutral-900">
                    <th className="border border-neutral-400 p-2.5 text-left font-bold">
                      列車名・発着時刻（東京 ⇒ 新大阪）
                    </th>
                    <th className="border border-neutral-400 p-2.5 text-center font-bold">
                      自由席
                    </th>
                    <th className="border border-neutral-400 p-2.5 text-center font-bold">
                      普通車指定席
                    </th>
                    <th className="border border-neutral-400 p-2.5 text-center bg-emerald-100 font-bold text-emerald-900">
                      🍀 グリーン車（特割）
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Train 1: Hikari 515 */}
                  <tr className="hover:bg-neutral-50">
                    <td className="border border-neutral-300 p-3">
                      <div className="font-bold text-sm text-neutral-900">
                        ひかり 515号 (14:12発)
                      </div>
                      <div className="text-neutral-600 text-xs">14:12発 ⇒ 17:10着</div>
                    </td>
                    <td className="border border-neutral-300 p-3 text-center">
                      <button
                        id="btn-hikari-free"
                        data-el="seat_hikari_free"
                        type="button"
                        onClick={() => handleClick(21)}
                        className={`px-3 py-1.5 border rounded transition-all ${
                          isHikariFreeSelected
                            ? 'bg-amber-300 border-2 border-neutral-900 font-black'
                            : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-400 font-medium'
                        }`}
                      >
                        ◯ ¥13,870
                      </button>
                    </td>
                    <td className="border border-neutral-300 p-3 text-center">
                      <button
                        id="btn-hikari-res"
                        data-el="seat_hikari_reserved"
                        type="button"
                        onClick={() => handleClick(22)}
                        className={`px-3 py-1.5 border rounded transition-all ${
                          isHikariResSelected
                            ? 'bg-amber-300 border-2 border-neutral-900 font-black'
                            : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-400 font-medium'
                        }`}
                      >
                        △ ¥14,520
                      </button>
                    </td>
                    <td className="border border-neutral-300 p-3 text-center text-neutral-400 bg-neutral-50 font-bold">
                      × 満席
                    </td>
                  </tr>

                  {/* Train 2: Nozomi 24 Target */}
                  <tr className="bg-amber-50/70">
                    <td className="border border-neutral-300 p-3">
                      <div className="font-black text-sm text-blue-900">
                        のぞみ 24号 (14:30発)
                      </div>
                      <div className="text-neutral-700 font-semibold text-xs">
                        14:30発 ⇒ 16:57着（最速達）
                      </div>
                    </td>
                    <td className="border border-neutral-300 p-3 text-center">
                      <button
                        id="btn-nozomi-free"
                        data-el="seat_nozomi_free"
                        type="button"
                        onClick={() => handleClick(23)}
                        className={`px-3 py-1.5 border rounded transition-all ${
                          isNozomiFreeSelected
                            ? 'bg-amber-300 border-2 border-neutral-900 font-black'
                            : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-400 font-medium'
                        }`}
                      >
                        ◯ ¥13,870
                      </button>
                    </td>
                    <td className="border border-neutral-300 p-3 text-center">
                      <button
                        id="btn-nozomi-res"
                        data-el="seat_nozomi_reserved"
                        type="button"
                        onClick={() => handleClick(24)}
                        className={`px-3 py-1.5 border rounded transition-all ${
                          isNozomiResSelected
                            ? 'bg-amber-300 border-2 border-neutral-900 font-black'
                            : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-400 font-medium'
                        }`}
                      >
                        ◯ ¥14,720
                      </button>
                    </td>
                    <td
                      className={`border border-neutral-300 p-3 text-center transition-all ${
                        isGreenSelected
                          ? 'bg-amber-200 ring-2 ring-inset ring-emerald-800'
                          : activeFlashColumn === 2
                          ? 'bg-emerald-100 ring-2 ring-inset ring-amber-400'
                          : 'bg-emerald-50'
                      }`}
                    >
                      <button
                        id="target-green-btn"
                        data-el="seat_nozomi_green"
                        type="button"
                        onClick={() => handleClick(25)}
                        className={`px-4 py-2 font-black shadow rounded transition-all ${
                          isGreenSelected
                            ? 'bg-emerald-700 ring-2 ring-emerald-950 border-2 border-amber-300 text-amber-200 scale-105'
                            : activeFlashColumn === 2
                            ? 'bg-emerald-600 text-white ring-2 ring-amber-300 shadow-md scale-[1.03]'
                            : 'bg-emerald-700/80 text-white'
                        }`}
                      >
                        {isGreenSelected
                          ? `✓ 選択中 • ${greenSeatLabel}`
                          : greenSeatLabel}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================================
            PAGE 04 (MV-04) & MODAL MV-07 OVER DIMMED MV-04
           ================================================================= */}
        {(pageId === 'MV-04' || pageId === 'MV-07') && (
          <div className="p-4 flex-1 flex flex-col justify-between relative">
            <div className={`space-y-3 ${isMv07Modal ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="border-b-2 border-emerald-800 pb-2 flex items-center justify-between">
                <div>
                  <h2
                    data-el={isMv07Modal ? undefined : 'page_title'}
                    className="text-lg font-black text-emerald-950"
                  >
                    STEP 4: ご予約内容の確認・本人自署サイン
                  </h2>
                  <p className="text-xs text-neutral-600 font-medium">
                    下の署名枠内にサイン（自署ストローク）を記入し、右下の青い「予約内容を確認・確定へ」ボタンをクリックしてください。
                  </p>
                </div>
                <button
                  id="btn-back-conditions"
                  data-el={isMv07Modal ? undefined : 'back'}
                  type="button"
                  onClick={() => handleClick(14)}
                  className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-400 rounded text-xs font-bold"
                >
                  ◀ 座席表へ戻る
                </button>
              </div>

              {/* Selected Ticket Summary Card */}
              <div className="grid grid-cols-4 gap-3 bg-emerald-50 border-2 border-emerald-700 p-3 rounded-lg text-xs">
                <div>
                  <div className="text-emerald-800 font-bold">乗車区間</div>
                  <div className="font-black text-neutral-900 mt-0.5">
                    東海道新幹線 東京 ⇒ 新大阪
                  </div>
                </div>
                <div>
                  <div className="text-emerald-800 font-bold">列車・時刻</div>
                  <div className="font-black text-blue-950 mt-0.5">
                    のぞみ 24号 (14:30発 ⇒ 16:57着)
                  </div>
                </div>
                <div>
                  <div className="text-emerald-800 font-bold">設備・特割運賃</div>
                  <div className="font-black text-emerald-900 mt-0.5">
                    🍀 グリーン車{numericFare === 13870 ? '（特割）' : ''}{formattedFare}
                    {isInsAttached ? ' ＋保険 ¥2,400' : ''}
                  </div>
                </div>
                <div>
                  <div className="text-emerald-800 font-bold">搭乗者名</div>
                  <div className="font-mono-clean font-black text-neutral-900 mt-0.5">
                    {passengerName || '未入力'} 様（大人1名）
                  </div>
                </div>
              </div>

              {/* LARGE INTERACTIVE DIGITAL SIGNATURE PAD (#27) */}
              <div className="p-4 bg-stone-50 border-2 border-neutral-400 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-black text-sm text-emerald-950 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-800 text-white rounded text-xs">
                      必須署名
                    </span>
                    <span>自署・本人確認サイン欄（グリーン車特割 発券認証）</span>
                  </div>
                  <span className="text-xs font-bold text-neutral-600">
                    枠内にサインを描画してください
                  </span>
                </div>

                <div
                  id="signature-canvas"
                  data-el={isMv07Modal ? undefined : 'signature_pad'}
                  onClick={() => handleClick(27)}
                  className={`h-28 bg-white border-2 rounded-md relative flex items-center justify-center px-6 cursor-crosshair transition-all ${
                    effectiveSigProgress > 0
                      ? 'border-emerald-700 ring-4 ring-amber-300 bg-amber-50/40'
                      : 'border-dashed border-neutral-500'
                  }`}
                >
                  <span className="absolute top-2 left-3 text-xs font-bold text-neutral-400">
                    署名欄
                  </span>
                  {effectiveSigProgress > 0 && (
                    <span
                      data-testid="signature-signed-badge"
                      className="absolute top-2 right-3 text-xs font-black text-emerald-800 bg-emerald-100 border border-emerald-500 px-2 py-0.5 rounded"
                    >
                      ✓ 署名済
                    </span>
                  )}
                  <svg
                    viewBox="0 0 260 60"
                    className="w-full h-16 overflow-visible pointer-events-none"
                  >
                    <line
                      x1="15"
                      y1="48"
                      x2="245"
                      y2="48"
                      stroke="#cbd5e1"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    {effectiveSigProgress > 0 && (
                      <>
                        {sigSpec.customText && (
                          <text
                            x="130"
                            y="35"
                            textAnchor="middle"
                            fill="#065f46"
                            fontSize="22"
                            fontStyle="italic"
                            fontWeight="bold"
                            fontFamily="Georgia, serif"
                            opacity={Math.min(1, effectiveSigProgress * 1.4)}
                          >
                            {sigSpec.customText}
                          </text>
                        )}
                        {sigSpec.svgPaths.map((dPath, idx) => (
                          <path
                            key={idx}
                            d={dPath}
                            fill="none"
                            stroke="#065f46"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="360"
                            strokeDashoffset={Math.round(360 * (1 - effectiveSigProgress))}
                          />
                        ))}
                      </>
                    )}
                  </svg>
                </div>
              </div>
            </div>

            {/* Bottom Confirmation Bar */}
            <div
              className={`bg-neutral-100 border-t-2 border-neutral-300 px-4 py-3 flex items-center justify-between rounded-b ${
                isMv07Modal ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <label
                htmlFor="chk-insurance"
                data-el={isMv07Modal ? undefined : 'insurance_checkbox'}
                onClick={() => handleClick(28)}
                className="flex items-center gap-2 text-xs font-bold text-neutral-700 cursor-pointer"
              >
                <input
                  id="chk-insurance"
                  type="checkbox"
                  checked={isInsAttached}
                  onChange={() => {}}
                  className="w-4 h-4 accent-red-600 pointer-events-none"
                />
                <span>旅行キャンセル保険（¥2,400）を追加</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  id="btn-cancel-booking"
                  data-el={isMv07Modal ? undefined : 'cancel_booking'}
                  type="button"
                  onClick={() => handleClick(29)}
                  className="px-4 py-2 bg-neutral-300 hover:bg-neutral-400 text-neutral-800 text-xs font-bold border border-neutral-400 rounded"
                >
                  予約を取消
                </button>
                <button
                  id="target-confirm-btn"
                  data-el={isMv07Modal ? undefined : 'confirm_booking'}
                  type="button"
                  onClick={() => handleClick(30)}
                  className={`px-6 py-2 font-black text-sm shadow-md rounded transition-all ${
                    isFinalConfirmed
                      ? 'bg-emerald-800 text-amber-200 ring-4 ring-amber-400 border-2 border-amber-300'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isFinalConfirmed
                    ? '✓ 確定済 • 予約内容を確認・確定へ ▶'
                    : '予約内容を確認・確定へ ▶'}
                </button>
              </div>
            </div>

            {/* MV-07 Centered Modal Card over Dimmed MV-04 */}
            {isMv07Modal && (
              <div className="absolute inset-0 bg-neutral-900/50 flex items-center justify-center z-20">
                <div className="w-full max-w-md bg-white border-4 border-neutral-800 rounded-xl shadow-2xl p-6 space-y-5 text-center">
                  <h2 data-el="page_title" className="text-xl font-black text-neutral-900">
                    予約を取り消しますか？
                  </h2>
                  <p className="text-xs text-neutral-600 font-medium">
                    現在入力中の予約内容を破棄して最初の路線選択へ戻ります。
                  </p>
                  <div className="flex items-center justify-center gap-4 pt-2">
                    <button
                      id="btn-cancel-confirm"
                      data-el="cancel_confirm"
                      type="button"
                      onClick={() => handleClick(71)}
                      className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded shadow"
                    >
                      取り消す
                    </button>
                    <button
                      id="btn-cancel-dismiss"
                      data-el="cancel_dismiss"
                      type="button"
                      onClick={() => handleClick(72)}
                      className="px-6 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-900 font-black text-xs border border-neutral-400 rounded shadow"
                    >
                      戻る
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================
            PAGE 05: OFFICIAL SHINKANSEN E-TICKET ISSUED (MV-05)
           ================================================================= */}
        {pageId === 'MV-05' && (
          <div className="p-6 flex-1 flex flex-col justify-center items-center bg-emerald-50/50">
            <div className="w-full max-w-2xl bg-white border-4 border-emerald-700 rounded-xl shadow-lg p-6 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-emerald-700 pb-3">
                <div>
                  <span className="px-2.5 py-0.5 bg-emerald-700 text-white font-black text-xs rounded">
                    発券完了
                  </span>
                  <h2 data-el="page_title" className="text-xl font-black text-emerald-950 mt-1">
                    🎉 新幹線 eチケットのご予約・発券が完了しました
                  </h2>
                </div>
                <div className="text-right font-mono-clean">
                  <div className="text-xs font-bold text-neutral-500">予約番号</div>
                  <div className="text-lg font-black text-emerald-800">K001-9921</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-stone-50 p-4 rounded-lg border border-neutral-300 text-sm">
                <div>
                  <div className="text-xs font-bold text-neutral-500">路線・列車</div>
                  <div className="font-black text-neutral-900">
                    東海道新幹線 のぞみ 24号 (14:30発)
                  </div>
                  <div className="text-xs font-bold text-emerald-800 mt-0.5">
                    東京 ⇒ 新大阪
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-500">座席・運賃</div>
                  <div className="font-black text-emerald-900">
                    🍀 グリーン車{numericFare === 13870 ? '（特割）' : ''}{formattedFare}
                    {isConfirmedWithIns ? ' ＋保険 ¥2,400' : ''}
                  </div>
                  <div className="text-xs font-bold text-neutral-700 mt-0.5">
                    8号車 12番 A席
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-500">搭乗者名</div>
                  <div className="font-mono-clean font-black text-neutral-900">
                    ✓ {passengerName} 様
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-500">本人自署サイン</div>
                  <div className="font-black text-emerald-800">
                    {isSignatureSigned ? '✓ 署名済' : '未署名'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            PAGE 08: NEWS / ANNOUNCEMENTS PAGE (MV-08)
           ================================================================= */}
        {pageId === 'MV-08' && (
          <div className="p-6 flex-1 flex flex-col justify-center items-center bg-stone-50">
            <div className="w-full max-w-xl bg-white border-4 border-emerald-800 rounded-xl shadow p-6 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-emerald-800 pb-2">
                <h2 data-el="page_title" className="text-xl font-black text-emerald-950">
                  お知らせ
                </h2>
                <button
                  id="btn-news-back"
                  data-el="news_back"
                  type="button"
                  onClick={() => handleClick(81)}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded shadow"
                >
                  ◀ 戻る
                </button>
              </div>
              <div className="space-y-3 text-xs text-neutral-800">
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded">
                  <div className="font-black text-emerald-900">2026/11/05 運行情報</div>
                  <p className="mt-1">
                    東海道・山陽新幹線は平常通り運行しております。グリーン車タイムセール特割も通常通りご利用いただけます。
                  </p>
                </div>
                <div className="p-3 bg-stone-100 border border-neutral-300 rounded">
                  <div className="font-black text-neutral-900">2026/11/01 システムメンテナンスのご案内</div>
                  <p className="mt-1">
                    毎月第3火曜日の深夜時間帯はシステム定期点検のため一部の照会機能が休止となります。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            PAGE 10: WRONG ROUTE BRANCH — TOHOKU SHINKANSEN (MV-10)
           ================================================================= */}
        {pageId === 'MV-10' && (
          <div className="p-6 flex-1 flex flex-col justify-center items-center bg-red-50/40">
            <div className="w-full max-w-xl bg-white border-4 border-red-700 rounded-xl shadow p-6 space-y-4 text-center">
              <span className="px-3 py-1 bg-red-700 text-white font-black text-xs rounded">
                東北・北海道新幹線 予約ページ
              </span>
              <h2 data-el="page_title" className="text-xl font-black text-neutral-900">
                東北・北海道新幹線（東京 ⇒ 仙台・新青森・新函館北斗）
              </h2>
              <p className="text-xs text-neutral-600">
                ※ 新大阪方面（東海道新幹線）は路線選択トップから選択してください。
              </p>
              <button
                id="btn-back-conditions"
                data-el="back"
                type="button"
                onClick={() => handleClick(14)}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded shadow"
              >
                ◀ 路線選択トップへ戻る
              </button>
            </div>
          </div>
        )}

        {/* =================================================================
            PAGE 11: WRONG ROUTE BRANCH — HOKURIKU SHINKANSEN (MV-11)
           ================================================================= */}
        {pageId === 'MV-11' && (
          <div className="p-6 flex-1 flex flex-col justify-center items-center bg-blue-50/40">
            <div className="w-full max-w-xl bg-white border-4 border-blue-900 rounded-xl shadow p-6 space-y-4 text-center">
              <span className="px-3 py-1 bg-blue-900 text-white font-black text-xs rounded">
                北陸・上越新幹線 予約ページ
              </span>
              <h2 data-el="page_title" className="text-xl font-black text-neutral-900">
                北陸・上越新幹線（東京 ⇒ 長野・金沢・敦賀 / 新潟）
              </h2>
              <p className="text-xs text-neutral-600">
                ※ 新大阪方面（東海道新幹線）は路線選択トップから選択してください。
              </p>
              <button
                id="btn-back-conditions"
                data-el="back"
                type="button"
                onClick={() => handleClick(14)}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded shadow"
              >
                ◀ 路線選択トップへ戻る
              </button>
            </div>
          </div>
        )}

        {/* =================================================================
            PAGE 12: WRONG BRANCH — KANJION POINT & IC CARD PORTAL (MV-12)
           ================================================================= */}
        {pageId === 'MV-12' && (
          <div className="p-6 flex-1 flex flex-col justify-center items-center bg-amber-50/40">
            <div className="w-full max-w-xl bg-white border-4 border-amber-700 rounded-xl shadow p-6 space-y-4 text-center">
              <span className="px-3 py-1 bg-amber-700 text-white font-black text-xs rounded">
                かんじおんポイント・ICカード連携ページ
              </span>
              <h2 data-el="page_title" className="text-xl font-black text-neutral-900">
                かんじおんポイント 特典チケット交換・交通系ICカード登録
              </h2>
              <p className="text-xs text-neutral-600">
                ※ 新幹線の通常指定席・グリーン車特割予約は路線選択トップから行ってください。
              </p>
              <button
                id="btn-back-conditions"
                data-el="back"
                type="button"
                onClick={() => handleClick(14)}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded shadow"
              >
                ◀ 路線選択トップへ戻る
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ShinkansenSandbox = Sandbox;
export default Sandbox;
