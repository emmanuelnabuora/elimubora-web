import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { UserProvisioningService } from '../../core/identity/user-provisioning.service';
import type {
  CreateApplicationDto,
  CreateBehaviourNoteDto,
  CreateClassStreamDto,
  CreateGuardianDto,
  DecideApplicationDto,
  DecideTransferDto,
  EnrollStudentDto,
  GraduateStudentDto,
  LinkGuardianDto,
  RequestTransferDto,
  UpdateMedicalDto
} from './sis.dto';
import { SisRepository } from './sis.repository';
import type {
  AdmissionApplication,
  ClassStream,
  Guardian,
  StudentMedical,
  StudentProfile,
  Transfer
} from './sis.types';

const ADMIN_ROLES = new Set(['school_admin', 'principal', 'platform_admin']);
/** Medical data is the platform's most sensitive per-student field — deliberately narrower than ADMIN_ROLES. */
const MEDICAL_ROLES = new Set(['school_admin', 'principal', 'platform_admin']);

@Injectable()
export class SisService {
  constructor(
    private readonly repo: SisRepository,
    private readonly provisioning: UserProvisioningService
  ) {}

  private requireAdmin(user: AuthenticatedUser): void {
    if (!ADMIN_ROLES.has(user.role)) {
      throw new ForbiddenException('Only school administration can perform this action');
    }
  }

  // ---------------- guardians ----------------

  async createGuardian(user: AuthenticatedUser, dto: CreateGuardianDto): Promise<Guardian> {
    this.requireAdmin(user);
    return this.repo.createGuardian(dto);
  }

  async linkGuardianAccount(
    user: AuthenticatedUser,
    guardianId: string,
    accountUserId: string
  ): Promise<void> {
    this.requireAdmin(user);
    const ok = await this.repo.linkGuardianAccount(guardianId, accountUserId);
    if (!ok) throw new NotFoundException('Guardian not found');
  }

  async linkGuardian(user: AuthenticatedUser, studentId: string, dto: LinkGuardianDto): Promise<void> {
    this.requireAdmin(user);
    await this.repo.linkGuardian(studentId, dto);
  }

  listGuardians(studentId: string): Promise<Guardian[]> {
    return this.repo.listGuardiansForStudent(studentId);
  }

  // ---------------- admissions ----------------

  async submitApplication(
    user: AuthenticatedUser,
    dto: CreateApplicationDto
  ): Promise<AdmissionApplication> {
    this.requireAdmin(user);
    return this.repo.createApplication(dto);
  }

