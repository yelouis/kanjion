/**
 * src/data/puzzles/case_042.ts
 *
 * Canonical data fixtures for Case File #042: Tokyo–Osaka Shinkansen (えきねっと風).
 * Contains:
 * - Puzzle metadata & initial micro-state
 * - All 9 discrete Macro-Views with transitions
 * - Exact 11 interactive Set-of-Mark elements for Macro-View 3 (seat_matrix)
 * - 5 sealed Required Exhibits with deterministic evaluation functions
 * - Target Ghost Replay visual trajectory definition
 */

import { ShinkansenMicroState } from '../../types/engine';
import {
  PuzzleManifest,
  MacroView,
  SoMElement,
  ExhibitDefinition,
  TargetGhostReplayDefinition,
} from '../../types/puzzle';
import { tupleToBoundingBox } from '../../utils/coordinate_projector';

/**
 * Initial micro-state for Case File #042 at Macro-View 3 (seat_matrix).
 * Pre-seeded with Exhibits A & B satisfied by prior turns in the canonical narrative.
 */
export const CASE_042_INITIAL_MICRO_STATE: ShinkansenMicroState = {
  macroViewId: 'MV-03',
  selectedRoute: 'tokyo_osaka',
  departureTime: '14:30',
  trainName: 'none',
  seatClass: 'none',
  fare: 0,
  greenCarSelected: false,
  insuranceTrapHit: false,
  insuranceCheckboxChecked: false,
  finalConfirmed: false,
  activeModal: 'none',
  departureDate: '2026-11-05',
  passengerCount: { adults: 1, children: 0 },
  stepHistory: [],
};

/**
 * The 11 interactive elements present in Macro-View 3 (seat_matrix).
 */
export const CASE_042_MV03_ELEMENTS: SoMElement[] = [
  {
    id: 11,
    somId: '#11',
    elementKey: 'btn_logout',
    tag: 'button',
    role: 'button',
    boundingBox: tupleToBoundingBox([920, 42, 74, 26]),
    gridRef: 'D1',
    text: 'ログアウト',
    visualAttributes: {
      bgColor: '#DC2626',
      color: '#FFFFFF',
      description: 'Red logout button in header',
    },
    isTrap: true,
    actionType: 'CLICK',
  },
  {
    id: 12,
    somId: '#12',
    elementKey: 'btn_promo_insurance',
    tag: 'button',
    role: 'button',
    boundingBox: tupleToBoundingBox([780, 94, 214, 30]),
    gridRef: 'D1',
    text: '今すぐ申し込む（赤ボタン）',
    visualAttributes: {
      bgColor: '#DC2626',
      color: '#FFFFFF',
      description: 'Promotional insurance banner red CTA button',
    },
    isTrap: true,
    actionType: 'CLICK',
  },
  {
    id: 14,
    somId: '#14',
    elementKey: 'btn_back_conditions',
    tag: 'button',
    role: 'button',
    boundingBox: tupleToBoundingBox([26, 230, 204, 28]),
    gridRef: 'A2',
    text: '◀ 条件変更へ戻る',
    visualAttributes: {
      bgColor: '#FFFFFF',
      color: '#111111',
      description: 'Return to search conditions button',
    },
    actionType: 'CLICK',
  },
  {
    id: 21,
    somId: '#21',
    elementKey: 'btn_seat_hikari_free',
    tag: 'button',
    role: 'button',
    boundingBox: tupleToBoundingBox([370, 260, 110, 32]),
    gridRef: 'B2',
    text: '◯ ¥13,870',
    visualAttributes: {
      bgColor: '#F5F5F5',
      color: '#111111',
      glyph: '◯',
      description: 'Hikari 515 Non-reserved Seat',
    },
    actionType: 'CLICK',
  },
  {
    id: 22,
    somId: '#22',
    elementKey: 'btn_seat_hikari_res',
    tag: 'button',
    role: 'button',
    boundingBox: tupleToBoundingBox([580, 260, 110, 32]),
    gridRef: 'C2',
    text: '△ ¥14,520',
    visualAttributes: {
      bgColor: '#F5F5F5',
      color: '#111111',
      glyph: '△',
      description: 'Hikari 515 Reserved Seat',
    },
    actionType: 'CLICK',
  },
  {
    id: 23,
    somId: '#23',
    elementKey: 'btn_seat_nozomi_free',
    tag: 'button',
    role: 'button',
    boundingBox: tupleToBoundingBox([370, 450, 110, 32]),
    gridRef: 'B3',
    text: '◯ ¥13,870',
    visualAttributes: {
      bgColor: '#F5F5F5',
      color: '#111111',
      glyph: '◯',
      description: 'Nozomi 24 Non-reserved Seat',
    },
    actionType: 'CLICK',
  },
  {
    id: 24,
    somId: '#24',
    elementKey: 'btn_seat_nozomi_res',
    tag: 'button',
    role: 'button',
    boundingBox: tupleToBoundingBox([580, 450, 110, 32]),
    gridRef: 'C3',
    text: '◯ ¥14,720',
    visualAttributes: {
      bgColor: '#F5F5F5',
      color: '#111111',
      glyph: '◯',
      description: 'Nozomi 24 Reserved Seat',
    },
    actionType: 'CLICK',
  },
  {
    id: 25,
    somId: '#25',
    elementKey: 'btn_seat_nozomi_green',
    tag: 'button',
    role: 'button',
    boundingBox: tupleToBoundingBox([790, 450, 190, 36]),
    gridRef: 'D3',
    text: '🍀 ◯ ¥13,870 (特割)',
    visualAttributes: {
      bgColor: '#059669',
      color: '#FFFFFF',
      glyph: '🍀',
      description: 'Nozomi 24 Discount Green Car Seat',
    },
    isTarget: true,
    actionType: 'CLICK',
  },
  {
    id: 28,
    somId: '#28',
    elementKey: 'chk_insurance_add',
    tag: 'input',
    role: 'checkbox',
    boundingBox: tupleToBoundingBox([270, 706, 260, 24]),
    gridRef: 'B4',
    text: '旅行キャンセル保険（¥2,400）を追加',
    visualAttributes: {
      description: 'Travel cancellation insurance add-on checkbox',
    },
    isTrap: true,
    actionType: 'CLICK',
  },
  {
    id: 29,
    somId: '#29',
    elementKey: 'btn_cancel_booking',
    tag: 'button',
    role: 'button',
    boundingBox: tupleToBoundingBox([640, 704, 130, 32]),
    gridRef: 'C4',
    text: '予約を取消 (Cancel)',
    visualAttributes: {
      bgColor: '#D4D4D4',
      color: '#111111',
      description: 'Cancel reservation button',
    },
    actionType: 'CLICK',
  },
  {
    id: 30,
    somId: '#30',
    elementKey: 'btn_confirm_booking',
    tag: 'button',
    role: 'button',
    boundingBox: tupleToBoundingBox([810, 704, 190, 32]),
    gridRef: 'D4',
    text: '予約内容を確認・確定へ ▶',
    visualAttributes: {
      bgColor: '#2563EB',
      color: '#FFFFFF',
      glyph: '▶',
      description: 'Final reservation confirmation button',
    },
    isTarget: true,
    actionType: 'CLICK',
  },
];

