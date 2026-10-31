import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from '../avatar';

// Default avatar initials always render in white.

describe('avatar initials', () => {
  it('render in white on any generated colour', () => {
    for (const name of ['Alice Smith', 'Bob Chen', 'Carol Lee', 'Dev User', 'Erik Ström', 'Fatima Noor', 'Gao Wei', 'Hana Kim']) {
      const { container, unmount } = render(<Avatar name={name} disableImages />);
      const el = container.firstElementChild as HTMLElement;
      expect(el.style.color).toBe('rgb(255, 255, 255)');
      unmount();
    }
  });
});
