# Nodus — Roadmap

---

## High Priority

**Shareable session links**
Read-only shareable URL for a completed debate and its synthesis. 
Shareability is the primary word-of-mouth vector for a tool like this. 
Sessions are already persisted via IndexedDB — the sharing layer is 
the missing piece.

**Named session search**
Sessions are stored but not easily discoverable. Naming, tagging, 
and search across session history would complete the persistence story.

---

## Medium Priority

**Agent position tracking**
Personas are locked at session start and don't update their positions 
as the debate develops. Real intellectual friction involves position 
changes — partial conviction, doubling down, reframing. Explicit 
position state per agent across turns would make debates significantly 
more useful.

**Side-by-side Shadow Council comparison**
You can fork a timeline with a Black Swan injection but can't currently 
view both branches simultaneously. A split-view comparing original 
debate vs. post-Black Swan response is the obvious completion of that feature.

**Prompt starter library**
Curated prompts for each Task Force panel. New users currently face 
a blank input with no guidance on what kinds of questions work well. 
A starter library with 5-10 examples per panel lowers the barrier 
significantly.

**HTML export polish**
HTML exports are currently generated and can be printed to PDF locally. 
Improving the export template — embedded charts, styled source ledger, 
clean print stylesheet — would make this a genuinely shareable deliverable 
without any dependency on third-party PDF generation.

**Mobile layout for Council and Canvas**
The synthesis workflow requires desktop screen real estate by design. 
Council (debate view) and Canvas (writing view), already implemented but needs more focus.

---

## Lower Priority / Exploratory

**Keyboard shortcuts for power users**
Tab between agents, G for Gavel, E for Extract to Canvas, 
S for Shadow Council. Small surface area, high signal of craft.

**Agent response pinning**
Flag a specific agent's response as strong and keep it anchored 
while regenerating other agents. Currently all-or-nothing.

**Epistemic calibration in Lab mode**
Personas intentionally hold their positions throughout — that's the 
point of locked epistemic logics in Council mode. Lab mode is different: 
it's the audit phase, and surfacing explicit confidence levels on 
agent claims during Lab would improve the quality of the friction 
without breaking the persona integrity of Council.

**Multi-user / collaborative sessions**
Two people running a War Room against a shared problem in real time.
