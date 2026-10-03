/* =====================================================================
 * MISSION DATA — every mission is a plain configuration object.
 * Change stories, clues, solutions and rewards here without touching
 * any code. To add a mission, append an object to VR.MISSIONS.
 *
 * TEXT IS BILINGUAL: any text field may be a plain string or
 * { en: '…', ar: '…' }. The game shows the player's chosen language
 * (Settings → Language), including the writing on walls and signs.
 * Mission puzzles never depend on the language: solutions are symbols,
 * and a row of symbols is read in the language's own direction.
 *
 * Fields
 *   id, order, name, environment (key in VR.MissionEnvironments)
 *   intro           short story shown on entry (never the solution)
 *   objective       main objective (one line)
 *   objectives      ordered steps: { text, done: flag | [flags] }
 *   secondary       optional: { id, text, type: collect|time|noMistakes|flag, …, reward }
 *   success         flag that completes the mission
 *   timeLimit       optional seconds; running out = mission failed
 *   rewards         first completion: { score, coins }
 *   repeatable / repeatReward   explicit reward for replays
 *   requires        mission ids that must be completed first (unlocks)
 *   hints           revealed one at a time from the journal
 *   entities        world objects, each placed `at` an environment anchor:
 *       text · item · prop · symbolLock · soundObject · buttonPanel ·
 *       compartment · generator · lever · gate · zone · powerLights
 *   rules           optional extra logic: { when: [flags], set: flag, say }
 *
 * Text can include puzzle symbols: {lemon} {moon} {leaf} {star} {sun} {drop}
 * ===================================================================== */
