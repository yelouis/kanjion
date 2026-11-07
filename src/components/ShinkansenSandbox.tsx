import React from 'react';
import type { ShinkansenMicroState } from '../types/engine';
import type { SoMElement } from '../types/puzzle';

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
}

export const ShinkansenSandbox: React.FC<ShinkansenSandboxProps> = ({
  microState,
  somOverlayActive,
  onElementClick,
  onBlockedManualClick,
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

        {/* DECOY PROMO INSURANCE TRAP BANNER (Row 1 / Col D) */}
        <div className="mx-2.5 mt-2 p-2 bg-amber-100 border-2 border-red-600 flex items-center justify-between relative shadow-sm">
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
          {/* Left Sidebar Criteria (Col A / 3 Columns) */}
          <aside className="col-span-3 border border-neutral-300 bg-neutral-50 p-2 space-y-1.5 text-xs rounded">
            <div className="font-bold border-b border-neutral-300 pb-1 text-neutral-800">
              検索条件
            </div>
            <div className="p-1.5 bg-emerald-50 border border-emerald-400 text-emerald-900 font-bold rounded">
              11月05日 14:30発<br />大人1名・片道
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
            <div className="text-neutral-400 space-y-1 pt-1 text-[11px]">
              <div className="px-1.5 py-1 bg-neutral-100 cursor-not-allowed rounded">※駅レンタカー (Inert)</div>
              <div className="px-1.5 py-1 bg-neutral-100 cursor-not-allowed rounded">※ホテルパック (Inert)</div>
            </div>
          </aside>

          {/* Seat Availability Matrix (Cols B–D / 9 Columns) */}
          <div className="col-span-9 space-y-2">
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
                      isGreenSelected ? 'bg-amber-200/80 ring-2 ring-inset ring-emerald-800' : 'bg-emerald-50'
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
          </div>
        </div>
      </div>

      {/* Bottom Action Bar (Row 4) */}
      <footer className="flex items-center justify-between bg-neutral-100 border-t border-neutral-300 p-2.5 mt-auto">
        {/* Insurance Add-on Checkbox (Col B / Row 4) */}
        <label className="flex items-center gap-2 text-xs font-semibold text-neutral-800 cursor-pointer select-none relative">
          <input
            id="ins-checkbox"
            type="checkbox"
            checked={isInsChecked}
            onChange={() => handleClick(28)}
            className="w-4 h-4 text-red-600 rounded border-neutral-300 focus:ring-red-500 cursor-pointer"
          />
          <span>旅行キャンセル保険（¥2,400）を追加</span>
          {somOverlayActive && (
            <span className="som-badge bg-fuchsia-600 text-white font-mono-clean text-xs px-1 border border-white font-bold shadow-sm">
              #28
            </span>
          )}
        </label>

        {/* Action Buttons (Col C & D / Row 4) */}
        <div className="flex items-center gap-2">
          {/* Cancel Button (Col C / Row 4) */}
          <button
            id="btn-cancel"
            type="button"
            onClick={() => handleClick(29)}
            className="px-2.5 py-1 bg-neutral-300 hover:bg-neutral-400 text-neutral-900 font-bold text-xs border border-neutral-400 rounded relative"
          >
            予約を取消 (Cancel)
            {somOverlayActive && (
              <span className="som-badge absolute -top-2 -right-2 bg-fuchsia-600 text-white font-mono-clean text-xs px-1 border border-white font-bold shadow-sm z-10">
                #29
              </span>
            )}
          </button>

          {/* Confirm Button (Col D / Row 4 - Winning Exhibit E) */}
          <button
            id="target-confirm-btn"
            type="button"
            onClick={() => handleClick(30)}
            className={`px-3.5 py-1 font-bold text-xs shadow relative rounded transition-all ${
              isFinalConfirmed
                ? 'bg-blue-800 ring-2 ring-blue-950 border-2 border-amber-300 text-amber-200 shadow-[0_0_14px_rgba(250,204,21,0.9)] scale-105'
                : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
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
      </footer>
    </div>
  );
};

export default ShinkansenSandbox;
