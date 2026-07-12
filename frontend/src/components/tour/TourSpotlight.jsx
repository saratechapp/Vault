import { motion } from 'framer-motion';

const PADDING = 8;
const RADIUS = 16;

// Builds a full-viewport path with rounded-rect holes cut out of it (evenodd
// fill rule: outer minus each inner loop) — this is what makes the "black
// overlay with cutouts" effect possible with a single element instead of
// stitching together four strip divs per highlighted rect.
function roundedRectPath(x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M${x + rad} ${y}`
    + `H${x + w - rad}`
    + `A${rad} ${rad} 0 0 1 ${x + w} ${y + rad}`
    + `V${y + h - rad}`
    + `A${rad} ${rad} 0 0 1 ${x + w - rad} ${y + h}`
    + `H${x + rad}`
    + `A${rad} ${rad} 0 0 1 ${x} ${y + h - rad}`
    + `V${y + rad}`
    + `A${rad} ${rad} 0 0 1 ${x + rad} ${y}Z`
  );
}

function spotlightClipPath(rects, vw, vh) {
  const outer = `M0 0H${vw}V${vh}H0Z`;
  const inners = rects
    .map((r) => roundedRectPath(r.x - PADDING, r.y - PADDING, r.width + PADDING * 2, r.height + PADDING * 2, RADIUS))
    .join(' ');
  return `path(evenodd, "${outer} ${inners}")`;
}

// The full-screen dark+blurred backdrop with the cutout(s) punched out, plus
// a glowing pulsing border drawn around each cutout. Everything here is
// `position: fixed`, so it tracks the *viewport*, not any scroll container —
// useTourTargets already re-measures every frame while the page scrolls.
export function TourSpotlight({ rects }) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const hasHoles = rects.length > 0;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[100]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{
          backgroundColor: 'rgba(0,0,0,0.76)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          clipPath: hasHoles ? spotlightClipPath(rects, vw, vh) : undefined,
        }}
      />
      {rects.map((r, i) => (
        <motion.div
          key={i}
          className="pointer-events-none fixed z-[101] rounded-2xl"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{
            opacity: 1,
            scale: 1,
            boxShadow: [
              '0 0 0 2px rgba(127,58,239,0.95), 0 0 18px 4px rgba(127,58,239,0.55)',
              '0 0 0 2px rgba(127,58,239,0.95), 0 0 34px 12px rgba(127,58,239,0.3)',
              '0 0 0 2px rgba(127,58,239,0.95), 0 0 18px 4px rgba(127,58,239,0.55)',
            ],
          }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{
            opacity: { duration: 0.3 },
            scale: { duration: 0.3 },
            boxShadow: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
          }}
          style={{
            left: r.x - PADDING,
            top: r.y - PADDING,
            width: r.width + PADDING * 2,
            height: r.height + PADDING * 2,
          }}
        />
      ))}
    </>
  );
}

export default TourSpotlight;
