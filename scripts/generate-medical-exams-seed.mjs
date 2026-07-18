/**
 * Medical exams catalog seed data → generates SQL inserts.
 * Run: node scripts/generate-medical-exams-seed.mjs
 */

/** @typedef {'lab'|'imaging'|'endoscopy'|'functional'|'biopsy'|'cardiac'|'procedure'} ExamKind */
/** @typedef {'lab'|'radiology'|'functional'|'pathology'} ExamCategory */

/** @type {{ id: string, nameAr: string, nameEn: string, sort: number }[]} */
const SPECIALTIES = [
  { id: 'internal_medicine', nameAr: 'الباطنة العامة', nameEn: 'Internal Medicine', sort: 1 },
  { id: 'cardiology', nameAr: 'القلب', nameEn: 'Cardiology', sort: 2 },
  { id: 'pulmonology', nameAr: 'الصدر', nameEn: 'Pulmonology', sort: 3 },
  { id: 'gastroenterology', nameAr: 'الجهاز الهضمي والكبد', nameEn: 'Gastroenterology & Hepatology', sort: 4 },
  { id: 'nephrology', nameAr: 'الكلى والمسالك البولية', nameEn: 'Nephrology & Urology', sort: 5 },
  { id: 'endocrinology', nameAr: 'الغدد الصماء', nameEn: 'Endocrinology', sort: 6 },
  { id: 'rheumatology', nameAr: 'الروماتيزم', nameEn: 'Rheumatology', sort: 7 },
  { id: 'neurology', nameAr: 'الأعصاب', nameEn: 'Neurology', sort: 8 },
  { id: 'orthopedics', nameAr: 'العظام', nameEn: 'Orthopedics', sort: 9 },
  { id: 'obgyn', nameAr: 'النساء والتوليد', nameEn: 'Obstetrics & Gynecology', sort: 10 },
  { id: 'pediatrics', nameAr: 'الأطفال', nameEn: 'Pediatrics', sort: 11 },
  { id: 'dermatology', nameAr: 'الجلدية', nameEn: 'Dermatology', sort: 12 },
  { id: 'ent', nameAr: 'الأنف والأذن والحنجرة', nameEn: 'ENT', sort: 13 },
  { id: 'ophthalmology', nameAr: 'العيون', nameEn: 'Ophthalmology', sort: 14 },
  { id: 'dentistry', nameAr: 'الأسنان', nameEn: 'Dentistry', sort: 15 },
  { id: 'general_surgery', nameAr: 'الجراحة العامة', nameEn: 'General Surgery', sort: 16 },
  { id: 'oncology', nameAr: 'الأورام', nameEn: 'Oncology', sort: 17 },
  { id: 'hematology', nameAr: 'أمراض الدم', nameEn: 'Hematology', sort: 18 },
  { id: 'infectious_disease', nameAr: 'الأمراض المعدية', nameEn: 'Infectious Diseases', sort: 19 },
  { id: 'psychiatry', nameAr: 'الطب النفسي', nameEn: 'Psychiatry', sort: 20 },
  { id: 'neurosurgery', nameAr: 'جراحة المخ والأعصاب', nameEn: 'Neurosurgery', sort: 21 },
  { id: 'plastic_surgery', nameAr: 'جراحة التجميل', nameEn: 'Plastic Surgery', sort: 22 },
  { id: 'nutrition', nameAr: 'التغذية والسمنة', nameEn: 'Nutrition & Obesity', sort: 23 },
]

/**
 * @param {string} specialty
 * @param {ExamKind} kind
 * @param {ExamCategory} category
 * @param {string} nameEn
 * @param {string} nameAr
 * @param {{ code?: string, fasting?: boolean, tat?: number, notes?: string }} [extra]
 */
function e(specialty, kind, category, nameEn, nameAr, extra = {}) {
  return {
    specialty,
    kind,
    category,
    nameEn,
    nameAr,
    code: extra.code ?? `CF-${nameEn.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase().slice(0, 40)}`,
    fasting: !!extra.fasting,
    tat: extra.tat ?? null,
    notes: extra.notes ?? null,
  }
}

const lab = (sp, en, ar, extra) => e(sp, 'lab', 'lab', en, ar, extra)
const img = (sp, en, ar, extra) => e(sp, 'imaging', 'radiology', en, ar, extra)
const endo = (sp, en, ar, extra) => e(sp, 'endoscopy', 'radiology', en, ar, extra)
const fn = (sp, en, ar, extra) => e(sp, 'functional', 'functional', en, ar, extra)
const card = (sp, en, ar, extra) => e(sp, 'cardiac', 'functional', en, ar, extra)
const bx = (sp, en, ar, extra) => e(sp, 'biopsy', 'pathology', en, ar, extra)
const proc = (sp, en, ar, extra) => e(sp, 'procedure', 'functional', en, ar, extra)

