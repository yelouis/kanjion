import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/react';
import { App } from '../src/App';

describe('Item 1: Run the shipped game under test', () => {
  it('★ renders the shipped multi-page MV-01 route selection page when startOnCover is false', () => {
    const { getByTestId } = render(<App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />);
    const agentPage = getByTestId('newspaper-left-page');
    expect(within(agentPage).getByText('STEP 1: ご利用になる新幹線路線を選択してください')).toBeInTheDocument();
  });
});
