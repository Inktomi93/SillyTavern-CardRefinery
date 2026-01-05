# SillyTavern Context API Map

> **Source of Truth** for `SillyTavern.getContext()` API.
> See also: `st-bundled-libs` (libraries), `st-modules-reference` (core modules)

Complete reference for `SillyTavern.getContext()` API based on `/public/scripts/st-context.js`.

## Core State

| API                | Type           | Description                         |
| ------------------ | -------------- | ----------------------------------- |
| `chat`             | `Message[]`    | Current chat messages array         |
| `characters`       | `Character[]`  | All loaded characters               |
| `groups`           | `Group[]`      | All character groups                |
| `name1`            | `string`       | User persona name                   |
| `name2`            | `string`       | Current character/group name        |
| `characterId`      | `number\|null` | Current character ID (`this_chid`)  |
| `groupId`          | `string\|null` | Current group ID (`selected_group`) |
| `chatId`           | `string`       | Current chat file ID                |
| `getCurrentChatId` | `() => string` | Get current chat ID function        |
| `onlineStatus`     | `string`       | API connection status               |
| `maxContext`       | `number`       | Maximum context tokens              |
| `menuType`         | `string`       | Current UI menu type                |

## Character Operations

| API                                    | Description                            | Notes         |
| -------------------------------------- | -------------------------------------- | ------------- |
| `getCharacters()`                      | Refresh character list from server     | Async         |
| `getCharacterCardFields(char, fields)` | Extract specific fields from character |               |
| `unshallowCharacter(char)`             | Load full character data (spec v3)     | Async         |
| `getThumbnailUrl(type, file)`          | Get character thumbnail URL            |               |
| `selectCharacterById(id)`              | Select character by avatar filename    |               |
| `createCharacterData`                  | Character creation form data           | `create_save` |
| `openCharacterChat(chatFile)`          | Open specific chat file                |               |

## Group Operations

| API                            | Description                      |
| ------------------------------ | -------------------------------- |
| `openGroupChat(groupId)`       | Open group chat                  |
| `unshallowGroupMembers(group)` | Load full data for group members |

## Generation

| API                                                   | Description                    | Notes                     |
| ----------------------------------------------------- | ------------------------------ | ------------------------- |
| `generate(type, options)`                             | Main generation function       | `Generate` from script.js |
| `generateQuietPrompt(prompt, quiet, skipWI, options)` | Silent generation (no chat UI) |                           |
| `generateRaw(prompt, parent, options)`                | Raw text generation            |                           |
| `streamingProcessor`                                  | Handle streaming responses     |                           |
| `sendStreamingRequest(type, data)`                    | Send streaming request         |                           |
| `sendGenerationRequest(type, data)`                   | Non-streaming request          |                           |
| `stopGeneration()`                                    | Abort current generation       |                           |

## Tokenization

| API                                 | Description                      | Notes                      |
| ----------------------------------- | -------------------------------- | -------------------------- |
| `tokenizers`                        | Available tokenizer types        | Enum                       |
| `getTextTokens(tokenizer, text)`    | Get token array                  |                            |
| `getTokenCount(text)`               | Count tokens                     | **Deprecated** - use async |
| `getTokenCountAsync(text, padding)` | Async token count                | Preferred                  |
| `getTokenizerModel()`               | Get current tokenizer model name |                            |

## Chat/Messages

| API                                       | Description             |
| ----------------------------------------- | ----------------------- |
| `addOneMessage(message, options)`         | Add message to chat     |
| `deleteLastMessage()`                     | Delete last message     |
| `deleteMessage(messageId)`                | Delete specific message |
| `updateMessageBlock(messageId, message)`  | Update message UI block |
| `printMessages()`                         | Re-render all messages  |
| `clearChat()`                             | Clear chat display      |
| `sendSystemMessage(type, text, options)`  | Send system message     |
| `saveReply(type, text, options)`          | Save assistant reply    |
| `messageFormatting(text, name, isSystem)` | Format message text     |

## Media/Attachments

| API                                    | Description                |
| -------------------------------------- | -------------------------- |
| `appendMediaToMessage(message, media)` | Add media to message       |
| `ensureMessageMediaIsArray(message)`   | Normalize media array      |
| `getMediaDisplay(media)`               | Get media display element  |
| `getMediaIndex(message, media)`        | Get media index in message |
| `scrollChatToBottom()`                 | Scroll chat to bottom      |
| `scrollOnMediaLoad(element)`           | Scroll after media loads   |

## Swipe Navigation

