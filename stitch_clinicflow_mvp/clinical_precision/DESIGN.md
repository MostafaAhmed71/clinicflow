---
name: Clinical Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3f4850'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#707881'
  outline-variant: '#bfc7d2'
  surface-tint: '#006398'
  primary: '#006194'
  on-primary: '#ffffff'
  primary-container: '#007bb9'
  on-primary-container: '#fdfcff'
  inverse-primary: '#93ccff'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#595c5e'
  on-tertiary: '#ffffff'
  tertiary-container: '#727577'
  on-tertiary-container: '#fbfdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#93ccff'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#004b73'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  sidebar-width: 260px
  sidebar-collapsed: 80px
---

## Brand & Style

The design system is engineered for high-utility clinic management, prioritizing reliability, hygiene, and efficiency. The brand personality is "The Expert Assistant"—unobtrusive but highly capable. It targets healthcare professionals in Egypt, requiring a balance between global SaaS standards and local cultural expectations for authority and trust.

The design style is **Corporate / Modern** with a lean towards **Minimalism**. It utilizes a "clinical white" foundation with precise hits of color to direct attention. The interface avoids unnecessary decorative elements, ensuring that patient data and medical records remain the primary focus. The emotional response is one of calm control in a fast-paced medical environment.

## Colors

This design system uses a palette rooted in clinical trust and physiological health.

- **Primary (Clinical Blue):** `#0284c7` is used for primary actions, navigation states, and brand identifiers. It communicates competence and stability.
- **Success (Health Teal):** `#0d9488` is used for positive outcomes, "active" patient statuses, and completed billing.
- **Backgrounds:** The interface uses `#f8fafc` (Slate 50) as a primary background to reduce eye strain during long shifts, with white `#ffffff` reserved for cards and data containers to create a "layered paper" effect.
- **Status Colors:** 
  - Warning: `#f59e0b` (Amber) for pending appointments.
  - Danger: `#e11d48` (Rose) for urgent vitals or overdue payments.
- **Neutral:** A range of slates (`#1e293b` to `#94a3b8`) provides clear contrast for text and iconography.

## Typography

The typography system relies exclusively on **IBM Plex Sans Arabic**, chosen for its exceptional legibility in both Arabic (RTL) and English (LTR) scripts. This typeface reflects a "man-and-machine" harmony, perfect for a technical SaaS platform.

- **Data Density:** Use `body-md` for patient records and table data to maximize information density without sacrificing readability.
- **RTL Optimization:** In Arabic mode, line heights are increased by 10% automatically to accommodate the script's ascenders and descenders.
- **Hierarchy:** Use `label-md` in all-caps (for LTR) or bold weight (for RTL) to categorize data fields like "Blood Type" or "Last Visit."

## Layout & Spacing

The design system employs a **Fluid Grid** model centered on an 8px spacing rhythm. 

- **Dashboard Structure:** A persistent, collapsible sidebar on the right (for RTL) or left (for LTR). The main content area lives within a max-width container of 1440px for desktop to prevent line lengths from becoming unreadable.
- **RTL Behavior:** All horizontal layouts must flip. Margins on the left become margins on the right. Chevron icons must be mirrored (e.g., a "next" arrow points left in Arabic).
- **Data Tables:** Use `sm` (8px) vertical padding for high-density tables and `md` (16px) for standard views.
- **Breakpoints:**
  - Mobile: < 640px (Single column, bottom navigation or hamburger).
  - Tablet: 640px - 1024px (Collapsed sidebar).
  - Desktop: > 1024px (Full sidebar).

## Elevation & Depth

Visual hierarchy is managed through **Tonal Layers** and **Ambient Shadows**.

- **Level 0 (Background):** `#f8fafc`. Used for the main canvas.
- **Level 1 (Cards/Surface):** White `#ffffff` with a 1px border of `#e2e8f0`. No shadow. Used for secondary information.
- **Level 2 (Active Containers):** White `#ffffff` with a subtle, soft shadow: `0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)`. Used for primary patient files and active modules.
- **Level 3 (Modals/Popovers):** White `#ffffff` with a high-diffusion shadow to indicate interaction focus.

Borders are preferred over heavy shadows to maintain a clean, "organized" medical feel.

## Shapes

The shape language uses **Rounded (0.5rem)** corners as the standard. This choice softens the clinical environment, making the software feel more accessible and less intimidating.

- **Buttons & Inputs:** 0.5rem (8px).
- **Cards & Modals:** 1rem (16px) for large containers to create a distinct enclosure.
- **Status Badges/Chips:** Full pill-shaped (999px) to distinguish them from actionable buttons.

## Components

- **Buttons:** Primary buttons use the Clinical Blue background with white text. "Secondary" buttons use a Clinical Blue outline with a transparent background. "Ghost" buttons are used for less critical actions like "Cancel."
- **Input Fields:** Clean white backgrounds with 1px `#cbd5e1` borders. On focus, borders transition to Primary Blue with a subtle 2px outer glow. Labels are always persistent; never use placeholders as labels.
- **Patient Cards:** Must include a "Quick Action" zone. Use a 12px padding internal rhythm. Vitals should be displayed in high-contrast "Data Chips."
- **Data Tables:** Zebra striping is disabled. Use thin horizontal dividers only. The header row should have a subtle gray background (`#f1f5f9`).
- **Icons:** Use a medical-specific icon set (e.g., Lucide Medical or similar). Icons must be "Line" style with a 2px stroke weight to match the IBM Plex Sans weight. 
- **RTL Specifics:** Icons that denote direction (back, forward, list alignment) must be mirrored. Anatomical icons (e.g., heart, lungs) remain unmirrored.