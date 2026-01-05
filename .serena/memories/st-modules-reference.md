# SillyTavern Core Modules Reference

> **Source of Truth** for SillyTavern core modules (events, popup, extensions, etc.).
> See also: `st-context-api-map` (context API), `st-bundled-libs` (libraries)

Quick reference for key SillyTavern modules useful for extension development.

## Events (`scripts/events.js`)

Central event system using EventEmitter pattern.

```typescript
import { eventSource, event_types } from './events.js';

// Subscribe to events
eventSource.on(event_types.CHARACTER_EDITED, (data) => { ... });
eventSource.once(event_types.APP_READY, () => { ... });

// Emit events (rare for extensions)
eventSource.emit(event_types.SETTINGS_UPDATED);
```

### Key Event Types

| Event | When Fired | Data |
|-------|-----------|------|
| `APP_READY` | SillyTavern fully loaded | - |
| `CHARACTER_EDITED` | Character data changed | character |
| `CHARACTER_DELETED` | Character removed | character |
| `CHAT_CHANGED` | Chat switched | chatId |
| `MESSAGE_SENT` | User sends message | messageId |
| `MESSAGE_RECEIVED` | AI response received | messageId |
| `MESSAGE_EDITED` | Message edited | messageId |
| `MESSAGE_DELETED` | Message deleted | messageId |
| `GENERATION_STARTED` | Generation begins | - |
| `GENERATION_STOPPED` | Generation aborted | - |
| `GENERATION_ENDED` | Generation complete | - |
| `SETTINGS_UPDATED` | Settings changed | - |
| `SETTINGS_LOADED` | Settings loaded | - |
| `EXTENSION_SETTINGS_LOADED` | Extension settings ready | - |
| `STREAM_TOKEN_RECEIVED` | Streaming token | token |
| `GROUP_UPDATED` | Group modified | group |
| `WORLDINFO_UPDATED` | World info changed | - |
| `ONLINE_STATUS_CHANGED` | API connection status | status |

---

## Popup System (`scripts/popup.js`)

Modal dialog system with various types.

### POPUP_TYPE Enum

| Type | Purpose | Returns |
|------|---------|---------|
| `TEXT` | Display info with OK | `POPUP_RESULT` |
| `CONFIRM` | Yes/No question | `POPUP_RESULT` |
| `INPUT` | Text input prompt | `string \| null` |
| `DISPLAY` | Info with X close | `POPUP_RESULT` |
| `CROP` | Image cropping | `dataUrl \| null` |

### POPUP_RESULT Enum

```typescript
POPUP_RESULT.AFFIRMATIVE  // 1 - OK/Yes clicked
POPUP_RESULT.NEGATIVE     // 0 - No clicked
POPUP_RESULT.CANCELLED    // null - Cancelled/closed
```

### Quick Usage

```typescript
// Confirm dialog
const result = await Popup.show.confirm('Delete?', 'Are you sure?');
if (result === POPUP_RESULT.AFFIRMATIVE) { ... }

// Input dialog
const name = await Popup.show.input('Rename', 'Enter new name:', currentName);
if (name !== null) { ... }

// Text/info dialog
await Popup.show.text('Success', 'Operation completed!');

// Full Popup class for complex dialogs
const popup = new Popup(htmlContent, POPUP_TYPE.TEXT, '', {
    wide: true,
    okButton: 'Save',
    cancelButton: 'Cancel',
    customButtons: [{ text: 'Reset', result: 2 }],
    customInputs: [{ id: 'myCheck', label: 'Enable feature', type: 'checkbox' }],
    onClose: (popup) => console.log(popup.inputResults),
});
const result = await popup.show();
```

### callGenericPopup (Shorthand)

```typescript
const result = await callGenericPopup(content, POPUP_TYPE.CONFIRM);
```

---

## Extensions Framework (`scripts/extensions.js`)

Core extension management and utilities.

### Key Exports

```typescript
// Settings object - your extension's persistent storage
extension_settings[MODULE_NAME] = { ... };

// Template rendering
const html = await renderExtensionTemplateAsync('my-extension', 'template-name', data);

// Metadata save (debounced)
saveMetadataDebounced();

// Module worker wrapper
const worker = new ModuleWorkerWrapper(myFunction, 1000);
```

