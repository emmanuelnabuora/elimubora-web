import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ATTENDANCE_MARKER, type AttendanceMarker } from '../../core/attendance/attendance-marker.port';
import { FILE_STORAGE_PROVIDER, type FileStorageProvider } from '../../core/storage/file-storage.port';
import { AttendanceQrService } from './attendance-qr.service';
import type {
  RedeemAttendanceQrDto,
  RedeemAttendanceQrForStudentDto,
  RegisterDeviceDto,
  StartAttendanceSessionDto,
  UploadDto
} from './mobile.dto';
import { MobileRepository } from './mobile.repository';
import type { Device, UploadRecord } from './mobile.types';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB — generous for a phone camera photo, not a video
const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal', 'platform_admin']);

@Injectable()
export class MobileService {
  constructor(
    private readonly repo: MobileRepository,
    private readonly qr: AttendanceQrService,
    @Inject(ATTENDANCE_MARKER) private readonly attendanceMarker: AttendanceMarker,
    @Inject(FILE_STORAGE_PROVIDER) private readonly storage: FileStorageProvider
  ) {}

  // ---------------- devices ----------------

  registerDevice(user: AuthenticatedUser, dto: RegisterDeviceDto): Promise<Device> {
    return this.repo.registerDevice({ userId: user.userId, ...dto });
  }

  async unregisterDevice(pushToken: string): Promise<void> {
    await this.repo.unregisterDevice(pushToken);
  }

  // ---------------- uploads ----------------

  async upload(user: AuthenticatedUser, dto: UploadDto): Promise<UploadRecord> {
    const bytes = Buffer.from(dto.dataBase64, 'base64');
    if (bytes.length === 0) {
      throw new BadRequestException('Empty upload');
    }
    if (bytes.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        `Upload exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit`
      );
    }
    const { storageKey } = await this.storage.put(bytes, dto.contentType);
    return this.repo.recordUpload({
      uploadedBy: user.userId,
      storageKey,
      contentType: dto.contentType,
      sizeBytes: bytes.length
    });
  }

  async getUploadBytes(
    user: AuthenticatedUser,
    storageKey: string
  ): Promise<{ bytes: Buffer; contentType: string }> {
    void user; // tenant scoping already enforced by findUploadByStorageKey's RLS-backed query
    const record = await this.repo.findUploadByStorageKey(storageKey);
    if (!record) throw new NotFoundException('Upload not found');
    const bytes = await this.storage.get(storageKey);
    if (!bytes) throw new NotFoundException('Upload not found');
    return { bytes, contentType: record.contentType };
  }

  // ---------------- QR attendance ----------------

  /** Staff-only: generates the signed payload a teacher's device renders as a QR code. */
  async startAttendanceSession(
    user: AuthenticatedUser,
    dto: StartAttendanceSessionDto
  ): Promise<{ token: string }> {
    if (!STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Only teaching staff can start an attendance session');
    }
    const token = await this.qr.signSession({
      classStreamId: dto.classStreamId,
      attendanceDate: dto.attendanceDate
    });
    return { token };
  }

  /** Self-service: an authenticated learner scans the displayed session code to check themselves in. */
  async redeemAttendanceQr(user: AuthenticatedUser, dto: RedeemAttendanceQrDto): Promise<void> {
    if (user.role !== 'learner') {
      throw new ForbiddenException('Only learners can self-check-in via attendance QR');
    }
    const claims = await this.qr.verifySession(dto.token);
    await this.attendanceMarker.markPresent({
      classStreamId: claims.classStreamId,
      learnerId: user.userId,
      attendanceDate: claims.attendanceDate,
      recordedBy: user.userId
    });
  }

  /**
   * Staff-only variant: the teacher's own device scans a STUDENT's ID
   * badge (not the session code) to check that specific learner in.
   * Serves young CBC learners whose accounts are shadow accounts with
   * no personal device (Sprint 5) — the teacher, not the child, holds
   * the phone.
   */
  async redeemAttendanceQrForStudent(
    user: AuthenticatedUser,
    dto: RedeemAttendanceQrForStudentDto
  ): Promise<void> {
    if (!STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Only teaching staff can check in a student by badge scan');
    }
    const claims = await this.qr.verifySession(dto.token);
    await this.attendanceMarker.markPresent({
      classStreamId: claims.classStreamId,
      learnerId: dto.studentId,
      attendanceDate: claims.attendanceDate,
      recordedBy: user.userId
    });
  }
}
