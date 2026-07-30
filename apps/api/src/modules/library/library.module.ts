import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { LibraryRepository } from './library.repository';
import { LibraryService } from './library.service';

/**
 * Digital Library (Module 10 — Sprint 10 scope): a resource catalog
 * (books, videos, simulations, past papers, teacher guides,
 * interactive content) filterable by subject/grade/type/tag, made
 * syncable for offline download manifests. File storage/streaming
 * itself is an infrastructure concern (S3/R2), not built here —
 * storage_key is an opaque pointer.
 */
@Module({
  controllers: [LibraryController],
  providers: [LibraryRepository, LibraryService]
})
export class LibraryModule {}
