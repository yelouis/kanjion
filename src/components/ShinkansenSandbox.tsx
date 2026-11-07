import React, { useState, useEffect } from 'react';
import type { ShinkansenMicroState } from '../types/engine';
import type { SoMElement } from '../types/puzzle';
import { resolveSignatureDrawingSpec } from '../utils/text_normalizer';

export interface ShinkansenSandboxProps {
  /** Current sandbox micro-state */
  microState: ShinkansenMicroState;
  /** Whether backend Set-of-Mark tags overlay is visible */
  somOverlayActive: boolean;
  /** Click handler dispatched when an interactive DOM element is activated (omitted in prompt-only gameplay) */
  onElementClick?: (elementId: number | string) => void;
  /** Callback fired when a player attempts to manually click the webpage while in prompt-only mode */
  onBlockedManualClick?: () => void;
  /** Registered Set-of-Mark elements for Macro-View 3 */
  somElements?: SoMElement[];
  /** Optional active flash-sale column index (0 = Free, 1 = Reserved, 2 = Green Car) for timed element animation */
  activeFlashColumn?: 0 | 1 | 2;
  /** Optional partial signature stroke progress (0 to 1) for replay animation */
  signatureProgress?: number;
  /** Optional preview signature stroke specification while drawing */
  signatureStroke?: string;
  /** Whether to render distinct full-screen pages across the 12-page JR-East Ekinet portal */
  multiPageMode?: boolean;
  /** Whether page transitions should happen immediately (used by LoopedTargetReplay) */
  instantPageFlip?: boolean;
}