/** @type {ReturnType<typeof e>[]} */
const EXAMS = [
  // —— 1. Internal medicine ——
  lab('internal_medicine', 'CBC', 'صورة دم كاملة', { code: 'LOINC-58410-2', tat: 6 }),
  lab('internal_medicine', 'ESR', 'سرعة الترسيب', { code: 'LOINC-4537-7', tat: 6 }),
  lab('internal_medicine', 'CRP', 'البروتين التفاعلي C', { code: 'LOINC-1988-5', tat: 6 }),
  lab('internal_medicine', 'Fasting Blood Sugar (FBS)', 'سكر صائم', { code: 'LOINC-1558-6', fasting: true, tat: 6 }),
  lab('internal_medicine', 'Random Blood Sugar (RBS)', 'سكر عشوائي', { code: 'LOINC-2339-0', tat: 2 }),
  lab('internal_medicine', 'HbA1c', 'السكر التراكمي', { code: 'LOINC-4548-4', tat: 24 }),
  lab('internal_medicine', 'Kidney Function (Urea, Creatinine)', 'وظائف الكلى (يوريا، كرياتينين)', { code: 'CF-KFT', tat: 12 }),
  lab('internal_medicine', 'Liver Function (ALT, AST, Albumin, Bilirubin)', 'وظائف الكبد', { code: 'CF-LFT', tat: 12 }),
  lab('internal_medicine', 'Lipid Profile', 'دهون الدم', { code: 'CF-LIPID', fasting: true, tat: 12 }),
  lab('internal_medicine', 'Electrolytes (Na, K, Cl)', 'الأملاح (صوديوم، بوتاسيوم، كلوريد)', { code: 'CF-ELECTROLYTES', tat: 6 }),
  lab('internal_medicine', 'Uric Acid', 'حمض اليوريك', { code: 'LOINC-3084-1', tat: 12 }),
  lab('internal_medicine', 'Calcium', 'الكالسيوم', { code: 'LOINC-17861-6', tat: 12 }),
  lab('internal_medicine', 'Magnesium', 'الماغنسيوم', { code: 'LOINC-19123-9', tat: 12 }),
  lab('internal_medicine', 'Phosphorus', 'الفوسفور', { code: 'LOINC-2777-1', tat: 12 }),
  lab('internal_medicine', 'Vitamin D', 'فيتامين د', { code: 'LOINC-1989-3', tat: 48 }),
  lab('internal_medicine', 'Vitamin B12', 'فيتامين ب12', { code: 'LOINC-2132-9', tat: 48 }),
  lab('internal_medicine', 'Ferritin', 'الفيريتين', { code: 'LOINC-2276-4', tat: 24 }),
  lab('internal_medicine', 'Iron Profile', 'مقارنة الحديد', { code: 'CF-IRON-PROFILE', tat: 24 }),
  lab('internal_medicine', 'PT, INR', 'زمن البروثرومبين / INR', { code: 'CF-PT-INR', tat: 6 }),
  lab('internal_medicine', 'PTT', 'زمن التخثر الجزئي', { code: 'LOINC-3173-2', tat: 6 }),
  img('internal_medicine', 'Chest X-ray', 'أشعة صدر', { code: 'CF-CXR', tat: 4 }),
  img('internal_medicine', 'Abdominal Ultrasound', 'سونار بطن', { code: 'CF-US-ABD', fasting: true, tat: 4, notes: 'يفضل صيام 6–8 ساعات' }),
  img('internal_medicine', 'CT Abdomen', 'مقطعية بطن', { code: 'CF-CT-ABD', tat: 24 }),
  img('internal_medicine', 'MRI Abdomen', 'رنين بطن', { code: 'CF-MRI-ABD', tat: 48 }),

  // —— 2. Cardiology ——
  lab('cardiology', 'Troponin', 'التروبونين', { code: 'LOINC-10839-9', tat: 2, notes: 'مستعجل عند الاشتباه باحتشاء' }),
  lab('cardiology', 'CK-MB', 'إنزيم القلب CK-MB', { code: 'LOINC-13969-1', tat: 6 }),
  lab('cardiology', 'BNP', 'BNP', { code: 'LOINC-30934-4', tat: 12 }),
  lab('cardiology', 'D-Dimer', 'دي دايمر', { code: 'LOINC-48065-7', tat: 6 }),
  lab('cardiology', 'Lipid Profile', 'دهون الدم', { code: 'CF-LIPID', fasting: true, tat: 12 }),
  lab('cardiology', 'PT/INR', 'PT/INR', { code: 'CF-PT-INR', tat: 6 }),
  lab('cardiology', 'Electrolytes', 'الأملاح', { code: 'CF-ELECTROLYTES', tat: 6 }),
  card('cardiology', 'ECG', 'رسم قلب', { code: 'CF-ECG', tat: 1 }),
  card('cardiology', 'Echocardiography', 'إيكو قلب', { code: 'CF-ECHO', tat: 4 }),
  card('cardiology', 'Holter ECG', 'هولتر رسم قلب', { code: 'CF-HOLTER', tat: 24 }),
  fn('cardiology', 'Stress Test', 'اختبار جهد', { code: 'CF-STRESS', tat: 4 }),
  img('cardiology', 'Coronary CT', 'مقطعية شرايين تاجية', { code: 'CF-CT-CORONARY', tat: 24 }),
  img('cardiology', 'Cardiac MRI', 'رنين قلب', { code: 'CF-MRI-CARDIAC', tat: 48 }),
  proc('cardiology', 'Cardiac Catheterization', 'قسطرة قلب', { code: 'CF-CATH', tat: 24, notes: 'إجراء تدخلي — تحضير خاص' }),

  // —— 3. Pulmonology ——
  lab('pulmonology', 'CBC', 'صورة دم كاملة', { code: 'LOINC-58410-2', tat: 6 }),
  lab('pulmonology', 'CRP', 'البروتين التفاعلي C', { code: 'LOINC-1988-5', tat: 6 }),
  lab('pulmonology', 'ESR', 'سرعة الترسيب', { code: 'LOINC-4537-7', tat: 6 }),
  lab('pulmonology', 'Sputum Culture', 'مزرعة بلغم', { code: 'CF-SPUTUM-CULTURE', tat: 72 }),
  lab('pulmonology', 'Sputum AFB', 'صبغة زيل نلسن للبلغم', { code: 'CF-SPUTUM-AFB', tat: 48 }),
  lab('pulmonology', 'GeneXpert', 'جين إكسبرت', { code: 'CF-GENEXPERT', tat: 24 }),
  lab('pulmonology', 'ABG', 'غازات الدم الشرياني', { code: 'CF-ABG', tat: 1 }),
  lab('pulmonology', 'D-Dimer', 'دي دايمر', { code: 'LOINC-48065-7', tat: 6 }),
  lab('pulmonology', 'COVID PCR', 'مسحة كورونا PCR', { code: 'CF-COVID-PCR', tat: 24 }),
  lab('pulmonology', 'Influenza PCR', 'إنفلونزا PCR', { code: 'CF-FLU-PCR', tat: 24 }),
  img('pulmonology', 'Chest X-ray', 'أشعة صدر', { code: 'CF-CXR', tat: 4 }),
  img('pulmonology', 'HRCT Chest', 'مقطعية صدر عالية الدقة', { code: 'CF-HRCT', tat: 24 }),
  img('pulmonology', 'CT Chest', 'مقطعية صدر', { code: 'CF-CT-CHEST', tat: 24 }),
  fn('pulmonology', 'Pulmonary Function Test (PFT)', 'وظائف تنفس', { code: 'CF-PFT', tat: 4 }),
  endo('pulmonology', 'Bronchoscopy', 'منظار قصبات', { code: 'CF-BRONCHO', tat: 24 }),

  // —— 4. Gastroenterology ——
  lab('gastroenterology', 'Liver Function', 'وظائف الكبد', { code: 'CF-LFT', tat: 12 }),
  lab('gastroenterology', 'HBsAg', 'فيروس الكبد B سطحي', { code: 'LOINC-5196-1', tat: 24 }),
  lab('gastroenterology', 'HCV Ab', 'أجسام مضادة لفيروس الكبد C', { code: 'LOINC-16128-1', tat: 24 }),
  lab('gastroenterology', 'HBV DNA', 'حمض نووي فيروس الكبد B', { code: 'CF-HBV-DNA', tat: 72 }),
  lab('gastroenterology', 'HCV PCR', 'فيروس الكبد C PCR', { code: 'CF-HCV-PCR', tat: 72 }),
  lab('gastroenterology', 'Stool Analysis', 'تحليل براز', { code: 'CF-STOOL', tat: 12 }),
  lab('gastroenterology', 'Stool Culture', 'مزرعة براز', { code: 'CF-STOOL-CULTURE', tat: 72 }),
  lab('gastroenterology', 'Occult Blood', 'دم خفي في البراز', { code: 'LOINC-2335-8', tat: 24 }),
  lab('gastroenterology', 'Amylase', 'الأميليز', { code: 'LOINC-1798-8', tat: 6 }),
  lab('gastroenterology', 'Lipase', 'الليباز', { code: 'LOINC-3040-3', tat: 6 }),
  lab('gastroenterology', 'Celiac Profile', 'تحليل حساسية القمح', { code: 'CF-CELIAC', tat: 48 }),
  lab('gastroenterology', 'Helicobacter pylori Antigen', 'جرثومة المعدة في البراز', { code: 'CF-HPYLORI-AG', tat: 24 }),
  img('gastroenterology', 'Abdominal Ultrasound', 'سونار بطن', { code: 'CF-US-ABD', fasting: true, tat: 4 }),
  img('gastroenterology', 'CT Abdomen', 'مقطعية بطن', { code: 'CF-CT-ABD', tat: 24 }),
  img('gastroenterology', 'MRI Abdomen', 'رنين بطن', { code: 'CF-MRI-ABD', tat: 48 }),
  img('gastroenterology', 'MRCP', 'رنين للقنوات المرارية', { code: 'CF-MRCP', fasting: true, tat: 48 }),
  endo('gastroenterology', 'Upper GI Endoscopy', 'منظار معدة', { code: 'CF-EGD', fasting: true, tat: 4, notes: 'صيام 8 ساعات' }),
  endo('gastroenterology', 'Colonoscopy', 'منظار قولون', { code: 'CF-COLONOSCOPY', tat: 4, notes: 'تحضير قولون مطلوب' }),

  // —— 5. Nephrology ——
  lab('nephrology', 'Urine Analysis', 'تحليل بول', { code: 'CF-UA', tat: 4 }),
  lab('nephrology', 'Urine Culture', 'مزرعة بول', { code: 'CF-UC', tat: 48 }),
  lab('nephrology', '24-hour Urine Protein', 'بروتين بول 24 ساعة', { code: 'CF-UPROTEIN-24H', tat: 24 }),
  lab('nephrology', 'Creatinine', 'الكرياتينين', { code: 'LOINC-2160-0', tat: 6 }),
  lab('nephrology', 'Urea', 'اليوريا', { code: 'LOINC-3094-0', tat: 6 }),
  lab('nephrology', 'Electrolytes', 'الأملاح', { code: 'CF-ELECTROLYTES', tat: 6 }),
  lab('nephrology', 'Uric Acid', 'حمض اليوريك', { code: 'LOINC-3084-1', tat: 12 }),
  lab('nephrology', 'PSA', 'مؤشر البروستاتا PSA', { code: 'LOINC-2857-1', tat: 24, notes: 'للرجال' }),
  img('nephrology', 'KUB Ultrasound', 'سونار كلى ومسالك', { code: 'CF-US-KUB', tat: 4 }),
  img('nephrology', 'CT KUB', 'مقطعية كلى ومسالك', { code: 'CF-CT-KUB', tat: 24 }),
  img('nephrology', 'IVP', 'أشعة صبغية للمسالك', { code: 'CF-IVP', tat: 24 }),
  endo('nephrology', 'Cystoscopy', 'منظار مثانة', { code: 'CF-CYSTO', tat: 4 }),
  img('nephrology', 'Renal Doppler', 'دوبلر كلى', { code: 'CF-DOPPLER-RENAL', tat: 4 }),

  // —— 6. Endocrinology ——
  lab('endocrinology', 'TSH', 'هرمون الغدة الدرقية TSH', { code: 'LOINC-3016-3', tat: 24 }),
  lab('endocrinology', 'FT3', 'T3 حر', { code: 'LOINC-3051-0', tat: 24 }),
  lab('endocrinology', 'FT4', 'T4 حر', { code: 'LOINC-3024-7', tat: 24 }),
  lab('endocrinology', 'HbA1c', 'السكر التراكمي', { code: 'LOINC-4548-4', tat: 24 }),
  lab('endocrinology', 'Fasting Insulin', 'إنسولين صائم', { code: 'LOINC-20448-7', fasting: true, tat: 24 }),
  lab('endocrinology', 'Cortisol', 'الكورتيزول', { code: 'LOINC-2143-6', tat: 24, notes: 'حدد توقيت السحب (صباحي/مسائي)' }),
  lab('endocrinology', 'ACTH', 'ACTH', { code: 'LOINC-2141-0', tat: 48 }),
  lab('endocrinology', 'PTH', 'هرمون الغدة الجار درقية', { code: 'LOINC-2731-8', tat: 24 }),
  lab('endocrinology', 'Vitamin D', 'فيتامين د', { code: 'LOINC-1989-3', tat: 48 }),
  lab('endocrinology', 'Testosterone', 'التستوستيرون', { code: 'LOINC-2986-8', tat: 24 }),
  lab('endocrinology', 'Estrogen', 'الإستروجين', { code: 'CF-ESTROGEN', tat: 24 }),
  lab('endocrinology', 'Prolactin', 'البرولاكتين', { code: 'LOINC-2842-3', tat: 24 }),
  lab('endocrinology', 'LH', 'LH', { code: 'LOINC-10501-5', tat: 24 }),
  lab('endocrinology', 'FSH', 'FSH', { code: 'LOINC-15067-2', tat: 24 }),
  img('endocrinology', 'Thyroid Ultrasound', 'سونار غدة درقية', { code: 'CF-US-THYROID', tat: 4 }),
  img('endocrinology', 'Pituitary MRI', 'رنين غدة نخامية', { code: 'CF-MRI-PITUITARY', tat: 48 }),
  img('endocrinology', 'DEXA Scan', 'قياس كثافة العظام', { code: 'CF-DEXA', tat: 24 }),

  // —— 7. Rheumatology ——
  lab('rheumatology', 'ESR', 'سرعة الترسيب', { code: 'LOINC-4537-7', tat: 6 }),
  lab('rheumatology', 'CRP', 'البروتين التفاعلي C', { code: 'LOINC-1988-5', tat: 6 }),
  lab('rheumatology', 'RF', 'عامل الروماتويد', { code: 'LOINC-11572-5', tat: 24 }),
  lab('rheumatology', 'Anti-CCP', 'Anti-CCP', { code: 'LOINC-33935-9', tat: 48 }),
  lab('rheumatology', 'ANA', 'ANA', { code: 'LOINC-42254-3', tat: 48 }),
  lab('rheumatology', 'Anti-dsDNA', 'Anti-dsDNA', { code: 'LOINC-5130-0', tat: 48 }),
  lab('rheumatology', 'ENA Profile', 'لوحة ENA', { code: 'CF-ENA', tat: 72 }),
  lab('rheumatology', 'HLA-B27', 'HLA-B27', { code: 'LOINC-26043-6', tat: 72 }),
  lab('rheumatology', 'C3', 'مكمل C3', { code: 'LOINC-4485-9', tat: 24 }),
  lab('rheumatology', 'C4', 'مكمل C4', { code: 'LOINC-4498-2', tat: 24 }),
  lab('rheumatology', 'Uric Acid', 'حمض اليوريك', { code: 'LOINC-3084-1', tat: 12 }),
  img('rheumatology', 'X-ray Joints', 'أشعة مفاصل', { code: 'CF-XR-JOINT', tat: 4 }),
  img('rheumatology', 'MRI Sacroiliac', 'رنين المفصل العجزي الحرقفي', { code: 'CF-MRI-SI', tat: 48 }),
  img('rheumatology', 'MRI Spine', 'رنين عمود فقري', { code: 'CF-MRI-SPINE', tat: 48 }),
  img('rheumatology', 'Musculoskeletal Ultrasound', 'سونار عضلي هيكلي', { code: 'CF-US-MSK', tat: 4 }),

  // —— 8. Neurology ——
  lab('neurology', 'Vitamin B12', 'فيتامين ب12', { code: 'LOINC-2132-9', tat: 48 }),
  lab('neurology', 'Vitamin D', 'فيتامين د', { code: 'LOINC-1989-3', tat: 48 }),
  lab('neurology', 'Electrolytes', 'الأملاح', { code: 'CF-ELECTROLYTES', tat: 6 }),
  lab('neurology', 'CK', 'إنزيم العضلات CK', { code: 'LOINC-2157-6', tat: 12 }),
  lab('neurology', 'Autoimmune Profile', 'لوحة مناعية ذاتية', { code: 'CF-AUTOIMMUNE', tat: 72 }),
  img('neurology', 'MRI Brain', 'رنين مخ', { code: 'CF-MRI-BRAIN', tat: 48 }),
  img('neurology', 'MRI Spine', 'رنين عمود فقري', { code: 'CF-MRI-SPINE', tat: 48 }),
  img('neurology', 'CT Brain', 'مقطعية مخ', { code: 'CF-CT-BRAIN', tat: 4 }),
  fn('neurology', 'EEG', 'رسم مخ كهربائي', { code: 'CF-EEG', tat: 24 }),
  fn('neurology', 'EMG', 'رسم عضلات', { code: 'CF-EMG', tat: 24 }),
  fn('neurology', 'Nerve Conduction Study', 'دراسة توصيل الأعصاب', { code: 'CF-NCS', tat: 24 }),
  img('neurology', 'Carotid Doppler', 'دوبلر شريان سباتي', { code: 'CF-DOPPLER-CAROTID', tat: 4 }),

  // —— 9. Orthopedics ——
  lab('orthopedics', 'Calcium', 'الكالسيوم', { code: 'LOINC-17861-6', tat: 12 }),
  lab('orthopedics', 'Vitamin D', 'فيتامين د', { code: 'LOINC-1989-3', tat: 48 }),
  lab('orthopedics', 'Phosphorus', 'الفوسفور', { code: 'LOINC-2777-1', tat: 12 }),
  lab('orthopedics', 'ALP', 'الفوسفاتاز القلوي', { code: 'LOINC-6768-6', tat: 12 }),
  lab('orthopedics', 'ESR', 'سرعة الترسيب', { code: 'LOINC-4537-7', tat: 6 }),
  lab('orthopedics', 'CRP', 'البروتين التفاعلي C', { code: 'LOINC-1988-5', tat: 6 }),
  img('orthopedics', 'X-ray', 'أشعة عادية', { code: 'CF-XR', tat: 2 }),
  img('orthopedics', 'CT Bone', 'مقطعية عظام', { code: 'CF-CT-BONE', tat: 24 }),
  img('orthopedics', 'MRI Joint', 'رنين مفصل', { code: 'CF-MRI-JOINT', tat: 48 }),
  img('orthopedics', 'Bone Scan', 'مسح عظام', { code: 'CF-BONE-SCAN', tat: 48 }),
  img('orthopedics', 'DEXA', 'قياس كثافة العظام', { code: 'CF-DEXA', tat: 24 }),

  // —— 10. ObGyn ——
  lab('obgyn', 'β-hCG', 'تحليل حمل β-hCG', { code: 'LOINC-21198-7', tat: 6 }),
  lab('obgyn', 'CBC', 'صورة دم كاملة', { code: 'LOINC-58410-2', tat: 6 }),
  lab('obgyn', 'Blood Group', 'فصيلة الدم', { code: 'LOINC-882-1', tat: 6 }),
  lab('obgyn', 'TORCH', 'TORCH', { code: 'CF-TORCH', tat: 72 }),
  lab('obgyn', 'Pap Smear', 'مسحة عنق الرحم', { code: 'CF-PAP', tat: 72, notes: 'باثولوجي' }),
  lab('obgyn', 'HPV', 'فيروس الورم الحليمي', { code: 'CF-HPV', tat: 72 }),
  lab('obgyn', 'AMH', 'مخزون المبيض AMH', { code: 'LOINC-79059-5', tat: 48 }),
  lab('obgyn', 'FSH', 'FSH', { code: 'LOINC-15067-2', tat: 24 }),
  lab('obgyn', 'LH', 'LH', { code: 'LOINC-10501-5', tat: 24 }),
  lab('obgyn', 'Estradiol', 'الإستراديول', { code: 'LOINC-2243-4', tat: 24 }),
  lab('obgyn', 'Progesterone', 'البروجستيرون', { code: 'LOINC-2839-9', tat: 24 }),
  lab('obgyn', 'Prolactin', 'البرولاكتين', { code: 'LOINC-2842-3', tat: 24 }),
  img('obgyn', 'Pelvic Ultrasound', 'سونار حوض', { code: 'CF-US-PELVIC', tat: 4 }),
  img('obgyn', 'TVS', 'سونار مهبلي', { code: 'CF-US-TVS', tat: 4 }),
  img('obgyn', 'Folliculometry', 'متابعة تبويض', { code: 'CF-FOLLICULOMETRY', tat: 2 }),
  img('obgyn', 'HSG', 'أشعة صبغية للرحم', { code: 'CF-HSG', tat: 24 }),
  fn('obgyn', 'NST', 'مراقبة نبض الجنين NST', { code: 'CF-NST', tat: 1 }),
  img('obgyn', 'Obstetric Ultrasound', 'سونار حمل', { code: 'CF-US-OB', tat: 2 }),

  // —— 11. Pediatrics ——
  lab('pediatrics', 'CBC', 'صورة دم كاملة', { code: 'LOINC-58410-2', tat: 6 }),
  lab('pediatrics', 'CRP', 'البروتين التفاعلي C', { code: 'LOINC-1988-5', tat: 6 }),
  lab('pediatrics', 'ESR', 'سرعة الترسيب', { code: 'LOINC-4537-7', tat: 6 }),
  lab('pediatrics', 'Stool Analysis', 'تحليل براز', { code: 'CF-STOOL', tat: 12 }),
  lab('pediatrics', 'Urine Analysis', 'تحليل بول', { code: 'CF-UA', tat: 4 }),
  lab('pediatrics', 'Blood Culture', 'مزرعة دم', { code: 'CF-BLOOD-CULTURE', tat: 72 }),
  lab('pediatrics', 'Electrolytes', 'الأملاح', { code: 'CF-ELECTROLYTES', tat: 6 }),
  lab('pediatrics', 'Bilirubin', 'البليروبين', { code: 'LOINC-1975-2', tat: 6 }),
  lab('pediatrics', 'G6PD', 'نقص G6PD', { code: 'LOINC-2356-4', tat: 48 }),
  lab('pediatrics', 'Neonatal Screening', 'مسح حديثي الولادة', { code: 'CF-NBS', tat: 72 }),
  img('pediatrics', 'Chest X-ray', 'أشعة صدر', { code: 'CF-CXR', tat: 4 }),
  img('pediatrics', 'Abdominal Ultrasound', 'سونار بطن', { code: 'CF-US-ABD', tat: 4 }),
  img('pediatrics', 'Brain Ultrasound', 'سونار مخ (يافوخ)', { code: 'CF-US-BRAIN', tat: 4 }),
  card('pediatrics', 'Echocardiography', 'إيكو قلب', { code: 'CF-ECHO', tat: 4 }),

  // —— 12. Dermatology ——
  lab('dermatology', 'CBC', 'صورة دم كاملة', { code: 'LOINC-58410-2', tat: 6 }),
  lab('dermatology', 'ANA', 'ANA', { code: 'LOINC-42254-3', tat: 48 }),
  lab('dermatology', 'IgE', 'الجلوبيولين IgE', { code: 'LOINC-19113-0', tat: 24 }),
  lab('dermatology', 'Allergy Tests', 'اختبارات حساسية', { code: 'CF-ALLERGY', tat: 48 }),
  lab('dermatology', 'Skin Scraping', 'كشط جلدي', { code: 'CF-SKIN-SCRAPE', tat: 24 }),
  lab('dermatology', 'Fungal Culture', 'مزرعة فطريات', { code: 'CF-FUNGAL-CULTURE', tat: 168 }),
  fn('dermatology', 'Patch Test', 'اختبار لاصق للحساسية', { code: 'CF-PATCH', tat: 72 }),
  proc('dermatology', 'Dermoscopy', 'منظار جلدي', { code: 'CF-DERMOSCOPY', tat: 1 }),
  bx('dermatology', 'Skin Biopsy', 'عينة جلد', { code: 'CF-SKIN-BX', tat: 120 }),

  // —— 13. ENT ——
  lab('ent', 'Throat Culture', 'مزرعة حلق', { code: 'CF-THROAT-CULTURE', tat: 48 }),
  lab('ent', 'CBC', 'صورة دم كاملة', { code: 'LOINC-58410-2', tat: 6 }),
  lab('ent', 'CRP', 'البروتين التفاعلي C', { code: 'LOINC-1988-5', tat: 6 }),
  fn('ent', 'Audiometry', 'مقياس سمع', { code: 'CF-AUDIO', tat: 2 }),
  fn('ent', 'Tympanometry', 'قياس طبلة الأذن', { code: 'CF-TYMPANO', tat: 2 }),
  endo('ent', 'Nasal Endoscopy', 'منظار أنف', { code: 'CF-NASAL-ENDO', tat: 1 }),
  img('ent', 'CT Sinuses', 'مقطعية جيوب أنفية', { code: 'CF-CT-SINUS', tat: 24 }),
  img('ent', 'MRI Neck', 'رنين رقبة', { code: 'CF-MRI-NECK', tat: 48 }),

  // —— 14. Ophthalmology ——
  fn('ophthalmology', 'Visual Acuity', 'حدة الإبصار', { code: 'CF-VA', tat: 1 }),
  fn('ophthalmology', 'Refraction', 'قياس النظر', { code: 'CF-REFRACTION', tat: 1 }),
  fn('ophthalmology', 'OCT', 'OCT شبكية', { code: 'CF-OCT', tat: 2 }),
  fn('ophthalmology', 'Fundus Photography', 'تصوير قاع العين', { code: 'CF-FUNDUS', tat: 2 }),
  fn('ophthalmology', 'Fluorescein Angiography', 'تصوير بالصبغة للعين', { code: 'CF-FA', tat: 4 }),
  fn('ophthalmology', 'Visual Field', 'مجال إبصار', { code: 'CF-VF', tat: 2 }),
  fn('ophthalmology', 'Corneal Topography', 'طبوغرافيا القرنية', { code: 'CF-CORNEAL-TOPO', tat: 2 }),
  img('ophthalmology', 'B-Scan Ultrasound', 'سونار عين B-Scan', { code: 'CF-US-BSCAN', tat: 2 }),

  // —— 15. Dentistry ——
  img('dentistry', 'Periapical X-ray', 'أشعة حول الذروة', { code: 'CF-XR-PA', tat: 1 }),
  img('dentistry', 'Bitewing X-ray', 'أشعة جناحية', { code: 'CF-XR-BW', tat: 1 }),
  img('dentistry', 'OPG', 'بانوراما أسنان', { code: 'CF-OPG', tat: 2 }),
  img('dentistry', 'CBCT', 'مقطعية مخروطية للأسنان', { code: 'CF-CBCT', tat: 4 }),
  lab('dentistry', 'CBC', 'صورة دم كاملة', { code: 'LOINC-58410-2', tat: 6, notes: 'عند الحاجة قبل إجراء' }),
  lab('dentistry', 'Bleeding Profile', 'اختبارات نزف', { code: 'CF-BLEEDING', tat: 6 }),
  lab('dentistry', 'Blood Sugar', 'سكر الدم', { code: 'LOINC-2339-0', tat: 2 }),
  lab('dentistry', 'PT/INR', 'PT/INR', { code: 'CF-PT-INR', tat: 6 }),
  lab('dentistry', 'HBV', 'فيروس الكبد B', { code: 'LOINC-5196-1', tat: 24 }),
  lab('dentistry', 'HCV', 'فيروس الكبد C', { code: 'LOINC-16128-1', tat: 24 }),

  // —— 16. General surgery ——
  lab('general_surgery', 'CBC', 'صورة دم كاملة', { code: 'LOINC-58410-2', tat: 6 }),
  lab('general_surgery', 'PT', 'PT', { code: 'LOINC-5902-2', tat: 6 }),
  lab('general_surgery', 'INR', 'INR', { code: 'LOINC-6301-6', tat: 6 }),
  lab('general_surgery', 'PTT', 'PTT', { code: 'LOINC-3173-2', tat: 6 }),
  lab('general_surgery', 'Blood Group', 'فصيلة الدم', { code: 'LOINC-882-1', tat: 6 }),
  lab('general_surgery', 'Kidney Function', 'وظائف الكلى', { code: 'CF-KFT', tat: 12 }),
  lab('general_surgery', 'Liver Function', 'وظائف الكبد', { code: 'CF-LFT', tat: 12 }),
  lab('general_surgery', 'Blood Sugar', 'سكر الدم', { code: 'LOINC-2339-0', tat: 2 }),
  lab('general_surgery', 'Electrolytes', 'الأملاح', { code: 'CF-ELECTROLYTES', tat: 6 }),
  img('general_surgery', 'Ultrasound', 'سونار', { code: 'CF-US', tat: 4 }),
  img('general_surgery', 'CT', 'مقطعية', { code: 'CF-CT', tat: 24 }),
  img('general_surgery', 'MRI', 'رنين', { code: 'CF-MRI', tat: 48 }),
  img('general_surgery', 'X-ray', 'أشعة عادية', { code: 'CF-XR', tat: 2 }),

  // —— 17. Oncology ——
  lab('oncology', 'CBC', 'صورة دم كاملة', { code: 'LOINC-58410-2', tat: 6 }),
  lab('oncology', 'Tumor Markers (CEA, AFP, CA125, CA19-9, PSA, CA15-3)', 'دلالات أورام', { code: 'CF-TUMOR-MARKERS', tat: 48 }),
  lab('oncology', 'LDH', 'LDH', { code: 'LOINC-2532-0', tat: 12 }),
  img('oncology', 'CT', 'مقطعية', { code: 'CF-CT', tat: 24 }),
  img('oncology', 'MRI', 'رنين', { code: 'CF-MRI', tat: 48 }),
  img('oncology', 'PET-CT', 'PET-CT', { code: 'CF-PET-CT', tat: 72, notes: 'تحضير خاص + صيام' }),
  img('oncology', 'Bone Scan', 'مسح عظام', { code: 'CF-BONE-SCAN', tat: 48 }),

  // —— 18. Hematology ——
  lab('hematology', 'CBC', 'صورة دم كاملة', { code: 'LOINC-58410-2', tat: 6 }),
  lab('hematology', 'Peripheral Blood Film', 'فيلم دم طرفي', { code: 'CF-PBF', tat: 24 }),
  lab('hematology', 'Reticulocyte Count', 'الشبكيات', { code: 'LOINC-14196-0', tat: 12 }),
  lab('hematology', 'Ferritin', 'الفيريتين', { code: 'LOINC-2276-4', tat: 24 }),
  lab('hematology', 'Iron Profile', 'مقارنة الحديد', { code: 'CF-IRON-PROFILE', tat: 24 }),
  lab('hematology', 'Vitamin B12', 'فيتامين ب12', { code: 'LOINC-2132-9', tat: 48 }),
  lab('hematology', 'Folate', 'حمض الفوليك', { code: 'LOINC-2284-8', tat: 48 }),
  bx('hematology', 'Bone Marrow Aspiration', 'شفط نخاع عظم', { code: 'CF-BMA', tat: 120 }),
  lab('hematology', 'Coombs Test', 'اختبار كومبس', { code: 'CF-COOMBS', tat: 24 }),
  lab('hematology', 'Hemoglobin Electrophoresis', 'فصل الهيموجلوبين', { code: 'CF-HB-EP', tat: 72 }),

  // —— 19. Infectious disease ——
  lab('infectious_disease', 'Blood Culture', 'مزرعة دم', { code: 'CF-BLOOD-CULTURE', tat: 72 }),
  lab('infectious_disease', 'Urine Culture', 'مزرعة بول', { code: 'CF-UC', tat: 48 }),
  lab('infectious_disease', 'Stool Culture', 'مزرعة براز', { code: 'CF-STOOL-CULTURE', tat: 72 }),
  lab('infectious_disease', 'Sputum Culture', 'مزرعة بلغم', { code: 'CF-SPUTUM-CULTURE', tat: 72 }),
  lab('infectious_disease', 'HIV', 'HIV', { code: 'LOINC-56888-1', tat: 24 }),
  lab('infectious_disease', 'HBsAg', 'فيروس الكبد B', { code: 'LOINC-5196-1', tat: 24 }),
  lab('infectious_disease', 'HCV', 'فيروس الكبد C', { code: 'LOINC-16128-1', tat: 24 }),
  lab('infectious_disease', 'Dengue', 'حمى الضنك', { code: 'CF-DENGUE', tat: 24 }),
  lab('infectious_disease', 'Malaria', 'الملاريا', { code: 'CF-MALARIA', tat: 6 }),
  lab('infectious_disease', 'Typhoid', 'التيفوئيد', { code: 'CF-TYPHOID', tat: 24 }),
  lab('infectious_disease', 'Brucella', 'البروسيلا', { code: 'CF-BRUCELLA', tat: 48 }),

  // —— 20. Psychiatry ——
  lab('psychiatry', 'CBC', 'صورة دم كاملة', { code: 'LOINC-58410-2', tat: 6, notes: 'قبل بدء العلاج أو لاستبعاد سبب عضوي' }),
  lab('psychiatry', 'TSH', 'TSH', { code: 'LOINC-3016-3', tat: 24 }),
  lab('psychiatry', 'Vitamin B12', 'فيتامين ب12', { code: 'LOINC-2132-9', tat: 48 }),
  lab('psychiatry', 'Vitamin D', 'فيتامين د', { code: 'LOINC-1989-3', tat: 48 }),
  lab('psychiatry', 'Electrolytes', 'الأملاح', { code: 'CF-ELECTROLYTES', tat: 6 }),
  lab('psychiatry', 'Liver Function', 'وظائف الكبد', { code: 'CF-LFT', tat: 12 }),
  lab('psychiatry', 'Kidney Function', 'وظائف الكلى', { code: 'CF-KFT', tat: 12 }),
  lab('psychiatry', 'Blood Sugar', 'سكر الدم', { code: 'LOINC-2339-0', tat: 2 }),

  // —— 21. Neurosurgery ——
  img('neurosurgery', 'CT Brain', 'مقطعية مخ', { code: 'CF-CT-BRAIN', tat: 4 }),
  img('neurosurgery', 'MRI Brain', 'رنين مخ', { code: 'CF-MRI-BRAIN', tat: 48 }),
  img('neurosurgery', 'MRI Spine', 'رنين عمود فقري', { code: 'CF-MRI-SPINE', tat: 48 }),
  img('neurosurgery', 'Cerebral Angiography', 'تصوير أوعية المخ', { code: 'CF-CEREBRAL-ANGIO', tat: 24 }),
  img('neurosurgery', 'Spine X-ray', 'أشعة عمود فقري', { code: 'CF-XR-SPINE', tat: 2 }),
  lab('neurosurgery', 'CBC', 'صورة دم كاملة', { code: 'LOINC-58410-2', tat: 6 }),
  lab('neurosurgery', 'Coagulation Profile', 'اختبارات تجلط', { code: 'CF-COAG', tat: 6 }),
  lab('neurosurgery', 'Electrolytes', 'الأملاح', { code: 'CF-ELECTROLYTES', tat: 6 }),

  // —— 22. Plastic surgery ——
  lab('plastic_surgery', 'CBC', 'صورة دم كاملة', { code: 'LOINC-58410-2', tat: 6 }),
  lab('plastic_surgery', 'PT/INR', 'PT/INR', { code: 'CF-PT-INR', tat: 6 }),
  lab('plastic_surgery', 'Blood Sugar', 'سكر الدم', { code: 'LOINC-2339-0', tat: 2 }),
  lab('plastic_surgery', 'Viral Markers', 'دلالات فيروسية', { code: 'CF-VIRAL-MARKERS', tat: 24 }),
  lab('plastic_surgery', 'Kidney Function', 'وظائف الكلى', { code: 'CF-KFT', tat: 12 }),
  lab('plastic_surgery', 'Liver Function', 'وظائف الكبد', { code: 'CF-LFT', tat: 12 }),

  // —— 23. Nutrition ——
  lab('nutrition', 'HbA1c', 'السكر التراكمي', { code: 'LOINC-4548-4', tat: 24 }),
  lab('nutrition', 'Lipid Profile', 'دهون الدم', { code: 'CF-LIPID', fasting: true, tat: 12 }),
  lab('nutrition', 'TSH', 'TSH', { code: 'LOINC-3016-3', tat: 24 }),
  lab('nutrition', 'Vitamin D', 'فيتامين د', { code: 'LOINC-1989-3', tat: 48 }),
  lab('nutrition', 'Vitamin B12', 'فيتامين ب12', { code: 'LOINC-2132-9', tat: 48 }),
  lab('nutrition', 'Ferritin', 'الفيريتين', { code: 'LOINC-2276-4', tat: 24 }),
  lab('nutrition', 'Iron', 'الحديد', { code: 'LOINC-2498-4', tat: 24 }),
  lab('nutrition', 'Zinc', 'الزنك', { code: 'LOINC-5763-4', tat: 48 }),
  lab('nutrition', 'Magnesium', 'الماغنسيوم', { code: 'LOINC-19123-9', tat: 12 }),
]

