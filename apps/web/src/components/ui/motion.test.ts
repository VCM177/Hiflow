import { describe, expect, it } from 'vitest';

import { POPUP_MOTION_CLASSNAME } from './motion';

describe('POPUP_MOTION_CLASSNAME', () => {
  it('uses the shared easing token and the fast duration token', () => {
    expect(POPUP_MOTION_CLASSNAME).toContain('ease-hf-standard');
    expect(POPUP_MOTION_CLASSNAME).toContain('duration-(--hf-duration-fast)');
  });

  it('animates both opening and closing', () => {
    expect(POPUP_MOTION_CLASSNAME).toContain('data-[state=open]:animate-in');
    expect(POPUP_MOTION_CLASSNAME).toContain('data-[state=closed]:animate-out');
  });
});
