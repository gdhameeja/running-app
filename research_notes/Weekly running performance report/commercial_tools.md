# Commercial fitness tools: how they analyse training, what their weekly summaries contain, and how people judge them

Notes compiled 2026-11-07. Target reader: report writer for a one-person running app with a cheap watch (HR + GPS; no HRV, no power).

Provenance tags, because they matter for how far to trust each line:
- **[read]** = I read the page itself (through a fetch tool that returns a model-made summary of the page).
- **[excerpt]** = I only saw a search-result excerpt. The page body was blocked or not opened.
- Vendor statements are claims, not findings. Forum posts are anecdotes.
- Reddit was not reachable with my tools, so "user sentiment" here comes from Garmin forums, Slowtwitch, TrainerRoad, the WHOOP community and intervals.icu forums. Those users skew towards keen, data-minded athletes.

## 1. Garmin: Training Status, Training Load, Load Focus, Acute Load, Training Readiness, Morning Report, weekly summary, and complaints

### Takeaway
Garmin's load numbers (acute load, load ratio, load focus) are fairly well liked as a bookkeeping view. The verdict labels are the main source of anger, because "Unproductive" hangs on one noisy input: a VO2max estimate that heat, fatigue or an easy block can pull down. Training Readiness tracks recent load, and in the one large (non-peer-reviewed) test it barely predicted how the next run went.

### Cited Findings