### extension_settings Structure

Pre-defined namespaces for built-in extensions:
- `memory`, `note`, `caption`, `expressions`
- `tts`, `sd`, `translate`, `vectors`
- `quickReply`, `regex`, `variables`
- `attachments`, `character_attachments`

---

## Tokenizers (`scripts/tokenizers.js`)

Token counting and encoding.

### Tokenizer Types

```typescript
tokenizers.NONE       // 0 - No tokenization
tokenizers.GPT2       // 1
tokenizers.OPENAI     // 2 - GPT-3.5/4
tokenizers.LLAMA      // 3 - Llama 1/2
tokenizers.LLAMA3     // 12 - Llama 3
tokenizers.CLAUDE     // 11 - Anthropic
tokenizers.MISTRAL    // 7
tokenizers.GEMMA      // 13
tokenizers.QWEN2      // 15
tokenizers.DEEPSEEK   // 18
tokenizers.BEST_MATCH // 99 - Auto-detect
```

### Usage via Context

```typescript
const ctx = SillyTavern.getContext();

// Async token count (preferred)
const count = await ctx.getTokenCountAsync(text);

// Get token array
const tokens = ctx.getTextTokens(ctx.tokenizers.LLAMA3, text);
```

---

## Custom Request Services (`scripts/custom-request.js`)

Direct API request wrappers.

### TextCompletionService

```typescript
import { TextCompletionService } from './custom-request.js';

const data = TextCompletionService.createRequestData({
    prompt: 'Complete this: ',
    max_tokens: 100,
    api_type: 'openrouter',
    temperature: 0.7,
});

// Non-streaming
const result = await TextCompletionService.sendRequest(data);
// result = { content: '...', reasoning: '...' }

// Streaming
const data = { ...data, stream: true };
const streamFn = await TextCompletionService.sendRequest(data);
for await (const chunk of streamFn()) {
    console.log(chunk.text); // accumulated text
}
```

### ChatCompletionService

```typescript
import { ChatCompletionService } from './custom-request.js';

const data = ChatCompletionService.createRequestData({
    messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello!' }
    ],
    max_tokens: 100,
    chat_completion_source: 'openai',
});

const result = await ChatCompletionService.sendRequest(data);
```

---

## Utils (`scripts/utils.js`)

Common utility functions (100+ exports).

### Essential Utilities

```typescript
// Object manipulation
deepMerge(target, source)
ensurePlainObject(obj)

// String helpers
escapeHtml(str)              // Safe HTML rendering
sanitizeSelector(str)        // CSS selector safe
trimToEndSentence(input)     // Trim at sentence end
collapseSpaces(str)          // Normalize whitespace

// Async helpers
delay(ms)                    // Promise-based sleep
debounce(fn, timeout)        // Debounce function
debounceAsync(fn, timeout)   // Debounce async function
throttle(fn, limit)          // Throttle function
waitUntilCondition(fn, timeout, interval)

// File helpers
getFileText(file)            // File to text
getBase64Async(file)         // File to base64
parseJsonFile(file)          // File to JSON
download(content, fileName, contentType)

// UUID and hashing
uuidv4()                     // Generate UUID
getStringHash(str, seed)     // Hash string

// Array helpers
onlyUnique(value, i, arr)    // Array filter unique
removeFromArray(arr, item)   // Remove item
shuffle(array)               // Randomize order

// DOM helpers
isElementInViewport(el)
flashHighlight(element, timespan)
setValueByPath(obj, path, value)

// Validation
isValidUrl(value)
isUuid(value)
isTrueBoolean(arg)
isFalseBoolean(arg)

// Text extraction
extractTextFromPDF(blob)
extractTextFromHTML(blob)
extractTextFromMarkdown(blob)
getReadableText(document)

// Comparison
equalsIgnoreCaseAndAccents(a, b)
includesIgnoreCaseAndAccents(text, search)
sortIgnoreCaseAndAccents(a, b)
versionCompare(src, min)
```

### Classes

