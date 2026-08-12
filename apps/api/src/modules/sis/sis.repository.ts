import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
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
  TransferRequest,
  TransferRequestStatus,
  TransferStatus
} from './sis.types';

interface TransferRequestRow {
  id: string;
  tenant_id: string;
  student_id: string;
  requested_by: string;
  preferred_tenant_id: string | null;
  reason: string | null;
  status: string;
  cleared: boolean;
  cleared_by: string | null;
  cleared_at: Date | null;
  clearance_note: string | null;
  decided_by: string | null;
  decided_at: Date | null;
  decision_reason: string | null;
  converted_transfer_id: string | null;
}

function isUniqueViolation(err: unknown, constraintName: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === '23505' &&
    (err as { constraint?: string }).constraint === constraintName
  );
}

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
    physicalAddress?: string;
  }): Promise<Guardian> {
    return this.db.withTenantTransaction(async (client) => {
      const id = randomUUID();
      await client.query(
        `INSERT INTO sis.guardians (id, tenant_id, full_name, phone, email, national_id, physical_address)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6)`,
        [
          id,
          input.fullName,
          input.phone ?? null,
          input.email ?? null,
          input.nationalId ?? null,
          input.physicalAddress ?? null
        ]
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
        physicalAddress: input.physicalAddress ?? null,
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

  /**
   * The guardian-linking half of accepting a guardian invitation --
   * called from the composition layer's accept endpoint, which runs
   * pre-authentication (no JWT yet, so no ambient tenant context the
   * usual withTenantTransaction-based methods above rely on). Takes
   * an explicit tenantId and actorId instead, matching the same
   * pattern used for convertTransferRequest earlier this session.
   *
   * Reuses an existing sis.guardians row for this exact user_id if
   * one is already there -- a parent with two children at the same
   * school accepting a second invitation should end up as one
   * guardian record linked to two students, not two separate,
   * duplicate guardian records for the same actual person.
   *
   * permissions and isEmergencyContact persist onto the relationship
   * itself (sis.student_guardians), not the guardian identity -- the
   * same person can reasonably have different permissions or
   * emergency-contact status for different children.
   */
  private static readonly DEFAULT_GUARDIAN_PERMISSIONS = {
    view_academics: true,
    view_attendance: true,
    receive_announcements: true,
    view_finance: true,
    pay_fees: true,
    authorize_student_changes: false
  };

  async linkGuardianFromInvitation(input: {
    tenantId: string;
    userId: string;
    studentId: string;
    fullName: string;
    email: string;
    relationship: string;
    isPrimary: boolean;
    canPickup: boolean;
    isEmergencyContact: boolean;
    permissions: Record<string, boolean> | null;
  }): Promise<void> {
    return this.db.withContext({ tenantId: input.tenantId, actorId: input.userId }, async (client) => {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM sis.guardians
          WHERE tenant_id = core.current_tenant_id() AND user_id = $1 AND deleted_at IS NULL`,
        [input.userId]
      );
      let guardianId = existing.rows[0]?.id;
      if (!guardianId) {
        guardianId = randomUUID();
        await client.query(
          `INSERT INTO sis.guardians (id, tenant_id, full_name, email, user_id)
           VALUES ($1, core.current_tenant_id(), $2, $3, $4)`,
          [guardianId, input.fullName, input.email, input.userId]
        );
        await this.audit.record(client, {
          action: 'guardian.created_from_invitation',
          entityType: 'guardian',
          entityId: guardianId,
          after: { userId: input.userId }
        });
      }
      const linkId = randomUUID();
      const permissionsJson = JSON.stringify({
        ...SisRepository.DEFAULT_GUARDIAN_PERMISSIONS,
        ...(input.permissions ?? {})
      });
      await client.query(
        `INSERT INTO sis.student_guardians
           (id, tenant_id, student_id, guardian_id, relationship, is_primary, can_pickup,
            is_emergency_contact, permissions)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (student_id, guardian_id) DO NOTHING`,
        [
          linkId,
          input.studentId,
          guardianId,
          input.relationship,
          input.isPrimary,
          input.canPickup,
          input.isEmergencyContact,
          permissionsJson
        ]
      );
      await this.audit.record(client, {
        action: 'guardian.linked_from_invitation',
        entityType: 'student_guardian',
        entityId: input.studentId,
        after: { guardianId, relationship: input.relationship }
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
        physical_address: string | null;
        user_id: string | null;
      }>(
        `SELECT g.id, g.full_name, g.phone, g.email, g.national_id, g.physical_address, g.user_id
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
        physicalAddress: r.physical_address,
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
        address: string | null;
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
        status: StudentProfile['status'];
        enrolled_at: Date;
        photo_data_url: string | null;
      }>(
        `SELECT sp.student_id, u.full_name, sp.admission_number, sp.date_of_birth, sp.gender,
                sp.address, sp.emergency_contact_name, sp.emergency_contact_phone, sp.status, sp.enrolled_at,
                sp.photo_data_url
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
        address: r.address,
        emergencyContactName: r.emergency_contact_name,
        emergencyContactPhone: r.emergency_contact_phone,
        status: r.status,
        enrolledAt: r.enrolled_at.toISOString(),
        photoDataUrl: r.photo_data_url
      }));
    });
  }

  // ---------------- student profile & medical ----------------

  async createStudentProfile(input: {
    studentId: string;
    admissionNumber: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female';
    address?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }): Promise<StudentProfile> {
    return this.db.withTenantTransaction(async (client) => {
      await client.query(
        `INSERT INTO sis.student_profiles
           (student_id, tenant_id, admission_number, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone)
         VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5, $6, $7)`,
        [
          input.studentId,
          input.admissionNumber,
          input.dateOfBirth ?? null,
          input.gender ?? null,
          input.address ?? null,
          input.emergencyContactName ?? null,
          input.emergencyContactPhone ?? null
        ]
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
        address: input.address ?? null,
        emergencyContactName: input.emergencyContactName ?? null,
        emergencyContactPhone: input.emergencyContactPhone ?? null,
        status: 'active',
        enrolledAt: new Date().toISOString(),
        photoDataUrl: null
      };
    });
  }

  /** A student's own display name, for contexts (like a guardian invitation email) that need to say which child something is about, without pulling in the full profile. */
  async getStudentName(studentId: string): Promise<string | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ full_name: string }>(
        `SELECT u.full_name FROM core.users u
           JOIN sis.student_profiles sp ON sp.student_id = u.id
          WHERE u.id = $1 AND sp.tenant_id = core.current_tenant_id() AND sp.deleted_at IS NULL`,
        [studentId]
      );
      return rows[0]?.full_name ?? null;
    });
  }

  async findStudentProfile(studentId: string): Promise<StudentProfile | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        student_id: string;
        admission_number: string;
        date_of_birth: Date | null;
        gender: 'male' | 'female' | null;
        address: string | null;
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
        status: StudentProfile['status'];
        enrolled_at: Date;
        photo_data_url: string | null;
      }>(
        `SELECT student_id, admission_number, date_of_birth, gender, address,
                emergency_contact_name, emergency_contact_phone, status, enrolled_at, photo_data_url
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
            address: r.address,
            emergencyContactName: r.emergency_contact_name,
            emergencyContactPhone: r.emergency_contact_phone,
            status: r.status,
            enrolledAt: r.enrolled_at.toISOString(),
            photoDataUrl: r.photo_data_url
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

  /**
   * Updates the editable detail fields shown on the student detail
   * page. Uses key presence, not value truthiness, to distinguish
   * "this field wasn't included in the request" (keep the existing
   * value untouched) from "this field was explicitly sent, even as
   * an empty string" (apply it -- empty means clear). Found and fixed
   * while writing this method's own test: an earlier version did an
   * unconditional set of every column regardless of whether the
   * field was present in the request body at all, which meant any
   * caller sending a genuinely partial patch (omitting a field
   * entirely, not just leaving a form field blank) would silently
   * wipe that column to null. The one caller today (the edit form)
   * always sends every field together so this never showed up in
   * practice, but the endpoint itself was still wrong.
   */
  async updateStudentDetails(
    studentId: string,
    patch: {
      dateOfBirth?: string;
      gender?: 'male' | 'female';
      address?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
    }
  ): Promise<void> {
    return this.db.withTenantTransaction(async (client) => {
      const sets: string[] = [];
      const values: unknown[] = [studentId];
      const applyIfPresent = (key: keyof typeof patch, column: string) => {
        if (key in patch) {
          values.push(patch[key] || null);
          sets.push(`${column} = $${values.length}`);
        }
      };
      applyIfPresent('dateOfBirth', 'date_of_birth');
      applyIfPresent('gender', 'gender');
      applyIfPresent('address', 'address');
      applyIfPresent('emergencyContactName', 'emergency_contact_name');
      applyIfPresent('emergencyContactPhone', 'emergency_contact_phone');

      if (sets.length > 0) {
        await client.query(
          `UPDATE sis.student_profiles SET ${sets.join(', ')}
            WHERE student_id = $1 AND tenant_id = core.current_tenant_id()`,
          values
        );
      }
      await this.audit.record(client, {
        action: 'student.details_updated',
        entityType: 'student_profile',
        entityId: studentId
      });
    });
  }

  /**
   * Updates a student's profile photo — a simple field update on
   * sis.student_profiles directly, not a separate upsert-into-a-
   * related-table like medical records, since photo_data_url lives
   * on the profile row itself.
   */
  async updateStudentPhoto(studentId: string, photoDataUrl: string): Promise<void> {
    return this.db.withTenantTransaction(async (client) => {
      await client.query(
        `UPDATE sis.student_profiles SET photo_data_url = $2 WHERE student_id = $1 AND tenant_id = core.current_tenant_id()`,
        [studentId, photoDataUrl]
      );
      await this.audit.record(client, {
        action: 'student.photo_updated',
        entityType: 'student_profile',
        entityId: studentId
      });
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
      try {
        await client.query(
          `INSERT INTO sis.class_streams
             (id, tenant_id, name, grade_level, academic_year, homeroom_teacher_id)
           VALUES ($1, core.current_tenant_id(), $2, $3, $4, $5)`,
          [id, input.name, input.gradeLevel, input.academicYear, input.homeroomTeacherId ?? null]
        );
      } catch (err) {
        // A real bug found live in production, same class as the
        // invoice/fee-structure one fixed earlier tonight: a class
        // with this exact name already exists for this academic year
        // (class_streams_tenant_id_name_academic_year_key), and
        // nothing was catching that -- it surfaced as a raw,
        // unhandled 500 instead of a clean, understandable message.
        if (isUniqueViolation(err, 'class_streams_tenant_id_name_academic_year_key')) {
          throw new ConflictException(
            `A class named "${input.name}" already exists for ${input.academicYear}.`
          );
        }
        throw err;
      }
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
   * Resolves which class stream a newly enrolled student should go
   * into when the admin didn't pick one explicitly — the least-
   * populated stream matching this grade/year, so students land
   * somewhere reasonable rather than piling into whichever section
   * happens to be listed first. Returns null if no stream exists yet
   * for this grade/year at all (the caller turns that into a clear
   * error rather than a confusing allocation failure).
   */
  async findClassStreamForAutoAssign(gradeLevel: string, academicYear: number): Promise<string | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `SELECT cs.id
           FROM sis.class_streams cs
           LEFT JOIN sis.class_allocations ca
             ON ca.class_stream_id = cs.id AND ca.status = 'active' AND ca.deleted_at IS NULL
          WHERE cs.tenant_id = core.current_tenant_id() AND cs.deleted_at IS NULL
            AND cs.grade_level = $1 AND cs.academic_year = $2
          GROUP BY cs.id, cs.name
          ORDER BY count(ca.id) ASC, cs.name ASC
          LIMIT 1`,
        [gradeLevel, academicYear]
      );
      return rows[0]?.id ?? null;
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

  /**
   * A learner's own profile — a real gap: listStudents() above is
   * admin-only, and there was previously no self-service equivalent
   * at all. Same query shape (the join to class_allocations/
   * class_streams is what "My Timetable" needs classStreamId for),
   * filtered to one student rather than the whole tenant.
   */
  async getMyProfile(studentId: string): Promise<{
    studentId: string;
    fullName: string;
    admissionNumber: string;
    dateOfBirth: string | null;
    gender: 'male' | 'female' | null;
    address: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    status: StudentProfile['status'];
    classStreamId: string | null;
    className: string | null;
    gradeLevel: string | null;
  } | null> {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        student_id: string;
        full_name: string;
        admission_number: string;
        date_of_birth: Date | null;
        gender: 'male' | 'female' | null;
        address: string | null;
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
        status: StudentProfile['status'];
        class_stream_id: string | null;
        class_name: string | null;
        grade_level: string | null;
      }>(
        `SELECT sp.student_id, u.full_name, sp.admission_number, sp.date_of_birth, sp.gender,
                sp.address, sp.emergency_contact_name, sp.emergency_contact_phone, sp.status,
                ca.class_stream_id, cs.name AS class_name, cs.grade_level
           FROM sis.student_profiles sp
           JOIN core.users u ON u.id = sp.student_id
           LEFT JOIN sis.class_allocations ca
             ON ca.student_id = sp.student_id AND ca.status = 'active' AND ca.deleted_at IS NULL
           LEFT JOIN sis.class_streams cs ON cs.id = ca.class_stream_id
          WHERE sp.student_id = $1 AND sp.tenant_id = core.current_tenant_id() AND sp.deleted_at IS NULL`,
        [studentId]
      );
      const r = rows[0];
      if (!r) return null;
      return {
        studentId: r.student_id,
        fullName: r.full_name,
        admissionNumber: r.admission_number,
        dateOfBirth: r.date_of_birth ? r.date_of_birth.toISOString().slice(0, 10) : null,
        gender: r.gender,
        address: r.address,
        emergencyContactName: r.emergency_contact_name,
        emergencyContactPhone: r.emergency_contact_phone,
        status: r.status,
        classStreamId: r.class_stream_id,
        className: r.class_name,
        gradeLevel: r.grade_level
      };
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
        notes: null,
        studentId: null
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
        student_id: string | null;
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
            notes: r.notes,
            studentId: r.student_id
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
        student_id: string | null;
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
        notes: r.notes,
        studentId: r.student_id
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

  /**
   * Records which real student an application became, once enrolled.
   * Deliberately separate from decideApplication rather than reusing
   * its UPDATE -- that query's WHERE clause only matches applications
   * still 'submitted' or 'under_review', so calling it again on an
   * application that's already 'admitted' (exactly the case here --
   * an admin marks it admitted first, then enrols the student
   * afterward, by which point the status is no longer decidable)
   * would silently affect zero rows.
   */
  async linkApplicationToStudent(applicationId: string, studentId: string): Promise<void> {
    return this.db.withTenantTransaction(async (client) => {
      await client.query(
        `UPDATE sis.admission_applications
            SET student_id = $2
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND status = 'admitted'`,
        [applicationId, studentId]
      );
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

  /**
   * Every transfer involving this tenant, either side -- outgoing
   * requests this school sent, or incoming requests another school
   * sent to it. Relies on the transfers_either_side RLS policy
   * (current_tenant_id() IN (from_tenant_id, to_tenant_id)) to scope
   * correctly; no explicit tenant filter needed in the base query,
   * matching findTransfer's approach just above.
   *
   * Enriches with names via LEFT JOIN rather than a second query:
   * school names are always safe to resolve (core.tenants has no
   * RLS at all, deliberately -- it's a global directory table).
   * The student's name is a LEFT JOIN against core.users on purpose,
   * not an inner join -- core.users' own RLS only allows seeing a
   * user who has an active membership in the caller's tenant, which
   * a transferring student genuinely doesn't have yet at the
   * receiving school until the transfer is accepted. Rather than a
   * second query with special-case logic, the LEFT JOIN just
   * naturally resolves to null in that case, and the frontend shows
   * a sensible fallback -- the safety boundary is enforced by RLS
   * itself, not application code re-deciding it.
   */
  async listTransfersForTenant(
    tenantId: string
  ): Promise<Array<Transfer & { studentName: string | null; fromTenantName: string; toTenantName: string }>> {
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
        student_name: string | null;
        from_tenant_name: string;
        to_tenant_name: string;
      }>(
        `SELECT t.*, u.full_name AS student_name, ft.name AS from_tenant_name, tt.name AS to_tenant_name
           FROM sis.transfers t
           LEFT JOIN core.users u ON u.id = t.student_id
           JOIN core.tenants ft ON ft.id = t.from_tenant_id
           JOIN core.tenants tt ON tt.id = t.to_tenant_id
          ORDER BY t.created_at DESC`
      );
      return rows.map((r) => ({
        id: r.id,
        fromTenantId: r.from_tenant_id,
        toTenantId: r.to_tenant_id,
        studentId: r.student_id,
        requestedBy: r.requested_by,
        status: r.status,
        reason: r.reason,
        decidedBy: r.decided_by,
        decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
        studentName: r.student_name,
        fromTenantName: r.from_tenant_name,
        toTenantName: r.to_tenant_name
      }));
    });
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

  // ---------------- student-initiated transfer requests ----------------

  async submitTransferRequest(input: {
    tenantId: string;
    studentId: string;
    requestedBy: string;
    preferredTenantId?: string;
    reason: string;
  }): Promise<TransferRequest> {
    const id = randomUUID();
    return this.db.withContext({ tenantId: input.tenantId, actorId: input.requestedBy }, async (client) => {
      await client.query(
        `INSERT INTO sis.transfer_requests (id, tenant_id, student_id, requested_by, preferred_tenant_id, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, input.tenantId, input.studentId, input.requestedBy, input.preferredTenantId ?? null, input.reason]
      );
      await this.audit.record(client, {
        action: 'transfer_request.submitted',
        entityType: 'transfer_request',
        entityId: id,
        after: { studentId: input.studentId, preferredTenantId: input.preferredTenantId ?? null }
      });
      return {
        id,
        tenantId: input.tenantId,
        studentId: input.studentId,
        requestedBy: input.requestedBy,
        preferredTenantId: input.preferredTenantId ?? null,
        reason: input.reason,
        status: 'pending',
        cleared: false,
        clearedBy: null,
        clearedAt: null,
        clearanceNote: null,
        decidedBy: null,
        decidedAt: null,
        decisionReason: null,
        convertedTransferId: null
      };
    });
  }

  private mapTransferRequestRow(r: TransferRequestRow): TransferRequest {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      studentId: r.student_id,
      requestedBy: r.requested_by,
      preferredTenantId: r.preferred_tenant_id,
      reason: r.reason,
      status: r.status as TransferRequestStatus,
      cleared: r.cleared,
      clearedBy: r.cleared_by,
      clearedAt: r.cleared_at ? r.cleared_at.toISOString() : null,
      clearanceNote: r.clearance_note,
      decidedBy: r.decided_by,
      decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
      decisionReason: r.decision_reason,
      convertedTransferId: r.converted_transfer_id
    };
  }

  /**
   * Every request at this school, for staff -- enriched with the
   * student's name and their preferred school's name where set.
   * Safe to JOIN directly: unlike the cross-tenant sis.transfers
   * case, a transfer_request's student is always this same tenant's
   * own member, so there's no RLS boundary being crossed.
   */
  async listTransferRequestsForTenant(
    tenantId: string
  ): Promise<Array<TransferRequest & { studentName: string | null; preferredTenantName: string | null }>> {
    return this.db.withContext({ tenantId }, async (client) => {
      const { rows } = await client.query<TransferRequestRow & { student_name: string | null; preferred_tenant_name: string | null }>(
        `SELECT tr.*, u.full_name AS student_name, pt.name AS preferred_tenant_name
           FROM sis.transfer_requests tr
           LEFT JOIN core.users u ON u.id = tr.student_id
           LEFT JOIN core.tenants pt ON pt.id = tr.preferred_tenant_id
          WHERE tr.tenant_id = core.current_tenant_id() AND tr.deleted_at IS NULL
          ORDER BY tr.created_at DESC`
      );
      return rows.map((r) => ({
        ...this.mapTransferRequestRow(r),
        studentName: r.student_name,
        preferredTenantName: r.preferred_tenant_name
      }));
    });
  }

  /** A single learner's own requests only -- used for the student-facing view. */
  async listTransferRequestsForStudent(tenantId: string, studentId: string): Promise<TransferRequest[]> {
    return this.db.withContext({ tenantId }, async (client) => {
      const { rows } = await client.query<TransferRequestRow>(
        `SELECT * FROM sis.transfer_requests
          WHERE tenant_id = core.current_tenant_id() AND student_id = $1 AND deleted_at IS NULL
          ORDER BY created_at DESC`,
        [studentId]
      );
      return rows.map((r) => this.mapTransferRequestRow(r));
    });
  }

  async findTransferRequest(id: string, tenantId: string): Promise<TransferRequest | null> {
    return this.db.withContext({ tenantId }, async (client) => {
      const { rows } = await client.query<TransferRequestRow>(
        `SELECT * FROM sis.transfer_requests
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND deleted_at IS NULL`,
        [id]
      );
      return rows[0] ? this.mapTransferRequestRow(rows[0]) : null;
    });
  }

  async clearTransferRequest(
    id: string,
    tenantId: string,
    clearedBy: string,
    clearanceNote?: string
  ): Promise<TransferRequest | null> {
    return this.db.withContext({ tenantId, actorId: clearedBy }, async (client) => {
      const { rows } = await client.query<TransferRequestRow>(
        `UPDATE sis.transfer_requests
            SET cleared = true, cleared_by = $2, cleared_at = now(), clearance_note = $3
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND status = 'pending'
          RETURNING *`,
        [id, clearedBy, clearanceNote ?? null]
      );
      if (!rows[0]) return null;
      await this.audit.record(client, {
        action: 'transfer_request.cleared',
        entityType: 'transfer_request',
        entityId: id,
        after: { clearedBy }
      });
      return this.mapTransferRequestRow(rows[0]);
    });
  }

  async declineTransferRequest(
    id: string,
    tenantId: string,
    decidedBy: string,
    reason: string
  ): Promise<TransferRequest | null> {
    return this.db.withContext({ tenantId, actorId: decidedBy }, async (client) => {
      const { rows } = await client.query<TransferRequestRow>(
        `UPDATE sis.transfer_requests
            SET status = 'declined', decided_by = $2, decided_at = now(), decision_reason = $3
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND status = 'pending'
          RETURNING *`,
        [id, decidedBy, reason]
      );
      if (!rows[0]) return null;
      await this.audit.record(client, {
        action: 'transfer_request.declined',
        entityType: 'transfer_request',
        entityId: id,
        after: { reason }
      });
      return this.mapTransferRequestRow(rows[0]);
    });
  }

  /**
   * Creates the formal, existing sis.transfers record and links this
   * request to it in one transaction -- both must succeed together,
   * since a formal transfer created without the link (or a link
   * without the formal transfer) would leave this in a genuinely
   * inconsistent state. Requires cleared = true and status = 'pending'
   * at the database level (not just checked in application code), so
   * this can't be called twice or on an unlceared request even under
   * a race.
   */
  async convertTransferRequest(
    id: string,
    tenantId: string,
    toTenantId: string,
    decidedBy: string
  ): Promise<{ request: TransferRequest; transfer: Transfer } | null> {
    return this.db.withContext({ tenantId, actorId: decidedBy }, async (client) => {
      const reqRows = await client.query<TransferRequestRow>(
        `SELECT * FROM sis.transfer_requests
          WHERE id = $1 AND tenant_id = core.current_tenant_id() AND status = 'pending' AND cleared = true
          FOR UPDATE`,
        [id]
      );
      const existing = reqRows.rows[0];
      if (!existing) return null;

      const transferId = randomUUID();
      await client.query(
        `INSERT INTO sis.transfers (id, from_tenant_id, to_tenant_id, student_id, requested_by, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [transferId, tenantId, toTenantId, existing.student_id, decidedBy, existing.reason]
      );

      const updatedRows = await client.query<TransferRequestRow>(
        `UPDATE sis.transfer_requests
            SET status = 'converted', decided_by = $2, decided_at = now(), converted_transfer_id = $3
          WHERE id = $1
          RETURNING *`,
        [id, decidedBy, transferId]
      );

      await this.audit.record(client, {
        action: 'transfer_request.converted',
        entityType: 'transfer_request',
        entityId: id,
        after: { transferId, toTenantId }
      });

      return {
        request: this.mapTransferRequestRow(updatedRows.rows[0]!),
        transfer: {
          id: transferId,
          fromTenantId: tenantId,
          toTenantId,
          studentId: existing.student_id,
          requestedBy: decidedBy,
          status: 'pending',
          reason: existing.reason,
          decidedBy: null,
          decidedAt: null
        }
      };
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

  /**
   * Gives an enrolled student's EXISTING shadow account (created by
   * enrollStudent via UserProvisioningService.provisionShadowMember)
   * real, usable login credentials — a real email and a real password
   * — rather than creating a new, disconnected account. Preserving
   * the same core.users.id matters: every submission, attendance
   * record, and grade already references this specific id.
   *
   * core.users' RLS (migration 0003) only has a policy for "a user
   * updates their own row" (users_self: id = current_actor_id()) —
   * there's no separate admin-updates-tenant-member policy. Setting
   * actorId to the STUDENT's own id in withContext satisfies that
   * policy legitimately: from RLS's perspective this looks like (and
   * functionally is) the same "acting on behalf of" pattern
   * UserProvisioningService and TenantProvisioningService already use
   * for cross-actor operations, not a new bypass invented here.
   */
  /** Returns false if no such student exists in this tenant, so the service layer can throw a proper 404. */
  async activateAccount(studentId: string, email: string, passwordHash: string): Promise<boolean> {
    const existing = await this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT 1 FROM sis.student_profiles WHERE student_id = $1 AND deleted_at IS NULL`,
        [studentId]
      );
      return rows.length > 0;
    });
    if (!existing) return false;

    await this.db.withTenantTransaction(
      async (client) => {
        await client.query(`UPDATE core.users SET email = $1, password_hash = $2 WHERE id = $3`, [
          email.trim().toLowerCase(),
          passwordHash,
          studentId
        ]);
      },
      { actorId: studentId }
    );
    return true;
  }
}
