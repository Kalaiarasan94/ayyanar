// Professional two-tone brand system: Zomato-style red + white.
// Neutrals (near-black ink, mid gray, light-gray borders) exist only for body
// text, dividers and disabled states — never as a competing brand hue — so
// copy stays legible and the interface still reads as a clean red/white app.
export const COLORS = {
  primary: '#E23744', // Zomato red — primary actions, active states, emphasis
  secondary: '#CB202D', // deep red — headers, pressed states, strong emphasis
  accent: '#CB202D', // alias of secondary, kept for existing references
  background: '#F7F5F5',
  surface: '#FFFFFF',
  text: '#26191A', // near-black ink (warmed toward red), body copy only
  textLight: '#8C7576', // muted rose-gray, secondary copy only
  border: '#F1DEDF',
  // Still one red family, not new brand hues — these are deliberately spaced
  // shades so "money in vs out" and multi-stage pills (e.g. lead status)
  // stay tellable apart at a glance, always reinforced by icon + label too.
  success: '#8C0F16', // deep crimson-garnet — positive / received / present / converted
  error: '#E23744',
  warning: '#F2545B', // soft coral-red — pending / in-progress states
  white: '#FFFFFF',
  black: '#26191A',
  steel: '#FBF2F2', // pale red-tinted neutral surface (was cool gray)
  tint: '#FCE9E9', // soft red tint for highlighted cards/badges
  tintBorder: '#F4C6C8', // border for tinted cards
  headerBackground: '#CB202D', // app bars / headers now use deep red, not navy
  glassBg: 'rgba(255, 255, 255, 0.92)',
  glassBorder: 'rgba(226, 55, 68, 0.16)',
  shadowColor: 'rgba(203, 32, 45, 0.14)',

  primaryGradient: ['#E23744', '#CB202D'],
  secondaryGradient: ['#FFFFFF', '#FBF2F2'],
  accentGradient: ['#CB202D', '#8C0F16'],
  bgGradient: ['#FFFFFF', '#F7F5F5', '#FBF2F2'],

  // A monochrome red ramp for charts/legends that used to rely on distinct
  // hues to tell series apart (e.g. per-site expense pie slices). Ordered
  // darkest-to-lightest so adjacent slices stay readable against each other.
  chartRamp: ['#8C0F16', '#CB202D', '#E23744', '#F2787D', '#F8B9BB'],
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
};
