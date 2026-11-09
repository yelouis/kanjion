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

  const passengerName = typeof fields.passengerName === 'string' ? fields.passengerName : '';
  const nameKanjiSei = typeof fields.nameKanjiSei === 'string' ? fields.nameKanjiSei : '';
  const nameKanjiMei = typeof fields.nameKanjiMei === 'string' ? fields.nameKanjiMei : '';
  const nameKanaSei = typeof fields.nameKanaSei === 'string' ? fields.nameKanaSei : '';
  const nameKanaMei = typeof fields.nameKanaMei === 'string' ? fields.nameKanaMei : '';
  const givenNameRomaji = typeof fields.givenNameRomaji === 'string' ? fields.givenNameRomaji : '';
  const phoneVal = typeof fields.phone === 'string' ? fields.phone : '';
  const reuseInfo = Boolean(fields.reuseInfo);
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
          <div className="px-4 py-2.5 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="border-b-2 border-emerald-800 pb-1.5 flex items-center justify-between">
                <div>
                  <h2 data-el="page_title" className="text-base font-black text-emerald-950">
                    STEP 1: ご利用になる新幹線路線を選択してください
                  </h2>
                  <p className="text-[11px] text-neutral-600 font-medium">
                    ご希望の方面カードをクリックすると、乗車日時・搭乗者名入力ページへ進みます。
                  </p>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-black text-xs rounded border border-emerald-400">
                  全12ページ 路線案内トップ
                </span>
              </div>

              {/* Service Tabs Row */}
              <div className="grid grid-cols-4 gap-2 border-b border-neutral-300 bg-neutral-100 px-2 pt-1.5 rounded-t">
                <button
                  id="tab-shinkansen"
                  data-el="tab_shinkansen"
                  type="button"
                  onClick={() => handleClick(5)}
                  className="py-1.5 px-3 bg-white text-emerald-950 font-black text-xs border-b-4 border-emerald-700 rounded-t shadow-sm"
                >
                  新幹線・特急
                </button>
                <button
                  id="tab-local"
                  data-el="tab_local"
                  type="button"
                  onClick={() => handleClick(6)}
                  className="py-1.5 px-3 bg-neutral-200/80 hover:bg-white text-neutral-700 font-bold text-xs border-b-4 border-transparent rounded-t"
                >
                  在来線
                </button>
                <button
                  id="tab-hotel"
                  data-el="tab_hotel"
                  type="button"
                  onClick={() => handleClick(7)}
                  className="py-1.5 px-3 bg-neutral-200/80 hover:bg-white text-neutral-700 font-bold text-xs border-b-4 border-transparent rounded-t"
                >
                  ホテル・宿泊
                </button>
                <button
                  id="tab-rental"
                  data-el="tab_rental"
                  type="button"
                  onClick={() => handleClick(8)}
                  className="py-1.5 px-3 bg-neutral-200/80 hover:bg-white text-neutral-700 font-bold text-xs border-b-4 border-transparent rounded-t"
                >
                  レンタカー
                </button>
              </div>

              {/* Full-Width Campaign Banner (~70px tall) */}
              <button
                id="btn-campaign-banner"
                data-el="campaign_banner"
                type="button"
                onClick={() => handleClick(9)}
                style={{ backgroundColor: '#2E9E4F' }}
                className="w-full h-[68px] px-4 py-2 rounded-md border-2 border-emerald-900 text-white shadow flex items-center justify-between text-left cursor-pointer hover:brightness-105 transition-all"
              >
                <div>
                  <div className="text-sm font-black tracking-wide">
                    【期間限定】新幹線 早割28 キャンペーン実施中！ ▶
                  </div>
                  <div className="text-[11px] font-bold text-emerald-100 mt-0.5">
                    乗車28日前までのネット予約で指定席・グリーン車が特別割引 • 詳細はこちら
                  </div>
                </div>
                <span className="px-3 py-1 bg-white text-emerald-900 font-black text-xs rounded shadow-sm shrink-0">
                  特設ページ ▶
                </span>
              </button>

              {/* 2x2 Route Card Grid */}
              <div className="grid grid-cols-2 gap-3 pt-0.5">
                {/* TOP-LEFT CARD (Mark 3): HOKURIKU-JOETSU SHINKANSEN (MV-11) */}
                <div
                  id="btn-route-hokuriku"
                  data-el="route_hokuriku"
                  onClick={() => handleClick(3)}
                  style={{ borderColor: '#3FA9F5', backgroundColor: '#F0F8FF' }}
                  className="p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between min-h-[148px] shadow-sm hover:brightness-95"
                >
                  <div className="space-y-1">
                    <div
                      style={{ backgroundColor: '#B87333' }}
                      className="h-1.5 w-full rounded-full mb-1"
                    />
                    <div className="flex items-center justify-between">
                      <span
                        style={{ backgroundColor: '#3FA9F5' }}
                        className="px-2 py-0.5 text-white font-black text-xs rounded"
                      >
                        路線 01 • 北陸・上越新幹線
                      </span>
                      <span className="font-mono-clean font-bold text-[11px] text-sky-950 bg-sky-100 px-2 py-0.5 rounded border border-sky-300">
                        かがやき・はくたか・とき
                      </span>
                    </div>
                    <div className="text-base font-black text-neutral-900 pt-0.5">
                      東京 ⇒ 長野・金沢・敦賀 / 新潟
                    </div>
                    <p className="text-[11px] text-neutral-700 font-medium">
                      かがやき・はくたか・とき 空席照会ページ
                    </p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-sky-200 flex items-center justify-between font-bold text-xs text-sky-950">
                    <span>北陸・上越方面を選択</span>
                    <span
                      style={{ backgroundColor: '#3FA9F5' }}
                      className="px-2 py-0.5 text-white rounded text-xs font-black"
                    >
                      空席照会 ▶
                    </span>
                  </div>
                </div>

                {/* TOP-RIGHT TARGET CARD (Mark 1): TOKAIDO-SANYO SHINKANSEN (MV-02) */}
                <div
                  id="btn-route-tokaido"
                  data-el="route_tokaido"
                  onClick={() => handleClick(1)}
                  style={{ borderColor: '#1E50A2', backgroundColor: '#FFFFFF' }}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between min-h-[148px] shadow-sm hover:bg-blue-50/40 ${
                    fields.selectedRoute === 'tokyo_osaka'
                      ? 'ring-4 ring-amber-300 shadow-lg scale-[1.01]'
                      : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div
                      style={{ backgroundColor: '#1E50A2' }}
                      className="h-1.5 w-full rounded-full mb-1"
                    />
                    <div className="flex items-center justify-between">
                      <span
                        style={{ backgroundColor: '#1E50A2' }}
                        className="px-2 py-0.5 text-white font-black text-xs rounded"
                      >
                        路線 02 • 東海道・山陽新幹線
                      </span>
                      <span className="font-mono-clean font-bold text-[11px] text-blue-950 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                        のぞみ・ひかり・こだま
                      </span>
                    </div>
                    <div className="text-base font-black text-neutral-900 tracking-tight pt-0.5">
                      東京・品川 ⇒ 名古屋・京都・新大阪
                    </div>
                    <p className="text-[11px] text-neutral-700 font-medium">
                      東京駅から新大阪駅方面の指定席・グリーン車特割（トクだ値）空席照会はこちら
                    </p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-blue-200 flex items-center justify-between font-black text-xs text-blue-950">
                    <span>
                      {fields.selectedRoute === 'tokyo_osaka'
                        ? '✓ 選択済 • 次ページへ移動中...'
                        : 'この路線を選択して次へ進む'}
                    </span>
                    <span
                      style={{ backgroundColor: '#1E50A2' }}
                      className="px-2 py-0.5 text-white rounded text-xs"
                    >
                      空席照会 ▶
                    </span>
                  </div>
                </div>

                {/* BOTTOM-LEFT CARD (Mark 2): TOHOKU-HOKKAIDO SHINKANSEN (MV-10) */}
                <div
                  id="btn-route-tohoku"
                  data-el="route_tohoku"
                  onClick={() => handleClick(2)}
                  style={{ borderColor: '#00A040', backgroundColor: '#F0FDF4' }}
                  className="p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between min-h-[148px] shadow-sm hover:brightness-95"
                >
                  <div className="space-y-1">
                    <div
                      style={{ backgroundColor: '#00A040' }}
                      className="h-1.5 w-full rounded-full mb-1"
                    />
                    <div className="flex items-center justify-between">
                      <span
                        style={{ backgroundColor: '#00A040' }}
                        className="px-2 py-0.5 text-white font-black text-xs rounded"
                      >
                        路線 03 • 東北・北海道新幹線
                      </span>
                      <span className="font-mono-clean font-bold text-[11px] text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                        はやぶさ・やまびこ
                      </span>
                    </div>
                    <div className="text-base font-black text-neutral-900 tracking-tight pt-0.5">
                      東京・上野 ⇒ 仙台・盛岡・新青森・新函館北斗
                    </div>
                    <p className="text-[11px] text-neutral-700 font-medium">
                      東北・北海道方面の指定席・グランクラス予約ページへ移動します
                    </p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-emerald-200 flex items-center justify-between font-bold text-xs text-emerald-950">
                    <span>東北・北海道方面を選択</span>
                    <span
                      style={{ backgroundColor: '#00A040' }}
                      className="px-2 py-0.5 text-white rounded text-xs font-black"
                    >
                      空席照会 ▶
                    </span>
                  </div>
                </div>

                {/* BOTTOM-RIGHT CARD (Mark 4): KANJION POINT & IC CARD PORTAL (MV-12) */}
                <div
                  id="btn-route-points"
                  data-el="route_points"
                  onClick={() => handleClick(4)}
                  style={{ borderColor: '#F08300', backgroundColor: '#FFF7ED' }}
                  className="p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between min-h-[148px] shadow-sm hover:brightness-95"
                >
                  <div className="space-y-1">
                    <div
                      style={{ backgroundColor: '#F08300' }}
                      className="h-1.5 w-full rounded-full mb-1"
                    />
                    <div className="flex items-center justify-between">
                      <span
                        style={{ backgroundColor: '#F08300' }}
                        className="px-2 py-0.5 text-white font-black text-xs rounded"
                      >
                        メニュー 04 • かんじおんポイント・ICカード連携
                      </span>
                    </div>
                    <div className="text-base font-black text-neutral-900 pt-0.5">
                      特典チケット交換・交通系ICカード登録
                    </div>
                    <p className="text-[11px] text-neutral-700 font-medium">
                      ポイント交換・ICカード設定ページ
                    </p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-orange-200 flex items-center justify-between font-bold text-xs text-orange-950">
                    <span>ポイント・ICメニュー</span>
                    <span
                      style={{ backgroundColor: '#F08300' }}
                      className="px-2 py-0.5 text-white rounded text-xs font-black"
                    >
                      ポイント ▶
                    </span>
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
          <div className="px-4 py-2.5 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="border-b-2 border-emerald-800 pb-1.5 flex items-center justify-between">
                <div>
                  <h2 data-el="page_title" className="text-base font-black text-emerald-950">
                    STEP 2: 乗車条件・搭乗者名（ローマ字）の入力
                  </h2>
                  <p className="text-[11px] text-neutral-600 font-medium">
                    予約名義となるお客様情報を入力してください。ローマ字（姓）入力で空席照会へ進みます。
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

              {/* Member Registration Orange Banner (Mark 38) & Reuse Checkbox (Mark 37) */}
              <div className="flex items-center justify-between gap-3">
                <button
                  id="btn-member-banner"
                  data-el="member_banner"
                  type="button"
                  onClick={() => handleClick(38)}
                  style={{ backgroundColor: '#F08300' }}
                  className="flex-1 px-3.5 py-1.5 rounded border-2 border-orange-900 text-white font-black text-xs shadow-sm flex items-center justify-between hover:brightness-105"
                >
                  <span>会員登録で次回から入力不要！ ▶</span>
                  <span className="px-2 py-0.5 bg-white text-orange-900 rounded text-[11px] font-black">
                    無料登録 ▶
                  </span>
                </button>

                <label
                  id="chk-reuse-info"
                  data-el="reuse_info"
                  onClick={() => handleClick(37)}
                  className="px-3 py-1.5 bg-stone-100 border-2 border-neutral-400 rounded flex items-center gap-2 cursor-pointer text-xs font-bold text-neutral-800 shrink-0"
                >
                  <input
                    type="checkbox"
                    checked={reuseInfo}
                    readOnly
                    className="w-3.5 h-3.5 accent-emerald-700 pointer-events-none"
                  />
                  <span>前回の入力内容を使用する</span>
                </label>
              </div>

              {/* Selected Route & Departure Summary Compact Bar */}
              <div className="grid grid-cols-3 gap-2 bg-emerald-50 border border-emerald-600 px-3 py-1.5 rounded text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-emerald-800">選択路線:</span>
                  <span className="font-black text-neutral-900">東海道新幹線（東京 ⇒ 新大阪）</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-emerald-800">乗車日時:</span>
                  <span className="font-black text-neutral-900">11月05日 14:30発</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-emerald-800">人数:</span>
                  <span className="font-black text-neutral-900">大人 1名（eチケット）</span>
                </div>
              </div>

              {/* 3x2 Passenger Name Maze Grid + Row 4 Phone Input */}
              <div className="p-3 bg-stone-50 border-2 border-neutral-400 rounded-lg space-y-2.5 shadow-sm">
                {/* Row 1: Kanji (Marks 31, 32) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-neutral-900">姓（漢字）</span>
                      <span className="px-1.5 py-0.2 bg-neutral-200 text-neutral-700 font-bold text-[10px] rounded">
                        全角
                      </span>
                    </div>
                    <div
                      id="input-name-kanji-sei"
                      data-el="name_kanji_sei"
                      onClick={() => handleClick(31)}
                      className="px-3 py-1.5 bg-white border-2 border-neutral-400 rounded flex items-center justify-between min-h-[34px]"
                    >
                      <span className="font-mono-clean text-sm font-black text-neutral-950">
                        {nameKanjiSei || (
                          <span className="text-neutral-400 font-normal text-xs">例）山田</span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-500">
                        {nameKanjiSei ? '入力済' : '未入力'}
                      </span>
                    </div>
                    {nameKanjiSei && /[A-Za-z]/.test(nameKanjiSei) && (
                      <div className="text-[11px] font-bold text-red-600 mt-0.5">
                        全角で入力してください
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-neutral-900">名（漢字）</span>
                      <span className="px-1.5 py-0.2 bg-neutral-200 text-neutral-700 font-bold text-[10px] rounded">
                        全角
                      </span>
                    </div>
                    <div
                      id="input-name-kanji-mei"
                      data-el="name_kanji_mei"
                      onClick={() => handleClick(32)}
                      className="px-3 py-1.5 bg-white border-2 border-neutral-400 rounded flex items-center justify-between min-h-[34px]"
                    >
                      <span className="font-mono-clean text-sm font-black text-neutral-950">
                        {nameKanjiMei || (
                          <span className="text-neutral-400 font-normal text-xs">例）太郎</span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-500">
                        {nameKanjiMei ? '入力済' : '未入力'}
                      </span>
                    </div>
                    {nameKanjiMei && /[A-Za-z]/.test(nameKanjiMei) && (
                      <div className="text-[11px] font-bold text-red-600 mt-0.5">
                        全角で入力してください
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Katakana (Marks 33, 34) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-neutral-900">セイ（カナ）</span>
                      <span className="px-1.5 py-0.2 bg-neutral-200 text-neutral-700 font-bold text-[10px] rounded">
                        全角カナ
                      </span>
                    </div>
                    <div
                      id="input-name-kana-sei"
                      data-el="name_kana_sei"
                      onClick={() => handleClick(33)}
                      className="px-3 py-1.5 bg-white border-2 border-neutral-400 rounded flex items-center justify-between min-h-[34px]"
                    >
                      <span className="font-mono-clean text-sm font-black text-neutral-950">
                        {nameKanaSei || (
                          <span className="text-neutral-400 font-normal text-xs">例）ヤマダ</span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-500">
                        {nameKanaSei ? '入力済' : '未入力'}
                      </span>
                    </div>
                    {nameKanaSei && !/^[ァ-ヶー　 ]+$/.test(nameKanaSei) && (
                      <div className="text-[11px] font-bold text-red-600 mt-0.5">
                        全角カタカナで入力してください
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-neutral-900">メイ（カナ）</span>
                      <span className="px-1.5 py-0.2 bg-neutral-200 text-neutral-700 font-bold text-[10px] rounded">
                        全角カナ
                      </span>
                    </div>
                    <div
                      id="input-name-kana-mei"
                      data-el="name_kana_mei"
                      onClick={() => handleClick(34)}
                      className="px-3 py-1.5 bg-white border-2 border-neutral-400 rounded flex items-center justify-between min-h-[34px]"
                    >
                      <span className="font-mono-clean text-sm font-black text-neutral-950">
                        {nameKanaMei || (
                          <span className="text-neutral-400 font-normal text-xs">例）タロウ</span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-500">
                        {nameKanaMei ? '入力済' : '未入力'}
                      </span>
                    </div>
                    {nameKanaMei && !/^[ァ-ヶー　 ]+$/.test(nameKanaMei) && (
                      <div className="text-[11px] font-bold text-red-600 mt-0.5">
                        全角カタカナで入力してください
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 3: Romaji (Marks 17 target, 35 decoy) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 bg-red-600 text-white font-black text-[10px] rounded">
                          必須
                        </span>
                        <span className="text-xs font-black text-neutral-900">姓（ローマ字）</span>
                      </div>
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-900 font-bold text-[10px] rounded">
                        IC・QR改札認証用
                      </span>
                    </div>
                    <div
                      id="input-passenger-name"
                      data-el="passenger_name"
                      onClick={() => handleClick(17)}
                      className={`px-3 py-1.5 border-2 rounded transition-all flex items-center justify-between min-h-[36px] ${
                        passengerName
                          ? 'bg-amber-100 border-emerald-700 ring-2 ring-amber-300'
                          : 'bg-white border-emerald-700'
                      }`}
                    >
                      <span className="font-mono-clean text-sm font-black tracking-wider text-neutral-950">
                        {passengerName || (
                          <span className="text-neutral-400 font-normal text-xs tracking-normal">
                            半角英字
                          </span>
                        )}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          passengerName
                            ? 'bg-emerald-700 text-amber-200'
                            : 'bg-neutral-200 text-neutral-600'
                        }`}
                      >
                        {passengerName ? '✓ 入力済' : '未入力'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-neutral-900">名（ローマ字）</span>
                      <span className="px-1.5 py-0.2 bg-neutral-200 text-neutral-700 font-bold text-[10px] rounded">
                        任意
                      </span>
                    </div>
                    <div
                      id="input-name-romaji-mei"
                      data-el="name_romaji_mei"
                      onClick={() => handleClick(35)}
                      className="px-3 py-1.5 bg-white border-2 border-neutral-400 rounded flex items-center justify-between min-h-[36px]"
                    >
                      <span className="font-mono-clean text-sm font-black tracking-wider text-neutral-950">
                        {givenNameRomaji || (
                          <span className="text-neutral-400 font-normal text-xs tracking-normal">
                            半角英字
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-500">
                        {givenNameRomaji ? '入力済' : '未入力'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 4: Phone Number (Mark 36) */}
                <div className="grid grid-cols-2 gap-4 pt-1 border-t border-neutral-300">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-neutral-900">
                        電話番号（ハイフンなし）
                      </span>
                      <span className="px-1.5 py-0.2 bg-neutral-200 text-neutral-700 font-bold text-[10px] rounded">
                        緊急連絡先
                      </span>
                    </div>
                    <div
                      id="input-phone"
                      data-el="phone"
                      onClick={() => handleClick(36)}
                      className="px-3 py-1.5 bg-white border-2 border-neutral-400 rounded flex items-center justify-between min-h-[34px]"
                    >
                      <span className="font-mono-clean text-sm font-black text-neutral-950">
                        {phoneVal || (
                          <span className="text-neutral-400 font-normal text-xs">
                            例）09012345678
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-500">
                        {phoneVal ? '入力済' : '未入力'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end pb-1">
                    <p className="text-[11px] text-neutral-600">
                      ※ 改札機でのIC・QR認証には3段目左の「姓（ローマ字）」が必要です。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            PAGE 03: SEAT MATRIX & MOVING FLASH-SALE WINDOW (MV-03)
           ================================================================= */}
        {pageId === 'MV-03' && (
          <div className="px-3.5 py-2 flex-1 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="border-b-2 border-emerald-800 pb-1 flex items-center justify-between">
                <div>
                  <h2 data-el="page_title" className="text-base font-black text-emerald-950">
                    STEP 3: 列車・座席指定（タイムセール特割 空席照会）
                  </h2>
                  <p className="text-[11px] text-neutral-600 font-medium">
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

              {/* Green Car Upgrade Campaign Banner (Mark 56) */}
              <button
                id="btn-upgrade-banner"
                data-el="upgrade_banner"
                type="button"
                onClick={() => handleClick(56)}
                style={{ backgroundColor: '#15803D' }}
                className="w-full px-3.5 py-1.5 rounded border-2 border-emerald-950 text-white font-black text-xs shadow-sm flex items-center justify-between hover:brightness-105"
              >
                <span>グリーン車 アップグレードキャンペーン実施中 ▶</span>
                <span className="px-2 py-0.5 bg-amber-300 text-emerald-950 rounded text-[11px] font-black">
                  キャンペーン詳細 ▶
                </span>
              </button>

              {/* MOVING / TIMED FLASH DISCOUNT WINDOW BAR */}
              <div className="grid grid-cols-4 gap-2 bg-neutral-900 text-white px-3 py-1.5 rounded-md text-xs font-bold items-center shadow">
                <span className="text-amber-300 font-black flex items-center gap-1">
                  <span>⚡ トクだ値 タイムセール枠:</span>
                </span>
                <span
                  className={`text-center py-0.5 rounded transition-all ${
                    activeFlashColumn === 0
                      ? 'bg-amber-400 text-neutral-950 font-black scale-105 shadow'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  自由席枠
                </span>
                <span
                  className={`text-center py-0.5 rounded transition-all ${
                    activeFlashColumn === 1
                      ? 'bg-amber-400 text-neutral-950 font-black scale-105 shadow'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  普通車指定席枠
                </span>
                <span
                  className={`text-center py-0.5 rounded transition-all ${
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
                    <th className="border border-neutral-400 py-1.5 px-2.5 text-left font-bold">
                      列車名・発着時刻（東京 ⇒ 新大阪）
                    </th>
                    <th className="border border-neutral-400 py-1.5 px-2 text-center font-bold">
                      自由席
                    </th>
                    <th className="border border-neutral-400 py-1.5 px-2 text-center font-bold">
                      指定席
                    </th>
                    <th className="border border-neutral-400 py-1.5 px-2 text-center bg-emerald-100 font-bold text-emerald-900">
                      🍀 グリーン車
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Kodama 723 */}
                  <tr className="hover:bg-neutral-50">
                    <td className="border border-neutral-300 py-1.5 px-2.5">
                      <div className="font-bold text-xs text-neutral-900">こだま 723号</div>
                      <div className="text-neutral-600 text-[11px]">14:03発 ⇒ 17:57着</div>
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center">
                      <button
                        id="btn-r1-free"
                        data-el="seat_r1_free"
                        type="button"
                        onClick={() => handleClick(41)}
                        className="px-3 py-1 bg-white hover:bg-neutral-100 border border-neutral-400 rounded font-medium"
                      >
                        ◯ ¥13,870
                      </button>
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center">
                      <button
                        id="btn-r1-res"
                        data-el="seat_r1_reserved"
                        type="button"
                        onClick={() => handleClick(42)}
                        className="px-3 py-1 bg-white hover:bg-neutral-100 border border-neutral-400 rounded font-medium"
                      >
                        ◯ ¥14,400
                      </button>
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center bg-emerald-50/50">
                      <button
                        id="btn-r1-green"
                        data-el="seat_r1_green"
                        type="button"
                        onClick={() => handleClick(43)}
                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded shadow-sm"
                      >
                        ◯ ¥18,170
                      </button>
                    </td>
                  </tr>

                  {/* Row 2: Hikari 515 */}
                  <tr className="hover:bg-neutral-50">
                    <td className="border border-neutral-300 py-1.5 px-2.5">
                      <div className="font-bold text-xs text-neutral-900">ひかり 515号</div>
                      <div className="text-neutral-600 text-[11px]">14:12発 ⇒ 17:10着</div>
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center">
                      <button
                        id="btn-r2-free"
                        data-el="seat_r2_free"
                        type="button"
                        onClick={() => handleClick(44)}
                        className="px-3 py-1 bg-white hover:bg-neutral-100 border border-neutral-400 rounded font-medium"
                      >
                        ◯ ¥13,870
                      </button>
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center">
                      <button
                        id="btn-r2-res"
                        data-el="seat_r2_reserved"
                        type="button"
                        onClick={() => handleClick(45)}
                        className="px-3 py-1 bg-white hover:bg-neutral-100 border border-neutral-400 rounded font-medium"
                      >
                        △ ¥14,520
                      </button>
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center text-neutral-400 bg-neutral-50 font-bold">
                      × 満席
                    </td>
                  </tr>

                  {/* Row 3: Nozomi 22 */}
                  <tr className="hover:bg-neutral-50">
                    <td className="border border-neutral-300 py-1.5 px-2.5">
                      <div className="font-bold text-xs text-neutral-900">のぞみ 22号</div>
                      <div className="text-neutral-600 text-[11px]">14:21発 ⇒ 16:48着</div>
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center">
                      <button
                        id="btn-r3-free"
                        data-el="seat_r3_free"
                        type="button"
                        onClick={() => handleClick(47)}
                        className="px-3 py-1 bg-white hover:bg-neutral-100 border border-neutral-400 rounded font-medium"
                      >
                        ◯ ¥13,870
                      </button>
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center">
                      <button
                        id="btn-r3-res"
                        data-el="seat_r3_reserved"
                        type="button"
                        onClick={() => handleClick(48)}
                        className="px-3 py-1 bg-white hover:bg-neutral-100 border border-neutral-400 rounded font-medium"
                      >
                        ◯ ¥14,720
                      </button>
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center bg-emerald-50/50">
                      <button
                        id="btn-r3-green"
                        data-el="seat_r3_green"
                        type="button"
                        onClick={() => handleClick(49)}
                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded shadow-sm"
                      >
                        ◯ ¥19,590
                      </button>
                    </td>
                  </tr>

                  {/* Row 4: Nozomi 24 (Target Row) */}
                  <tr className="bg-amber-50/70">
                    <td className="border border-neutral-300 py-1.5 px-2.5">
                      <div className="font-black text-xs text-blue-900">のぞみ 24号</div>
                      <div className="text-neutral-700 font-semibold text-[11px]">
                        14:30発 ⇒ 16:57着
                      </div>
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center">
                      <button
                        id="btn-r4-free"
                        data-el="seat_r4_free"
                        type="button"
                        onClick={() => handleClick(50)}
                        className="px-3 py-1 bg-white hover:bg-neutral-100 border border-neutral-400 rounded font-medium"
                      >
                        ◯ ¥13,870
                      </button>
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center">
                      <button
                        id="btn-r4-res"
                        data-el="seat_r4_reserved"
                        type="button"
                        onClick={() => handleClick(51)}
                        className="px-3 py-1 bg-white hover:bg-neutral-100 border border-neutral-400 rounded font-medium"
                      >
                        ◯ ¥14,720
                      </button>
                    </td>
                    <td
                      className={`border border-neutral-300 py-1.5 px-2 text-center transition-all ${
                        isGreenSelected && fields.trainName === 'Nozomi 24'
                          ? 'bg-amber-200 ring-2 ring-inset ring-emerald-800'
                          : activeFlashColumn === 2
                          ? 'bg-emerald-100 ring-2 ring-inset ring-amber-400'
                          : 'bg-emerald-50/50'
                      }`}
                    >
                      <button
                        id="target-green-btn"
                        data-el="seat_r4_green"
                        type="button"
                        onClick={() => handleClick(52)}
                        className={`px-3 py-1 font-black shadow rounded transition-all ${
                          isGreenSelected && fields.trainName === 'Nozomi 24'
                            ? 'bg-emerald-700 ring-2 ring-emerald-950 border-2 border-amber-300 text-amber-200 scale-105'
                            : activeFlashColumn === 2
                            ? 'bg-emerald-600 text-white ring-2 ring-amber-300 shadow-md scale-[1.03]'
                            : 'bg-emerald-700 text-white'
                        }`}
                      >
                        {isGreenSelected && fields.trainName === 'Nozomi 24'
                          ? `✓ 選択中 • ${greenSeatLabel}`
                          : greenSeatLabel}
                      </button>
                    </td>
                  </tr>

                  {/* Row 5: Nozomi 26 */}
                  <tr className="hover:bg-neutral-50">
                    <td className="border border-neutral-300 py-1.5 px-2.5">
                      <div className="font-bold text-xs text-neutral-900">のぞみ 26号</div>
                      <div className="text-neutral-600 text-[11px]">14:39発 ⇒ 17:06着</div>
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center">
                      <button
                        id="btn-r5-free"
                        data-el="seat_r5_free"
                        type="button"
                        onClick={() => handleClick(53)}
                        className="px-3 py-1 bg-white hover:bg-neutral-100 border border-neutral-400 rounded font-medium"
                      >
                        ◯ ¥13,870
                      </button>
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center text-neutral-400 bg-neutral-50 font-bold">
                      × 満席
                    </td>
                    <td className="border border-neutral-300 py-1.5 px-2 text-center bg-emerald-50/50">
                      <button
                        id="btn-r5-green"
                        data-el="seat_r5_green"
                        type="button"
                        onClick={() => handleClick(55)}
                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded shadow-sm"
                      >
                        ◯ ¥19,590
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
          <div className="p-3.5 flex-1 flex flex-col justify-between relative">
            <div className={`space-y-2.5 ${isMv07Modal ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="border-b-2 border-emerald-800 pb-1.5 flex items-center justify-between">
                <div>
                  <h2
                    data-el={isMv07Modal ? undefined : 'page_title'}
                    className="text-base font-black text-emerald-950"
                  >
                    STEP 4: ご予約内容の確認・本人自署サイン
                  </h2>
                  <p className="text-[11px] text-neutral-600 font-medium">
                    下の署名枠内にサインを記入し、内容を確認のうえ予約を確定してください。
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

              {/* e-Ticket Discount Banner (Mark 64) */}
              <button
                id="btn-eticket-banner"
                data-el={isMv07Modal ? undefined : 'eticket_banner'}
                type="button"
                onClick={() => handleClick(64)}
                style={{ backgroundColor: '#F08300' }}
                className="w-full px-3.5 py-1.5 rounded border-2 border-amber-800 text-white font-black text-xs shadow-sm flex items-center justify-between hover:brightness-105"
              >
                <span>eチケットなら さらに¥200おトク！ ▶</span>
                <span className="px-2 py-0.5 bg-white text-amber-900 rounded text-[11px] font-black">
                  ICカード連携 ▶
                </span>
              </button>

              {/* Selected Ticket Summary Card */}
              <div className="bg-emerald-50 border-2 border-emerald-700 p-2.5 rounded-lg text-xs">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-1.5 mb-2">
                  <span className="font-black text-emerald-950 text-xs">
                    ご予約内容サマリー
                  </span>
                  <button
                    id="link-change-details"
                    data-el={isMv07Modal ? undefined : 'change_details'}
                    type="button"
                    onClick={() => handleClick(62)}
                    className="text-blue-700 hover:text-blue-900 underline font-bold text-xs"
                  >
                    内容を変更する
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-3">
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
              </div>

              {/* LARGE INTERACTIVE DIGITAL SIGNATURE PAD (#27) */}
              <div className="p-3 bg-stone-50 border-2 border-neutral-400 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-black text-xs text-emerald-950 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-800 text-white rounded text-[11px]">
                      必須署名
                    </span>
                    <span>自署・本人確認サイン欄（グリーン車特割 発券認証）</span>
                  </div>
                  <span className="text-[11px] font-bold text-neutral-600">
                    枠内にサインを描画してください
                  </span>
                </div>

                <div
                  id="signature-canvas"
                  data-el={isMv07Modal ? undefined : 'signature_pad'}
                  onClick={() => handleClick(27)}
                  className={`h-24 bg-white border-2 rounded-md relative flex items-center justify-center px-6 cursor-crosshair transition-all ${
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
                    className="w-full h-14 overflow-visible pointer-events-none"
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

                {/* Terms Link under the Pad (Mark 63) */}
                <div className="flex items-center gap-2 pt-0.5 text-[11px] text-neutral-600">
                  <button
                    id="link-terms"
                    data-el={isMv07Modal ? undefined : 'terms_link'}
                    type="button"
                    onClick={() => handleClick(63)}
                    className="text-blue-700 hover:text-blue-900 underline font-bold"
                  >
                    利用規約
                  </button>
                  <span>※ ご予約確定前に運送約款および利用規約をご確認ください。</span>
                </div>
              </div>
            </div>

            {/* Bottom Confirmation Bar */}
            <div
              className={`bg-neutral-100 border-t-2 border-neutral-300 px-3 py-2.5 flex items-center justify-between rounded-b ${
                isMv07Modal ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <label
                  htmlFor="chk-insurance"
                  data-el={isMv07Modal ? undefined : 'insurance_checkbox'}
                  onClick={() => handleClick(28)}
                  className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 cursor-pointer"
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

                <button
                  id="btn-cancel-booking"
                  data-el={isMv07Modal ? undefined : 'cancel_booking'}
                  type="button"
                  onClick={() => handleClick(29)}
                  className="px-3 py-2 bg-neutral-300 hover:bg-neutral-400 text-neutral-800 text-xs font-bold border border-neutral-400 rounded"
                >
                  予約を取消
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  id="btn-save-later"
                  data-el={isMv07Modal ? undefined : 'save_for_later'}
                  type="button"
                  onClick={() => handleClick(60)}
                  className="px-3.5 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-bold border border-neutral-400 rounded"
                >
                  一時保存
                </button>
                <button
                  id="btn-review-booking"
                  data-el={isMv07Modal ? undefined : 'review_booking'}
                  type="button"
                  onClick={() => handleClick(61)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow rounded"
                >
                  入力内容を確認する
                </button>
                <button
                  id="target-confirm-btn"
                  data-el={isMv07Modal ? undefined : 'confirm_booking'}
                  type="button"
                  onClick={() => handleClick(30)}
                  className={`px-5 py-2 font-black text-xs shadow-md rounded transition-all ${
                    isFinalConfirmed
                      ? 'bg-emerald-800 text-amber-200 ring-4 ring-amber-400 border-2 border-amber-300'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isFinalConfirmed
                    ? '✓ 確定済 • 予約を確定する ▶'
                    : '予約を確定する ▶'}
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
