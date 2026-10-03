export const HERO_INTERVAL_MS = 3000

// Motion preferences affect CSS transitions, not whether scenic photos change.
export function startHeroRotation({ paused, visible, nextIndex, isReady, advance, clock }) {
  if (paused || !visible || nextIndex === undefined) return () => {}
  const timer = clock.setInterval(() => {
    if (isReady(nextIndex)) advance(nextIndex)
  }, HERO_INTERVAL_MS)
  return () => clock.clearInterval(timer)
}
