# Transcript to Course JSON Authoring Guidelines

## Purpose
Use this guide when converting training transcripts into CuePilot course JSON files that match [course.schema.json](course.schema.json).

Scope:
- Build chapters and sections from transcript timestamps
- Produce instructions and transcript fields with subtle markdown
- Preserve meaning while improving scanability
- Replace real personal identifiers with placeholders

## Source of Truth
- Schema: [course.schema.json](course.schema.json)
- Output shape:
  - title
  - chapters[]
  - chapters[].sections[]
  - sections[] fields: title, type, durationSeconds, instructions, optional transcript

## Workflow
1. Read the transcript fully before splitting content.
2. Use timestamp ranges as the default section boundaries.
3. Group related timestamp sections into coherent chapters.
4. Assign section types using the mapping rules below.
5. Write concise instructions with subtle markdown.
6. Convert spoken text into transcript markdown blocks without changing intent.
7. Replace names and other direct identifiers with placeholders.
8. Validate final JSON syntax and schema compatibility.

## Chapter and Section Design Rules
- Prefer chapter durations of about 5 to 20 minutes when possible.
- Keep sections focused on one intent each.
- If one timestamp block mixes multiple intents, split into separate sections only when clarity improves.
- Preserve transcript order exactly.

## Duration Rules
- When timestamps are provided, compute durationSeconds from timestamp boundaries.
- Use integer seconds.
- Ensure durationSeconds is at least 1.
- If no end timestamp exists, estimate from context and note that estimate in instructions.

## Section Type Mapping
Use the most specific type for each section:

- Narration:
  - Explanation, framing, transitions, conceptual teaching, introductions
- Demo:
  - Walkthroughs, interface actions, live examples, step-by-step showing
- Prompt:
  - Audience interactions, response checks, questions to participants, exercises
- Rule:
  - Ground rules, policies, constraints, checklists, operational guidance

## Instructions Style (Subtle Markdown)
Instructions should be short, structured, and glanceable.

Preferred pattern:
- Heading 1: ### Focus
- Heading 2: ### Cover
- 3 to 5 bullets max under Cover

Example pattern:

### Focus
Set expectations for participation and communication.

### Cover
- Mute and camera expectations
- Chat-first question flow
- Reaction conventions for yes and no

Guidelines:
- Keep instructions actionable and trainer-oriented.
- Avoid long paragraphs.
- Use plain language.

## Transcript Style (Subtle Markdown)
Transcript should preserve speaker voice while improving readability.

Preferred pattern:
- Optional section labels such as:
  - ### Opening
  - ### Context
  - ### Key Principle
  - ### Transition

Guidelines:
- Keep wording faithful to source.
- Do not rewrite meaning.
- Light cleanup for punctuation and readability is allowed.
- Do not over-format.

## Placeholder and Privacy Rules
Replace direct identifiers with stable placeholders.

Examples:
- Person names -> [PRESENTER_NAME], [MODERATOR_NAME], [GUEST_NAME]
- Email addresses -> [PRESENTER_EMAIL]
- Personal profile links -> [PROFILE_LINK]
- Customer or tenant names -> [ORG_NAME]

Rules:
- Use the same placeholder for the same person/entity throughout a file.
- Do not leave real names in transcript or instructions.
- If identity is not needed for learning outcome, omit it.

## Content Fidelity Rules
- Preserve original intent and tone.
- Do not add product claims not present in source.
- Do not invent features, links, or numbers.
- Keep trainer voice in first person when source is first person.

## JSON Quality Checklist
Before finalizing:

1. JSON parses successfully.
2. Only valid schema fields are used.
3. Every section has title, type, durationSeconds, instructions.
4. section.type is one of Narration, Demo, Prompt, Rule.
5. durationSeconds values are positive integers.
6. transcript is either omitted or a string.
7. No real names or direct identifiers remain.
8. Instructions and transcript use consistent subtle markdown.

## Naming Conventions
- File names:
  - courses/<topic>-part<index>.json
- Titles:
  - Include topic and part number when applicable.
- Chapter titles:
  - Use concise, conceptual labels, not timestamp labels.
- Section titles:
  - Use concrete action or outcome language.

## Reusable Prompt Template
Use this prompt when asking an agent to convert transcript to course JSON:

Create a CuePilot course JSON from the transcript using [course.schema.json](course.schema.json).

Requirements:
1. Build chapters and sections from timestamp ranges.
2. Compute durationSeconds from timestamps.
3. Use section types: Narration, Demo, Prompt, Rule.
4. Write instructions with subtle markdown:
   - ### Focus
   - ### Cover
   - Bullet list (3 to 5 bullets)
5. Format transcript with light markdown headings only where useful.
6. Replace all real names and direct identifiers with placeholders.
7. Preserve transcript meaning and order.
8. Output valid JSON only.

## Minimal Section Blueprint
{
  "title": "Section Title",
  "type": "Narration",
  "durationSeconds": 120,
  "instructions": "### Focus\nOne sentence.\n\n### Cover\n- Point one\n- Point two",
  "transcript": "### Opening\nSpoken content here."
}
