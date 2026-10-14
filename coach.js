// coach.js — The "Tune-In" coach: a guided run that asks how hard it feels
// and adapts. RunEngine.kt has the same logic (TuneInCoach) for the Android
// service; keep the two in step.
//
// Effort is rated 1-5 and anchored to the talk test, because the point where
// comfortable talking stops lines up with the ventilatory threshold
// (Persinger et al. 2004), and that threshold is where exercise turns from
// pleasant to unpleasant for most people (Ekkekakis' dual-mode theory).
//
// Segments with a `target` (1-5) are coached:
//  - Every ~75 s it asks for a rating (not in a segment's last 30 s).
//  - Rating above target: "ease off"; twice in a row lowers the target for
//    the rest of the run. A 5 means back off right away: a minute of easy
//    recovery. Too hard is answered fast, too easy cautiously, so it never
//    becomes the run you dread.
//  - Rating below target: "pick it up"; twice in a row raises the target.
//  - Segments with `surges` add short pick-ups (20-60 s; intervals of a minute
//    or less are enjoyed more than longer ones, Martinez et al. 2015) when
//    you're coping. Each surge is rated and sets the next one's length.
// All times are moving time in ms since the start of the run, so pauses
// don't count.

const EFFORT_ANCHORS = {
    1: "you could sing",
    2: "you could chat in full sentences",
    3: "you can talk in short sentences",
    4: "just a few words at a time",
    5: "you can't talk",
};

const EFFORT_LABELS = { 1: "Too easy", 2: "Easy", 3: "Working", 4: "Hard", 5: "Maxed" };

class TuneInCoach {
    static FIRST_CHECK_MS = 90000;
    static CHECK_EVERY_MS = 75000;
    static AFTER_NUDGE_MS = 60000;
    static RECOVER_MS = 60000;
    static ASK_TIMEOUT_MS = 30000;
    static QUIET_END_MS = 30000;
    static SURGE_GAP_MS = 150000;
    static SURGE_START_S = 30;
    static SURGE_MIN_S = 20;
    static SURGE_MAX_S = 60;

    // segments: [{ target?: 1-5, surges?: bool, durationMs }]
    constructor(segments) {
        this.segments = segments;
        this.seg = -1;
        this.segEnd = 0;
        this.offset = 0;
        this.mode = "steady";
        this.modeEnd = 0;
        this.nextCheckAt = 0;
        this.asking = null;
        this.lowStreak = 0;
        this.highStreak = 0;
        this.surgeSec = TuneInCoach.SURGE_START_S;
        this.lastSurgeEnd = 0;
        this.skipSurges = 0;
        this.lastRating = null;
        this.coachedBefore = false;
        this.praiseIndex = 0;
        this.askIndex = 0;
        this.ratings = [];
    }

    static isCoached(segments) {
        return (segments || []).some(s => s.target != null);
    }

    get active() { return this.seg >= 0; }

    target() {
        if (this.seg < 0) return null;
        return Math.min(4, Math.max(1, this.segments[this.seg].target + this.offset));
    }

    // A guided segment just started. Returns phrases to speak.
    startSegment(index, t) {
        const s = this.segments[index];
        this.asking = null;
        this.mode = "steady";
        if (!s || s.target == null) { this.seg = -1; return []; }
        this.seg = index;
        this.segEnd = t + s.durationMs;
        this.nextCheckAt = t + (this.coachedBefore ? TuneInCoach.CHECK_EVERY_MS : TuneInCoach.FIRST_CHECK_MS);
        if (!this.coachedBefore) this.lastSurgeEnd = t;
        this.coachedBefore = true;
        return [];
    }

    tick(t) {
        if (this.seg < 0) return [];
        if (this.mode === "surge" && t >= this.modeEnd) {
            this.mode = "steady";
            this.lastSurgeEnd = t;
            this.ask("surge", t);
            return ["And ease back. Nice work. How was that surge, 1 to 5?"];
        }
        if (this.mode === "recover" && t >= this.modeEnd) {
            this.mode = "steady";
            this.nextCheckAt = t + 45000;
            return [`When you're ready, settle back in. Aim for a ${this.target()}: ${EFFORT_ANCHORS[this.target()]}.`];
        }
        if (this.asking && t - this.asking.at > TuneInCoach.ASK_TIMEOUT_MS) this.asking = null;
        if (this.mode !== "steady" || this.asking) return [];
        if (t < this.nextCheckAt || this.segEnd - t <= TuneInCoach.QUIET_END_MS) return [];

        if (this.surgeReady(t)) {
            this.mode = "surge";
            this.modeEnd = t + this.surgeSec * 1000;
            return [`Surge! ${this.surgeSec} seconds, fast but relaxed. Go!`];
        }
        this.ask("check", t);
        const asks = ["Check in: how hard does it feel, 1 to 5?", "How's it feeling right now, 1 to 5?", "Quick check: 1 to 5?"];
        return [asks[this.askIndex++ % asks.length]];
    }

