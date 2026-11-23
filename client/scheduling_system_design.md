# Scheduling System — UI Styling & Design System

Apply this styling specification consistently across the entire Scheduling System frontend.

The application uses React + TypeScript + Tailwind CSS.

## 1. Core design direction

Use a clean, modern, Apple-inspired university administration interface.

The visual style should be:

- Light
- Minimal
- Professional
- Flat
- Spacious
- Consistent
- Easy to scan
- White-dominant
- Green used as the primary accent
- Subtle borders instead of shadows

Do NOT introduce a new design system or install/configure Tailwind.

The project already has Tailwind CSS configured.

Do NOT modify `tailwind.config.js` unless absolutely necessary.

Use the existing `index.css` as the central location for application colors, design tokens, and shared styling.

---

## 2. Styling architecture

Use one consistent styling system:

- Tailwind utility classes for layout and component styling
- `index.css` for global styles and theme variables
- CSS variables in `index.css` for application colors
- Shared components in `src/components/ui/` for repeated UI patterns

Do NOT create separate CSS files for individual pages.

If a style is shared by multiple components, define it once in the shared UI kit rather than recreating it in every component.

### Shared UI kit

Import primitives from `src/components/ui`:

- `Button`, `LinkButton`, `IconButton`
- `TextField`, `SelectField`, `TextareaField`, `FormErrorSummary`
- `Card`, `CardHeader`, `CardTitle`, `CardBody`, `CardFooter`
- `Badge`
- `Alert`
- `PageHeader`
- `EmptyState`
- `Skeleton`, `LoadingState`, `CardSkeleton`
- `StatCard`
- `Modal`, `ConfirmDialog`
- `Table`, `TableContainer`, `THead`, `TBody`, `TR`, `TH`, `TD`
- `SegmentedControl`

Use `cn()` from `src/lib/cn.ts` when composing conditional class names.

---

## 3. Color system

Keep the interface primarily white and neutral.

Green is the primary accent and is used for:

- Active navigation
- Primary actions
- Success states
- Important interactive elements
- Selected states
- Icons that communicate success or active status

Amber is used only for:

- Pending states
- Warnings
- Unscheduled items

Gray is used for:

- Secondary text
- Borders
- Dividers
- Neutral backgrounds
- Disabled/inactive states

Avoid decorative colors. Semantic red and blue are reserved for destructive actions and informational feedback.

Avoid gradients completely. Do NOT use `bg-gradient-*`, `from-*`, `via-*`, or `to-*` for UI decoration.

Text colors are contrast-checked against white:

- Primary: `#1d1d1f`
- Secondary: `#5f5f66` (passes 4.5:1)
- Tertiary: `#74747b` (passes 4.5:1)
- Disabled: `#a1a1a6` (disabled states only)

Control borders use `--color-border-control` (`#8e8e93`) so inputs remain identifiable at 3:1.

Do not use white text on `apple-green-400`. Use `apple-green-600` or darker for solid green surfaces, or `apple-green-700` for text on green-tinted surfaces.

---

## 4. index.css theming

Keep the application's design tokens centralized in `index.css`.

### Color tokens

```css
--color-apple-green-50: #f0faf4;
--color-apple-green-100: #dcf5e5;
--color-apple-green-200: #bbead0;
--color-apple-green-300: #88d9af;
--color-apple-green-400: #4ec088;
--color-apple-green-500: #2ba66a;
--color-apple-green-600: #1d8754;
--color-apple-green-700: #196c45;
--color-apple-green-800: #18563a;
--color-apple-green-900: #154731;

--color-surface: #ffffff;
--color-surface-secondary: #f5f5f7;
--color-surface-tertiary: #fafafa;
--color-border: #e5e5ea;
--color-border-light: #f0f0f2;
--color-border-control: #8e8e93;
--color-text-primary: #1d1d1f;
--color-text-secondary: #5f5f66;
--color-text-tertiary: #74747b;
--color-text-disabled: #a1a1a6;

--color-success: #196c45;
--color-success-soft: #f0faf4;
--color-success-border: #bbead0;
--color-warning: #92400e;
--color-warning-soft: #fffbeb;
--color-warning-border: #fde68a;
--color-danger: #b91c1c;
--color-danger-soft: #fef2f2;
--color-danger-border: #fecaca;
--color-info: #1d4ed8;
--color-info-soft: #eff6ff;
--color-info-border: #bfdbfe;

--font-sf:
  'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
  Helvetica, Arial, sans-serif;
```

