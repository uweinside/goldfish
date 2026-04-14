# Timer App Agent Migration Instructions

## Goal
Migrate legacy training JSON files from the old shape to the new course schema.

Legacy shape:
- Top level uses title + segments
- Segment uses title + duration + type + info
- Info block uses label + items + transcript[]

Target shape:
- Top level uses title + chapters
- Chapter uses title + sections
- Section uses title + type + durationSeconds + instructions (+ optional transcript)

Use the schema in [course.schema.json](course.schema.json) as the source of truth.

## Required Output Rules
1. Keep top-level title unchanged.
2. Replace segments with chapters.
3. Convert each segment to one chapter.
4. Convert each info block to one section.
5. Section title equals legacy label.
6. Section duration field name must be durationSeconds.
7. Section durationSeconds must be an integer >= 1.
8. Section instructions must be a markdown string and always present.
9. Section transcript is optional and must be a string when present.
10. Do not include additional properties outside schema.

## Type Mapping Rules
Map legacy content intent to new section type values:
- Demo-like click-through, interface walkthrough, product steps -> Demo
- Audience interaction prompts, chat prompts, reaction checks, Q&A invitations -> Prompt
- Slide structure, outlines, summaries, key points, checklists, constraints -> Rule
- Spoken explanations, intros, conceptual teaching, transitions -> Narration

Legacy segment type is advisory only. Determine section type from the individual info block intent.

## Field Mapping Rules
1. chapter.title = segment.title
2. section.title = info.label
3. Build section.instructions from info.items:
- Start with heading: ## {section.title}
- Add one markdown bullet per item line: - {item}
- If no items exist, still create instructions as:
  - ## {section.title}
  - - Add trainer guidance here
4. Build section.transcript from info.transcript:
- If transcript is a non-empty array, join elements with two newlines into one string
- If transcript is empty or missing, omit section.transcript entirely

## Duration Mapping Rules
1. Chapter total duration is the old segment.duration.
2. Distribute chapter total across sections so section durations sum exactly to chapter total.
3. Prefer this deterministic strategy:
- If a section has transcript, assign higher weight
- If a section has only structural items, assign lower weight
4. Default weights:
- Section with transcript: 3
- Section without transcript: 1
5. Compute each raw share:
- raw = chapterTotal * (sectionWeight / sumWeights)
6. Convert to integers with largest-remainder method:
- base = floor(raw)
- remainder = chapterTotal - sum(base)
- Add +1 to sections with largest fractional parts until remainder is 0
7. Ensure every section is at least 1 second:
- If any section becomes 0, set to 1 and subtract from the largest section(s)

## Safety and Fidelity Rules
1. Preserve source meaning; do not invent product claims.
2. You may lightly normalize wording for clarity in instructions.
3. Keep transcript voice first-person trainer speech if source already is first person.
4. Keep markdown headings inside transcript when present.
5. Remove legacy-only fields from final output:
- segment.duration
- segment.type
- info.label
- info.items
- info.transcript array

## Validation Checklist
Run this checklist after each migration:
1. JSON is valid.
2. Top-level keys are only title and chapters.
3. Every chapter has title and sections.
4. Every section has title, type, durationSeconds, instructions.
5. Every section type is one of Narration, Demo, Prompt, Rule.
6. Every durationSeconds is integer >= 1.
7. For each chapter, sum(section.durationSeconds) equals legacy segment.duration.
8. transcript exists only as a string and only when needed.
9. No additionalProperties violations against [course.schema.json](course.schema.json).

## Deterministic Migration Procedure
1. Parse legacy file.
2. Create output object with title and empty chapters.
3. For each segment:
- Create chapter with same title.
- Convert each info block into draft section with title, mapped type, instructions, optional transcript.
- Compute section durations using weighted largest-remainder method to match segment.duration exactly.
- Attach sections to chapter.
- Append chapter.
4. Validate against schema in [course.schema.json](course.schema.json).
5. If validation fails, fix fields and types only; do not add off-schema keys.

## Agent Prompt Template
Use this as your timer app agent instruction prompt:

You are a strict JSON migration agent.
Task: Convert an input training JSON file from legacy segments/info schema to the new chapters/sections schema defined in [course.schema.json](course.schema.json).
Requirements:
1. Follow mapping, type, duration, and validation rules exactly.
2. Preserve course content meaning and trainer intent.
3. Produce valid JSON only, no commentary.
4. Ensure every chapter duration is preserved exactly by summing section durationSeconds.
5. Omit transcript when source transcript is missing.
6. Never output additional properties outside schema.

## Quick Example
Legacy fragment:
{
  "title": "Sample",
  "segments": [
    {
      "title": "Intro",
      "duration": 60,
      "type": "lecture",
      "info": [
        { "label": "Opening Narration", "items": ["Welcome"], "transcript": ["### Hello\\nWelcome"] },
        { "label": "Reaction Prompts", "items": ["Thumbs up if ready"] }
      ]
    }
  ]
}

Migrated fragment:
{
  "title": "Sample",
  "chapters": [
    {
      "title": "Intro",
      "sections": [
        {
          "title": "Opening Narration",
          "type": "Narration",
          "durationSeconds": 45,
          "instructions": "## Opening Narration\\n- Welcome",
          "transcript": "### Hello\\nWelcome"
        },
        {
          "title": "Reaction Prompts",
          "type": "Prompt",
          "durationSeconds": 15,
          "instructions": "## Reaction Prompts\\n- Thumbs up if ready"
        }
      ]
    }
  ]
}
