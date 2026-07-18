# ClinicFlow — Implementation Spec (for Claude Code)

> هذا الملف مرجع تنفيذي لـ Claude Code لبناء الـ MVP الخاص بـ ClinicFlow. مبني على PRD رسمي متفق عليه. اقرأه كامل قبل أي تنفيذ، ونفّذ بالترتيب المحدد في قسم "خطة التنفيذ بالأسابيع".

## 1. نظرة عامة على المشروع

ClinicFlow منصة SaaS لإدارة العيادات الخاصة في مصر. تدير: المرضى، الكارت الطبي، الحجوزات، الكشوفات، الروشتات، الفواتير، والتقارير. متعددة المستأجرين (multi-tenant) بحيث تخدم عدة عيادات من نفس التطبيق.

**نطاق هذا الملف: الـ MVP فقط.** أي ميزة مذكورة في PRD الأصلي ضمن "المرحلة الثانية" أو "المرحلة الثالثة" **خارج النطاق** الآن ولا يجب تنفيذها إلا إذا طُلب صراحة.

## 2. القرارات التقنية الثابتة (لا تُغيَّر بدون تأكيد)

| المحور | القرار |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend/DB/Auth/Storage | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Hosting | Vercel (frontend) + Supabase (backend) |
| Multi-tenancy | Shared DB، عمود `tenant_id` على كل جدول رئيسي، معزول عبر **Row Level Security (RLS)** — إلزامي وليس اختياري |
| تسجيل الدخول | إيميل + باسورد عبر Supabase Auth |
| اللغة | عربي (افتراضي) + إنجليزي، دعم كامل RTL/LTR من أول commit |
| الطباعة | قالب A4 وقالب طابعة حرارية للروشتة/الفاتورة، الاختيار من إعدادات العيادة |
| الفروع المتعددة | غير مدعومة في MVP — كل حساب عيادة = فرع واحد |
| بوابة الدفع | غير مُفعّلة في MVP. تُبنى شاشة الاشتراك والفوترة بحقل "طريقة الدفع" كنص/يدوي مؤقتًا (بدون تكامل فعلي)، مع ترك نقطة تكامل واضحة (`lib/billing/provider.ts`) لإضافة Paymob/Fawry لاحقًا دون إعادة هيكلة |
| التذكيرات (واتساب/SMS) | خارج نطاق الـ MVP بالكامل |

## 3. بنية قاعدة البيانات (Postgres / Supabase)

كل جدول (باستثناء `tenants` و`users` نفسها) لازم يحتوي `tenant_id uuid not null references tenants(id)` + سياسة RLS تمنع أي استعلام لا يطابق `tenant_id` الخاص بالمستخدم الحالي (عبر `auth.jwt()` claim أو دالة `current_tenant_id()`).

### الجداول الأساسية

```
tenants
  id, name, logo_url, address, phone, working_hours (jsonb),
  default_language ('ar'|'en'), print_format ('a4'|'thermal'|'both'),
  subscription_plan ('starter'|'professional'|'enterprise'),
  trial_ends_at, created_at

users
  id (= supabase auth uid), tenant_id, full_name, email, role
  role: 'doctor' | 'secretary' | 'super_admin'

patients
  id, tenant_id, full_name, phone, national_id, birth_date, gender,
  occupation, address, marital_status, blood_type, insurance_provider,
  emergency_contact_name, emergency_contact_phone,
  file_number (auto-sequence per tenant), created_at

medical_history
  id, patient_id, tenant_id,
  chronic_diseases, surgeries, allergies, hereditary_diseases,
  smoking (bool), alcohol (bool), pregnancy_status, vaccinations (jsonb)

vital_signs
  id, patient_id, tenant_id, visit_id (nullable),
  blood_pressure, blood_sugar, weight, height, temperature, pulse, oxygen_saturation, recorded_at

visits
  id, tenant_id, patient_id, doctor_id,
  visit_date, chief_complaint, history_of_present_illness, clinical_exam,
  diagnosis, treatment_plan, notes, follow_up_date, status

prescriptions
  id, tenant_id, visit_id, template_id (nullable), created_at
prescription_items
  id, prescription_id, drug_name, dosage, duration, notes

lab_requests / radiology_requests
  id, tenant_id, visit_id, items (jsonb or child table), status, created_at

attachments
  id, tenant_id, patient_id, visit_id (nullable),
  file_url, file_type ('image'|'pdf'|'lab'|'radiology'|'report'), uploaded_at

appointments
  id, tenant_id, patient_id, doctor_id,
  scheduled_at, duration_minutes, status
  status: 'waiting' | 'with_doctor' | 'done' | 'no_show' | 'cancelled'

invoices
  id, tenant_id, patient_id, visit_id (nullable),
  consultation_fee, discounts, services (jsonb), total, payment_method, paid_at, created_at

cash_register_entries
  id, tenant_id, type ('revenue'|'expense'|'refund'), amount, description, created_at

permissions
  id, tenant_id, user_id, module, can_view, can_edit, can_delete

audit_log
  id, tenant_id, user_id, action, entity_type, entity_id, created_at
```

