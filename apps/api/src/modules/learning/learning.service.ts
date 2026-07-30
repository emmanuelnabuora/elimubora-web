import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { AiInteractionLogService } from '../../core/ai/ai-interaction-log.service';
import { AI_PROVIDER, type AiProvider } from '../../core/ai/ai-provider.port';
import type {
  CreateAssignmentDto,
  CreateCourseDto,
  CreateLessonDto,
  CreateModuleDto,
  CreateSubmissionDto,
  EnrollDto,
  GradeSubmissionDto,
  UpdateCourseDto
} from './learning.dto';
import { LearningRepository } from './learning.repository';
import type {
  Assignment,
  Competency,
  Course,
  CourseModuleRecord,
  Enrollment,
  Lesson,
  Submission
} from './learning.types';

const STAFF_ROLES = new Set(['teacher', 'school_admin', 'principal', 'platform_admin']);

/**
 * Authorization sits here, above the repository. Two layers protect
 * tenant data: RLS (a query simply cannot return another tenant's
 * rows) and this service (a member of the RIGHT tenant still must
 * hold the right role/enrollment for the action). Neither layer
 * substitutes for the other.
 */
@Injectable()
export class LearningService {
  constructor(
    private readonly repo: LearningRepository,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly aiLog: AiInteractionLogService
  ) {}

  private requireStaff(user: AuthenticatedUser): void {
    if (!STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Only teaching staff can perform this action');
    }
  }

  private async requireCourseTeacher(courseId: string, user: AuthenticatedUser): Promise<void> {
    if (user.role === 'school_admin' || user.role === 'principal' || user.role === 'platform_admin') {
      return; // administrators oversee all courses in their tenant
    }
    const teaches = await this.repo.isEnrolled(courseId, user.userId, 'teacher');
    if (!teaches) {
      throw new ForbiddenException('You do not teach this course');
    }
  }

  // ---------------- courses ----------------

  async createCourse(user: AuthenticatedUser, dto: CreateCourseDto): Promise<Course> {
    this.requireStaff(user);
    const course = await this.repo.createCourse({ ...dto, createdBy: user.userId });
    // The creator is enrolled as the course's first teacher automatically.
    await this.repo.enroll(course.id, user.userId, 'teacher');
    return course;
  }

