/* Irish schemes Jarvis can check. Facts come from the official pages named in `source`; `verified` is the day they were last checked.
   2026-11-11 check was done from search extracts of gov.ie / citizensinformation.ie (the pages could not be opened from the build machine):
   re-read the pages before changing any number. The provider confirms eligibility at the visit. */
(function(root){
const GOV="https://www.gov.ie/en/department-of-social-protection/services/treatment-benefit-scheme/";
const PRSI_RULES=[
  {field:"work",in:["employee","self"],ask:"Are you working?",
   no:"It needs PRSI from work (classes A, E, P, H or S). Older contributions can still count: check on MyWelfare."},
  // paid contributions needed in total: 39 weeks under 29, 260 weeks (5 years) from 29
  {field:"prsi_years",weeksByAge:{"u21":39,"21-24":39,"25-28":39,"29-65":260,"66+":260},ask:"How long have you paid PRSI?",
   no:"Not enough PRSI yet: under 29 needs about 9 months paid, 29 and over needs about 5 years."},
  // plus the governing year (second-last full tax year): 39 weeks paid or credited
  {field:"prsi_recent",is:"yes",ask:"Did you pay PRSI for most of the year two years back?",
   no:"It needs about 9 months of PRSI in the tax year two years back (or 6 months in each of the two years before last)."}
];
const SCHEMES=[
 {id:"prsi-dental",icon:"🦷",name:"Free dental check-up (PRSI Treatment Benefit)",short:"Dental check-up",teaser:"free exam this year",
  get:"A free dental exam once every calendar year. A scale and polish costs you at most €15.",
  catch:"Only at dentists on the scheme. It resets on 1 January: unused visits don't carry over.",
  provider:"dentist",providerTip:"You don't apply. The dentist checks your PRSI record at the visit with your PPS number and date of birth.",
  cta:"Book my check-up",renews:{type:"calendar_year"},keywords:["dentist","dental","teeth","tooth","scale and polish","daant"],
  draft:{subject:"Appointment request: PRSI dental exam",ask:"I'd like to book a dental examination and a scale and polish under the PRSI Treatment Benefit Scheme."},
  panel:"https://www.gov.ie/en/department-of-social-protection/collections/treatment-benefit-scheme-list-of-dentists/",
  rules:PRSI_RULES,source:GOV,verified:"11 Nov 2026"},
 {id:"prsi-optical",icon:"👓",name:"Free eye test (PRSI Treatment Benefit)",short:"Eye test",teaser:"free every 2nd year",
  get:"A free eyesight test once every second calendar year, plus money towards glasses or contact lenses.",
  catch:"Only at opticians on the scheme. Tests for a driving licence or screen work aren't covered.",
  provider:"optician",providerTip:"You don't apply. The optician checks your PRSI record with your PPS number and date of birth. Many take bookings online.",
  cta:"Book my eye test",renews:{type:"calendar_years",n:2},keywords:["eye test","eyesight","optician","glasses","contact lens","specs","chashma","aankh"],
  draft:{subject:"Appointment request: PRSI eye test",ask:"I'd like to book an eyesight test under the PRSI Treatment Benefit Scheme."},
  panel:"https://www.gov.ie/en/collection/e67dc0-list-of-dispensing-opticians-optometrists-and-ophthalmologists/",
  rules:PRSI_RULES,source:GOV,verified:"11 Nov 2026"}
];
root.SCHEMES=SCHEMES; if(typeof module!=="undefined")module.exports=SCHEMES;
})(typeof window!=="undefined"?window:globalThis);