function sqlStr(v) {
  if (v == null) return 'null'
  return `'${String(v).replace(/'/g, "''")}'`
}

function generate() {
  const lines = []
  lines.push('-- Seed: medical exam specialties + catalog (generated)')
  lines.push('-- Re-run safe: upserts by primary/unique keys')
  lines.push('')
  lines.push('insert into public.medical_exam_specialties (id, name_ar, name_en, sort_order) values')
  lines.push(
    SPECIALTIES.map(
      (s) => `  (${sqlStr(s.id)}, ${sqlStr(s.nameAr)}, ${sqlStr(s.nameEn)}, ${s.sort})`,
    ).join(',\n') +
      '\non conflict (id) do update set name_ar = excluded.name_ar, name_en = excluded.name_en, sort_order = excluded.sort_order;',
  )
  lines.push('')

  // Assign sort_order per specialty
  const counters = {}
  lines.push('insert into public.medical_exams (')
  lines.push(
    '  specialty_id, exam_kind, category, name_ar, name_en, code, requires_fasting, result_tat_hours, doctor_notes, sort_order',
  )
  lines.push(') values')
  const values = EXAMS.map((x) => {
    counters[x.specialty] = (counters[x.specialty] ?? 0) + 1
    const sort = counters[x.specialty]
    return `  (${sqlStr(x.specialty)}, ${sqlStr(x.kind)}, ${sqlStr(x.category)}, ${sqlStr(x.nameAr)}, ${sqlStr(x.nameEn)}, ${sqlStr(x.code)}, ${x.fasting}, ${x.tat ?? 'null'}, ${sqlStr(x.notes)}, ${sort})`
  })
  lines.push(values.join(',\n'))
  lines.push('on conflict (specialty_id, name_en) do update set')
  lines.push('  exam_kind = excluded.exam_kind,')
  lines.push('  category = excluded.category,')
  lines.push('  name_ar = excluded.name_ar,')
  lines.push('  code = excluded.code,')
  lines.push('  requires_fasting = excluded.requires_fasting,')
  lines.push('  result_tat_hours = excluded.result_tat_hours,')
  lines.push('  doctor_notes = excluded.doctor_notes,')
  lines.push('  sort_order = excluded.sort_order,')
  lines.push('  is_active = true;')
  lines.push('')
  lines.push(`-- Seeded ${SPECIALTIES.length} specialties, ${EXAMS.length} exams`)

  return lines.join('\n')
}

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '..', 'supabase', 'migrations', '013_medical_exams_seed.sql')
writeFileSync(out, generate(), 'utf8')
console.log(`Wrote ${out} (${SPECIALTIES.length} specialties, ${EXAMS.length} exams)`)