export const ShinkansenSandbox: React.FC<ShinkansenSandboxProps> = ({
  microState,
  somOverlayActive,
  onElementClick,
  onBlockedManualClick,
  activeFlashColumn: externalFlashColumn,
  signatureProgress,
  signatureStroke,
  multiPageMode = false,
}) => {
  const handleClick = (id: number) => {
    if (onElementClick) {
      onElementClick(id);
    } else if (onBlockedManualClick) {
      onBlockedManualClick();
    }
  };

  const isGreenSelected = microState.greenCarSelected;
  const isInsChecked = microState.insuranceCheckboxChecked;
  const isFinalConfirmed = microState.finalConfirmed;
  const isHikariFreeSelected =
    microState.trainName === 'Hikari 515' && microState.seatClass === 'ordinary_free';
  const isHikariResSelected =
    microState.trainName === 'Hikari 515' && microState.seatClass === 'ordinary_reserved';
  const isNozomiFreeSelected =
    microState.trainName === 'Nozomi 24' && microState.seatClass === 'ordinary_free';
  const isNozomiResSelected =
    microState.trainName === 'Nozomi 24' && microState.seatClass === 'ordinary_reserved';
  const isPromoTrapHit = microState.insuranceTrapHit;

  const passengerName = microState.passengerName ?? '';
  const isSignatureSigned = Boolean(microState.signatureSigned);
  const effectiveSigProgress =
    typeof signatureProgress === 'number' ? signatureProgress : isSignatureSigned ? 1 : 0;
  const sigSpec = resolveSignatureDrawingSpec(signatureStroke ?? microState.signatureStroke);

  // Live cycling flash-sale window for the live agent webpage when externalFlashColumn isn't controlled
  const [internalFlashCol, setInternalFlashCol] = useState<0 | 1 | 2>(2);
  useEffect(() => {
    if (externalFlashColumn !== undefined || process.env.NODE_ENV === 'test') return;
    const timer = setInterval(() => {
      setInternalFlashCol((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
    }, 950);
    return () => clearInterval(timer);
  }, [externalFlashColumn]);

  const activeFlashColumn = externalFlashColumn ?? internalFlashCol;

  // Determine target page in the 12-page JR-East Ekinet portal
  const targetPortalPage = (() => {
    if (microState.macroViewId === 'MV-11' || microState.selectedRoute === 'hokuriku_kagayaki') {
      return 11;
    }
    if (microState.macroViewId === 'MV-12') {
      return 12;
    }
    if (microState.selectedRoute === 'tohoku_hayabusa' || microState.macroViewId === 'MV-10') {
      return 10;
    }
    if (isFinalConfirmed || microState.macroViewId === 'MV-05') {
      return 5;
    }
    if (isGreenSelected || microState.macroViewId === 'MV-04') {
      return 4;
    }
    if (passengerName.length > 0 && microState.macroViewId !== 'MV-02') {
      return 3;
    }
    if (
      microState.selectedRoute === 'tokyo_osaka' ||
      microState.selectedRoute === 'tokyo_shinosaka' ||
      microState.macroViewId === 'MV-02'
    ) {
      return 2;
    }
    return 1;
  })();

  const displayedPage = targetPortalPage;

  // ===========================================================================
  // TRUE MULTI-PAGE PORTAL RENDERING (Pages 1..12 of JR-East Ekinet Portal)
  // ===========================================================================
  if (multiPageMode) {
    return (
      <div className="w-full h-full bg-white flex flex-col justify-between text-neutral-900 select-none">
        <div className="flex-1 flex flex-col">
          {/* Shared JR-East Ekinet Portal Top Bar */}
          <header className="bg-emerald-700 text-white px-3.5 py-2 flex items-center justify-between border-b-4 border-emerald-900">
            <div className="flex items-center gap-2.5">
              <span className="font-black text-sm bg-white text-emerald-800 px-2 py-0.5 rounded shadow-sm">
                えきねっと JR
              </span>
              <span className="font-bold text-sm tracking-tight">
                新幹線 インターネット予約ポータル（全12ページ）
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 bg-emerald-950 text-amber-300 font-mono-clean font-black rounded border border-emerald-500">
                PAGE {String(displayedPage).padStart(2, '0')} / 12
              </span>
              <button
                id="btn-logout"
                type="button"
                onClick={() => handleClick(11)}
                className="relative px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded"
              >
                ログアウト
              </button>
            </div>
          </header>

          {/* Portal Breadcrumb Stepper */}
          <div className="bg-emerald-950 text-white px-3.5 py-1.5 flex items-center justify-between text-[11px] border-b border-emerald-800">
            <div className="flex items-center gap-2 font-bold">
              <span
                className={`px-2 py-0.5 rounded ${
                  displayedPage === 1
                    ? 'bg-amber-300 text-neutral-950 font-black'
                    : 'bg-emerald-800 text-emerald-200'
                }`}
              >
                1. 路線選択
              </span>
              <span>▸</span>
              <span
                className={`px-2 py-0.5 rounded ${
                  displayedPage === 2
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
                  displayedPage === 3
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
                  displayedPage === 4
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
                  displayedPage === 5
                    ? 'bg-amber-300 text-neutral-950 font-black'
                    : 'text-emerald-400'
                }`}
              >
                5. 発券完了
              </span>
            </div>
            <span className="font-mono-clean text-[10px] text-emerald-300">
              eki-net.com/personal/page-{String(displayedPage).padStart(2, '0')}
            </span>
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
              type="button"
              onClick={() => handleClick(12)}
              className={`px-3 py-1 font-bold text-xs shadow relative transition-all ${
                isPromoTrapHit
                  ? 'bg-red-900 text-amber-200 ring-2 ring-amber-400 border-2 border-amber-300'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {isPromoTrapHit ? '✓ 申込済 • 今すぐ申し込む（赤ボタン）' : '今すぐ申し込む（赤ボタン）'}
            </button>
          </div>

          {/* =================================================================
              PAGE 01 / 12: ROUTE SELECTION PORTAL (MV-01)
             ================================================================= */}
          {displayedPage === 1 && (
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="border-b-2 border-emerald-800 pb-2 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-emerald-950">
                      STEP 1: ご利用になる新幹線路線を選択してください
                    </h2>
                    <p className="text-xs text-neutral-600 font-medium">
                      ご希望の方面カードをクリックすると、乗車日時・搭乗者名入力ページ（Page 02）へ進みます。
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
                    onClick={() => handleClick(1)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between min-h-[170px] ${
                      microState.selectedRoute === 'tokyo_osaka'
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
                        {microState.selectedRoute === 'tokyo_osaka'
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
                    onClick={() => handleClick(2)}
                    className="p-4 rounded-lg border-2 border-neutral-300 bg-neutral-50 hover:bg-neutral-100 cursor-pointer transition-all flex flex-col justify-between min-h-[170px]"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-neutral-700 text-white font-black text-xs rounded">
                          路線 02 • 東北・北海道新幹線 (Page 10)
                        </span>
                        <span className="font-mono-clean font-bold text-xs text-neutral-600 bg-neutral-200 px-2 py-0.5 rounded">
                          はやぶさ・やまびこ
                        </span>
                      </div>
                      <div className="text-xl font-black text-neutral-800 tracking-tight pt-1">
                        東京・上野 ⇒ 仙台・盛岡・新青森・新函館北斗
                      </div>
                      <p className="text-xs text-neutral-600 font-medium">
                        東北・北海道方面の指定席・グランクラス予約ページ（MV-10）へ移動します
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-neutral-300 flex items-center justify-between font-bold text-sm text-neutral-700">
                      <span>東北・北海道方面を選択</span>
                      <span className="px-2.5 py-1 bg-neutral-300 text-neutral-800 rounded text-xs">
                        Page 10 へ ▶
                      </span>
                    </div>
                  </div>

                  {/* DECOY CARD #3: HOKURIKU-JOETSU SHINKANSEN (MV-11) */}
                  <div
                    id="btn-route-hokuriku"
                    onClick={() => handleClick(3)}
                    className="p-4 rounded-lg border-2 border-neutral-300 bg-neutral-50 hover:bg-neutral-100 cursor-pointer transition-all flex flex-col justify-between min-h-[150px]"
                  >
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 bg-blue-900 text-white font-black text-xs rounded">
                        路線 03 • 北陸・上越新幹線 (Page 11)
                      </span>
                      <div className="text-lg font-black text-neutral-800 pt-1">
                        東京 ⇒ 長野・金沢・敦賀 / 新潟
                      </div>
                      <p className="text-xs text-neutral-600">
                        かがやき・はくたか・とき 空席照会ページ（MV-11）
                      </p>
                    </div>
                    <div className="text-right text-xs font-bold text-neutral-600">
                      Page 11 へ ▶
                    </div>
                  </div>

                  {/* DECOY CARD #4: JRE POINT & IC CARD PORTAL (MV-12) */}
                  <div
                    id="btn-route-points"
                    onClick={() => handleClick(4)}
                    className="p-4 rounded-lg border-2 border-neutral-300 bg-neutral-50 hover:bg-neutral-100 cursor-pointer transition-all flex flex-col justify-between min-h-[150px]"
                  >
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 bg-amber-700 text-white font-black text-xs rounded">
                        メニュー 04 • JRE POINT・Suica連携 (Page 12)
                      </span>
                      <div className="text-lg font-black text-neutral-800 pt-1">
                        特典チケット交換・交通系ICカード登録
                      </div>
                      <p className="text-xs text-neutral-600">
                        ポイント交換・タッチでGo!新幹線設定ページ（MV-12）
                      </p>
                    </div>
                    <div className="text-right text-xs font-bold text-neutral-600">
                      Page 12 へ ▶
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              PAGE 02 / 12: DEPARTURE TIME & PASSENGER NAME FORM (MV-02)
             ================================================================= */}
          {displayedPage === 2 && (
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b-2 border-emerald-800 pb-2 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-emerald-950">
                      STEP 2: 乗車条件・搭乗者名（ローマ字）の入力
                    </h2>
                    <p className="text-xs text-neutral-600 font-medium">
                      予約名義となる搭乗者名をローマ字で入力すると、空席照会・座席表ページ（Page 03）へ進みます。
                    </p>
                  </div>
                  <button
                    id="btn-back-conditions"
                    type="button"
                    onClick={() => handleClick(14)}
                    className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-400 rounded text-xs font-bold"
                  >
                    ◀ 路線選択 (Page 01) へ戻る
                  </button>
                </div>

                {/* Selected Route & Departure Summary Card */}
                <div className="grid grid-cols-3 gap-3 bg-emerald-50 border-2 border-emerald-600 p-3.5 rounded-lg">
                  <div>
                    <div className="text-[11px] font-bold text-emerald-800">選択路線 (Route)</div>
                    <div className="text-sm font-black text-neutral-900 mt-0.5">
                      ✓ 東海道新幹線（東京 ⇒ 新大阪）
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-emerald-800">乗車日時 (Departure)</div>
                    <div className="text-sm font-black text-neutral-900 mt-0.5">
                      ✓ 11月05日 14:30発（片道）
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-emerald-800">人数 (Passengers)</div>
                    <div className="text-sm font-black text-neutral-900 mt-0.5">
                      大人 1名（スマートEX / eチケット）
                    </div>
                  </div>
                </div>

                {/* LARGE INTERACTIVE PASSENGER NAME INPUT FIELD (#17) */}
                <div className="p-5 bg-stone-50 border-2 border-neutral-400 rounded-lg space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="px-2 py-0.5 bg-red-600 text-white font-black text-[11px] rounded mr-2">
                        必須入力 (REQUIRED TYPE FIELD)
                      </span>
                      <span className="text-base font-black text-neutral-900">
                        搭乗者名（ローマ字入力） / Passenger Name
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-800">
                      入力例: TANAKA
                    </span>
                  </div>

                  <div
                    id="input-passenger-name"
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
                          ここに搭乗者名 (TANAKA) をタイピング入力...
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
                      {passengerName ? '✓ 入力完了 (TYPED) ▸ 次ページへ' : 'TYPE "TANAKA"'}
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
              PAGE 03 / 12: SEAT MATRIX & MOVING FLASH-SALE WINDOW (MV-03)
             ================================================================= */}
          {displayedPage === 3 && (
            <div className="p-3.5 flex-1 flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="border-b-2 border-emerald-800 pb-1.5 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-emerald-950">
                      STEP 3: 列車・座席指定（タイムセール特割 空席照会）
                    </h2>
                    <p className="text-xs text-neutral-600 font-medium">
                      移動する「⚡ トクだ値 タイムセール枠」に合わせてご希望の座席ボタンをクリックすると Page 04 へ進みます。
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="px-2 py-0.5 bg-amber-100 border border-amber-400 text-neutral-900 rounded">
                      搭乗者: {passengerName || 'TANAKA'} 様
                    </span>
                    <button
                      id="btn-back-conditions"
                      type="button"
                      onClick={() => handleClick(14)}
                      className="px-2.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-400 rounded"
                    >
                      ◀ 条件変更 (Page 02)
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
                            ? '✓ 選択中 • 🍀 ◯ ¥13,870 (特割)'
                            : '🍀 ◯ ¥13,870 (特割)'}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =================================================================
              PAGE 04 / 12: DIGITAL SIGNATURE PAD & FINAL CONFIRMATION (MV-04)
             ================================================================= */}
          {displayedPage === 4 && (
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="border-b-2 border-emerald-800 pb-2 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-emerald-950">
                      STEP 4: ご予約内容の確認・本人自署サイン（Page 04 / 12）
                    </h2>
                    <p className="text-xs text-neutral-600 font-medium">
                      下の署名枠内にサイン（自署ストローク）を記入し、右下の青い「予約内容を確認・確定へ」ボタンをクリックしてください。
                    </p>
                  </div>
                  <button
                    id="btn-back-conditions"
                    type="button"
                    onClick={() => handleClick(14)}
                    className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-400 rounded text-xs font-bold"
                  >
                    ◀ 座席表 (Page 03) へ戻る
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
                      🍀 グリーン車（特割）¥13,870
                    </div>
                  </div>
                  <div>
                    <div className="text-emerald-800 font-bold">搭乗者名</div>
                    <div className="font-mono-clean font-black text-neutral-900 mt-0.5">
                      {passengerName || 'TANAKA'} 様（大人1名）
                    </div>
                  </div>
                </div>

                {/* LARGE INTERACTIVE DIGITAL SIGNATURE PAD (#27) */}
                <div className="p-4 bg-stone-50 border-2 border-neutral-400 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-black text-sm text-emerald-950 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-emerald-800 text-white rounded text-xs">
                        必須署名 (DRAW SIGNATURE)
                      </span>
                      <span>自署・本人確認サイン欄（グリーン車特割 発券認証）</span>
                    </div>
                    <span className="text-xs font-bold text-neutral-600">
                      枠内にサインを描画してください
                    </span>
                  </div>

                  <div
                    id="signature-canvas"
                    onClick={() => handleClick(27)}
                    className={`h-28 bg-white border-2 rounded-md relative flex items-center justify-center px-6 cursor-crosshair transition-all ${
                      effectiveSigProgress > 0
                        ? 'border-emerald-700 ring-4 ring-amber-300 bg-amber-50/40'
                        : 'border-dashed border-neutral-500'
                    }`}
                  >
                    <span className="absolute top-2 left-3 text-xs font-bold text-neutral-400">
                      署名欄 (DRAW SIGNATURE HERE)
                    </span>
                    {effectiveSigProgress > 0 && (
                      <span
                        data-testid="signature-signed-badge"
                        className="absolute top-2 right-3 text-xs font-black text-emerald-800 bg-emerald-100 border border-emerald-500 px-2 py-0.5 rounded"
                      >
                        ✓ 署名済 (SIGNED{sigSpec.displayLabel && sigSpec.displayLabel !== 'T. Tanaka' ? ` • ${sigSpec.displayLabel}` : ''})
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
              <div className="bg-neutral-100 border-t-2 border-neutral-300 px-4 py-3 flex items-center justify-between rounded-b">
                <label
                  htmlFor="chk-insurance"
                  onClick={() => handleClick(28)}
                  className="flex items-center gap-2 text-xs font-bold text-neutral-700 cursor-pointer"
                >
                  <input
                    id="chk-insurance"
                    type="checkbox"
                    checked={isInsChecked}
                    onChange={() => {}}
                    className="w-4 h-4 accent-red-600 pointer-events-none"
                  />
                  <span>旅行キャンセル保険（¥2,400）を追加</span>
                </label>

                <div className="flex items-center gap-3">
                  <button
                    id="btn-cancel-booking"
                    type="button"
                    onClick={() => handleClick(29)}
                    className="px-4 py-2 bg-neutral-300 hover:bg-neutral-400 text-neutral-800 text-xs font-bold border border-neutral-400 rounded"
                  >
                    予約を取消 (Cancel)
                  </button>
                  <button
                    id="target-confirm-btn"
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
            </div>
          )}

          {/* =================================================================
              PAGE 05 / 12: OFFICIAL SHINKANSEN E-TICKET ISSUED (MV-05)
             ================================================================= */}
          {displayedPage === 5 && (
            <div className="p-6 flex-1 flex flex-col justify-center items-center bg-emerald-50/50">
              <div className="w-full max-w-2xl bg-white border-4 border-emerald-700 rounded-xl shadow-lg p-6 space-y-4">
                <div className="flex items-center justify-between border-b-2 border-emerald-700 pb-3">
                  <div>
                    <span className="px-2.5 py-0.5 bg-emerald-700 text-white font-black text-xs rounded">
                      PAGE 05 / 12 • 発券完了 (ISSUED)
                    </span>
                    <h2 className="text-xl font-black text-emerald-950 mt-1">
                      🎉 新幹線 eチケットのご予約・発券が完了しました
                    </h2>
                  </div>
                  <div className="text-right font-mono-clean">
                    <div className="text-xs font-bold text-neutral-500">予約番号</div>
                    <div className="text-lg font-black text-emerald-800">EKI-042-9921</div>
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
                      🍀 グリーン車（特割）¥13,870
                    </div>
                    <div className="text-xs font-bold text-neutral-700 mt-0.5">
                      8号車 12番 A席
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-500">搭乗者名 (Typed)</div>
                    <div className="font-mono-clean font-black text-neutral-900">
                      ✓ {passengerName || 'TANAKA'} 様
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-500">本人自署サイン (Drawn)</div>
                    <div className="font-black text-emerald-800">
                      ✓ デジタル自署認証済 (SIGNED)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              PAGE 10 / 12: WRONG ROUTE BRANCH — TOHOKU SHINKANSEN (MV-10)
             ================================================================= */}
          {displayedPage === 10 && (
            <div className="p-6 flex-1 flex flex-col justify-center items-center bg-red-50/40">
              <div className="w-full max-w-xl bg-white border-4 border-red-700 rounded-xl shadow p-6 space-y-4 text-center">
                <span className="px-3 py-1 bg-red-700 text-white font-black text-xs rounded">
                  PAGE 10 / 12 • 東北・北海道新幹線 予約ページ (WRONG ROUTE)
                </span>
                <h2 className="text-xl font-black text-neutral-900">
                  東北・北海道新幹線（東京 ⇒ 仙台・新青森・新函館北斗）
                </h2>
                <p className="text-xs text-neutral-600">
                  ※ 新大阪方面（東海道新幹線）は路線選択トップ（Page 01）から選択してください。
                </p>
                <button
                  id="btn-back-conditions"
                  type="button"
                  onClick={() => handleClick(14)}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded shadow"
                >
                  ◀ 路線選択トップ (Page 01) へ戻る
                </button>
              </div>
            </div>
          )}

          {/* =================================================================
              PAGE 11 / 12: WRONG ROUTE BRANCH — HOKURIKU SHINKANSEN (MV-11)
             ================================================================= */}
          {displayedPage === 11 && (
            <div className="p-6 flex-1 flex flex-col justify-center items-center bg-blue-50/40">
              <div className="w-full max-w-xl bg-white border-4 border-blue-900 rounded-xl shadow p-6 space-y-4 text-center">
                <span className="px-3 py-1 bg-blue-900 text-white font-black text-xs rounded">
                  PAGE 11 / 12 • 北陸・上越新幹線 予約ページ (WRONG ROUTE)
                </span>
                <h2 className="text-xl font-black text-neutral-900">
                  北陸・上越新幹線（東京 ⇒ 長野・金沢・敦賀 / 新潟）
                </h2>
                <p className="text-xs text-neutral-600">
                  ※ 新大阪方面（東海道新幹線）は路線選択トップ（Page 01）から選択してください。
                </p>
                <button
                  id="btn-back-conditions"
                  type="button"
                  onClick={() => handleClick(14)}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded shadow"
                >
                  ◀ 路線選択トップ (Page 01) へ戻る
                </button>
              </div>
            </div>
          )}

          {/* =================================================================
              PAGE 12 / 12: WRONG BRANCH — JRE POINT & SUICA PORTAL (MV-12)
             ================================================================= */}
          {displayedPage === 12 && (
            <div className="p-6 flex-1 flex flex-col justify-center items-center bg-amber-50/40">
              <div className="w-full max-w-xl bg-white border-4 border-amber-700 rounded-xl shadow p-6 space-y-4 text-center">
                <span className="px-3 py-1 bg-amber-700 text-white font-black text-xs rounded">
                  PAGE 12 / 12 • JRE POINT 特典・Suica IC連携ページ (WRONG PORTAL)
                </span>
                <h2 className="text-xl font-black text-neutral-900">
                  JRE POINT 特典チケット交換・交通系ICカード登録
                </h2>
                <p className="text-xs text-neutral-600">
                  ※ 新幹線の通常指定席・グリーン車特割予約は路線選択トップ（Page 01）から行ってください。
                </p>
                <button
                  id="btn-back-conditions"
                  type="button"
                  onClick={() => handleClick(14)}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded shadow"
                >
                  ◀ 路線選択トップ (Page 01) へ戻る
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Derive active multi-page portal step (1..5 of 12-page JR Ekinet graph) for compact/test view
  const currentPortalStep = isFinalConfirmed
    ? 5
    : isSignatureSigned
    ? 4
    : isGreenSelected
    ? 4
    : passengerName
    ? 3
    : microState.macroViewId === 'MV-01'
    ? 1
    : microState.macroViewId === 'MV-02'
    ? 2
    : 3;

  return (
    <div className="w-full h-full bg-white flex flex-col justify-between text-neutral-900 select-none">
      <div>
        {/* Dense Japanese Portal Header (Row 1) */}
        <header className="bg-emerald-700 text-white px-3 py-2 flex items-center justify-between border-b-4 border-emerald-900">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm bg-white text-emerald-800 px-2 py-0.5 rounded shadow-sm">
              えきねっと風
            </span>
            <span className="font-bold text-sm tracking-tight">
              新幹線 空席照会・座席指定（東京 ⇒ 新大阪）
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className="opacity-50 cursor-not-allowed px-2 py-0.5 bg-emerald-900 rounded"
              title="Inert Link"
            >
              マイページ
            </span>
            <button
              id="btn-logout"
              type="button"
              onClick={() => handleClick(11)}
              className="relative px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded"
            >
              ログアウト
              {somOverlayActive && (
                <span className="som-badge absolute -top-2 -right-2 bg-fuchsia-600 text-white font-mono-clean text-xs px-1 border border-white font-bold shadow-sm z-10">
                  #11
                </span>
              )}
            </button>
          </div>
        </header>

        {/* 12-PAGE JR EKINET PORTAL NAVIGATION & ROUTE SELECTION BAR */}
        <div className="mx-2.5 mt-1.5 px-2.5 py-1.5 bg-emerald-950 text-white rounded flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 bg-emerald-600 text-white font-black rounded text-[10px]">
              12-PAGE PORTAL (STEP {currentPortalStep}/5)
            </span>
            <div
              id="btn-route-tokaido"
              onClick={() => handleClick(1)}
              className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-all border ${
                microState.selectedRoute === 'tokyo_osaka' || microState.selectedRoute === 'tokyo_shinosaka'
                  ? 'bg-amber-300 text-neutral-950 border-amber-400 shadow-sm'
                  : 'bg-emerald-800 text-emerald-100 border-emerald-600'
              }`}
            >
              ✓ 1. 東海道・山陽新幹線 (東京 ⇒ 新大阪)
            </div>
            <div
              id="btn-route-tohoku"
              onClick={() => handleClick(2)}
              className="px-2 py-0.5 rounded bg-emerald-900 text-emerald-300 border border-emerald-700 cursor-pointer"
            >
              東北新幹線 (MV-10)
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold">
            <span className={passengerName ? 'text-amber-300' : 'text-emerald-300'}>
              2. 搭乗者入力 {passengerName ? `(${passengerName} ✓)` : '[未入力]'}
            </span>
            <span>▸</span>
            <span className={isGreenSelected ? 'text-amber-300' : 'text-emerald-300'}>
              3. 特割座席 {isGreenSelected ? '(✓)' : ''}
            </span>
            <span>▸</span>
            <span className={isSignatureSigned ? 'text-amber-300' : 'text-emerald-300'}>
              4. 自署サイン {isSignatureSigned ? '(✓)' : ''}
            </span>
          </div>
        </div>

        {/* DECOY PROMO INSURANCE TRAP BANNER (Row 1 / Col D) */}
        <div className="mx-2.5 mt-1.5 p-1.5 bg-amber-100 border-2 border-red-600 flex items-center justify-between relative shadow-sm">
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
            type="button"
            onClick={() => handleClick(12)}
            className={`px-3 py-1 font-bold text-xs shadow relative active:scale-95 transition-all ${
              isPromoTrapHit
                ? 'bg-red-900 text-amber-200 ring-2 ring-amber-400 border-2 border-amber-300 scale-105'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isPromoTrapHit ? '✓ 申込済 • 今すぐ申し込む（赤ボタン）' : '今すぐ申し込む（赤ボタン）'}
            {somOverlayActive && (
              <span className="som-badge absolute -top-2 -right-2 bg-fuchsia-600 text-white font-mono-clean text-xs px-1 border border-white font-bold shadow-sm z-10">
                #12
              </span>
            )}
          </button>
        </div>

        {/* Main Japanese Fare Table & Search Filter Body (Rows 2 & 3) */}
        <div className="p-2.5 grid grid-cols-12 gap-2.5">
          {/* Left Sidebar Criteria + Passenger Name TYPE Field (Col A / 3 Columns) */}
          <aside className="col-span-3 border border-neutral-300 bg-neutral-50 p-2 space-y-1.5 text-xs rounded">
            <div className="font-bold border-b border-neutral-300 pb-1 text-neutral-800">
              検索条件・搭乗者情報
            </div>
            <div className="p-1.5 bg-emerald-50 border border-emerald-400 text-emerald-900 font-bold rounded">
              11月05日 14:30発<br />大人1名・片道
            </div>

            {/* INTERACTIVE PASSENGER NAME TEXT FIELD (TYPE TASK #17) */}
            <div
              id="input-passenger-name"
              onClick={() => handleClick(17)}
              className={`p-1.5 border-2 rounded transition-all ${
                passengerName
                  ? 'bg-amber-100 border-emerald-700 ring-2 ring-amber-400'
                  : 'bg-white border-neutral-400'
              }`}
            >
              <div className="text-[10px] font-bold text-neutral-700 flex items-center justify-between">
                <span>搭乗者名 (ローマ字入力)</span>
                {passengerName && (
                  <span className="text-emerald-800 font-black">✓ TYPED</span>
                )}
              </div>
              <div className="mt-1 px-2 py-1 bg-neutral-50 border border-neutral-300 font-mono-clean font-black text-xs text-neutral-900 tracking-wider min-h-[24px] flex items-center justify-between">
                <span>{passengerName || 'TANAKA (未入力)'}</span>
                <span className="text-emerald-700 animate-pulse">|</span>
              </div>
            </div>

            <button
              id="btn-back-conditions"
              type="button"
              onClick={() => handleClick(14)}
              className="w-full text-left px-2 py-1 bg-white hover:bg-neutral-100 border border-neutral-400 relative rounded font-medium text-neutral-700"
            >
              ◀ 条件変更へ戻る
              {somOverlayActive && (
                <span className="som-badge absolute -top-2 -right-2 bg-fuchsia-600 text-white font-mono-clean text-xs px-1 border border-white font-bold shadow-sm z-10">
                  #14
                </span>
              )}
            </button>
          </aside>

          {/* Seat Availability Matrix with Moving Flash-Sale Window (Cols B–D / 9 Columns) */}
          <div className="col-span-9 space-y-1.5">
            {/* MOVING / TIMED FLASH DISCOUNT WINDOW BAR */}
            <div className="grid grid-cols-4 gap-1 bg-neutral-900 text-white px-2 py-1 rounded text-[10px] font-bold items-center">
              <span className="text-amber-300 font-black">⚡ トクだ値 タイムセール枠:</span>
              <span
                className={`text-center py-0.5 rounded transition-all ${
                  activeFlashColumn === 0 ? 'bg-amber-400 text-neutral-950 font-black' : 'text-neutral-400'
                }`}
              >
                自由席枠
              </span>
              <span
                className={`text-center py-0.5 rounded transition-all ${
                  activeFlashColumn === 1 ? 'bg-amber-400 text-neutral-950 font-black' : 'text-neutral-400'
                }`}
              >
                指定席枠
              </span>
              <span
                className={`text-center py-0.5 rounded transition-all ${
                  activeFlashColumn === 2
                    ? 'bg-emerald-400 text-neutral-950 font-black ring-2 ring-amber-300'
                    : 'text-neutral-400'
                }`}
              >
                🍀 グリーン特割 [受付中]
              </span>
            </div>

            <table className="w-full border-collapse border border-neutral-400 text-xs">
              <thead>
                <tr className="bg-neutral-200 text-neutral-900">
                  <th className="border border-neutral-400 p-1.5 text-left font-bold">列車名・時刻</th>
                  <th className="border border-neutral-400 p-1.5 text-center font-bold">自由席</th>
                  <th className="border border-neutral-400 p-1.5 text-center font-bold">普通車指定席</th>
                  <th className="border border-neutral-400 p-1.5 text-center bg-emerald-100 font-bold text-emerald-900">
                    🍀 グリーン車
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Train 1: Hikari 515 (Row 2) */}
                <tr className="hover:bg-neutral-50">
                  <td className="border border-neutral-300 p-1.5">
                    <div className="font-bold text-neutral-900">ひかり 515号 (14:12発)</div>
                    <div className="text-neutral-600 text-[11px]">14:12発 ⇒ 17:10着</div>
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-center">
                    <button
                      id="btn-hikari-free"
                      type="button"
                      onClick={() => handleClick(21)}
                      className={`px-2 py-1 border relative rounded transition-all ${
                        isHikariFreeSelected
                          ? 'bg-amber-300 border-2 border-neutral-900 ring-2 ring-amber-500 font-black scale-105'
                          : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-400 font-medium'
                      }`}
                    >
                      {isHikariFreeSelected ? '✓ 選択中 • ◯ ¥13,870' : '◯ ¥13,870'}
                      {somOverlayActive && (
                        <span className="som-badge absolute -top-2 -right-2 bg-fuchsia-600 text-white font-mono-clean text-xs px-1 border border-white font-bold shadow-sm z-10">
                          #21
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-center">
                    <button
                      id="btn-hikari-res"
                      type="button"
                      onClick={() => handleClick(22)}
                      className={`px-2 py-1 border relative rounded transition-all ${
                        isHikariResSelected
                          ? 'bg-amber-300 border-2 border-neutral-900 ring-2 ring-amber-500 font-black scale-105'
                          : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-400 font-medium'
                      }`}
                    >
                      {isHikariResSelected ? '✓ 選択中 • △ ¥14,520' : '△ ¥14,520'}
                      {somOverlayActive && (
                        <span className="som-badge absolute -top-2 -right-2 bg-fuchsia-600 text-white font-mono-clean text-xs px-1 border border-white font-bold shadow-sm z-10">
                          #22
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-center text-neutral-400 bg-neutral-50 font-bold">
                    × 満席
                  </td>
                </tr>

                {/* Train 2: Nozomi 24 Target (Row 3) */}
                <tr className="bg-amber-50/70 hover:bg-amber-100/50">
                  <td className="border border-neutral-300 p-1.5">
                    <div className="font-bold text-blue-900">のぞみ 24号 (14:30発)</div>
                    <div className="text-neutral-700 font-semibold text-[11px]">14:30発 ⇒ 16:57着</div>
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-center">
                    <button
                      id="btn-nozomi-free"
                      type="button"
                      onClick={() => handleClick(23)}
                      className={`px-2 py-1 border relative rounded transition-all ${
                        isNozomiFreeSelected
                          ? 'bg-amber-300 border-2 border-neutral-900 ring-2 ring-amber-500 font-black scale-105'
                          : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-400 font-medium'
                      }`}
                    >
                      {isNozomiFreeSelected ? '✓ 選択中 • ◯ ¥13,870' : '◯ ¥13,870'}
                      {somOverlayActive && (
                        <span className="som-badge absolute -top-2 -right-2 bg-fuchsia-600 text-white font-mono-clean text-xs px-1 border border-white font-bold shadow-sm z-10">
                          #23
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-center">
                    <button
                      id="btn-nozomi-res"
                      type="button"
                      onClick={() => handleClick(24)}
                      className={`px-2 py-1 border relative rounded transition-all ${
                        isNozomiResSelected
                          ? 'bg-amber-300 border-2 border-neutral-900 ring-2 ring-amber-500 font-black scale-105'
                          : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-400 font-medium'
                      }`}
                    >
                      {isNozomiResSelected ? '✓ 選択中 • ◯ ¥14,720' : '◯ ¥14,720'}
                      {somOverlayActive && (
                        <span className="som-badge absolute -top-2 -right-2 bg-fuchsia-600 text-white font-mono-clean text-xs px-1 border border-white font-bold shadow-sm z-10">
                          #24
                        </span>
                      )}
                    </button>
                  </td>
                  <td
                    className={`border border-neutral-300 p-1.5 text-center transition-colors ${
                      isGreenSelected
                        ? 'bg-amber-200/80 ring-2 ring-inset ring-emerald-800'
                        : activeFlashColumn === 2
                        ? 'bg-emerald-100/90'
                        : 'bg-emerald-50'
                    }`}
                  >
                    <button
                      id="target-green-btn"
                      type="button"
                      onClick={() => handleClick(25)}
                      className={`px-2.5 py-1 font-bold shadow relative rounded transition-all ${
                        isGreenSelected
                          ? 'bg-emerald-700 ring-2 ring-emerald-950 border-2 border-amber-300 text-amber-200 shadow-[0_0_14px_rgba(250,204,21,0.9)] scale-105'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {isGreenSelected ? '✓ 選択中 • 🍀 ◯ ¥13,870 (特割)' : '🍀 ◯ ¥13,870 (特割)'}
                      {somOverlayActive && (
                        <span className="som-badge absolute -top-2 -right-2 bg-fuchsia-600 text-white font-mono-clean text-xs px-1 border border-white font-bold shadow-sm z-10">
                          #25
                        </span>
                      )}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* PAGE 4 PANEL: CAR 8 SEAT MAP & DIGITAL SIGNATURE AUTHORIZATION PAD (DRAW TASK #27) */}
            <div className="mt-2 p-2.5 bg-stone-50 border-2 border-neutral-300 rounded grid grid-cols-12 gap-3 items-center">
              <div className="col-span-5 text-xs space-y-1">
                <div className="font-black text-emerald-950 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 bg-emerald-800 text-white rounded text-[10px]">
                    STEP 4
                  </span>
                  <span>自署・本人確認サイン欄 (Signature)</span>
                </div>
                <p className="text-[11px] text-neutral-600 leading-snug">
                  グリーン車特割の発券には、右の署名枠内にサイン（自署ストローク）が必要です。
                </p>
              </div>

              <div
                id="signature-canvas"
                onClick={() => handleClick(27)}
                className={`col-span-7 h-16 bg-white border-2 rounded relative flex items-center justify-center px-3 cursor-crosshair transition-all ${
                  effectiveSigProgress > 0
                    ? 'border-emerald-700 ring-2 ring-amber-400 bg-amber-50/40'
                    : 'border-dashed border-neutral-400'
                }`}
              >
                <span className="absolute top-1 left-2 text-[10px] font-bold text-neutral-400">
                  署名欄 (DRAW SIGNATURE HERE)
                </span>
                {effectiveSigProgress > 0 && (
                  <span className="absolute top-1 right-2 text-[10px] font-black text-emerald-800 bg-emerald-100 px-1.5 rounded">
                    ✓ 署名済 (SIGNED{sigSpec.displayLabel && sigSpec.displayLabel !== 'T. Tanaka' ? ` • ${sigSpec.displayLabel}` : ''})
                  </span>
                )}
                <svg
                  viewBox="0 0 260 60"
                  className="w-full h-11 overflow-visible pointer-events-none"
                >
                  <line
                    x1="15"
                    y1="48"
                    x2="245"
                    y2="48"
                    stroke="#cbd5e1"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  {effectiveSigProgress > 0 && (
                    <>
                      {sigSpec.customText && (
                        <text
                          x="130"
                          y="35"
                          textAnchor="middle"
                          fill="#065f46"
                          fontSize="20"
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
                          strokeWidth="3"
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
        </div>
      </div>

      {/* Bottom Action & Confirmation Bar (Row 4) */}
      <div className="bg-neutral-100 border-t-2 border-neutral-300 px-3 py-2.5 flex items-center justify-between">
        <label
          htmlFor="ins-checkbox"
          onClick={() => handleClick(28)}
          className="flex items-center gap-2 text-xs font-bold text-neutral-700 cursor-pointer relative py-0.5 px-1 hover:bg-neutral-200 rounded"
        >
          <input
            id="ins-checkbox"
            type="checkbox"
            checked={isInsChecked}
            onChange={() => {}}
            className="w-4 h-4 accent-red-600 pointer-events-none"
          />
          <span>旅行キャンセル保険（¥2,400）を追加</span>
          {somOverlayActive && (
            <span className="som-badge ml-1 bg-fuchsia-600 text-white font-mono-clean text-xs px-1 border border-white font-bold shadow-sm z-10">
              #28
            </span>
          )}
        </label>

        <div className="flex items-center gap-2">
          <button
            id="btn-cancel-booking"
            type="button"
            onClick={() => handleClick(29)}
            className="px-3 py-1.5 bg-neutral-300 hover:bg-neutral-400 text-neutral-800 text-xs font-bold border border-neutral-400 relative rounded"
          >
            予約を取消 (Cancel)
            {somOverlayActive && (
              <span className="som-badge absolute -top-2 -right-2 bg-fuchsia-600 text-white font-mono-clean text-xs px-1 border border-white font-bold shadow-sm z-10">
                #29
              </span>
            )}
          </button>

          {/* TARGET CONFIRM BUTTON (#30) */}
          <button
            id="target-confirm-btn"
            type="button"
            onClick={() => handleClick(30)}
            className={`px-4 py-1.5 font-bold text-xs shadow relative active:scale-95 transition-all rounded ${
              isFinalConfirmed
                ? 'bg-blue-800 text-amber-200 ring-2 ring-blue-950 border-2 border-amber-300 shadow-[0_0_14px_rgba(250,204,21,0.9)] scale-105'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isFinalConfirmed ? '✓ 確定済 • 予約内容を確認・確定へ ▶' : '予約内容を確認・確定へ ▶'}
            {somOverlayActive && (
              <span className="som-badge absolute -top-2 -right-2 bg-fuchsia-600 text-white font-mono-clean text-xs px-1 border border-white font-bold shadow-sm z-10">
                #30
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShinkansenSandbox;