### Type scale

Use the semantic classes instead of ad-hoc pixel sizes:

- `text-hero` — 48px / 56px, semibold, tight tracking (login front page only)
- `text-display` — 30px / 36px, semibold
- `text-h1` — 24px / 32px, semibold
- `text-h2` — 20px / 28px, semibold
- `text-h3` — 16px / 24px, semibold
- `text-body` — 14px / 22px
- `text-body-sm` — 13px / 20px
- `text-caption` — 12px / 16px
- `text-overline` — 11px / 16px, uppercase, tracked
- `text-numeric` — 28px / 32px, tabular numbers

Do not use 9px or 10px text. Metadata must be at least `text-caption` (12px).

### Radius, shadow, and spacing

- Controls: `rounded-control` (10px)
- Cards: `rounded-card` (16px)
- Panels: `rounded-panel` (20px)
- Pills: `rounded-pill`
- Card shadow: `shadow-card`
- Popovers: `shadow-popover`
- Overlays: `shadow-overlay`

Use a 4px spacing rhythm. Standard page padding is 16px on mobile, 24px on tablet, and 32px on desktop. Standard card padding is 16px on mobile and 20–24px on desktop. Standard grid gap is 16px.

---

## 5. Responsive rules

- Use `min-h-dvh`, not `min-h-screen`.
- Do not use global `overflow-x: hidden` to mask layout bugs. Fix the source of overflow.
- Desktop app shell: 240px sidebar, 72px collapsed, sticky 64px header.
- Mobile app shell: off-canvas drawer, 56px header, overlay, ESC/route close.
- Data tables must either scroll horizontally with `TableContainer` or switch to card lists below `md`.
- Timetable/week views must provide a mobile agenda view with day tabs.
- Primary controls are 44px tall. Icon buttons are at least 44×44px on coarse pointers.
- Avoid fixed widths that exceed the viewport. Use `min-w-0`, `truncate`, and `flex-wrap` deliberately.

---

## 6. Login / front page

- Desktop uses a two-column editorial layout: a light `apple-green-50` story panel and a centered sign-in card.
- The left panel uses border-drawn grid lines, not gradients, plus the `SchedulePreview` sample timetable.
- Keep the sign-in card at ~420px max width. Mobile shows a compact brand row and the form first, with no timetable preview.
- `SchedulePreview` is decorative (`role="img"`, inner grid `aria-hidden`) and stays hidden below `lg`.
- Password visibility uses the `TextField` `trailing` slot rather than absolute overlay positioning.
- Entrance motion uses `.animate-rise-in` (fade/rise, 650ms) and must remain disabled by the reduced-motion rule.

## 7. Accessibility

- Every interactive element needs a visible `:focus-visible` state.
- Icon-only buttons require an accessible label (`IconButton label=...`).
- Inputs require labels; errors use `aria-invalid` and `aria-describedby`.
- Modals use the shared `Modal` (native `<dialog>`) and must have a title, ESC handling, focus restoration, and scroll lock.
- Destructive actions use `ConfirmDialog`, not `window.confirm`.
- Do not use emoji as status icons. Use lucide icons or `Badge`.
- Async status messages use `role="status"` or `role="alert"` via `Alert`.
- Support `prefers-reduced-motion`.
- Maintain at least 4.5:1 contrast for normal text and 3:1 for controls.