```typescript
// Stopwatch for timing
const sw = new Stopwatch();
sw.start();
// ... work ...
console.log(sw.elapsed);  // ms elapsed

// Rate limiter
const limiter = new RateLimiter(1000); // 1 req/sec
await limiter.waitForResolve();
```

---

## Loader (`scripts/loader.js`)

Loading overlay helpers.

```typescript
import { showLoader, hideLoader } from './loader.js';

showLoader();          // Show spinner overlay
await someAsyncWork();
await hideLoader();    // Hide with animation
```

---

## Slash Commands (`scripts/slash-commands.js` + `scripts/slash-commands/`)

Register custom slash commands for user interaction.

### SlashCommand Class

```typescript
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { SlashCommandArgument, SlashCommandNamedArgument, ARGUMENT_TYPE } from './slash-commands/SlashCommandArgument.js';

const command = SlashCommand.fromProps({
    name: 'mycommand',
    aliases: ['mc', 'mycmd'],
    callback: async (namedArgs, unnamedArgs) => {
        const { verbose, count } = namedArgs;
        const text = unnamedArgs;
        // Do something...
        return 'result';  // Returned to pipe
    },
    helpString: 'Does something useful with text.',
    returns: 'The processed result',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'verbose',
            description: 'Enable verbose output',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'false',
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'count',
            description: 'Number of iterations',
            typeList: [ARGUMENT_TYPE.NUMBER],
            isRequired: false,
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'Text to process',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
});

// Register with parser
const ctx = SillyTavern.getContext();
ctx.SlashCommandParser.addCommandObject(command);
```

### ARGUMENT_TYPE Enum

```typescript
ARGUMENT_TYPE.STRING
ARGUMENT_TYPE.NUMBER
ARGUMENT_TYPE.BOOLEAN
ARGUMENT_TYPE.VARIABLE_NAME
ARGUMENT_TYPE.CLOSURE
ARGUMENT_TYPE.LIST
ARGUMENT_TYPE.DICTIONARY
```

---

## Tags (`scripts/tags.js`)

Character/group tagging system.

### Key Exports

```typescript
// Tag arrays (available via context)
tags          // All tags: { id, name, color, ... }[]
tag_map       // Map of entity key -> tag IDs

// Filter types
tag_filter_type.AND   // All tags must match
tag_filter_type.OR    // Any tag matches
tag_filter_type.NOT   // Exclude tagged

// Functions
getTagKeyForEntity(entity)           // Get tag key for char/group
addTagsToEntity(tag, entityId)       // Add tag to entity
removeTagFromEntity(tag, entityId)   // Remove tag
searchCharByName(name)               // Find character by name
getTagsList(key)                     // Get tags for entity
```

---

## Character Data Types (`scripts/char-data.js`)

TypeScript type definitions for character card format.

### v1CharData (Runtime Format)

```typescript
interface v1CharData {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creatorcomment: string;
    tags: string[];
    talkativeness: number;
    fav: boolean | string;
    create_date: string;
    data: v2CharData;        // v2 extension
    // ST-added fields
    chat: string;            // Current chat filename
    avatar: string;          // Avatar filename (unique ID)
    json_data: string;       // Raw JSON
    shallow?: boolean;       // Lazy-loaded flag
}
```

### v2CharData (Spec Format)

```typescript
interface v2CharData {
    name: string;
    description: string;
    character_version: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    tags: string[];
    system_prompt: string;
    post_history_instructions: string;
    creator: string;
    alternate_greetings: string[];
    character_book: v2WorldInfoBook;
    extensions: v2CharDataExtensionInfos;
}

interface v2CharDataExtensionInfos {
    talkativeness: number;
    fav: boolean;
    world: string;
    depth_prompt: {
        depth: number;
        prompt: string;
        role: 'system' | 'user' | 'assistant';
    };
    regex_scripts: RegexScriptData[];
}
```

---

## Macros (`scripts/macros.js` + `scripts/macros/macro-system.js`)

Template variable substitution system.

### Using Macros

```typescript
const ctx = SillyTavern.getContext();

// Simple substitution
const text = ctx.substituteParams('Hello {{user}}!');

// Extended with custom macros
const text = ctx.substituteParamsExtended('Value: {{myvar}}', {
    myvar: 'custom value'
});
```

