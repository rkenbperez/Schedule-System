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

# 2. Existing styling architecture

The project should have one consistent styling system.

Use:

- Tailwind utility classes for layout and component styling
- `index.css` for global styles and theme variables
- CSS variables in `index.css` for application colors
- Reusable Tailwind classes/components where appropriate

Do NOT create separate CSS files for individual pages such as:

- `TeacherDashboard.css`
- `TeacherCourses.css`
- `TeacherSchedules.css`

Avoid duplicating styling between pages.

If a style is shared by multiple components, define it once in the shared styling system rather than recreating it in every component.

---

# 3. Color system

Keep the interface primarily white and neutral.

Green is the primary accent and should be used for:

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

Do not introduce decorative colors such as:

- Blue
- Purple
- Red
- Pink
- Orange

unless there is a functional requirement that genuinely requires them.

Avoid gradients completely.

Do NOT use:

- `bg-gradient-*`
- `from-*`
- `via-*`
- `to-*`

for UI decoration.

---

# 4. index.css theming

Keep the application's color theme centralized in `index.css`.

Use CSS variables for the primary design tokens.

Example structure:

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
--color-text-primary: #1d1d1f;
--color-text-secondary: #86868b;
--color-text-tertiary: #aeaeb2;

--font-sf:
  'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
  Helvetica, Arial, sans-serif;
```