> **إلزامي:** أي جدول فيه بيانات مريض حساسة (patients, medical_history, visits, attachments) لازم يتسجل عليه دخول/تعديل في `audit_log`.

## 4. المصادقة والصلاحيات

- Supabase Auth (إيميل + باسورد). لا حاجة لـ OTP أو Magic Link في MVP.
- الأدوار: `doctor`, `secretary` داخل العيادة، و`super_admin` لمتابعة العيادات والاشتراكات.
- `super_admin` بدون `tenant_id` (Global) — يدير العيادات والاشتراكات عبر لوحة منفصلة `/admin`.
- كل صفحة/API route تتحقق من الدور قبل تنفيذ أي عملية حساسة (مثال: السكرتيرة لا تفتح شاشة التقارير المالية الكاملة).

## 5. الميزات المطلوبة في الـ MVP (بالترتيب)

### 5.1 تسجيل الدخول والإعداد الأولي
- شاشة تسجيل دخول (إيميل/باسورد)
- Onboarding: إنشاء العيادة لأول مرة (اسم، لغة افتراضية، تنسيق طباعة) + بدء الفترة التجريبية (7–14 يوم، قابلة للضبط من إعدادات super_admin)

### 5.2 إدارة المرضى
- إضافة/تعديل مريض (كل الحقول المذكورة في قسم 3)
- استيراد جماعي من Excel/CSV: رفع ملف → شاشة مطابقة أعمدة → معاينة → استيراد → تقرير الصفوف الفاشلة
- بحث بالاسم/الهاتف/الرقم القومي/رقم الملف
- الكارت الطبي: التاريخ المرضي + العلامات الحيوية
- الزيارات: سجل كامل بكل الحقول
- المرفقات: رفع صور/PDF لكل مريض أو زيارة (Supabase Storage)

### 5.3 الحجوزات وشاشة الانتظار
- إنشاء/تعديل/إلغاء/إعادة جدولة حجز
- شاشة انتظار حية بالحالات الخمس
- تقويم بعرض يوم/أسبوع/شهر

### 5.4 الكشف
- شاشة كشف: تشخيص، علاج، روشتة، طلب تحاليل، طلب أشعة، طلب عملية، تحديد متابعة
- روشتة: قوالب جاهزة + أدوية مفضلة لكل طبيب + طباعة PDF (A4/حرارية)
- طلب تحاليل/أشعة: قوالب + طباعة

### 5.5 الفواتير والخزنة
- فاتورة الزيارة: قيمة الكشف، خصومات، خدمات إضافية، إجمالي، طريقة دفع، طباعة
- الخزنة: إيرادات/مصروفات/مرتجعات/رصيد يومي

### 5.6 Dashboard
كل المؤشرات المذكورة في PRD (مرضى اليوم، حجوزات، منتظرين، متابعات، إيرادات، غياب، متوسط وقت الانتظار، أكثر الأمراض/الأدوية/التحاليل، رسمين بيانيين).