/**
 * All 12 discrete Macro-Views for Case File #042 (JR-East Ekinet Multi-Page Portal).
 */
export const CASE_042_MACRO_VIEWS: MacroView[] = [
  {
    id: 'MV-01',
    name: 'route_select',
    description: 'JR Ekinet Portal Home — Shinkansen line and route selection',
    simulatedUrl: 'sandbox://ekinet-jr-sim.jp/reserve/route-select (Macro-View 1 of 12)',
    somImagePath: '/som/case_042_mv01.webp',
    elements: [],
    transitions: [
      { targetElementId: 1, destinationMacroViewId: 'MV-02' },
      { targetElementId: 2, destinationMacroViewId: 'MV-10' },
      { targetElementId: 3, destinationMacroViewId: 'MV-11' },
    ],
  },
  {
    id: 'MV-02',
    name: 'condition_filter',
    description: 'Departure time and passenger name (TYPE) filter form',
    simulatedUrl: 'sandbox://ekinet-jr-sim.jp/reserve/condition-filter (Macro-View 2 of 12)',
    somImagePath: '/som/case_042_mv02.webp',
    elements: [],
    transitions: [
      { targetElementId: 2, destinationMacroViewId: 'MV-03' },
      { targetElementId: 14, destinationMacroViewId: 'MV-01' },
    ],
  },
  {
    id: 'MV-03',
    name: 'seat_matrix',
    description: 'Primary seat availability, timed flash discount window, and signature authorization',
    simulatedUrl: 'sandbox://ekinet-jr-sim.jp/reserve/seat-matrix (Macro-View 3 of 12)',
    somImagePath: '/som/case_042_mv03.webp',
    elements: CASE_042_MV03_ELEMENTS,
    transitions: [
      { targetElementId: 30, destinationMacroViewId: 'MV-05' },
      { targetElementId: 12, destinationMacroViewId: 'MV-04' },
      { targetElementId: 14, destinationMacroViewId: 'MV-02' },
      { targetElementId: 29, destinationMacroViewId: 'MV-07' },
      { targetElementId: 11, destinationMacroViewId: 'MV-08' },
      { targetElementId: 21, destinationMacroViewId: 'MV-12' },
    ],
  },
  {
    id: 'MV-04',
    name: 'signature_and_seat_map',
    description: 'Car 8 Green Car seat verification and digital signature pad (DRAW)',
    simulatedUrl: 'sandbox://ekinet-jr-sim.jp/reserve/signature-pad (Macro-View 4 of 12)',
    somImagePath: '/som/case_042_mv04.webp',
    elements: [],
    transitions: [
      { targetElementId: 41, destinationMacroViewId: 'MV-03' },
      { targetElementId: 42, destinationMacroViewId: 'MV-05' },
    ],
  },
  {
    id: 'MV-05',
    name: 'reservation_confirm',
    description: 'Final order verification sheet and IC card binding',
    simulatedUrl: 'sandbox://ekinet-jr-sim.jp/reserve/confirm (Macro-View 5 of 12)',
    somImagePath: '/som/case_042_mv05.webp',
    elements: [],
    transitions: [
      { targetElementId: 51, destinationMacroViewId: 'MV-09' },
      { targetElementId: 52, destinationMacroViewId: 'MV-03' },
    ],
  },
  {
    id: 'MV-06',
    name: 'seat_map_modal',
    description: 'Car seating chart layout dialog',
    simulatedUrl: 'sandbox://ekinet-jr-sim.jp/reserve/seat-map (Macro-View 6 of 12)',
    somImagePath: '/som/case_042_mv06.webp',
    elements: [],
    transitions: [{ targetElementId: 61, destinationMacroViewId: 'MV-03' }],
  },
  {
    id: 'MV-07',
    name: 'cancel_prompt',
    description: 'Booking cancellation confirmation modal',
    simulatedUrl: 'sandbox://ekinet-jr-sim.jp/reserve/cancel (Macro-View 7 of 12)',
    somImagePath: '/som/case_042_mv07.webp',
    elements: [],
    transitions: [
      { targetElementId: 71, destinationMacroViewId: 'MV-01' },
      { targetElementId: 72, destinationMacroViewId: 'MV-03' },
    ],
  },
  {
    id: 'MV-08',
    name: 'logout_trap',
    description: 'Account logout view',
    simulatedUrl: 'sandbox://ekinet-jr-sim.jp/reserve/logout (Macro-View 8 of 12)',
    somImagePath: '/som/case_042_mv08.webp',
    elements: [],
    transitions: [{ targetElementId: 81, destinationMacroViewId: 'MV-03' }],
  },
  {
    id: 'MV-09',
    name: 'booking_complete',
    description: 'Booking confirmation receipt and QR e-ticket issue',
    simulatedUrl: 'sandbox://ekinet-jr-sim.jp/reserve/complete (Macro-View 9 of 12)',
    somImagePath: '/som/case_042_mv09.webp',
    elements: [],
    transitions: [],
  },
  {
    id: 'MV-10',
    name: 'tohoku_route_branch',
    description: 'Tohoku-Hokkaido Shinkansen (Hayabusa/Komachi) wrong-route branch page',
    simulatedUrl: 'sandbox://ekinet-jr-sim.jp/reserve/tohoku-line (Macro-View 10 of 12)',
    somImagePath: '/som/case_042_mv10.webp',
    elements: [],
    transitions: [{ targetElementId: 14, destinationMacroViewId: 'MV-01' }],
  },
  {
    id: 'MV-11',
    name: 'hokuriku_route_branch',
    description: 'Hokuriku Shinkansen (Kagayaki/Hakutaka) wrong-route branch page',
    simulatedUrl: 'sandbox://ekinet-jr-sim.jp/reserve/hokuriku-line (Macro-View 11 of 12)',
    somImagePath: '/som/case_042_mv11.webp',
    elements: [],
    transitions: [{ targetElementId: 14, destinationMacroViewId: 'MV-01' }],
  },
  {
    id: 'MV-12',
    name: 'waitlist_sold_out',
    description: 'Ordinary car seat map and waitlist branch page',
    simulatedUrl: 'sandbox://ekinet-jr-sim.jp/reserve/ordinary-seat-map (Macro-View 12 of 12)',
    somImagePath: '/som/case_042_mv12.webp',
    elements: [],
    transitions: [{ targetElementId: 14, destinationMacroViewId: 'MV-03' }],
  },
];

