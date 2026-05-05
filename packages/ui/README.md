# @dhanam/ui - MADFAM Design System

> **The UI incubator for the MADFAM ecosystem** - Built on shadcn/ui patterns with golden ratio design tokens.

## Philosophy

The MADFAM UI system follows these principles:

1. **Ownership over dependency** - Components are copied, not installed as black-box packages
2. **Golden ratio harmony** - Spacing, typography, and proportions follow φ (1.618)
3. **Radix primitives** - Accessible, unstyled components as the foundation
4. **Tailwind + CVA** - Utility-first styling with variant management
5. **App-specific aesthetics** - Shared patterns, unique visual identities

## Components (24)

| Component       | Description                                        | Radix Base |
| --------------- | -------------------------------------------------- | ---------- |
| Alert           | Feedback messages                                  | -          |
| AlertDialog     | Confirmation dialogs                               | ✓          |
| Badge           | Status indicators                                  | -          |
| Button          | Interactive buttons                                | Slot       |
| Card            | Content containers                                 | -          |
| Checkbox        | Toggle inputs                                      | ✓          |
| Dialog          | Modal windows                                      | ✓          |
| DropdownMenu    | Action menus                                       | ✓          |
| EcosystemBanner | Cross-platform ticker (sticky bottom, dismissible) | -          |
| Input           | Text inputs                                        | -          |
| Label           | Form labels                                        | ✓          |
| Popover         | Floating content                                   | ✓          |
| Progress        | Progress indicators                                | ✓          |
| Select          | Selection inputs                                   | ✓          |
| Separator       | Visual dividers                                    | ✓          |
| Skeleton        | Loading placeholders                               | -          |
| Slider          | Range inputs                                       | ✓          |
| Switch          | Toggle switches                                    | ✓          |
| Tabs            | Tabbed interfaces                                  | ✓          |
| Textarea        | Multi-line inputs                                  | -          |
| Toast           | Notifications                                      | ✓          |
| Toaster         | Toast container                                    | ✓          |
| Tooltip         | Hover information                                  | ✓          |

## Golden Ratio Tokens

The golden ratio (φ ≈ 1.618) creates naturally harmonious proportions.

### Spacing Scale

```
phi-3xs: 0.236rem (~4px)   ← 1/φ³
phi-2xs: 0.382rem (~6px)   ← 1/φ²
phi-xs:  0.618rem (~10px)  ← 1/φ
phi-md:  1rem (16px)       ← base
phi-lg:  1.618rem (~26px)  ← φ
phi-xl:  2.618rem (~42px)  ← φ²
phi-2xl: 4.236rem (~68px)  ← φ³
```

### Usage

```tsx
// In your component
<div className="p-phi-lg m-phi-md rounded-phi">
  <h1 className="text-phi-2xl">Golden Title</h1>
  <p className="text-phi-base leading-phi">Harmonious content</p>
</div>
```

## Installation in New MADFAM Repo

### 1. Create the UI package structure

```bash
mkdir -p packages/ui/src/{components,tokens,hooks,lib}
```

### 2. Copy the foundation files

From `@dhanam/ui`, copy:

- `src/lib/utils.ts` - The `cn()` utility
- `src/tokens/` - Golden ratio tokens
- `src/hooks/use-toast.ts` - Toast hook (if using toasts)

### 3. Install dependencies

```bash
pnpm add @radix-ui/react-slot class-variance-authority clsx tailwind-merge
pnpm add -D tailwindcss @types/react
```

### 4. Configure Tailwind

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';
import { madfamPreset } from './packages/ui/src/tokens/tailwind-preset';

export default {
  presets: [madfamPreset],
  content: ['./src/**/*.{ts,tsx}', './packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // App-specific overrides here
      colors: {
        // Your app's color palette
      },
    },
  },
} satisfies Config;
```

### 5. Add components as needed

Copy components from `@dhanam/ui/src/components/` and customize:

```tsx
// packages/ui/src/components/button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const buttonVariants = cva(
  // Base styles - customize for your app
  'inline-flex items-center justify-center rounded-phi text-phi-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        // ... your variants
      },
      size: {
        default: 'h-10 px-phi-md py-phi-xs',
        sm: 'h-9 px-phi-sm',
        lg: 'h-11 px-phi-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);
```

## App-Specific Aesthetics

Each MADFAM app has its own visual identity while sharing the golden ratio foundation:

| App     | Primary Color    | Aesthetic              |
| ------- | ---------------- | ---------------------- |
| Dhanam  | Green (#22c55e)  | Finance, trust, growth |
| Fortuna | Purple (#8b5cf6) | Insight, intelligence  |
| sim4d   | Blue (#3b82f6)   | Technical, precise     |
| Forj    | Orange (#f97316) | Marketplace, energy    |
| Janua   | Slate (#64748b)  | Security, neutral      |

## File Structure

```
packages/ui/
├── src/
│   ├── components/        # UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── tokens/           # Design tokens
│   │   ├── golden-ratio.ts
│   │   ├── tailwind-preset.ts
│   │   └── index.ts
│   ├── hooks/            # React hooks
│   │   └── use-toast.ts
│   ├── lib/              # Utilities
│   │   └── utils.ts
│   ├── compat.tsx        # React 19 compatibility
│   └── index.ts          # Main exports
├── package.json
├── tsup.config.ts
└── README.md
```

## Development

```bash
# Build the package
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck
```

## Adding New Components

1. Create the component in `src/components/`
2. Follow the CVA pattern for variants
3. Use golden ratio tokens for spacing/sizing
4. Export from `src/compat.tsx` (for React 19)
5. Document in this README

---

## Ecosystem Banner — copy-paste path for sibling landings

`<EcosystemBanner />` is the shared cross-product ticker that lives at the bottom of every MADFAM landing (dhan.am, karafiel.mx, selva.town, cotiza.studio, …). Until `npm.madfam.io` re-publishes `@dhanam/ui`, sibling landings adopt it by **copying the directory**:

```bash
# from another madfam-org repo (e.g. karafiel, cotiza, forj):
mkdir -p packages/ui/src/components/ecosystem-banner
cp -R \
  ../dhanam/packages/ui/src/components/ecosystem-banner/* \
  packages/ui/src/components/ecosystem-banner/
# then export from your local barrel
echo "export * from './components/ecosystem-banner';" \
  >> packages/ui/src/index.ts
# mount once in your root layout, after the body's main content
```

**Source-of-truth platform list**: `packages/ui/src/components/ecosystem-banner/platforms.ts`. Edit `DEFAULT_ECOSYSTEM_PLATFORMS` to add/remove a platform; bump `BANNER_VERSION` in `ecosystem-banner.tsx` to force previously-dismissed users to see the new lineup.

**Drift policy**: when `@madfam/ecosystem-banner` lands on `npm.madfam.io`, swap the copy for a dependency. Until then, the platforms list should be re-synced from dhanam's copy on each landing's release cadence.

---

_Part of the MADFAM Solarpunk Foundry - From Bits to Atoms_