  async getCourse(id: string): Promise<Course> {
    const course = await this.repo.findCourse(id);
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  listCourses(filter: { gradeLevel?: string; status?: string }): Promise<Course[]> {
    return this.repo.listCourses(filter);
  }

  async updateCourse(user: AuthenticatedUser, id: string, dto: UpdateCourseDto): Promise<Course> {
    await this.requireCourseTeacher(id, user);
    const updated = await this.repo.updateCourse(id, dto);
    if (!updated) throw new NotFoundException('Course not found');
    return updated;
  }

  // ---------------- modules & lessons ----------------

  async createModule(
    user: AuthenticatedUser,
    courseId: string,
    dto: CreateModuleDto
  ): Promise<CourseModuleRecord> {
    await this.requireCourseTeacher(courseId, user);
    return this.repo.createModule(courseId, dto.title, dto.position);
  }

  listModules(courseId: string): Promise<CourseModuleRecord[]> {
    return this.repo.listModules(courseId);
  }

  async createLesson(
    user: AuthenticatedUser,
    courseId: string,
    moduleId: string,
    dto: CreateLessonDto
  ): Promise<Lesson> {
    await this.requireCourseTeacher(courseId, user);
    return this.repo.createLesson(moduleId, dto.title, dto.position, dto.content);
  }

  listLessons(moduleId: string): Promise<Lesson[]> {
    return this.repo.listLessons(moduleId);
  }

  // ---------------- assignments ----------------

  async createAssignment(
    user: AuthenticatedUser,
    courseId: string,
    dto: CreateAssignmentDto
  ): Promise<Assignment & { competencies: Competency[] }> {
    await this.requireCourseTeacher(courseId, user);
    const assignment = await this.repo.createAssignment({ courseId, ...dto });
    const competencies = await this.repo.findCompetenciesByIds(assignment.competencyIds);
    return { ...assignment, competencies };
  }

  async getAssignment(id: string): Promise<Assignment> {
    const assignment = await this.repo.findAssignment(id);
    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }

  listAssignments(courseId: string): Promise<Assignment[]> {
    return this.repo.listAssignmentsForCourse(courseId);
  }

  // ---------------- enrollments ----------------

  async enroll(user: AuthenticatedUser, courseId: string, dto: EnrollDto): Promise<Enrollment> {
    await this.requireCourseTeacher(courseId, user);
    return this.repo.enroll(courseId, dto.userId, dto.courseRole);
  }

  listRoster(courseId: string): Promise<Enrollment[]> {
    return this.repo.listRosterForCourse(courseId);
  }

  // ---------------- submissions (synchronous/online path) ----------------

  /**
   * Online counterpart to SubmissionSyncHandler. Both funnel through
   * LearningRepository.upsertSubmission, so "submitted while online"
   * and "submitted while offline, synced later" are the same write
   * with the same idempotency guarantee.
   */
  async submit(
    user: AuthenticatedUser,
    assignmentId: string,
    dto: CreateSubmissionDto
  ): Promise<Submission> {
    const assignment = await this.getAssignment(assignmentId);
    const enrolled = await this.repo.isEnrolled(assignment.courseId, user.userId, 'learner');
    if (!enrolled) {
      throw new ForbiddenException('Not enrolled as a learner in this course');
    }
    const existing = await this.repo.findSubmission(assignmentId, user.userId);
    if (existing) return existing; // idempotent: one submission per learner per assignment
    return this.repo.upsertSubmissionForOnlineSubmit(assignmentId, user.userId, dto.content);
  }

  async getSubmission(assignmentId: string, learnerId: string): Promise<Submission> {
    const submission = await this.repo.findSubmission(assignmentId, learnerId);
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  listSubmissions(assignmentId: string): Promise<Submission[]> {
    return this.repo.listSubmissionsForAssignment(assignmentId);
  }

  async grade(
    user: AuthenticatedUser,
    submissionId: string,
    dto: GradeSubmissionDto
  ): Promise<Submission> {
    this.requireStaff(user);
    const graded = await this.repo.gradeSubmission(submissionId, { ...dto, gradedBy: user.userId });
    if (!graded) throw new NotFoundException('Submission not found');
    return graded;
  }

  /**
   * Drafts feedback text via the AI provider — returned to the
   * teacher for review, NEVER written into submissions.feedback
   * directly. Applying it (verbatim, edited, or ignored) still
   * requires the teacher to explicitly call `grade`, exactly like a
   * feedback they typed themselves. This is the AI Platform's third
   * human-in-the-loop pattern this sprint (alongside pending-review
   * lesson plans and exam questions): AI drafts, a person decides.
   */
  async draftFeedback(user: AuthenticatedUser, submissionId: string): Promise<{ draft: string }> {
    this.requireStaff(user);
    const submission = await this.repo.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundException('Submission not found');
    const assignment = await this.repo.findAssignment(submission.assignmentId);

    const result = await this.ai.complete({
      feature: 'feedback_draft',
      prompt: `Draft constructive feedback for a learner's submission to "${assignment?.title ?? 'an assignment'}". Submission content: ${JSON.stringify(submission.content).slice(0, 1000)}`,
      context: { submissionId, assignmentId: submission.assignmentId }
    });
    await this.aiLog.record({
      userId: user.userId,
      feature: 'feedback_draft',
      context: { submissionId },
      promptSummary: `feedback for submission ${submissionId}`,
      responseSummary: result.text
    });
    return { draft: result.text };
  }
}
