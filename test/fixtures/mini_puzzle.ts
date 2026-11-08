import type { PuzzleData } from '../../src/types/puzzle_data';

export const MINI_PUZZLE: PuzzleData = {
  id: 'mini',
  caseNumber: '#999',
  title: 'Mini English Fixture Puzzle',
  initialPageId: 'P-1',
  initialFields: {
    selectedItem: 'none',
    addonEnabled: false,
    confirmed: false,
    confirmedWithAddon: false,
  },
  pages: [
    {
      id: 'P-1',
      slug: 'start',
      title: 'Choose an Item',
      elements: [
        {
          mark: 90,
          key: 'page_title',
          role: 'heading',
          label: 'Choose an Item',
          effects: {},
        },
        {
          mark: 1,
          key: 'btn_select_alpha',
          role: 'button',
          label: 'Select Alpha',
          effects: {
            CLICK: [
              { op: 'set', field: 'selectedItem', value: 'alpha' },
              { op: 'navigate', pageId: 'P-2' },
            ],
          },
        },
        {
          mark: 2,
          key: 'btn_toggle_addon',
          role: 'checkbox',
          label: 'Include Extra Add-on',
          effects: {
            CLICK: [{ op: 'toggle', field: 'addonEnabled' }],
          },
        },
        {
          mark: 3,
          key: 'btn_help',
          role: 'button',
          label: 'Help Info',
          effects: {
            CLICK: [{ op: 'navigate', pageId: 'P-HELP' }],
          },
        },
      ],
    },
    {
      id: 'P-2',
      slug: 'confirm',
      title: 'Confirm Selection',
      elements: [
        {
          mark: 90,
          key: 'page_title',
          role: 'heading',
          label: 'Confirm Selection',
          effects: {},
        },
        {
          mark: 4,
          key: 'btn_confirm',
          role: 'button',
          label: 'Confirm Order',
          effects: {
            CLICK: [
              { op: 'set', field: 'confirmed', value: true },
              { op: 'copy', from: 'addonEnabled', to: 'confirmedWithAddon' },
            ],
          },
        },
        {
          mark: 5,
          key: 'btn_reset',
          role: 'button',
          label: 'Start Over',
          effects: {
            CLICK: [
              { op: 'resetFields' },
              { op: 'navigate', pageId: 'P-1' },
            ],
          },
        },
        {
          mark: 3,
          key: 'btn_help',
          role: 'button',
          label: 'Help Info',
          effects: {
            CLICK: [{ op: 'navigate', pageId: 'P-HELP' }],
          },
        },
      ],
    },
    {
      id: 'P-HELP',
      slug: 'help',
      title: 'Help Page',
      elements: [
        {
          mark: 90,
          key: 'page_title',
          role: 'heading',
          label: 'Help Page',
          effects: {},
        },
        {
          mark: 6,
          key: 'btn_back_prev',
          role: 'button',
          label: 'Back',
          effects: {
            CLICK: [{ op: 'navigate', pageId: '$previous' }],
          },
        },
      ],
    },
  ],
  exhibits: [
    {
      id: 'A',
      title: 'Selected Alpha',
      weight: 50,
      criteria: 'Selected Alpha on P-1.',
      verified: { field: 'selectedItem', eq: 'alpha' },
    },
    {
      id: 'B',
      title: 'Confirmed Cleanly',
      weight: 50,
      criteria: 'Confirmed order without extra add-on.',
      verified: {
        all: [
          { field: 'confirmed', eq: true },
          { field: 'confirmedWithAddon', eq: false },
        ],
      },
      contaminated: {
        all: [
          { field: 'confirmed', eq: true },
          { field: 'confirmedWithAddon', eq: true },
        ],
      },
      contaminatedNote: 'Extra add-on was attached',
    },
  ],
  replay: [],
  answerKey: ['Click Select Alpha', 'Click Confirm Order'],
};
