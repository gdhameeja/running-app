# Evidence on fitness-app features that improve exercise adherence and training outcomes

Scope: behaviour-change features in physical-activity, running and strength apps, read for a single-user personal running + bodyweight strength app. The app has no social network and already has a Monday weekly report, PBs, ghost races and a gym plan with "Up next".

Labels: **[Published]** = peer-reviewed. **[Vendor]** = company blog or data. **[Opinion/secondary]** = press, blogs or podcast summaries.

Caveat: most figures below come from abstracts or reputable summaries, not full texts. Where sources disagree, that is flagged.

---

## 1. What do the meta-analyses say about app effects and which behaviour change techniques (BCTs) matter?

### Takeaway
Apps and trackers produce small-to-moderate, short-term gains in activity (about SMD 0.3-0.5, roughly 500-1,850 extra steps a day). The gains shrink after a few months. Self-monitoring, behavioural goals, personalisation and prompts are the BCTs most consistently linked to effect. Shorter, single-behaviour interventions do better than long or multi-target ones.

### Cited Findings
- **[Published] Romeo et al. 2019, JMIR (9 RCTs, n=1,740; 6 pooled):** apps gave a non-significant +476.75 steps/day (95% CI -229.57 to 1183.07; P=.19). Interventions under 3 months did better than longer ones (P=.01). Apps targeting activity alone beat apps that combined activity with diet (P=.04). The authors call the evidence "modest". — [JMIR PDF](https://www.jmir.org/2019/3/e12053/PDF); [MobiHealthNews summary](https://www.mobihealthnews.com/news/consumer-fitness-apps-show-nonsignificant-behavior-improvements)
- **[Published] Laranjo et al. 2021, BJSM (35 RCTs, 28 pooled, n=7,454 healthy adults aged 18-65):** SMD 0.350 (95% CI 0.236-0.465; I²=69%), about +1,850 steps/day (95% CI 1,247-2,457). Mean follow-up was about 13 weeks. In subgroup analysis and meta-regression, interventions with **text messaging** and **personalisation** were significantly more effective. — [BJSM blog](https://blogs.bmj.com/bjsm/2021/01/26/do-smartphone-applications-and-activity-trackers-increase-physical-activity-in-adults/); [full text PDF](https://run.unl.pt/bitstream/10362/147424/1/422.full.pdf)
- **[Published] Gal et al. 2018, Sports Medicine Open (18 RCTs):** wearables plus apps gave SMD 0.43 (95% CI 0.03-0.82; I²=85%) for minutes/day of activity and SMD 0.51 (0.12-0.91) for daily steps. Effects grew, and heterogeneity disappeared, when high or unclear risk-of-bias studies were removed. — [UMC Utrecht portal](https://researchinformation.umcutrecht.nl/en/publications/the-effect-of-physical-activity-interventions-comprising-wearable/); [PubMed](https://www.pubmed.gov/30178072/)
- **[Published] Direito et al. 2017, Annals of Behavioral Medicine (21 RCTs, n=1,701):** non-significant pooled effects for total PA (SMD 0.14), MVPA (SMD 0.37) and walking (SMD 0.14). Sedentary behaviour fell (SMD -0.26, 95% CI -0.53 to -0.00). Interventions used a mean of 6.9 BCTs (range 2-12) versus 3.1 in comparators, and only 31 of the 93 taxonomy BCTs appeared at all. — [UCL Discovery PDF](https://discovery.ucl.ac.uk/id/eprint/1558223/1/Direito_mHealth%20PA%20and%20SB_.pdf); [LABES summary](https://labes.fmh.ulisboa.pt/publicacoes/artigos/item/472-mhealth-technologies-to-influence-physical-activity-and-sedentary-behaviours-behaviour-change-techniques-systematic-review-and-meta-analysis-of-randomised-controlled-trials)
- **[Published] Eckerstorfer et al. 2018, JMIR meta-regression (50 studies, N=5,997; often cited alongside Direito):** **behavioural goals** and **self-monitoring** were each associated with greater intervention success. — [PMC6256104](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6256104/)
- **[Published] Mönninghoff et al. 2021, JMIR (117 RCTs, n=21,118):**
  - At the end of the intervention: walking SMD 0.46 (0.36-0.55), MVPA SMD 0.28 (0.21-0.35).
  - Long term: walking SMD 0.25 (0.10-0.39), MVPA SMD 0.19 (0.11-0.27). Effects decline over time.
  - Only 8 studies reported long-term follow-up. 80.3% were at high risk of bias, and the evidence quality is low to very low.
  - Effects were larger in sick and at-risk populations.
  - [JMIR](https://www.jmir.org/2021/4/e26699); [PubMed](https://www.pubmed.gov/33811021/)
- **[Published] Implementation intentions ("if-then" plans), Bélanger-Gravel et al. 2013, Health Psychology Review (26 studies):** g ≈ 0.31 (0.11-0.51) post-intervention and 0.24 (0.13-0.35) at follow-up. Effects were larger when **barrier management** (coping plans) was built in. — [McMaster summary](https://www.mcmasteroptimalaging.org/full-article/HE/meta-analytic-review-effect-implementation-intentions-physical-activity-25322); [related 2018 meta-analysis, PMC6235272](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6235272/)

### Inferences
- For a solo app, the evidence-backed core is: self-monitoring (already present), explicit behavioural goals (for example a weekly session target), personalised feedback, and timely prompts.
- The "if-then plan with a barrier/backup plan" pattern has its own meta-analytic support. It maps cleanly onto a "planned slot + fallback session" feature.
- Expect novelty to decay. Features should be judged on whether they still help in month 4, not week 2.

### Gaps
- I could not retrieve a BCT-by-BCT effect table from Laranjo 2021 or Mönninghoff 2021, only the moderators listed above.
- Almost no trials are in recreational runners specifically. Most measure steps or MVPA in inactive or at-risk adults, so effects in an already-active runner are likely smaller and are not directly tested.

---

## 2. Evidence on specific features

### Takeaway
- **Gamification** has a meta-analytic effect of g ≈ 0.42 that shrinks to g ≈ 0.15 after follow-up.
- **Rewarding the return after a miss** was the single best of 54 gym nudges in Milkman's megastudy.
- **Just-in-time prompts** work briefly, and their effect decays within weeks.
- **Streaks** raise engagement while intact but reduce effort once broken.
- **Music** has robust acute benefits on affect and performance.
- **Narrative running games** (Zombies, Run!) have only weak, mostly qualitative evidence.
- **Flexible goals** with a limited "slack" allowance beat rigid goals.

### Cited Findings

**Gamification and badges**
- **[Published] Mazeas et al. 2022, JMIR (16 RCTs, n=2,407):**
  - Overall: gamification gave g = 0.42 (95% CI 0.14-0.69) on physical activity, about +1,610 steps/day (372-2,847). Effects on MVPA were smaller and not significant (g=0.31, CI includes 0).
  - Against inactive controls: g = 0.58 (0.08-1.07). The effect was smaller against active non-gamified interventions. A DOAJ abstract gives g=0.23 (0.05-0.41), probably for that comparison, but this is unconfirmed.
  - Follow-up (mean about 14 weeks after the intervention ended): g = 0.15 (0.07-0.23), which the authors call "volatile".
  - [JMIR](https://jmir.org/2022/1/e26779); [preprint abstract](https://preprints.jmir.org/preprint/26779/accepted)
- **[Published] STEP UP trial, Patel et al. 2019, JAMA Intern Med (n=602):**
  - Design: gamification with points and levels, where users started each week on 70 points and lost 10 for each missed day (loss framing).
  - Only the **competition** arm sustained an effect at follow-up (+569 steps/day vs control). The support and collaboration arms did not.
  - Reported durations differ between secondary sources.
  - [Penn Medicine release](https://pennmedicine.org/news/news-releases/2019/september/using-a-wearable-device-to-exercise-more-add-competition-to-improve-your-results); [Healio](https://www.healio.com/news/primary-care/20190909/gamification-may-improve-effectiveness-of-weight-loss-interventions)

**Rewards and "missed workout" recovery**
- **[Published] Milkman et al. 2021, Nature megastudy (about 61,000 gym members, 54 four-week programs):**
  - About 45% of programs significantly increased weekly visits, by 9-27%.
  - The best program gave a tiny bonus (125 points ≈ $0.09) for **returning after a missed workout**, for +27%.
  - A message that "most Americans exercise and it's trending up" gave +24%.
  - Only about 8% of interventions had effects measurable after the 4 weeks.
  - [Penn Today](https://penntoday.upenn.edu/news/wharton-study-best-ways-boost-workout-habits); [Scimex](https://www.scimex.org/newsfeed/which-programs-give-gym-goers-the-biggest-boost)
- **[Opinion] Critique:** limited power to separate interventions and limited generalisability beyond that gym chain. — [Jason Collins, "Megastudy scepticism"](https://jasoncollins.blog/posts/megastudy-scepticism)

**Just-in-time prompts (HeartSteps micro-randomised trial)**
- **[Published]** In a 6-week trial (n=44), a contextual suggestion increased steps in the next 30 minutes by 14% (+35 steps over a 253-step baseline; p=.06).
- **[Published]** In the optimisation analysis, any suggestion initially gave +66% (+167 steps, p<.01), but the effect diminished over time. Walking suggestions averaged +24% (+59 steps, p=.02). Anti-sedentary suggestions had no detectable effect.
- Sources: [PMC6401341](https://pmc.ncbi.nlm.nih.gov/articles/PMC6401341); [Klasnja et al. design paper, arXiv](https://arxiv.org/pdf/2107.03544)
- **[Opinion/slides]** The walking-suggestion effect fell from about +271 steps initially to about +65 steps by day 20. — [Quantim webinar slides](https://sesstim.univ-amu.fr/sites/default/files/quantim_webinar02.26.21_2.pdf)

**Streaks**
- **[Published, via secondary summary] Silverman & Barasch 2023, Journal of Consumer Research:**
  - In a fitness-app experiment, about 66% did another strength exercise when their streak was intact versus about 58% when it was broken.
  - Logged streaks boosted later engagement.
  - The broken-streak demotivation was stronger when people blamed themselves for the break.
  - [Psychology Today summary](https://www.psychologytoday.com/us/blog/ulterior-motives/202306/how-broken-streaks-sap-motivation)
- **[Preprint] Run streaking, qualitative (21 recreational runners):** some benefits were reported, alongside unintended consequences including **injury and stress**. — [medRxiv 2024](https://medrxiv.org/content/medrxiv/early/2024/12/31/2024.12.26.24319676.full.pdf)
- **[Vendor] Duolingo:**
  - Separating the daily goal from the streak gave +3.3% relative Day-14 retention and +1% daily active learners.
  - A "Streak Wager" gave +14% Day-7 retention.
  - Duolingo also uses streak freezes; no freeze-specific results were found.
  - [Duolingo blog, "Improving the streak"](https://blog.duolingo.com/improving-the-streak); [Duolingo engineering](https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals)

**Flexible goals and slack**
- **[Published] Sharif & Shu 2017, Journal of Marketing Research, "emergency reserves":** a goal with costly slack (for example "7 days with 2 emergency skips") was preferred and improved persistence. In a step-count field experiment, reserve-goal participants hit their goal on up to 40% more days per week. A follow-up found that reserves help people re-engage after failing an interim goal. — [Wharton working paper PDF](https://marketing.wharton.upenn.edu/wp-content/uploads/2016/10/Designing-More-Effective-Goals-by-Using-Emergency-Reserves-A-Field-Experiment.pdf); [UCLA Anderson Review](https://anderson-review.ucla.edu/emergency-reserves/)

**Music**
- **[Published] Terry et al. 2020, Psychological Bulletin (139 studies, 598 effect sizes, n=3,599):** music improved affective valence, performance (an ergogenic effect) and physiological efficiency, and reduced perceived exertion. Performance effects were larger for fast tempo and for exercise rather than sport. The heart-rate effect was null (g=0.07). — [USQ record](https://research.usq.edu.au/item/q57x6/effects-of-music-in-exercise-and-sport-a-meta-analytic-review); [CORE PDF](https://core.ac.uk/download/362654377.pdf)
- **[Opinion/secondary, unverified]** Commercial sites report g≈0.48 for affect, 0.31 for performance and 0.22 for RPE. — [getfitcraft](https://getfitcraft.com/science/music-and-exercise-research)

**Narrative and gamified running (Zombies, Run!)**
- **[Published, qualitative] Farič et al. 2021, Games for Health Journal:** users said the narrative made sessions longer and encouraged long-term use, possibly through dissociation from effort. The sample was self-selected users. — [UCL Discovery](https://discovery.ucl.ac.uk/id/eprint/10139156/); [PubMed](https://www.pubmed.gov/34813376/)
- **[Published, small lab studies]** A 2015 treadmill study found more dissociative attention with Zombies, Run! than with a performance app. A study of n=20 found more "inspiration" than running with no audio. — [CU Boulder](https://www.colorado.edu/asmagazine/2015/12/02/they-run-not-health-it); [CORE PDF](https://core.ac.uk/download/43647223.pdf)

**Personal bests, ghost races and progress visualisation**
- See section 5 (quantification costs) for one countervailing finding. I found no trials testing PBs or ghost races directly; see Gaps.

### Inferences
- The strongest feature-level signal for this app is from Milkman: **make recovery after a missed session explicit and rewarding**, for example "welcome back" messaging and highlighting the return run, rather than punishing the gap.
- Streaks: if one is used at all, make it a **weekly** streak with built-in slack (Sharif & Shu) or a freeze (Duolingo), not a daily run streak. Daily run streaks carry injury risk, and broken streaks reduce effort.
- Competition was the only gamified arm with a sustained effect in STEP UP. With no social network, the **ghost race against your past self** is the closest solo stand-in. This is an inference; no trial tests self-competition directly.
- Prompts should be sparse, contextual (for example at your usual run time when no run is logged yet) and varied, because effects decay within weeks.
- Music cues during runs are well supported for enjoyment and RPE, so integrating with or encouraging music is low-cost and positive.

### Gaps
- No RCT evidence was found for audio coaching specifically, calendar/plan-commitment UIs, or "minimum viable workout" fallback sessions as app features. The closest evidence is implementation intentions with coping plans (section 1) and emergency reserves.
- No primary evidence was found on Strava kudos or accountability partners in the searches run. Social features are excluded here anyway, since the app has no social network.
- No primary paper link was retrieved for Silverman & Barasch 2023. The figures come from a secondary summary.
- Claims such as "users are 63% more likely to quit after one missed day (CHI 2020)" circulate on blogs but could not be verified and should not be used.

---

## 3. Habit formation and how apps can support it

### Takeaway
- **Lally:** automaticity takes a median of about 66 days (range 18-254) to plateau, and a single miss does not derail it, but chronic inconsistency does.
- **Kaushal & Rhodes:** for gym exercise, about 4 sessions/week for 6 weeks was the minimum to establish habit, and consistency was the strongest predictor.
- **Schumacher:** a consistent time of day is associated with more activity.
- Apps should reinforce stable cues (same time and context) and frequency, not perfection.

### Cited Findings
- **[Published] Lally et al. 2010, European Journal of Social Psychology:**
  - Median of 66 days to reach about 95% of each person's automaticity plateau; the range was 18-254 days (extrapolated).
  - Missing one opportunity did not significantly affect habit formation. Very inconsistent performers did not form habits.
  - Sample size is reported differently across sources (96 recruited, 82 analysed; a replication preprint says only 39 contributed modelled data). It has not been directly replicated.
  - [UCL news](https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit); [replication preprint](https://rr.peercommunityin.org/download/t_recommendations.reply_pdf.8382af6b73bdd0f7.6d616e757363726970745f7072657072696e742e706466.pdf)
- **[Published] Kaushal & Rhodes 2015, Journal of Behavioral Medicine (n=111 new gym members, 12 weeks):** at least 4 bouts/week for 6 weeks was the minimum to establish an exercise habit. Consistency was the strongest predictor. — [PubMed 25851609](https://pubmed.ncbi.nlm.nih.gov/25851609/); [UVic thesis](https://dspace.library.uvic.ca/items/113699e5-2131-4f46-8ec6-2180cffed8c3/full)
- **[Published] Kaushal, Rhodes, Spence & Meldrum 2017, Annals of Behavioral Medicine RCT (n=94):** a habit-formation intervention (cues, planning and so on) increased exercise time versus control. — [Springer](https://link.springer.com/10.1007/s12160-017-9881-5)
- **[Published, observational] Schumacher et al. 2019, Obesity (n=375, National Weight Control Registry):**
  - About two-thirds exercised at a consistent time of day. They reported more activity and were more likely to meet 150 min/week.
  - Morning, afternoon and evening consistency all helped.
  - A 2021 follow-up linked early-morning consistency to higher automaticity and stable routines over a year. This is not causal.
  - [ScienceDaily](https://www.sciencedaily.com/releases/2019/07/190703121438.htm); [Physician's Weekly, 2021](https://www.physiciansweekly.com/?p=342035)
- **[Published] Dai, Milkman & Riis 2014, Management Science (fresh start effect):** gym visits rose after temporal landmarks: start of a week, month, semester, year and birthdays. The Monday effect is smaller and shorter than the New Year effect. — [Management Science PDF](https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf)

### Inferences
- For a running + bodyweight app, the habit-friendly design is to fix **days and approximate time slots** per session type, track **sessions per week** (Kaushal suggests 3-4 or more), and visualise consistency over 8-10 weeks rather than daily perfection.
- Tolerating misses is evidence-consistent (Lally), so missed-day messaging should be neutral to encouraging.
- The existing **Monday weekly report** fits the fresh-start effect. It is a natural place to set or confirm the week's plan (an implementation intention: "Tue 7am easy run, Thu bodyweight, Sat long run") and to frame each week as a clean slate. Monthly and "new block" landmarks could add further resets.

### Gaps
- No direct evidence was found on habit formation specifically for running versus gym exercise, or for bodyweight training at home. Home training lacks the gym's location cue, so a time or preceding-routine cue matters more; this is inference.

---

## 4. Why people drop out of apps and training, and what reduces dropout

### Takeaway
- Dropout from app studies averages about 43%.
- In Couch-to-5K-style beginner programmes only about 27% completed, and dropout was linked to injury and rigid progressive design.
- Flexibility, injury prevention and keeping difficulty achievable (supporting competence) are the main protective levers.

### Cited Findings
- **[Published] Meyerowitz-Katz et al. 2020, JMIR (17 studies):** pooled mHealth app study dropout was 43% (95% CI 29-57): 49% in observational studies and 40% in RCTs. Heterogeneity was very high (I²>99%). — [JMIR](https://www.jmir.org/2020/9/e20283); [PMC7556375](https://pmc.ncbi.nlm.nih.gov/articles/PMC7556375)
- **[Published] Relph et al. 2023, IJERPH, "Couch-to-5k or Couch to Ouch to Couch!?" (n=110, modified 9-week programme):**
  - Only 27.3% completed.
  - 19% (21 people) reported injuries, and prior injury was a strong risk factor (OR 7.56, 95% CI 2.06-27.75).
  - The authors linked dropout to musculoskeletal injury and the **progressive design**, and recommend injury-prevention advice and **more flexible designs**. They note there is no empirical evidence base for the C25K design.
  - The sample was 81.8% female and mostly high socio-economic status.
  - [PMC10487403](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10487403/)
- **[Opinion]** Blogs attribute figures such as "40% of women and 37% of men never return after injury" to this study. Those figures actually come from earlier literature cited in its introduction. — [Kintec blog](https://www.kintec.net/blog/why-most-couch-to-5k-programs-fail/) (use with caution)
- **[Published]** Romeo 2019 found shorter interventions (<3 months) more effective, and Mönninghoff 2021 found effects decay over time. Engagement falls off with duration (see section 1).

### Inferences
- For one recreational runner, the most dropout-relevant features are:
  1. **Injury-risk guardrails**: load-progression warnings and caution after a gap or pain flag.
  2. **Adaptive or flexible plans**: re-slot missed sessions instead of "failing" the week, and repeat a week rather than force progression.
  3. **A minimum-viable fallback session** (for example a 15-minute easy run or a 10-minute bodyweight circuit) so a bad day still counts. This applies the coping-plan pattern from section 1.
- Plan blocks or "seasons" of 6-12 weeks with fresh restarts may sidestep long-term decay, given that shorter interventions perform better.

### Gaps
- No good quantitative data were found on when in the first weeks recreational runners drop out, beyond the C25K cohort above.
- No RCT of adaptive versus fixed running plans on adherence was found in these searches.

---

## 5. Self-determination theory, over-gamification and quantified-self downsides

### Takeaway
- Measurement can turn enjoyable activities into "work". Etkin 2016 found tracking reduced enjoyment and later activity.
- Guilt-, pressure- and leaderboard-based cues reduced autonomous motivation in adolescents.
- In adults, autonomy satisfaction is what links tracking to enjoyment.
- Support autonomy (user-chosen goals, optional metrics) and competence (achievable progress), and avoid guilt framing.

### Cited Findings
- **[Published] Etkin 2016, Journal of Consumer Research 42(6):967-984 (6 experiments: walking, reading, colouring):** measurement increased output but **reduced enjoyment**, and people did less once tracking stopped. The effect disappeared when the activity was framed around a non-hedonic goal, such as learning. — [Duke Fuqua](https://www.fuqua.duke.edu/duke-fuqua-insights/etkin-counting-steps); [Wharton PDF](https://marketing.wharton.upenn.edu/wp-content/uploads/2016/10/Etkin-Jordan-11-12-15-Hidden-Cost.pdf)
- **[Published] Kerner & Goodyear (Brunel), adolescents aged 13-14 using Fitbit:**
  - Motivation rose only short-term, driven by competition, guilt and internal pressure.
  - Need satisfaction and autonomous motivation fell significantly.
  - Leaderboard comparison hurt motivation.
  - [Brunel full text](https://bura.brunel.ac.uk/bitstream/2438/17200/4/Fulltext.pdf)
- **[Published] Adult smartwatch survey (n=494, NTU):** tracking frequency was linked to satisfying all three SDT needs, but **only autonomy** predicted enjoyment, moderated by age. — [NTU record](https://nanyangtechnologicaluniv.demo.elsevierpure.com/en/publications/self-determination-in-wearable-fitness-technology-the-moderating-)
- **[Published, qualitative] Wearables interview study:** motivation was mixed (both autonomous and controlled) and highly individual. — [Aalto](https://aaltodoc.aalto.fi/items/9d3d91b3-7c92-42ec-be7a-7418b6dda500)
- **[Published]** Silverman & Barasch: broken streaks are especially demotivating when self-blamed (see section 2). — [Psychology Today](https://www.psychologytoday.com/us/blog/ulterior-motives/202306/how-broken-streaks-sap-motivation)
- **[Preprint]** Run streakers reported stress and injury from streak pressure. — [medRxiv](https://medrxiv.org/content/medrxiv/early/2024/12/31/2024.12.26.24319676.full.pdf)

### Inferences
- Make metrics and pace pressure **optional per run**, for example an "unmeasured / just run" mode or hiding pace on easy days. This reduces the Etkin effect and supports autonomy.
- Frame PBs and ghost races as **competence** information ("you're fitter than 8 weeks ago") rather than pass/fail tests. Avoid points-loss or guilt copy.
- Let the user set their own weekly targets (autonomy). The app suggests and the user chooses.
- Keep data dense but layered: summary first, details on tap. This is design inference; I found no direct study on "data overload" in running apps.

### Gaps
- No high-quality RCT in adult recreational runners was found on harms from over-gamification or data overload. Evidence is adolescent or qualitative.

---

## 6. Weekly goals vs daily streaks, calendars and "missed workout" recovery messaging; practical design for a solo user

### Takeaway
The evidence points to the following:
- Weekly frequency targets (about 3-4 sessions), with built-in slack.
- Pre-committed day and time slots (implementation intentions).
- A coping or fallback plan.
- Positive "get back on track" messaging plus a reward for the return session.
- Fresh-start framing on Mondays.
- Rigid daily streaks are not supported.

### Cited Findings
- **Emergency reserves:** goals with limited, costly slack produce more goal-hit days (up to 40% more) and re-engagement after failure. — [Wharton PDF](https://marketing.wharton.upenn.edu/wp-content/uploads/2016/10/Designing-More-Effective-Goals-by-Using-Emergency-Reserves-A-Field-Experiment.pdf)
- **Return-after-miss bonus:** the best of 54 interventions (+27% gym visits). — [Penn Today](https://penntoday.upenn.edu/news/wharton-study-best-ways-boost-workout-habits)
- **Behavioural goals and self-monitoring** predict mHealth success. — [PMC6256104](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6256104/)
- **Implementation intentions with barrier management:** g≈0.24-0.31. — [McMaster](https://www.mcmasteroptimalaging.org/full-article/HE/meta-analytic-review-effect-implementation-intentions-physical-activity-25322)
- **About 4 sessions/week for 6 weeks** to form a gym habit. — [PubMed](https://pubmed.ncbi.nlm.nih.gov/25851609/)
- **Fresh start effect at the start of the week.** — [Dai et al. 2014](https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf)
- **Personalisation and messaging** moderate app effectiveness. — [Laranjo 2021 PDF](https://run.unl.pt/bitstream/10362/147424/1/422.full.pdf)
- **Separating the daily goal from the streak** improved retention. — [Duolingo, Vendor](https://blog.duolingo.com/improving-the-streak)

### Inferences: concrete recommendations for this app
Priority order reflects strength of evidence multiplied by fit for a solo user.

1. **Weekly session goal with slack.** For example "4 sessions this week (runs + strength), 1 grace skip". Show it as a ring or bar on the home screen and in the Monday report. Track a *weekly* streak ("9 weeks in a row hitting target"), with one freeze earned per N weeks. Supported by Sharif & Shu, Kaushal & Rhodes and Duolingo.
2. **Monday planning step (implementation intention).** The weekly report ends with "Plan this week": pick days and times for each session plus a backup slot. Optional reminder at the planned time only if nothing is logged yet. Supported by Bélanger-Gravel, Dai/Milkman and HeartSteps (contextual, sparse prompts).
3. **"Missed it? Here's the comeback" flow.** On a missed planned session:
   - Offer to re-slot it, or swap in a minimum-viable session (15 min easy run or a 10-minute bodyweight set).
   - Celebrate the return session explicitly ("back on track" marker in history and in the report).
   - Never use shame or points-loss copy.
   - Supported by the Milkman megastudy's top arm, coping plans, Lally (one miss doesn't matter) and Silverman & Barasch (self-blame amplifies demotivation).
4. **Consistent cues.** Show "your usual run time" and nudge toward a consistent slot. Display a consistency heatmap over 8-10 weeks. Supported by Schumacher and Lally.
5. **Self-competition as the social substitute.** Ghost races and PBs fill the role competition played in STEP UP. Frame them as competence feedback (trend lines, "fitter than X weeks ago"), and offer a "no-metrics easy run" mode to avoid the Etkin enjoyment cost.
6. **Injury and load guardrails with adaptive progression.** Flag big jumps in weekly volume, or a return after a gap, and suggest repeating a week. This targets the main C25K dropout cause (Relph 2023).
7. **Training blocks with fresh starts.** 6-10 week blocks with a clean-slate restart. Shorter interventions perform better (Romeo), and fresh starts lift effort (Dai).
8. **Music and audio.** Encourage or integrate a run playlist; this is low cost with strong acute evidence (Terry 2020). Narrative or story audio is optional novelty with weak evidence.
9. **Avoid:**
   - Daily run streaks (injury and stress).
   - Points-loss mechanics.
   - Frequent generic notifications (effects decay).
   - Dense metric dashboards as the default view.

### Gaps
- No direct comparison of a weekly-goal versus a daily-streak framing in exercise apps was found.
- No trial evidence was found for audio coaching, calendar UIs or fallback sessions specifically.
- Personal bests and ghost-race features have no direct trial evidence. Recommendations 3, 5 and 6 combine adjacent evidence and are not feature-specific RCTs.
