// Enter/exit motion for Radix popups (menus, listboxes, selects): a quick fade
// and scale that grows from the trigger side. 150 ms in, 100 ms out, one shared
// easing token (`--hf-ease-standard`). Pair it with the popup's own
// `origin-(--radix-…-transform-origin)` so the scale starts at the trigger.
export const POPUP_MOTION_CLASSNAME =
  'duration-(--hf-duration-fast) ease-hf-standard data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-100 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1';
