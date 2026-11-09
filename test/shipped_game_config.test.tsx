import { describe, it, expect, vi } from 'vitest';
import { render, within, screen, fireEvent, act } from '@testing-library/react';
import { App } from '../src/App';

describe('Item 1: Run the shipped game under test', () => {
  it('★ renders the shipped multi-page MV-01 route selection page when startOnCover is false', () => {
    const { getByTestId } = render(<App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />);
    const agentPage = getByTestId('newspaper-left-page');
    expect(within(agentPage).getByText('STEP 1: ご利用になる新幹線路線を選択してください')).toBeInTheDocument();
  });
});

describe('Item 2: Case #001 everywhere, no hidden test text, honest share card', () => {
  it('★ copies exact 3-line KANJION #001 share card with https://kanjion-game.web.app on a 5-line verified game', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const { container } = render(
      <App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />
    );

    const steps = [
      'Click the blue card on the right',
      'Type TANAKA in the passenger name box',
      'Wait for the sale glow, then click the green ¥13,870',
      'Draw a cat in the dashed box',
      'confirm booking',
    ];

    for (let i = 0; i < steps.length; i++) {
      const inputEl = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(inputEl, { target: { value: steps[i] } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`DISPATCH LINE 0${i + 1}`, 'i') }));
      });
    }

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /CLOSE CASE FILE/i }));
    });

    const copyBtn = screen.getByRole('button', { name: /Copy Case Clipping/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      'KANJION #001 🇯🇵 — 100% × 1.2x = 120 PTS\n🟩🟩🟩🟩🟩 (5/6 Telegrams Sent)\nhttps://kanjion-game.web.app'
    );
  });
});
