import type { NPC } from "@workspace/db";

/**
 * Templated NPC reply used when the LLM is unavailable (no API key, quota,
 * or network failure). The reply still respects the NPC's role, voiceStyle
 * and the player's tone so the game does not feel broken.
 */
export function buildFallbackNpcReply(opts: {
  npc: NPC;
  characterName: string;
  tone: string;
  reputation: number;
  playerMessage: string;
}): string {
  const { npc, characterName, tone, reputation, playerMessage } = opts;
  const role = npc.role;
  const friendly = reputation >= 50;
  const cold = reputation <= -30;
  const lowered = playerMessage.toLowerCase();

  // Tone overrides
  if (tone === "threat") {
    if (role === "guard_captain")
      return `${npc.name} кладёт руку на эфес. — Повтори, ${characterName}. Громче. Чтобы стража слышала.`;
    if (cold) return `${npc.name} презрительно усмехается. — Угрожаешь? Тебя здесь и так не ждали.`;
    return `${npc.name} напрягается, но молчит. Воздух между вами становится тяжёлым.`;
  }
  if (tone === "insult") {
    if (cold) return `${npc.name} плюёт под ноги. — Иди прочь, пока цел.`;
    return `— Это всё, что ты можешь? — ${npc.name} отворачивается, не удостоив ответом.`;
  }

  // Topic hints based on simple keywords
  if (/(куп|прода|товар|цен|серебр)/i.test(lowered)) {
    if (role === "merchant" || role === "smith" || role === "tavern_keeper")
      return `— Открой лавку, ${characterName}, и смотри сам. Цены честные, как пыль на дороге.`;
    return `— У меня нечего продавать. Иди на Соляной Рынок к Холвасу — там торг.`;
  }
  if (/(квест|задани|помог|нужн)/i.test(lowered)) {
    return `— Дело найдётся для каждого. Загляни к старейшине Ровану на площадь Ардвейла — он раздаёт работу.`;
  }
  if (/(слух|новост|расскаж|что слышно)/i.test(lowered)) {
    if (role === "tavern_keeper")
      return `— Слухи дешевле эля. На рынке шепчут о пропавшем караване, а в часовне снова жгут свечи без огня.`;
    if (role === "scribe")
      return `— Хроники говорят: тишина — это тоже событие. В Эхе Пепла снова неспокойно.`;
    return `— Каждый шепчет своё. Послушай Маиру в Сером Очаге, она помнит больше любого.`;
  }
  if (/(где|как пройти|дорог|путь)/i.test(lowered)) {
    return `— Карта в твоих руках, ${characterName}. Выбери место — и иди. Ноги помнят дольше глаз.`;
  }

  // Role/relationship-based generic
  if (role === "elder")
    return friendly
      ? `Старик Рован медленно кивает. — Говори, дитя. Я слушаю — у меня времени больше, чем у пламени.`
      : `Рован молча перебирает чётки. — Слова — это дым. Принеси дело, тогда поговорим.`;
  if (role === "guard_captain")
    return `Серафина смотрит ровно. — Излагай по существу. Стража не нянчит болтунов.`;
  if (role === "merchant")
    return `— Дорогой странник, время — это серебро. Открой лавку или скажи, чем я могу быть полезен.`;
  if (role === "priest")
    return `Ивелин шепчет: — Боги молчат. И мы молчим вместе с ними. Что привело тебя в часовню?`;
  if (role === "hunter")
    return `Каэрн смотрит сквозь тебя, как сквозь чащу. — Лес слышит лучше меня. Что ищешь?`;
  if (role === "oracle")
    return `Оракул Лещ улыбается из тени. — Странник, твоя тень длиннее тебя. Ты пришёл за ответом или за вопросом?`;
  if (role === "smith")
    return `Дурран бьёт молотом и не оборачивается. — Говори, пока металл стынет.`;
  if (role === "scribe")
    return `Велит поправляет очки. — Изложи внятно. Я записываю даже паузы.`;
  if (role === "tavern_keeper")
    return friendly
      ? `Маира улыбается. — Садись, ${characterName}. Эль, варево или слух — выбирай.`
      : `Маира холодно протирает кружку. — Деньги вперёд, разговоры потом.`;
  if (role === "ranger")
    return `Сильвар коротко кивает. — Говори по делу. Перевал не любит праздных.`;

  return friendly
    ? `${npc.name} смотрит на тебя с уважением. — Что у тебя на сердце, ${characterName}?`
    : `${npc.name} молча оценивает тебя. Кажется, придётся постараться, чтобы заслужить слово.`;
}