(function () {
  const HIDDEN_LEMON = { en: 'Hidden lemon', ar: 'ليمونة مخبّأة' };

  VR.MISSIONS = [
    // ===================================================================
    {
      id: 'm1', order: 1,
      name: { en: 'The Wall Message', ar: 'رسالة الجدار' },
      environment: 'cellar',
      intro: {
        en: 'The gate dropped you into an old cellar below the railway. Somebody locked a Golden Lemon away down here and left a message for whoever came next.',
        ar: 'أسقطتك البوابة في قبو قديم تحت سكة القطار. أحدهم أقفل على ليمونة ذهبية هنا وترك رسالة لمن يأتي بعده.',
      },
      objective: { en: 'Find the Golden Lemon', ar: 'اعثر على الليمونة الذهبية' },
      objectives: [
        { text: { en: 'Read the message on the wall', ar: 'اقرأ الرسالة على الجدار' }, done: 'read_wallMessage' },
        { text: { en: 'Find the hidden clue', ar: 'اعثر على الدليل المخبّأ' }, done: 'read_darkClue' },
        { text: { en: 'Open the locked chest', ar: 'افتح الصندوق المقفل' }, done: 'chest_open' },
        { text: { en: 'Take the Golden Lemon', ar: 'خذ الليمونة الذهبية' }, done: 'got_golden_lemon' },
      ],
      secondary: [
        { id: 'lemons', text: { en: 'Find 3 hidden lemons', ar: 'اعثر على 3 ليمونات مخبّأة' }, type: 'collect', prefix: 'bonus_', count: 3, reward: { coins: 15 } },
      ],
      success: 'got_golden_lemon',
      rewards: { score: 1500, coins: 50 },
      repeatable: true, repeatReward: { score: 300 },
      requires: [],
      hints: [
        { en: 'Most of this cellar is lit. Look for the part that the lamps cannot reach.', ar: 'معظم القبو مضاء. ابحث عن الجزء الذي لا تصله المصابيح.' },
        { en: 'The shelf wall on the east side has a low gap. Crouch (C) or slide to get through it.', ar: 'في جدار الرفوف من الجهة الشرقية فتحة منخفضة. انحنِ (C) أو انزلق لتعبر منها.' },
        { en: 'Glow paint only shows up in the dark.', ar: 'الطلاء المضيء لا يظهر إلا في العتمة.' },
      ],
      entities: [
        { id: 'wallMessage', type: 'text', at: 'wallMessage', style: 'redpaint', size: 0.36, width: 6.6,
          title: { en: 'Message on the wall', ar: 'الرسالة على الجدار' },
          text: { en: 'THE ANSWER IS HIDDEN WHERE THE LIGHT NEVER REACHES.', ar: 'الجواب مخبّأ حيث لا يصل الضوء أبدًا.' } },
        { id: 'chestNote', type: 'text', at: 'chestNote', style: 'paper', size: 0.075, width: 0.95,
          title: { en: 'Note above the chest', ar: 'ورقة فوق الصندوق' },
          text: { en: 'The lock remembers three signs.\nIt forgets the rest.', ar: 'القفل يتذكّر ثلاث علامات.\nوينسى الباقي.' } },
        { id: 'gapSign', type: 'text', at: 'gapSign', style: 'stencil', size: 0.13, width: 1.5, inspect: false,
          text: { en: 'MIND YOUR HEAD', ar: 'انتبه لرأسك' } },
        { id: 'darkClue', type: 'text', at: 'darkCorner', style: 'glow', size: 0.42, width: 2.4,
          title: { en: 'Glowing signs in the dark corner', ar: 'علامات مضيئة في الزاوية المظلمة' }, text: '{moon} {lemon} {leaf}' },
        { id: 'chest', type: 'symbolLock', at: 'chest', name: { en: 'Locked chest', ar: 'صندوق مقفل' },
          symbols: ['lemon', 'moon', 'leaf', 'star', 'sun', 'drop'], solution: ['moon', 'lemon', 'leaf'], opens: 'chest_open',
          lockText: { en: 'Three dials. Each shows a sign.', ar: 'ثلاثة أقراص. كل قرص يُظهر علامة.' } },
        { id: 'golden', type: 'item', at: 'chest', offset: [0, 0.5, 0], item: 'golden_lemon', name: { en: 'Golden Lemon', ar: 'الليمونة الذهبية' }, model: 'goldenLemon',
          showWhen: 'chest_open' },
        { id: 'bonus_1', type: 'item', at: 'bonusTop', name: HIDDEN_LEMON, model: 'smallLemon', bonus: true, spin: false },
        { id: 'bonus_2', type: 'item', at: 'bonusDark', name: HIDDEN_LEMON, model: 'smallLemon', bonus: true, spin: false },
        { id: 'bonus_3', type: 'item', at: 'bonusShelf', name: HIDDEN_LEMON, model: 'smallLemon', bonus: true, spin: false },
      ],
    },

    // ===================================================================
    {
      id: 'm2', order: 2,
      name: { en: 'The Three Messages', ar: 'الرسائل الثلاث' },
      environment: 'office',
      intro: {
        en: 'The stationmaster hid the Silver Lemon Seal somewhere in this office. Three messages were left behind. Each one is only part of the instructions.',
        ar: 'خبّأ ناظر المحطة ختم الليمونة الفضية في مكان ما في هذا المكتب. تُركت ثلاث رسائل، وكل واحدة منها جزء فقط من التعليمات.',
      },
      objective: { en: 'Find the Silver Lemon Seal', ar: 'اعثر على ختم الليمونة الفضية' },
      objectives: [
        { text: { en: 'Read all three messages', ar: 'اقرأ الرسائل الثلاث' }, done: ['read_msgA', 'read_msgB', 'read_msgC'] },
        { text: { en: 'Find the next clue', ar: 'اعثر على الدليل التالي' }, done: 'read_noteTrue' },
        { text: { en: 'Enter the sequence on the panel', ar: 'أدخل التسلسل في اللوحة' }, done: 'panel_solved' },
        { text: { en: 'Take the Silver Lemon Seal', ar: 'خذ ختم الليمونة الفضية' }, done: 'got_silver_seal' },
      ],
      secondary: [
        { id: 'clean', text: { en: 'Solve it without a mistake', ar: 'حُلّها دون أي خطأ' }, type: 'noMistakes', reward: { coins: 20 } },
      ],
      success: 'got_silver_seal',
      rewards: { score: 2000, coins: 60 },
      repeatable: true, repeatReward: { score: 400 },
      requires: ['m1'],
      hints: [
        { en: 'Pick up every object on the numbered shelf and listen to it.', ar: 'التقط كل غرض على الرف المرقّم واستمع إليه.' },
        { en: 'Two objects make no sound at all. One of the messages tells you which one to ignore.', ar: 'غرضان لا يصدران أي صوت. إحدى الرسائل تخبرك أيّهما تتجاهل.' },
        { en: 'The note gives signs and numbers. Press the signs in the order they are written, not in number order.', ar: 'الورقة فيها علامات وأرقام. اضغط العلامات بالترتيب الذي كُتبت به، لا بترتيب الأرقام.' },
      ],
      entities: [
        { id: 'msgA', type: 'text', at: 'msgA', style: 'paint', size: 0.24, width: 4.4,
          title: { en: 'Message A (west wall)', ar: 'الرسالة أ (الجدار الغربي)' },
          text: { en: 'WHAT YOU SEEK IS NOT IN THE FIRST PLACE.', ar: 'ما تبحث عنه ليس في المكان الأول.' } },
        { id: 'msgB', type: 'text', at: 'msgB', style: 'chalk', size: 0.15, width: 2.6,
          title: { en: 'Message B (chalkboard)', ar: 'الرسالة ب (السبّورة)' },
          text: { en: 'THE QUIETEST OBJECT HIDES THE NEXT CLUE.', ar: 'أهدأ غرض يخبّئ الدليل التالي.' } },
        { id: 'msgC', type: 'text', at: 'msgC', style: 'paper', size: 0.1, width: 1.3,
          title: { en: 'Message C (pinned note)', ar: 'الرسالة ج (ورقة مثبّتة)' },
          text: { en: 'FOLLOW THE ORDER,\nNOT THE NUMBERS.', ar: 'اتبع الترتيب،\nلا الأرقام.' } },
        // numbered places on the shelf
        ...[1, 2, 3, 4, 5].map(n => ({ id: 'plaque' + n, type: 'prop', at: 'plaque' + n, model: 'plaque', modelArgs: [n] })),
        // five objects; two of them are silent
        { id: 'obj1', type: 'soundObject', at: 'place1', model: 'mantelClock', modelArgs: [0xf2ecd8, 0x3a2a1a, true],
          name: { en: 'Stopped clock (place 1)', ar: 'ساعة متوقفة (المكان 1)' },
          sound: 'silence', caption: { en: '[silence: this clock has stopped]', ar: '[صمت: هذه الساعة متوقفة]' }, reveals: 'found_note1' },
        { id: 'obj2', type: 'soundObject', at: 'place2', model: 'mantelClock', modelArgs: [0xffffff, 0x8a5a33, false],
          name: { en: 'Mantel clock (place 2)', ar: 'ساعة رف (المكان 2)' },
          sound: 'tick', caption: { en: '[tick… tick… tick… a steady ticking]', ar: '[تك… تك… تك… تكتكة منتظمة]' } },
        { id: 'obj3', type: 'soundObject', at: 'place3', model: 'radio', name: { en: 'Radio (place 3)', ar: 'راديو (المكان 3)' },
          sound: 'radio', caption: { en: '[loud crackling static]', ar: '[تشويش عالٍ ومتقطّع]' } },
        { id: 'obj4', type: 'soundObject', at: 'place4', model: 'musicBox', name: { en: 'Music box (place 4)', ar: 'صندوق موسيقى (المكان 4)' },
          sound: 'silence', caption: { en: '[silence: the music box has no key]', ar: '[صمت: صندوق الموسيقى بلا مفتاح]' }, reveals: 'found_note4' },
        { id: 'obj5', type: 'soundObject', at: 'place5', model: 'deskBell', name: { en: 'Desk bell (place 5)', ar: 'جرس مكتب (المكان 5)' },
          sound: 'bell', caption: { en: '[DING! a bright ring]', ar: '[دينغ! رنّة واضحة]' } },
        // the two hidden notes: only one is the real clue
        { id: 'noteDecoy', type: 'text', at: 'place1', offset: [0, 0.006, 0.05], flat: true, style: 'paper', size: 0.05, width: 0.42,
          showWhen: 'found_note1', title: { en: 'Note under the stopped clock (place 1)', ar: 'ورقة تحت الساعة المتوقفة (المكان 1)' },
          text: '{sun} 1  {leaf} 2\n{moon} 3  {drop} 4' },
        { id: 'noteTrue', type: 'text', at: 'place4', offset: [0, 0.006, 0.05], flat: true, style: 'paper', size: 0.05, width: 0.42,
          showWhen: 'found_note4', title: { en: 'Note under the music box (place 4)', ar: 'ورقة تحت صندوق الموسيقى (المكان 4)' },
          text: '{lemon} 4  {moon} 2\n{leaf} 3  {star} 1' },
        { id: 'panel', type: 'buttonPanel', at: 'panel', symbols: ['sun', 'lemon', 'drop', 'moon', 'star', 'leaf'],
          solution: ['lemon', 'moon', 'leaf', 'star'], flag: 'panel_solved' },
        { id: 'compartment', type: 'compartment', at: 'compartment', openWhen: 'panel_solved', name: { en: 'Plaster wall panel', ar: 'لوح جبس في الجدار' } },
        { id: 'seal', type: 'item', at: 'compartmentItem', item: 'silver_seal', name: { en: 'Silver Lemon Seal', ar: 'ختم الليمونة الفضية' },
          model: 'goldenLemon', modelArgs: [true], showWhen: 'panel_solved' },
      ],
    },

    // ===================================================================
    {
      id: 'm3', order: 3,
      name: { en: 'Restore the Power', ar: 'أعِد الكهرباء' },
      environment: 'docks',
      intro: {
        en: 'A night-time container yard by the sea. The exit gate has no power, and three parts are missing from the generator. Find them and put each one in its proper place.',
        ar: 'ساحة حاويات ليلية على البحر. بوابة الخروج بلا كهرباء، وثلاث قطع مفقودة من المولّد. اعثر عليها وضع كل قطعة في مكانها الصحيح.',
      },
      objective: { en: 'Restore the power and leave through the gate', ar: 'أعِد الكهرباء واخرج من البوابة' },
      objectives: [
        { text: { en: 'Find the fuse', ar: 'اعثر على الفيوز' }, done: 'got_fuse' },
        { text: { en: 'Find the copper coil', ar: 'اعثر على الملف النحاسي' }, done: 'got_coil' },
        { text: { en: 'Find the lemon cell', ar: 'اعثر على خلية الليمون' }, done: 'got_cell' },
        { text: { en: 'Install all three parts correctly', ar: 'ركّب القطع الثلاث بشكل صحيح' }, done: 'all_installed' },
        { text: { en: 'Pull the power lever', ar: 'اسحب ذراع الكهرباء' }, done: 'power_on' },
        { text: { en: 'Leave through the gate', ar: 'اخرج من البوابة' }, done: 'escaped' },
      ],
      secondary: [
        { id: 'fast', text: { en: 'Finish in under 3:00', ar: 'أنهِها في أقل من 3:00' }, type: 'time', seconds: 180, reward: { coins: 30 } },
      ],
      success: 'escaped',
      rewards: { score: 2500, coins: 80 },
      repeatable: true, repeatReward: { score: 500 },
      requires: ['m2'],
      achievement: 'electrician',
      hints: [
        { en: 'The generator has three sockets, from the gate side to the sea side. Signs around the yard say which part goes where.', ar: 'للمولّد ثلاثة مقابس، من جهة البوابة إلى جهة البحر. اللافتات في الساحة تقول أين توضع كل قطعة.' },
        { en: 'One part is high up on the red container stack. Climb the yellow ladder, or try a Lemon Burst (Q).', ar: 'إحدى القطع في أعلى كومة الحاويات الحمراء. اصعد السلّم الأصفر، أو جرّب قفزة الليمون (Q).' },
        { en: 'Follow the narrow corridor between the containers to the end.', ar: 'اتبع الممر الضيق بين الحاويات حتى نهايته.' },
      ],
      entities: [
        { id: 'arrival', type: 'text', at: 'arrivalNote', style: 'sign', size: 0.13, width: 2.6,
          title: { en: 'Yard notice', ar: 'إعلان الساحة' },
          text: { en: 'POWER FAILURE\nThe gate is locked. Three parts are missing from the generator.', ar: 'انقطاع الكهرباء\nالبوابة مقفلة. ثلاث قطع مفقودة من المولّد.' } },
        // gate side is on the viewer's left (west), sea side on the right (east)
        { id: 'genLabelGate', type: 'text', at: 'genLabel', offset: [-1.25, 0, 0], style: 'sign', size: 0.2, width: 1.7, inspect: false,
          text: { en: '◄ GATE SIDE', ar: 'جهة البوابة ◄' } },
        { id: 'genLabelSea', type: 'text', at: 'genLabel', offset: [1.25, 0, 0], style: 'sign', size: 0.2, width: 1.7, inspect: false,
          text: { en: 'SEA SIDE ►', ar: '► جهة البحر' } },
        { id: 'genNotice', type: 'text', at: 'genNotice', style: 'paper', size: 0.075, width: 1.6,
          title: { en: 'Generator notice', ar: 'ملاحظة المولّد' },
          text: { en: 'GENERATOR PARTS\nThe coil keeps the peace between the other two.', ar: 'قطع المولّد\nالملف النحاسي يصنع السلام بين القطعتين الأخريين.' } },
        { id: 'fuseClue', type: 'text', at: 'fuseClue', style: 'stencil', size: 0.32, width: 4.6,
          title: { en: 'Painted on a container', ar: 'مكتوب على حاوية' },
          text: { en: 'THE FUSE GUARDS THE GATE.', ar: 'الفيوز يحرس البوابة.' } },
        { id: 'seaClue', type: 'text', at: 'seaClue', style: 'sign', size: 0.12, width: 2.0,
          title: { en: 'Sign by the water', ar: 'لافتة عند الماء' },
          text: { en: 'THE LEMON CELL DRINKS FROM THE SEA.', ar: 'خلية الليمون تشرب من البحر.' } },
        { id: 'fuse', type: 'item', at: 'fuseSpot', item: 'fuse', name: { en: 'Fuse', ar: 'الفيوز' }, model: 'fuse', itemKind: 'component', float: 0.08 },
        { id: 'coil', type: 'item', at: 'coilSpot', item: 'coil', name: { en: 'Copper Coil', ar: 'الملف النحاسي' }, model: 'coil', itemKind: 'component', float: 0.08 },
        { id: 'cell', type: 'item', at: 'cellSpot', item: 'cell', name: { en: 'Lemon Cell', ar: 'خلية الليمون' }, model: 'lemonCell', itemKind: 'component', float: 0.1 },
        { id: 'generator', type: 'generator', at: 'generator', flag: 'all_installed', lockWhen: 'power_on',
          sockets: [
            { id: 's1', label: { en: 'the gate-side socket', ar: 'مقبس جهة البوابة' }, correct: 'fuse' },
            { id: 's2', label: { en: 'the middle socket', ar: 'المقبس الأوسط' }, correct: 'coil' },
            { id: 's3', label: { en: 'the sea-side socket', ar: 'مقبس جهة البحر' }, correct: 'cell' },
          ] },
        { id: 'lever', type: 'lever', at: 'lever', name: { en: 'Power lever', ar: 'ذراع الكهرباء' }, requires: 'all_installed', flag: 'power_on',
          failText: { en: 'The lever will not move. All three lamps on the generator must be green.', ar: 'الذراع لا يتحرّك. يجب أن تكون مصابيح المولّد الثلاثة خضراء.' },
          successText: { en: 'The generator roars to life. The gate is opening!', ar: 'هدر المولّد وعاد إلى الحياة. البوابة تُفتح!' } },
        { id: 'gate', type: 'gate', at: 'gate', openWhen: 'power_on', name: { en: 'Exit gate', ar: 'بوابة الخروج' },
          closedText: { en: 'The gate is locked and there is no power.', ar: 'البوابة مقفلة ولا توجد كهرباء.' } },
        { id: 'lights', type: 'powerLights', when: 'power_on' },
        { id: 'gateOpenSign', type: 'text', at: 'gateSign', style: 'sign', size: 0.2, width: 2.6, showWhen: 'power_on',
          title: { en: 'Gate sign', ar: 'لافتة البوابة' }, text: { en: 'GATE OPEN', ar: 'البوابة مفتوحة' } },
        { id: 'exit', type: 'zone', at: 'exitZone', size: [7, 4, 7], requires: 'power_on', flag: 'escaped' },
      ],
    },

    // ===================================================================
    // MISSION 4 — the clue comes from the channel video «المفكر v.s الفقيه»
    // (clip 01:21–01:58; at 01:55 a ball with seven stars inside it).
    // 7 alone does nothing: the note says what to count and from where,
    // and the two paintings say which way the sun rises.
    {
      id: 'm4', order: 4,
      name: { en: 'The Seven Stars', ar: 'لغز النجوم السبعة' },
      environment: 'starhall',
      intro: {
        en: 'A quiet hall with a tiled floor and an old screen from the Limonat channel. Behind a star-shaped lock in the north wall waits the Star Lemon.',
        ar: 'قاعة هادئة بأرضية من البلاط وشاشة قديمة من قناة ليمونات. خلف قفل على شكل نجمة في الجدار الشمالي تنتظر الليمونة النجمية.',
      },
      objective: { en: 'Find the Star Lemon', ar: 'اعثر على الليمونة النجمية' },
      objectives: [
        { text: { en: 'Read the note on the lectern', ar: 'اقرأ الورقة على المنصّة' }, done: 'read_starNote' },
        { text: { en: 'Watch the screen', ar: 'شاهد الشاشة' }, done: 'watched_tv4' },
        { text: { en: 'Find the loose tile', ar: 'اعثر على البلاطة المتحرّكة' }, done: 'tile_found' },
        { text: { en: 'Take what is under it', ar: 'خذ ما تحتها' }, done: 'got_star_key' },
        { text: { en: 'Open the star lock', ar: 'افتح قفل النجمة' }, done: 'vault_open' },
        { text: { en: 'Take the Star Lemon', ar: 'خذ الليمونة النجمية' }, done: 'got_star_lemon' },
      ],
      secondary: [
        { id: 'clean', text: { en: 'Lift only the right tile', ar: 'لا ترفع إلا البلاطة الصحيحة' }, type: 'noMistakes', reward: { coins: 25 } },
      ],
      success: 'got_star_lemon',
      rewards: { score: 3000, coins: 90 },
      repeatable: true, repeatReward: { score: 600 },
      requires: ['m3'],
      hints: [
        { en: 'Watch the clip on the screen to the end. How many stars are inside the ball?', ar: 'شاهد المقطع على الشاشة حتى نهايته. كم نجمة داخل الكرة؟' },
        { en: 'The sun only rises on one side. Read the words above the two paintings.', ar: 'الشمس تشرق من جهة واحدة فقط. اقرأ الكلمة فوق كل لوحة من اللوحتين.' },
        { en: 'Do not count the lemon tile itself: the first tile is the one right after it.', ar: 'لا تعُدّ بلاطة الليمون نفسها: البلاطة الأولى هي التي تليها مباشرة.' },
      ],
      entities: [
        { id: 'lectern', type: 'prop', at: 'lectern', model: 'lectern', solid: true },
        { id: 'starNote', type: 'text', at: 'note', flat: true, style: 'paper', size: 0.05, width: 0.62,
          title: { en: 'Note on the lectern', ar: 'ورقة على المنصّة' },
          text: {
            en: 'To whoever seeks the Star Lemon:\nStart on the lemon tile.\nCount as many tiles as there are stars in the ball,\nwalking toward the sun as it rises.\nWhere the count ends, lift the tile.',
            ar: 'إلى من يبحث عن الليمونة النجمية:\nابدأ من بلاطة الليمون.\nعُدّ بلاطات بقدر النجوم التي في الكرة،\nسائرًا نحو الشمس حين تُشرق.\nحيث ينتهي العدّ، ارفع البلاطة.',
          } },
        { id: 'tv4', type: 'videoScreen', at: 'tv', video: 'thinker', name: { en: 'Limonat channel screen', ar: 'شاشة قناة ليمونات' } },
        { id: 'poster4', type: 'text', at: 'poster', style: 'sign', size: 0.13, width: 1.9, inspect: false,
          text: { en: 'NOW SHOWING\nThe Thinker vs the Jurist', ar: 'يُعرض الآن\nالمفكر v.s الفقيه' } },
        { id: 'eastSign', type: 'text', at: 'eastSign', style: 'sign', size: 0.3, width: 2.6,
          title: { en: 'Above the east painting', ar: 'فوق اللوحة الشرقية' }, text: { en: 'SUNRISE', ar: 'الشروق' } },
        { id: 'westSign', type: 'text', at: 'westSign', style: 'sign', size: 0.3, width: 2.6,
          title: { en: 'Above the west painting', ar: 'فوق اللوحة الغربية' }, text: { en: 'SUNSET', ar: 'الغروب' } },
        // 15 × 9 tiles; lemon tile in the middle (7,4); 7 tiles toward sunrise (east, +x) = (14,4)
        { id: 'tiles', type: 'floorTiles', at: 'tiles', nx: 15, nz: 9, size: 1, start: [7, 4], target: [14, 4], flag: 'tile_found',
          nearMiss: [
            { tile: [13, 4], say: { en: 'Did you count the lemon tile itself? Start with the tile after it.', ar: 'هل عددت بلاطة الليمون نفسها؟ ابدأ العدّ من البلاطة التي تليها.' } },
            { tile: [0, 4], say: { en: 'Is this where the sun rises?', ar: 'هل تشرق الشمس من هذه الجهة؟' } },
            { tile: [1, 4], say: { en: 'Is this where the sun rises?', ar: 'هل تشرق الشمس من هذه الجهة؟' } },
          ] },
        { id: 'starKey', type: 'item', at: 'tiles', offset: [7, 0.04, 0], item: 'star_key', name: { en: 'Star Key', ar: 'مفتاح النجمة' },
          model: 'starKey', itemKind: 'component', showWhen: 'tile_found', float: 0.12 },
        { id: 'vaultSign', type: 'text', at: 'vaultSign', style: 'stencil', size: 0.2, width: 3, inspect: false, text: '{star}' },
        { id: 'vault', type: 'compartment', at: 'vault', w: 1.2, h: 1.0, openWhen: 'vault_open',
          name: { en: 'Star vault', ar: 'خزنة النجمة' }, closedText: { en: 'A heavy wall door. The star lock beside it holds it shut.', ar: 'باب جداري ثقيل. يُبقيه قفل النجمة بجانبه مغلقًا.' } },
        { id: 'keyhole', type: 'keyhole', at: 'keyhole', item: 'star_key', flag: 'vault_open',
          name: { en: 'Star lock', ar: 'قفل النجمة' }, okText: { en: 'The star turns. The vault opens.', ar: 'دارت النجمة. انفتحت الخزنة.' } },
        { id: 'starLemon', type: 'item', at: 'vaultItem', item: 'star_lemon', name: { en: 'Star Lemon', ar: 'الليمونة النجمية' },
          model: 'goldenLemon', showWhen: 'vault_open' },
      ],
    },

    // ===================================================================
    // MISSION 5 — the clue comes from the channel video «الحكم على الشيء
    // جزء من تصوره» (clip 00:08–00:30; at 00:28 a screen shows the
    // prepositions «في», «عن», «على» in that order). The words say WHERE
    // to look around one cupboard (blackboard: in / fallen off / on top),
    // the note says WHICH cupboard, and their order sets the lock dials.
    {
      id: 'm5', order: 5,
      name: { en: 'The Three Prepositions', ar: 'لغز حروف الجر الثلاثة' },
      environment: 'wordroom',
      intro: {
        en: 'An empty classroom. Someone locked the Word Lemon in a cabinet and left a lesson on the board. The rest of the answer is on the screen.',
        ar: 'صفّ فارغ. أقفل أحدهم على ليمونة الكلمات في خزانة وترك درسًا على السبّورة. وبقية الجواب على الشاشة.',
      },
      objective: { en: 'Open the word cabinet', ar: 'افتح خزانة الكلمات' },
      objectives: [
        { text: { en: 'Read the note by the cabinet', ar: 'اقرأ الورقة عند الخزانة' }, done: 'read_wordNote' },
        { text: { en: 'Watch the screen', ar: 'شاهد الشاشة' }, done: 'watched_tv5' },
        { text: { en: 'Read the lesson on the board', ar: 'اقرأ الدرس على السبّورة' }, done: 'read_grammar' },
        { text: { en: 'Unlock the word cabinet', ar: 'افتح قفل خزانة الكلمات' }, done: 'words_open' },
        { text: { en: 'Take the Word Lemon', ar: 'خذ ليمونة الكلمات' }, done: 'got_word_lemon' },
      ],
      secondary: [
        { id: 'clean', text: { en: 'Open the lock on the first try', ar: 'افتح القفل من المحاولة الأولى' }, type: 'noMistakes', reward: { coins: 30 } },
      ],
      success: 'got_word_lemon',
      rewards: { score: 3500, coins: 100 },
      repeatable: true, repeatReward: { score: 700 },
      requires: ['m4'],
      hints: [
        { en: 'Watch the clip on the screen: three words appear one after another. Remember them in that order.', ar: 'شاهد المقطع على الشاشة: تظهر ثلاث كلمات واحدة بعد الأخرى. تذكّرها بهذا الترتيب.' },
        { en: 'The board says where each word points. The note by the cabinet says around which cupboard.', ar: 'السبّورة تقول إلى أين تشير كل كلمة، والورقة عند الخزانة تقول حول أي خزانة صغيرة.' },
        { en: 'The fruit is the lemon: use the yellow cupboard. Inside it, fallen off it, on top of it: set the dials in the order the words appeared.', ar: 'الثمرة هي الليمون: الخزانة الصفراء. داخلها، وما سقط عنها، وفوقها: أدِر الأقراص بترتيب ظهور الكلمات.' },
      ],
      entities: [
        { id: 'tv5', type: 'videoScreen', at: 'tv', video: 'tasawwur', name: { en: 'Limonat channel screen', ar: 'شاشة قناة ليمونات' } },
        { id: 'grammar', type: 'text', at: 'board', style: 'chalk', size: 0.16, width: 5.6,
          title: { en: 'Lesson on the board', ar: 'الدرس على السبّورة' },
          text: {
            en: 'TODAY: THREE LITTLE WORDS\nFI = inside the thing\nALA = on top of the thing\nAN = away from the thing (fallen off it)',
            ar: 'درس اليوم: حروف الجرّ\nفي: للظرفية (داخل الشيء)\nعلى: للاستعلاء (فوق الشيء)\nعن: للمجاوزة (ما ابتعد عن الشيء أو سقط عنه)',
          } },
        { id: 'wordKey', type: 'text', at: 'board', offset: [0, -1.2, 0], style: 'paper', size: 0.11, width: 1.3, inspect: false,
          text: { en: 'FI = في\nALA = على\nAN = عن', ar: 'في · على · عن' } },
        { id: 'noteStand', type: 'prop', at: 'noteStand', model: 'lectern', solid: true },
        { id: 'wordNote', type: 'text', at: 'cabinetNote', flat: true, style: 'paper', size: 0.045, width: 0.62,
          title: { en: 'Note by the word cabinet', ar: 'ورقة عند خزانة الكلمات' },
          text: {
            en: 'The three words on the screen point to three signs,\nall around the little cupboard that has the colour\nof the fruit this game is named after.\nTurn the dials in the order the words appeared.',
            ar: 'الكلمات الثلاث على الشاشة تدلّ على ثلاث علامات،\nكلها حول الخزانة الصغيرة التي لها لون\nالثمرة التي سُمّيت اللعبة باسمها.\nأدِر الأقراص بالترتيب الذي ظهرت به الكلمات.',
          } },
        { id: 'cabinet', type: 'symbolLock', at: 'cabinet', name: { en: 'Word cabinet', ar: 'خزانة الكلمات' },
          symbols: ['lemon', 'moon', 'leaf', 'star', 'sun', 'drop'], solution: ['sun', 'leaf', 'drop'], opens: 'words_open',
          lockText: { en: 'Three dials, one for each word.', ar: 'ثلاثة أقراص، قرص لكل كلمة.' } },
        { id: 'wordLemon', type: 'item', at: 'cabinet', offset: [0, 0.5, 0], item: 'word_lemon', name: { en: 'Word Lemon', ar: 'ليمونة الكلمات' },
          model: 'goldenLemon', modelArgs: [true], showWhen: 'words_open' },
        // four cupboards, each with a card inside, on top, and fallen off it
        ...[
          ['red', 0xd8463a, { en: 'Red cupboard', ar: 'الخزانة الحمراء' }, 'moon', 'star', 'lemon'],
          ['blue', 0x4a7ee0, { en: 'Blue cupboard', ar: 'الخزانة الزرقاء' }, 'leaf', 'sun', 'moon'],
          ['green', 0x4caa48, { en: 'Green cupboard', ar: 'الخزانة الخضراء' }, 'drop', 'lemon', 'star'],
          ['yellow', 0xffe14a, { en: 'Yellow cupboard', ar: 'الخزانة الصفراء' }, 'sun', 'leaf', 'drop'],
        ].flatMap(([k, color, name, inside, off, on]) => [
          { id: 'cup_' + k, type: 'cupboard', at: 'cup_' + k, color, name },
          { id: 'card_' + k + '_in', type: 'text', at: 'cup_' + k + '_in', flat: true, style: 'paper', size: 0.13, width: 0.32, text: '{' + inside + '}',
            showWhen: 'opened_cup_' + k, title: { en: 'Card inside the ' + name.en.toLowerCase(), ar: 'بطاقة داخل ' + name.ar } },
          { id: 'card_' + k + '_on', type: 'text', at: 'cup_' + k + '_on', flat: true, style: 'paper', size: 0.13, width: 0.32, text: '{' + on + '}',
            title: { en: 'Card on top of the ' + name.en.toLowerCase(), ar: 'بطاقة فوق ' + name.ar } },
          { id: 'card_' + k + '_off', type: 'text', at: 'cup_' + k + '_off', flat: true, style: 'paper', size: 0.13, width: 0.32, text: '{' + off + '}',
            title: { en: 'Card on the floor by the ' + name.en.toLowerCase(), ar: 'بطاقة على الأرض قرب ' + name.ar } },
        ]),
      ],
    },
  ];
})();
