// Dialogue options. For each character, the situations that come up at the table, each with a few
// interchangeable lines: the DM picks whichever fits the moment (or lets the dice pick). A line in
// (parentheses) is a performance cue, not speech. Lines take [[links]] like any other text.
//
// Any of a character's `lines` that no situation uses still show, under "More lines". Caley has none
// on purpose: her lines come from Flynn's player.

import type { DialogueCue } from './types';

const cue = (situation: string, ...options: string[]): DialogueCue => ({ cue: situation, options });

const goon = (fighting: DialogueCue): DialogueCue[] => [
  cue('Stepping out of the hangar', 'Tyler says nobody flies today.', 'You picked the wrong flight.', "First rule of the airfield: you don't leave the airfield."),
  fighting,
  cue('Going down', "Tyler's gonna be so mad.", '(Drops the weapon and lies down. Strategically.)', "Okay, okay. I'm on break."),
];

const gladiator: DialogueCue[] = [
  cue('Greeting', 'Which one of you is the groom?', 'Welcome, warriors. Clothing is optional. Everything is optional.', 'Are you not entertained?'),
  cue('Seducing', 'Masks stay on if you want.', 'The turtle too.', "No weapons. Unless that's part of it."),
  cue('Turned down', '(Flexes, wounded.) Rome would have said yes.', 'Your loss. Your very, very large loss.', '(Three gladiators sigh in unison.)'),
  cue('If it turns physical', 'Ah. Wrestling. Even better.', 'Strength and honor! And oil.', '(Charges, cheerful and enormous.)'),
];

