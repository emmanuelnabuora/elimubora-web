import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { LearningService } from './learning.service';
import type { LearningRepository } from './learning.repository';

const user = (role: AuthenticatedUser['role'], userId = 'u1'): AuthenticatedUser => ({
  userId,
  tenantId: 't1',
  role,
  sessionId: 's1'
});

describe('LearningService', () => {
  let repo: {
    createCourse: jest.Mock;
    enroll: jest.Mock;
    isEnrolled: jest.Mock;
    updateCourse: jest.Mock;
    createModule: jest.Mock;
    findAssignment: jest.Mock;
    findCompetenciesByIds: jest.Mock;
    createAssignment: jest.Mock;
    findSubmission: jest.Mock;
    upsertSubmissionForOnlineSubmit: jest.Mock;
    gradeSubmission: jest.Mock;
  };
  let service: LearningService;

  beforeEach(() => {
    repo = {
      createCourse: jest.fn(async () => ({ id: 'course-1' })),
      enroll: jest.fn(async () => ({ id: 'enr-1' })),
      isEnrolled: jest.fn(async () => false),
      updateCourse: jest.fn(async () => ({ id: 'course-1', status: 'published' })),
      createModule: jest.fn(async () => ({ id: 'mod-1' })),
      findAssignment: jest.fn(async () => ({ id: 'a1', courseId: 'course-1', competencyIds: [] })),
      findCompetenciesByIds: jest.fn(async () => []),
      createAssignment: jest.fn(async () => ({ id: 'a1', competencyIds: [] })),
      findSubmission: jest.fn(async () => null),
      upsertSubmissionForOnlineSubmit: jest.fn(async () => ({ id: 'sub-1' })),
      gradeSubmission: jest.fn(async () => ({ id: 'sub-1', score: 80 }))
    };
    service = new LearningService(repo as unknown as LearningRepository);
  });

  it('a learner cannot create a course', async () => {
    await expect(
      service.createCourse(user('learner'), {
        title: 'Math',
        learningArea: 'Mathematics',
        gradeLevel: 'G4'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.createCourse).not.toHaveBeenCalled();
  });

  it('a teacher creating a course is auto-enrolled as its teacher', async () => {
    await service.createCourse(user('teacher'), {
      title: 'Math',
      learningArea: 'Mathematics',
      gradeLevel: 'G4'
    });
    expect(repo.enroll).toHaveBeenCalledWith('course-1', 'u1', 'teacher');
  });

  it('a teacher who does not teach the course cannot update it', async () => {
    repo.isEnrolled.mockResolvedValueOnce(false);
    await expect(
      service.updateCourse(user('teacher'), 'course-1', { status: 'published' })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('school_admin can update any course in the tenant without an enrollment check', async () => {
    await service.updateCourse(user('school_admin'), 'course-1', { status: 'published' });
    expect(repo.isEnrolled).not.toHaveBeenCalled();
    expect(repo.updateCourse).toHaveBeenCalled();
  });

  it('a teacher who does teach the course can add a module', async () => {
    repo.isEnrolled.mockResolvedValueOnce(true);
    await service.createModule(user('teacher'), 'course-1', { title: 'Unit 1', position: 0 });
    expect(repo.createModule).toHaveBeenCalledWith('course-1', 'Unit 1', 0);
  });

  it('a learner not enrolled in the course cannot submit', async () => {
    repo.isEnrolled.mockResolvedValueOnce(false);
    await expect(
      service.submit(user('learner'), 'a1', { content: { answer: 'x' } })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.upsertSubmissionForOnlineSubmit).not.toHaveBeenCalled();
  });

  it('submitting twice is idempotent — the second call returns the existing submission', async () => {
    repo.isEnrolled.mockResolvedValue(true);
    repo.findSubmission.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'sub-existing' });

    const first = await service.submit(user('learner'), 'a1', { content: { answer: 'x' } });
    expect(repo.upsertSubmissionForOnlineSubmit).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ id: 'sub-1' });

    const second = await service.submit(user('learner'), 'a1', { content: { answer: 'y' } });
    expect(repo.upsertSubmissionForOnlineSubmit).toHaveBeenCalledTimes(1); // still 1 — no second write
    expect(second).toEqual({ id: 'sub-existing' });
  });

  it('a learner cannot grade a submission', async () => {
    await expect(
      service.grade(user('learner'), 'sub-1', { score: 90 })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.gradeSubmission).not.toHaveBeenCalled();
  });

  it('a teacher grading a nonexistent submission gets 404, not a silent success', async () => {
    repo.gradeSubmission.mockResolvedValueOnce(null);
    await expect(
      service.grade(user('teacher'), 'ghost', { score: 90 })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
