import { createTheme, type MantineColorsTuple } from '@mantine/core';
import { DEFAULT_ACCENT_SHADES } from '../shared/orgAccent.js';

/** Fallback brand scale; live org accent overrides CSS variables at runtime. */
const brand = DEFAULT_ACCENT_SHADES as unknown as MantineColorsTuple;

export const theme = createTheme({
  primaryColor: 'brand',
  colors: { brand },
  fontFamily: "'DM Sans', system-ui, sans-serif",
  headings: {
    fontFamily: "'Outfit', system-ui, sans-serif",
    fontWeight: '700',
  },
  defaultRadius: 'md',
  black: '#141414',
  white: '#fafafa',
});
