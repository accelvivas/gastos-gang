export const gastosToastMessages = {
  food: [
    'Bossing! Gutom ka o bored ka lang?',
    'Kain ka nang kain, boss. Yung wallet mo nagpapapayat!',
    'Busog ang tiyan, pero yung pitaka mo naka-fasting!',
    "Ano 'yan, boss? Cheat day mo araw-araw?",
    'Solid, bossing! Yung pera mo naging tae na naman!',
  ],
  transport: [
    'Bossing! Ang layo ng narating mo, yung ipon mo hindi!',
    'Pamasahe na naman? Yung pera mo mahilig bumiyahe, ah!',
    'Boss, nag-commute ka o nagpaikot ng ekonomiya?',
    'Sakay nang sakay, boss. Yung savings mo naiwan sa terminal!',
    'Biyahe lang nang biyahe, bossing! Yung wallet mo pagod na!',
  ],
  load: [
    'Bossing! Full bar ang signal, zero bar ang savings!',
    'Load ka nang load, boss. May kausap ka ba talaga?',
    "Ano 'yan, boss? Unli data, limited budget?",
    'Connected ka sa internet, pero disconnected sa ipon!',
    'Bossing! Mas stable pa internet mo kaysa financial status mo!',
  ],
  shopping: [
    "Bossing! Deserve mo 'yan? O deserve mo lang magtipid?",
    'Add to cart ka nang add to cart, boss. Add to savings naman!',
    'SALE daw? Boss, gumastos ka pa rin!',
    "Ano 'yan, boss? Checkout muna bago common sense?",
    'Bossing! Yung parcel mo may tracking, yung ipon mo missing!',
  ],
  bills: [
    'Bossing! Akala mo sweldo, pambayad lang pala!',
    'Kuryente na naman? Boss, pati wallet mo nawalan ng power!',
    'Bayad dito, bayad doon. Bossing, ikaw ba ang ATM ng barangay?',
    "Ano 'yan, boss? Monthly subscription sa paghihirap?",
    'Solid, bossing! Responsible adult ka na, financially traumatized nga lang!',
  ],
  other: [
    'Bossing! Other? Pati gastos mo may tinatagong sikreto?',
    "Ano 'yan, boss? Classified information yung binili mo?",
    'OTHER daw. Boss, ayaw mo lang umamin eh!',
    'Bossing! Mystery expense unlocked. FBI, pakigalaw ang baso!',
    'GG, boss! Kahit ikaw hindi mo alam saan napunta pera mo!',
  ],
} as const;

export const genericToastMessages = [
  'Solid, bossing! Gastos logged.',
  'Ayos, boss! Naitala na.',
  'GG mga bossing! Saved na.',
  'Sheesh! Another gastos recorded.',
  'Bossing! Pasok sa record.',
] as const;

export type DefaultToastCategory = keyof typeof gastosToastMessages;