export const DIALOGUE: Record<string, DialogueCue[]> = {
  // ── The field ───────────────────────────────────────────
  sheep: [
    cue('Waking Flynn', 'Baa.', '(It sneezes directly into the Spider-Man mask.)', '(It keeps chewing and stares straight at the Spider-Man mask.)'),
    cue('If they talk to it', 'Baa.', '(A long, judgmental silence.)', '(It turns and walks off mid-sentence, like it has somewhere better to be.)'),
    cue(
      'If they chase it',
      '(It bolts, then stops dead. Whoever was chasing it goes straight over the top.)',
      "Baaaaa! (Over the hill, a farmer's dog starts barking.)",
      '(It leads them in a perfect circle back to the bonfire.)',
    ),
  ],

  // ── The Green Dragon ────────────────────────────────────
  bartender: [
    cue('They walk in', 'You five again.', "(He picks up the phone without breaking eye contact.) ...Yeah. They're back.", "And no, I'm still not making the turtle a vodka Red Bull."),
    cue('Asked about last night', 'You were not exactly subtle last night.', 'Your big friend danced through my floor. To NSYNC.', 'The turtle ordered a vodka Red Bull nineteen times. I counted.'),
    cue('Asked about the ring', "Haven't seen it. Haven't looked. Won't.", "If it's not stuck to the floor, it's not my problem.", 'Ask the woman you were hanging off. I was busy cleaning up after you.'),
    cue('Asked about the redhead', 'Red hair. Smart. Way too patient with him.', 'Check your phone. You were very proud of something you typed into it.', 'She left before the dancing. Smart woman.'),
    cue('Pushed or threatened', 'I already called the owner.', "(Backs toward the phone.) He's on his way. You really want to be standing here when he walks in?", "Whatever you're looking for, find it quickly."),
    cue('Getting rid of them', "You shouldn't stay long.", "Door's that way. It's the one still on its hinges.", 'Last orders. For you lot, that was last night.'),
  ],
  norton: [
    cue('First approach', "I don't know you. I barely know me right now.", "Do I know you? ...Don't answer that. I can't take another surprise today.", '(He looks up slowly, like even that costs him something.) Yeah?'),
    cue('Asked his name', "It's... give me a second. It's right there.", "Pick one. I'll answer to it.", 'I had it this morning. I think. Is it still morning?'),
    cue('Asked about last night', 'Why does everyone keep asking me about last night?', 'I barely remember getting here.', "I remember the door. Then this stool. That's it. That's everything."),
    cue('Asked about the ring', "If I knew what happened, I would tell you so you'd stop talking to me.", "I can't find my own name. You think I'm keeping track of your jewelry?", 'No ring. Nobody gives me rings. Nobody gives me anything.'),
    cue(
      'Pushed too far',
      'Can I go back to staring at this drink? It was going great.',
      'Every question you ask, I get a little more tired. And I started at zero.',
      "(Snaps.) I don't KNOW. Look at me. Do I look like a man who knows things?",
    ),
    cue('On the docks, after the arrow', 'Why am I on a dock? Why is there an arrow in me?', 'Okay. Okay. I can feel my teeth. Is that normal?', "Bombs? Why would I know anything about bomb... oh. Oh, I do. That's worse."),
  ],
  antinous: [
    cue('Spotting Flynn', 'Well. Spider-Man survived the night.', 'You actually got her number?', 'Keep the mask on. It may be helping.'),
    cue('Wanting the number', "Give me the number and I'll consider last night forgiven.", "You don't remember her? That's somehow worse. Give me the number.", "She's wasted on a man who keeps his face in his pocket."),
    cue('Out of his league', 'Out of your league, Spider-Man. Way, way out.', "I'm trying to understand what she saw in you.", 'She laughed at your jokes. Out of pity, I assume, but still.'),
    cue('Asked about the ring', 'Your ring? I was busy watching a woman make a terrible decision.', "If I'd seen a ring, I'd be wearing it.", "No idea. But I'll trade you a guess for the number."),
    cue('If it turns into a fight', "(Draws the sword, bored.) Let's make this quick. I have a number to get.", "You'd fight me over a phone number you can't even remember?", 'Suitors! Somebody hold my drink.'),
    cue('Losing', 'Fine! Keep her. She was too smart for both of us anyway.', "This isn't over. This is a pause.", 'Not the face! I need the face!'),
  ],
  'suitor-bow': [
    cue('Piling on', 'She was definitely too good for him.', 'She was out of your league even before the vomit mask.', 'Do you think she knew what his face looked like?'),
    cue('Stirring it up', 'Ask him about the masks.', '(Laughing too hard.) Antinous, tell them the one about the turtle!', 'Should I get the bow? I feel like I should get the bow.'),
    cue('On his own', 'I was just standing here. Behind him. Supportively.', 'Hey, I only laugh. He does the talking.', '(Lowers the bow.) Nobody said anything about consequences.'),
  ],
  'suitor-shield': [
    cue('Backing Antinous', "He's not giving you the number.", 'Then take it.', '(Taps the shield with the dagger, grinning.)'),
    cue('Losing patience', 'This is getting embarrassing.', 'Say the word, Antinous.', '(Steps closer than necessary. Breathes through his nose.)'),
    cue('Folding', "(The moment Antinous backs off, so does he.) ...We're good.", "I don't even know her.", '(Drops the dagger, picks it back up, thinks better of it.)'),
  ],
  nerissa: [
    cue('Seeing Alex', 'No.', 'I remember you.', '(Turns her whole body away, wings first.)'),
    cue('Alex tries again', 'Still no.', 'Stop looking at my wings.', 'You asked if they were detachable. Twice.'),
    cue(
      'Anyone else asks',
      "I don't know anything about the ring, and even if I did, I would tell someone else.",
      'Ask literally anyone else.',
      'Your friend in the booster seat was the only gentleman here last night.',
    ),
    cue('Leaving', "I'm leaving. Don't follow me.", "If he starts floating after me, I'm calling someone.", '(Flutters to the far end of the bar.)'),
  ],
  'michael-pearson': [
    cue(
      'Walking in',
      'Gentlemen. And... whatever you are.',
      "Please, sit. Standing makes everyone nervous, and nervous people break things. As we've established.",
      'You owe me five hundred. I am giving you the rare opportunity to decide whether the payment is financial.',
    ),
    cue('The damage', 'The floor did not damage itself.', "Your large white friend danced through my floor. To NSYNC. I've watched the security footage. Twice.", "I had that floor imported. I'd like it un-danced-on."),
    cue(
      'Negotiating',
      'I am offering you the civilized version of this conversation first.',
      "You have three hundred and fifty. So I assume you're about to become creative.",
      'That answer cost you the remaining fifty. Try again.',
    ),
    cue('A deal is struck', 'Now that is a civilized answer.', 'Done. Ray, write it down.', 'You see? Nobody had to bleed on my new floor.'),
    cue('If they fight', 'Pity. I liked this table.', 'Ray.', "Mind the floor. It's had a difficult week."),
    cue('Losing', "(Straightens his jacket.) Let's call it even. For today.", "You've made an enemy of a patient man. That's rarely a short story.", "Keep the change. I'll remember the faces. The ones I can see."),
  ],
  ray: [
    cue('Opening', "Let's not make this longer than it needs to be.", "He's asking nicely.", 'Hands where I can see them. All of them. Yes, yours too.'),
    cue('Reading the room', 'That was the wrong pocket to reach into.', "The turtle's the dangerous one. Watch the turtle.", "Mr. Pearson is being very generous. I'd take the deal."),
    cue('If it goes bad', '(Draws, calmly.) Last chance to be sensible.', 'Coach. Left side.', '(Says nothing. Fires once. Reloads.)'),
  ],
  coach: [
    cue('Trying to calm it down', 'We can just pay for the floor, lads.', "I really don't want to do this in the pub.", "Lads. It's a bar bill, not a war. Don't make it a war."),
    cue("It's a fight", "Right. Fine. We're doing this.", 'Who taught the turtle to fight?', "My missus is doing a roast tonight. Let's be quick."),
    cue('Taking a hit', "Ow. Right. That's fair.", "That's a radish. I've been hit by a radish.", 'I told you. I told you lot. Pay for the floor.'),
  ],

  // ── Louise and the heptapods ────────────────────────────
  louise: [
    cue(
      'Answering the call',
      'You finally called. I was starting to think the masks were doing all the confidence for you.',
      "Well. The man of many faces. I wondered if you'd remember me.",
      'Flynn. Which version of you is calling?',
    ),
    cue('Flirting', 'You were very confident last night for a man who never showed his face.', 'I have something else that could go on your face.', "You told me Spider-Man was your good side. I'm still deciding."),
    cue('When he asks about the ring', "Oh. You're calling about a ring.", 'I was hoping you called because you remembered me.', 'A wedding ring. Of course. The good ones are always getting married tomorrow.'),
    cue(
      'Pointing the way',
      'I might know someone who can help.',
      'I know someone who experiences answers differently. Come alone if you want. Bring your friends if you have to.',
      "I'm sending you an address. Don't be late. They already know when you'll get there.",
    ),
    cue('At the craft', 'You get three questions. Think before you use them.', 'Try not to ask them anything you could Google.', "Don't touch the glass. They don't mind. I do."),
    cue('A wasted question, or trouble', 'That was one of your three. I hope it was worth it.', "And that's the end of that. (She steps between them and the glass.)", "They're not angry. They already know how this goes."),
  ],
  abbott: [
    cue(
      'When they enter',
      '(Abbott drifts closer to the glass, perfectly still.)',
      '(A deep pulse of sound. It feels like being looked at from next week.)',
      '(Abbott presses a limb to the glass. Ink blooms into a ring and slowly fades.)',
    ),
    cue('A question is spent', '(A low, resonant hum. A question has been spent.)', '(Ink spreads into a closed circle. One segment fades.)', '(Abbott lowers a limb. One fewer.)'),
    cue('The audience ends', '(Abbott drifts back into the haze. The audience is over.)', "(The glass fogs from the inside. When it clears, they're gone.)", '(A final, gentle hum, like a door closing in another room.)'),
  ],
  costello: [
    cue(
      'Who took the ring?',
      'The man who records what should not be recorded already wears what was yours.',
      'The man who records has already taken it.',
      'He films what others look away from. He has it. He had it before you lost it.',
    ),
    cue('Where is it?', 'You meet the ring again beneath false sunlight in Hollywood.', 'You arrive in the bright city after he has prepared for you.', 'West. Where the sun is made of lamps.'),
    cue('Are we safe?', 'You are dead there. Most of you are speaking anyway.', 'Some of you are already ghosts there. You are laughing about it.', 'Everyone falls in the bright city. Not everyone stays down.'),
    cue('How do we get it back?', 'Out of the closet without a face.', 'You ask this because you have not yet understood the mask.', '(Ink forms a face, then wipes itself blank.) Out of the closet without a face.'),
    cue('Anything else', 'That question was already answered. You were not listening yet.', 'You already know. You learn it later.', 'You will ask that again in Hollywood. The answer does not change.'),
  ],

  // ── The road ────────────────────────────────────────────
  tyler: [
    cue('Showing up', 'Bar friends! Look at you. I feel incredible. Never better.', "You look like you've seen a ghost. Not yet. Give it an hour.", 'Going somewhere?'),
    cue('The favor', "Lou beat me. I owe him one. You're the one.", 'Lou and I are in a club. He won. I pay my debts.', "It's nothing personal. It's a favor. Personal would be worse."),
    cue('The deal', "Beat me one on one and I'll disarm the bombs.", 'If you want the boats, earn them.', "You brought masks to a fist fight. That's interesting.", 'Win and maybe you fly. Maybe.'),
    cue('Mid-fight', 'Hit me. Come on. As hard as you can.', "How much can you know about yourself if you've never been in a fight?", 'Take the mask off. Fight me with your own face.'),
    cue(
      'Win or lose',
      'You keep assuming winning means I have to keep my word.',
      "You won the fight. You didn't win an airplane.",
      '(Grins through the blood.) That was beautiful. (Presses the detonator anyway.)',
    ),
  ],
  'goon-crowbar': goon(cue('Fighting', '(Taps the crowbar on a propeller. Clang.) Come on, then.', 'Open wide.', "Doors, crates, kneecaps. Crowbar's very versatile.")),
  'goon-sledgehammer': goon(cue('Fighting', '(Mostly grunts and short threats.)', '(Drags the sledgehammer along the tarmac. Sparks.)', 'Hold. Still.')),
  'goon-machete': goon(cue('Fighting', 'Come closer.', '(Twitches. Laughs at nothing. Twitches again.)', 'Closer. Closer. Perfect.')),
  'goon-chainsaw': goon(cue('Fighting', '(Lets the chainsaw do most of the talking.)', '(Revs it. Revs it again. Poses.)', 'Somebody film this!')),
  'goon-taser': goon(cue('Fighting', '(Talks bravely from the back.)', "Get 'em, guys! I've got your back. Way back.", "I'll zap you! From over here!", '(Zaps the air. Zaps it again, for confidence.)')),
  odysseus: [
    cue(
      'Offering a ride',
      'California is west. Eventually.',
      "We sail for the premiere of Anne Hathaway's new film. You may come. Touch nothing.",
      'Get on the boat before I change my mind.',
      "I've been lost longer than you've been married, which apparently is not at all. Get on the boat.",
    ),
    cue('Sizing up the party', 'I have sailed with worse men. Not many.', "A turtle, a radish and a man in a mask. I've had stranger crews. Not recently.", 'The turtle can stay.'),
    cue('At sea', 'If any of you vomit into the wind, I am leaving you behind.', "Island ahead. Where there's an island there's food. And usually a monster.", "I once took ten years to get home. I'd like this trip to be shorter."),
    cue('The duel on the docks', '(Nocks an arrow without looking away from the fight.) Keep going, groom.', 'That man owes someone a favor. I owe him an arrow.', '(After the shot.) He was taking too long.'),
    cue('The box and the head', 'Do not look at it. Whatever it is, it was put in a box for a reason.', 'Men! Eyes on your feet!', 'A box. Why is it always a box.'),
  ],
  'odysseus-crew': [
    cue('Meeting the party', "These are the men we're taking?", 'Which one is the groom?', 'Why is the radish armed?'),
    cue('On board', 'Captain, I am asking respectfully: why?', 'Captain says row, we row.', 'Has anyone checked whether the turtle can swim?'),
    cue('On the island', '(Five men look at the floor at once.)', "I'm not opening it. I've seen what's usually in boxes.", "Captain, the bald man is smiling. I don't like it when they smile."),
  ],

  // ── The island ──────────────────────────────────────────
  'john-doe': [
    cue('Welcome', 'You came here because you were hungry.', 'There is plenty of food on this island. First, a question.', 'Welcome. Take your time. Nobody here is in a hurry. Except you.'),
    cue('The box', "What's in the box?", 'Someone opens it. Then we continue.', 'Curiosity is hunger with better manners.'),
    cue('About Lou', 'Lou understood the value of protection.', 'Lou stopped by too. In return for protection, he gave John head.', 'Your friend with the camera was very polite. He paid in advance.'),
    cue('If they refuse', "Then nobody eats. I can wait. I'm very good at waiting.", "You'll open it. People always do.", "Refusing is also an answer. It just isn't very filling."),
    cue('Facing a masked Flynn', "Interesting. You aren't looking at her. You're looking at me.", "A man who hides his face, protected by a face. That's almost poetic.", '(He holds the head up like a lantern.) Look.'),
  ],
  medusa: [
    cue('The lid lifts', '(A wet hiss. Every snake turns toward whoever just looked up.)', 'Look at me.', '(Inside the box, something breathes.)'),
    cue('Someone looks her way', "(The snakes go silent all at once. That's worse.)", 'Look... at... me.', '(A cold grinding sound, like stone settling.)'),
    cue('Someone turns to stone', '(The color drains from their feet upward.)', '(A soft crackle, like frost spreading on glass.)', '(Their last expression stays exactly where it was.)'),
  ],
  'david-frame': [
    cue(
      'The reunion',
      "Flynn, is that you? Still wearing masks huh? It's been awhile man, how come you haven't reached out? I've been wanting to show you some new tricks I've learned.",
      'You never call.',
      "Flynn! Buddy! (Drops a knife.) Sorry, that one's not new.",
    ),
    cue('The knives', 'You still collect them?', 'I brought options.', 'Thirty-one. I counted on the way here. Thirty-two with the one in my boot.'),
    cue('Fighting', 'Hold still. This one is new.', 'No, no, watch. Watch the wrist.', 'Everybody else back up. This is between me and Flynn.'),
    cue('Losing', 'Okay. Okay. Same time next year?', "You didn't even let me show you the last one.", '(Genuinely hurt.) You never call.'),
  ],
  'gladiator-1': gladiator,
  'gladiator-2': gladiator,
  'gladiator-3': gladiator,
  'ted-terger': [
    cue('Walking in', "Don't touch the money.", 'Everything in here belongs to me.', "Shoes off. That rug's worth more than your wedding."),
    cue('Haggling', "If you're not buying, you're stealing.", "You have no idea what that's worth.", 'You want a drink? Pay for it like everybody else.'),
    cue('Bribed or distracted', '...How much is that worth?', 'Put it on the table. Slowly.', "Okay. I'm listening. I'm not agreeing, I'm listening."),
    cue('Fighting', '(Throws a beer bottle.) That one was imported!', "That's coming out of your deposit!", 'Get away from the cases!'),
  ],
  truman: [
    cue('Spotting the party', 'You can leave?', "Good morning, and in case I don't see ya, good afternoon, good evening, and good night!", 'Strangers! Real ones? Are you real?'),
    cue('Asking about outside', 'Hollywood is real, right? Like actually real?', "What's California actually like?", 'Is the sky out there painted too? You can tell me.'),
    cue('Wanting out', 'You have a boat?', "I don't want your money. I want the door.", "Please don't lock it behind you."),
    cue('Let go', "(He's already halfway to the docks.) Thank you! I'll send a postcard!", "I'm going to see the whole world. Starting with your boat.", 'If anyone asks, I was never here. Nobody ever asks.'),
  ],
  kingpin: [
    cue('Flynn in the Spider-Man mask', 'Spider-Man.', 'Take that mask off.', 'You walked into the wrong room wearing the wrong face.'),
    cue('Any other mask', '(Stares. Grunts. Goes back to what he was doing.)', 'Not interested.', '(Looks Flynn up and down, then at the door. Dismissed.)'),
    cue('Switching to Spider-Man inside', '(The table in his hands bends.) SPIDER-MAN.', "I don't care who you are underneath it.", 'Every time. EVERY TIME.'),
    cue('Losing the thread', '...Where did he go?', '(Awkward silence. He sits back down, unsure what just happened.)', 'Get out. Before I remember.'),
  ],
  cypher: [
    cue('Walking in', 'You people look exhausted. Sit down.', 'Shh. Couch is taken. That one too.', "Don't. Whatever you're about to ask me, don't."),
    cue('The pills', "I don't want to take any pills.", "Red, blue, I don't care. I'm not taking anything.", 'Is that a pill? Is that a PILL? (Fires immediately.)'),
    cue('Complaining', 'I am done choosing things.', 'Truth is a lot of work.', 'Ignorance is bliss.'),
    cue('Fighting', 'You can save the world after lunch.', '(Fires the lightning rifle without getting up.)', "This is why I don't have visitors."),
  ],
  baron: [
    cue('Welcome', 'You came all this way because you were hungry.', 'Look at you. Starving in a room full of food.', 'Please. Come in. Mind the oil.'),
    cue('Taunting', 'Then eat.', 'If you can.', 'Need is such an ugly thing.'),
    cue('Sending the guards', 'Feyd. Rabban. Our guests look hungry.', 'Feed them. To each other, if necessary.', 'Rabban, the turtle. Feyd, the one in the mask.'),
    cue('Losing', '(Sinks lower into the oil.) This is... unseemly.', 'Rabban! RABBAN!', 'Take the food. Take all of it. Just stop splashing.'),
  ],
  feyd: [
    cue('Picking a fight', 'Finally. Someone worth bleeding for.', "Don't run yet.", '(Spins the knife and smiles at whoever looks most dangerous.)'),
    cue("When he's hurt", 'Again.', "That's better.", '(Smiles wider every time he bleeds.)'),
    cue('Winning or losing', "I thought you'd be harder to kill.", '(Bows mid-fight.) Again. Properly this time.', '(Down, laughing.) Good. Very good.'),
  ],
  rabban: [
    cue('Charging', 'Move.', 'Enough talk.', "I'll break the turtle first."),
    cue('Chasing', 'Stop running.', 'Stay down.', '(Throws a table out of the way. Then another.)'),
    cue("When he's hurt", '(Roars.)', "That's all you have?", '(Gets up. Slower this time.)'),
  ],

  // ── Hollywood ───────────────────────────────────────────
  'nathan-fielder': [
    cue('Greeting them', "Hi. Welcome to Hollywood. I'm Nathan. I'm... glad you're here.", "So. You're probably wondering about the cameras.", "(Long pause.) Okay. Great. Let's, um. Let's get started."),
    cue(
      'The documentary',
      'So there was a misunderstanding where I thought we were making a documentary and Lou thought we were making evidence.',
      'There was a misunderstanding about the scope of the documentary.',
      'I thought the deaths were metaphorical.',
    ),
    cue(
      'About Lou',
      'I am technically also being held hostage, although I did sign a release.',
      'Lou has a very clear vision. It just has more murder in it than I pitched.',
      "I'd describe our working relationship as hostile, but well lit.",
    ),
    cue(
      'Asked for help',
      'I can help. Within reason. And within what Lou told me not to do, which is most things.',
      '(He stares at the laptop. He stares at you. He closes the laptop.)',
      'I do have a plan. It needs about eleven weeks of rehearsal.',
    ),
    cue('Right before the needles', 'The cameras are not mine anymore.', "I'm going to step to the side now. For, um. Lighting.", 'I thought there would be more consent paperwork before the deaths.'),
  ],
  'camera-crew': [
    cue('Approaching', '(Mostly silence. The red record light blinks.)', 'Just act natural.', 'Could you all move a little to your left? Thanks.'),
    cue('Firing the needles', 'Sorry.', "It's not personal.", "We were told you'd resist."),
  ],
  lou: [
    cue(
      'On the video',
      'You kept giving me better material than I could have directed.',
      'Five friends crossing the world for a wedding ring is already a story. Five friends dying for it is a market.',
      "I'll be honest with you, because honesty tests well.",
      'You have no idea how difficult it is to produce authenticity.',
    ),
    cue('They wake in the studio', 'Two hours. I had to shoot inserts while you were unconscious.', "Continuity matters. That's why I let you keep the weapons.", 'Wake up. Please. Every minute you lie there costs me money.'),
    cue(
      'Introducing the next fight',
      'I want you to meet an old boyfriend of mine.',
      "You'll like this next one. Audiences love an animal.",
      'Something for the second act. Try to look surprised.',
      'You came all this way. Give me something worth filming.',
    ),
    cue('Wearing the fourth mask', "You'll never guess where I got this from.", "I didn't steal the night from you. I preserved it.", 'It suits me better than it ever suited you.'),
    cue('If Flynn takes off his mask', 'Take the mask off if you want me to believe you.', "(A long pause. For the first time, he isn't looking at a camera.)", "That... isn't in the script."),
    cue('The showdown', 'The ring was never the interesting part.', "I didn't ruin the story. I improved the ending.", "Fine. Then let's give them a real ending."),
  ],
  'oh-dae-su': [
    cue('Walking in', '(He smiles. He keeps walking.)', 'Come on.', '(Rolls his neck and lifts the hammer. No hurry.)'),
    cue('Fighting', "Who's next?", "Don't make me chase you.", 'Again.'),
    cue("When he's hurt", 'Laugh, and the world laughs with you. Weep, and you weep alone.', '(Bleeding, he laughs. He keeps coming.)', 'Fifteen years. You think this hurts?'),
  ],
  toothless: [
    cue('Arrival', '(A low warble, then the rising whine of a plasma blast charging.)', '(Two green eyes open in the LED sky.)', '(Wings flare wide.)'),
    cue('Hunting', '(He tilts his head like a curious cat, a second before the dive.)', '(A growl, then sudden stillness.)', '(He lands on the lighting rig above them. It sways.)'),
    cue('Hurt or startled', '(Recoils from a bright light or a loud noise.)', '(A pained shriek. He beats back to Far Away.)', '(Ears flatten. For a second he looks more scared than angry.)'),
    cue('If someone tries to calm him', "(Sniffs an outstretched hand. Doesn't bite. Yet.)", '(A confused, rumbling purr.)', "(He looks at Lou's face on the screen, then back at them.)"),
  ],
  cat: [
    cue('Entrance', 'Well. This set is a mess.', 'Too many people in the shot.', 'Hello! Hello! Did somebody order a cleanup?'),
    cue('Wiping the party', "Let's clean this up.", 'Oh, do not frown and do not fuss. It is only a game, and the game is us!', 'One for you, and two for you, and none for you, and you, and you!'),
    cue('When something hits him', "You can't kill a cat with a hat like this.", '(Folds flat like paper, then pops back up.) Again! Again!', 'Ooh, that tickles!'),
    cue('Exit', 'Much better. One groom. Cleaner composition.', '(Bows. The hat bows separately.)', 'Toodle-oo! Do tidy up!'),
  ],
  things: [
    cue("Thing 1 and Thing 2's gags", "(They finish each other's cartwheels.)", '(Two identical giggles from two directions at once.)', '(They unfurl a giant net, then a smaller net, for later.)'),
  ],
};