### 5.7 التقارير
تقارير المرضى، الإيرادات، الطبيب، الأمراض — كما في PRD قسم 9، بفلتر تاريخ (يومي/أسبوعي/شهري/سنوي).

### 5.8 الإعدادات والصلاحيات
- بيانات العيادة، الشعار، مواعيد العمل، أسعار الكشف، الضرائب، لغة الواجهة، تنسيق الطباعة الافتراضي
- شاشة صلاحيات لكل مستخدم/موديول

## 6. متطلبات غير وظيفية إلزامية

- **RLS مفعّلة على كل جدول** قبل أي دمج (merge) — لا استثناءات.
- **i18n**: كل نص في الواجهة عبر مكتبة ترجمة (`react-i18next` أو مشابه)، لا نصوص hardcoded. اتجاه الصفحة (`dir`) يتغير تلقائيًا حسب اللغة.
- **Audit log** على عمليات القراءة/الكتابة الحساسة كما في قسم 3.
- **الاستجابة (Responsive)**: كل شاشة تعمل بشكل سليم على الموبايل (لا يوجد تطبيق موبايل منفصل في MVP).
- لا تستخدم `localStorage`/`sessionStorage` لأي بيانات مريض حساسة.

## 7. خطة التنفيذ بالأسابيع (نطاق واقعي لمطور واحد)

> ملاحظة مهمة: تنفيذ كل ما سبق في شهر واحد بمطور فردي **غير واقعي بالكامل**. الخطة هنا مقسمة إلى نواة أساسية (أسبوعين) قابلة للاستخدام الفعلي، ثم دفعة تكميلية (أسبوعين إضافيين) لباقي النطاق.

**الأسبوع 1** — البنية التحتية + المرضى
- إعداد Supabase (schema + RLS) حسب قسم 3
- Auth + الأدوار
- Onboarding + إعدادات العيادة الأساسية
- إدارة المرضى الكاملة (إضافة، بحث، كارت طبي) + استيراد Excel/CSV

**الأسبوع 2** — الحجوزات + الكشف
- الحجوزات + شاشة الانتظار + التقويم
- شاشة الكشف + الروشتة (بدون طباعة حرارية بعد، PDF فقط)
- Dashboard بالمؤشرات الأساسية (بدون الرسوم البيانية المتقدمة)

→ **هنا نواة MVP قابلة للاستخدام الفعلي في عيادة حقيقية.**

**الأسبوع 3** — الفواتير + الخزنة + الطباعة
- الفواتير والخزنة الكاملة
- دعم طباعة A4 + حرارية
- طلبات التحاليل/الأشعة بالقوالب

**الأسبوع 4** — التقارير + الصقل
- شاشات التقارير الأربعة
- شاشة الصلاحيات التفصيلية
- Audit log كامل + مراجعة أمنية لـ RLS
- اختبار شامل + إصلاح أخطاء

## 8. خارج النطاق صراحة (لا تنفّذه إلا لو طُلب)

- واتساب / SMS / تذكيرات تلقائية
- تطبيق موبايل مستقل
- الفروع المتعددة
- تكامل فعلي مع بوابة دفع
- أي ميزة AI (تشخيص، صوت لكشف، OCR، Chatbot)

## 9. متغيرات البيئة المتوقعة

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## 10. تعليمات عامة لـ Claude Code

- ابدأ دائمًا بإعداد الـ schema وسياسات RLS قبل أي شاشة UI.
- كل Migration جديدة لازم يترافق معها اختبار يدوي بسيط يثبت إن عيادة A لا تقدر تشوف بيانات عيادة B.
- اتبع ترتيب الأسابيع في قسم 7 بالحرف — لا تقفز لميزة لاحقة قبل إنهاء التي قبلها.
- أي غموض في التفاصيل غير محسوم هنا (مثل نص تحديد شكل الفاتورة بالضبط) — اختر أبسط تنفيذ ممكن يفي بالمتطلبات، ولا تتوقف لطلب توضيح إلا لو كان القرار سيغيّر بنية قاعدة البيانات.
