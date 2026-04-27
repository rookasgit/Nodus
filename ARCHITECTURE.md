# Nodus Systems Architecture

Nodus is built as an experimental, client-side heavy React Co-Creation Studio, powered entirely by Google's Gemini API via `@google/genai`. Unlike standard chat wrappers, Nodus treats the LLM primarily as an *engine for distinct cognitive state models*, prioritizing branching, iteration, and rigorous synthesis over general-purpose answers.

## Tech Stack Overview
* **Framework:** React 19 / Vite / TypeScript
* **Styling:** Tailwind CSS + Framer Motion (for viewport transitions/animations).
* **Charts/Viz:** `recharts` (for the Spectrum Radar) and `echarts-for-react` (for Alignment Heatmaps), mapping structured LLM output to visualization components.
* **LLM Engine:** `@google/genai` (utilizing Gemini 3.1/3.0 Pro/Flash, and Gemini 2.5 Flash for image generation).
* **Fuzzy Matching:** Custom Whitespace-Agnostic Fuzzy Registration (regex-based) for resilient document anchoring.
* **Persistence:** idb-keyval (IndexedDB) for high-capacity, non-blocking session storage and local-first migration.

---

## Core Systems & Implementation Details

### 1. Multi-Agent Orchestration & The War Room
The foundation of the application sits in `appMode === 'LAB'` or `appMode === 'COUNCIL'`. Instead of passing user queries to a massive monolithic prompt, Nodus orchestrates arrays of distinct `CustomAgent` objects.
* Each agent object carries its own `systemInstruction`, parameters, and deterministic constraints.
* In parallel, Nodus maps the prompt across the selected active agents, invoking `ai.models.generateContentStream` for each.
* **Black Swan Engine / Gavel:** Agents can specifically target statements from other streams. If an agent "Gavel" is clicked, Nodus attaches the specific `parentMsg.text` context to a specialized system prompt, forcing the responding agent to break the argument constructively.

### 2. Strict JSON Coercion (`responseSchema`)
Whenever a multi-part process requires parsing, Nodus utilizes strict `responseMimeType: "application/json"` combined with explicit JSON definitions in `responseSchema`.
* **The Synthesizer Panel:** The synthesis stage forces the LLM to output specific keys: `heatmap_data` (agent-to-agent alignment arrays), `radar_data` (numerical mapping on specific cognitive axes), `alignment_quotes`, and a `whitepaper_markdown`.
* **Deterministic Fallback:** Where search integrations prevent the Gemini API from using `responseMimeType`, the system employs a resilient `try/catch` and regex-based string extraction to manually rip the payload out of standard markdown formatting.
* **Strategic Looping:** The responseSchema now includes suggested_next_questions: string[]. These are parsed and rendered as ActionPills that feed back into the main orchestrator to maintain conversation momentum.

### 3. The Canvas Editor & Fuzzy Anchoring
Traditional AI "Reviewers" break entirely if the user alters the text containing the targeted margin comment. Nodus uses a custom implementation in `src/components/CanvasEditor.tsx`.
* **Fuzzy Engine:** Utilizing raw indices checks with a fallback to resilient regular expressions. Unlike standard Git-style diffing, Nodus's fuzzy anchoring is optimized for 'Semantic Continuity'—it ensures that the intellectual intent of the AI's critique remains visible even if the user performs heavy stylistic refactoring.
* **Whitespace & Punctuation Agnostic:** Our custom algorithmic helper strips `/\W/g` (non-word characters) from the AI's "Quote." It then searches the mutable Markdown string for blocks of text containing those exact letters in sequence, regardless of how the user formats, spaces, or punctuates the string subsequently. It prevents margin highlights from disconnecting while writing contextually around the critique.
* **Metacognitive State:** Each margin note retains a status (`active`, `dismissed`, `integrated`), allowing the user to filter the UI locally as they push through a draft.

### 4. Insight Harvester Tooling (DOM Selection)
Standard UX often relies on clunky modals. Instead, Nodus binds directly to browser DOM behaviors:
* **Extractor Overload:** It tracks `window.getSelection()`. When the mouse un-clicks (`onMouseUp`), Nodus checks if the range originates inside `chat-messages-container`.
* **Floating Context:** Using the bounds retrieved from `getBoundingClientRect()`, it anchors a floating `[ EXTRACT TO CANVAS ]` node globally above the text to immediately transpose insights into the document state.

### 5. The Grounded Ledger
Because Multi-Agent simulations can drift off base reality, the `Synthesizer` phase invokes a background check using Google's Search Tool.
* **Metadata Extraction:** While iterating over `generateContentStream` chunks, the function checks for `chunk.candidates[0]?.groundingMetadata?.groundingChunks`.
* **Source Ledger Visualization:** This raw array of search items is transformed, mapped to respective host domains (`new URL(src.url).hostname`), tied to Google's Favicon fetcher, and injected dynamically beneath the generated Whitepaper to provide a high-contrast **Grounded Ledger**.

### 6. State Architecture & The Conversation Tree
Nodus utilizes a non-linear state model to support its Timeline Branching (Multiverse) feature.
Immutable History Trees: Conversations are not stored as flat arrays. Instead, they are structured as a forest of trees where each node contains a parentId. Branching a timeline creates a deep-copy of the current path and initializes a new branch node, preventing state-leakage between parallel "realities."
Cumulative Context Passing: To ensure agents in the "War Room" are aware of each other, Nodus employs a cumulative context strategy. Each agent's generation is appended to a temporary ephemeralContext that is passed to the subsequent agent in the queue, simulating a real-time "listening" environment.

### 7. Meta-Prompting & Agent Hydration
Nodus uses a "Prompt-to-Prompt" architecture for its Auto-Task Force feature. When a user defines a goal, a high-temperature 'Director' prompt is invoked to generate the JSON definitions (name, persona, baseInstruction) for three specialized agents. These are then dynamically hydrated into the React state as CustomAgent components.

### 8. Session Persistence & Evaluation Logic
Nodus has migrated from localStorage to an IndexedDB-backed Session Manager. This allows for large-scale conversation trees without hitting browser quota limits.
State Hydration: A specialized hook performs a one-time migration of legacy JSON strings from localStorage into structured IDB records.
Retrospective Metadata: Session resolution data (satisfaction scores and grounding answers) is stored as a SessionRetrospective object within the session payload, ensuring that the "utility" of a thought-exercise is indexed alongside the content.
Failsafe Exports: The export engine utilizes Blob APIs and navigator.clipboard fallbacks to ensure that even in restricted iframe environments, users can extract their Intellectual Property.

## Philosophy of Design
All systems inside Nodus are designed to prevent the platform from doing the work *for* the author. By extracting discrete citations, highlighting specific friction graphs, and allowing the human to write and reflow text around AI constraints smoothly, it operates as an exoskeleton rather than an autopilot. 