```typescript
swipe: {
    left: swipe_left,      // Swipe to previous
    right: swipe_right,    // Swipe to next
    to: swipe,             // Swipe to index
    show: showSwipeButtons,
    hide: hideSwipeButtons,
    refresh: refreshSwipeButtons,
    isAllowed: isSwipingAllowed,
    state: () => swipeState
}
```

## Metadata

| API                           | Description                                |
| ----------------------------- | ------------------------------------------ |
| `chatMetadata`                | Per-chat metadata object (`chat_metadata`) |
| `updateChatMetadata(updates)` | Update chat metadata                       |
| `saveMetadata()`              | Save metadata immediately                  |
| `saveMetadataDebounced()`     | Debounced metadata save                    |

## Settings

| API                       | Description             | Source                         |
| ------------------------- | ----------------------- | ------------------------------ |
| `extensionSettings`       | All extension settings  | `extension_settings`           |
| `saveSettingsDebounced()` | Debounced settings save |                                |
| `chatCompletionSettings`  | OpenAI/Chat settings    | `oai_settings`                 |
| `textCompletionSettings`  | TextGen settings        | `textgenerationwebui_settings` |
| `powerUserSettings`       | Power user settings     | `power_user`                   |
| `mainApi`                 | Current API type        | `main_api`                     |

## UI/Popups

| API                                               | Description             | Notes                            |
| ------------------------------------------------- | ----------------------- | -------------------------------- |
| `Popup`                                           | Popup class constructor |                                  |
| `POPUP_TYPE`                                      | Popup type enum         | TEXT, CONFIRM, INPUT, DISPLAY    |
| `POPUP_RESULT`                                    | Popup result enum       | AFFIRMATIVE, NEGATIVE, CANCELLED |
| `callGenericPopup(content, type, value, options)` | Show popup              | Preferred                        |
| `callPopup(content, type)`                        | Legacy popup            | **Deprecated**                   |
| `showLoader()`                                    | Show loading overlay    |                                  |
| `hideLoader()`                                    | Hide loading overlay    |                                  |

## Request Helpers

| API                            | Description                               |
| ------------------------------ | ----------------------------------------- |
| `getRequestHeaders()`          | Get auth headers for ST API               |
| `reloadCurrentChat()`          | Reload current chat                       |
| `renameChat(oldName, newName)` | Rename chat file                          |
| `saveChat()`                   | Save current chat (`saveChatConditional`) |

## Events

| API           | Description                          |
| ------------- | ------------------------------------ |
| `eventSource` | EventEmitter instance                |
| `eventTypes`  | Event type constants (`event_types`) |

**Key Events:**

- `CHARACTER_SELECTED`, `CHARACTER_EDITED`, `CHARACTER_DELETED`
- `CHAT_CHANGED`, `MESSAGE_RECEIVED`, `MESSAGE_SENT`
- `GENERATION_STARTED`, `GENERATION_STOPPED`, `GENERATION_ENDED`
- `SETTINGS_UPDATED`, `GROUP_UPDATED`

## Slash Commands

| API                                                   | Description              | Notes                     |
| ----------------------------------------------------- | ------------------------ | ------------------------- |
| `SlashCommandParser`                                  | Command parser class     | Use `.addCommandObject()` |
| `SlashCommand`                                        | Command definition class |                           |
| `SlashCommandArgument`                                | Positional argument      |                           |
| `SlashCommandNamedArgument`                           | Named argument           |                           |
| `ARGUMENT_TYPE`                                       | Argument type enum       | STRING, NUMBER, etc.      |
| `executeSlashCommandsWithOptions(text, options)`      | Execute commands         | Preferred                 |
| `executeSlashCommands(text)`                          | Execute commands         | **Deprecated**            |
| `registerSlashCommand(name, callback, aliases, desc)` | Register command         | **Deprecated**            |

## Tool Calling

| API                                                | Description          |
| -------------------------------------------------- | -------------------- |
| `ToolManager`                                      | Tool manager class   |
| `registerFunctionTool(name, desc, params, action)` | Register tool        |
| `unregisterFunctionTool(name)`                     | Unregister tool      |
| `isToolCallingSupported()`                         | Check if supported   |
| `canPerformToolCalls()`                            | Check if can perform |

## Macros

| API                                                     | Description          | Notes                                    |
| ------------------------------------------------------- | -------------------- | ---------------------------------------- |
| `macros`                                                | New macro system     | From `macro-system.js`                   |
| `substituteParams(text, name1, name2, original, group)` | Replace macros       |                                          |
| `substituteParamsExtended(text, additionalMacros)`      | Extended replacement |                                          |
| `registerMacro(name, fn)`                               | Register macro       | **Deprecated** - use `macros.register()` |
| `unregisterMacro(name)`                                 | Unregister macro     | **Deprecated**                           |

