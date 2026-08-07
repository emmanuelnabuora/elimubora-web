-- 0025_announcement_audience_targeting.sql
--
-- comms.announcements could only target by grade_level (or NULL for
-- whole-school). It had no concept of *audience* at all -- students,
-- parents, and teachers were never distinguishable targets. In
-- practice this meant every announcement reached every staff member
-- unconditionally (comms.listAll(), no filter), and every student and
-- every guardian shared the exact same grade-level filtering logic
-- with no way to reach one group without the other -- an admin could
-- never send a staff-only notice, or a parent-only notice excluding
-- the students themselves.
--
-- Three separate boolean columns, not a single audience enum or
-- array, because an announcement can genuinely target more than one
-- audience simultaneously (the common case: students AND their
-- parents, but not staff) and a flat boolean-per-audience is simplest
-- to query (a single equality check per audience, not an ANY() over
-- an array). Defaulting all three to true preserves every existing
-- announcement's current behavior exactly -- nothing already sent
-- silently stops reaching anyone it used to reach.

ALTER TABLE comms.announcements
  ADD COLUMN target_students boolean NOT NULL DEFAULT true,
  ADD COLUMN target_parents boolean NOT NULL DEFAULT true,
  ADD COLUMN target_teachers boolean NOT NULL DEFAULT true;
