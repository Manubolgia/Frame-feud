/**
 * MNBG Tape Library integration. When the game is loaded inside the library
 * (a frame named "mnbglibrary" on the same site), it says hello so the deck
 * hides its own eject tab, and offers a "Back to the library" button on the
 * title screen.
 */

export const inLibrary = (() => {
  try {
    return window.parent !== window && window.name === 'mnbglibrary';
  } catch {
    return false;
  }
})();

export function helloLibrary() {
  if (!inLibrary) return;
  try {
    window.parent.postMessage({ type: 'mnbglibrary:hello', exit: true }, location.origin);
  } catch {
    /* cross-origin parent: nothing to do */
  }
}

export function ejectToLibrary() {
  try {
    const deck = (window.parent as unknown as { mnbglibrary?: { eject(): void } }).mnbglibrary;
    if (deck) {
      deck.eject();
      return;
    }
  } catch {
    /* fall back to the message */
  }
  try {
    window.parent.postMessage({ type: 'mnbglibrary:eject' }, location.origin);
  } catch {
    /* ignore */
  }
}