**Training Status**
- Levels and definitions: No Status, Detraining, Recovery, Maintaining, Productive, Peaking, Overreaching, Unproductive ("Your training load is at a good level, but your fitness is decreasing"), Strained ("imbalance between your recovery and training load") — [Garmin FR265 manual](https://www8.garmin.com/manuals-apac/webhelp/forerunner265series/EN-SG/GUID-6A5D6D66-1F75-45B3-9E37-3AA5C189148F-8221.html) [read]
- Requirements: at least one VO2max estimate a week, which needs outdoor runs (or rides with power) with HR at 70%+ of max for at least 10 minutes. Indoor runs give no VO2max. Overnight wear keeps HRV status current, which helps keep a status when VO2max data is thin — [same manual](https://www8.garmin.com/manuals-apac/webhelp/forerunner265series/EN-SG/GUID-6A5D6D66-1F75-45B3-9E37-3AA5C189148F-8221.html) [read]
- Garmin offers a pause for injury or illness, which disables status, load focus, recovery feedback and workout suggestions — [same manual](https://www8.garmin.com/manuals-apac/webhelp/forerunner265series/EN-SG/GUID-6A5D6D66-1F75-45B3-9E37-3AA5C189148F-8221.html) [read]. A good design detail.
- Status is derived from changes in VO2max, acute load and HRV status over an extended period — [Garmin manual, FR955](https://www8.garmin.com/manuals-apac/webhelp/forerunner955/EN-SG/GUID-30B699EB-48E7-411C-ADC5-90A94CA8E4AE-1590.html) [excerpt]

**Load metrics**
- Acute load is a weighted sum of recent exercise load, and on some models is described as a weighted sum of EPOC over the last several days. The optimal range is personal, from fitness and training history. Load ratio = acute / chronic and appears after about two weeks — [Garmin tactix 8 manual](https://www8.garmin.com/manuals-apac/webhelp/tactix8series/EN-SG/GUID-7B29647B-615E-46D4-A331-4A3C2993E384-4326.html) and [FR955 manual](https://www8.garmin.com/manuals-apac/webhelp/forerunner955/EN-SG/GUID-30B699EB-48E7-411C-ADC5-90A94CA8E4AE-1590.html) [excerpt]
- DC Rainmaker: acute load looks at about 7 days, but load "burns off dynamically" — [FR955 review, 2022](https://www.dcrainmaker.com/2022/05/garmin-forerunner-solar-review.html) [excerpt]
- Load Focus sorts load into low aerobic, high aerobic and anaerobic over the last 4 weeks, with targets, and needs at least 7 days of training — [Garmin manual](https://www8.garmin.com/manuals-apac/webhelp/forerunner255series/EN-SG/GUID-4663DDC6-A6DF-4C1B-98E0-270DA60EC4F2-8699.html) [excerpt]
- Firstbeat's own professional product differs from Garmin's consumer version. It defines Acute Load as the sum of TRIMP over 7 days and Chronic Load as the mean over 28 days, and calls ACWR 1.0 the "sweet spot". Its TRIMP is a modified Banister TRIMP using beat-to-beat HR with a lower intensity cut-off — [Firstbeat: acute vs chronic](https://www.firstbeat.com/en/blog/interpreting-acute-vs-chronic-training-load-a-firstbeat-sports-feature/), [Firstbeat: what is TRIMP](https://www.firstbeat.com/en/blog/what-is-trimp/) [excerpt]. Firstbeat estimates EPOC from HR, with no gas measurement — [EPOC white paper, 2005](https://www.wanarun.net/blog/wp-content/uploads/2013/07/EPOC_white_paper.pdf) [excerpt]. Training Effect is EPOC mapped to 0.0-5.0 — [Firstbeat](https://firstbeat.com/en/blog/how-to-use-training-effect) [excerpt]. All vendor documents.

**Running Tolerance (Forerunner 970, 2025), a mechanical rather than cardio metric**
- Load is in "impact miles": 1 = one flat easy mile; five hard hilly miles might be 8. Weekly impact load is an "unweighted sum" (a bucket) for a user-set training week. Acute impact load fades over time. Tolerance is a personal maximum manageable acute load, recalculated at the start of each training week. Walking breaks count about half. The glance shows a mileage estimate for the week — [Garmin FR970 manual](https://www8.garmin.com/manuals-apac/webhelp/forerunner970/EN-SG/GUID-2D5E32B8-C760-431F-8CD2-5C769CD86062-6776.html) [read]
- Inputs named by Garmin include body weight, pace/intensity, grade, cadence and ground contact time — [Garmin blog](https://www.garmin.com/en-HK/blog/general/running-tolerance/) [excerpt]
- A nine-month reviewer said the weekly maximum mileage helped them avoid overtraining — [TechRadar FR970 review](https://www.techradar.com/health-fitness/garmin-forerunner-970-review) [excerpt]. Android Central called it "too useful to be a premium feature" — [Android Central](https://www.androidcentral.com/wearables/garmin/garmin-forerunner-970-running-tolerance-tool-too-useful-to-be-premium-feature) [excerpt, title]. No validation found.

**Training Readiness**
- Inputs: sleep, recovery time, HRV status, acute load, sleep history, stress history. DC Rainmaker says it is "more heavily influenced by recovery time (from last workout) and sleep" — [FR955 review](https://www.dcrainmaker.com/2022/05/garmin-forerunner-solar-review.html) [excerpt]. A marathon gives a low score regardless of the other inputs — [FR70 review, May 2026](https://www.dcrainmaker.com/2026/05/garmin-forerunner-70-depth-review-and-tested.html) [excerpt]. No published weights found.
- The score drifts up during the day as recovery time falls (example: 60 on waking to 71 by early afternoon) — [DC Rainmaker](https://www.dcrainmaker.com/2023/03/garmin-forerunner-review-amoled.html) [excerpt; exact review not pinned, one of the 955/265 reviews].
- the5krunner's critique: combining the inputs into one percentage is not scientifically justified and the inputs are not additive; there is no subjective input; a readiness of 1 appeared with "High" HRV status during a deliberate overload block; the score conflates "ready to train at all" with "ready to train hard" — [the5krunner, Aug 2023](https://the5krunner.com/2023/08/02/garmin-training-readiness-not-accurate-heres-why/) [read]
- Independent-ish test (Gneta, an analytics vendor, not peer reviewed, Aug 2026): 5,136 steady runs. Median within-athlete correlation between same-day readiness and running efficiency (speed/HR) was **0.056**; the top quintile was no better than the middle. Positive control: readiness vs previous day's training duration was **-0.272**, negative for 96.3% of athletes. Readiness vs same-day aerobic Training Effect was -0.209. Conclusion: a "load-accounting readout", not a go/no-go oracle. Limits: single-run efficiency is noisy, only next-day prediction was tested, self-selected users — [Gneta](https://www.gneta.app/blog/garmin-training-readiness-accuracy) [read]

**Morning Report, Evening Report, weekly summary, AI**
- An Evening Report exists with configurable data order and type, an optional sleep suggestion, and timing tied to sleep start — [Garmin FR970 manual](https://www8.garmin.com/manuals-apac/webhelp/forerunner970/EN-SG/GUID-B9E00041-12DA-48E3-ABA6-01EBF0A296C8-9002.html) [excerpt]. It is also on budget models — [FR70 manual](https://www8.garmin.com/manuals-apac/webhelp/forerunner70/EN-SG/GUID-A30B4929-5640-41A8-8A51-5C6D7AFF87B1-5571.html) [excerpt]
- Connect+ Active Intelligence (AI, paid, $6.99/month or $69.99/year) writes short summaries on the Home view from the latest activity, last night's sleep and scheduled workout — [Android Central](https://www.androidcentral.com/wearables/garmin/garmin-connect-plus-in-depth-hands-on-much-more-than-an-ai-unfortunately) [excerpt]
- Reviews are mostly negative. Insights were called generic and repeating what glances already show; a step "insight" simply subtracted steps done from the goal — [TechRadar, "11 insights..."](https://www.techradar.com/health-fitness/smartwatches/garmins-new-subscription-ai-feature-is-hilariously-bad-so-far) [excerpt; body not retrievable]. A run comment "was clearly just looking at the average overall pace rather than the breakdown of the run" — [Tom's Guide](https://www.tomsguide.com/wellness/smartwatches/i-tried-garmin-connect-for-a-week-heres-3-things-i-like-and-3-i-dislike) [excerpt]. Reviewers wanted more long-term trends.

**Complaints**
- Mechanism users identify: a falling VO2max estimate flips status to Unproductive even with load in range. "if your VO2Max is dropping, the training status will generally report Unproductive." Heat, illness or fatigue lower the estimate "regardless of fitness". Long blocks can show neutral or negative statuses "even if they end up improving your fitness long term" — [Garmin forum, Fenix 5 thread, about 2018](https://forums.garmin.com/outdoor-recreation/outdoor-recreation-archive/f/fenix-5-series/148012/fenix5-not-productive-even-though-pr-and-good-race) [read]
- Same thread: three weeks of Unproductive during a best-ever race, a small FTP rise and PRs, from VO2max 57 to 54 — [same thread](https://forums.garmin.com/outdoor-recreation/outdoor-recreation-archive/f/fenix-5-series/148012/fenix5-not-productive-even-though-pr-and-good-race) [read]
- VO2max is rounded, so a drop may be invisible in Connect while the status flips, which makes the label unexplainable from the screen — [Garmin forum search excerpt, "Training Status - Unproductive"](https://forums.garmin.com/outdoor-recreation/outdoor-recreation-archive/f/fenix-5-series/130338/training-status---unproductive/727838) [excerpt; exact post not pinned]
- 2023-24 Slowtwitch thread: "ranged between strained and unproductive each workout" after easy training; "a bunch of malarkey"; a 965 "forever telling me not to train"; "really hard to understand what is the logic of the algorithm"; "if I'm ending up ignoring this watch half the time, what's the point?" One user found a lab VO2max of 57 vs the watch's 51. Another traced bad zones to a stray strap reading 230 bpm — [Slowtwitch](https://forum.slowtwitch.com/t/garmin-consistently-telling-me-im-strained-unproductive/826852) [read]
- Partial defence from DC Rainmaker in that thread: newer Garmins are usually right if the state lasts "more than a few days", though a wrong VO2max estimate causes problems — [same thread](https://forum.slowtwitch.com/t/garmin-consistently-telling-me-im-strained-unproductive/826852) [read]
- Load Focus: slow zone 1-2 runs labelled "Pace" adding only to high aerobic; a track session with 3.0 anaerobic effect added nothing to anaerobic. Garmin staff pointed to a firmware bug fix for Training Effect primary benefit, so at least that case was a bug, not user error — [Garmin forum, FR745 thread](https://forums.garmin.com/sports-fitness/running-multisport/f/forerunner-745/307330/fr-745-inaccurate-training-effect-affecting-training-load-focus) [read]
- "Shortage" messages push intensity: the manual's anaerobic shortage tip is to add "a few more intense, anaerobic activities" — [Garmin manual](https://www8.garmin.com/manuals/webhelp/GUID-0221611A-992D-495E-8DED-1DD448F7A066/EN-US/GUID-C3205D96-DAB6-4C93-A225-5B8D7B5A5621.html) [excerpt]. Users have reported suggested workouts that do not match the shortages — [Garmin forum](https://forums.garmin.com/sports-fitness/running-multisport/f/forerunner-965/344737/suggested-workouts-don-t-match-load-focus-shortages-seems-like-they-should) [excerpt, title]

### Inferences
- Do not build a status label on an estimated fitness number. If the app ever says "fitness is declining", it needs a heat-adjusted, multi-week signal and must show the evidence.
- The bucket view (Running Tolerance) is the most copyable Garmin idea: a plain weekly sum, a personal ceiling, and a remaining-km figure. A cheap watch cannot supply ground contact time, but distance, pace and elevation can give a rough version.
- "Readiness tracks load, not next-run performance" suggests that a no-HRV app loses little by skipping a daily readiness score.

### Gaps
- Garmin's published list of Morning Report contents was not found; my searches returned only Evening Report pages. Third-party guides exist but I did not rely on them.
- I could not confirm that Garmin has a dedicated weekly summary report in Connect. No source described one. Treat "Garmin weekly summary" as unverified, not as absent.
- A Firstbeat white paper on training status logic or readiness weights was not found. No percentage weights are public as far as I could find.
- Gneta's cohort size (one excerpt says 39 athletes) was not confirmed on the page I read.

## 2. Strava: Fitness & Freshness, Relative Effort, weekly and monthly summaries, Athlete Intelligence, Year in Sport

### Takeaway
Strava's analysis is a thin Banister model over an HR-zone score, and its most useful summary is the simple weekly Relative Effort bar against a range band. Its weak spots are dependence on max HR and AI text that knows nothing of your plan. Year in Sport works as a shareable keepsake, not as analysis.

### Cited Findings
- Fitness: daily Training Load (power) and/or Relative Effort (HR or Perceived Exertion) fed through an impulse-response model. Fatigue is the same on a shorter timescale. Form = Fitness - Fatigue. Strava states that absolute numbers matter less than trends and that the best comparison is with your own past fit periods. It shows a seven-day Fitness delta and marks races in red. No time constants are given — [Strava support](https://support.strava.com/hc/en-us/articles/216918477-Fitness-Freshness) [read]
- Strava accepts Perceived Exertion as a load input when HR is missing — [same page](https://support.strava.com/hc/en-us/articles/216918477-Fitness-Freshness) [read]
- Relative Effort: TRIMP-derived, weighting time in HR zones so that Zone 5 counts far more than Zone 2, and "normalised using Strava's global dataset". A 20-minute interval session can match a 3-hour easy ride. Reported as "Developed in collaboration with Marco Altini" — [the5krunner, Nov 2025](https://the5krunner.com/2025/11/17/strava-relative-effort-guide-tss-2025) [read]
- Weekly view: the week's bar against a white range band from a 3-week rolling average, "a proxy for Acute: Chronic Workload Ratio". Green = in range, orange/red = above, blue = below — [the5krunner](https://the5krunner.com/2025/11/17/strava-relative-effort-guide-tss-2025) [read]
- Weaknesses listed there: a wrong max HR corrupts RE and the charts (220-age can be 10-20 bpm off); no LTHR support; optical HR swings of 10 bpm matter; heat, dehydration, caffeine and illness inflate RE; low-intensity ultra work is underestimated; a 2025 bug recalculated max HR and shifted zones — [the5krunner](https://the5krunner.com/2025/11/17/strava-relative-effort-guide-tss-2025) [read]
- Forum reception of Fitness & Freshness: a "lazy" interpretation of the model; users report inconsistent RE between rides and that Strava overestimates HR-only rides — [TrainerRoad](https://www.trainerroad.com/forum/t/strava-fitness-score/21199) [excerpt], [intervals.icu forum](https://forum.intervals.icu/t/fitness-fatigue-and-form/1259) [read]
- Athlete Intelligence: launched as a beta for subscribers in 2024, summarising pace, HR, elevation and Relative Effort after upload, and drawing on the previous 30 days — [Cycling Weekly](https://cyclingweekly.com/news/strava-introduces-artificial-intelligence-feature-for-subscribers) [excerpt]. Left beta in early 2025 with more data types. The progress summary chart gained comparison with past time ranges — [Strava press](https://press.strava.com/articles/strava-enhances-subscriber-experience-with-updates-to-key-features), [Wareable](https://www.wareable.com/news/strava-athlete-intelligence-full-launch-flyover-sharing-progress-comparison) [excerpt]
- Reviews of Athlete Intelligence: a Cycling Weekly piece is headlined "I think it's pointless" — [Cycling Weekly](https://cyclingweekly.com/news/strava-says-its-new-ai-feature-is-not-a-novelty-but-i-think-its-pointless) [headline only; body not retrievable]. Excerpts credit plain-language explanation and motivation (a run called a "killer effort", PRs noted) and fault it because it "doesn't know your training plan" and "doesn't tell you what to do next". Overall framing: a useful bonus, not a reason to subscribe. Excerpts came from a result set including [T3](https://www.t3.com/active/strava-athlete-intelligence-i-tried), [TechRadar](https://techradar.com/health-fitness/i-used-stravas-new-athlete-intelligence-ai-feature-for-a-week-heres-what-happened) and [The Running Genie](https://therunninggenie.com/blog/strava-athlete-intelligence-vs-ai-coaches) (the last is a competitor) [excerpt; exact page for each quote not pinned]
- 2026 direction: subscribers can connect Strava to Claude and, announced 28 Oct 2026, Gemini, for natural-language questions over training history. Athlete Intelligence stays focused on the single workout — [Yahoo Tech on Claude](https://tech.yahoo.com/ai/claude/articles/stravas-newest-subscriber-perk-lets-125716299.html), [Yahoo Tech on Gemini](https://tech.yahoo.com/ai/gemini/articles/gemini-delivers-connected-apps-strava-154207604.html) [excerpt]
- Year in Sport: the December 2025 Trend Report is aggregate industry and culture content (Sept 2024-Aug 2025 data; running top sport, walking second; kudos up about 20% to 14 billion) — [press release](https://www.endurancesportswire.com/strava-releases-12th-annual-year-in-sport-trend-report-revealing-that-doomscrolling-is-out-movement-is-in/) [excerpt]. The personal recap reportedly needs at least three activities and sits behind a banner/Progress tab — [Selular.id](https://selular.id/2025/12/strava-year-in-sport-2025-sudah-bisa-diakses-di-indonesia-begini-cara-buatnya/), [Doran Gadget](https://dorangadget.com/strava-year-in-sport/) [excerpt; low-authority sources]

### Inferences
- Range-band weekly bars are the cheapest useful summary and need no fitness model. A 3-week baseline is short and will absorb a slow ramp, so the band follows the user up.
- The RE weaknesses map directly onto a cheap watch: max HR must be measured or inferred from data, and the app should say so when it is a guess.
- AI text without plan context reads as description. A personal app has the advantage of knowing the plan, the goal and the gym sessions.

### Gaps
- Strava's Fitness & Freshness time constants are unpublished on the page I read.
- I found no Strava documentation of a push or email weekly or monthly summary. "Weekly" here means the Relative Effort view and the Training Log. I also could not document the Progress tab's current layout.
- No reliable coverage of user reaction to the personal Year in Sport or whether it is paywalled.
- The exact RE formula and zone coefficients are unpublished.

## 3. TrainingPeaks CTL/ATL/TSB (Banister): time constants and criticisms

### Takeaway
CTL/ATL/TSB is Banister with the fitted parts removed: two exponentially weighted averages of load and their difference. That makes it computable from any load score, but it is a description of load history, not a performance prediction. The defaults of 42 and 7 days are nominal conventions. The underlying model has known statistical problems, and its usefulness is limited by the quality of the load score.

### Cited Findings
- Coggan's account: the Banister impulse-response model dates from 1975. He removed the gain factors, which are hard to determine reliably, and swapped integrals for exponentially weighted moving averages, giving CTL, ATL and TSB = CTL - ATL — [Coggan, TrainingPeaks, 2022/2023](https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/) [read]
- Defaults: CTL 42 days and ATL 7 days, "nominal values" from the literature. CTL's constant has limited impact. ATL's is more influential: 4-5 days may suit younger, lower-load or endurance-focused athletes, 10-12 days masters, higher-load or sprint-focused ones — [same](https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/) [read]
- Coggan's own limits: the original model is a descriptive "black box"; it assumes no performance ceiling; reliable fitting needs about 20-200 direct performance measures; parameter estimates can be unstable; gains vary widely; CTL and ATL are relative, not absolute, and depend on accurate thresholds and complete data — [same](https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/) [read]
- Rule-of-thumb TSB: +15 to +25 for peak performance (attributed to Friel), around 0 equilibrium, -10 to -30 ideal training, beyond -30 extreme strain. Sustained +15 to +25 outside a peak suggests lost fitness. "Very fit athletes" can raise CTL 5-7 points a week. It takes 42 days from a cold start to get a reliable CTL — [Simmons, TrainingPeaks, updated June 2026](https://www.trainingpeaks.com/coach-blog/a-coachs-guide-to-atl-ctl-tsb/) [read]
- Athlete Home labels: ramp rate 9+ "Going Hard", 5-8 "Productive Training", 0-4 "Keeping Fit", -1 or less "Recovering"; form 30+ "Recharging", 5-29 "Fresh", -10 to 4 "Maintaining" — [TrainingPeaks help](https://help.trainingpeaks.com/hc/en-us/articles/41077784209165-Athlete-Home-Performance-Insights) [excerpt; page returned 403]
- TSS can come from power, HR (hrTSS) or pace (rTSS, using Normalized Graded Pace and Functional Threshold Pace) — [TrainingPeaks glossary](https://help.trainingpeaks.com/hc/en-us/articles/115001271712-Glossary) [excerpt]
- Imbach et al. (2022, Sports Medicine - Open): fitness-fatigue models reduce adaptation to one input and discard environmental, nutritional and psychological factors. Different sessions can yield similar load values, so similar fitness and fatigue states. Predictions show high bias and low variance. Performance is multifaceted, so load explains only part of it — [Imbach et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC8894528/) [read]
- A paper on statistical flaws reports the model was ill-conditioned, with poorly identifiable fitness and fatigue parameters, and overfitting: adding the fatigue parameters did not meaningfully improve prediction (p > 0.40) — [ResearchGate record](https://www.researchgate.net/publication/388488104_Statistical_flaws_of_the_fitness-fatigue_sports_performance_prediction_model) [excerpt; authors unconfirmed]
- Known problems with stability, parameter interpretability, ill-conditioning and predictive accuracy are also noted in [Scientific Reports, 2022](https://www.nature.com/articles/s41598-022-05392-8) [excerpt]
- ACWR, a close cousin: acute load sits inside the chronic denominator, producing a spurious correlation (Windt and Gabbett agree this is real, about 0.50 in simulation, while defending uncoupled versions). Lolli et al. call its use for identifying at-risk athletes potentially premature; Coyne et al. found mostly trivial effects from coupling in basketball and weightlifting — [Lolli 2018](https://unleash.catapult.com/wp-content/uploads/research//Football%20(Soccer)/Lolli%20(2018)%20The%20acute-to-chronic%20workload%20ratio%20an%20inaccurate%20scaling%20index%20for%20an%20unnecessary%20normalisation%20process.pdf), [BJSM exchange](https://bjsm.bmj.com/content/53/16/988), [Coyne et al.](https://ro.ecu.edu.au/ecuworkspost2013/7321/) [excerpt]
- Runner-specific evidence: Frandsen et al. (BJSM 2025; Garmin-RUNSAFE; 5,205 runners; 18 months; over half a million sessions). Using each session's distance against the longest session in the prior 30 days, overuse injury hazard rate ratios were 1.64 for >10-30%, 1.52 for >30-100% and 2.28 for >100%. ACWR spikes were associated with *lower* risk and week-to-week change showed no significant association. Exploratory, self-reported injuries, incomplete confounder control, non-monotonic pattern — [Physiotutors summary](https://www.physiotutors.com/research/running-injury-prevention/) [read; a secondary summary without CIs]; [LIH news item](https://www.lih.lu/en/article/new-research-challenges-decades-of-assumptions-about-running-injuries/) [excerpt]
- Hutchinson (Outside, June 2022) argues watch training-load algorithms have flaws and reports researchers suggesting simpler options, such as subjective effort or end-of-session breathing rate — [Outside](https://www.outsideonline.com/health/training-performance/training-load-research-2022/) [excerpt; behind a login redirect, not read]

### Inferences
- CTL/ATL/TSB is safe to compute with HR-TRIMP or RPE x minutes if it is labelled as load history, shown as trends and never as "fitness". Published TSB bands are in TSS units and do not transfer to another load scale without rescaling.
- Because the output depends on the load score, a cheap optical sensor's errors go straight into the chart. Gaps and gym sessions need handling.
- For injury flags, the runner evidence favours "this run vs your longest run in the last 30 days" over a weekly ratio. It is exploratory, but it is also trivially cheap to compute from distance alone, with no HR needed.

### Gaps
- I did not locate the original source for the 42/7 pairing beyond Coggan's "nominal" remark, nor any study comparing fitted with default constants in recreational runners.
- I did not find an Impellizzeri-authored ACWR paper in my results. His critique is widely cited from memory but is unverified here.
- A CTL-dependent ramp-rate risk table (for example "CTL 45 or less: ramp 3 or less is low risk") appeared in an excerpt from a TrainingPeaks article I could not pin to a URL. Do not cite it without checking.
- Frandsen numbers and CIs should be confirmed against the BJSM paper, which I could not open.

## 4. Whoop, Oura, Polar, Coros, Runalyze, intervals.icu, Apple

### Takeaway
Nearly every product uses the same skeleton: a per-session HR load, then a short window against a long window, then a named band. They differ in how much of that they reveal. The tools with published formulas and numbers (Coros bands, Runalyze, intervals.icu) cost the user effort but draw less anger. Runalyze is the closest match for this app, because it gets a lot from HR + pace alone.

### Cited Findings

**Whoop**
- Weekly Performance Assessment: every Monday in the app, balances strain against recovery with sleep and activity trends, includes bedtime and waketime variability, and a comparison of one metric against other members — [WHOOP](https://whoop.com/thelocker/new-feature-weekly-performance-assessment), [WHOOP](https://whoop.com/thelocker/new-weekly-performance-assessment) [excerpt; page returned 403, age uncertain]
- Monthly Performance Assessment: strain/recovery balance and cardiovascular fitness response over 6 months, load by strain and HR zone across sports, and later an analysis isolating one behaviour's effect on recovery — [WHOOP](https://www.whoop.com/thelocker/monthly-performance-assessment), [WHOOP](https://whoop.com/eu/en/thelocker/monthly-performance-assessment-now-features-enhanced-recovery-analysis) [excerpt]
- October 2025: MPA replaced with "Month in Review". Users valued the 12-month view, trend tracking, a report shareable with doctors and employers' wellness schemes, and called it "the reason why Whoop standsout". They called the replacement "casual", "just a letter with pictures", and hard to share. No Whoop response appears in the thread — [WHOOP community](https://www.community.whoop.com/t/new-month-in-review-is-a-huge-disappointment/9035) [read]

**Oura**
- Readiness uses nine contributors compared with personal averages; baselines take up to two weeks. Bands: 85-100 Optimal, 70-84 Good, 60-69 Fair, 0-59 Pay Attention — [Oura support](https://support.ouraring.com/hc/en-us/articles/360057791533) [excerpt]
- Activity Balance compares the past 14 days (recent days weighted more) with the past two months. HRV Balance compares 14 days with three months. Contributors are displayed individually — [Oura support](https://support.ouraring.com/hc/en-us/articles/360057791533) [excerpt]
- Cumulative Stress (Oct 2025): a past-month measure refreshed weekly, from sleep continuity, heart stress-response, sleep micro-motions, temperature regulation and activity impact — [Oura press release](https://www.businesswire.com/news/home/20251020302425/en/URA-Expands-Preventive-Health-Capabilities-Empowering-Members-to-Live-Better-Longer) [excerpt]. A vendor claim, not validated in anything I found.

**Polar**
- Cardio Load is TRIMP-based, from HR and duration, on an adaptive scale. Strain = 7-day average daily load; Tolerance = 28-day average ("past month" elsewhere); Status = Strain / Tolerance, with Overreaching, Productive, Maintaining and Detraining (some models add Recovering) — [Polar Training Load Pro](https://support.polar.com/en/training-load-pro), [Polar Loop manual](https://support.polar.com/e_manuals/polar-loop/polar-loop-user-manual-english/training-load-pro.htm), [Grit X2 manual](https://support.polar.com/e_manuals/grit-x2/polar-grit-x2-user-manual-english/training-load-pro.htm) [excerpt]
- Nightly Recharge = ANS charge + sleep charge. Polar also offers an orthostatic-test Recovery Pro, and says the two can disagree because they measure HRV under different conditions — [Polar blog](https://www.polar.com/blog/nightly-recharge-vs-recovery-pro/) [excerpt]
- An older Polar scale gives per-session recovery need in hours: Mild 0-6, Reasonable 7-12, Demanding 13-24, Very demanding 25-48, Extreme over 48 — [Polar support](https://support.polar.com/ie-en/the-what-and-how-of-training-load) [read]. A plain-language idea, but the numbers are Polar's model output.

**Coros EvoLab**
- Per-activity Training Load uses TRIMP; HR below threshold pace, Effort Pace above it. Examples: 50-60 min in zones 1-2 = 99; mostly zones 3-4 = 199; over 2 hours mostly zone 2 = 295. Weekly TL runs Monday to Sunday with a shaded suggested range and a 10% example. Base Fitness = 42-day rolling average; Load Impact = 7-day rolling average — [Coros](https://coros.com/stories/coros-metrics/c/training-load) [read]
- Intensity Trend = Load Impact / Base Fitness. Published bands: Excessive >150%, Optimized 100-149%, Maintaining 80-99%, Resuming/Performance 50-79% (split by previous status), Decreasing 0-49%. Coros explains that Decreasing during a taper often reflects recovery rather than lost fitness — [Coros](https://coros.com/stories/coros-coaches/c/prepare-for-your-next-race-with-training-status) [read]
- Coros states it is not designed for anaerobic or power work, so strength scores low — [Coros](https://coros.com/stories/coros-metrics/c/training-load) [read]. DC Rainmaker noted no accounting for heat or elevation — [DC Rainmaker, 2021](https://dcrainmaker.com/2021/05/revamped-training-explainer.html) [excerpt]
- Conflict: another Coros page gives Intensity Trend as a "24-day rolling average" and another as a difference. The ratio definition above matches the app percentages — [Coros](https://coros.com/stories/coros-metrics/c/introducing-training-status) [excerpt]

**Runalyze (HR + pace, no power needed)**
- Effective VO2max: per run from the HR-pace relationship, optional elevation correction, averaged to current shape, corrected by a factor from your best race. ATL and CTL are exponentially weighted TRIMP over 7 and 42 days and shown as % of your all-time max. TSB in absolute values — [Runalyze](https://blog.runalyze.com/tutorial/runalyze-understanding-the-calculations/) [read]
- Marathon Shape: recent training vs a target from VO2max, with weekly km 2/3 and long runs 1/3 over the last 6 months. Required base = distance^1.23; 10 km 17%, half 42.5%, marathon 100%, 100 km 288%. It corrects race predictions for missing endurance — [same](https://blog.runalyze.com/tutorial/runalyze-understanding-the-calculations/) [read]; Runalyze itself calls it its own invention — [glossary](https://runalyze.com/glossary/marathon-shape) [excerpt]
- Easy TRIMP: the most TRIMP you can do tomorrow while keeping TSB at 0. Monotony over 7 days: below 1.5 recommended, above 2.0 critical. Training strain combines monotony and summed TRIMP with a green/orange/red limit — [same](https://blog.runalyze.com/tutorial/runalyze-understanding-the-calculations/) [read]
- A user complained when a redesign separated the VO2max line from the CTL/ATL chart, making trends harder to compare — [Runalyze board](https://board.runalyze.com/d/312-new-shape-plots) [excerpt]

**intervals.icu**
- Fitness, fatigue and form are derived from per-activity load. Form is displayed by default as a percentage of fitness. Not adjusted for age. Forum users treat about -20 to -30 as the warning zone — [forum](https://forum.intervals.icu/t/fitness-fatigue-and-form/1259) [read]
- HR load options: average HR, time in HR zones, and HRSS, which is TRIMP normalised to 100 per hour. HRSS needs a correct resting HR — [forum](https://forum.intervals.icu/t/hrtss-vs-load-on-intervals-icu/76155), [forum](https://forum.intervals.icu/t/bannisters-trimp/10200) [excerpt]
- The developer's early regression-based HR load was fitted to cycling data and may not transfer: a running half marathon scored 328 under the zones model. Neither model generalises to low-HR gym or yoga; he suggested setting those low and noted that making them affect fatigue, not fitness, was a to-do — [forum](https://forum.intervals.icu/t/how-training-load-estimation-from-hr-works/280) [read; older thread, may be superseded]
- Weekly totals can show fitness/fatigue/form, sport totals, custom chart values, planned work with progress bars and compliance colours, and zones. Polarization Index (Treff 2019; 2 or more = polarized) appears in the weekly summary — [forum: Polarization Index](https://forum.intervals.icu/t/polarization-index-added/49877), [forum: activities page guide](https://forum.intervals.icu/t/activities-page-a-guide-to-getting-started/17698) [excerpt]

**Apple**
- Training Load (watchOS 11): 1-10 Effort Rating (auto from average HR for many cardio types, user-adjustable, even days later), load approximately rating x duration, 7-day vs 28-day comparison, labels Well Below, Below, Steady, Above, Well Above, about 10 days to baseline — [DC Rainmaker, July 2024](https://dcrainmaker.com/2024/07/apples-training-load-vitals-watchos11.html) [read; on the public beta]. Conflict: another review says 28 days to activate — [search result set](https://www.tomsguide.com/wellness/smartwatches/im-a-marathoner-and-have-been-testing-apple-watchs-training-load-feature-heres-the-pros-and-cons) [excerpt; not pinned]
- DC Rainmaker: praised the clean rating and that a long easy hike can count when rated higher. Faults: it does not learn from corrections, average HR dilutes intervals, and exact values are hidden, so he wanted numbers or a normal range like Garmin's green band — [same](https://dcrainmaker.com/2024/07/apples-training-load-vitals-watchos11.html) [read]
- Manual rating as a benefit in itself: strength workouts need one, and a reviewer found the step useful for learning about their strain — [TechRadar](https://www.techradar.com/health-fitness/this-new-apple-watch-feature-has-transformed-my-workouts-but-not-in-the-way-i-thought-it-would) [excerpt]. BGR reports load not registering correctly — [BGR](https://bgr.com/tech/i-found-another-apple-watch-health-feature-thats-letting-me-down) [excerpt]
- Readiness (watchOS 27, autumn 2026, Series 12 and Ultra 4 only): 0-10, Recover 0-1, Pace Yourself 2-4, Ready 5-7, Go For It 8-10; inputs activity, vitals (with HRV), sleep; updates during the day; needs sleep wear on at least 7 of 49 nights; "should not be solely relied on to determine whether and when it is safe to exercise" — [Apple support](https://support.apple.com/guide/watch/flx4gnzby346/watchos) [read]. Tapping shows which factor drove the score — [Apple support via search](https://support.apple.com/en-az/guide/watch/flx4gnzby346/watchos) [excerpt]
- Critique: no white paper or validation published; Topol quoted as saying "no published data on this score, not even on their website"; early blank values — [Kygo, a vendor blog](https://www.kygo.app/post/apple-watch-readiness-score) [read]

### Inferences
- A transparent recipe is available from public sources: TRIMP or RPE x minutes per session; 7-day vs 28- or 42-day comparison; published band table. Coros's bands are a usable starting point, with the caveat that they are vendor numbers on Coros's load scale. A ratio is scale-free, so they transfer better than TSB bands do.
- Whoop's backlash is the clearest evidence on summaries: people value long horizon, depth and exportability. Friendlier text does not compensate for lost trend views.
- Runalyze's Marathon Shape and Easy TRIMP show that "what does this mean for my goal?" and "what can I do tomorrow?" are answerable from HR, pace and distance.
- Strength needs its own treatment everywhere: Coros admits HR load is not built for it, and intervals.icu's developer suggests it should affect fatigue, not fitness.

### Gaps
- Apple Fitness "Trends" (the 90-day vs 365-day arrows) was not covered by any source I retrieved. Nothing here should be cited on that.
- No current Polar weekly summary description, and no independent critique of Nightly Recharge or Training Load Pro. The Wareable test of watch training advice returned 403.
- No scheduled Oura weekly report confirmed; Advisor can produce weekly-style summaries on request, per Oura's earlier press material [excerpt only, not cited].
- Oura's weekly-summary contents, the current state of Whoop's WPA in 2026, and Coros's in-app weekly report remain undocumented in my notes.
- Few user complaints on Coros were found; results were almost entirely Coros's own pages. This is a retrieval limit, not evidence of satisfaction.
- I found no details on Polar's perceived load or muscle load.

## 5. Independent evaluations of readiness scores and accuracy

### Takeaway
Sensors are partly validated; composite scores are not. The best review found no disclosed formulas and no validation against outcomes, and the only sizeable test I found of whether a score predicts the next run showed almost nothing. The critics recommend looking at raw baselines against a personal normal range, which is good news for an app with resting HR but no HRV.

### Cited Findings
- Doherty et al. (2025, Translational Exercise Biomedicine, DOI 10.1515/teb-2025-0001): 14 composite scores from 10 manufacturers. Inputs: HRV 86%, RHR 79%, activity 71%, sleep 71%, temperature 29%, respiratory rate 14%. No manufacturer disclosed weighting; none validated against clinical outcomes; Polar and Oura published theoretical white papers but no full validation. Recommends raw metrics such as nightly RHR or RMSSD and treating scores as motivational tools, not diagnostics — [BioSource summary](https://www.biosourcesoftware.com/post/5-second-science-wearable-composite-health-scores-require-validation) [read; secondary, publisher page returned 405]; [Altini's announcement](https://marcoaltini.substack.com/p/paper-readiness-recovery-and-strain) [read]
- Conflict of interest: Altini co-founded HRV4Training and advises Oura — [Altini](https://marcoaltini.substack.com/p/paper-readiness-recovery-and-strain) [read]. He is also reported as a collaborator on Strava's Relative Effort — [the5krunner](https://the5krunner.com/2025/11/17/strava-relative-effort-guide-tss-2025) [read]
- Altini (GSSI SSE #250, April 2024): readiness scores are made-up metrics with no objective reference, inconsistent across devices, and can change with software updates. They mix behaviour and physiology and "should probably have no place in the decision-making process". Resting HR and HRV are among the few reliable measures, especially as a nightly average or morning spot check. Use the normal range "mean plus or minus one standard deviation using data collected in the past 30-60 days", and act only on meaningful excursions — [GSSI](https://www.gssiweb.org/en/sports-science-exchange/article/making-sense-of-wearables-data) [read]
- Topol's Ground Truths audit (Sept 2026) found no outcome-validating evidence for readiness scores. The strongest example was a Whoop study of 389 professional golfers: about half a stroke better with a Recovery score 10 points higher, no control group, association only — [Gadgets & Wearables](https://gadgetsandwearables.com/2026/09/21/wearable-readiness-scores-science/) [read; secondary]. I could not retrieve Topol's original.
- Gneta readiness test: see section 1 — [Gneta](https://www.gneta.app/blog/garmin-training-readiness-accuracy) [read]. Same author: Body Battery vs overnight HRV median rho 0.674 and vs sleep score 0.683, suggesting that composites largely restate their inputs — [Gneta](https://www.gneta.app/blog/recovery-scores-compared-garmin-whoop-oura) [read; the "restate" reading is mine]
- Sensor accuracy (Dial et al. 2025 as reported): 13 adults, 536 nights vs Polar H10, overnight RMSSD CCC: Oura Gen 4 0.99, Oura Gen 3 0.97, Whoop 4.0 0.94, Garmin Fenix 6 0.87, Polar Grit X Pro 0.82 — [Gneta's report](https://www.gneta.app/blog/recovery-scores-compared-garmin-whoop-oura) [read], [PMC12367097](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12367097/) [excerpt]. Small n, specific models.
- Sleep: six devices about 86-89% sleep/wake agreement with polysomnography, weaker for stages — [PMC9412437](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9412437/) [excerpt]
- HRV-guided training: Manresa-Rocamora et al. (2021) meta-analysis, endurance performance SMD 0.20 (95% CI -0.09 to 0.48) vs predefined training, small and not significant — [PMC8507742](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8507742/) [excerpt]. So even the best-case input for daily adjustment shows only a small non-significant gain.
- Spetz et al. (2025, Sports Med Open): 20 elite Swedish endurance athletes, one year. Subjective training-load rating vs calculated load r = 0.70 in mixed models; individual ranges 0.35-0.73. RHR linked to illness in only 6 of 20. Mental stress vs HRV showed no meaningful correlation. No single measure captured load-recovery status. Competing interest: authors tied to the app's maker — [PMC12696214](https://pmc.ncbi.nlm.nih.gov/articles/PMC12696214/) [read]
- Feedback effects: Gavriloff et al. (2018): sham negative sleep feedback worsened evening alertness (d = 0.79) and sleepiness/fatigue (d = 0.55) vs positive feedback in people with insomnia (n = 32 vs 31); no difference in psychomotor vigilance — [PubMed](https://pubmed.ncbi.nlm.nih.gov/29989248/) [excerpt]. Zahrt et al. (2023, JMIR) reportedly found deflated step counts worsened mood and self-esteem — [Pojednic, Substack](https://rachelepojednic.substack.com/p/should-you-trust-your-wearable-what) [read; secondary]
- DC Rainmaker: no readiness validation found. His positions in my sources are the ones cited in sections 1 and 4.
- Hutchinson (2018): wearable data is better at describing training than prescribing it — [Outside](https://www.outsideonline.com/health/training-performance/how-heart-rate-variability-tells-you-when-hammer/) [excerpt]. June 2022: see section 3.
- Coach view (Pulford, CTS, updated Sept 2026): ignores proprietary scores. Program design, subjective feedback and acute changes like illness matter more. Log mood, fatigue, sleep quality, soreness and stress on a 5-point scale in about a minute; rate sleep before checking the app; use a "Warm-Up Rule" to decide after a structured warm-up — [CTS](https://trainright.com/training-readiness-recovery-score-wearable-device/) [read]

### Inferences
- Skip a 0-100 score. The app can honestly offer overnight or morning resting HR (if the watch gives it) vs a 30-60 day personal range, plus a quick subjective check.
- Resting HR alone is a weak illness flag (6 of 20 in Spetz). Present it as "unusual", not as a diagnosis.
- A subjective load rating is reasonably aligned with computed load (r about 0.7 in elite athletes), which supports collecting RPE, though transfer to recreational runners is untested.
- Negative framing may itself have an effect. The insomnia evidence does not transfer directly to runners, but neutral wording costs nothing.

### Gaps
- The full text of Doherty et al. was not retrievable; percentages come from a secondary summary.
- No study found measuring direct agreement between Garmin, Oura and Whoop readiness scores on the same people. One blog anecdote (72 vs 34) is not evidence.
- DC Rainmaker has no dedicated readiness accuracy study that I could find. Hutchinson's 2022 column was not readable, so his position is taken from excerpts only.
- A 2026 JMIR article mentions a narrative review of 16 studies of active wearable users, but the [page](https://www.jmir.org/2026/1/e109935) returned no text.
- No validation found for cheap-watch optical resting HR. The Dial study excluded Garmin from RHR comparison.
- Draganich's placebo-sleep work was not found by my search.
- No nocebo study specific to readiness or athletes was found.

## 6. Which features runners report changing behaviour versus ignoring, and complaints about opaque scores

### Takeaway
No systematic data exists on which features change runners' behaviour, so this rests on forums and two qualitative papers. The pattern is consistent, though: people act on trends, multi-week load checks and anomalies they can trace to a cause, and override or mute daily verdicts that contradict how they feel. Opaqueness is not the only irritant: being told something wrong with no way to see why is what turns users against a feature.

### Cited Findings

**Reported as changing behaviour**
- Extra rest after illness when HRV and overnight RHR worsened; reviewing overall load to decide whether to add aerobic or anaerobic intensity; Load Ratio to avoid multi-week overreaching, though not daily — [TrainerRoad, July 2024](https://www.trainerroad.com/forum/t/do-you-use-follow-garmin-training-metrics/94984) [read]
- Weekly mileage ceiling from Running Tolerance — [TechRadar](https://www.techradar.com/health-fitness/garmin-forerunner-970-review) [excerpt]
- Non-exercise behaviours: regular exercisers adjusted other habits to manage scores; higher scores acted as a reward and some described a "game" — [Ibrahim et al. 2024](https://link.springer.com/article/10.1007/s10484-024-09645-2) [excerpt], [follow-up paper 2025](https://link.springer.com/article/10.1007/s10484-025-09762-6) [excerpt]. The authors did not measure objective behaviour change and warn of psychological biases.
- Using a monthly report with doctors and for reimbursement — [WHOOP community](https://www.community.whoop.com/t/new-month-in-review-is-a-huge-disappointment/9035) [read]
- Diary comparison: logging how you feel and comparing it with watch data over time to learn when to push — [TrainerRoad](https://www.trainerroad.com/forum/t/do-you-use-follow-garmin-training-metrics/94984) [read]

**Reported as tracked but not obeyed**
- "I track them, but they don't rule me." "I don't care if the Vo2max is accurate, only care if it's self consistent." — [TrainerRoad](https://www.trainerroad.com/forum/t/do-you-use-follow-garmin-training-metrics/94984) [read]
- Users in the qualitative work stressed self-awareness, flexibility and personal judgement in exercise decisions — [Ibrahim et al.](https://link.springer.com/article/10.1007/s10484-024-09645-2) [excerpt]
- Advice from Garmin users: look at the inputs when the score is low, then decide — [Garmin forum](https://forums.garmin.com/sports-fitness/running-multisport/f/forerunner-955-series/327366/training-readiness-morning-report-health-snapshot---your-experience/1591661) [excerpt; page attribution approximate]

**Reported as ignored or distrusted**
- Performance Condition "pretty useless" and prompt disabled; Fitness Age "I don't believe its accurate at all"; "do not trust it one bit"; "they don't reflect how I feel"; "I do absolutely nothing with that data" — [TrainerRoad](https://www.trainerroad.com/forum/t/do-you-use-follow-garmin-training-metrics/94984) [read]
- Training Status called "pretty worthless", especially during base training — [Slowtwitch](https://forum.slowtwitch.com/t/garmin-training-status-worthwhile-or-worthless/783680) [excerpt]
- Post-run feedback ignored, with "Devices want to run our lives" — [Slowtwitch](https://forum.slowtwitch.com/t/garmin-consistently-telling-me-im-strained-unproductive/826852) [read]

**Defenders**
- A low score during an intended overload is expected, and scores correlate with reality when inputs are good — [Suunto forum](https://forum.suunto.com/topic/12908/training-readiness-would-be-great-for-an-upcoming-update/24) [excerpt]

**Opaqueness complaints**
- "really hard to understand what is the logic of the algorithm" — [Slowtwitch](https://forum.slowtwitch.com/t/garmin-consistently-telling-me-im-strained-unproductive/826852) [read]
- Altini: "We need open methodologies and evidence-based best practices more than black-box algorithms" — [Altini](https://marcoaltini.substack.com/p/paper-readiness-recovery-and-strain) [read]
- Apple hides exact load values, drawing a reviewer's request for numbers or a normal range — [DC Rainmaker](https://dcrainmaker.com/2024/07/apples-training-load-vitals-watchos11.html) [read]
- Vendor changes without notice: Whoop's silent removal of MPA — [WHOOP community](https://www.community.whoop.com/t/new-month-in-review-is-a-huge-disappointment/9035) [read]; Apple's reported HRV method change (SDNN to RMSSD) — [Kygo](https://www.kygo.app/post/apple-watch-readiness-score) [read; vendor, unconfirmed]; scores that change with software updates — [Altini, GSSI](https://www.gssiweb.org/en/sports-science-exchange/article/making-sense-of-wearables-data) [read]

### Inferences (design guidance for the one-person app; my synthesis, not sourced fact)

Copy:
1. Weekly load bar against a personal band, with the actual number shown (Strava, Garmin band; DC Rainmaker's request to Apple).
2. Short vs long window ratio with a published band table (Coros, Polar, Apple). Use a 7-day vs 28-day or 42-day window, and state the window.
3. Per-session load from HR (TRIMP) with RPE as override or fallback (Apple, Strava). Unlike Apple, learn from corrections. RPE also covers gym sessions.
4. A mileage bucket: "x km this week, y left before you exceed your usual ceiling" (Running Tolerance, Coros suggested range).
5. Session spike check against longest run in 30 days (Frandsen). Distance only, works on any watch. Word it as a caution.
6. Goal-linked readiness for long races from weekly km and long run (Runalyze Marathon Shape) and a "tomorrow" allowance (Easy TRIMP).
7. Long horizons and export: 12-month view, shareable report (the Whoop backlash).
8. Show why: every sentence should name its inputs. Contributor lists (Oura, Apple Readiness) are the minimum.
9. Pause for illness or injury (Garmin), a "not enough data yet" state rather than a guess (Garmin No Status; TrainingPeaks' 42-day warm-up), and a note that taper drops are expected (Coros).
10. A one-minute subjective log (CTS), and comparison of feel against load over time.

Avoid:
1. A 0-100 readiness score, or any blend of behaviour and physiology.
2. Verdict labels that hinge on an estimated VO2max or any single noisy estimate. If HR-at-pace trend is shown, show it as a trend with a heat caveat, and do not let one week flip a label.
3. Treating load as fitness. CTL-style output should be called "training load history".
4. Prescriptive "shortage" pushes towards intensity, especially when classification is uncertain.
5. Generic LLM recap of numbers already on screen. Text should only appear if it adds comparison, plan context or a next step.
6. Absolute thresholds borrowed from TSS scales. Personal baselines are better, and ratios transfer better than differences.
7. Trusting max HR or zones blindly: flag a guessed max HR, reject spikes (the 230 bpm strap story), and consider that cheap optical HR will be noisy during intervals.
8. Silent changes to formulas: version the calculation in a personal app and note when numbers shift.
9. Alarmist wording: use neutral statements of what changed.

### Gaps
- No quantitative study or survey found on feature usage or behaviour change among runners. Vendors have this data and do not publish it.
- Reddit could not be accessed, so the most commonly cited venue for this sentiment is missing. Sample sizes above are single-thread anecdotes, drawn from a self-selecting, mostly cycling- and triathlon-leaning crowd on TrainerRoad and Slowtwitch.
- Ibrahim et al. sample size and full themes were not retrievable (login redirect); the Research Square copy returned only the title.
- No evidence found that any weekly summary improves outcomes (adherence, injury, performance) in any product.
