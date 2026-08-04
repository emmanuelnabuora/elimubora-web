import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { DatabaseService } from '../../core/database/database.service';
import { OutboxService } from '../../core/outbox/outbox.service';
import type {
  AdmissionApplication,
  ApplicationStatus,
  BehaviourNote,
  ClassStream,
  Guardian,
  StudentMedical,
  StudentProfile,
  Transfer,
  TransferStatus
} from './sis.types';

/**
 * All SIS SQL. Every write is a tenant-scoped transaction (RLS-backed
 * isolation) with an audit entry in the same transaction, except
 * sis.transfers, whose RLS policy spans two tenants deliberately
 * (ADR-008) — its writes use withContext with an explicit tenantId
 * rather than the ambient request tenant, since a transfer decision
 * is made by the RECEIVING tenant's staff about a record whose
 * "home" tenant is the sender.
 */
@Injectable()
export class SisRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService
  ) {}

  // ---------------- guardians ----------------

  async createGuardian(input: {
    fullName: string;
    phone?: string;
    email?: string;
    nationalId?: string;
  }): Promise<Guardian> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      await client.query(
        `INSERT INTO sis.guardians (id, tenant_id, full_name, phone, email, national_id)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5)`,
        [id, input.fullName, input.phone ?? null, input.email ?? null, input.nationalId ?? null]
      );
      await this.audit.record(client, {
        action: 'guardian.created',
        entityType: 'guardian',
        entityId: id,
        after: { fullName: input.fullName }
      });
      return {
        id,
        fullName: input.fullName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        nationalId: input.nationalId ?? null,
        userId: null
      };
    });
  }

  /** Connects an existing parent-portal login account to a guardian contact record. */
  async linkGuardianAccount(guardianId: string, userId: string): Promise<boolean> {
    return this.db.withTenantTransaction(async (client) => {
      const res = await client.query(
        `UPDATE sis.guardians SET user_id = $2
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [guardianId, userId]
      );
      if ((res.rowCount ?? 0) === 1) {
        await this.audit.record(client, {
          action: 'guardian.account_linked',
          entityType: 'guardian',
          entityId: guardianId,
          after: { userId }
        });
      }
      return res.rowCount === 1;
    });
  }

  async linkGuardian(
    studentId: string,
    input: { guardianId: string; relationship: string; isPrimary: boolean; canPickup: boolean }
  ): Promise<void> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      await client.query(
        `INSERT INTO sis.student_guardians
           (id, tenant_id, student_id, guardian_id, relationship, is_primary, can_pickup)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6)`,
        [id, studentId, input.guardianId, input.relationship, input.isPrimary, input.canPickup]
      );
      await this.audit.record(client, {
        action: 'guardian.linked',
        entityType: 'student_guardian',
        entityId: id,
        after: { studentId, guardianId: input.guardianId, relationship: input.relationship }
      });
    });
  }

  async isGuardianOf(userId: string, studentId: string): Promise<boolean> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT 1 FROM sis.student_guardians sg
           JOIN sis.guardians g ON g.id = sg.guardian_id
          WHERE sg.student_id = $1 AND g.user_id = $2
            AND sg.tenant_id = core.current_tenant_id() AND sg.deleted_at IS NULL`,
        [studentId, userId]
      );
      return rows.length > 0;
    });
  }

  async listGuardiansForStudent(studentId: string): Promise<Guardian[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string;
        full_name: string;
        phone: string | null;
        email: string | null;
        national_id: string | null;
        user_id: string | null;
      }>(
        `SELECT g.id, g.full_name, g.phone, g.email, g.national_id, g.user_id
           FROM sis.guardians g
           JOIN sis.student_guardians sg ON sg.guardian_id = g.id
          WHERE sg.student_id = $1 AND sg.tenant_id = core.current_tenant_id()
            AND sg.deleted_at IS NULL AND g.deleted_at IS NULL`,
        [studentId]
      );
      return rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        phone: r.phone,
        email: r.email,
        nationalId: r.national_id,
        userId: r.user_id
      }));
    });
  }

  /** Reverse of isGuardianOf: given a guardian's own account, list their linked children in the current tenant. */
  async listChildrenForGuardianUser(userId: string): Promise<Array<StudentProfile & { fullName: string }>> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        student_id: string;
        full_name: string;
        admission_number: string;
        date_of_birth: Date | null;
        gender: 'male' | 'female' | null;
        status: StudentProfile['status'];
        enrolled_at: Date;
      }>(
        `SELECT sp.student_id, u.full_name, sp.admission_number, sp.date_of_birth, sp.gender, sp.status, sp.enrolled_at
           FROM sis.student_profiles sp
           JOIN sis.student_guardians sg ON sg.student_id = sp.student_id
           JOIN sis.guardians g ON g.id = sg.guardian_id
           JOIN core.users u ON u.id = sp.student_id
          WHERE g.user_id = $1 AND sp.tenant_id = core.current_tenant_id()
            AND sg.deleted_at IS NULL AND sp.deleted_at IS NULL`,
        [userId]
      );
      return rows.map((r) => ({
        studentId: r.student_id,
        fullName: r.full_name,
        admissionNumber: r.admission_number,
        dateOfBirth: r.date_of_birth ? r.date_of_birth.toISOString().slice(0, 10) : null,
        gender: r.gender,
        status: r.status,
        enrolledAt: r.enrolled_at.toISOString()
      }));
    });
  }

  // ---------------- student profile & medical ----------------

  async createStudentProfile(input: {
    studentId: string;
    admissionNumber: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female';
  }): Promise<StudentProfile> {
    return this.db.withTenantTransaction(async (client) => {
      await client.query(
        `INSERT INTO sis.student_profiles
           (student_id, tenant_id, admission_number, date_of_birth, gender)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4)`,
        [input.studentId, input.admissionNumber, input.dateOfBirth ?? null, input.gender ?? null]
      );
      await this.audit.record(client, {
        action: 'student.enrolled',
        entityType: 'student_profile',
        entityId: input.studentId,
        after: { admissionNumber: input.admissionNumber }
      });
      await this.outbox.append(client, {
        aggregateType: 'student',
        aggregateId: input.studentId,
        eventType: 'student.enrolled.v1',
        payload: { studentId: input.studentId, admissionNumber: input.admissionNumber }
      });
      return {
        studentId: input.studentId,
        admissionNumber: input.admissionNumber,
        dateOfBirth: input.dateOfBirth ?? null,
        gender: input.gender ?? null,
        status: 'active',
        enrolledAt: new Date().toISOString()
      };
    });
  }

  async findStudentProfile(studentId: string): Promise<StudentProfile | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        student_id: string;
        admission_number: string;
        date_of_birth: Date | null;
        gender: 'male' | 'female' | null;
        status: StudentProfile['status'];
        enrolled_at: Date;
      }>(
        `SELECT student_id, admission_number, date_of_birth, gender, status, enrolled_at
           FROM sis.student_profiles
          WHERE student_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [studentId]
      );
      const r = rows[0];
      return r
        ? {
            studentId: r.student_id,
            admissionNumber: r.admission_number,
            dateOfBirth: r.date_of_birth ? r.date_of_birth.toISOString().slice(0, 10) : null,
            gender: r.gender,
            status: r.status,
            enrolledAt: r.enrolled_at.toISOString()
          }
        : null;
    });
  }

  /** Role-gated at the service layer; kept in its own table for defense in depth. */
  async upsertMedical(
    studentId: string,
    patch: { bloodGroup?: string; allergies?: string; medicalNotes?: string }
  ): Promise<StudentMedical> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        student_id: string;
        blood_group: string | null;
        allergies: string | null;
        medical_notes: string | null;
      }>(
        `INSERT INTO sis.student_medical (student_id, tenant_id, blood_group, allergies, medical_notes)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4)
         ON CONFLICT (student_id) DO UPDATE SET
           blood_group = COALESCE(EXCLUDED.blood_group, sis.student_medical.blood_group),
           allergies = COALESCE(EXCLUDED.allergies, sis.student_medical.allergies),
           medical_notes = COALESCE(EXCLUDED.medical_notes, sis.student_medical.medical_notes),
           updated_at = now()
         RETURNING student_id, blood_group, allergies, medical_notes`,
        [studentId, patch.bloodGroup ?? null, patch.allergies ?? null, patch.medicalNotes ?? null]
      );
      await this.audit.record(client, {
        action: 'student.medical_updated',
        entityType: 'student_medical',
        entityId: studentId
      });
      const r = rows[0]!;
      return {
        studentId: r.student_id,
        bloodGroup: r.blood_group,
        allergies: r.allergies,
        medicalNotes: r.medical_notes
      };
    });
  }

  async findMedical(studentId: string): Promise<StudentMedical | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        student_id: string;
        blood_group: string | null;
        allergies: string | null;
        medical_notes: string | null;
      }>(
        `SELECT student_id, blood_group, allergies, medical_notes
           FROM sis.student_medical
          WHERE student_id = $1 AND tenant_id = core.current_tenant_id()`,
        [studentId]
      );
      const r = rows[0];
      return r
        ? { studentId: r.student_id, bloodGroup: r.blood_group, allergies: r.allergies, medicalNotes: r.medical_notes }
        : null;
    });
  }

  // ---------------- class streams & allocation ----------------

  async createClassStream(input: {
    name: string;
    gradeLevel: string;
    academicYear: number;
    homeroomTeacherId?: string;
  }): Promise<ClassStream> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      await client.query(
        `INSERT INTO sis.class_streams
           (id, tenant_id, name, grade_level, academic_year, homeroom_teacher_id)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5)`,
        [id, input.name, input.gradeLevel, input.academicYear, input.homeroomTeacherId ?? null]
      );
      await this.audit.record(client, {
        action: 'class_stream.created',
        entityType: 'class_stream',
        entityId: id,
        after: { name: input.name }
      });
      return {
        id,
        name: input.name,
        gradeLevel: input.gradeLevel,
        academicYear: input.academicYear,
        homeroomTeacherId: input.homeroomTeacherId ?? null
      };
    });
  }

  async findClassStream(id: string): Promise<ClassStream | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string;
        name: string;
        grade_level: string;
        academic_year: number;
        homeroom_teacher_id: string | null;
      }>(
        `SELECT id, name, grade_level, academic_year, homeroom_teacher_id
           FROM sis.class_streams
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [id]
      );
      const r = rows[0];
      return r
        ? {
            id: r.id,
            name: r.name,
            gradeLevel: r.grade_level,
            academicYear: r.academic_year,
            homeroomTeacherId: r.homeroom_teacher_id
          }
        : null;
    });
  }

  /** All class streams in the tenant — the admin dashboard's "which class" dropdown/list. */
  async listClassStreams(): Promise<ClassStream[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string;
        name: string;
        grade_level: string;
        academic_year: number;
        homeroom_teacher_id: string | null;
      }>(
        `SELECT id, name, grade_level, academic_year, homeroom_teacher_id
           FROM sis.class_streams
          WHERE tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY academic_year DESC, grade_level, name`
      );
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        gradeLevel: r.grade_level,
        academicYear: r.academic_year,
        homeroomTeacherId: r.homeroom_teacher_id
      }));
    });
  }

  /**
   * All active students in the tenant, with their name (from
   * core.users — student_profiles itself has no name column) and
   * current class allocation if any. A real gap the admin dashboard
   * needs closed: previously only single-student lookup and
   * per-class-stream rosters existed, no tenant-wide list at all.
   */
  async listStudents(): Promise<
    Array<{
      studentId: string;
      fullName: string;
      admissionNumber: string;
      status: StudentProfile['status'];
      classStreamId: string | null;
      className: string | null;
      gradeLevel: string | null;
    }>
  > {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        student_id: string;
        full_name: string;
        admission_number: string;
        status: StudentProfile['status'];
        class_stream_id: string | null;
        class_name: string | null;
        grade_level: string | null;
      }>(
        `SELECT sp.student_id, u.full_name, sp.admission_number, sp.status,
                ca.class_stream_id, cs.name AS class_name, cs.grade_level
           FROM sis.student_profiles sp
           JOIN core.users u ON u.id = sp.student_id
           LEFT JOIN sis.class_allocations ca
             ON ca.student_id = sp.student_id AND ca.status = 'active' AND ca.deleted_at IS NULL
           LEFT JOIN sis.class_streams cs ON cs.id = ca.class_stream_id
          WHERE sp.tenant_id = core.current_tenant_id() AND sp.deleted_at IS NULL
          ORDER BY u.full_name`
      );
      return rows.map((r) => ({
        studentId: r.student_id,
        fullName: r.full_name,
        admissionNumber: r.admission_number,
        status: r.status,
        classStreamId: r.class_stream_id,
        className: r.class_name,
        gradeLevel: r.grade_level
      }));
    });
  }

  async allocateToClass(input: {
    studentId: string;
    classStreamId: string;
    academicYear: number;
  }): Promise<void> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      await client.query(
        `INSERT INTO sis.class_allocations
           (id, tenant_id, student_id, class_stream_id, academic_year)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4)
         ON CONFLICT (student_id, academic_year) DO UPDATE SET
           class_stream_id = EXCLUDED.class_stream_id, status = 'active', ended_at = NULL`,
        [id, input.studentId, input.classStreamId, input.academicYear]
      );
      await this.audit.record(client, {
        action: 'class_allocation.created',
        entityType: 'class_allocation',
        entityId: input.studentId,
        after: { classStreamId: input.classStreamId, academicYear: input.academicYear }
      });
    });
  }

  async listRosterForClass(
    classStreamId: string
  ): Promise<Array<{ studentId: string; admissionNumber: string }>> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ student_id: string; admission_number: string }>(
        `SELECT ca.student_id, sp.admission_number
           FROM sis.class_allocations ca
           JOIN sis.student_profiles sp ON sp.student_id = ca.student_id
          WHERE ca.class_stream_id = $1 AND ca.status = 'active'
            AND ca.tenant_id = core.current_tenant_id() AND ca.deleted_at IS NULL`,
        [classStreamId]
      );
      return rows.map((r) => ({ studentId: r.student_id, admissionNumber: r.admission_number }));
    });
  }

  /** Current grade level via the student's active class allocation — used to target announcements. */
  async getCurrentGradeLevel(studentId: string): Promise<string | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ grade_level: string }>(
        `SELECT cs.grade_level
           FROM sis.class_allocations ca
           JOIN sis.class_streams cs ON cs.id = ca.class_stream_id
          WHERE ca.student_id = $1 AND ca.status = 'active'
            AND ca.tenant_id = core.current_tenant_id() AND ca.deleted_at IS NULL
          ORDER BY ca.academic_year DESC
          LIMIT 1`,
        [studentId]
      );
      return rows[0]?.grade_level ?? null;
    });
  }

  // ---------------- admissions ----------------

  async createApplication(input: {
    candidateName: string;
    dateOfBirth?: string;
    guardianName: string;
    guardianPhone: string;
    gradeLevelApplied: string;
  }): Promise<AdmissionApplication> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      await client.query(
        `INSERT INTO sis.admission_applications
           (id, tenant_id, candidate_name, date_of_birth, guardian_name, guardian_phone, grade_level_applied)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6)`,
        [
          id,
          input.candidateName,
          input.dateOfBirth ?? null,
          input.guardianName,
          input.guardianPhone,
          input.gradeLevelApplied
        ]
      );
      await this.audit.record(client, {
        action: 'application.submitted',
        entityType: 'admission_application',
        entityId: id,
        after: { candidateName: input.candidateName }
      });
      return {
        id,
        candidateName: input.candidateName,
        dateOfBirth: input.dateOfBirth ?? null,
        guardianName: input.guardianName,
        guardianPhone: input.guardianPhone,
        gradeLevelApplied: input.gradeLevelApplied,
        status: 'submitted',
        reviewedBy: null,
        decidedAt: null,
        notes: null
      };
    });
  }

  async findApplication(id: string): Promise<AdmissionApplication | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string;
        candidate_name: string;
        date_of_birth: Date | null;
        guardian_name: string;
        guardian_phone: string;
        grade_level_applied: string;
        status: ApplicationStatus;
        reviewed_by: string | null;
        decided_at: Date | null;
        notes: string | null;
      }>(
        `SELECT * FROM sis.admission_applications
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [id]
      );
      const r = rows[0];
      return r
        ? {
            id: r.id,
            candidateName: r.candidate_name,
            dateOfBirth: r.date_of_birth ? r.date_of_birth.toISOString().slice(0, 10) : null,
            guardianName: r.guardian_name,
            guardianPhone: r.guardian_phone,
            gradeLevelApplied: r.grade_level_applied,
            status: r.status,
            reviewedBy: r.reviewed_by,
            decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
            notes: r.notes
          }
        : null;
    });
  }

  /**
   * All applications in the tenant — a real gap: only single-by-id
   * lookup existed before, which requires already knowing a specific
   * application's UUID. An admin reviewing what's awaiting a decision
   * has no way to discover that without this.
   */
  async listApplications(): Promise<AdmissionApplication[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string;
        candidate_name: string;
        date_of_birth: Date | null;
        guardian_name: string;
        guardian_phone: string;
        grade_level_applied: string;
        status: ApplicationStatus;
        reviewed_by: string | null;
        decided_at: Date | null;
        notes: string | null;
      }>(
        `SELECT * FROM sis.admission_applications
          WHERE tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY
            CASE status WHEN 'submitted' THEN 0 WHEN 'under_review' THEN 1 ELSE 2 END,
            candidate_name`
      );
      return rows.map((r) => ({
        id: r.id,
        candidateName: r.candidate_name,
        dateOfBirth: r.date_of_birth ? r.date_of_birth.toISOString().slice(0, 10) : null,
        guardianName: r.guardian_name,
        guardianPhone: r.guardian_phone,
        gradeLevelApplied: r.grade_level_applied,
        status: r.status,
        reviewedBy: r.reviewed_by,
        decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
        notes: r.notes
      }));
    });
  }

  async decideApplication(
    id: string,
    input: { status: ApplicationStatus; notes?: string; reviewedBy: string }
  ): Promise<boolean> {
    return this.db.withTenantTransaction(async (client) => {
      const res = await client.query(
        `UPDATE sis.admission_applications
            SET status = $2, notes = COALESCE($3, notes), reviewed_by = $4, decided_at = now()
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND status IN ('submitted', 'under_review')`,
        [id, input.status, input.notes ?? null, input.reviewedBy]
      );
      if ((res.rowCount ?? 0) === 1) {
        await this.audit.record(client, {
          action: 'application.decided',
          entityType: 'admission_application',
          entityId: id,
          after: { status: input.status }
        });
      }
      return res.rowCount === 1;
    });
  }

  // ---------------- transfers (cross-tenant) ----------------

  async requestTransfer(input: {
    fromTenantId: string;
    toTenantId: string;
    studentId: string;
    requestedBy: string;
    reason?: string;
  }): Promise<Transfer> {
    const id = randomUUID();
    // Cross-tenant write: the RLS policy admits either side, so a plain
    // withContext bound to the SOURCE tenant satisfies the WITH CHECK.
    return this.db.withContext(
      { tenantId: input.fromTenantId, actorId: input.requestedBy },
      async (client) => {
        await client.query(
          `INSERT INTO sis.transfers (id, from_tenant_id, to_tenant_id, student_id, requested_by, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, input.fromTenantId, input.toTenantId, input.studentId, input.requestedBy, input.reason ?? null]
        );
        await this.audit.record(client, {
          action: 'transfer.requested',
          entityType: 'transfer',
          entityId: id,
          after: { toTenantId: input.toTenantId, studentId: input.studentId }
        });
        return {
          id,
          fromTenantId: input.fromTenantId,
          toTenantId: input.toTenantId,
          studentId: input.studentId,
          requestedBy: input.requestedBy,
          status: 'pending' as TransferStatus,
          reason: input.reason ?? null,
          decidedBy: null,
          decidedAt: null
        };
      }
    );
  }

  async findTransfer(id: string, tenantId: string): Promise<Transfer | null> {
    return this.db.withContext({ tenantId }, async (client) => {
      const { rows } = await client.query<{
        id: string;
        from_tenant_id: string;
        to_tenant_id: string;
        student_id: string;
        requested_by: string;
        status: TransferStatus;
        reason: string | null;
        decided_by: string | null;
        decided_at: Date | null;
      }>('SELECT * FROM sis.transfers WHERE id = $1', [id]);
      const r = rows[0];
      return r
        ? {
            id: r.id,
            fromTenantId: r.from_tenant_id,
            toTenantId: r.to_tenant_id,
            studentId: r.student_id,
            requestedBy: r.requested_by,
            status: r.status,
            reason: r.reason,
            decidedBy: r.decided_by,
            decidedAt: r.decided_at ? r.decided_at.toISOString() : null
          }
        : null;
    });
  }

  /** Only the receiving tenant may decide; enforced by the service layer. */
  async decideTransfer(
    id: string,
    receivingTenantId: string,
    input: { status: 'accepted' | 'rejected'; decidedBy: string }
  ): Promise<boolean> {
    return this.db.withContext(
      { tenantId: receivingTenantId, actorId: input.decidedBy },
      async (client) => {
        const res = await client.query(
          `UPDATE sis.transfers
            SET status = $2, decided_by = $3, decided_at = now()
          WHERE id = $1 AND to_tenant_id = $4 AND status = 'pending'`,
          [id, input.status, input.decidedBy, receivingTenantId]
        );
        if ((res.rowCount ?? 0) === 1) {
          await this.audit.record(client, {
            action: 'transfer.decided',
            entityType: 'transfer',
            entityId: id,
            after: { status: input.status }
          });
          if (input.status === 'accepted') {
            await this.outbox.append(client, {
              aggregateType: 'transfer',
              aggregateId: id,
              eventType: 'transfer.accepted.v1',
              payload: { transferId: id }
            });
          }
        }
        return res.rowCount === 1;
      }
    );
  }

  /** Marks the source-side profile as transferred out once accepted. */
  async markTransferredOut(studentId: string, sourceTenantId: string): Promise<void> {
    return this.db.withContext({ tenantId: sourceTenantId }, async (client) => {
      await client.query(
        `UPDATE sis.student_profiles SET status = 'transferred_out'
          WHERE student_id = $1 AND tenant_id = core.current_tenant_id()`,
        [studentId]
      );
    });
  }

  // ---------------- graduation ----------------

  async graduate(studentId: string, input: { cohortYear: number; notes?: string }): Promise<void> {
    return this.db.withTenantTransaction(async (client) => {
      await client.query(
        `INSERT INTO sis.graduations (id, tenant_id, student_id, cohort_year, notes)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4)`,
        [randomUUID(), studentId, input.cohortYear, input.notes ?? null]
      );
      await client.query(
        `UPDATE sis.student_profiles SET status = 'graduated'
          WHERE student_id = $1 AND tenant_id = core.current_tenant_id()`,
        [studentId]
      );
      await this.audit.record(client, {
        action: 'student.graduated',
        entityType: 'student_profile',
        entityId: studentId,
        after: { cohortYear: input.cohortYear }
      });
      await this.outbox.append(client, {
        aggregateType: 'student',
        aggregateId: studentId,
        eventType: 'student.graduated.v1',
        payload: { studentId, cohortYear: input.cohortYear }
      });
    });
  }

  // ---------------- behaviour notes ----------------

  async createBehaviourNote(input: {
    studentId: string;
    category: 'positive' | 'concern' | 'incident';
    note: string;
    recordedBy: string;
    occurredAt?: string;
  }): Promise<BehaviourNote> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      const { rows } = await client.query<{
        id: string;
        student_id: string;
        category: 'positive' | 'concern' | 'incident';
        note: string;
        recorded_by: string;
        occurred_at: Date;
      }>(
        `INSERT INTO sis.behaviour_notes (id, tenant_id, student_id, category, note, recorded_by, occurred_at)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, COALESCE($6, now()))
         RETURNING *`,
        [id, input.studentId, input.category, input.note, input.recordedBy, input.occurredAt ?? null]
      );
      await this.audit.record(client, {
        action: 'behaviour_note.created',
        entityType: 'behaviour_note',
        entityId: id,
        after: { studentId: input.studentId, category: input.category }
      });
      const r = rows[0]!;
      return {
        id: r.id,
        studentId: r.student_id,
        category: r.category,
        note: r.note,
        recordedBy: r.recorded_by,
        occurredAt: r.occurred_at.toISOString()
      };
    });
  }

  async listBehaviourNotesForStudent(studentId: string): Promise<BehaviourNote[]> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string;
        student_id: string;
        category: 'positive' | 'concern' | 'incident';
        note: string;
        recorded_by: string;
        occurred_at: Date;
      }>(
        `SELECT * FROM sis.behaviour_notes
          WHERE student_id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL
          ORDER BY occurred_at DESC`,
        [studentId]
      );
      return rows.map((r) => ({
        id: r.id,
        studentId: r.student_id,
        category: r.category,
        note: r.note,
        recordedBy: r.recorded_by,
        occurredAt: r.occurred_at.toISOString()
      }));
    });
  }
}
