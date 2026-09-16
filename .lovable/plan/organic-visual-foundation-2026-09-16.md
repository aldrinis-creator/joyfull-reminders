# Organic visual foundation

## Scope
- Replace the shared light-theme colors with the exact Organic cream, terracotta, sage, and neutral values.
- Add the complete neutral, terracotta, sage, spacing, radius, shadow, and motion token sets without renaming variables already used by the app.
- Keep category tokens compatible while remapping them to the three approved Organic color families.
- Replace Baloo 2 and Plus Jakarta Sans with Caprasimo and Figtree using the existing document-head font loading pattern, including preload hints.
- Add global focus, disabled, and interaction-state foundations while preserving existing component markup and layouts.
- Retain the existing alarm pulse utility as an alias of the new reduced-motion-aware Organic pulse.

## Accessibility and compatibility
- Document the approved contrast rules directly beside the color tokens.
- Keep paragraph text off raw accent colors and preserve readable foreground mappings.
- Ensure reduced-motion users receive static rings and opacity-only entrance feedback.
- Do not modify component JSX, routes, screen structure, or application behavior.

## Verification
- Check the generated build result.
- Open representative existing screens at desktop and mobile widths to confirm they render with the new colors and fonts without layout breakage.
