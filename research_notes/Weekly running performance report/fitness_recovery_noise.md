# Tracking aerobic fitness and recovery for one recreational runner, and telling signal from noise

Scope note for the writer: "Derived" marks my own arithmetic on cited numbers. Anything under Inferences is my reasoning, not a published result. Most papers were read as full text (via Europe PMC XML) or PubMed abstracts; where only a secondary summary was available this is stated.

## Efficiency factor, pace at fixed heart rate, aerobic decoupling

### Takeaway
EF (speed per heartbeat) and pace at fixed HR are the right family of signal: submaximal exercise HR has the best signal-to-noise ratio of any HR measure in Buchheit's table (about 3% noise, 1.6 signal-to-noise). But they are coaching constructs without published reliability for EF itself, and the direction is ambiguous, because lower HR at the same pace can also mean fatigue. Decoupling needs long, steady runs with continuous HR, so with sparse wrist HR it should be treated as optional or not computed.

### Cited Findings

**Definitions and formulas**
- EF: "TrainingPeaks divides normalized power or normalized graded pace by average heart rate." For running, normalized graded pace is converted to Normalized Graded Speed, then divided by average HR — [TrainingPeaks, Efficiency Factor and Decoupling](https://www.trainingpeaks.com/learn/articles/efficiency-factor-and-decoupling/)
- Decoupling: compare EF of the two halves of a workout or segment; (first-half EF − second-half EF) / first-half EF, as a percentage. Positive means the second half declined — [TrainingPeaks](https://www.trainingpeaks.com/learn/articles/efficiency-factor-and-decoupling/). Friel's wording: "Subtract the second half quotient from the first half quotient and divide the answer by the first half quotient" — [Friel via TrainingPeaks](https://www.trainingpeaks.com/coach-blog/aerobic-endurance-and-decoupling/)
- Validity conditions: the workout must be fully aerobic (below lactate threshold) and steady (low Variability Index). Compare EF only across similar steady aerobic sessions over several weeks, keeping fatigue, equipment, course, weather, altitude, caffeine and nutrition, warm-up and time of day consistent — [TrainingPeaks](https://www.trainingpeaks.com/learn/articles/efficiency-factor-and-decoupling/)
- Warm-up and cool-down are excluded in TrainingPeaks' cycling example; running exclusion is not stated explicitly — [TrainingPeaks, aerobic endurance and decoupling](https://www.trainingpeaks.com/learn/articles/aerobic-endurance-and-decoupling/)

**Thresholds (practitioner, not research-derived)**
- Under 5% = strong aerobic endurance at that intensity; 5–10% = moderate limitation or fatigue; over 10% = likely above aerobic threshold or lacks endurance. TrainingPeaks says there is no hard research-based rule. Practical test length for running is 1–2 hours at aerobic threshold (events under 1 hour use 1 hour; over 2 hours cap at 2 hours) — [TrainingPeaks](https://www.trainingpeaks.com/learn/articles/aerobic-endurance-and-decoupling/)
- Drift can also reflect rising core temperature, dehydration, glycogen depletion, prior fatigue, or intensity too high. Trends across sessions at the same intensity are clearer than single results — [TrainingPeaks](https://www.trainingpeaks.com/learn/articles/aerobic-endurance-and-decoupling/)
- Altini uses a first-half/second-half ratio near one, or below about 1.03–1.05, as little drift. Trails, very short workouts and environment distort it — [HRV4Training, cardiac decoupling](https://www.hrv4training.com/blog2/cardiac-decoupling). He also notes flat runs alone show little change in pace over HR, which makes progress hard to track — [HRV4Training, hilly runs](https://www.hrv4training.com/blog2/improved-vo2max-model-for-hilly-runs)
- In marathons, decoupling onset was reported at 33.4 km in a low-decoupling group vs 19.1 km in a high-decoupling group (82,303 recreational runners, Smyth et al., reported in an opinion article, not primary) — [Frontiers 2025 opinion](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2025.1571498/full)

**Peer-reviewed support for the underlying idea (submaximal exercise HR, HRex)**
- HRex typical error about 3% CV, signal-to-noise 1.6, smallest worthwhile change about −1%. Compare resting HR (about 10%, 0.7, about −2%) — [Buchheit 2014, Table 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/)
- At least 3–4 min of exercise is generally needed to reach steady state; the last 30–60 s average is used. Beat-by-beat data are not needed — [Buchheit 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/)
- "An increased HR should not be used as a clear marker of fatigue and/or fitness impairment." Table 2: HRex down = fitness improvement, lower relative intensity, plasma volume expansion; HRex up = "Unclear; doesn't necessarily indicate decreased performance capacity" — [Buchheit 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/)
- HR day-to-day variation falls as intensity rises (61–98% HRmax tested); lowest about 3 ± 1 bpm at 85–90% HRmax, and the authors recommend a protocol eliciting 85–90% — [Lamberts & Lambert 2009](https://doi.org/10.1519/JSC.0b013e3181a2dcdc). So easy-run HR is intrinsically noisier than tempo HR.
- Standardized 5-min submaximal shuttle run in elite badminton players: within-player CV 1.3% (90% CI 1.2–1.5%) at about 173 bpm. HRex was 1.5% *lower* in the strained state than the recovered state — [Schneider et al. 2020](https://doi.org/10.1371/journal.pone.0244412)
- Long-term overload produced a small decrease in submaximal HR (SMD −0.38, p = 0.006) and maximal HR (SMD −0.33) — [Bosquet et al. 2008](https://pubmed.ncbi.nlm.nih.gov/18308872/). So a falling HR at given pace is not automatically good.
- HR-running speed index, from every continuous run in 45 recreational runners over 28 weeks, using exercise HR, speed, resting and max HR and max speed. Change in index correlated with change in peak treadmill speed (r = 0.43–0.61), speed at respiratory compensation (r = 0.35–0.39) and VO2max (r = 0.49) — [Vesterinen et al. 2014](https://doi.org/10.1519/JSC.0000000000000349). Later described as the difference between theoretical and measured speed/power at a given HR — [Nuuttila et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11235883/). This is the closest peer-reviewed equivalent of "pace at fixed HR" from everyday runs. Nuuttila's version used a Polar H10 chest strap, so its performance on wrist HR is untested.
- The HR-running power index was one of three markers with ≥85% positive and negative predictive value for separating overreached from responding recreational runners (n = 24; small and post hoc) — [Nuuttila et al. 2024](https://doi.org/10.1002/ejsc.12115)
- Altini defines aerobic efficiency as the pace-to-HR relationship, improvement being consistently lower HR at the same pace over weeks — [HRV4Training](https://www.hrv4training.com/blog2/aerobic-efficiency-and-the-treadmill)

### Inferences
- Preferred metric for this app: regression-based pace at a reference HR rather than raw EF. Fit log(hill-adjusted speed) against HR across recent qualifying runs, read off speed at a fixed HR, because EF assumes HR is proportional to speed through the origin, which it is not. A resting-HR-corrected form, speed / (HR − RHR), is a cheap variant. Both untested on wrist data.
- Qualifying-run filter: continuous run, at least 20 min after excluding the first 5–10 min, steady pace, easy to moderate effort (RPE about 3–6), not intervals, HR coverage above a set fraction. The numbers are design choices, anchored only on the 3–4 min steady-state rule.
- Report in percent and in bands, never as an EF value with three decimals. Never call a fall in HR at the same pace "fitter" on its own; require RPE or feel to be stable or better, since Schneider and Bosquet show fatigue can lower HR.
- Decoupling: compute only for runs of at least about 60 min, steady, flat or hill-adjusted, cool, with HR samples present through both halves. For most sparse-HR runs show nothing. A pace-only analogue (fade of hill-adjusted pace at constant RPE) needs no HR.

### Gaps
- No peer-reviewed test-retest reliability for EF or Pa:Hr found, and no published minimum HR sampling density. How much HR data is enough is therefore unresolved; the steady-state rule and 1/√n are the only anchors.
- Day-to-day noise of EF was not found directly. Derived estimate: combine HR noise of about 3% with pace and weather residuals, about 3–5% per run in the field. This is a guess until computed from the user's own data.
- The exact Vesterinen index formula was not retrieved (paywalled); only its inputs and verbal description.
- The origin of the 5% figure is attributed to Friel only by secondary sources and Friel's own writing, with no validating study.

## Accuracy of cheap wrist heart rate during running, and rejecting bad data

### Takeaway
Cheap optical wrist HR is usable as a per-run average at steady effort but has about 6–8% mean error for a Mi Band class device, underestimates, and throws extreme outliers. That is several times larger than the smallest worthwhile change in HRex (about 1%), so a single run's HR says almost nothing about fitness change. No peer-reviewed Amazfit running validation was found.

### Cited Findings
- Xiaomi Mi Band 2 vs Polar H7, moderate indoor exercise, 20 young and 20 older adults: MAPE 7.69% (young), 6.04% (older); Garmin Vivosmart HR+ 3.77% and 4.73%. CCC for Xiaomi 0.76 and 0.73, for Garmin 0.92 and 0.80. Both underestimated average HR. Devices "have a tendency to produce erroneous, extreme readings" — [Chow & Yang 2020](https://doi.org/10.2196/14707)
- Xiaomi Mi Band 5 vs ECG in 78 cardiac patients, graded test: concordance rc > 0.90 in all conditions, but accuracy fell at higher HR; good below 100 bpm and less accurate at moderate and high intensity — [Kim et al. 2022](https://doi.org/10.5535/arm.22050)
- Absolute error during activity averaged 30% higher than at rest; no significant skin-tone difference; significant differences between devices. All were reasonably accurate at rest and at prolonged elevated HR, but differed in responding to changes in activity — [Bent et al. 2020](https://doi.org/10.1038/s41746-020-0226-6)
- Six wrist monitors across walking and running: whole-protocol MAPE 3.3–6.2%, with one device rising to 15.97% in slow walking — [PMC5117066 study](https://pmc.ncbi.nlm.nih.gov/articles/PMC5117066/). Note the worst error was at slow walking, not running.
- All optical devices showed poor agreement with a Polar H7 in variable-intensity trail running, for example Garmin Fenix 5 MAPE 13%, rC 0.32; Scosche Rhythm+ (arm band) MAPE 6%, rC 0.79. Authors advise a chest strap outdoors — [Navalta et al. 2020](https://doi.org/10.1371/journal.pone.0238569)
- Best case: PulseOn wrist device, 1.9% MAPE during running vs ECG (n = 24). Authors are employees of the manufacturer — [Parak et al. 2017](https://doi.org/10.2196/mhealth.7437)
- "Accuracy of wrist-worn monitors was best at rest and diminished with exercise" (JAMA Cardiology research letter) — [HealthDay summary](https://consumer.healthday.com/cardiology-2/misc-health-news-265/heart-rate-wristbands-often-display-inaccurate-data-715790.html)
- PPG validity is device-dependent and accuracy may drop as intensity rises (16-device study) — [Oropesa et al. 2025](https://www.mdpi.com/2076-3417/16/1/126)
- Mechanism: HR frequency is close to motion frequency and the motion artifact component can be much stronger than the cardiac component in the PPG signal — [Analog Devices](https://www.analog.com/jp/resources/technical-articles/validation-and-performance-of-a-wearable-heartrate-monitoring-algorithm.html)
- A Mi Band 5-class device's HR being acceptable below 100 bpm but worse above it means run HR is the weak case, while overnight resting HR is the strong case — supported by [Bent et al. 2020](https://doi.org/10.1038/s41746-020-0226-6) and [Kim et al. 2022](https://doi.org/10.5535/arm.22050)
- Amazfit: only a secondhand video review of the Helio Strap (r 0.98 with Polar H10 outdoors, r 0.9 in another wrist test); weak source — [video summary](https://videohighlight.com/v/GcGjIUJv0us)

### Inferences
Rejection rules below are engineering heuristics, not validated thresholds.
- Hard bounds: discard HR below resting HR + 20 during a run, or above observed max HR + 5.
- Cadence lock: running cadence (about 150–185 steps/min) sits in the same range as running HR. Flag samples where HR is within about ±3 of cadence, or of cadence/2, for a sustained stretch; the app has cadence, so this is cheap. This failure is mechanistically plausible from the Analog Devices source but I found no study quantifying it.
- Jump filter: reject changes above about 15–20 bpm within 10 s not accompanied by a pace change. Drop the first 5–10 min, when wrist devices respond worst to transitions (Bent) and HR is not at steady state.
- Coverage: require a minimum number of samples spread across the run, not bunched in one stretch. Use the median of HR samples, not the mean, because Chow reports extreme outliers.
- Run-level sanity check: reject a run if its HR is more than 3 robust SDs (MAD × 1.4826) from what the user's own HR-pace fit predicts, and RPE does not agree.
- A constant device bias cancels in within-person trends. Only the random part hurts. But changing watch, strap tightness or wrist breaks continuity: store device ID and reset baselines on change.
- Derived: with about 6% random per-run error and a 1% smallest worthwhile change, one would need about (6/1)² = 36 runs per comparison block to get standard error to 1%. So only large changes are detectable. Say so in the report.
- Humans should be told plainly when HR is missing; do not impute.

### Gaps
- No peer-reviewed validation of any Amazfit watch during outdoor running was found. Nothing found on current Mi Band 8/9 during running. Evidence is mostly from indoor, older models or patients.
- How Health Connect sampling density relates to watch recording mode (workout vs background) was not researched. Sparse values may be background samples with very different error.
- No study was found that reports cadence-lock frequency or error binned by HR/cadence ratio.

## Resting heart rate trends

### Takeaway
Resting HR is the most trustworthy device signal here, but it is a weak and non-specific marker. Rises flag illness, alcohol, stress and travel better than they flag training fatigue, and fatigue can move it either way. Use a personal baseline, require a run of several elevated days, and treat it as a prompt to look at feel, not a verdict.

### Cited Findings

**Normal variability**
- 92,457 wearers, median 320 days of data: mean RHR 65.5 ± 7.7 bpm; individual means 39.7–108.6 bpm. Average within-person SD of daily RHR 3.03 bpm (women 3.10, men 2.90). Median weekly range about 3 bpm. Maximum weekly range under 10 bpm for about 80% of people. Seasonal swing about 2 bpm, peak first week of January, trough end of July — [Quer et al. 2020](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0227709)
- Quer's "unusual increase" definition: RHR more than 2 SD above the mean of the previous 20 measurements, lasting at least 3 consecutive measurements within 5 days. Median 3 episodes per person (IQR 2–5, range 0–17) in 2 years — [Quer et al. 2020](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0227709). Note Quer's data needed ≥20 h/day wear.
- Age, sex, BMI and sleep duration accounted for under 10% of between-person variation, so population norms are useless and baselines must be personal — [Quer et al. summary](https://www.newswise.com/articles/normal-resting-heart-rate-appears-to-vary-widely-from-person-to-person)
- Buchheit lists RHR typical error about 10% CV, signal-to-noise 0.7, SWC about −2% — [Buchheit 2014, Table 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/). This conflicts with Quer (3 bpm on 65 bpm is about 4.6%), plausibly because Fitbit's daily value is an algorithmic summary of many hours while Buchheit's refers to short recordings.

**Rise with fatigue: evidence for and against**
- For: short-term overload (under 2 weeks) gave a moderate RHR rise (SMD 0.55, p = 0.01) — [Bosquet et al. 2008](https://pubmed.ncbi.nlm.nih.gov/18308872/)
- Against: long-term overload left resting values unchanged, and the authors conclude that expected changes "may fall within the day-to-day variability of these markers", so they need comparing with other signs and symptoms — [Bosquet et al. 2008](https://pubmed.ncbi.nlm.nih.gov/18308872/)
- Against, opposite direction: functionally overreached triathletes showed *lower* resting HR and parasympathetic hyperactivity (performance −9.0 ± 2.1%), and weekly averages rather than single-day values detected it — [Le Meur et al. 2013](https://doi.org/10.1249/MSS.0b013e3182980125)
- Buchheit Table 2: a resting HR fall with rising rMSSD means coping well; a rise can be readiness in a taper or accumulated fatigue otherwise, depending on context — [Buchheit 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/). Without HRV those scenarios cannot be distinguished here.
- For, in recreational runners: 2-week overload, nocturnal HR change +3.2 ± 3.1% in overreached (n = 8) vs −2.8 ± 3.7% in responders (n = 12), p = 0.002. Nocturnal HR had ≥85% positive and negative predictive value, though "resting or exercise HR did not respond as systematically as the subjective markers" — [Nuuttila et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11235883/)
- Sleep HR change was associated with change in 3000 m time, but group nightly metrics showed no consistent change during overload — [Nuuttila et al. 2025](https://doi.org/10.3390/s25020533)
- Correlations with running performance appeared only with averages of at least 3–4 days of HR and HRV, not isolated days — [Buchheit 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/). Weekly averaging is also the core recommendation in [Plews et al. 2013](https://doi.org/10.1007/s40279-013-0071-8)
- Elite marathon preparation can show bell-shaped HR time courses that return to baseline by taper, so interpretation is phase dependent — [Buchheit 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/)
- Night recordings are in theory the most standardized recording condition, though Buchheit favours short morning recordings in practice — [Buchheit 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/)

**Illness**
- Prospective system, 3,318 participants, 84 with SARS-CoV-2: alerts for 67 (80%), median 3 days before symptoms. Other infections, stress, alcohol and travel also triggered alerts, at 1.15 alert days per person vs 3.42 for COVID-19 — [Alavi et al. 2022](https://doi.org/10.1038/s41591-021-01593-2)
- Population flu surveillance (200,000 Fitbit users): best-fit threshold was RHR at least 0.5 SD above normal with sleep at least 0.5 SD below normal; improved state-level prediction by mean r +0.12. Population result, not individual diagnosis — [Radin et al. summary](https://www.healio.com/infectious-disease/influenza/news/online/%7Bde449e1d-42d5-4eaa-9999-e66934e9e22c%7D/fitbit-data-improve-state-level-influenza-predictions)
- At altitude camps, a rise of over 4% in exercise HR after a load increase may predict next-day sickness — [Buchheit 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/). Context-specific.

### Inferences
- Baseline: median of the prior 28 days, excluding the last 7. Require at least 14 valid days before showing anything, and 20 to match Quer. Spread: personal SD or MAD × 1.4826, floored at about 2 bpm so very quiet stretches do not create false alarms.
- Short-term flag (possible illness or heavy stress): at least 3 of the last 5 days above baseline + 2 SD, which is roughly +6 bpm at Quer's typical 3 bpm SD. Expect about 1.5 such episodes per year in an ordinary person (Derived from Quer's median of 3 in 2 years; that cohort's episodes were not checked against illness).
- Slow-trend flag: 7-day median at least 3 bpm above the 28-day baseline. Derived: SE of that difference is 3 × √(1/7 + 1/28) = 1.3 bpm assuming independent days, so 2 SE is about 2.5 bpm, and real days are autocorrelated, so round up. Buchheit's −2% SWC (about 1 bpm) is therefore not detectable week to week.
- Wording: "resting HR is up, check how you feel" and suggest common causes (illness, alcohol, poor sleep, travel, heat, stress). Never "you are overtrained". A falling RHR is mildly good news over months only.
- Seasonal 2 bpm drift means year-on-year comparison beats a long fixed baseline.

### Gaps
- Accuracy of Mi Band and Amazfit daily RHR specifically is unknown, and each vendor's algorithm is opaque. Whether Health Connect's daily value is a sleeping minimum, an awake rest, or a day-long estimate changes its noise.
- Mishra et al. 2020 (Nature Biomedical Engineering) was not retrieved directly; [Alavi 2022](https://doi.org/10.1038/s41591-021-01593-2) is the same group's prospective follow-up. Its precise online detection rule was not read.
- No recreational-runner study gives a validated bpm threshold for fatigue. Sensitivity and specificity for one person are unknown.

## Sleep duration

### Takeaway
The evidence supports sleep as context, not as a scored predictor. Total sleep loss clearly hurts performance, a night or three of partial restriction is unclear, and in adults poor sleep is not established as an independent injury risk. Cheap bands overstate sleep and are the weakest class tested, so only multi-night averages of duration from one device are defensible, and sleep stages should be ignored.

### Cited Findings

**Performance**
- Acute sleep loss: mean performance change −7.56% (95% CI −11.9 to −3.13, I² = 98.1%, n = 959, 89% male). Effects were consistent for afternoon or evening tasks; morning tasks were largely unaffected; consistent negative effects appeared only with deprivation and late-restriction protocols — [Craven et al. 2022](https://doi.org/10.1007/s40279-022-01706-y), read through [abstract record](https://lida.sport-iat.de/ta/Record/4078085) and secondary summaries; sources disagree on study count (69 vs 77).
- Athletic performance falls after a night or more without sleep, but the effect of partial restriction over 1–3 nights "remains unclear". Inadequate sleep is characterised as habitually under 7 hours and poor quality. A one-size-fits-all 7–9 h target is "unlikely ideal"; recommendations should be individualised to perceived need — [Walsh et al. 2021](https://bjsm.bmj.com/content/55/7/356.abstract)
- 2-week overload in 24 recreational athletes: perceived strain and soreness rose, but nightly sleep metrics and subjective sleep quality stayed unchanged — [Nuuttila et al. 2025](https://doi.org/10.3390/s25020533). Sleep is therefore not a sensitive marker of training strain.

**Injury**
- 12 prospective cohorts in adults: "The current evidence does not support poor sleep as an independent risk factor" for injury; specifically insufficient evidence in endurance athletes — [Dobrosielski et al. 2021](https://doi.org/10.1007/s40279-020-01416-3)
- Week-on-week changes in sleep duration, sleep quality or fatigue were not associated with running injury among 161 analysed high-school cross-country runners (P ≥ 0.24) — [Joachim et al. 2024](https://doi.org/10.1177/19417381231217347)
- Widely quoted contrary result: athletes sleeping at least 8 h had about 68% lower injury odds (P = .04). But this was 112 adolescents at one school, retrospective and self-reported — [Milewski summary](https://cm.healio.com/news/orthopedics/20121025/milewski_10_3928_1081_597x_20121001_23_909304). It should not be applied to an adult.

**Wearable accuracy**
- Meta-analysis, 24 studies, 798 people, including Xiaomi Mi Band 5: total sleep time mean difference −16.9 min (95% CI −26.3 to −7.4) vs PSG; sleep efficiency −4.7, WASO +13.3 min. Sign convention not stated in the abstract, but likely means devices report more sleep — [Lee et al. 2025](https://doi.org/10.5664/jcsm.11460)
- Xiaomi Mi Band 7 and Axtro Fit 3 ("low-cost consumer trackers") had the poorest performance of six devices vs PSG: 2-stage kappa < 0.31, 4-stage < 0.33. Oura 0.64 and Fitbit 0.58. Proportional biases were driven by nights with poorer sleep — [Ong et al. 2024](https://doi.org/10.1016/j.sleh.2023.11.005)
- All devices misclassified motionless wake as sleep; lower-priced trackers did worse at sleep/wake transitions. In-bed phone use is the key scenario — [Willoughby et al. 2024](https://doi.org/10.1016/j.sleh.2024.02.007)
- Six better devices (Apple, Garmin, Polar, Oura, Whoop, Somfit) were judged valid for timing and duration (agreement 86–89%, κ 0.30–0.51) but not for stages (50–65%) — [Miller et al. 2022](https://doi.org/10.3390/s22166317)
- Older Fitbit models overestimated total sleep by about 7–67 min — [Haghayegh et al. 2019](https://doi.org/10.2196/16273)

**Regularity**
- UK Biobank, 60,977 people, accelerometer-derived Sleep Regularity Index: higher regularity quintiles had 20–48% lower all-cause mortality vs the least regular, and regularity was a stronger predictor than duration — [Windred et al. 2024](https://doi.org/10.1093/sleep/zsad253). This is a health outcome, not a performance or recovery finding.

### Inferences
- Use 7-day median sleep vs the personal 28-day median. Suggested note only if the 7-day median is at least 45–60 min below baseline, or below about 6.5 h for a week. Those numbers are choices sitting above the device's likely bias and scatter, loosely anchored on Walsh's 7 h, allowing for overestimation.
- Discount single nights: a bad night is not grounds to warn about the next run, especially a morning run (Craven).
- A very poor night is likely *overstated* by a cheap band (Ong's proportional bias), so short values may be understated in severity. Treat as direction only.
- Show duration only. Never show stages, sleep score, or minutes-level precision. Round to quarter hours.
- Regularity: if Health Connect provides start and end times, the SD of the sleep midpoint over 14 days is a simple option. Evidence for runners is absent, so at most a low-key observation.

### Gaps
- No study was found on sleep duration vs training quality in recreational adult runners using consumer devices.
- No validated threshold specifically for adult recreational runners exists. Limits of agreement for Mi Band or Amazfit total sleep time were not retrieved. Amazfit sleep accuracy was not found (Huami Arc appears in Lee's pool, without separate figures here).
- Full text of Craven and Walsh was not read; the abstract and secondary statements are used.

## Heat, humidity, hills and wind

### Takeaway
Heat is real but small at training paces and the published numbers come from marathons: about 0.2–0.6% slower per °C WBGT above an optimum near 10–15 °C WBGT, larger for slower runners. Hills are well handled by Minetti's polynomial uphill, less so downhill, where Strava's empirical curve is safer. Wind is a squared effect, small in light wind and mostly unresolvable from weather station data.

### Cited Findings

**Heat and humidity**
- Top male marathoners slower than course record by 1.7 ± 1.5, 2.5 ± 2.1, 3.3 ± 2.0 and 4.5 ± 2.3% at WBGT 5.1–10, 10.1–15, 15.1–20 and 20.1–25 °C. Top women 3.2, 3.2, 3.8, 5.4%. Slower runners (25th to 300th place) slowed more. Seven marathons, 6–36 years each — [Ely et al. 2007](https://pubmed.ncbi.nlm.nih.gov/17473775/). Derived: about 2.8 percentage points across about 15 °C WBGT, or about 0.19% per °C for top men.
- 1258 races, 7,867 athletes. Best at 7.5–15 °C WBGT or 10–17.5 °C air temperature. Outside optimum, performance fell 0.3 ± 0.2% per 1 °C WBGT decrease and 0.4 ± 0.4% per 1 °C WBGT increase. Marathon: heat 0.2%, cold 0.1%, optimum 7.5 °C WBGT. 10,000 m about 0.04% per °C; 5,000 m about 0.3% per °C, optimum 15 °C. They quote Ely's data as about 0.1, 0.3 and 0.6% per °C WBGT for elite men, elite women and well-trained runners. The authors note decrements may have been higher with more sub-elite athletes — [Mantzios et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8677617/)
- Feature importance: air temperature 40%, humidity 26%, solar radiation 18%, wind 16%. WBGT alone (R² 0.11–0.47) beat air temperature alone (R² 0.04–0.34) — [Mantzios et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8677617/)
- 1.79 million finishes, six marathons, 2001–2010: speed vs air temperature fitted a quadratic; optimum 3.8–9.9 °C by level and sex. For women's P1, 1 °C above optimum costs 0.03% (near the bottom of the curve). Humidity correlated significantly for many groups; effect not quantified. Wind not measured — [El Helou et al. 2012](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0037407)
- Stockholm Marathon 1980–2008: air temperature had the highest correlation with finish anomaly (r = 0.66–0.73, largest for slowest). Humidity and rain effects "only arose from their negative correlation with the air temperature". Slower runners, out to 4.7 h, were more affected — [Vihma 2010](https://doi.org/10.1007/s00484-009-0280-x)
- Optimum marathon temperature generally about 10–12 °C; may be lower for faster runners — [Maughan 2010](https://doi.org/10.1111/j.1600-0838.2010.01214.x)
- Conflict on optimum: 3.8–9.9 °C (El Helou), 10–12 °C (Maughan), 10–17.5 °C (Mantzios) air temperature. Definitions and populations differ.
- WBGT outdoors = 0.7 Tw + 0.2 Tg + 0.1 Td — [Wikipedia](https://en.wikipedia.org/wiki/Wet-bulb_globe_temperature). The Australian BoM approximation from temperature and humidity assumes moderate sun and light wind, likely overestimates in cloud, wind or low sun, and is reported as systematically biased but widely used — [search summary of BoM and a 2024 paper](https://en.wikipedia.org/wiki/Wet-bulb_globe_temperature)

**Heat effect on heart rate (matters for EF)**
- Cycling at about 59% VO2max: HR rose 16 bpm (11%) between 15 and 45 min at 35 °C versus about 3 bpm at 22 °C — [Effect of ambient temperature on cardiovascular drift](https://lida.sport-iat.de/ta/Record/4014508)
- Running at 70% peak speed: no cardiovascular drift at 15 °C over at least 30 min — [UCT thesis](https://open.uct.ac.za/items/6e517326-67f7-4912-98b0-1bff46e6426b/full)

**Hills**
- Cr on level 3.40 ± 0.24 J/kg/m, independent of speed; 18.93 ± 1.74 at +0.45; minimum 1.73 ± 0.36 at −0.20. 10 runners, gradients −0.45 to +0.45 — [Minetti et al. 2002](https://iris.unibs.it/handle/11379/540545)
- Polynomial: Cr(i) = 155.4 i⁵ − 30.4 i⁴ − 43.3 i³ + 46.3 i² + 19.5 i + 3.6 J/kg/m, where i is gradient as a fraction — [Minetti & Pavei 2018](https://air.unimi.it/bitstream/2434/590382/2/Minetti%20%26%20Pavei%202018%20-%20Update%20and%20extension%20of%20the%20%E2%80%98equivalent%20slope%E2%80%99%20of%20speed-changing%20level%20locomotion%20in%20humans_a%20computational%20model%20for%20shuttle%20running.pdf). Coefficients were confirmed in secondary papers citing Minetti; the 2002 PDF was blocked. Measured range was −0.45 to +0.45, so do not extrapolate beyond it — [Minetti et al. 2002](https://iris.unibs.it/handle/11379/540545)
- Derived from the polynomial, Cr(i)/Cr(0): −10% 0.60; −8% 0.65; −6% 0.72; −4% 0.80; −2% 0.90; 0% 1.00; +2% 1.11; +4% 1.24; +6% 1.37; +8% 1.51; +10% 1.66; +15% 2.06; +20% 2.50. Note the fit gives 3.6 on the level and 1.80 at −0.20 vs measured 3.40 and 1.73; a secondary source seen in search summary, probably [this paper](https://ojs.zrs-kp.si/AK/article/view/50), quotes the minimum as 2.28. Use the ratio, not absolute values.
- Strava's first GAP was lab-derived and used a grade factor independent of speed. Strava's later version was built from real-world activity data and aims at performance and perceived effort, not metabolic cost. Old model minimum factor about 0.5 at −18%; new minimum 0.88 at −9%, back to 1.0 at −18%. Survey intuition: downhills give no more than about a 10% speed benefit — [Strava Engineering](https://medium.com/strava-engineering/an-improved-gap-model-8b07ae8886c3) (read through a search summary because the page blocked direct fetch); [Strava, earlier post](https://medium.com/strava-engineering/improving-grade-adjusted-pace-b9a2a332a5dc). Strava attributes its old model to a study of 30 elite athletes; Minetti's sample was 10, so it may not be exactly Minetti.
- Strava appears to apply the factor to distance rather than pace — [Schroeder reverse engineering](https://aaron-schroeder.github.io/reverse-engineering/grade-adjusted-pace.html)

**Wind**
- O2 intake rose with the square of wind velocity. Air resistance cost about 7.5% of total at middle-distance speed, 13% at sprint speed. Running 1 m behind another cut VO2 6.5% at middle-distance speed — [Pugh 1971](https://pubmed.ncbi.nlm.nih.gov/5574828/)
- Calm-day air resistance cost 7.8% at 10 m/s, 4% at 6 m/s, 2% at 5 m/s. Wind and gradient were equivalent for −10 to +5% gradients and 1.5–15 m/s wind. Apparent mechanical efficiency about +0.35 with a headwind and −1.2 with a following wind. 3 subjects — [Davies 1980](https://doi.org/10.1152/jappl.1980.48.4.702). Pugh's and Davies' figures disagree.
- Gross metabolic power rose 6.13% per 1% body weight of horizontal impeding force (individual range 4.17–8.14%), 12 runners, 12–16 km/h. A solo 52 kg runner at 2-h marathon pace has drag of 1.39% BW, or 7.8% of metabolic power — [da Silva et al. 2022](https://pubmed.ncbi.nlm.nih.gov/35834628/)
- Popular claims about "37% cost at 18 mph" and "tailwind gives half back" could not be confirmed against a primary source — [RunnersConnect](https://runnersconnect.net/running-training-articles/running-in-windy-conditions/)

### Inferences
- Heat factor for easy and steady runs: suggested pace correction about 0.4% per °C WBGT above about 12 °C for a recreational runner (range 0.2–0.6). No cold correction in the normal range. Stop adjusting above about 28–30 °C WBGT and exclude runs from fitness trends instead, since extrapolation is unsupported past about 25 °C (Ely's upper quartile bound).
- Marathon-derived rates describe 2–5 h race efforts at maximal sustainable pace. In a 40-min easy run the runner is not thermally limited in the same way, so the correction is an approximation of *equal effort*, and it should be labelled so.
- Pace and HR need separate treatment. Slower pace at equal effort does not cancel the HR rise at equal pace. Best practice for EF: exclude hot runs, or fit a personal HR-at-pace vs WBGT slope once at least 30 or so runs span a range. The personal fit beats any published number.
- Hill-adjusted pace: apply Minetti ratio uphill. Downhill, cap the benefit (for example, no factor below about 0.88), since 0.60 at −10% would claim a 40% discount no one realizes. Compute per segment using smoothed elevation: noisy GPS elevation fed through a convex function biases cost upward.
- Derived wind example, scaling da Silva's implied drag (7.09 N at 5.86 m/s = 0.206 N/(m/s)²) to a 70 kg runner by mass^(2/3) gives about 0.25 N/(m/s)². At 3 m/s (5:33/km) calm drag is about 2.3 N, 0.33% BW, about 2% metabolic. Into a 5 m/s (18 km/h) headwind: about 16 N, 2.3% BW, about 14%, so about +12% over calm. With 5 m/s behind: about −3%. Out-and-back is net slower by roughly 4–5%. Rough: 16 N is double the largest force da Silva tested (8 N).
- Tail benefit is smaller per newton: Davies' efficiencies imply metabolic saving per unit force is about 0.29× head cost (0.35/1.2). Do not credit tailwinds fully.
- Weather-station wind is measured higher up and away from shelter (general meteorology, not sourced here), so effective wind on a road is lower and direction relative to each GPS segment matters. Recommend: no wind correction below about 5 m/s; flag "windy, comparison weaker" above that, and exclude from trends instead of correcting. Rain: no correction (Vihma).

### Gaps
- Heat effect on recreational runners' *training* pace at submaximal effort has no direct study that I found; all rates come from race results.
- No published per-°C rise in HR at fixed running pace; cycling and two-temperature comparisons only.
- Mantzios's 0.6% well-trained figure is secondhand from Ely's full text. Ely's slower-runner values were not read directly.
- The commonly quoted BoM coefficients (WBGT ≈ 0.567 Ta + 0.393 e + 3.94) could not be verified in any fetched source; verify on the BoM site before using.
- Humidity has no independent quantified adjustment; WBGT is the proxy. Solar load is not in the app's data.
- Strava's current formula is unpublished. Its uphill factors were not retrieved.

## Subjective wellness and RPE versus objective markers

### Takeaway
For one runner with weak sensors, RPE and feel may be the single most valuable recovery input. Saw et al. found subjective measures generally did not correlate with objective ones, but tracked training load more sensitively and consistently. A 1-step shift on a 1–10 scale is a reasonable smallest change, but single-run values are noisy and non-training stress affects them.

### Cited Findings
- 56 studies through May 2014. "Subjective and objective measures of athlete well-being generally did not correlate." Subjective measures reflected acute and chronic load with superior sensitivity and consistency. Wellbeing was impaired with acute load increases and with chronic training, and improved with acute reductions — [Saw et al. 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4789708/)
- Within the same study, subjective measures were more sensitive and consistent in 22 of 54 studies; sensitivity, consistency or timing differed in 46% of studies and 85% of these favoured subjective — [Saw et al. 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4789708/). Objective measures were generally unresponsive to acute load, and evidence covered blood markers and HR among others.
- Best-supported constructs: mood disturbance (POMS), perceived stress and recovery (RESTQ-S), symptoms of stress (DALDA). Short instruments sustain use; programmes tend to make brief custom versions — [Saw et al. 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4789708/)
- Caution: the chronic-training finding "does not take into account ... the influence of non-training stressors" and should be read cautiously. Subjective measures "may stand alone, or be incorporated into a mixed methods approach" — [Saw et al. 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4789708/)
- In recreational runners, readiness to train dropped more and leg soreness rose more in overreached vs responders; readiness had ≥85% positive and negative predictive value, in a small sample. Subjective markers responded more systematically to load than HR — [Nuuttila et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11235883/)
- Subjective strain and soreness rose during overload while nightly wearable metrics did not — [Nuuttila et al. 2025](https://doi.org/10.3390/s25020533)
- Critical differences in 15 moderately trained runners over 7 weeks: performance and physiological variables 11.9%, psychological 26.8%, immunological 47.4%, metabolic and hormonal 59.9% — [Bagger et al. 2003](https://doi.org/10.1055/s-2003-41180)
- For a Likert or visual-analog scale rescaled 0–100, 10 units is half a step on a 6-point or one step on an 11-point scale, "something like the smallest perceptible change and ... a good default for the smallest important" — [Hopkins 2017](https://www.sportsci.org/2017/wghtrend.htm)
- HR and subjective wellness can dissociate: no link between cardiac ANS recovery and soreness or CK after a soccer game and a 53-km trail run; HR measures cannot inform all aspects of wellness — [Buchheit 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/)

### Inferences
- Most useful derived signal: RPE residual, meaning RPE reported vs the RPE expected for that hill- and heat-adjusted pace from the runner's own recent runs. A rising residual over 2 or more weeks is a cheap fatigue signal that needs no HR.
- Use 1 point of RPE on the 1–10 scale as the smallest important change for a *block median*, not a single run.
- Combine, don't average: when RPE/feel and RHR both worsen, trust it. When only one moves, say it is unconfirmed. When feel worsens and devices are normal, side with feel (Saw).
- RPE scales are ordinal: use medians, and do not over-model. Feel on a small scale should be treated as counts of good and bad runs. Prompt consistently (same time after run) to protect comparability. Missing ratings are not random; tired runners may skip logging.

### Gaps
- RPE test-retest reliability in recreational runners, and session-RPE validation (Foster, Borg-HR correlation) were not retrieved in this pass; the app's RPE 1–10 and "feel" items are unvalidated custom items.
- Saw's review counts many long multi-item questionnaires. Evidence that a single post-run item behaves as well is thin.

## Single-subject methods: SWC, typical error, baselines, small-sample statistics

### Takeaway
Estimate each metric's own noise from the runner's history, compare block to block rather than run to run, require about 2 typical errors plus persistence before saying anything changed, and accept that most weekly comparisons will honestly be "no clear change". With around 3 runs a week, 4-week blocks are the shortest honest fitness comparison.

### Cited Findings

**SWC and typical error**
- Smallest worthwhile enhancement for individual-sport athletes: 0.3 of typical competition-to-competition variation. Team sport default: 0.2 of between-athlete SD. Noise is the typical (standard) error of measurement. Noise in most tests exceeds the smallest worthwhile difference, so assessing changes is problematic. Unrealistically large changes can be partially discounted when tests are noisy — [Hopkins 2004](https://www.sportsci.org/jour/04/wghtests.pdf). The update of Sept 2011 revised 0.5 to 0.3.
- Thresholds as multiples of within-athlete CV: 0.3 smallest, 0.9 moderate, 1.6 large, 2.5 very large — [Buchheit 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/)
- For physiological markers, authors have used SWC = 0.5 × CV (Le Meur) or 1 × CV (Plews). Individual CV is intuitively better than between-athlete SD, but "there is currently no evidence that changes greater than any fraction of the CV would actually be meaningful in practice". Buchheit recommends being conservative about missing problems, perhaps a smaller SWC for negative adaptation, in elite sport — [Buchheit 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/)
- Competition variability, distance runners: fastest male quartile 1.2–1.9% for cross-country and road runs, 2.7–4.2% half marathons, 2.6% marathons; slower runners up to 2.3× more variable — [Hopkins & Hewson 2001](https://doi.org/10.1097/00005768-200109000-00023). Elite endurance 0.6–1.4% — [Malcata & Hopkins 2014](https://doi.org/10.1007/s40279-014-0239-x)
- Treadmill 5-km time trial typical error 2.0% in trained runners, vs 15.1% for time to exhaustion — [Laursen et al. 2007](https://doi.org/10.1249/mss.0b013e31806010f5)
- Ideal: typical error less than half the SWC, then any change beyond SWC is nearly certainly real. It is not absolute noise that matters but noise vs signal and SWC; a noisy measure that responds strongly can be better than a quiet unresponsive one — [Buchheit 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/)
- Measures unrelated to performance but related to health: smallest important change can be defined from a hazard ratio of 0.90 — [Hopkins 2017](https://www.sportsci.org/2017/wghtrend.htm)

**Noise reduction, minimum data, decision rules**
- Noise decreases as 1/√n; four tests halve it — [Buchheit 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/)
- Typical error can come from a reliability study, or, with "at least 10 or preferably more consecutive tests" with no real change other than a gradual trend, from the standard error of the estimate of a fitted trend line — [Hopkins 2017](https://www.sportsci.org/2017/wghtrend.htm)
- Without a defined smallest important change, a change is "unusual" when greater than about 2.0 typical errors (t√2·e at cumulative probability 0.9). If the real change is zero you will still see unusual increases 10% and unusual decreases 10% of the time — [Hopkins 2017](https://www.sportsci.org/2017/wghtrend.htm). That rule is for a single change score between two measures.
- Compare to a reference or mean of several tests, not just consecutive ones: changes between consecutive tests can all be trivial or unclear, yet early vs late is decisive — [Hopkins 2017](https://www.sportsci.org/2017/wghtrend.htm)
- Assess deviation of recent data from a fitted linear trend, and magnitude of the trend vs a target — [Hopkins 2017](https://www.sportsci.org/2017/wghtrend.htm)
- Measures of a frequent, cheaper signal are likely more useful than a more powerful one collected occasionally, as high frequency defines an individual's normal range better. For HRV, endurance athletes need at least 3–4 recordings per week, averaged, plus weekly HRex — [Buchheit 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/)
- Weekly means, rather than single-day values, detected overreaching — [Le Meur et al. 2013](https://doi.org/10.1249/MSS.0b013e3182980125); and [Plews et al. 2013](https://doi.org/10.1007/s40279-013-0071-8) recommends appropriate averaging techniques.
- Framework combining typical error, CIs, SWC, and biological variability for one person — [Swinton et al. 2018](https://doi.org/10.3389/fnut.2018.00041)
- Quer's rolling window: previous 20 measurements, +2 SD, 3 consecutive — [Quer et al. 2020](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0227709)
- Note on magnitude-based inference: Hopkins' spreadsheets are built on it; it is contested in statistics circles (my background knowledge, not sourced here), so reuse the thresholds and not its probability language.

**Robust trend and regression to the mean**
- Theil-Sen breakdown about 29.3% (tolerates that share of corrupted points), with bounded influence and high asymptotic efficiency — [Peng et al.](https://math.indianapolis.iu.edu/~hanxpeng/uer.pdf); [Wikipedia mirror](https://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq.ipfs.4everland.io/wiki/Median_slope.html). It gains over least squares as errors get heavy-tailed, while least squares can do better with small samples in some error distributions — [Peng et al.](https://math.indianapolis.iu.edu/~hanxpeng/uer.pdf). A figure of about 95–97% efficiency under Gaussian noise comes from a blog — [Metricgate](https://metricgate.com/blogs/theil-sen-vs-ols-regression/), unverified.
- Regression to the mean makes natural variation in repeated data look like real change; extreme first measures tend to be followed by less extreme ones — [Barnett et al. 2005](https://pubmed.ncbi.nlm.nih.gov/15333621/)

### Inferences
Everything below is derived or standard statistics and needs testing on real data.

- **Per-metric noise.** Detrended SD of per-run values over the last 10 or more qualifying observations. Below 10, show no verdict. Use log values for percent scale.
- **How uncertain is the noise estimate itself** (Derived, 90% CI multipliers on an SD from n points): n=5: 0.65–2.41; n=7: 0.69–1.92; n=10: 0.73–1.65; n=14: 0.76–1.49; n=20: 0.79–1.37; n=30: 0.83–1.28; n=50: 0.86–1.20. So with 10 runs the true SD could plausibly be 65% larger than the estimate. Fall back on a literature prior until 20 points (HR about 3%, RHR about 3 bpm).
- **Detectable change** (Derived, per-run σ = 5%, using 2 × SE of the difference; this is stricter than Hopkins' "2 typical errors", which equals about 1.4 × SE of the difference and accepts 10% false calls each way): 3 runs vs 3 runs SE 4.1%, so a change would need to exceed about 8%. 12 vs 12 runs (4-week blocks) SE 2.0%, needing about 4%. Slope over 8 weeks with 24 runs: SE 0.44%/week, or ±5.8% (90%) on the 8-week change; with σ = 3%, 0.27%/week. So a true 3–5% gain in 2 months is at the edge of detection. Weekly fitness claims are not supportable; the weekly report should show a 4-week vs prior 4-week comparison and a rolling 8–12 week Theil-Sen slope.
- **Multiplicity** (Derived). At Hopkins' 2-TE rule (10% each way), 6 metrics checked weekly give 1 − 0.8⁶ = 74% chance of at least one false flag per week; at Gaussian ±2 SD it is 24%. So: flag only with persistence (2 consecutive reports or 3 of 5 days) or agreement of two independent signals.
- **Medians vs means.** Medians resist outliers and are right for wrist HR. Cost: under pure Gaussian noise the median needs about 1.57× the samples of a mean (standard result, not sourced above). Spread: MAD × 1.4826. With under 5 values neither is meaningful.
- **Bands.** "Normal range" = baseline median ± 1 robust SD for display; ±2 for flagging. Clearly show band; plain language tiers: "no clear change", "probably up/down", "clearly up/down". Avoid decimals beyond the noise: pace to 5 s/km, HR to 1 bpm, percent to whole numbers for per-run, to 0.5 for blocks.
- **SWC for this runner.** Performance: 0.3 × about 2–3% race CV, about 0.6–1%. That's far below what training data can resolve, so use SWC for interpretation and the 2-TE threshold for claiming change. Fitness metric: 1–2%.
- **Baseline windows.** Exclude the current window from its own baseline. Do not include illness, breaks or new device. Recreate after over 14 days off.
- **Regression to the mean in practice.** After an unusually bad week, the next is likely better without any change: do not credit a rest, a shoe, or a plan. Do not headline "biggest improvement" from a low starting point. Choose comparison periods before looking. A PR-based baseline is biased; use median-based ones. Shrink a new block toward baseline, for example weight n/(n+k) with k from noise.
- **Trend.** Theil-Sen with at least 8–10 points spanning at least 4 weeks; bootstrapped or rank-based CI; say "no clear trend" if the CI includes zero. Theil-Sen does not fix sample bias: if only cool, flat runs have HR, the trend describes those only.
- **Missingness.** Report n with each statistic. Runs with HR may differ from runs without. Seasonal confounding is the largest trap: summer to autumn improvement in pace or EF is partly weather, so prefer same-WBGT comparisons.

### Gaps
- Barnett's formula was not retrieved; only the concept is cited.
- No literature was found on minimum sample sizes for field EF or RHR in a single recreational runner. All thresholds above are derived from generic theory, with an assumption of independent observations that real data violate (autocorrelated, so true uncertainty is larger).
- Buchheit's 2018 "Magnitudes matter more than beetroot juice" was seen only as Hopkins' pointer. Hecksteden's work on repeated testing was not retrieved.
- The false-alarm trade-off appropriate for a hobby runner (vs Buchheit's elite preference for overcalling) is a product decision, and this writer's view is to prefer fewer alerts.

## VO2max and race time estimates from training data

### Takeaway
Population-level estimates are okay and individual ones are not: limits of agreement for wearable VO2max are about ±10 ml/kg/min even with exercise-based methods. Riegel holds up to the half marathon and flatters the marathon. For this app, a race-equivalent band from real hard efforts, with honest ±, is more defensible than a VO2max number, and only changes of several percent are detectable.

### Cited Findings

**VO2max**
- 14 studies, 403 participants. Exercise-based wearable estimates: bias −0.09 ml/kg/min, limits of agreement −9.92 to +9.74. Resting-based: bias +2.17, limits −13.07 to +17.41. "Optimal ... at the population level, yet the estimation error at the individual level is large." Partly funded by Huawei — [Molina-Garcia et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9213394/)
- A wrist-PPG plus phone-GPS model estimated VO2max from a submaximal self-paced outdoor run with 5.2% MAPE vs the lab (n = 24, manufacturer-authored) — [Parak et al. 2017](https://doi.org/10.2196/mhealth.7437)
- HRV4Training's estimate: about 70% of variance, standard error about 4 ml/kg/min; resting data alone were insufficient; adding resting HR and HRV gave no clear gain. Vendor analysis of app users, 2016 — [Altini](https://www.hrv4training.com/blog2/vo2max-estimation-in-hrv4training-runners-only)
- Change in HR-running speed index correlated r = 0.49 with relative change in VO2max — [Vesterinen et al. 2014](https://doi.org/10.1519/JSC.0000000000000349). So about a quarter of the variance in change tracked (Derived, r²).
- Performance and physiological variables had a pooled within-subject critical difference of 11.9% in 15 moderately trained runners — [Bagger et al. 2003](https://doi.org/10.1055/s-2003-41180)

**Race prediction**
- Riegel: t₂ = t₁ × (d₂/d₁)^k. Vickers used k = 1.07; 1.06 is the commonly quoted value — [Vickers & Vertosick 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5000509/)
- 2,303 recreational runners. Riegel was well calibrated up to the half marathon but "dramatically underestimated marathon time, giving times at least 10 min too fast for half of runners"; nearly 25% were more than 20 min too fast. MSE 381 for Riegel vs 228 with one prior race plus weekly mileage and 208 with two prior races (N = 156 validation). Derived RMSE about 19.5, 15.1 and 14.4 min. Variables beyond prior times and weekly mileage did not improve prediction — [Vickers & Vertosick 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5000509/)
- A two-parameter (aerobic power index plus endurance index) model on about 14,000 runners and 1.6 million sessions gave 2.0% mean error for seasons with 3+ races (N = 12,309). This is fitted to the same races, so in-sample — [Emig & Peltonen 2020](https://doi.org/10.1038/s41467-020-18737-6)
- Garmin: median implied 5K-to-marathon exponent 1.131; +0.6% median error on 11 flagged race days; marathon prediction swung 11 min over 38 days for the median athlete. Commercial, 85 athletes, observational — [Gneta](https://www.gneta.app/research/garmin-race-predictor)

**Detectable change**
- Race-to-race CV 1.2–1.9% for fast runners over short road and cross-country, and up to 2.3× more for slower runners — [Hopkins & Hewson 2001](https://doi.org/10.1097/00005768-200109000-00023). A time trial has 2.0% typical error — [Laursen et al. 2007](https://doi.org/10.1249/mss.0b013e31806010f5).
- 3000 m time improved 1.2% after a 2-week overload and 1.7% after a further recovery week in recreational runners; responders 2.5% — [Nuuttila et al. 2025](https://doi.org/10.3390/s25020533); [Nuuttila et al. 2024](https://doi.org/10.1002/ejsc.12115). Realistic short-term real gains are therefore about the size of a single test's noise.
- Exercise HR improves within a week of starting training, while resting HRV took until after week 4 — [Buchheit 2014 via search summary](https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188/)

### Inferences
- A well-paced parkrun or time trial every 6–8 weeks (Derived: 2% noise, so change above about 5–6% is unusual for two single tests; 2 tests each side about 4%) is the best anchor. It is more informative than any VO2max estimate.
- If a VO2max number is shown, give a coarse band and never week-to-week changes. Preferred: "estimated 10 km range 52–56 min" from the best recent sustained efforts, adjusted for hills and heat, widening with staleness.
- Use Riegel 1.06–1.07 up to half marathon; for marathon, use a higher k (about 1.1 or more, as suggested by the Gneta median and Vickers' error direction) or do not predict unless weekly volume supports it.
- Never derive predictions from easy runs with sparse wrist HR; with ±6% HR error extrapolated to HRmax, error is compounded.

### Gaps
- No independent peer-reviewed accuracy for Garmin/Firstbeat race predictors found. No estimate of within-person tracking accuracy of wearable VO2max (only cross-sectional agreement), which is what this use case requires.
- Original Riegel paper not retrieved; a claim that Vickers found average exponents of 1.07–1.09 appears on a calculator site and was not confirmed in the paper, which uses 1.07 as an input.
- No published training-only (no race) prediction accuracy for recreational runners was found.
