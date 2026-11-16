# Homeswoon content guidelines

How we write in the app and on the landing page. Based on the copy as it stands today.

## The idea

House hunting is stressful, so Homeswoon sounds **calm, warm and clear**. We're the
friend who keeps the spreadsheet tidy, not the mate who makes jokes while you're
trying to work out a mortgage.

**The rule that decides everything: clarity first, personality second.**
The more the user's money, data or next step depends on a message, the plainer it
gets. Personality goes where nothing is at stake.

## Tone dial

| Moment | Tone | Examples (current copy) |
|---|---|---|
| **Critical.** Deleting, paying, errors, anything irreversible or costly | Plain and exact. Name the action and the consequence. No jokes. | "Delete this property?", "Please enter a valid email address" |
| **Functional.** Forms, labels, settings, buttons | Short, literal, helpful. A touch of warmth in hints. | "Service charge (£/year)", "So your partner knows who's who" |
| **Guiding.** Onboarding, empty states, prompts | Friendly and encouraging. Say what to do next. | "Move a home to Seen after your viewing and score it.", "Nothing scored yet" |
| **Brand.** Landing page, headlines, celebratory moments | Calm and a little playful. This is where voice lives. | "Find your home,", "One calm place for the whole search", "Six agents. A dozen calls." |

If you're unsure which row a message is in, treat it as the one above it.

## Principles

1. **Say what happens.** Buttons and headings use the real verb: "Delete property", not
   "Remove it" or "Continue". The destructive button repeats the heading's verb.
2. **Name the consequence.** If something is permanent, or removes scores or notes,
   say so in words, including "delete" or "deletion" where that's the action.
3. **Playfulness never hides meaning.** A light line can sit *beside* the facts, never
   in place of them, and never in critical moments (see the delete modal below).
4. **One question per message.** Don't stack questions in a heading and body.
5. **Talk like a person.** "Your favourites", "We found your homes from before".
   Avoid system-speak such as "Entity", "Record", "Invalid input".
6. **Be brief.** One idea per sentence. Cut "please", "simply" and "just" unless they
   soften a real ask.
7. **Reassure, don't alarm.** Errors say what went wrong and how to fix it, without
   blame or capitals.

## Voice and style

- **UK English.** Colour, favourite, organise, "flat" and "estate agent". Prices as
  £450,000 and £2,500 pcm.
- **Sentence case** for headings, buttons and labels ("Add a home", not "Add A Home").
- **Curly apostrophes and quotes** (can't, you're), matching the existing copy.
- **"Home" or "property" depends on the topic.** Use **home** for context, guidance and
  marketing, where we're talking about the place someone might live ("Add a home",
  "Your favourites", "Find your home"). Use **property** for serious or transactional
  moments, where we're talking about the asset and what happens to its data (deleting,
  moving to archive, tenure, money). Don't mix the two in one message. Use "listing" for
  the agent's advert and "board" for the shared workspace.
- **Numbers as digits** (3 bedrooms, 18-second tour). Spell out only inside idioms
  ("a dozen calls").
- **Sparing punctuation.** No exclamation marks in critical or functional copy. At
  most one in a celebratory moment. No emoji in UI copy.
- **Arrows (→)** on forward links only, as in "Start your search →".
- **Placeholders** show a realistic example with "e.g." ("e.g. 12 Elm Street, London,
  E1 4AB"). They never replace labels.

## Patterns

### Buttons
Verb first, specific, two or three words. "Add a home", "Start your search",
"Delete property", "Cancel". For a pair of confirm/dismiss buttons, the dismiss is
"Cancel" and the confirm names the action.

### Empty states
Say why it's empty and what to do. Light personality is welcome.
- "Nothing scored yet"
- "No archived properties yet." (archive is a serious, data-holding area, so "properties")
- "Paste a link from Rightmove, Zoopla or any agent to add your first home."

### Errors
What happened, then what to do. No jargon, no blame.
- "Please enter a valid email address"
- "Enter a valid board code"

### Confirmations for destructive actions
Heading asks the question using the action ("Delete this property?"). Body states the
consequence in plain words. Buttons are "Cancel" and the action. Keep the body free of
questions and jokes: one question per message, and the heading already asks it.

### Helper text and hints
One short sentence. Tell the user why we're asking.
- "So your partner knows who's who"
- "You can change it anytime in board settings."

### Scorecard and scoring
Questions adapt to renting or buying, flats or houses, and only appear when they
apply (for example, service charge only for leasehold). Anchors are concrete and
unfussy ("Fair market value", "Low or nil, under £1,000/yr"). Keep these neutral:
the user is judging a home, not being entertained.

### Landing page
This is where the voice is most expressive: short declarative headlines, a
single idea per section, specific details (Greenwich on Saturday, Shad Thames on
Sunday) over generic benefits. Still no hype: "calm" beats "revolutionary".

## Worked example: deleting a property

Deleting is irreversible and removes the user's scoring, so this is a critical moment
and the copy stays plain.

| | Copy |
|---|---|
| Heading | **Delete this property?** |
| Body | Deleting it permanently removes this property and all of its scoring and notes. This can't be undone. |
| Buttons | **Cancel** · **Delete property** |

Why it works: the heading and button use the real verb, and the body says exactly what
is lost (the property, its scoring and its notes). There is one question, in the heading.
We tried adding a playful opener ("Not the one?") and cut it: two questions in a row
make the user stop and re-read at the moment they most need to be sure.

## Do and don't

| Do | Don't |
|---|---|
| "Delete property" | "Remove it", "Yes", "OK" |
| "Deleting it removes all of its scoring and notes." | "It'll be gone for good!" |
| "Enter a valid board code" | "Error: invalid input" |
| "Add a home" | "Add New Property" |
| "Your favourites" | "Favorites" |
| "Move a home to Seen after your viewing and score it." | "Please be advised that scoring is available." |

## Checklist before shipping copy

- Is the user about to lose something or spend money? Use the plain tone.
- Does the button say what it does?
- Does the message name the consequence?
- Is it UK English, sentence case, and "home" for context and marketing, "property" for serious moments?
- Could it be shorter?
- Is there only one question in the message?
- If there's a playful line, does the message still work without it?
