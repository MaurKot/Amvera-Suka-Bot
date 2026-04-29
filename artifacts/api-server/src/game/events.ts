export interface LedgerEventConfig {
  rep: number;
  sev: number;
  public: boolean;
  flagText: string;
  defaultDescription: string;
}

export const LEDGER_EVENTS: Record<string, LedgerEventConfig> = {
  helped_npc: {
    rep: 50,
    sev: 1,
    public: false,
    flagText: "Этот человек помогал тебе или твоим коллегам",
    defaultDescription: "Помог местному жителю",
  },
  completed_quest: {
    rep: 100,
    sev: 2,
    public: true,
    flagText: "Этот человек выполнил важное задание",
    defaultDescription: "Выполнил поручение",
  },
  saved_from_danger: {
    rep: 200,
    sev: 3,
    public: true,
    flagText: "Этот человек спас тебя или кого-то близкого",
    defaultDescription: "Спас жителя от опасности",
  },
  donated_to_poor: {
    rep: 30,
    sev: 1,
    public: true,
    flagText: "Этот человек жертвовал деньги нуждающимся",
    defaultDescription: "Подал нуждающимся серебра",
  },
  gifted_rare_item: {
    rep: 150,
    sev: 2,
    public: false,
    flagText: "Этот человек дарил редкие предметы",
    defaultDescription: "Подарил ценный дар",
  },
  spared_enemy: {
    rep: 80,
    sev: 2,
    public: false,
    flagText: "Этот человек пощадил врага",
    defaultDescription: "Пощадил врага",
  },
  won_legendary_battle: {
    rep: 400,
    sev: 4,
    public: true,
    flagText: "Этот человек одержал легендарную победу",
    defaultDescription: "Одержал легендарную победу",
  },
  insulted_npc: {
    rep: -50,
    sev: 1,
    public: false,
    flagText: "Этот человек оскорблял местных жителей",
    defaultDescription: "Нанёс оскорбление",
  },
  broke_promise: {
    rep: -150,
    sev: 2,
    public: true,
    flagText: "Этот человек нарушил данное обещание",
    defaultDescription: "Нарушил обещание",
  },
  attacked_neutral: {
    rep: -200,
    sev: 3,
    public: true,
    flagText: "Этот человек нападал на нейтральных жителей",
    defaultDescription: "Напал на нейтрального",
  },
  killed_citizen: {
    rep: -400,
    sev: 4,
    public: true,
    flagText: "Этот человек убил мирного жителя",
    defaultDescription: "Убил мирного жителя",
  },
  fled_from_battle: {
    rep: -30,
    sev: 1,
    public: false,
    flagText: "Этот человек бежал с поля боя",
    defaultDescription: "Бежал с поля боя",
  },
  defeated_enemy: {
    rep: 10,
    sev: 1,
    public: false,
    flagText: "Этот человек побеждал чудовищ в округе",
    defaultDescription: "Победил чудовище",
  },
  fell_in_battle: {
    rep: -10,
    sev: 1,
    public: false,
    flagText: "Этот человек пал в бою",
    defaultDescription: "Пал в бою",
  },
  lied_and_caught: {
    rep: -100,
    sev: 2,
    public: true,
    flagText: "Этот человек лгал и был пойман на лжи",
    defaultDescription: "Был пойман на лжи",
  },
};

export function getEventConfig(eventType: string): LedgerEventConfig {
  return (
    LEDGER_EVENTS[eventType] ?? {
      rep: 0,
      sev: 1,
      public: false,
      flagText: `Событие: ${eventType}`,
      defaultDescription: eventType,
    }
  );
}