/**
 * The 5 sealed Required Exhibits summing to 100% base closeness.
 * Every exhibit is a POSITIVE performed action (never "Avoid X").
 */
export const CASE_042_EXHIBITS: ExhibitDefinition[] = [
  {
    id: 'exhibit_a',
    code: 'A',
    title: 'Route: 東京 ⇒ 新大阪',
    weight: 25,
    criteria: 'Selected Tokaido Shinkansen route from Tokyo to Shin-Osaka on Page 1.',
    evaluate: (state: ShinkansenMicroState) => {
      const verified = state.selectedRoute === 'tokyo_osaka' || state.selectedRoute === 'tokyo_shinosaka';
      return {
        status: verified ? 'VERIFIED' : 'MISSED',
        awardedPoints: verified ? 25 : 0,
        stampText: verified ? '[VERIFIED ✓ +25%]' : '[MISSED ✗ +0%]',
      };
    },
  },
  {
    id: 'exhibit_b',
    code: 'B',
    title: '14:30 Departure Slot',
    weight: 20,
    criteria: 'Entered passenger name (TANAKA) and configured 14:30 departure slot on Page 2.',
    evaluate: (state: ShinkansenMicroState) => {
      const verified = state.departureTime === '14:30';
      return {
        status: verified ? 'VERIFIED' : 'MISSED',
        awardedPoints: verified ? 20 : 0,
        stampText: verified ? '[VERIFIED ✓ +20%]' : '[MISSED ✗ +0%]',
      };
    },
  },
  {
    id: 'exhibit_c',
    code: 'C',
    title: 'Row 2: 🍀 ¥13,870 Seat',
    weight: 20,
    criteria: 'Timed-clicked Green Car seat on Nozomi 24 during active flash discount (特割) for ¥13,870.',
    evaluate: (state: ShinkansenMicroState) => {
      const verified = state.greenCarSelected && (state.trainName === 'Nozomi 24' || state.fare === 13870);
      return {
        status: verified ? 'VERIFIED' : 'MISSED',
        awardedPoints: verified ? 20 : 0,
        stampText: verified ? '[VERIFIED ✓ +20%]' : '[MISSED ✗ +0%]',
      };
    },
  },
  {
    id: 'exhibit_d',
    code: 'D',
    title: 'Sign Digital Authorization Pad',
    weight: 15,
    criteria: 'Signed the JR Digital Signature Verification Pad (自署・サイン欄) to authorize ticket issuance.',
    evaluate: (state: ShinkansenMicroState) => {
      const clean = !state.insuranceTrapHit && !state.insuranceCheckboxChecked;
      return {
        status: clean ? 'CLEAN' : 'CONTAMINATED',
        awardedPoints: clean ? 15 : 0,
        stampText: clean ? '[CLEAN ✓ +15%]' : '[CONTAMINATED ✗ +0%]',
      };
    },
  },
  {
    id: 'exhibit_e',
    code: 'E',
    title: 'Final Blue Confirm',
    weight: 20,
    criteria: 'Clicked the final confirmation button [予約内容を確認・確定へ ▶] to issue the Shinkansen e-ticket.',
    evaluate: (state: ShinkansenMicroState) => {
      const verified = state.finalConfirmed === true;
      return {
        status: verified ? 'VERIFIED' : 'MISSED',
        awardedPoints: verified ? 20 : 0,
        stampText: verified ? '[VERIFIED ✓ +20%]' : '[MISSED ✗ +0%]',
      };
    },
  },
];

