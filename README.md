# Character Tools

A SillyTavern extension for AI-powered character card analysis, scoring, and enhancement.

## Features

- **Score** - Evaluate character cards against quality criteria with structured scoring
- **Rewrite** - Enhance and improve character card content using LLM suggestions
- **Analyze** - Deep analysis of character cards for consistency, depth, and completeness

### Key Capabilities

- **Multi-stage Pipeline** - Run stages individually or chain them together
- **Field Selection** - Choose which character fields to process (description, personality, first message, etc.)
- **Preset System** - Save and reuse prompt and schema configurations
- **Structured Output** - Use JSON schemas for consistent, parseable results
- **Session History** - Track iteration history and compare results
- **Mobile-First UI** - Responsive design that works on any screen size

## Installation

1. Clone or download this repository into your SillyTavern's `public/scripts/extensions/third-party/` directory
2. Restart SillyTavern or reload extensions
3. Look for the "Character Tools" button in the extensions panel

## Usage

1. Click the **Character Tools** button in the extensions panel
2. **Select a character** from the search/browse list
3. **Choose fields** to include in the analysis
4. **Configure the prompt** (or use a preset)
5. **Run a stage** (Score, Rewrite, or Analyze)
6. View results in the right panel

### Pipeline Stages

| Stage       | Purpose                    | Output                          |
| ----------- | -------------------------- | ------------------------------- |
| **Score**   | Evaluate character quality | Structured scores with feedback |
| **Rewrite** | Improve character content  | Enhanced text suggestions       |
| **Analyze** | Deep character analysis    | Detailed breakdown and insights |

## Development

### Build Commands

```bash
npm install           # Install dependencies
npm run build         # Production build
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier format
```

### Project Structure

```
src/
├── index.ts          # Extension entry point
├── style.css         # CSS design system
├── shared/           # Constants, logging, ST API helpers
├── types/            # TypeScript interfaces
├── data/             # Settings, storage, presets
├── state/            # Popup state management
├── domain/           # Business logic (pipeline, generation, schemas)
└── ui/               # UI components (popup, panel, components/)
```

## Requirements

- SillyTavern with a configured Chat Completion API (OpenAI, Claude, etc.)
- An API that supports the selected model

## License

MIT

## Author

Inktomi93
