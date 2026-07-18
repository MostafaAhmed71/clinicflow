/**
 * Lightweight allergy ↔ drug name heuristics (local rules, no AI).
 * Matches common Arabic/English tokens in free-text allergy fields.
 */

const RULES: { allergyTokens: string[]; drugTokens: string[]; labelAr: string; labelEn: string }[] = [
  {
    allergyTokens: ['بنسلين', 'penicillin', 'amoxicillin', 'أمoxicillin', 'أموكسيسيلين', 'أموكسيسلين'],
    drugTokens: [
      'penicillin',
      'amoxicillin',
      'ampicillin',
      'augmentin',
      'أموكسي',
      'أموكسيسيلين',
      'بنسلين',
      'أوجمنتين',
      'فلوموكس',
      'هيكساكيلين',
    ],
    labelAr: 'حساسية بنسلين / بيتا لاكتام محتملة',
    labelEn: 'Possible penicillin / beta-lactam allergy',
  },
  {
    allergyTokens: ['سلفا', 'sulfa', 'sulfonamide', 'سلفوناميد'],
    drugTokens: ['sulfa', 'sulfamethoxazole', 'bactrim', 'سيبتارين', 'سلفا', 'كوتريموكسازول'],
    labelAr: 'حساسية سلفا محتملة',
    labelEn: 'Possible sulfa allergy',
  },
  {
    allergyTokens: ['أسبرين', 'aspirin', 'نسيد', 'nsaid', 'إيبوبروفين', 'ibuprofen', 'ديكلوفيناك'],
    drugTokens: [
      'aspirin',
      'أسبرين',
      'ibuprofen',
      'إيبوبروفين',
      'diclofenac',
      'ديكلوفيناك',
      'كاتافلام',
      'بروفين',
      'فولتارين',
      'نابروكسين',
    ],
    labelAr: 'حساسية أسبرين / مضادات التهاب محتملة',
    labelEn: 'Possible aspirin / NSAID allergy',
  },
  {
    allergyTokens: ['يود', 'iodine', 'contrast', 'صبغة'],
    drugTokens: ['iodine', 'يود', 'contrast'],
    labelAr: 'حساسية يود / صبغة محتملة',
    labelEn: 'Possible iodine / contrast allergy',
  },
]

function includesAny(haystack: string, tokens: string[]) {
  const h = haystack.toLowerCase()
  return tokens.some((tok) => h.includes(tok.toLowerCase()))
}

export function detectDrugAllergyConflicts(
  allergies: string | null | undefined,
  drugNames: string[],
  lang: 'ar' | 'en' = 'ar',
): string[] {
  if (!allergies?.trim()) return []
  const allergyText = allergies.trim()
  const alerts: string[] = []

  for (const rule of RULES) {
    if (!includesAny(allergyText, rule.allergyTokens)) continue
    const hit = drugNames.some((d) => d.trim() && includesAny(d, rule.drugTokens))
    if (hit) alerts.push(lang === 'en' ? rule.labelEn : rule.labelAr)
  }

  // Generic: any allergy word that also appears as a drug substring (min 4 chars)
  const allergyParts = allergyText
    .split(/[,،/\n]+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 4)
  for (const part of allergyParts) {
    for (const drug of drugNames) {
      if (drug.trim().length >= 4 && drug.toLowerCase().includes(part.toLowerCase())) {
        const msg =
          lang === 'en'
            ? `Drug may match recorded allergy: ${part}`
            : `الدواء قد يطابق حساسية مسجّلة: ${part}`
        if (!alerts.includes(msg)) alerts.push(msg)
      }
    }
  }

  return alerts
}
