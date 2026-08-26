// The 47 counties of Kenya, with their official numeric county codes
// (001-047) per the Constitution's First Schedule / IEBC numbering.
// Any form displays the name; the numeric code is what's stored in
// countyCode and sent to the API, keeping it consistent with the
// codes used in the government/platform-admin modules and tests.
//
// Extracted from OnboardTenantForm.tsx (the platform_admin onboarding
// wizard) so the public school-application form uses the exact same
// list rather than a second, independently-typed copy that could
// silently drift out of sync with it.
export const KENYA_COUNTIES: { name: string; code: string }[] = [
  { name: 'Baringo', code: '030' },
  { name: 'Bomet', code: '036' },
  { name: 'Bungoma', code: '039' },
  { name: 'Busia', code: '040' },
  { name: 'Elgeyo-Marakwet', code: '028' },
  { name: 'Embu', code: '014' },
  { name: 'Garissa', code: '007' },
  { name: 'Homa Bay', code: '043' },
  { name: 'Isiolo', code: '011' },
  { name: 'Kajiado', code: '034' },
  { name: 'Kakamega', code: '037' },
  { name: 'Kericho', code: '035' },
  { name: 'Kiambu', code: '022' },
  { name: 'Kilifi', code: '003' },
  { name: 'Kirinyaga', code: '020' },
  { name: 'Kisii', code: '045' },
  { name: 'Kisumu', code: '042' },
  { name: 'Kitui', code: '015' },
  { name: 'Kwale', code: '002' },
  { name: 'Laikipia', code: '031' },
  { name: 'Lamu', code: '005' },
  { name: 'Machakos', code: '016' },
  { name: 'Makueni', code: '017' },
  { name: 'Mandera', code: '009' },
  { name: 'Marsabit', code: '010' },
  { name: 'Meru', code: '012' },
  { name: 'Migori', code: '044' },
  { name: 'Mombasa', code: '001' },
  { name: "Murang'a", code: '021' },
  { name: 'Nairobi', code: '047' },
  { name: 'Nakuru', code: '032' },
  { name: 'Nandi', code: '029' },
  { name: 'Narok', code: '033' },
  { name: 'Nyamira', code: '046' },
  { name: 'Nyandarua', code: '018' },
  { name: 'Nyeri', code: '019' },
  { name: 'Samburu', code: '025' },
  { name: 'Siaya', code: '041' },
  { name: 'Taita-Taveta', code: '006' },
  { name: 'Tana River', code: '004' },
  { name: 'Tharaka-Nithi', code: '013' },
  { name: 'Trans Nzoia', code: '026' },
  { name: 'Turkana', code: '023' },
  { name: 'Uasin Gishu', code: '027' },
  { name: 'Vihiga', code: '038' },
  { name: 'Wajir', code: '008' },
  { name: 'West Pokot', code: '024' }
];

export const KENYA_COUNTY_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  KENYA_COUNTIES.map((c) => [c.code, c.name])
);
