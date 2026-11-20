export const gastosCopy = {
  greetings: [
    'LOG MO NA, BOSS.',
    'GASTOS CHECK MUNA, BOSS!',
    'KUMUSTA ANG BUHAY-BUHAY?',
  ],
  saved: [
    'SOLID, BOSSING!',
    'GG MGA BOSSING!',
    'SHEESH! NAITALA NA.',
    'AYOS, BOSS!',
  ],
  invalidAmount: [
    'Bossing, magkano muna?',
    "Ano 'yan, Boss? Walang amount?",
    "Zero pa 'yan, bossing!",
  ],
  undone: ['Ayos boss, nabawi!', 'Bawi tayo, bossing!', 'Undo successful, boss!'],
  zeroToday: ['ZERO DAMAGE TODAY. SHEESH!', 'TAHIMIK ANG WALLET TODAY, BOSS!'],
} as const;

export function copyAt<T extends readonly string[]>(messages: T, index: number): T[number] {
  return messages[index % messages.length]!;
}