### Registering Custom Macros (New API)

```typescript
const { macros } = SillyTavern.getContext();

macros.register('mymacro', {
    description: 'Returns a custom value',
    handler: (args) => {
        return 'my result';
    },
});

// Unregister
macros.registry.unregisterMacro('mymacro');
```

### Built-in Macros

| Macro | Description |
|-------|-------------|
| `{{user}}` | User persona name |
| `{{char}}` | Character name |
| `{{time}}` | Current time |
| `{{date}}` | Current date |
| `{{random}}` | Random number |
| `{{roll:XdY}}` | Dice roll |
| `{{idle_duration}}` | Time since last message |
| `{{lastMessage}}` | Last chat message |
| `{{lastMessageId}}` | Last message ID |
| `{{newline}}` | Line break |
| `{{trim}}` | Trim whitespace |

---

## i18n (`scripts/i18n.js`)

Internationalization/translation system.

### Template Literal Translation

```typescript
import { t } from './i18n.js';

// Template literal with interpolation
toastr.warning(t`Tag ${tagName} not found.`);

// Translation file format:
// "Tag ${0} not found." -> "Tag ${0} nicht gefunden."
```

### Functions

```typescript
t(strings, ...values)     // Template literal translator
translate(text, key?)     // Translate string
getCurrentLocale()        // Get current locale (e.g., 'en-us')
addLocaleData(localeId, data)  // Add custom translations
```

### HTML Translation

```html
<!-- Auto-translated via data-i18n attribute -->
<span data-i18n="Save">Save</span>

<!-- Title attribute -->
<button data-i18n="[title]Click to save">Save</button>
```

---

## Templates (`scripts/templates.js`)

Handlebars template rendering.

```typescript
import { renderTemplateAsync } from './templates.js';

// Render template from /scripts/templates/
const html = await renderTemplateAsync('mytemplate', { name: 'value' });

// With full path (for extensions)
const html = await renderTemplateAsync(
    'scripts/extensions/my-ext/template.html',
    { data: 'value' },
    true,   // sanitize
    true,   // localize
    true    // fullPath
);
```

---

## Constants (`scripts/constants.js`)

Shared constants and enums.

### Debounce Timeouts

```typescript
debounce_timeout.quick     // 100ms - keypresses
debounce_timeout.short     // 200ms - responsive
debounce_timeout.standard  // 300ms - default
debounce_timeout.relaxed   // 1000ms - intensive tasks
debounce_timeout.extended  // 5000ms - auto-save
```

### Other Constants

```typescript
IGNORE_SYMBOL              // Exclude message from generation
VIDEO_EXTENSIONS           // Supported video formats
GENERATION_TYPE_TRIGGERS   // ['normal', 'continue', 'impersonate', ...]
inject_ids.STORY_STRING    // Injection point IDs
inject_ids.QUIET_PROMPT
inject_ids.DEPTH_PROMPT
```

---

## Common Patterns

### Extension Initialization

```typescript
// In your extension's index.ts
import { eventSource, event_types } from './events.js';
import { extension_settings, saveSettingsDebounced } from './extensions.js';

const MODULE_NAME = 'my-extension';

// Wait for app ready
eventSource.once(event_types.APP_READY, init);

function init() {
    // Initialize settings
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = defaultSettings;
    }
    
    // Listen for changes
    eventSource.on(event_types.CHARACTER_EDITED, onCharacterChanged);
}
```

### Safe Settings Access

```typescript
function getSettings() {
    return extension_settings[MODULE_NAME] ?? {};
}

function updateSettings(updates) {
    Object.assign(extension_settings[MODULE_NAME], updates);
    saveSettingsDebounced();
}
```

### Registering a Slash Command

```typescript
const ctx = SillyTavern.getContext();

ctx.SlashCommandParser.addCommandObject(
    ctx.SlashCommand.fromProps({
        name: 'score',
        callback: async (args, text) => {
            // Implementation
            return 'Score: 85';
        },
        helpString: 'Score the current character card',
    })
);
```