import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post
} from '@nestjs/common';
import { CurrentUser } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  activateAccountSchema,
  createApplicationSchema,
  createBehaviourNoteSchema,
  createClassStreamSchema,
  createGuardianSchema,
  decideApplicationSchema,
  decideTransferSchema,
  enrollStudentSchema,
  graduateStudentSchema,
  linkGuardianAccountSchema,
  linkGuardianSchema,
  requestTransferSchema,
  updateMedicalSchema,
  updatePhotoSchema,
  updateStudentDetailsSchema,
  type ActivateAccountDto,
  type CreateApplicationDto,
  type CreateBehaviourNoteDto,
  type CreateClassStreamDto,
  type CreateGuardianDto,
  type DecideApplicationDto,
  type DecideTransferDto,
  type EnrollStudentDto,
  type GraduateStudentDto,
  type LinkGuardianAccountDto,
  type LinkGuardianDto,
  type RequestTransferDto,
  type UpdateMedicalDto,
  type UpdatePhotoDto,
  type UpdateStudentDetailsDto
} from './sis.dto';
import { SisService } from './sis.service';

@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly sis: SisService) {}

  @Post()
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createApplicationSchema)) dto: CreateApplicationDto
  ) {
    return this.sis.submitApplication(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.sis.listApplications(user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sis.getApplication(id);
  }

  @Patch(':id/decision')
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decideApplicationSchema)) dto: DecideApplicationDto
  ) {
    return this.sis.decideApplication(user, id, dto);
  }
}

@Controller('class-streams')
export class ClassStreamsController {
  constructor(private readonly sis: SisService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createClassStreamSchema)) dto: CreateClassStreamDto
  ) {
    return this.sis.createClassStream(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.sis.listClassStreams(user);
  }

  @Get(':id/roster')
  roster(@Param('id', ParseUUIDPipe) id: string) {
    return this.sis.listRoster(id);
  }
}

@Controller('guardians')
export class GuardiansController {
  constructor(private readonly sis: SisService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createGuardianSchema)) dto: CreateGuardianDto
  ) {
    return this.sis.createGuardian(user, dto);
  }

  @Patch(':id/link-account')
  linkAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) guardianId: string,
    @Body(new ZodValidationPipe(linkGuardianAccountSchema)) dto: LinkGuardianAccountDto
  ) {
    return this.sis.linkGuardianAccount(user, guardianId, dto.userId);
  }
}

@Controller('students')
export class StudentsController {
  constructor(private readonly sis: SisService) {}

  @Post()
  enroll(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(enrollStudentSchema)) dto: EnrollStudentDto
  ) {
    return this.sis.enrollStudent(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.sis.listStudents(user);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.sis.getMyProfile(user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sis.getStudentProfile(id);
  }

  @Patch(':id/activate-account')
  activateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(activateAccountSchema)) dto: ActivateAccountDto
  ) {
    return this.sis.activateAccount(user, id, dto);
  }

  @Post(':id/guardians')
  linkGuardian(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) studentId: string,
    @Body(new ZodValidationPipe(linkGuardianSchema)) dto: LinkGuardianDto
  ) {
    return this.sis.linkGuardian(user, studentId, dto).then(() => this.sis.listGuardians(studentId));
  }

  @Get(':id/guardians')
  guardians(@Param('id', ParseUUIDPipe) studentId: string) {
    return this.sis.listGuardians(studentId);
  }

  @Get(':id/medical')
  getMedical(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) studentId: string) {
    return this.sis.getMedical(user, studentId);
  }

  @Patch(':id/medical')
  updateMedical(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) studentId: string,
    @Body(new ZodValidationPipe(updateMedicalSchema)) dto: UpdateMedicalDto
  ) {
    return this.sis.updateMedical(user, studentId, dto);
  }

  @Patch(':id/photo')
  updatePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) studentId: string,
    @Body(new ZodValidationPipe(updatePhotoSchema)) dto: UpdatePhotoDto
  ) {
    return this.sis.updatePhoto(user, studentId, dto);
  }

  @Patch(':id/details')
  updateDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) studentId: string,
    @Body(new ZodValidationPipe(updateStudentDetailsSchema)) dto: UpdateStudentDetailsDto
  ) {
    return this.sis.updateDetails(user, studentId, dto);
  }

  @Post(':id/transfers')
  requestTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) studentId: string,
    @Body(new ZodValidationPipe(requestTransferSchema)) dto: RequestTransferDto
  ) {
    return this.sis.requestTransfer(user, dto, studentId);
  }

  @Post(':id/graduate')
  graduate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) studentId: string,
    @Body(new ZodValidationPipe(graduateStudentSchema)) dto: GraduateStudentDto
  ) {
    return this.sis.graduate(user, studentId, dto);
  }

  @Post(':id/behaviour-notes')
  createBehaviourNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) studentId: string,
    @Body(new ZodValidationPipe(createBehaviourNoteSchema)) dto: CreateBehaviourNoteDto
  ) {
    return this.sis.createBehaviourNote(user, studentId, dto);
  }

  @Get(':id/behaviour-notes')
  listBehaviourNotes(@Param('id', ParseUUIDPipe) studentId: string) {
    return this.sis.listBehaviourNotes(studentId);
  }
}

@Controller('transfers')
export class TransfersController {
  constructor(private readonly sis: SisService) {}

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sis.getTransfer(user, id);
  }

  @Patch(':id/decision')
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decideTransferSchema)) dto: DecideTransferDto
  ) {
    return this.sis.decideTransfer(user, id, dto);
  }
}