  async getApplication(id: string): Promise<AdmissionApplication> {
    const app = await this.repo.findApplication(id);
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async decideApplication(
    user: AuthenticatedUser,
    id: string,
    dto: DecideApplicationDto
  ): Promise<AdmissionApplication> {
    this.requireAdmin(user);
    const ok = await this.repo.decideApplication(id, { ...dto, reviewedBy: user.userId });
    if (!ok) throw new BadRequestException('Application is not in a decidable state');
    return this.getApplication(id);
  }

  // ---------------- class streams ----------------

  async createClassStream(user: AuthenticatedUser, dto: CreateClassStreamDto): Promise<ClassStream> {
    this.requireAdmin(user);
    return this.repo.createClassStream(dto);
  }

  listRoster(classStreamId: string) {
    return this.repo.listRosterForClass(classStreamId);
  }

  // ---------------- enrollment (the cross-cutting orchestration) ----------------

  /**
   * Provisions a system identity for the student (core.users, via the
   * core UserProvisioningService — SIS cannot import the identity
   * module), creates the SIS profile, and allocates a class stream.
   * The admission number is generated here; a genuine sequence
   * generator (avoiding the rare collision-and-retry case) is a
   * defensible follow-up, not built in this pass.
   */
  async enrollStudent(user: AuthenticatedUser, dto: EnrollStudentDto): Promise<StudentProfile> {
    this.requireAdmin(user);
    const { userId } = await this.provisioning.provisionShadowMember({
      tenantId: user.tenantId,
      fullName: dto.fullName,
      role: 'learner'
    });
    const admissionNumber = `${dto.academicYear}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const profile = await this.repo.createStudentProfile({
      studentId: userId,
      admissionNumber,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender
    });
    await this.repo.allocateToClass({
      studentId: userId,
      classStreamId: dto.classStreamId,
      academicYear: dto.academicYear
    });
    if (dto.applicationId) {
      await this.repo.decideApplication(dto.applicationId, {
        status: 'admitted',
        reviewedBy: user.userId
      });
    }
    return profile;
  }

  async getStudentProfile(id: string): Promise<StudentProfile> {
    const profile = await this.repo.findStudentProfile(id);
    if (!profile) throw new NotFoundException('Student profile not found');
    return profile;
  }

  // ---------------- medical records ----------------

  async getMedical(user: AuthenticatedUser, studentId: string): Promise<StudentMedical | null> {
    if (!MEDICAL_ROLES.has(user.role)) {
      throw new ForbiddenException('Medical records are restricted to school administration');
    }
    return this.repo.findMedical(studentId);
  }

  async updateMedical(
    user: AuthenticatedUser,
    studentId: string,
    dto: UpdateMedicalDto
  ): Promise<StudentMedical> {
    if (!MEDICAL_ROLES.has(user.role)) {
      throw new ForbiddenException('Medical records are restricted to school administration');
    }
    return this.repo.upsertMedical(studentId, dto);
  }

  // ---------------- transfers ----------------

  async requestTransfer(
    user: AuthenticatedUser,
    dto: RequestTransferDto,
    studentId: string
  ): Promise<Transfer> {
    this.requireAdmin(user);
    if (dto.toTenantId === user.tenantId) {
      throw new BadRequestException('Cannot transfer a student to the same school');
    }
    return this.repo.requestTransfer({
      fromTenantId: user.tenantId,
      toTenantId: dto.toTenantId,
      studentId,
      requestedBy: user.userId,
      reason: dto.reason
    });
  }

  async getTransfer(user: AuthenticatedUser, id: string): Promise<Transfer> {
    const transfer = await this.repo.findTransfer(id, user.tenantId);
    if (!transfer) throw new NotFoundException('Transfer not found');
    return transfer;
  }

  async decideTransfer(user: AuthenticatedUser, id: string, dto: DecideTransferDto): Promise<Transfer> {
    this.requireAdmin(user);
    const transfer = await this.getTransfer(user, id);
    if (transfer.toTenantId !== user.tenantId) {
      throw new ForbiddenException('Only the receiving school can decide this transfer');
    }
    const ok = await this.repo.decideTransfer(id, user.tenantId, {
      status: dto.status,
      decidedBy: user.userId
    });
    if (!ok) throw new BadRequestException('Transfer is not pending');
    if (dto.status === 'accepted') {
      await this.repo.markTransferredOut(transfer.studentId, transfer.fromTenantId);
    }
    return this.getTransfer(user, id);
  }

  // ---------------- graduation ----------------

  async graduate(user: AuthenticatedUser, studentId: string, dto: GraduateStudentDto): Promise<void> {
    this.requireAdmin(user);
    await this.repo.graduate(studentId, dto);
  }

  // ---------------- behaviour notes ----------------

  async createBehaviourNote(
    user: AuthenticatedUser,
    studentId: string,
    dto: CreateBehaviourNoteDto
  ) {
    const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal', 'platform_admin']);
    if (!STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Only staff can record behaviour notes');
    }
    return this.repo.createBehaviourNote({ ...dto, studentId, recordedBy: user.userId });
  }

  listBehaviourNotes(studentId: string) {
    return this.repo.listBehaviourNotesForStudent(studentId);
  }
}