/**
 * In-engine 1:1 visual Target Ghost Replay definition.
 * Strictly visual geometry and ruler quadrants — no DOM text spoilers.
 */
export const CASE_042_GHOST_REPLAY: TargetGhostReplayDefinition = {
  waypoints: [
    {
      stepNumber: 1,
      timestamp: '0:03',
      gridRef: 'D3',
      x: 885,
      y: 468,
      radius: 22,
      label: 'TARGET CLICK @ 0:03 (COL D, ROW 3)',
    },
    {
      stepNumber: 2,
      timestamp: '0:05',
      gridRef: 'D4',
      x: 905,
      y: 720,
      radius: 18,
      label: 'TARGET CLICK @ 0:05 (COL D, ROW 4)',
    },
  ],
  trajectorySvgPath: 'M 885 490 Q 915 605 905 702',
  overlayNote:
    'Note: The 5 Required Exhibits remain REDACTED until you close the case file or finish all 6 telegrams. Watch the target clicks carefully!',
};

/**
 * Complete canonical PuzzleManifest for Case File #042.
 */
export const CASE_042_MANIFEST: PuzzleManifest = {
  caseNumber: '#042',
  title: 'Tokyo–Osaka Shinkansen',
  difficulty: 'HARD',
  themeBadge: '🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN',
  initialMacroViewId: 'MV-03',
  initialMicroState: CASE_042_INITIAL_MICRO_STATE,
  macroViews: CASE_042_MACRO_VIEWS,
  exhibits: CASE_042_EXHIBITS,
  ghostReplay: CASE_042_GHOST_REPLAY,
};