## Variables

```typescript
variables: {
    local: {
        get: getLocalVariable,
        set: setLocalVariable,
        del: deleteLocalVariable,
        add: addLocalVariable,
        inc: incrementLocalVariable,
        dec: decrementLocalVariable
    },
    global: {
        get: getGlobalVariable,
        set: setGlobalVariable,
        del: deleteGlobalVariable,
        add: addGlobalVariable,
        inc: incrementGlobalVariable,
        dec: decrementGlobalVariable
    }
}
```

## World Info / Lorebook

| API                          | Description                       |
| ---------------------------- | --------------------------------- |
| `loadWorldInfo(name)`        | Load world info file              |
| `saveWorldInfo(name, data)`  | Save world info                   |
| `reloadWorldInfoEditor()`    | Reload WI editor (`reloadEditor`) |
| `updateWorldInfoList()`      | Update WI list UI                 |
| `convertCharacterBook(book)` | Convert character lorebook        |
| `getWorldInfoPrompt(chat)`   | Get WI prompt for context         |

## Tags

| API      | Description                       |
| -------- | --------------------------------- |
| `tags`   | All tags array                    |
| `tagMap` | Tag ID to tag mapping (`tag_map`) |

## i18n

| API                           | Description          |
| ----------------------------- | -------------------- |
| `t(key, args)`                | Translate string     |
| `translate(key)`              | Translate (alias)    |
| `getCurrentLocale()`          | Get current locale   |
| `addLocaleData(locale, data)` | Add translation data |

## Extension Helpers

| API                                                | Description                       | Notes               |
| -------------------------------------------------- | --------------------------------- | ------------------- |
| `extensionPrompts`                                 | Active extension prompts          | `extension_prompts` |
| `setExtensionPrompt(name, value, position, depth)` | Set extension prompt              |                     |
| `writeExtensionField(charId, field, value)`        | Write to character extension data |                     |
| `renderExtensionTemplateAsync(name, data)`         | Render template                   | Preferred           |
| `renderExtensionTemplate(name, data)`              | Render template                   | **Deprecated**      |
| `ModuleWorkerWrapper(fn, delay)`                   | Create module worker              |                     |
| `openThirdPartyExtensionMenu(name)`                | Open extension menu               |                     |
| `registerDebugFunction(name, desc, fn)`            | Register debug function           |                     |
| `registerDataBankScraper(scraper)`                 | Register data bank scraper        |                     |

## Custom Request Services

| API                               | Description                 |
| --------------------------------- | --------------------------- |
| `ChatCompletionService`           | Chat completion API wrapper |
| `TextCompletionService`           | Text completion API wrapper |
| `ConnectionManagerRequestService` | Connection manager requests |

## Reasoning (Extended Thinking)

| API                                     | Description               |
| --------------------------------------- | ------------------------- |
| `updateReasoningUI(message, reasoning)` | Update reasoning display  |
| `parseReasoningFromString(text)`        | Parse reasoning from text |
| `getReasoningTemplateByName(name)`      | Get reasoning template    |

## Utilities

| API                            | Description                 |
| ------------------------------ | --------------------------- |
| `uuidv4()`                     | Generate UUID v4            |
| `humanizedDateTime()`          | Human-readable datetime     |
| `timestampToMoment(timestamp)` | Convert to moment           |
| `isMobile()`                   | Check if mobile device      |
| `shouldSendOnEnter()`          | Check send-on-enter setting |
| `getPresetManager(type)`       | Get preset manager          |

## API Info

| API                        | Description                 |
| -------------------------- | --------------------------- |
| `CONNECT_API_MAP`          | API connection type mapping |
| `getTextGenServer()`       | Get text gen server URL     |
| `getChatCompletionModel()` | Get current chat model      |

## Special Symbols

```typescript
symbols: {
    ignore: IGNORE_SYMBOL; // Symbol to ignore in prompts
}
```

## Storage

| API              | Description                     |
| ---------------- | ------------------------------- |
| `accountStorage` | Account-level storage interface |

---

## Usage Pattern

```typescript
const ctx = SillyTavern.getContext();

// Get current character
const char = ctx.characters[ctx.characterId];

// Check API status
if (ctx.onlineStatus !== 'no_connection') {
    await ctx.generateQuietPrompt('Hello');
}

// Listen for events
ctx.eventSource.on(ctx.eventTypes.CHARACTER_EDITED, () => {
    // Character was edited externally
});

// Register slash command (new way)
ctx.SlashCommandParser.addCommandObject(
    ctx.SlashCommand.fromProps({
        name: 'mycommand',
        callback: async (args) => { ... },
        helpString: 'My command description'
    })
);
```