    surgeReady(t) {
        const s = this.segments[this.seg];
        return !!s.surges && this.skipSurges === 0 &&
            t - this.lastSurgeEnd >= TuneInCoach.SURGE_GAP_MS &&
            this.lastRating != null && this.lastRating <= this.target() &&
            this.segEnd - t >= this.surgeSec * 1000 + 60000;
    }

    ask(kind, t) {
        this.asking = { kind, at: t };
        this.nextCheckAt = t + TuneInCoach.CHECK_EVERY_MS;
    }

    // A rating relative to the current target: -1 too easy, 0 right, +1 too hard.
    rateRelative(delta, t) {
        const tgt = this.target();
        if (tgt == null) return [];
        return this.rate(Math.min(5, Math.max(1, tgt + delta)), t);
    }

    // The runner rated their effort (1-5), asked or not. Returns phrases.
    rate(rating, t) {
        const r = Math.min(5, Math.max(1, Math.round(rating)));
        this.ratings.push([Math.round(t), r]);
        this.lastRating = r;
        if (this.seg < 0) return [];
        const kind = this.asking ? this.asking.kind : (this.mode === "surge" ? "surge" : "check");
        this.asking = null;
        const tgt = this.target();

        if (kind === "surge") {
            this.nextCheckAt = t + TuneInCoach.CHECK_EVERY_MS;
            if (this.mode === "surge") { this.mode = "steady"; this.lastSurgeEnd = t; }
            if (r >= 5) {
                this.surgeSec = Math.max(TuneInCoach.SURGE_MIN_S, this.surgeSec - 10);
                this.skipSurges = 1;
                this.recover(t);
                return ["Thanks for telling me. Take a minute really easy. The next surge will be shorter."];
            }
            if (r === 4) return ["Good, that's just right for a surge."];
            this.surgeSec = Math.min(TuneInCoach.SURGE_MAX_S, this.surgeSec + 15);
            return [`Great. The next one will be ${this.surgeSec} seconds.`];
        }

        if (r >= 5) {
            this.lowStreak = 0;
            this.highStreak = 0;
            this.offset = Math.max(this.offset - 1, -1);
            this.skipSurges = 2;
            this.recover(t);
            return ["Thanks for telling me. Let's back right off. Walk or jog very gently for a minute. Breathe out long and shake out your arms."];
        }
        if (r > tgt) {
            this.highStreak++;
            this.lowStreak = 0;
            this.nextCheckAt = t + TuneInCoach.AFTER_NUDGE_MS;
            if (this.highStreak >= 2 && tgt > 1 && this.offset > -1) {
                this.offset--;
                this.highStreak = 0;
                return [`Let's make today a gentler one. New aim: a ${this.target()}, ${EFFORT_ANCHORS[this.target()]}.`];
            }
            return [`Ease off a touch. Aim for a ${tgt}: ${EFFORT_ANCHORS[tgt]}.`];
        }
        if (r < tgt) {
            this.lowStreak++;
            this.highStreak = 0;
            this.nextCheckAt = t + TuneInCoach.AFTER_NUDGE_MS;
            if (this.lowStreak >= 2 && tgt < 4 && this.offset < 1) {
                this.offset++;
                this.lowStreak = 0;
                return [`You're flying today! New aim: a ${this.target()}, ${EFFORT_ANCHORS[this.target()]}.`];
            }
            return [r <= tgt - 2
                ? `That's too comfortable for this part. Pick up the pace. Aim for a ${tgt}: ${EFFORT_ANCHORS[tgt]}.`
                : `You've got a bit more in you. Pick it up a little. Aim for a ${tgt}: ${EFFORT_ANCHORS[tgt]}.`];
        }
        this.lowStreak = 0;
        this.highStreak = 0;
        this.skipSurges = Math.max(0, this.skipSurges - 1);
        this.nextCheckAt = t + TuneInCoach.CHECK_EVERY_MS;
        const praise = ["Perfect, that's the sweet spot. Hold it there.", "Spot on. Keep doing exactly this.", "Lovely. That's the one."];
        return [praise[this.praiseIndex++ % praise.length]];
    }

    recover(t) {
        this.mode = "recover";
        this.modeEnd = t + TuneInCoach.RECOVER_MS;
    }

    // For the run screen: what to do right now.
    state(t) {
        if (this.seg < 0) return { active: false };
        const tgt = this.target();
        const left = Math.max(0, this.modeEnd - t);
        let instruction;
        if (this.mode === "surge") instruction = `Surge! Fast but relaxed · ${Math.ceil(left / 1000)} s`;
        else if (this.mode === "recover") instruction = `Back off: walk or jog gently · ${Math.ceil(left / 1000)} s`;
        else instruction = `Aim for a ${tgt}: ${EFFORT_ANCHORS[tgt]}`;
        return { active: true, target: tgt, mode: this.mode, asking: !!this.asking, lastRating: this.lastRating, instruction };
    }
}

if (typeof module !== "undefined") module.exports = { TuneInCoach, EFFORT_ANCHORS, EFFORT_LABELS };
