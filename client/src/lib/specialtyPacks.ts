export type ClinicSpecialty =
  | 'general'
  | 'internal'
  | 'cardiology'
  | 'pulmonology'
  | 'gastroenterology'
  | 'nephrology'
  | 'endocrinology'
  | 'rheumatology'
  | 'neurology'
  | 'orthopedics'
  | 'obgyn'
  | 'pediatrics'
  | 'dermatology'
  | 'ent'
  | 'ophthalmology'
  | 'dentistry'
  | 'general_surgery'
  | 'oncology'
  | 'hematology'
  | 'infectious_disease'
  | 'psychiatry'
  | 'neurosurgery'
  | 'plastic_surgery'
  | 'nutrition'

export type SpecialtyPack = {
  id: ClinicSpecialty
  /** Catalog specialty id in medical_exams */
  catalogId: string
  extraVisitHints: { key: string; labelAr: string; labelEn: string }[]
  suggestedLabs: string[]
  suggestedRxNoteAr: string
}

function pack(
  id: ClinicSpecialty,
  catalogId: string,
  opts?: Partial<Pick<SpecialtyPack, 'extraVisitHints' | 'suggestedLabs' | 'suggestedRxNoteAr'>>,
): SpecialtyPack {
  return {
    id,
    catalogId,
    extraVisitHints: opts?.extraVisitHints ?? [],
    suggestedLabs: opts?.suggestedLabs ?? [],
    suggestedRxNoteAr: opts?.suggestedRxNoteAr ?? '',
  }
}

export const SPECIALTY_PACKS: Record<ClinicSpecialty, SpecialtyPack> = {
  general: pack('general', 'internal_medicine', { suggestedLabs: ['CBC', 'RBS'] }),
  internal: pack('internal', 'internal_medicine', {
    extraVisitHints: [
      { key: 'bp_note', labelAr: 'ضغط الدم', labelEn: 'Blood pressure' },
      { key: 'sugar_note', labelAr: 'السكر', labelEn: 'Blood sugar' },
    ],
    suggestedLabs: ['HbA1c', 'Lipid Profile', 'Creatinine'],
  }),
  cardiology: pack('cardiology', 'cardiology', {
    suggestedLabs: ['Troponin', 'ECG', 'Lipid Profile'],
  }),
  pulmonology: pack('pulmonology', 'pulmonology', {
    suggestedLabs: ['CBC', 'CRP', 'Chest X-ray'],
  }),
  gastroenterology: pack('gastroenterology', 'gastroenterology', {
    suggestedLabs: ['Liver Function', 'HBsAg', 'HCV Ab'],
  }),
  nephrology: pack('nephrology', 'nephrology', {
    suggestedLabs: ['Urine Analysis', 'Creatinine', 'Urea'],
  }),
  endocrinology: pack('endocrinology', 'endocrinology', {
    suggestedLabs: ['TSH', 'FT4', 'HbA1c'],
  }),
  rheumatology: pack('rheumatology', 'rheumatology', {
    suggestedLabs: ['ESR', 'CRP', 'RF'],
  }),
  neurology: pack('neurology', 'neurology', {
    suggestedLabs: ['Vitamin B12', 'MRI Brain'],
  }),
  orthopedics: pack('orthopedics', 'orthopedics', {
    extraVisitHints: [
      { key: 'joint', labelAr: 'المفصل المصاب', labelEn: 'Affected joint' },
      { key: 'trauma', labelAr: 'إصابة / رضّ', labelEn: 'Trauma' },
    ],
    suggestedLabs: ['Calcium', 'Vitamin D', 'X-ray'],
  }),
  obgyn: pack('obgyn', 'obgyn', {
    extraVisitHints: [
      { key: 'lmp', labelAr: 'آخر دورة', labelEn: 'LMP' },
      { key: 'ga', labelAr: 'عمر الحمل', labelEn: 'Gestational age' },
    ],
    suggestedLabs: ['β-hCG', 'CBC', 'Urine Analysis'],
    suggestedRxNoteAr: 'مراعاة الحمل / الرضاعة إن وُجدت',
  }),
  pediatrics: pack('pediatrics', 'pediatrics', {
    extraVisitHints: [
      { key: 'weight_note', labelAr: 'الوزن / النمو', labelEn: 'Weight / growth' },
      { key: 'vaccines', labelAr: 'التطعيمات', labelEn: 'Vaccinations' },
    ],
    suggestedLabs: ['CBC', 'CRP'],
    suggestedRxNoteAr: 'جرعات الأطفال حسب الوزن',
  }),
  dermatology: pack('dermatology', 'dermatology', {
    extraVisitHints: [
      { key: 'lesion_site', labelAr: 'موضع الإصابة', labelEn: 'Lesion site' },
      { key: 'skin_type', labelAr: 'نوع الجلد', labelEn: 'Skin type' },
    ],
    suggestedRxNoteAr: 'مرهم موضعي — تعليمات الاستخدام',
  }),
  ent: pack('ent', 'ent', {
    extraVisitHints: [{ key: 'ear_nose', labelAr: 'أذن / أنف / حلق', labelEn: 'Ear / nose / throat' }],
  }),
  ophthalmology: pack('ophthalmology', 'ophthalmology', {
    extraVisitHints: [
      { key: 'vision', labelAr: 'حدة الإبصار', labelEn: 'Visual acuity' },
      { key: 'iop', labelAr: 'ضغط العين', labelEn: 'IOP' },
    ],
    suggestedRxNoteAr: 'قطرات — تعليمات العين',
  }),
  dentistry: pack('dentistry', 'dentistry', {
    extraVisitHints: [
      { key: 'tooth', labelAr: 'السن / المنطقة', labelEn: 'Tooth / area' },
      { key: 'pain', labelAr: 'درجة الألم', labelEn: 'Pain level' },
    ],
  }),
  general_surgery: pack('general_surgery', 'general_surgery', {
    suggestedLabs: ['CBC', 'PT', 'INR', 'Blood Group'],
  }),
  oncology: pack('oncology', 'oncology'),
  hematology: pack('hematology', 'hematology', { suggestedLabs: ['CBC', 'Ferritin'] }),
  infectious_disease: pack('infectious_disease', 'infectious_disease'),
  psychiatry: pack('psychiatry', 'psychiatry', { suggestedLabs: ['CBC', 'TSH', 'Vitamin B12'] }),
  neurosurgery: pack('neurosurgery', 'neurosurgery'),
  plastic_surgery: pack('plastic_surgery', 'plastic_surgery', {
    suggestedLabs: ['CBC', 'PT/INR', 'Blood Sugar'],
  }),
  nutrition: pack('nutrition', 'nutrition', {
    suggestedLabs: ['HbA1c', 'Lipid Profile', 'Vitamin D'],
  }),
}

export function getSpecialtyPack(id: string | null | undefined): SpecialtyPack {
  if (id && id in SPECIALTY_PACKS) return SPECIALTY_PACKS[id as ClinicSpecialty]
  return SPECIALTY_PACKS.general
}

export const SPECIALTY_IDS = Object.keys(SPECIALTY_PACKS) as ClinicSpecialty[]
